import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthChange, signOut } from './firebase/auth';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import PaletteHost from './components/PaletteHost';
import BottomNav from './components/BottomNav';
import LoginScreen from './components/LoginScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import BootScreen from './components/BootScreen';
import AskForAccessScreen from './components/AskForAccessScreen';
import { listenInvitedProjects, invitedJobsFingerprint } from './firebase/projectCatalog';
import { loadProfile, profileIsComplete, profileNeedsSetup, readProfileCache, recordSignIn } from './firebase/profiles';
import {
  FAMILY_ORG_ID,
  clearBootCache,
  clearLegacyFlatSessionKeys,
  clearSession,
  listenOrganisationsForEmail,
  readBootCache,
  readSession,
  setActiveOrgId,
  writeBootCache,
  writeSession,
} from './firebase/tenancy';
import {
  accessScreen,
  invitationReasonFromError,
  invitationReasonFromOrgs,
  isRetryableMembershipError,
  pickPreferredOrganisation,
} from './domain/accessGate';
import { jobIdFromPath } from './navigation';

const MEMBERSHIP_RETRY_MS = 2000;

function legalHtmlPath() {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/privacy') return '/privacy.html';
  if (path === '/terms') return '/terms.html';
  return null;
}

function LegalRedirect({ href }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return <BootScreen />;
}

function App() {
  const legalHref = legalHtmlPath();
  if (legalHref) {
    return <LegalRedirect href={legalHref} />;
  }
  return <AppShell />;
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlJobId = jobIdFromPath(location.pathname);
  const [authUser, setAuthUser] = useState(undefined);
  const [membership, setMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [projectId, setProjectId] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [projectName, setProjectName] = useState(null);
  const [jobInvitedEmails, setJobInvitedEmails] = useState([]);
  const [projectStatus, setProjectStatus] = useState('active');
  const [projectKind, setProjectKind] = useState('client');
  const [allowedJobs, setAllowedJobs] = useState([]);

  useEffect(() => {
    // Legacy PIN-era key. The string must stay; do not rename it to jobId.
    localStorage.removeItem('accessCode');
    const unsubscribe = onAuthChange((user) => {
      if (user && user.isAnonymous) {
        signOut();
        setAuthUser(null);
        return;
      }
      setAuthUser(user || null);
    });
    return () => unsubscribe();
  }, []);

  const authUid = authUser === undefined ? undefined : (authUser && authUser.uid) || null;
  const authEmail = (authUser && authUser.email) || '';

  useEffect(() => {
    let cancelled = false;
    let unsubOrgs = () => {};
    let unsubJobs = () => {};
    let retryTimer = 0;
    let lastFingerprint = '';
    let listeningOrgId = '';
    if (authUid === undefined) return undefined;
    if (!authUid) {
      setMembership(null);
      setMembershipLoading(false);
      setProfile(null);
      setProfileLoading(false);
      setAllowedJobs([]);
      setProjectId(null);
      setWorkspaceId(null);
      setProjectName(null);
      setJobInvitedEmails([]);
      setProjectStatus('active');
      setProjectKind('client');
      return undefined;
    }

    clearLegacyFlatSessionKeys();

    const cachedProfile = readProfileCache(authUid);
    if (profileIsComplete(cachedProfile)) {
      setProfile(cachedProfile);
    }

    const session = readSession(authUid);
    if (session.projectId) {
      setProjectId(session.projectId);
      setWorkspaceId(session.workspaceId);
      setProjectName(session.projectName);
      setJobInvitedEmails(session.invitedEmails || []);
      setProjectStatus(session.projectStatus || 'active');
    }

    // Paint the real app from last time's answer instead of holding the boot
    // logo through two round trips to a database that is not in this country.
    // The network chain below still runs and overwrites all of it.
    const cachedBoot = readBootCache(authUid);
    lastFingerprint = cachedBoot ? invitedJobsFingerprint(cachedBoot.jobs) : '';
    if (cachedBoot) {
      setMembership(cachedBoot.membership);
      setAllowedJobs(cachedBoot.jobs);
      if (cachedBoot.membership.orgId) setActiveOrgId(cachedBoot.membership.orgId);
      const current = cachedBoot.jobs.find((row) => row.projectId === session.projectId);
      if (current) {
        setProjectId(current.projectId);
        setWorkspaceId(current.workspaceId);
        setProjectName(current.name);
        setJobInvitedEmails(current.invitedEmails || []);
        setProjectStatus(current.status || 'active');
        setProjectKind(current.kind === 'own' ? 'own' : 'client');
      }
      setMembershipLoading(false);
    } else {
      setMembershipLoading(true);
    }
    setProfileLoading(true);

    loadProfile(authUid, authEmail).catch((err) => {
      console.error('Profile load failed:', err);
      return readProfileCache(authUid);
    }).then((savedProfile) => {
      if (cancelled) return;
      setProfile((current) => {
        if (profileIsComplete(savedProfile)) return savedProfile;
        if (profileIsComplete(current)) return current;
        return savedProfile;
      });
      setProfileLoading(false);
    });

    const clearOpenJob = () => {
      setAllowedJobs([]);
      setProjectId(null);
      setWorkspaceId(null);
      setProjectName(null);
      setJobInvitedEmails([]);
      setProjectStatus('active');
      setProjectKind('client');
    };

    const stopJobs = () => {
      unsubJobs();
      unsubJobs = () => {};
      listeningOrgId = '';
    };

    const applyJobs = (invite) => (allowed, meta) => {
      if (cancelled) return;
      if (meta.fromCache && allowed.length === 0) {
        setMembershipLoading(false);
        return;
      }
      const fingerprint = invitedJobsFingerprint(allowed);
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        setAllowedJobs(allowed);
        writeBootCache(authUid, invite, allowed);
        const stored = readSession(authUid);
        const current = allowed.find((row) => row.projectId === stored.projectId);
        if (current) {
          setProjectId(current.projectId);
          setWorkspaceId(current.workspaceId);
          setProjectName(current.name);
          setJobInvitedEmails(current.invitedEmails || []);
          setProjectStatus(current.status || 'active');
          setProjectKind(current.kind === 'own' ? 'own' : 'client');
        } else {
          writeSession(authUid, {
            projectId: null,
            workspaceId: null,
            projectName: null,
            orgId: invite.orgId,
            invitedEmails: [],
            projectStatus: null,
          });
          setProjectId(null);
          setWorkspaceId(null);
          setProjectName(null);
          setJobInvitedEmails([]);
          setProjectStatus('active');
          setProjectKind('client');
        }
      }
      setMembershipLoading(false);
    };

    const startJobs = (invite) => {
      if (listeningOrgId === invite.orgId) return;
      stopJobs();
      listeningOrgId = invite.orgId;
      setActiveOrgId(invite.orgId);
      unsubJobs = listenInvitedProjects(
        invite.email,
        applyJobs(invite),
        (err) => {
          console.error('Job list listen failed:', err);
          if (!cancelled) setMembershipLoading(false);
        },
      );
    };

    const attachOrgs = () => {
      unsubOrgs();
      unsubOrgs = listenOrganisationsForEmail(
        authEmail,
        (orgs, meta) => {
          if (cancelled) return;
          if (meta.fromCache && orgs.length === 0) return;
          if (invitationReasonFromOrgs(orgs.length) === 'not-on-list') {
            stopJobs();
            setMembership({ invited: false, reason: 'not-on-list', email: authEmail });
            clearBootCache(authUid);
            clearSession(authUid);
            clearOpenJob();
            setMembershipLoading(false);
            return;
          }
          const stored = readSession(authUid);
          const preferred = pickPreferredOrganisation(orgs, stored.orgId, FAMILY_ORG_ID) || orgs[0];
          setMembership(preferred);
          startJobs(preferred);
        },
        (err) => {
          console.error('Organisation lookup failed:', err);
          if (cancelled) return;
          stopJobs();
          setMembership({
            invited: false,
            reason: invitationReasonFromError(err),
            error: err && err.message,
            email: authEmail,
          });
          setMembershipLoading(false);
          if (!isRetryableMembershipError(err)) return;
          retryTimer = window.setTimeout(() => {
            if (!cancelled) attachOrgs();
          }, MEMBERSHIP_RETRY_MS);
        },
      );
    };

    attachOrgs();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      unsubOrgs();
      unsubJobs();
    };
  }, [authUid, authEmail]);

  useEffect(() => {
    if (!authUser || !authUser.uid || profileLoading) return undefined;
    if (profileNeedsSetup(profile)) return undefined;
    const key = `risingAmp.signInNotice.${authUser.uid}`;
    if (sessionStorage.getItem(key)) return undefined;
    sessionStorage.setItem(key, '1');
    recordSignIn(authUser.uid).catch(() => {});
    // Mail templates load only here, after first paint.
    import('./firebase/email')
      .then(({ sendNewSignInNotice }) => sendNewSignInNotice({ profile, to: authUser.email }))
      .catch(() => {});
    return undefined;
  }, [authUser, profile, profileLoading]);

  const handleLogout = async () => {
    clearSession(authUid);
    clearBootCache(authUid);
    await signOut();
    setMembership(null);
    setProfile(null);
    setAllowedJobs([]);
    setProjectId(null);
    setWorkspaceId(null);
    setProjectName(null);
    setJobInvitedEmails([]);
    setProjectStatus('active');
    setProjectKind('client');
  };

  const handlePickProject = (project) => {
    if (!project.projectId) {
      return;
    }
    const status = project.status === 'archived' ? 'archived' : 'active';
    writeSession(authUid, {
      projectId: project.projectId,
      workspaceId: project.workspaceId,
      projectName: project.name,
      orgId: membership && membership.orgId,
      invitedEmails: project.invitedEmails || [],
      projectStatus: status,
    });
    setProjectId(project.projectId);
    setWorkspaceId(project.workspaceId);
    setProjectName(project.name);
    setJobInvitedEmails(project.invitedEmails || []);
    setProjectStatus(status);
    setProjectKind(project.kind === 'own' ? 'own' : 'client');
    navigate(`/jobs/${encodeURIComponent(project.projectId)}`);
  };

  const handleJobKindChange = (kind) => {
    const next = kind === 'own' ? 'own' : 'client';
    setProjectKind(next);
    setAllowedJobs((jobs) => jobs.map((job) => (
      job.projectId === projectId ? { ...job, kind: next } : job
    )));
  };

  const handleJobAccessLost = () => {
    writeSession(authUid, {
      projectId: null,
      workspaceId: null,
      projectName: null,
      orgId: membership ? membership.orgId : null,
      invitedEmails: [],
      projectStatus: null,
    });
    setProjectId(null);
    setWorkspaceId(null);
    setProjectName(null);
    setJobInvitedEmails([]);
    setProjectStatus('active');
    setProjectKind('client');
  };

  useEffect(() => {
    if (membershipLoading || !membership || !membership.invited) return undefined;
    if (!urlJobId) return undefined;
    const row = allowedJobs.find((job) => job.projectId === urlJobId);
    if (row) {
      if (row.projectId !== projectId) {
        const status = row.status === 'archived' ? 'archived' : 'active';
        writeSession(authUid, {
          projectId: row.projectId,
          workspaceId: row.workspaceId,
          projectName: row.name,
          orgId: membership.orgId,
          invitedEmails: row.invitedEmails || [],
          projectStatus: status,
        });
        setProjectId(row.projectId);
        setWorkspaceId(row.workspaceId);
        setProjectName(row.name);
        setJobInvitedEmails(row.invitedEmails || []);
        setProjectStatus(status);
        setProjectKind(row.kind === 'own' ? 'own' : 'client');
      }
      return undefined;
    }
    navigate('/', { replace: true });
    return undefined;
  }, [urlJobId, allowedJobs, membership, membershipLoading, projectId, navigate]);

  if (authUser === undefined) {
    return <BootScreen />;
  }

  if (!authUser) {
    return <LoginScreen />;
  }

  const cachedProfile = authUid ? readProfileCache(authUid) : null;
  const shownProfile = profileIsComplete(profile)
    ? profile
    : (profileIsComplete(cachedProfile) ? cachedProfile : profile);

  const screen = accessScreen({
    membershipLoading,
    membership,
    profileLoading,
    profileIsComplete: profileIsComplete(shownProfile),
    profileNeedsSetup: profileNeedsSetup(shownProfile),
  });

  if (screen === 'boot') {
    return <BootScreen />;
  }

  if (screen === 'lookup-failed') {
    return (
      <AskForAccessScreen
        email={authEmail}
        reason="lookup-failed"
        onSignOut={handleLogout}
      />
    );
  }

  if (screen === 'ask-for-access') {
    return (
      <AskForAccessScreen
        email={authEmail}
        reason="not-on-list"
        onSignOut={handleLogout}
      />
    );
  }

  if (screen === 'profile-setup') {
    return (
      <ProfileSetupScreen
        user={authUser}
        initialProfile={shownProfile}
        onComplete={setProfile}
        onSignOut={handleLogout}
      />
    );
  }

  return (
    <AppProvider
      projectId={projectId}
      storageKey={workspaceId}
      projectName={projectName}
      membership={membership}
      allowedJobs={allowedJobs}
      onOpenJob={handlePickProject}
      onJobAccessLost={handleJobAccessLost}
      jobStatus={projectStatus}
      authUser={authUser}
      profile={shownProfile}
      setProfile={setProfile}
      onSignOut={handleLogout}
      jobInvitedEmails={jobInvitedEmails}
      jobKind={projectKind}
      onJobKindChange={handleJobKindChange}
    >
      <div className="app-shell flex bg-canvas text-ink overflow-hidden">
        <Sidebar
          user={authUser}
          projectName={projectName}
          onLogout={handleLogout}
        />
        <div className="app-main flex-1 flex flex-col min-w-0 w-full overflow-hidden">
          <Header projectName={projectName} />
          <MainContent />
        </div>
        <PaletteHost />
        <BottomNav />
      </div>
    </AppProvider>
  );
}

export default App;

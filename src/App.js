import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthChange, signOut } from './firebase/auth';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import CommandPalette from './components/CommandPalette';
import LoginScreen from './components/LoginScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import BootScreen from './components/BootScreen';
import AskForAccessScreen from './components/AskForAccessScreen';
import { listInvitedProjects } from './firebase/projectCatalog';
import { sendNewSignInNotice } from './firebase/email';
import { loadProfile, profileIsComplete, profileNeedsSetup, readProfileCache, recordSignIn } from './firebase/profiles';
import { clearSession, readSession, resolveInvitation, setActiveOrgId, writeSession } from './firebase/tenancy';
import { jobIdFromPath } from './navigation';
import './styles/premium-animations.css';

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
  const [projectId, setProjectId] = useState(() => readSession().projectId);
  const [workspaceId, setWorkspaceId] = useState(() => readSession().workspaceId);
  const [projectName, setProjectName] = useState(() => readSession().projectName);
  const [jobInvitedEmails, setJobInvitedEmails] = useState(() => readSession().invitedEmails || []);
  const [projectStatus, setProjectStatus] = useState(() => readSession().projectStatus || 'active');
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
    if (authUid === undefined) return undefined;
    if (!authUid) {
      setMembership(null);
      setMembershipLoading(false);
      setProfile(null);
      setProfileLoading(false);
      return undefined;
    }

    const cachedProfile = readProfileCache(authUid);
    if (profileIsComplete(cachedProfile)) {
      setProfile(cachedProfile);
    }
    setMembershipLoading(true);
    setProfileLoading(true);

    Promise.all([
      resolveInvitation({ email: authEmail }),
      loadProfile(authUid, authEmail).catch((err) => {
        console.error('Profile load failed:', err);
        return readProfileCache(authUid);
      }),
    ])
      .then(async ([invite, savedProfile]) => {
        if (cancelled) return;
        setMembership(invite);
        setProfile((current) => {
          if (profileIsComplete(savedProfile)) return savedProfile;
          if (profileIsComplete(current)) return current;
          return savedProfile;
        });
        setProfileLoading(false);

        if (!invite.invited) {
          clearSession();
          setAllowedJobs([]);
          setProjectId(null);
          setWorkspaceId(null);
          setProjectName(null);
          setJobInvitedEmails([]);
          setProjectStatus('active');
          setMembershipLoading(false);
          return;
        }

        setActiveOrgId(invite.orgId);
        const allowed = await listInvitedProjects(invite.email);
        if (cancelled) return;
        setAllowedJobs(allowed);
        const session = readSession();
        const current = allowed.find((row) => row.projectId === session.projectId);
        if (current) {
          setProjectId(current.projectId);
          setWorkspaceId(current.workspaceId);
          setProjectName(current.name);
          setJobInvitedEmails(current.invitedEmails || []);
          setProjectStatus(current.status || 'active');
        } else {
          writeSession({
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
        }
        setMembershipLoading(false);
      })
      .catch((err) => {
        console.error('Sign-in setup failed:', err);
        if (!cancelled) {
          setMembership({
            invited: false,
            reason: 'lookup-failed',
            email: authEmail,
          });
          setMembershipLoading(false);
          setProfileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUid, authEmail]);

  useEffect(() => {
    if (!authUser || !authUser.uid || profileLoading) return undefined;
    if (profileNeedsSetup(profile)) return undefined;
    const key = `risingAmp.signInNotice.${authUser.uid}`;
    if (sessionStorage.getItem(key)) return undefined;
    sessionStorage.setItem(key, '1');
    recordSignIn(authUser.uid).catch(() => {});
    sendNewSignInNotice({
      profile,
      to: authUser.email,
    }).catch(() => {});
    return undefined;
  }, [authUser, profile, profileLoading]);

  const handleLogout = async () => {
    await signOut();
    setMembership(null);
    setProfile(null);
    setProjectId(null);
    setWorkspaceId(null);
    setProjectName(null);
    setJobInvitedEmails([]);
    setProjectStatus('active');
  };

  const handlePickProject = (project) => {
    if (!project.projectId) {
      return;
    }
    const status = project.status === 'archived' ? 'archived' : 'active';
    writeSession({
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
  };

  const handleJobAccessLost = () => {
    writeSession({
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
  };

  const handleSwitchProject = () => {
    writeSession({
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
    navigate('/');
  };

  useEffect(() => {
    if (membershipLoading || !membership || !membership.invited) return undefined;
    if (!urlJobId) return undefined;
    const row = allowedJobs.find((job) => job.projectId === urlJobId);
    if (row) {
      if (row.projectId !== projectId) {
        const status = row.status === 'archived' ? 'archived' : 'active';
        writeSession({
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

  if (membershipLoading || !membership || (profileLoading && !profileIsComplete(shownProfile))) {
    return <BootScreen />;
  }

  if (profileNeedsSetup(shownProfile)) {
    return (
      <ProfileSetupScreen
        user={authUser}
        initialProfile={shownProfile}
        onComplete={setProfile}
        onSignOut={handleLogout}
      />
    );
  }

  if (!membership.invited) {
    return (
      <AskForAccessScreen
        email={authEmail}
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
      onOpenJob={handlePickProject}
      onJobAccessLost={handleJobAccessLost}
      jobStatus={projectStatus}
      authUser={authUser}
      profile={shownProfile}
      setProfile={setProfile}
      jobInvitedEmails={jobInvitedEmails}
    >
      <div className="app-shell flex bg-canvas text-ink overflow-hidden">
        <Sidebar
          user={authUser}
          projectName={projectName}
          onSwitchProject={handleSwitchProject}
        />
        <div className="app-main flex-1 flex flex-col min-w-0 w-full overflow-hidden">
          <Header
            onLogout={handleLogout}
            onSwitchProject={handleSwitchProject}
            projectName={projectName}
          />
          <MainContent />
        </div>
        <CommandPalette />
      </div>
    </AppProvider>
  );
}

export default App;

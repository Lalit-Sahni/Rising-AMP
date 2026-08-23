import React, { useEffect, useState } from 'react';
import { onAuthChange, signOut } from './firebase/auth';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import CommandPalette from './components/CommandPalette';
import LoginScreen from './components/LoginScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import BootScreen from './components/BootScreen';
import { listInvitedProjects } from './firebase/projectCatalog';
import { sendNewSignInNotice } from './firebase/email';
import { loadProfile, profileNeedsSetup, recordSignIn } from './firebase/profiles';
import { clearSession, readSession, resolveInvitation, writeSession } from './firebase/tenancy';
import './styles/premium-animations.css';

function App() {
  const [authUser, setAuthUser] = useState(undefined);
  const [membership, setMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [projectId, setProjectId] = useState(() => readSession().projectId);
  const [workspaceId, setWorkspaceId] = useState(() => readSession().workspaceId);
  const [projectName, setProjectName] = useState(() => readSession().projectName);
  const [jobInvitedEmails, setJobInvitedEmails] = useState(() => readSession().invitedEmails || []);

  useEffect(() => {
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

  useEffect(() => {
    let cancelled = false;
    if (!authUser) {
      setMembership(null);
      setMembershipLoading(false);
      setProfile(null);
      setProfileLoading(false);
      return undefined;
    }

    setMembershipLoading(true);
    setProfileLoading(true);

    Promise.all([
      resolveInvitation(authUser),
      loadProfile(authUser.uid).catch((err) => {
        console.error('Profile load failed:', err);
        return null;
      }),
    ])
      .then(async ([invite, savedProfile]) => {
        if (cancelled) return;
        setMembership(invite);
        setProfile(savedProfile);
        setProfileLoading(false);

        if (!invite.invited) {
          clearSession();
          setProjectId(null);
          setWorkspaceId(null);
          setProjectName(null);
          setJobInvitedEmails([]);
          setMembershipLoading(false);
          return;
        }

        const allowed = await listInvitedProjects(invite.email);
        if (cancelled) return;
        const session = readSession();
        const current = allowed.find((row) => row.projectId === session.projectId);
        if (current) {
          setProjectId(current.projectId);
          setWorkspaceId(current.workspaceId);
          setProjectName(current.name);
          setJobInvitedEmails(current.invitedEmails || []);
        } else {
          writeSession({
            projectId: null,
            workspaceId: null,
            projectName: null,
            orgId: invite.orgId,
            invitedEmails: [],
          });
          setProjectId(null);
          setWorkspaceId(null);
          setProjectName(null);
          setJobInvitedEmails([]);
        }
        setMembershipLoading(false);
      })
      .catch((err) => {
        console.error('Sign-in setup failed:', err);
        if (!cancelled) {
          setMembership({
            invited: false,
            reason: 'lookup-failed',
            email: authUser.email || '',
          });
          setMembershipLoading(false);
          setProfileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !authUser.uid || profileLoading) return undefined;
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
  };

  const handlePickProject = (project) => {
    if (!project.projectId) {
      return;
    }
    writeSession({
      projectId: project.projectId,
      workspaceId: project.workspaceId,
      projectName: project.name,
      orgId: membership && membership.orgId,
      invitedEmails: project.invitedEmails || [],
    });
    setProjectId(project.projectId);
    setWorkspaceId(project.workspaceId);
    setProjectName(project.name);
    setJobInvitedEmails(project.invitedEmails || []);
  };

  const handleSwitchProject = () => {
    writeSession({
      projectId: null,
      workspaceId: null,
      projectName: null,
      orgId: membership ? membership.orgId : null,
      invitedEmails: [],
    });
    setProjectId(null);
    setWorkspaceId(null);
    setProjectName(null);
    setJobInvitedEmails([]);
  };

  if (authUser === undefined) {
    return <BootScreen />;
  }

  if (!authUser) {
    return <LoginScreen />;
  }

  if (membershipLoading || profileLoading || !membership) {
    return <BootScreen />;
  }

  if (profileNeedsSetup(profile)) {
    return (
      <ProfileSetupScreen
        user={authUser}
        initialProfile={profile}
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
      onOpenJob={handlePickProject}
      authUser={authUser}
      profile={profile}
      setProfile={setProfile}
      jobInvitedEmails={jobInvitedEmails}
    >
      <div className="flex h-screen bg-canvas text-ink overflow-hidden">
        <Sidebar
          user={authUser}
          projectName={projectName}
          onSwitchProject={handleSwitchProject}
        />
        <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
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

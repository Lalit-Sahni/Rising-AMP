import React, { useEffect, useState } from 'react';
import { onAuthChange, signOut } from './firebase/auth';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import CommandPalette from './components/CommandPalette';
import LoginScreen from './components/LoginScreen';
import NotInvitedScreen from './components/NotInvitedScreen';
import ProjectPicker, { ChooserSkeleton } from './components/ProjectPicker';
import { listOrgProjects } from './firebase/projectCatalog';
import { clearSession, readSession, resolveInvitation, writeSession } from './firebase/tenancy';
import './styles/premium-animations.css';

function App() {
  const [authUser, setAuthUser] = useState(undefined);
  const [membership, setMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [projectId, setProjectId] = useState(() => readSession().projectId);
  const [workspaceId, setWorkspaceId] = useState(() => readSession().workspaceId);
  const [projectName, setProjectName] = useState(() => readSession().projectName);

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
      return undefined;
    }

    setMembershipLoading(true);
    resolveInvitation(authUser)
      .then(async (result) => {
        if (cancelled) return;
        setMembership(result);

        if (!result.invited) {
          clearSession();
          setProjectId(null);
          setWorkspaceId(null);
          setProjectName(null);
          setMembershipLoading(false);
          return;
        }

        const allowed = await listOrgProjects(result.email);
        if (cancelled) return;
        const session = readSession();
        const current = allowed.find((row) => row.projectId === session.projectId);
        if (current) {
          setProjectId(current.projectId);
          setWorkspaceId(current.workspaceId);
          setProjectName(current.name);
        } else {
          writeSession({
            projectId: null,
            workspaceId: null,
            projectName: null,
            orgId: result.orgId,
          });
          setProjectId(null);
          setWorkspaceId(null);
          setProjectName(null);
        }
        setMembershipLoading(false);
      })
      .catch((err) => {
        console.error('Invite check failed:', err);
        if (!cancelled) setMembershipLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const handleLogout = async () => {
    await signOut();
    setMembership(null);
    setProjectId(null);
    setWorkspaceId(null);
    setProjectName(null);
  };

  const handlePickProject = (project) => {
    if (!project.projectId) {
      return;
    }
    writeSession({
      projectId: project.projectId,
      workspaceId: project.workspaceId,
      projectName: project.name,
      orgId: membership.orgId,
    });
    setProjectId(project.projectId);
    setWorkspaceId(project.workspaceId);
    setProjectName(project.name);
  };

  const handleSwitchProject = () => {
    writeSession({
      projectId: null,
      workspaceId: null,
      projectName: null,
      orgId: membership ? membership.orgId : null,
    });
    setProjectId(null);
    setWorkspaceId(null);
    setProjectName(null);
  };

  if (authUser === undefined) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4" />
          <p className="text-slate-400 font-mono text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen />;
  }

  if (membershipLoading || !membership) {
    return <ChooserSkeleton />;
  }

  if (!membership.invited) {
    return (
      <NotInvitedScreen
        email={authUser.email || membership.email}
        reason={membership.reason}
        onSignOut={handleLogout}
      />
    );
  }

  if (!projectId) {
    return (
      <ProjectPicker
        membership={membership}
        onPick={handlePickProject}
        onSignOut={handleLogout}
      />
    );
  }

  return (
    <AppProvider projectId={projectId} storageKey={workspaceId}>
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

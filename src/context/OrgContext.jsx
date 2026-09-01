import React, { createContext, useContext } from 'react';

const OrgContext = createContext(null);

export function OrgProvider({
  children,
  membership,
  jobId,
  storageKey,
  projectName,
  jobStatus,
  jobInvitedEmails,
  jobKind,
  onJobKindChange,
  onOpenJob,
  onJobAccessLost,
}) {
  return (
    <OrgContext.Provider
      value={{
        membership,
        jobId,
        storageKey,
        projectName,
        jobStatus,
        jobInvitedEmails,
        jobKind: jobKind === 'own' ? 'own' : 'client',
        onJobKindChange,
        onOpenJob,
        onJobAccessLost,
        orgId: (membership && membership.orgId) || null,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within OrgProvider');
  }
  return context;
}

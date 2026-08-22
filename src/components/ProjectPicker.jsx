import React, { useEffect, useState } from 'react';
import { Check, HardHat, Pencil, UserPlus, X } from 'lucide-react';
import { canonicalEmail, emailInviteVariants, sendInviteFromSignedInGmail } from '../firebase/email';
import { inviteEmailToProject, listOrgProjects, renameOrgProject } from '../firebase/projectCatalog';

function displayInviteEmails(emails) {
  const seen = new Set();
  const out = [];
  for (const email of emails || []) {
    const key = canonicalEmail(email);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

const ProjectPicker = ({ membership, onPick, onSignOut }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [invitingId, setInvitingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [savingId, setSavingId] = useState(null);
  const isOwner = membership.role === 'owner';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await listOrgProjects(membership.email);
        if (!cancelled) setProjects(rows);
      } catch (err) {
        console.error('Job list failed:', err);
        if (!cancelled) setError('Could not load the job lists. Try again, or sign out.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [membership]);

  const startRename = (event, project) => {
    event.stopPropagation();
    setInvitingId(null);
    setEditingId(project.id);
    setDraftName(project.name);
    setError('');
  };

  const startInvite = (event, project) => {
    event.stopPropagation();
    setEditingId(null);
    setInvitingId(project.id);
    setDraftEmail('');
    setError('');
  };

  const cancelPanels = (event) => {
    if (event) event.stopPropagation();
    setEditingId(null);
    setInvitingId(null);
    setDraftName('');
    setDraftEmail('');
  };

  const saveRename = async (event, project) => {
    if (event) event.stopPropagation();
    const nextName = draftName.trim();
    if (!nextName) {
      setError('Please enter a name.');
      return;
    }

    setSavingId(project.id);
    setError('');
    try {
      const saved = await renameOrgProject(
        project.projectId,
        nextName,
        project.workspaceId
      );
      setProjects((current) =>
        current.map((row) => (row.id === project.id ? { ...row, name: saved } : row))
      );
      cancelPanels();
    } catch (err) {
      console.error('Rename failed:', err);
      setError(err.message || 'Could not save the new name.');
    } finally {
      setSavingId(null);
    }
  };

  const saveInvite = async (event, project) => {
    if (event) event.stopPropagation();
    const nextEmail = draftEmail.trim();
    if (!nextEmail) {
      setError('Enter a Gmail address.');
      return;
    }

    setSavingId(project.id);
    setError('');
    try {
      const saved = await inviteEmailToProject(project.projectId, nextEmail);
      const added = emailInviteVariants(saved);
      setProjects((current) =>
        current.map((row) =>
          row.id === project.id
            ? {
                ...row,
                invitedEmails: Array.from(new Set([...(row.invitedEmails || []), ...added])),
              }
            : row
        )
      );
      cancelPanels();
      try {
        await sendInviteFromSignedInGmail({ to: saved, projectName: project.name });
      } catch (mailErr) {
        console.error('Invite email failed:', mailErr);
        const closed = mailErr && mailErr.code === 'auth/popup-closed-by-user';
        setError(
          closed
            ? `${saved} is on ${project.name}. Google asked to send the email and that window was closed — tap Invite again to send it.`
            : `${saved} is on ${project.name}, but the email did not send. Ask them to open this same page and sign in with that Gmail.`
        );
      }
    } catch (err) {
      console.error('Invite failed:', err);
      setError(err.message || 'Could not save that invite.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl mb-4 shadow-lg">
            <HardHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{membership.orgName || 'Opal Track'}</h1>
          <p className="text-zinc-400">Choose a job list</p>
          {membership.email && (
            <p className="text-xs text-zinc-500 mt-2">{membership.email}</p>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xl">
          {loading && (
            <div className="py-10 text-center text-zinc-500 text-sm">Loading job lists…</div>
          )}

          {!loading && error && (
            <p className="text-red-600 text-sm mb-4">{error}</p>
          )}

          {!loading && !error && projects.length === 0 && (
            <p className="text-zinc-600 text-sm">No job lists were found for this account.</p>
          )}

          {!loading && projects.length > 0 && (
            <ul className="space-y-3">
              {projects.map((project) => {
                const extra = [];
                if (project.expenseCount) extra.push(`${project.expenseCount} expenses`);
                if (project.invoiceCount) extra.push(`${project.invoiceCount} invoices`);
                const isEditing = editingId === project.id;
                const isInviting = invitingId === project.id;
                const isSaving = savingId === project.id;

                return (
                  <li key={project.id}>
                    {isEditing ? (
                      <div className="px-4 py-3 rounded-lg border border-accent bg-zinc-50">
                        <input
                          autoFocus
                          type="text"
                          value={draftName}
                          disabled={isSaving}
                          onChange={(event) => setDraftName(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveRename(event, project);
                            if (event.key === 'Escape') cancelPanels(event);
                          }}
                          className="w-full px-3 py-2 rounded-md border border-zinc-300 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
                          maxLength={80}
                        />
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => cancelPanels(event)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-800"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(event) => saveRename(event, project)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-dark rounded-md disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : isInviting ? (
                      <div className="px-4 py-3 rounded-lg border border-accent bg-zinc-50">
                        <p className="text-sm text-zinc-700 mb-2">
                          Invite someone to <span className="font-medium">{project.name}</span> only. They will not see your other jobs. We will email them a link from your Gmail.
                        </p>
                        {displayInviteEmails(project.invitedEmails).length > 0 && (
                          <p className="text-xs text-zinc-500 mb-2">
                            Already on this job: {displayInviteEmails(project.invitedEmails).join(', ')}
                          </p>
                        )}
                        <input
                          autoFocus
                          type="email"
                          value={draftEmail}
                          disabled={isSaving}
                          placeholder="name@gmail.com"
                          onChange={(event) => setDraftEmail(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveInvite(event, project);
                            if (event.key === 'Escape') cancelPanels(event);
                          }}
                          className="w-full px-3 py-2 rounded-md border border-zinc-300 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => cancelPanels(event)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-800"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(event) => saveInvite(event, project)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-dark rounded-md disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            {isSaving ? 'Saving…' : 'Invite'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-stretch rounded-lg border border-zinc-200 hover:border-accent transition-colors">
                        <button
                          type="button"
                          onClick={() => onPick(project)}
                          className="flex-1 text-left px-4 py-3"
                        >
                          <div className="font-medium text-zinc-900">{project.name}</div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {extra.join(' · ') || 'No records yet'}
                          </div>
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={(event) => startInvite(event, project)}
                            className="px-3 text-zinc-400 hover:text-zinc-800"
                            title="Invite"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) => startRename(event, project)}
                          className="px-3 text-zinc-400 hover:text-zinc-800"
                          title="Rename"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-6 text-xs text-zinc-500 leading-relaxed">
            Invite is per job list. Type their Gmail and tap Invite — they get an email from you with a link.
          </p>

          <button
            type="button"
            onClick={onSignOut}
            className="mt-4 w-full text-sm text-zinc-500 hover:text-zinc-800 py-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectPicker;

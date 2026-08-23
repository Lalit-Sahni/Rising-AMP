import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Pencil, Search, UserPlus, X } from 'lucide-react';
import { canonicalEmail, emailInviteVariants, sendInviteFromSignedInGmail } from '../firebase/email';
import { inviteEmailToProject, listOrgProjects, renameOrgProject } from '../firebase/projectCatalog';
import BrandMark from './BrandMark';
import LoadingSkeleton from './ui/LoadingSkeleton';

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

function jobMark(name) {
  const trimmed = (name || '').trim();
  const digits = trimmed.match(/^(\d+)/);
  if (digits) return digits[1].slice(0, 3);
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase() || '?';
}

function accountLabel(email) {
  if (!email) return '';
  return email.split('@')[0];
}

function initials(email) {
  const local = accountLabel(email) || '?';
  return local.slice(0, 1).toUpperCase();
}

const ProjectPicker = ({ membership, onPick, onSignOut }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((row) => (row.name || '').toLowerCase().includes(q));
  }, [projects, query]);

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
      setError('Enter an email address.');
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
            : `${saved} is on ${project.name}, but the invite email did not send. Ask them to open this same page and sign in with that email.`
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
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] bg-surface border border-hairline rounded-2xl shadow-whisper p-8 min-h-[480px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <BrandMark size={26} icon={14} />
            {membership.orgName || 'RisingAMP'}
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 border border-hairline rounded-full pressable"
            title="Sign out"
          >
            <small className="font-mono text-[11px] text-slate-600 max-w-[8rem] truncate">
              {accountLabel(membership.email)}
            </small>
            <span className="w-[22px] h-[22px] rounded-full bg-steel-900 text-white grid place-items-center text-[10px] font-semibold">
              {initials(membership.email)}
            </span>
          </button>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tight text-ink mb-4">Choose a job list</h1>

        <label className="flex items-center gap-2.5 border border-hairline rounded-[10px] px-3.5 py-2.5 mb-3.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.7} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search job lists"
            className="flex-1 border-0 outline-none bg-transparent text-[13.5px] text-ink placeholder:text-slate-400"
          />
        </label>

        {loading && (
          <LoadingSkeleton type="job" lines={3} />
        )}

        {!loading && error && (
          <p className="text-neg text-sm mb-4">{error}</p>
        )}

        {!loading && !error && visible.length === 0 && (
          <p className="text-slate-600 text-sm">
            {query ? 'No job lists match that search.' : 'No job lists were found for this account.'}
          </p>
        )}

        {!loading && visible.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {visible.map((project) => {
              const extra = [];
              if (project.expenseCount) extra.push(`${project.expenseCount} expenses`);
              if (project.invoiceCount) extra.push(`${project.invoiceCount} invoices`);
              const isEditing = editingId === project.id;
              const isInviting = invitingId === project.id;
              const isSaving = savingId === project.id;

              return (
                <li key={project.id}>
                  {isEditing ? (
                    <div className="relative px-3.5 py-3 rounded-[11px] border border-accent bg-accent-tint">
                      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-accent" />
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
                        className="w-full px-3 py-2 rounded-ot-sm border border-hairline text-ink focus:outline-none focus:border-accent"
                        maxLength={80}
                      />
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => cancelPanels(event)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-ink"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={(event) => saveRename(event, project)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-600 rounded-ot-sm disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : isInviting ? (
                    <div className="relative px-3.5 py-3 rounded-[11px] border border-accent bg-accent-tint">
                      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-accent" />
                      <p className="text-sm text-ink mb-2">
                        Invite someone to <span className="font-medium">{project.name}</span> only. They will not see your other jobs.
                      </p>
                      {displayInviteEmails(project.invitedEmails).length > 0 && (
                        <p className="text-xs font-mono text-slate-400 mb-2">
                          Already on this job: {displayInviteEmails(project.invitedEmails).join(', ')}
                        </p>
                      )}
                      <input
                        autoFocus
                        type="email"
                        value={draftEmail}
                        disabled={isSaving}
                        placeholder="you@company.com.au"
                        onChange={(event) => setDraftEmail(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveInvite(event, project);
                          if (event.key === 'Escape') cancelPanels(event);
                        }}
                        className="w-full px-3 py-2 rounded-ot-sm border border-hairline text-ink focus:outline-none focus:border-accent"
                      />
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => cancelPanels(event)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-ink"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={(event) => saveInvite(event, project)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-600 rounded-ot-sm disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          {isSaving ? 'Saving…' : 'Invite'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group pressable flex items-stretch rounded-[11px] border border-hairline bg-surface">
                      <button
                        type="button"
                        onClick={() => onPick(project)}
                        className="flex-1 flex items-center gap-3 text-left px-3.5 py-3 min-w-0"
                      >
                        <span className="w-[38px] h-[38px] rounded-[9px] bg-canvas border border-hairline grid place-items-center font-mono text-xs font-semibold text-ink shrink-0">
                          {jobMark(project.name)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <b className="block text-sm font-semibold text-ink truncate">{project.name}</b>
                          <small className="block font-mono text-xs text-slate-400 truncate">
                            {extra.join(' · ') || 'No records yet'}
                          </small>
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.7} />
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={(event) => startInvite(event, project)}
                          className="px-2.5 text-slate-400 hover:text-ink"
                          title="Invite"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(event) => startRename(event, project)}
                        className="px-2.5 pr-3 text-slate-400 hover:text-ink"
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

        <p className="mt-auto pt-6 text-[11.5px] font-mono text-slate-400 leading-relaxed">
          Invite is per job list. Type their email and tap Invite — they get a link to this job only.
        </p>
      </div>
    </div>
  );
};

export function ChooserSkeleton() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center">
      <BrandMark size={40} icon={21} />
      <p className="mt-4 text-sm text-slate-400">Loading…</p>
    </div>
  );
}

export default ProjectPicker;

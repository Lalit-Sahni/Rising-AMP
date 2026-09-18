/**
 * Org people list. Lazy route — keep this off first paint.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { permissionDeniedMessage } from '../../firebase/permissionMessage';
import { inviteEmailToProject } from '../../firebase/projectCatalog';
import { listJobInvites } from '../../firebase/invites';
import {
  loadPeopleProfileCards,
  removePersonFromVisibleJobs,
  setPersonRoleOnJobs,
} from '../../firebase/people';
import type { JobInvite } from '../../domain/schemas';
import {
  JOB_ROLES_ON_CONTROL,
  actorCanManageJob,
  avatarColor,
  buildPeopleRows,
  collectDisplayEmails,
  confirmAddToJob,
  confirmChangeRole,
  confirmOrgRemove,
  confirmRemoveFromJob,
  confirmResendInvite,
  filterPeopleByJob,
  jobKey,
  jobsActorCanAddPersonTo,
  jobsActorCanRemovePersonFrom,
  peopleListSummary,
  peopleListSummaryShort,
  personInitials,
  personPanelModel,
  planOrgRemove,
  planRoleChange,
  roleControlDisabled,
  roleLabel,
  type PeopleJob,
  type PersonRow,
  type RoleAssign,
} from '../../domain/peoplePage';
import EmptyState from '../EmptyState';
import LoadingSkeleton from '../ui/LoadingSkeleton';

function RolePill({ role, label }: { role: PersonRow['role']; label: string }) {
  const cls = {
    owner: 'bg-accent-tint text-accent-600',
    manager: 'bg-[#EDEFF2] text-ink',
    site: 'border border-hairline bg-transparent text-slate-600',
    viewer: 'border border-dashed border-[#D5D9DE] bg-transparent text-slate-400',
    none: 'bg-warn-tint text-[#8A6418]',
  }[role];
  return (
    <span className={`inline-block text-[9.5px] font-extrabold tracking-[0.1em] uppercase px-2 py-1 rounded-[5px] whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function PersonAvatar({
  name,
  email,
  photoUrl,
  large,
}: {
  name: string;
  email: string;
  photoUrl: string;
  large?: boolean;
}) {
  const dim = large ? 'w-[42px] h-[42px] text-[14px]' : 'w-8 h-8 text-[11.5px]';
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={`${dim} rounded-full object-cover shrink-0`} />;
  }
  return (
    <span
      className={`${dim} rounded-full shrink-0 grid place-items-center font-bold text-white tracking-wide`}
      style={{ background: avatarColor(email) }}
    >
      {personInitials(name, email)}
    </span>
  );
}

export default function PeoplePage() {
  const { membership, allowedJobs, showToast } = useApp() as {
    membership: {
      role?: string;
      email?: string;
      ownerEmail?: string;
      orgName?: string;
    } | null;
    allowedJobs: PeopleJob[];
    showToast: (message: string, type?: string) => void;
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const jobFilter = searchParams.get('job') || null;
  const addParam = searchParams.get('add') === '1';
  const addRef = useRef<HTMLInputElement>(null);

  const actorEmail = membership?.email || '';
  const ownerEmail = membership?.ownerEmail || '';
  const actorIsOwner = membership?.role === 'owner';
  const orgName = membership?.orgName || 'Organisation';
  const jobs = useMemo(() => (Array.isArray(allowedJobs) ? allowedJobs : []), [allowedJobs]);

  const [profiles, setProfiles] = useState<Awaited<ReturnType<typeof loadPeopleProfileCards>>>([]);
  const [invites, setInvites] = useState<JobInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftEmail, setDraftEmail] = useState('');
  const [draftJobId, setDraftJobId] = useState('');
  const [busy, setBusy] = useState(false);
  const [panelMenu, setPanelMenu] = useState<'add' | 'remove' | null>(null);

  const emails = useMemo(() => collectDisplayEmails(jobs, ownerEmail), [jobs, ownerEmail]);

  useEffect(() => {
    let cancelled = false;
    if (emails.length === 0) {
      setProfiles([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    loadPeopleProfileCards(emails).then((rows) => {
      if (!cancelled) {
        setProfiles(rows);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setProfiles([]);
        setLoading(false);
        setError('Could not load people.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [emails.join('|')]);

  useEffect(() => {
    let cancelled = false;
    const ids = jobs.map(jobKey).filter(Boolean);
    if (ids.length === 0) {
      setInvites([]);
      return undefined;
    }
    Promise.all(ids.map((id) => listJobInvites(id).catch(() => [] as JobInvite[]))).then((groups) => {
      if (cancelled) return;
      setInvites(groups.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [jobs.map((job) => `${jobKey(job)}:${(job.invitedEmails || []).join(',')}`).join('|')]);

  useEffect(() => {
    if (!addParam) return;
    setAdding(true);
    const jobFromUrl = searchParams.get('job');
    if (jobFromUrl) setDraftJobId(jobFromUrl);
    const timer = window.setTimeout(() => addRef.current?.focus(), 0);
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true });
    return () => window.clearTimeout(timer);
  }, [addParam, searchParams, setSearchParams]);

  const people = useMemo(
    () => buildPeopleRows({ jobs, ownerEmail, profiles, invites }),
    [jobs, ownerEmail, profiles, invites],
  );
  const visible = useMemo(() => filterPeopleByJob(people, jobFilter), [people, jobFilter]);
  const selected = visible.find((row) => row.key === selectedKey) || null;

  const jobChips = useMemo(() => {
    return jobs
      .filter((job) => jobKey(job) && (job.status !== 'archived' || jobKey(job) === jobFilter))
      .map((job) => ({ id: jobKey(job), name: String(job.name || 'Untitled job') }));
  }, [jobs, jobFilter]);

  const manageJobs = useMemo(
    () => jobs.filter((job) => actorCanManageJob(job, actorEmail, ownerEmail, actorIsOwner)),
    [jobs, actorEmail, ownerEmail, actorIsOwner],
  );
  const canMutate = manageJobs.length > 0;

  const setJobFilter = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('job', id);
    else next.delete('job');
    setSearchParams(next, { replace: true });
  };

  const fail = (err: unknown, action?: 'invite' | 'remove' | 'role') => {
    const message = permissionDeniedMessage(err, action);
    setError(message);
    showToast(message, 'error');
  };

  const startAdd = () => {
    setAdding(true);
    setDraftEmail('');
    const preferred = jobFilter && manageJobs.some((job) => jobKey(job) === jobFilter)
      ? jobFilter
      : (manageJobs[0] ? jobKey(manageJobs[0]) : '');
    setDraftJobId(preferred);
    window.setTimeout(() => addRef.current?.focus(), 0);
  };

  const saveAdd = async () => {
    const email = draftEmail.trim();
    const job = jobs.find((row) => jobKey(row) === draftJobId);
    if (!email || !job) {
      setError('Enter an email and pick a job.');
      return;
    }
    if (!window.confirm(confirmAddToJob(email, job.name || 'this job'))) return;
    setBusy(true);
    setError('');
    try {
      const saved = await inviteEmailToProject(jobKey(job), email);
      setAdding(false);
      setDraftEmail('');
      showToast(`${saved} is on ${job.name}.`, 'success');
      try {
        const { sendJobInvite } = await import('../../firebase/email');
        await sendJobInvite({ to: saved, projectId: jobKey(job), projectName: job.name || '' });
      } catch (mailErr) {
        const closed = mailErr && typeof mailErr === 'object' && (mailErr as { code?: string }).code === 'auth/popup-closed-by-user';
        setError(
          closed
            ? `${saved} is on ${job.name}. Google asked to send the email and that window was closed — send it again.`
            : `${saved} is on ${job.name}, but the invite email did not send. Ask them to open this same page and sign in with that email.`,
        );
      }
      const cards = await loadPeopleProfileCards(collectDisplayEmails(jobs, ownerEmail).concat(saved));
      setProfiles(cards);
    } catch (err) {
      fail(err, 'invite');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (row: PersonRow, nextRole: RoleAssign) => {
    const planned = planRoleChange({
      jobs,
      email: row.email,
      ownerEmail,
      actorEmail,
      actorIsOwner,
      nextRole,
      filterJobId: jobFilter,
    });
    if (planned.blockedReason) {
      showToast(planned.blockedReason, 'error');
      return;
    }
    if (!window.confirm(confirmChangeRole(row.displayName, nextRole, planned.jobNames))) return;
    setBusy(true);
    setError('');
    try {
      await setPersonRoleOnJobs({
        projectIds: planned.jobIds,
        email: row.email,
        ownerEmail,
        nextRole,
      });
      showToast(`${row.displayName} is now ${roleLabel(nextRole)}.`, 'success');
    } catch (err) {
      fail(err, 'role');
    } finally {
      setBusy(false);
    }
  };

  const addToJob = async (row: PersonRow, projectId: string) => {
    const job = jobs.find((item) => jobKey(item) === projectId);
    if (!job) return;
    if (!window.confirm(confirmAddToJob(row.email, job.name || 'this job'))) return;
    setBusy(true);
    setError('');
    try {
      const saved = await inviteEmailToProject(projectId, row.email);
      setPanelMenu(null);
      showToast(`${saved} is on ${job.name}.`, 'success');
      try {
        const { sendJobInvite } = await import('../../firebase/email');
        await sendJobInvite({ to: saved, projectId, projectName: job.name || '' });
      } catch (mailErr) {
        fail(mailErr, 'invite');
      }
    } catch (err) {
      fail(err, 'invite');
    } finally {
      setBusy(false);
    }
  };

  const removeFromJob = async (row: PersonRow, projectId: string) => {
    const job = jobs.find((item) => jobKey(item) === projectId);
    if (!job) return;
    if (!window.confirm(confirmRemoveFromJob(row.email, job.name || 'this job'))) return;
    setBusy(true);
    setError('');
    try {
      await removePersonFromVisibleJobs({
        projectIds: [projectId],
        email: row.email,
        ownerEmail,
      });
      setPanelMenu(null);
      showToast(`${row.displayName} is off ${job.name}.`, 'success');
    } catch (err) {
      fail(err, 'remove');
    } finally {
      setBusy(false);
    }
  };

  const removeFromOrg = async (row: PersonRow) => {
    const planned = planOrgRemove({
      jobs,
      email: row.email,
      ownerEmail,
      actorEmail,
      actorIsOwner,
    });
    if (planned.blockedReason) {
      showToast(planned.blockedReason, 'error');
      return;
    }
    if (!window.confirm(confirmOrgRemove(row.displayName, planned.jobNames))) return;
    setBusy(true);
    setError('');
    try {
      await removePersonFromVisibleJobs({
        projectIds: planned.jobIds,
        email: row.email,
        ownerEmail,
      });
      setSelectedKey(null);
      showToast(`${row.displayName} is off the jobs you can see. They stay on the organisation.`, 'success');
    } catch (err) {
      fail(err, 'remove');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (row: PersonRow) => {
    const onJobs = jobsActorCanRemovePersonFrom({
      jobs,
      email: row.email,
      ownerEmail,
      actorEmail,
      actorIsOwner,
    });
    const target = (jobFilter && onJobs.find((job) => job.projectId === jobFilter)) || onJobs[0];
    if (!target) {
      showToast('There is no job you can send that invite for.', 'error');
      return;
    }
    if (!window.confirm(confirmResendInvite(row.email, target.name))) return;
    setBusy(true);
    setError('');
    try {
      const { sendJobInvite } = await import('../../firebase/email');
      await sendJobInvite({ to: row.email, projectId: target.projectId, projectName: target.name });
      const ids = jobs.map(jobKey).filter(Boolean);
      const groups = await Promise.all(ids.map((id) => listJobInvites(id).catch(() => [] as JobInvite[])));
      setInvites(groups.flat());
      showToast(`Invite sent to ${row.email}.`, 'success');
    } catch (err) {
      fail(err, 'invite');
    } finally {
      setBusy(false);
    }
  };

  const panel = selected ? personPanelModel({ row: selected }) : null;
  const controlRole = selected && jobFilter
    ? (selected.isOwner ? 'owner' : (selected.signedIn ? (selected.jobs.find((job) => job.projectId === jobFilter)?.role || selected.role) : 'none'))
    : (selected ? selected.role : 'none');
  const controlLock = selected
    ? roleControlDisabled({
      actorIsOwner,
      targetIsOwner: selected.isOwner,
      targetRole: controlRole,
    })
    : { all: true, owner: true, manager: true };
  const addable = selected
    ? jobsActorCanAddPersonTo({ jobs, email: selected.email, actorEmail, ownerEmail, actorIsOwner })
    : [];
  const removable = selected
    ? jobsActorCanRemovePersonFrom({ jobs, email: selected.email, ownerEmail, actorEmail, actorIsOwner })
    : [];

  const panelBody = selected && panel ? (
    <>
      <div className="flex items-center gap-3 pb-3.5 border-b border-hairline">
        <PersonAvatar name={panel.displayName} email={panel.email} photoUrl={panel.photoUrl} large />
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] font-extrabold tracking-tight text-ink">{panel.displayName}</b>
          <small className="block text-[11.5px] text-slate-400 mt-0.5 truncate">{panel.email}</small>
        </div>
        <button
          type="button"
          className="md:hidden w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas"
          onClick={() => setSelectedKey(null)}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="py-3 border-b border-hairline">
        <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-1.5">Role</div>
        <div className="flex border border-hairline rounded-[8px] overflow-hidden">
          {JOB_ROLES_ON_CONTROL.map((role) => {
            const on = controlRole === role;
            const disabled = busy || !canMutate || controlLock.all || role === 'owner' || (role === 'manager' && controlLock.manager);
            return (
              <button
                key={role}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (role === 'owner' || selected.isOwner) return;
                  changeRole(selected, role as RoleAssign);
                }}
                className={`flex-1 text-center text-[10.5px] font-bold py-[7px] px-0.5 border-r border-hairline last:border-0 ${
                  on ? 'bg-ink text-white' : 'text-slate-500'
                } ${disabled && !on ? 'opacity-40' : ''}`}
              >
                {roleLabel(role)}
              </button>
            );
          })}
        </div>
        {selected.roleDiffers ? (
          <p className="text-[11px] text-slate-400 mt-1.5">Differs by job</p>
        ) : null}
      </div>

      <div className="py-3 border-b border-hairline">
        <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-1.5">On these jobs</div>
        {panel.jobs.length === 0 ? (
          <div className="text-[12.5px] text-ink">None you can see</div>
        ) : panel.jobs.map((job) => (
          <div key={job.projectId} className="flex items-center justify-between gap-2 text-[12px] text-ink py-1">
            <span>{job.name}</span>
            <em className="not-italic text-[10.5px] text-slate-400">{roleLabel(job.role)}</em>
          </div>
        ))}
        {panel.invitedLabel ? (
          <div className="text-[11.5px] text-slate-400 mt-1">{panel.invitedLabel}</div>
        ) : null}
      </div>

      <div className="py-3 border-b border-hairline">
        <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-1.5">Last active</div>
        <div className="text-[12.5px] text-ink">{panel.lastActiveLabel}</div>
      </div>

      <div className="py-3 border-b border-hairline">
        <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-1.5">Last 90 days</div>
        <div className="text-[12.5px] text-ink leading-relaxed">{panel.activitySummary}</div>
      </div>

      {panel.inviteStatus ? (
        <div className="py-3 border-b border-hairline">
          <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-1.5">Invite</div>
          <div className="text-[12.5px] text-ink">{panel.inviteStatus}</div>
        </div>
      ) : null}

      {canMutate ? (
        <div className="flex flex-col gap-[7px] pt-3.5">
          {addable.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPanelMenu(panelMenu === 'add' ? null : 'add')}
              className="text-[12px] font-semibold px-[11px] py-2 rounded-[8px] border border-hairline text-ink bg-surface text-left"
            >
              Add to a job
            </button>
          ) : null}
          {panelMenu === 'add' ? addable.map((job) => (
            <button
              key={job.projectId}
              type="button"
              disabled={busy}
              onClick={() => addToJob(selected, job.projectId)}
              className="text-[12px] px-[11px] py-2 rounded-[8px] bg-canvas text-ink text-left"
            >
              {job.name}
            </button>
          )) : null}
          {removable.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPanelMenu(panelMenu === 'remove' ? null : 'remove')}
              className="text-[12px] font-semibold px-[11px] py-2 rounded-[8px] border border-hairline text-ink bg-surface text-left"
            >
              Remove from a job
            </button>
          ) : null}
          {panelMenu === 'remove' ? removable.map((job) => (
            <button
              key={job.projectId}
              type="button"
              disabled={busy}
              onClick={() => removeFromJob(selected, job.projectId)}
              className="text-[12px] px-[11px] py-2 rounded-[8px] bg-canvas text-ink text-left"
            >
              {job.name}
            </button>
          )) : null}
          {canMutate && !selected.isOwner && removable.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => resend(selected)}
              className="text-[12px] font-semibold px-[11px] py-2 rounded-[8px] border border-hairline text-ink bg-surface text-left"
            >
              Resend invite
            </button>
          ) : null}
          {!selected.isOwner ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => removeFromOrg(selected)}
              className="text-[12px] font-semibold px-[11px] py-2 rounded-[8px] border border-[#EDD4D0] text-neg bg-surface text-left"
            >
              Remove from {orgName}
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="text-[11px] text-slate-400 leading-relaxed pt-3">
        Phone numbers and addresses are not shown here, to anyone. They live on the person’s own profile and only they can read it. For a worker’s contact number, use the directory.
      </p>
    </>
  ) : null;

  return (
    <div className="flex min-h-full bg-canvas text-ink">
      <div className="flex-1 min-w-0 px-4 py-6 md:px-[26px] md:py-[26px]">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="eyebrow">{orgName}</div>
            <h1 className="text-[23px] font-extrabold tracking-tight mt-1">People</h1>
            <p className="text-[12.5px] text-slate-500 mt-1 hidden md:block">{peopleListSummary(visible)}</p>
            <p className="text-[12.5px] text-slate-500 mt-1 md:hidden">{peopleListSummaryShort(visible)}</p>
          </div>
          {canMutate ? (
            <button
              type="button"
              onClick={startAdd}
              className="inline-flex items-center justify-center gap-1.5 w-full md:w-auto px-3.5 py-2.5 text-[12.5px] font-bold text-white bg-accent hover:bg-accent-600 rounded-[8px]"
            >
              <Plus className="w-4 h-4" strokeWidth={2.2} />
              Add someone
            </button>
          ) : null}
        </div>

        {adding && canMutate ? (
          <div className="mt-4 bg-surface border border-hairline rounded-[12px] px-3.5 py-3">
            <p className="text-[13px] text-ink mb-2">Invite them to a job you can manage. They start as Site.</p>
            <input
              ref={addRef}
              type="email"
              value={draftEmail}
              disabled={busy}
              onChange={(event) => setDraftEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveAdd();
                if (event.key === 'Escape') setAdding(false);
              }}
              className="w-full px-3 py-2 rounded-ot-sm border border-hairline text-ink focus:outline-none focus:border-accent"
              placeholder="name@example.com"
            />
            <select
              value={draftJobId}
              disabled={busy}
              onChange={(event) => setDraftJobId(event.target.value)}
              className="mt-2 w-full px-3 py-2 rounded-ot-sm border border-hairline text-ink bg-surface"
            >
              {manageJobs.map((job) => (
                <option key={jobKey(job)} value={jobKey(job)}>{job.name}</option>
              ))}
            </select>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 text-sm text-slate-600">Cancel</button>
              <button type="button" onClick={saveAdd} disabled={busy} className="px-3 py-1.5 text-sm font-bold text-white bg-accent rounded-[8px]">Send invite</button>
            </div>
          </div>
        ) : null}

        <div className="flex gap-[7px] flex-wrap mt-[18px] mb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setJobFilter(null)}
            className={`text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full border whitespace-nowrap ${
              !jobFilter ? 'bg-ink border-ink text-white' : 'bg-surface border-hairline text-slate-600'
            }`}
          >
            Everyone
          </button>
          {jobChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setJobFilter(chip.id)}
              className={`text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full border whitespace-nowrap ${
                jobFilter === chip.id ? 'bg-ink border-ink text-white' : 'bg-surface border-hairline text-slate-600'
              }`}
            >
              {chip.name}
            </button>
          ))}
        </div>

        {error ? <p className="text-neg text-sm mb-3">{error}</p> : null}

        <div className="bg-surface border border-hairline rounded-[12px] overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2.1fr)_92px_minmax(0,1.5fr)_88px_26px] gap-3 items-center px-3.5 py-2.5 text-[9.5px] font-bold tracking-[0.13em] uppercase text-slate-400 border-b border-hairline bg-[#FBFCFD]">
            <span>Person</span>
            <span>Role</span>
            <span>Jobs</span>
            <span>Last active</span>
            <span />
          </div>

          {loading ? (
            <div className="p-4">
              <LoadingSkeleton type="job" lines={4} />
            </div>
          ) : null}

          {!loading && visible.length === 0 ? (
            <div className="px-4 py-6">
              <EmptyState
                title={jobFilter ? 'Nobody on this job' : 'No people yet'}
                body={jobFilter ? 'Invite someone to this job, or switch back to Everyone.' : 'People on jobs you can see will show up here.'}
              />
            </div>
          ) : null}

          {!loading && visible.map((row) => {
            const on = selectedKey === row.key;
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => {
                  setSelectedKey(row.key);
                  setPanelMenu(null);
                }}
                className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.1fr)_92px_minmax(0,1.5fr)_88px_26px] gap-2 md:gap-3 items-center px-3 md:px-3.5 py-[11px] md:py-2.5 border-b border-hairline last:border-0 min-h-[54px] ${
                  on ? 'bg-[#FBF7F4] shadow-[inset_3px_0_0_var(--accent)]' : 'hover:bg-[#FCFCFD]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <PersonAvatar name={row.displayName} email={row.email} photoUrl={row.photoUrl} />
                  <span className="min-w-0">
                    <b className="block text-[13px] font-bold text-ink tracking-tight truncate">{row.displayName}</b>
                    <small className="hidden md:block text-[11px] text-slate-400 truncate mt-px">{row.email}</small>
                    {row.signedIn ? (
                      <small className="md:hidden text-[11px] text-slate-400 truncate mt-px">
                        {`${row.jobsLabelShort} · ${row.lastActiveLabel.toLowerCase()}`}
                      </small>
                    ) : (
                      <span className="md:hidden inline-flex items-center gap-1.5 text-[10.5px] font-bold text-warn mt-0.5">
                        <i className="w-[5px] h-[5px] rounded-full bg-warn not-italic" />
                        {row.flagLabelShort}
                      </span>
                    )}
                    {row.flagLabel ? (
                      <span className="hidden md:inline-flex items-center gap-1.5 text-[10.5px] font-bold text-warn mt-0.5">
                        <i className="w-[5px] h-[5px] rounded-full bg-warn not-italic" />
                        {row.flagLabel}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span><RolePill role={row.role} label={row.roleLabel} /></span>
                <span className="hidden md:block text-[11.5px] text-slate-600 leading-snug">{row.jobsLabel}</span>
                <span className={`hidden md:block text-[11px] tabular-nums whitespace-nowrap ${row.lastActiveWarn ? 'text-warn font-semibold' : 'text-slate-400'}`}>
                  {row.lastActiveLabel}
                </span>
                <ChevronRight className="hidden md:block w-4 h-4 text-slate-400 justify-self-end" strokeWidth={1.7} />
              </button>
            );
          })}
        </div>
      </div>

      {selected && panelBody ? (
        <aside className="hidden md:block w-[296px] shrink-0 border-l border-hairline bg-surface px-[18px] py-5 overflow-y-auto">
          {panelBody}
        </aside>
      ) : null}

      {selected && panelBody ? (
        <div className="md:hidden fixed inset-0 z-50 bg-surface overflow-y-auto px-[18px] py-5">
          {panelBody}
        </div>
      ) : null}
    </div>
  );
}

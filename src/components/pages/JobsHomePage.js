import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Pencil, Search, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { canonicalEmail, emailInviteVariants, sendJobInvite } from '../../firebase/email';
import { inviteEmailToProject, renameOrgProject } from '../../firebase/projectCatalog';
import { loadInvitedJobSummaries } from '../../firebase/jobSummaries';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import {
  derivePortfolio,
  formatMoneyCompact,
  formatPercent,
  jobMark,
  verdictCopy,
  VERDICT,
} from '../../utils/jobMetrics';

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

function marginBarColor(verdict) {
  if (verdict === VERDICT.MARGIN_AT_RISK) return 'var(--warn)';
  if (verdict === VERDICT.ON_TRACK) return 'var(--pos)';
  return 'transparent';
}

export default function JobsHomePage() {
  const { membership, onOpenJob, setCurrentPage } = useApp();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [invitingId, setInvitingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [savingId, setSavingId] = useState(null);
  const isOwner = membership && membership.role === 'owner';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!membership || !membership.email) {
        setJobs([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const rows = await loadInvitedJobSummaries(membership.email);
        if (!cancelled) setJobs(rows);
      } catch (err) {
        console.error('Jobs home failed:', err);
        if (!cancelled) setError('Could not load jobs. Try again, or sign out.');
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
    if (!q) return jobs;
    return jobs.filter((row) => (row.name || '').toLowerCase().includes(q) || (row.subtitle || '').toLowerCase().includes(q));
  }, [jobs, query]);

  const portfolio = useMemo(() => derivePortfolio(visible), [visible]);

  const openJob = (project) => {
    if (!project.projectId || !onOpenJob) return;
    onOpenJob(project);
    setCurrentPage('dashboard');
  };

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
      const saved = await renameOrgProject(project.projectId, nextName, project.workspaceId);
      setJobs((current) => current.map((row) => (row.id === project.id ? { ...row, name: saved } : row)));
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
      setJobs((current) =>
        current.map((row) =>
          row.id === project.id
            ? { ...row, invitedEmails: Array.from(new Set([...(row.invitedEmails || []), ...added])) }
            : row
        )
      );
      cancelPanels();
      try {
        await sendJobInvite({ to: saved, projectId: project.projectId, projectName: project.name });
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
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 mb-5">
          <div>
            <div className="eyebrow">Portfolio</div>
            <h1 className="text-[25px] font-extrabold tracking-tight mt-1">Jobs</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">Every job, and how each one is tracking.</p>
          </div>
          <label className="flex items-center gap-2.5 border border-hairline rounded-[10px] px-3.5 py-2 bg-surface max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.7} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search jobs"
              className="flex-1 border-0 outline-none bg-transparent text-[13.5px] text-ink placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-[18px]">
          {[
            ['Active jobs', loading ? null : portfolio.activeJobs],
            ['Contracts', loading ? null : (portfolio.contracts == null ? '—' : formatMoneyCompact(portfolio.contracts))],
            ['Combined margin', 'margin'],
            ['Need attention', loading ? null : portfolio.needAttention],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface border border-hairline rounded-ot px-[17px] py-[15px] shadow-whisper">
              <div className="text-[11.5px] text-slate-400 font-semibold">{label}</div>
              {loading ? (
                <div className="h-7 w-16 skeleton-bar rounded mt-1.5" />
              ) : label === 'Combined margin' ? (
                <div className="tabular text-[21px] font-extrabold tracking-tight mt-1.5">
                  {portfolio.hasMargin ? (
                    <>
                      <span className={portfolio.margin < 0 ? 'text-neg' : 'text-pos'}>{formatMoneyCompact(portfolio.margin)}</span>
                      {' '}
                      <small className="text-xs font-semibold text-slate-400">{formatPercent(portfolio.marginPct)}</small>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              ) : (
                <div className="tabular text-[21px] font-extrabold tracking-tight mt-1.5">{value}</div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-neg text-sm mb-4">{error}</p>}

        <div className="bg-surface border border-hairline rounded-ot shadow-whisper overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_28px] gap-3.5 items-center px-[18px] py-3.5 text-[11px] font-bold tracking-[0.06em] uppercase text-slate-400 border-b border-hairline">
            <span>Job</span>
            <span>Margin</span>
            <span>Status</span>
            <span>Needs you</span>
            <span />
          </div>

          {loading && (
            <div className="p-4">
              <LoadingSkeleton type="job" lines={3} />
            </div>
          )}

          {!loading && visible.length === 0 && (
            <p className="text-slate-600 text-sm px-[18px] py-8">
              {query ? 'No jobs match that search.' : 'No jobs yet. When you are added to a job, it will show up here.'}
            </p>
          )}

          {!loading &&
            visible.map((project) => {
              const metrics = project.metrics;
              const copy = verdictCopy(metrics.verdict);
              const isEditing = editingId === project.id;
              const isInviting = invitingId === project.id;
              const isSaving = savingId === project.id;
              const bar = metrics.hasMargin ? Math.max(0, Math.min(100, metrics.marginPct)) : 0;
              const toneClass =
                copy.tone === 'ok' ? 'text-pos' : copy.tone === 'warn' ? 'text-warn' : 'text-slate-500';
              const dotClass =
                copy.tone === 'ok' ? 'bg-pos' : copy.tone === 'warn' ? 'bg-warn' : 'bg-slate-400';

              if (isEditing) {
                return (
                  <div key={project.id} className="px-[18px] py-4 border-b border-hairline last:border-0">
                    <input
                      autoFocus
                      type="text"
                      value={draftName}
                      disabled={isSaving}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveRename(event, project);
                        if (event.key === 'Escape') cancelPanels(event);
                      }}
                      className="w-full px-3 py-2 rounded-ot-sm border border-hairline text-ink focus:outline-none focus:border-accent"
                      maxLength={80}
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button type="button" onClick={cancelPanels} disabled={isSaving} className="px-3 py-1.5 text-sm text-slate-600">
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
                );
              }

              if (isInviting) {
                return (
                  <div key={project.id} className="px-[18px] py-4 border-b border-hairline last:border-0">
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
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveInvite(event, project);
                        if (event.key === 'Escape') cancelPanels(event);
                      }}
                      className="w-full px-3 py-2 rounded-ot-sm border border-hairline text-ink focus:outline-none focus:border-accent"
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button type="button" onClick={cancelPanels} disabled={isSaving} className="px-3 py-1.5 text-sm text-slate-600">
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
                );
              }

              return (
                <div
                  key={project.id}
                  className="grid grid-cols-[minmax(0,1fr)_28px] md:grid-cols-[minmax(0,2.3fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_28px] gap-3.5 items-center px-[18px] py-3.5 border-b border-hairline last:border-0 hover:bg-[#FCFCFD] cursor-pointer"
                  onClick={() => openJob(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openJob(project);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-[38px] h-[38px] rounded-[9px] bg-canvas border border-hairline grid place-items-center text-xs font-bold text-ink shrink-0">
                      {jobMark(project.name)}
                    </span>
                    <div className="min-w-0">
                      <b className="block text-sm font-bold truncate">{project.name}</b>
                      <small className="block text-xs text-slate-400 truncate">{project.subtitle}</small>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2.5 min-w-0">
                    <span className="flex-1 h-[7px] bg-[#EEF0F2] rounded overflow-hidden min-w-[60px]">
                      <span
                        className="block h-full rounded"
                        style={{ width: `${bar}%`, background: marginBarColor(metrics.verdict) }}
                      />
                    </span>
                    <span
                      className="tabular text-[13px] font-bold w-11 text-right"
                      style={{ color: metrics.hasMargin ? undefined : 'var(--slate-400)' }}
                    >
                      {metrics.hasMargin ? formatPercent(metrics.marginPct) : '—'}
                    </span>
                  </div>
                  <div className={`hidden md:inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${toneClass}`}>
                    <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                    {copy.label}
                  </div>
                  <div className="hidden md:block text-[12.5px] font-semibold tabular text-slate-500">
                    {metrics.attentionCount > 0 ? (
                      `${metrics.attentionCount} item${metrics.attentionCount === 1 ? '' : 's'}`
                    ) : (
                      <span className="text-slate-400 font-medium">All clear</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={(event) => startInvite(event, project)}
                        className="p-1 text-slate-400 hover:text-ink"
                        title="Invite"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => startRename(event, project)}
                      className="p-1 text-slate-400 hover:text-ink"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-400 hidden md:block" strokeWidth={1.7} />
                  </div>
                </div>
              );
            })}

          <div className="flex items-center gap-2.5 px-[18px] py-3.5 text-[13px] font-semibold text-slate-500 border-t border-dashed border-hairline">
            {isOwner
              ? 'New jobs are still created by hand. Ask if a job list is missing.'
              : 'Jobs you are added to will show up here.'}
          </div>
        </div>
      </div>
    </div>
  );
}

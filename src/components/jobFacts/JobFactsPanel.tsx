/**
 * The job facts record on Overview. Grouped, editable in place.
 * Not the Cost Plan / HIA proposal sheet.
 */
import { useMemo, useState, type InputHTMLAttributes } from 'react';
import {
  FACT_SOURCE_LABELS,
  JOB_FACT_FIELD_KIND,
  JOB_FACT_FIELD_LABELS,
  JOB_FACT_GROUPS,
  buildConfirmFactPatch,
  buildOwnerFactPatch,
  draftFromFact,
  formatFactValue,
  isFactConfirmed,
  type JobFactFieldName,
  type JobFactGroupId,
  type JobFacts,
} from '../../domain/jobFacts';

type JobFactsPanelProps = {
  jobId: string;
  userId: string;
  facts: JobFacts | null;
  onFactsChange: (facts: JobFacts | null) => void;
  showToast: (message: string, type?: string) => void;
};

function inputModeFor(field: JobFactFieldName): InputHTMLAttributes<HTMLInputElement> {
  const kind = JOB_FACT_FIELD_KIND[field];
  if (kind === 'date') return { type: 'date' };
  if (kind === 'int' || kind === 'percent') return { type: 'number', inputMode: 'numeric' };
  if (kind === 'area' || kind === 'cents') return { type: 'text', inputMode: 'decimal' };
  return { type: 'text' };
}

function hintFor(field: JobFactFieldName): string {
  const kind = JOB_FACT_FIELD_KIND[field];
  if (kind === 'area') return 'sqm';
  if (kind === 'percent') return '%';
  return '';
}

export default function JobFactsPanel({
  jobId,
  userId,
  facts,
  onFactsChange,
  showToast,
}: JobFactsPanelProps) {
  const [editing, setEditing] = useState<JobFactFieldName | null>(null);
  const [draft, setDraft] = useState('');
  const [addingGroup, setAddingGroup] = useState<JobFactGroupId | null>(null);
  const [sourceOpen, setSourceOpen] = useState<JobFactFieldName | null>(null);
  const [busyField, setBusyField] = useState<JobFactFieldName | null>(null);
  const [error, setError] = useState('');

  const groups = useMemo(() => (
    JOB_FACT_GROUPS.map((group) => {
      const present = group.fields.filter((name) => facts?.[name]);
      const missing = group.fields.filter((name) => !facts?.[name]);
      return { ...group, present, missing };
    })
  ), [facts]);

  const startEdit = (field: JobFactFieldName) => {
    setEditing(field);
    setDraft(draftFromFact(field, facts?.[field]));
    setError('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
    setError('');
  };

  const writePatch = async (field: JobFactFieldName, patch: ReturnType<typeof buildOwnerFactPatch>) => {
    if (!patch.ok) {
      if (patch.reason === 'empty') {
        setError('Leave that blank if you do not know it. Empty values are not saved.');
        return;
      }
      setError('That value is not valid.');
      return;
    }
    if (!userId) {
      setError('Sign in to save this detail.');
      return;
    }
    setBusyField(field);
    setError('');
    try {
      const { saveJobFacts } = await import('../../firebase/jobFacts');
      const result = await saveJobFacts(jobId, patch.patch, { createdBy: userId });
      onFactsChange(result.facts);
      setEditing(null);
      setDraft('');
      if (addingGroup) {
        const group = JOB_FACT_GROUPS.find((row) => row.id === addingGroup);
        const stillMissing = group?.fields.some((name) => name !== field && !result.facts[name]);
        if (!stillMissing) setAddingGroup(null);
      }
      if (result.written.includes(field)) {
        showToast('Saved that job detail.', 'success');
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Could not save that detail.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusyField(null);
    }
  };

  const saveEdit = (field: JobFactFieldName, raw = draft) => {
    void writePatch(field, buildOwnerFactPatch(field, raw, userId, new Date()));
  };

  const confirmField = (field: JobFactFieldName) => {
    if (!facts) return;
    void writePatch(field, buildConfirmFactPatch(field, facts, userId, new Date()));
  };

  return (
    <div className="bg-surface border border-hairline rounded-ot px-5 py-[18px] shadow-whisper">
      <h3 className="text-sm font-extrabold mb-1">Details</h3>
      <p className="text-[12.5px] text-slate-500 mb-3">
        What this job is. Each figure keeps where it came from.
      </p>

      {groups.map((group) => (
        <div key={group.id} className="py-2.5 border-t border-hairline first:border-t-0 first:pt-0">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-[12px] font-bold tracking-[0.08em] uppercase text-slate-400">{group.label}</h4>
            {group.missing.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setAddingGroup((current) => (current === group.id ? null : group.id));
                  cancelEdit();
                }}
                className="text-[12px] text-slate-400 hover:text-ink"
              >
                {addingGroup === group.id ? 'Done' : 'Add a detail'}
              </button>
            ) : null}
          </div>

          {group.present.map((field) => {
            const fact = facts?.[field];
            if (!fact) return null;
            const confirmed = isFactConfirmed(fact);
            const sourceLabel = FACT_SOURCE_LABELS[fact.source];
            const showSource = sourceOpen === field;
            const isEditing = editing === field;
            const suffix = hintFor(field);
            const display = formatFactValue(field, fact) || String(fact.value);
            return (
              <div key={field} className="mt-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-slate-500">{JOB_FACT_FIELD_LABELS[field]}</div>
                    {isEditing ? (
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          {...inputModeFor(field)}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          className="min-h-[36px] flex-1 px-2 py-1.5 rounded-ot-sm border border-hairline bg-surface text-[13px] text-ink"
                          aria-label={JOB_FACT_FIELD_LABELS[field]}
                        />
                        {suffix ? <span className="text-[12px] text-slate-400 shrink-0">{suffix}</span> : null}
                      </div>
                    ) : (
                      <div className="mt-0.5 flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          className="w-[7px] h-[7px] rounded-full bg-[#D6D9DD] shrink-0"
                          aria-label={sourceLabel}
                          title={sourceLabel}
                          onClick={() => setSourceOpen((current) => (current === field ? null : field))}
                        />
                        <span className="text-[13.5px] font-semibold text-ink truncate">
                          {display}
                        </span>
                      </div>
                    )}
                    {showSource && !isEditing ? (
                      <p className="text-[11px] text-slate-400 mt-0.5">{sourceLabel}</p>
                    ) : null}
                    {!confirmed && !isEditing ? (
                      <p className="text-[11px] text-slate-400 mt-0.5">Not confirmed</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={busyField === field}
                          onClick={() => saveEdit(field)}
                          className="min-h-[36px] px-3 py-1 rounded-ot-sm bg-accent text-white text-[12.5px] font-bold disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={busyField === field}
                          onClick={cancelEdit}
                          className="min-h-[36px] px-3 py-1 rounded-ot-sm border border-hairline text-[12.5px] font-bold text-slate-600"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {!confirmed ? (
                          <button
                            type="button"
                            disabled={busyField === field}
                            onClick={() => confirmField(field)}
                            className="min-h-[36px] px-3 py-1 rounded-ot-sm border border-hairline text-[12.5px] font-bold text-ink disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busyField === field}
                          onClick={() => startEdit(field)}
                          className="min-h-[36px] px-3 py-1 rounded-ot-sm text-[12.5px] font-bold text-slate-600 hover:text-ink"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {addingGroup === group.id ? group.missing.map((field) => {
            const isEditing = editing === field;
            const suffix = hintFor(field);
            return (
              <div key={`add-${field}`} className="mt-2.5">
                <label className="block text-[12.5px] text-slate-500">
                  {JOB_FACT_FIELD_LABELS[field]}
                  <span className="flex items-center gap-2 mt-1">
                    <input
                      {...inputModeFor(field)}
                      value={isEditing ? draft : ''}
                      onFocus={() => {
                        if (!isEditing) {
                          setEditing(field);
                          setDraft('');
                          setError('');
                        }
                      }}
                      onChange={(event) => {
                        setEditing(field);
                        setDraft(event.target.value);
                      }}
                      className="min-h-[36px] flex-1 px-2 py-1.5 rounded-ot-sm border border-hairline bg-surface text-[13px] text-ink"
                    />
                    {suffix ? <span className="text-[12px] text-slate-400 shrink-0">{suffix}</span> : null}
                    <button
                      type="button"
                      disabled={busyField === field || !isEditing}
                      onClick={() => saveEdit(field)}
                      className="min-h-[36px] px-3 py-1 rounded-ot-sm border border-hairline text-[12.5px] font-bold disabled:opacity-50"
                    >
                      Save
                    </button>
                  </span>
                </label>
              </div>
            );
          }) : null}
        </div>
      ))}

      {error ? <p className="text-[12.5px] text-neg mt-3" role="alert">{error}</p> : null}
    </div>
  );
}

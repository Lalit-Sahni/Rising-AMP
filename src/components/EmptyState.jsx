import React from 'react';
import { Link } from 'react-router-dom';

const actionClass =
  'inline-flex mt-4 min-h-[44px] items-center px-3.5 py-2 rounded-ot-sm bg-accent hover:bg-accent-600 text-white text-sm font-bold';

export default function EmptyState({ title, body, actionLabel, to, onAction }) {
  return (
    <div className="bg-surface border border-hairline rounded-ot px-5 py-8 text-center">
      <h2 className="text-[16px] font-extrabold text-ink">{title}</h2>
      {body ? <p className="text-[13.5px] text-slate-600 mt-2 max-w-md mx-auto">{body}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={actionClass}>
          {actionLabel}
        </button>
      ) : to && actionLabel ? (
        <Link to={to} className={actionClass}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

export default function EmptyState({ title, body, actionLabel, to }) {
  return (
    <div className="bg-surface border border-hairline rounded-ot px-5 py-8 text-center">
      <h2 className="text-[16px] font-extrabold text-ink">{title}</h2>
      {body ? <p className="text-[13.5px] text-slate-600 mt-2 max-w-md mx-auto">{body}</p> : null}
      {to && actionLabel ? (
        <Link
          to={to}
          className="inline-flex mt-4 px-3.5 py-2 rounded-ot-sm bg-accent hover:bg-accent-600 text-white text-sm font-bold"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

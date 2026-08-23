import React, { useEffect, useState } from 'react';
import { loadProfilesForEmails } from '../firebase/profiles';
import { canonicalEmail } from '../firebase/email';

function uniqueEmails(emails) {
  const seen = new Set();
  const out = [];
  (emails || []).forEach((email) => {
    const key = canonicalEmail(email);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(email);
  });
  return out;
}

function initials(profile) {
  const source = (profile.displayName || profile.email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 1).toUpperCase();
}

export default function JobPeople({ emails }) {
  const [people, setPeople] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!emails || emails.length === 0) {
      setPeople([]);
      return undefined;
    }
    loadProfilesForEmails(uniqueEmails(emails)).then((rows) => {
      if (!cancelled) setPeople(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [emails]);

  if (!people.length) return null;

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      {people.map((person) => (
        <div
          key={person.uid || person.email}
          className="inline-flex items-center gap-2 bg-surface border border-hairline rounded-full pl-0.5 pr-2.5 py-0.5"
          title={person.email}
        >
          {person.photoUrl ? (
            <img src={person.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <span className="w-6 h-6 rounded-full bg-canvas border border-hairline grid place-items-center text-[10px] font-bold">
              {initials(person)}
            </span>
          )}
          <span className="text-xs font-semibold text-ink max-w-[10rem] truncate">
            {person.displayName || person.email}
          </span>
        </div>
      ))}
    </div>
  );
}

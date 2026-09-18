import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadProfilesForEmails } from '../firebase/profiles';
import { canonicalEmail } from '../firebase/emailAddress';

type PublicCard = {
  uid?: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
};

function uniqueEmails(emails: unknown[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  (emails || []).forEach((email) => {
    const key = canonicalEmail(email);
    if (!key || !key.includes('@') || seen.has(key)) return;
    seen.add(key);
    out.push(String(email));
  });
  return out;
}

function initials(profile: PublicCard) {
  const source = String(profile.displayName || profile.email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 1).toUpperCase();
}

export default function JobPresence({
  emails,
  jobId,
}: {
  emails?: unknown[] | null;
  jobId?: string | null;
}) {
  const unique = useMemo(() => uniqueEmails(emails), [emails]);
  const [people, setPeople] = useState<PublicCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (unique.length === 0) {
      setPeople([]);
      return undefined;
    }
    loadProfilesForEmails(unique).then((rows: PublicCard[]) => {
      if (!cancelled) setPeople(rows || []);
    });
    return () => {
      cancelled = true;
    };
  }, [unique.join('|')]);

  const faces: PublicCard[] = (people.length > 0 ? people : unique.map((email) => ({ email }))).slice(0, 4);
  const count = unique.length;
  const manageTo = jobId ? `/people?job=${encodeURIComponent(jobId)}` : '/people';

  return (
    <div className="flex items-center gap-2 mt-2.5">
      {faces.length > 0 ? (
        <span className="flex">
          {faces.map((person, index) => (
            <span
              key={person.uid || person.email || String(index)}
              title={person.displayName || person.email}
              className={`relative w-6 h-6 rounded-full border-2 border-surface overflow-hidden shrink-0 ${index === 0 ? '' : '-ml-1.5'}`}
            >
              {person.photoUrl ? (
                <img src={person.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full bg-canvas grid place-items-center text-[9px] font-bold text-ink">
                  {initials(person)}
                </span>
              )}
            </span>
          ))}
        </span>
      ) : null}
      <span className="text-[11.5px] text-slate-500">
        {count} {count === 1 ? 'person' : 'people'}
      </span>
      <Link to={manageTo} className="text-[11.5px] font-bold text-accent-600 hover:text-accent">
        Manage
      </Link>
    </div>
  );
}

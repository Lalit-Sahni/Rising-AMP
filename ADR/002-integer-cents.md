# Why integer cents

Money was parsed with `parseFloat` from mixed strings and numbers. That is how `0.1 + 0.2` stops being `0.3`, and how two screens adding the same expenses can disagree by a cent.

All arithmetic goes through `src/money.ts` as integer cents. Stored Firestore fields are left mixed in this phase; they are parsed at the read boundary. Normalising the database is a later, approved migration.

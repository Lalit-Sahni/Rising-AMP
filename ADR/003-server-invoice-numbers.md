# Why invoice numbers moved server-side

The browser used `INV-` plus `Math.random() * 999`. With 999 possible values, a collision is likely well before a hundred invoices. For an Australian tax invoice that is a compliance failure.

Numbers now come from a Firestore transaction on `organizations/{orgId}/counters/invoices`, via the Cloud Function `allocateInvoiceNumber`. Format: `2026-0007`. Existing sent invoices are not renumbered.

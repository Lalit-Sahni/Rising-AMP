#!/bin/sh
# Phase 11 Part E, production. One command, gate enforced in code.
#
# The runbook was seven commands with a hard gate in the middle: hosting must
# not deploy unless the verification dry-run reports zero writes. A human
# pasting seven lines into a terminal queues them all and the gate is bypassed.
# So the gate lives here instead of in someone's discipline.
#
#   sh scripts/deploy-part-e-production.sh          (asks once before writing)
#   sh scripts/deploy-part-e-production.sh --yes    (no prompt, for an agent)
#
# Safe to re-run. Deploys are idempotent and the recompute skips rollups that
# already match. Reverse is:
#   node scripts/recompute-ledger-rollups.js --clear --apply --production
# which removes only ledgerRollup/current and never touches an expense.

set -e
cd "$(dirname "$0")/.."

AUTO=""
[ "$1" = "--yes" ] && AUTO="1"

say() { printf '\n=== %s ===\n' "$1"; }
die() { printf '\nSTOPPED: %s\n' "$1" >&2; exit 1; }

say "1/7  Production backup (read-only)"
npm run backup:production || die "Backup failed. Nothing else has run."

say "2/7  Deploy maintainLedgerRollup (no --force)"
echo "This may prompt. Retry behaviour or enabling an API: answer yes."
echo "Anything about DELETING a function: answer no and stop."
firebase deploy --project production --only functions:maintainLedgerRollup \
  || die "Function deploy failed. Rules, recompute and hosting have not run."

say "2b/7 Confirm the function list"
firebase functions:list --project production || true
echo "Expect SIX: sendJobInviteEmail, readReceiptImage, allocateInvoiceNumber,"
echo "checkEstimateImport, readQuoteFile, maintainLedgerRollup."
if [ -z "$AUTO" ]; then
  printf 'Six functions, none deleted? [yes/no] '
  read -r ans
  [ "$ans" = "yes" ] || die "Function list not confirmed."
fi

say "3/7  Deploy Firestore rules"
firebase deploy --project production --only firestore:rules \
  || die "Rules deploy failed. Recompute and hosting have not run."

say "4/7  Recompute dry-run (nothing is written)"
node scripts/recompute-ledger-rollups.js --dry-run --production \
  || die "Dry-run failed. Nothing has been written."

if [ -z "$AUTO" ]; then
  printf '\nDoes that plan look right? Writing next. [yes/no] '
  read -r ans
  [ "$ans" = "yes" ] || die "Not confirmed. Nothing has been written."
fi

say "5/7  Apply (writes ledgerRollup/current only)"
node scripts/recompute-ledger-rollups.js --apply --production \
  || die "Apply failed. Hosting has NOT been deployed. Check the rollups."

say "6/7  Verify: re-run the dry-run, must plan ZERO writes"
VERIFY="$(node scripts/recompute-ledger-rollups.js --dry-run --production 2>&1)" \
  || die "Verification run failed. Hosting has NOT been deployed."
echo "$VERIFY"
echo "$VERIFY" | grep -q "^0 write(s) planned" \
  || die "Rollups do NOT match the ledger. Hosting has NOT been deployed.
Reverse with: node scripts/recompute-ledger-rollups.js --clear --apply --production"

say "7/7  Deploy hosting"
firebase deploy --project production --only hosting || die "Hosting deploy failed."

printf '\nDone. Rollups match the ledger and the new client is live.\n'
printf 'Now: force-close the app on your phone, reopen, and check one job\n'
printf 'Overview total against its History.\n'

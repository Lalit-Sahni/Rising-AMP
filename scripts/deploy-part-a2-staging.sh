#!/bin/sh
# Phase 13 Part A2, staging only. Deploy party Firestore rules, dry-run the
# directory backfill, apply, then prove a second dry-run plans zero writes.
#
#   sh scripts/deploy-part-a2-staging.sh          (asks once before writing)
#   sh scripts/deploy-part-a2-staging.sh --yes    (no prompt, for an agent)
#
# Never production. Never functions. Never hosting. Never storage. No --force.
# Reverse is a Firestore restore of staging; this script only adds parties/{id}
# and sets partyId fields.

set -e
cd "$(dirname "$0")/.."

AUTO=""
for arg in "$@"; do
  case "$arg" in
    --yes) AUTO="1" ;;
    --production)
      printf '\nSTOPPED: Part A2 is staging only. Refusing --production.\n' >&2
      exit 1
      ;;
  esac
done

say() { printf '\n=== %s ===\n' "$1"; }
die() { printf '\nSTOPPED: %s\n' "$1" >&2; exit 1; }

if grep -q 'rising-amp-467702-b5' .firebaserc && grep -q '"staging": "rising-amp-467702-b5"' .firebaserc; then
  die "Staging alias points at production. Stop."
fi

say "1/5  Refuse production"
echo "Destination is Firebase alias staging (rising-amp-staging)."
echo "This gate will not deploy functions, hosting, or storage."

say "2/5  Deploy Firestore rules to staging"
firebase deploy --project staging --only firestore:rules \
  || die "Staging rules deploy failed. Backfill has not run."

say "3/5  Backfill dry-run (nothing is written)"
node scripts/backfill-parties.js --dry-run --staging \
  || die "Dry-run failed. Nothing has been written."

if [ -z "$AUTO" ]; then
  printf '\nDoes that plan look right (exact canonical only)? Writing next. [yes/no] '
  read -r ans
  [ "$ans" = "yes" ] || die "Not confirmed. Nothing has been written."
fi

say "4/5  Apply on staging"
node scripts/backfill-parties.js --apply --staging \
  || die "Apply failed. Production was not touched."

say "5/5  Verify: re-run the dry-run, must plan ZERO writes"
VERIFY="$(node scripts/backfill-parties.js --dry-run --staging 2>&1)" \
  || die "Verification run failed."
echo "$VERIFY"
echo "$VERIFY" | grep -q "^0 write(s) planned" \
  || die "Second dry-run is not zero. Staging parties may be incomplete.
Re-run: node scripts/backfill-parties.js --dry-run --staging"

printf '\nDone. Staging rules are live and the party backfill planned zero further writes.\n'
printf 'Production was not touched. No functions or hosting were deployed.\n'

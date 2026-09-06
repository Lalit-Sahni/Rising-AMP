#!/bin/bash
# Masked OpenAI key → Firebase Secret Manager. The key is never printed.
# Usage: ./scripts/set-openai-secret.sh
set -euo pipefail

RAW="$(osascript <<'APPLESCRIPT'
try
  set dlg to display dialog "Paste the new OpenAI API key. It stays hidden and is not saved in chat.

This stores it for the live site (risingamp.com.au) and for localhost/staging." with title "RisingAMP — OpenAI key" default answer "" with hidden answer buttons {"Cancel", "Save"} default button "Save" cancel button "Cancel"
  return text returned of dlg
on error
  return ""
end try
APPLESCRIPT
)"

RAW="$(printf '%s' "$RAW" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

if [ -z "$RAW" ]; then
  echo "Cancelled. Nothing was saved."
  exit 1
fi

if [[ "$RAW" != sk-* ]]; then
  echo "That did not look like an OpenAI key. Nothing was saved."
  unset RAW
  exit 1
fi

printf '%s' "$RAW" | firebase functions:secrets:set OPENAI_API_KEY --project production --data-file -
printf '%s' "$RAW" | firebase functions:secrets:set OPENAI_API_KEY --project rising-amp-staging --data-file -
unset RAW
echo "OPENAI_API_KEY stored for production and staging."

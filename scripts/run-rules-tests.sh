#!/bin/sh
# Firestore emulator needs Java. Prefer whatever is on PATH, then Homebrew OpenJDK 21.
set -e
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if ! command -v java >/dev/null 2>&1; then
  if [ -x /opt/homebrew/opt/openjdk@21/bin/java ]; then
    export JAVA_HOME=/opt/homebrew/opt/openjdk@21
    export PATH="$JAVA_HOME/bin:$PATH"
  elif [ -x /usr/local/opt/openjdk@21/bin/java ]; then
    export JAVA_HOME=/usr/local/opt/openjdk@21
    export PATH="$JAVA_HOME/bin:$PATH"
  else
    echo "Java is required for npm run test:rules (Firestore emulator)." >&2
    echo "On this Mac: brew install openjdk@21" >&2
    exit 1
  fi
fi

exec firebase emulators:exec --only firestore --project rising-amp-staging "node scripts/test-firestore-rules.js"

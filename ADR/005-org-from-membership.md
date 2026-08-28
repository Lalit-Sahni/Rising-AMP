# Why organisations are resolved, not hardcoded

The rules already model organisations. The client did not: every path used `opal-ss-constructions`. The sales page invites strangers, so a second company was impossible.

At sign-in we query organisations whose invite list contains the signed-in email, then carry that `orgId` through the data layer. Opal stays the preferred org when the user is on it. A signed-in person with no org sees “Ask us for access”, not a blank Jobs list pretending to be empty by accident.

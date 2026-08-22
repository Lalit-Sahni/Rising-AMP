/**
 * Weekly Report was removed in Phase 1.
 * No Cloud Functions are exported.
 *
 * Do not deploy this package to production. Deploying functions to the live
 * project would delete generateWeeklyReport there. Staging is the default
 * Firebase alias; production still has the old function until cutover.
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

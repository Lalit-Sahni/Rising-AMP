const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { buildWeeklyReport } = require("./buildWeeklyReport");

admin.initializeApp();

/**
 * Callable Cloud Function to generate a weekly report.
 * Inputs: { accessCode: string }
 * Outputs: { success: boolean, downloadUrl?: string, filename?: string, error?: string }
 */
exports.generateWeeklyReport = onCall({ cors: true }, async (request) => {
  // In v2, data is in request.data
  const { accessCode } = request.data;

  // 1. Validation
  if (!accessCode || typeof accessCode !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a valid accessCode."
    );
  }

  try {
    // 2. Determine Date Range (Last 7 days)
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // End of today
    
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0); // Start of 7 days ago

    // 3. Fetch Data from Firestore (Admin SDK)
    const db = admin.firestore();
    
    // Fetch Site Logs
    // Note: We fetch more than we need and filter in memory to avoid new composite indexes for now.
    // Assuming a reasonable limit of recent logs is sufficient to cover the week.
    const siteLogsSnapshot = await db
      .collection("users")
      .doc(accessCode)
      .collection("siteLogs")
      .orderBy("date", "desc")
      .limit(50) 
      .get();

    const siteLogs = [];
    siteLogsSnapshot.forEach((doc) => {
      const data = doc.data();
      const logDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
      
      if (logDate >= startDate && logDate <= endDate) {
        siteLogs.push({ ...data, id: doc.id, date: logDate });
      }
    });

    // Fetch Expenses
    const expensesSnapshot = await db
      .collection("users")
      .doc(accessCode)
      .collection("expenses")
      .orderBy("timestamp", "desc")
      .limit(200)
      .get();

    const expenses = [];
    expensesSnapshot.forEach((doc) => {
      const data = doc.data();
      // Prefer 'date' field if available, otherwise 'timestamp'
      const rawDate = data.date || data.timestamp;
      const expenseDate = rawDate && rawDate.toDate ? rawDate.toDate() : new Date(rawDate);

      if (expenseDate >= startDate && expenseDate <= endDate) {
        expenses.push({ ...data, id: doc.id, date: expenseDate });
      }
    });

    // 4. Build DOCX
    const buffer = await buildWeeklyReport({
      siteLogs,
      expenses,
      startDate,
      endDate,
    });

    // 5. Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const dateStr = endDate.toISOString().split("T")[0];
    const filename = `Weekly-Report-${dateStr}.docx`;
    const destination = `reports/${accessCode}/${filename}`;
    const file = bucket.file(destination);

    await file.save(buffer, {
      metadata: {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });

    // 6. Generate Signed URL
    // Valid for 1 hour
    const [downloadUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, 
    });

    return {
      success: true,
      downloadUrl,
      filename,
    };

  } catch (error) {
    console.error("Error generating weekly report:", error);
    throw new HttpsError(
      "internal",
      "Unable to generate weekly report.",
      error.message
    );
  }
});

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ImageRun, AlignmentType, BorderStyle } = require("docx");

/**
 * Helper to format date
 */
function formatDate(dateObj) {
  if (!dateObj) return "";
  // If it's a Firestore Timestamp, convert to Date
  const date = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Helper to format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount || 0);
}

/**
 * Fetches an image from a URL and returns an ArrayBuffer.
 * Returns null if fetch fails.
 */
async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
    return await res.arrayBuffer();
  } catch (err) {
    console.error("Error fetching image:", err);
    return null;
  }
}

/**
 * Builds the Weekly Report DOCX Document.
 * @param {Object} data - Contains siteLogs, expenses, dateRange
 * @returns {Promise<Buffer>}
 */
async function buildWeeklyReport({ siteLogs, expenses, startDate, endDate }) {
  const dateRangeText = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  // --- Section 1: Site Logs ---
  const siteLogChildren = [];

  if (siteLogs.length === 0) {
    siteLogChildren.push(
      new Paragraph({
        text: "No site logs recorded for this period.",
        style: "Normal",
      })
    );
  } else {
    for (const log of siteLogs) {
      // Log Header: Date - Company - Service
      siteLogChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${formatDate(log.date)} | ${log.company || "Unknown Company"}`,
              bold: true,
              size: 28, // 14pt
            }),
            new TextRun({
              text: ` - ${log.serviceType || "General"}`,
              italics: true,
              size: 24, // 12pt
              color: "666666",
            }),
          ],
          spacing: { before: 400, after: 200 },
          heading: HeadingLevel.HEADING_2,
        })
      );

      // Comments
      if (log.comments) {
        siteLogChildren.push(
          new Paragraph({
            text: log.comments,
            spacing: { after: 200 },
          })
        );
      }

      // Images
      if (log.images && log.images.length > 0) {
        const imageParagraphs = [];
        for (const img of log.images) {
            const url = img.url || img; // Handle object or string
            if (url) {
                const buffer = await fetchImageBuffer(url);
                if (buffer) {
                    imageParagraphs.push(
                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: buffer,
                                    transformation: {
                                        width: 400,
                                        height: 300,
                                    },
                                }),
                            ],
                            spacing: { after: 200 },
                        })
                    );
                }
            }
        }
        siteLogChildren.push(...imageParagraphs);
      }
      
      // Divider line
      siteLogChildren.push(
        new Paragraph({
            border: {
                bottom: {
                    color: "E0E0E0",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6,
                },
            },
            spacing: { after: 200 },
        })
      );
    }
  }

  // --- Section 2: Expenses ---
  const expenseRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ children: [new Paragraph({ text: "Date", bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: "Category", bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: "Description", bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: "Amount", bold: true })] }),
      ],
    }),
  ];

  let expensesAmount = 0;

  if (expenses.length === 0) {
    expenseRows.push(
      new TableRow({
        children: [
          new TableCell({ columnSpan: 4, children: [new Paragraph("No expenses recorded for this period.")] }),
        ],
      })
    );
  } else {
    for (const exp of expenses) {
      const amount = parseFloat(exp.amount || exp.total || exp.cost || 0);
      expensesAmount += amount;

      expenseRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(formatDate(exp.date || exp.timestamp))] }),
            new TableCell({ children: [new Paragraph(exp.category || "-")] }),
            new TableCell({ children: [new Paragraph(exp.description || exp.tradeName || "-")] }),
            new TableCell({ children: [new Paragraph(formatCurrency(amount))] }),
          ],
        })
      );
    }

    // Total Row
    expenseRows.push(
      new TableRow({
        children: [
          new TableCell({ columnSpan: 3, children: [new Paragraph({ text: "Total", bold: true, alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ text: formatCurrency(expensesAmount), bold: true })] }),
        ],
      })
    );
  }

  const expenseTable = new Table({
    rows: expenseRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });

  // --- Construct Document ---
  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Paragraph({
            children: [
              new TextRun({
                text: "Opal Track – Weekly Report",
                bold: true,
                size: 24,
              }),
              new TextRun({
                text: `\t${dateRangeText}`,
                size: 20,
              }),
            ],
            tabStops: [
                {
                    type: "right",
                    position: 9000, // Approximate right align
                }
            ],
            border: {
                bottom: {
                    color: "000000",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6,
                }
            }
          }),
        },
        footers: {
          default: new Paragraph({
            children: [
              new TextRun({
                text: `Generated on ${new Date().toLocaleDateString()}`,
                size: 16,
                color: "888888",
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        },
        children: [
          // Title
          new Paragraph({
            text: "Site Logs",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 },
          }),
          
          ...siteLogChildren,

          // Page Break for Expenses
          new Paragraph({
            text: "",
            pageBreakBefore: true,
          }),

          new Paragraph({
            text: "Weekly Expenses",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 },
          }),

          expenseTable,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

module.exports = { buildWeeklyReport };

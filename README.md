# Construction Expense Tracker

A comprehensive React application for tracking construction expenses with OCR capabilities, Excel export, and detailed analytics.

## Features

- **Multiple Expense Categories**: Labour, Equipment, Trade, Purchase, Installation, and Service
- **Advanced OCR Processing**: 
  - Google Cloud Vision API integration for high-accuracy text extraction
  - Tesseract.js fallback for offline processing
  - Intelligent data mapping to expense forms
  - Camera capture and file upload support
  - Real-time processing with progress indicators
- **Smart Data Extraction**:
  - Automatic category detection based on keywords
  - Amount, date, supplier, and invoice number extraction
  - Confidence scoring for extracted data
  - Form auto-filling with extracted information
- **Excel Export**: Export all expenses to Excel with categorized sheets
- **Dashboard Analytics**: Visual breakdown of expenses by category
- **Local Storage**: Data persists between sessions
- **Responsive Design**: Works on desktop and mobile devices

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server (choose one method):

### Method 1: Quick Start (Recommended)
```bash
# Windows Batch File (easiest)
start-dev.bat

# Or PowerShell Script (more detailed)
.\start-dev.ps1
```

### Method 2: Manual Start
```bash
npm start
```

### Method 3: Clean Start (kills existing processes)
```bash
npm run start:clean
```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Quick Development Workflow

- **Double-click `start-dev.bat`** for the fastest way to start
- **Use `.\start-dev.ps1`** for detailed process management
- **Use `npm run start:clean`** to automatically kill existing processes and restart

## Usage

### Adding Expenses
1. Click on "Add Expense" tab
2. Select an expense category (Labour, Equipment, etc.)
3. Fill in the required fields
4. Click "Save Expense"

### OCR Processing
1. Click "Scan Invoice" button in the Add Expense page
2. Choose between camera capture or file upload
3. The app will process the image using Google Cloud Vision API (with Tesseract.js fallback)
4. Review extracted data including category, amount, date, supplier, and invoice number
5. Click "Use This Data" to auto-fill the expense form
6. Edit any fields as needed before saving

### OCR Test Page
- Navigate to "OCR Test" in the sidebar to test the OCR functionality
- Upload any image to see the raw extracted text and processed data
- View confidence scores and form mapping results

### Exporting Data
1. Click "Export Excel" button in the header
2. The app will generate an Excel file with categorized sheets
3. File will be automatically downloaded

### Viewing Analytics
- **Dashboard**: Overview of total expenses, category breakdown, and top expenses
- **History**: Complete list of all expenses with delete functionality

## Dependencies

- React 18
- Lucide React (Icons)
- XLSX (Excel export)
- Tesseract.js (OCR processing)
- Tailwind CSS (Styling)

## Project Structure

```
src/
├── components/
│   └── ConstructionExpenseTracker.js
├── App.js
├── App.css
└── index.js
```

## Browser Compatibility

This application works best in modern browsers that support:
- ES6+ features
- File API
- Canvas API (for OCR processing) 
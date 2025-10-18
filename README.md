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

### Prerequisites
- Node.js 18.17.0 or higher (see `.nvmrc`)
- npm or yarn package manager
- Firebase project with Firestore enabled
- Google Cloud Vision API key (for OCR functionality)

### Quick Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-username/Rising-AMP.git
   cd Rising-AMP
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual API keys
   ```

3. **Start the development server:**
   ```bash
   # Method 1: Quick Start (Windows)
   start-dev.bat
   
   # Method 2: PowerShell (Windows)
   .\start-dev.ps1
   
   # Method 3: Manual Start
   npm start
   
   # Method 4: Clean Start (kills existing processes)
   npm run start:clean
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Environment Configuration

Create a `.env.local` file with the following variables:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Google Cloud Vision API (for OCR)
REACT_APP_GOOGLE_CLOUD_VISION_API_KEY=your_google_cloud_vision_api_key
```

**⚠️ Security Note:** Never commit `.env.local` to version control. Use `.env.example` as a template.

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

### Core Dependencies
- React 18 - Frontend framework
- Firebase 12.0.0 - Backend services (Firestore, Auth)
- Lucide React - Icon library
- Tailwind CSS - Styling framework

### Feature Dependencies
- Tesseract.js - Client-side OCR processing
- XLSX - Excel export functionality
- Recharts - Data visualization
- React DatePicker - Date selection
- React Dropzone - File upload handling

### Development Dependencies
- CRACO - Create React App Configuration Override
- PostCSS - CSS processing
- Autoprefixer - CSS vendor prefixes

## Security Features

### Data Protection
- All business data encrypted in Firebase
- Environment variables for API keys
- Secure Firebase security rules
- Regular automated backups

### API Security
- Google Cloud Vision API with domain restrictions
- Firebase API keys properly configured
- No hardcoded secrets in source code
- Development-only logging

### Security Scripts
```bash
# Run security audit
npm run security:audit

# Check for security vulnerabilities
npm run security:check

# Update dependencies
npm run deps:update

# Check environment variables
npm run env:check
```

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
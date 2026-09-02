# API Key Rotation Guide

This guide explains how to safely rotate API keys for Rising-AMP to maintain security best practices.

## Overview

Rising-AMP uses three main API keys:
1. **Firebase API Key** - For Firebase services (Firestore, Auth, Storage)
2. **Google Cloud Vision API Key** - For OCR functionality (fallback)
3. **OpenAI API Key** - For advanced AI-powered OCR (primary)

## Before You Start

⚠️ **IMPORTANT**: Always create a backup of your Firebase data before rotating keys:

```bash
npm run backup
```

## Firebase API Key Rotation

### Step 1: Get New Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `rising-amp-467702-b5`
3. Go to Project Settings (gear icon)
4. Scroll down to "Your apps" section
5. Find your web app and click the config icon
6. Copy the new configuration values

### Step 2: Update Environment Variables

Update your `.env.local` file with the new Firebase configuration:

```env
# New Firebase Configuration
REACT_APP_FIREBASE_API_KEY=new_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=rising-amp-467702-b5.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=rising-amp-467702-b5
REACT_APP_FIREBASE_STORAGE_BUCKET=rising-amp-467702-b5.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Google Cloud Vision remains a client key until it is moved behind a function.
```

### Step 3: Test Firebase Connection

```bash
npm run env:check
npm start
```

Verify that:
- App loads without errors
- Data loads from Firestore
- New expenses can be added
- Existing data is preserved

## OpenAI API Key Rotation

OpenAI must **not** live in `REACT_APP_*`. The browser cannot call `api.openai.com` (CORS), and the key would ship in the JS bundle.

1. Create a new key at [OpenAI Platform](https://platform.openai.com/).
2. In a terminal, set the Firebase secret at the masked prompt (do not paste the key into chat):

```bash
firebase functions:secrets:set OPENAI_API_KEY --project rising-amp-staging
firebase functions:secrets:set OPENAI_API_KEY --project production
```

3. Deploy the function **by name only**:

```bash
firebase deploy --project rising-amp-staging --only functions:readReceiptImage
firebase deploy --project production --only functions:readReceiptImage
```

Never `firebase deploy --only functions` unless you intend to publish every exported function. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber` and `checkEstimateImport`. Deploy **by name**. `checkEstimateImport` also uses `OPENAI_API_KEY`; redeploy it by name after rotating that secret.

4. Remove `REACT_APP_OPENAI_API_KEY` from `.env.local` / `.env.production.local` if it is still there.
5. Revoke the old OpenAI key in the OpenAI dashboard.

## Google Cloud Vision API Key Rotation

### Step 1: Create New API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "API Key"
5. Copy the new API key

### Step 2: Configure API Key Restrictions

**Important**: Restrict the API key to prevent unauthorized use:

1. Click on the newly created API key
2. Under "API restrictions", select "Restrict key"
3. Choose "Google Cloud Vision API"
4. Under "Application restrictions", select "HTTP referrers"
5. Add your domain(s):
   - `http://localhost:3000/*` (for development)
   - `https://your-production-domain.com/*` (for production)

### Step 3: Update Environment Variable

Update your `.env.local` file:

```env
REACT_APP_GOOGLE_CLOUD_VISION_API_KEY=new_google_cloud_vision_api_key_here
```

### Step 4: Test OCR Functionality

1. Start the development server: `npm start`
2. Navigate to "OCR Test" page
3. Upload a test image
4. Verify OCR processing works correctly

## Deactivating Old Keys

### Firebase API Key
- Firebase API keys are safe to expose in client-side code
- No immediate action required
- Old keys will eventually expire

### Google Cloud Vision API Key
- **CRITICAL**: Deactivate old keys immediately
- Go to Google Cloud Console > Credentials
- Find the old API key
- Click "Delete" or "Disable"
- This prevents unauthorized usage

## Verification Checklist

After key rotation, verify:

- [ ] App starts without errors
- [ ] Firebase data loads correctly
- [ ] New expenses can be added
- [ ] OCR functionality works
- [ ] Excel export works
- [ ] All existing data is preserved
- [ ] No console errors related to API keys

## Troubleshooting

### Common Issues

**"Missing required environment variables" error:**
- Ensure `.env.local` file exists
- Check that all variables are set correctly
- Restart the development server

**Firebase connection errors:**
- Verify Firebase project ID is correct
- Check that Firestore is enabled
- Ensure API key has proper permissions

**OCR not working:**
- Verify Google Cloud Vision API is enabled
- Check API key restrictions
- Ensure billing is set up for Google Cloud

**Data not loading:**
- Check Firebase security rules
- Verify access code is correct
- Run backup script to verify data exists

### Recovery Steps

If something goes wrong:

1. **Restore from backup:**
   ```bash
   npm run restore
   ```

2. **Revert to old keys temporarily:**
   - Update `.env.local` with old keys
   - Test functionality
   - Debug issues before trying again

3. **Check Firebase console:**
   - Verify data exists in Firestore
   - Check security rules
   - Review authentication settings

## Security Best Practices

### Regular Rotation Schedule
- Rotate API keys every 90 days
- Monitor usage in Google Cloud Console
- Set up billing alerts
- Review access logs regularly

### Key Management
- Use different keys for development and production
- Store keys securely (not in code)
- Use environment variables
- Never commit keys to version control

### Monitoring
- Set up Google Cloud monitoring
- Monitor Firebase usage
- Review access patterns
- Set up alerts for unusual activity

## Support

If you encounter issues during key rotation:

1. Check this guide first
2. Review Firebase and Google Cloud documentation
3. Check the troubleshooting section above
4. Create an issue in the repository with:
   - Error messages
   - Steps to reproduce
   - Environment details

## Additional Resources

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Google Cloud Vision API Documentation](https://cloud.google.com/vision/docs)
- [Environment Variables in React](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [Firebase Backup and Restore](https://firebase.google.com/docs/firestore/manage-data/export-import)

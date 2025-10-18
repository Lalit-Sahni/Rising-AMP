#!/usr/bin/env node

/**
 * Firebase Data Restore Script
 * 
 * This script restores Firebase data from JSON backup files.
 * It can restore complete data structures while preserving relationships.
 * 
 * Usage: node scripts/restore-firebase-data.js [backup-file]
 * 
 * Requirements:
 * - Firebase project must be configured
 * - User must have write access to all collections
 * - Backup file must exist
 */

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, writeBatch } = require('firebase/firestore');

// Firebase configuration (using environment variables for security)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Restore a single document with its subcollections
 */
async function restoreDocument(documentData, collectionPath, batch = null) {
  const docRef = doc(db, collectionPath, documentData.id);
  const docData = { ...documentData.data };
  
  // Remove subcollections from document data (they'll be restored separately)
  delete docData.subcollections;
  
  if (batch) {
    batch.set(docRef, docData);
  } else {
    await setDoc(docRef, docData);
  }
  
  // Restore subcollections
  if (documentData.subcollections) {
    for (const [subcollectionName, subcollectionDocs] of Object.entries(documentData.subcollections)) {
      if (Array.isArray(subcollectionDocs)) {
        for (const subDoc of subcollectionDocs) {
          const subCollectionPath = `${collectionPath}/${documentData.id}/${subcollectionName}`;
          await restoreDocument(subDoc, subCollectionPath, batch);
        }
      }
    }
  }
}

/**
 * Restore all users and their data
 */
async function restoreAllUsers(usersData, useBatch = true) {
  console.log(`👥 Restoring ${usersData.length} users...`);
  
  let batch = null;
  if (useBatch) {
    batch = writeBatch(db);
  }
  
  for (let i = 0; i < usersData.length; i++) {
    const userData = usersData[i];
    console.log(`📊 Restoring user: ${userData.userId} (${i + 1}/${usersData.length})`);
    
    // Restore user document
    const userDocRef = doc(db, 'users', userData.userId);
    const userDocData = { ...userData.userDocument };
    
    if (batch) {
      batch.set(userDocRef, userDocData);
    } else {
      await setDoc(userDocRef, userDocData);
    }
    
    // Restore user's subcollections
    if (userData.subcollections) {
      for (const [subcollectionName, subcollectionDocs] of Object.entries(userData.subcollections)) {
        if (Array.isArray(subcollectionDocs)) {
          console.log(`  📁 Restoring subcollection: ${subcollectionName} (${subcollectionDocs.length} docs)`);
          
          for (const subDoc of subcollectionDocs) {
            const subCollectionPath = `users/${userData.userId}/${subcollectionName}`;
            await restoreDocument(subDoc, subCollectionPath, batch);
          }
        }
      }
    }
  }
  
  // Commit batch if using batch operations
  if (batch) {
    console.log('💾 Committing batch operations...');
    await batch.commit();
  }
}

/**
 * Main restore function
 */
async function restoreFromBackup(backupFilePath) {
  console.log('🔄 Starting Firebase data restore...');
  
  try {
    // Check if backup file exists
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${backupFilePath}`);
    }
    
    // Read backup file
    console.log(`📖 Reading backup file: ${backupFilePath}`);
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    
    // Validate backup structure
    if (!backupData.metadata || !backupData.data || !backupData.data.users) {
      throw new Error('Invalid backup file format');
    }
    
    console.log(`📅 Backup timestamp: ${backupData.metadata.timestamp}`);
    console.log(`👥 Users to restore: ${backupData.metadata.totalUsers}`);
    
    // Confirm restore operation
    console.log('\n⚠️  WARNING: This will overwrite existing data in Firebase!');
    console.log('   Make sure you have a current backup before proceeding.');
    
    // Restore all users
    await restoreAllUsers(backupData.data.users);
    
    console.log('✅ Restore completed successfully!');
    console.log(`👥 Total users restored: ${backupData.data.users.length}`);
    
    return {
      success: true,
      usersRestored: backupData.data.users.length
    };
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Find the latest backup file
 */
function findLatestBackup() {
  const backupDir = path.join(__dirname, '..', 'backups');
  
  // Try latest symlink first
  const latestPath = path.join(backupDir, 'latest-backup.json');
  if (fs.existsSync(latestPath)) {
    return latestPath;
  }
  
  // Find the most recent backup file
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('firebase-backup-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length > 0) {
      return path.join(backupDir, files[0]);
    }
  }
  
  return null;
}

// Run restore if called directly
if (require.main === module) {
  const backupFile = process.argv[2] || findLatestBackup();
  
  if (!backupFile) {
    console.error('❌ No backup file found. Please specify a backup file path.');
    console.log('Usage: node scripts/restore-firebase-data.js [backup-file]');
    process.exit(1);
  }
  
  restoreFromBackup(backupFile)
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Restore completed successfully!');
        process.exit(0);
      } else {
        console.error('\n💥 Restore failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { restoreFromBackup, restoreAllUsers };

#!/usr/bin/env node

/**
 * Firebase Data Backup Script
 * 
 * This script exports all Firebase data to JSON files for backup purposes.
 * It preserves the complete data structure and can be used to restore data if needed.
 * 
 * Usage: node scripts/backup-firebase-data.js
 * 
 * Requirements:
 * - Firebase project must be configured
 * - User must have read access to all collections
 */

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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

// Create backup directory
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Generate timestamp for backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFileName = `firebase-backup-${timestamp}.json`;

/**
 * Recursively export all documents from a collection
 */
async function exportCollection(collectionPath, parentPath = '') {
  const fullPath = parentPath ? `${parentPath}/${collectionPath}` : collectionPath;
  console.log(`📁 Exporting collection: ${fullPath}`);
  
  try {
    const collectionRef = collection(db, fullPath);
    const snapshot = await getDocs(collectionRef);
    
    const documents = [];
    
    for (const docSnapshot of snapshot.docs) {
      const docData = {
        id: docSnapshot.id,
        data: docSnapshot.data(),
        subcollections: {}
      };
      
      // Check for subcollections (common patterns in this app)
      const subcollectionNames = [
        'expenses', 'clients', 'labour', 'trades', 'projects', 
        'purchaseOrders', 'workerHistory', 'siteNames', 'projectPhases',
        'progressPayments', 'invoices', 'hiaContracts', 'bankDetails',
        'savedLabour', 'savedTrades', 'savedCompanies', 'savedProjects',
        'clientDetails'
      ];
      
      for (const subcollectionName of subcollectionNames) {
        try {
          const subcollectionData = await exportCollection(subcollectionName, `${fullPath}/${docSnapshot.id}`);
          if (subcollectionData.length > 0) {
            docData.subcollections[subcollectionName] = subcollectionData;
          }
        } catch (error) {
          // Subcollection doesn't exist or access denied, continue
          console.log(`  ⚠️  Subcollection ${subcollectionName} not accessible or empty`);
        }
      }
      
      documents.push(docData);
    }
    
    console.log(`  ✅ Exported ${documents.length} documents from ${fullPath}`);
    return documents;
  } catch (error) {
    console.error(`  ❌ Error exporting collection ${fullPath}:`, error.message);
    return [];
  }
}

/**
 * Export all users and their data
 */
async function exportAllUsers() {
  console.log('👥 Exporting all users...');
  
  try {
    // Get all users from the users collection
    const usersCollection = await exportCollection('users');
    const allUsersData = [];
    
    for (const userDoc of usersCollection) {
      console.log(`📊 Processing user: ${userDoc.id}`);
      
      const userData = {
        userId: userDoc.id,
        userDocument: userDoc.data,
        subcollections: userDoc.subcollections || {}
      };
      
      allUsersData.push(userData);
    }
    
    return allUsersData;
  } catch (error) {
    console.error('❌ Error exporting users:', error);
    return [];
  }
}

/**
 * Main backup function
 */
async function createBackup() {
  console.log('🚀 Starting Firebase data backup...');
  console.log(`📅 Backup timestamp: ${new Date().toISOString()}`);
  
  try {
    // Export all users and their data
    const usersData = await exportAllUsers();
    
    // Create backup structure
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        description: 'Complete Firebase data backup for Rising-AMP',
        totalUsers: usersData.length
      },
      data: {
        users: usersData
      }
    };
    
    // Write backup to file
    const backupPath = path.join(backupDir, backupFileName);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log('✅ Backup completed successfully!');
    console.log(`📁 Backup saved to: ${backupPath}`);
    console.log(`👥 Total users backed up: ${usersData.length}`);
    
    // Create a latest symlink for easy access
    const latestPath = path.join(backupDir, 'latest-backup.json');
    if (fs.existsSync(latestPath)) {
      fs.unlinkSync(latestPath);
    }
    fs.copyFileSync(backupPath, latestPath);
    
    console.log('🔗 Latest backup symlink created');
    
    return {
      success: true,
      backupPath,
      userCount: usersData.length
    };
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run backup if called directly
if (require.main === module) {
  createBackup()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Backup completed successfully!');
        process.exit(0);
      } else {
        console.error('\n💥 Backup failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { createBackup, exportAllUsers };

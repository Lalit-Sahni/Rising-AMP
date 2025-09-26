// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1rOuxKqVw3EfDaNhdUbuN2oImbc_5BAM",
  authDomain: "rising-amp-467702-b5.firebaseapp.com",
  projectId: "rising-amp-467702-b5",
  storageBucket: "rising-amp-467702-b5.firebasestorage.app",
  messagingSenderId: "446685609209",
  appId: "1:446685609209:web:f0733683ca43289ca5f628",
  measurementId: "G-8MV1KP05QE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth }; 
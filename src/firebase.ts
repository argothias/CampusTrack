import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize the standard Firebase core app
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore referencing the database ID
// Force long-polling to prevent WebChannel stream/connection transport errors in compiled Android/APK environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId || 'tasktr');

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn("Firestore offline persistence failed: Multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn("Firestore offline persistence failed: Browser unsupported.");
    } else {
      console.warn("Firestore offline persistence failed to initialize:", err);
    }
  });
}

// Initialize Firebase Authentication instance
export const auth = getAuth(app);

// Simple connection tester to log Firebase state
async function testFirebaseConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Connection Verified Successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase initialized in standard offline / localized mode.");
    } else {
      console.log("Firebase connection test performed.");
    }
  }
}

testFirebaseConnection();

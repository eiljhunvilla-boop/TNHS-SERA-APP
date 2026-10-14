import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBeT8ckda8iLvnJRBPNAQgmfkg7zw8MjXM",
  authDomain: "tnhsafe-emergency-reporting.firebaseapp.com",
  projectId: "tnhsafe-emergency-reporting",
  storageBucket: "tnhsafe-emergency-reporting.firebasestorage.app",
  messagingSenderId: "10735929404",
  appId: "1:10735929404:web:d9b45fb7c10178226d1b39",
};

/**
 * Converts a TNHSafe username into the internal email
 * identifier used by Firebase Authentication.
 *
 * This does not create a real email inbox.
 */
export function usernameToEmail(username) {
    const normalizedUsername = username.trim().toLowerCase();

    return `${normalizedUsername}@${firebaseConfig.projectId}.firebaseapp.com`;
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
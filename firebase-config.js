/**
 * Firebase Configuration & Client Initialization for Chatty AI
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyBY4oHCgH9Vmami3uretTag2ovcWTsy4QA",
    authDomain: "chatty-ai-80838.firebaseapp.com",
    projectId: "chatty-ai-80838",
    storageBucket: "chatty-ai-80838.firebasestorage.app",
    messagingSenderId: "1035089427690",
    appId: "1:1035089427690:web:4f883e47a9c423aa2f6b93"
};

// Check if config has been customized by user
export const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey &&
           firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
           firebaseConfig.projectId !== "YOUR_PROJECT_ID";
}

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);
/**
 * Authentication Service for Chatty AI
 * Created by Akintayo Mofeoluwa Richard
 */

import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import { auth, isFirebaseConfigured } from "./firebase-config.js";
import { createUserProfile, createUserSettings } from "./firestore-service.js";

/**
 * Maps Firebase Auth error codes to clean, friendly user messages.
 */
export const formatAuthError = (error) => {
    if (!error) return "An unexpected error occurred.";
    const code = error.code || "";
    
    switch (code) {
        case "auth/email-already-in-use":
            return "An account with this email already exists. Please sign in instead.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/operation-not-allowed":
            return "Email/Password sign-in is not enabled in Firebase Console. Please enable it under Authentication > Sign-in method.";
        case "auth/weak-password":
            return "Password should be at least 6 characters.";
        case "auth/user-disabled":
            return "This user account has been disabled. Please contact support.";
        case "auth/user-not-found":
            return "No account found with this email. Please check your spelling or sign up.";
        case "auth/wrong-password":
            return "Incorrect password. Please try again.";
        case "auth/invalid-credential":
            return "Invalid email or password. Please verify your credentials.";
        case "auth/too-many-requests":
            return "Access temporarily blocked due to too many failed attempts. Try again in a few minutes.";
        case "auth/network-request-failed":
            return "Network connection issue. Please check your internet connection.";
        case "auth/api-key-not-valid":
        case "auth/invalid-api-key":
            return "Firebase API Key is missing or invalid. Please configure your real Firebase keys in firebase-config.js.";
        default:
            return error.message || "Authentication failed. Please try again.";
    }
};

/**
 * Signs up a new user with Email and Password, sets displayName,
 * and creates initial Firestore profile & settings documents.
 */
export const signUpUser = async (name, email, password) => {
    const trimmedName = (name || "").trim();
    const trimmedEmail = (email || "").trim();

    if (!trimmedName) {
        throw new Error("Full name is required.");
    }
    if (!trimmedEmail) {
        throw new Error("Email address is required.");
    }
    if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
    }

    // 1. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    const user = userCredential.user;

    // 2. Set Firebase Auth displayName
    try {
        await updateProfile(user, { displayName: trimmedName });
    } catch (profileErr) {
        console.warn("[Auth] Failed to update Auth displayName:", profileErr);
    }

    // 3. Create user profile & settings documents in Cloud Firestore
    try {
        await createUserProfile(user.uid, {
            name: trimmedName,
            email: trimmedEmail,
            createdAt: Date.now()
        });
        await createUserSettings(user.uid, {
            theme: "dark",
            createdAt: Date.now()
        });
    } catch (firestoreErr) {
        console.warn("[Auth] Warning: Could not initialize Firestore profile document:", firestoreErr.message);
    }

    return user;
};

/**
 * Signs in an existing user with Email and Password.
 */
export const signInUser = async (email, password) => {
    const trimmedEmail = (email || "").trim();
    if (!trimmedEmail) throw new Error("Email address is required.");
    if (!password) throw new Error("Password is required.");

    const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    return userCredential.user;
};

/**
 * Signs out the current user and redirects to signin.html.
 */
export const signOutUser = async () => {
    try {
        await signOut(auth);
    } finally {
        window.location.href = "signin.html";
    }
};

/**
 * Route Guard for protected pages (e.g. index.html).
 * Listens for auth state:
 * - If not authenticated: immediately redirects to signin.html.
 * - If authenticated: invokes onAuthenticated(user).
 */
export const requireAuth = (onAuthenticated) => {
    return onAuthStateChanged(auth, (user) => {
        if (!user) {
            console.log("[Auth] No active session found. Redirecting to signin.html...");
            window.location.replace("signin.html");
        } else {
            if (typeof onAuthenticated === "function") {
                onAuthenticated(user);
            }
        }
    });
};

/**
 * Route Guard for guest-only pages (e.g. signin.html, signup.html).
 * If a session already exists, automatically redirects to index.html.
 */
export const redirectIfAuthenticated = (destination = "index.html") => {
    return onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("[Auth] User already authenticated. Redirecting to chat...");
            window.location.replace(destination);
        }
    });
};

/**
 * Obtains the current user's Firebase ID token for authenticating backend requests.
 */
export const getAuthToken = async (forceRefresh = false) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("No authenticated user found.");
    }
    return await user.getIdToken(forceRefresh);
};

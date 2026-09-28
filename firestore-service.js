/**
 * Cloud Firestore Data Service for Chatty AI
 * Created by Akintayo Mofeoluwa Richard
 * 
 * Schema:
 * users/{uid}/profile/info
 * users/{uid}/settings/preferences
 * users/{uid}/conversations/{conversationId}
 */

import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    collection, 
    getDocs, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

/**
 * Creates or updates user profile in users/{uid}/profile/info
 */
export const createUserProfile = async (uid, profileData) => {
    if (!uid) throw new Error("UID is required.");
    const profileRef = doc(db, "users", uid, "profile", "info");
    await setDoc(profileRef, {
        name: profileData.name || "",
        email: profileData.email || "",
        createdAt: profileData.createdAt || Date.now(),
        updatedAt: Date.now()
    }, { merge: true });
};

/**
 * Retrieves the user profile info
 */
export const getUserProfile = async (uid) => {
    if (!uid) return null;
    const profileRef = doc(db, "users", uid, "profile", "info");
    const snap = await getDoc(profileRef);
    return snap.exists() ? snap.data() : null;
};

/**
 * Creates default user settings in users/{uid}/settings/preferences
 */
export const createUserSettings = async (uid, settings = {}) => {
    if (!uid) return;
    const settingsRef = doc(db, "users", uid, "settings", "preferences");
    await setDoc(settingsRef, {
        theme: settings.theme || "dark",
        updatedAt: Date.now()
    }, { merge: true });
};

/**
 * Creates a new conversation in users/{uid}/conversations/{conversationId}
 */
export const createConversation = async (uid, title = "New chat", initialMessages = []) => {
    if (!uid) throw new Error("UID is required to create a conversation.");
    const convCol = collection(db, "users", uid, "conversations");
    const newDocRef = doc(convCol); // Auto-generated Firestore ID
    const convId = newDocRef.id;

    const convData = {
        id: convId,
        title: title || "New chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: Array.isArray(initialMessages) ? initialMessages : []
    };

    await setDoc(newDocRef, convData);
    return convData;
};

/**
 * Loads all conversations for the user, ordered by updatedAt descending
 */
export const loadUserConversations = async (uid) => {
    if (!uid) return [];
    try {
        const convCol = collection(db, "users", uid, "conversations");
        const q = query(convCol, orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);

        const conversations = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            conversations.push({
                id: docSnap.id,
                title: data.title || "Untitled Chat",
                createdAt: data.createdAt || 0,
                updatedAt: data.updatedAt || 0,
                messages: data.messages || []
            });
        });
        return conversations;
    } catch (err) {
        console.warn("[Firestore] Error loading conversations with orderBy, falling back to basic query:", err.message);
        // Fallback without index/ordering if index not yet generated
        const convCol = collection(db, "users", uid, "conversations");
        const snapshot = await getDocs(convCol);
        const conversations = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            conversations.push({
                id: docSnap.id,
                title: data.title || "Untitled Chat",
                createdAt: data.createdAt || 0,
                updatedAt: data.updatedAt || 0,
                messages: data.messages || []
            });
        });
        conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        return conversations;
    }
};

/**
 * Loads a single conversation with its complete message history
 */
export const loadConversation = async (uid, conversationId) => {
    if (!uid || !conversationId) return null;
    const docRef = doc(db, "users", uid, "conversations", conversationId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        title: data.title || "Untitled Chat",
        createdAt: data.createdAt || 0,
        updatedAt: data.updatedAt || 0,
        messages: data.messages || []
    };
};

/**
 * Saves/updates messages and metadata for a conversation
 */
export const saveConversation = async (uid, conversationId, updatePayload = {}) => {
    if (!uid || !conversationId) throw new Error("UID and conversationId are required to save.");
    const docRef = doc(db, "users", uid, "conversations", conversationId);
    
    const payload = {
        ...updatePayload,
        updatedAt: Date.now()
    };

    await setDoc(docRef, payload, { merge: true });
};

/**
 * Renames a conversation title
 */
export const renameConversation = async (uid, conversationId, newTitle) => {
    if (!uid || !conversationId) return;
    const docRef = doc(db, "users", uid, "conversations", conversationId);
    await updateDoc(docRef, {
        title: (newTitle || "").trim() || "Untitled Chat",
        updatedAt: Date.now()
    });
};

/**
 * Deletes a conversation from Firestore
 */
export const deleteConversation = async (uid, conversationId) => {
    if (!uid || !conversationId) return;
    const docRef = doc(db, "users", uid, "conversations", conversationId);
    await deleteDoc(docRef);
};

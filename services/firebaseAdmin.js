const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
    try {
        const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
            ? path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
            : path.resolve(__dirname, '..', 'serviceAccountKey.json');

        if (fs.existsSync(saPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('[FirebaseAdmin] Initialized successfully with service account file.');
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('[FirebaseAdmin] Initialized successfully with environment service account key.');
        } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== 'your-firebase-project-id') {
            admin.initializeApp({
                projectId: process.env.FIREBASE_PROJECT_ID
            });
            console.log(`[FirebaseAdmin] Initialized with projectId: ${process.env.FIREBASE_PROJECT_ID}`);
        } else {
            console.warn('[FirebaseAdmin] Notice: No serviceAccountKey.json or real FIREBASE_PROJECT_ID configured yet. ID token verification will expect configuration.');
        }
    } catch (err) {
        console.error('[FirebaseAdmin] Initialization error:', err.message);
    }
}

module.exports = admin;

const admin = require('../services/firebaseAdmin');

async function verifyAuthToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized: Missing or malformed Authorization header. Expected: Bearer <Firebase_ID_Token>'
        });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();

    if (!idToken) {
        return res.status(401).json({
            error: 'Unauthorized: Empty token provided.'
        });
    }

    // Check if Firebase Admin SDK has an active app
    if (!admin.apps.length) {
        return res.status(401).json({
            error: 'Unauthorized: Firebase Admin authentication is not configured on the server. Please set FIREBASE_PROJECT_ID or provide serviceAccountKey.json.'
        });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.userId = decodedToken.uid;
        req.userEmail = decodedToken.email;
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('[AuthMiddleware] Token verification failed:', error.code || error.message);
        return res.status(401).json({
            error: `Unauthorized: Invalid or expired authentication token. (${error.message})`
        });
    }
}

module.exports = { verifyAuthToken };

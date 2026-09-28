/**
 * Chatty AI — Express Backend Server
 * Created by Akintayo Mofeoluwa Richard
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');

// Load environment variables from .env
dotenv.config();

const { verifyAuthToken } = require('./middleware/authMiddleware');
const aiRouter = require('./services/aiRouter');
const groqService = require('./services/groqService');
const searchService = require('./services/searchService');
const imageSearchService = require('./services/imageSearchService');
const imageGenerationService = require('./services/imageGenerationService');
const documentService = require('./services/documentService');
const securityService = require('./services/securityService');
const supportService = require('./services/supportService');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// File Upload Configuration (Multer in-memory storage, 10MB limit)
// ============================================================================
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB max per file
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// Serve official logo and assets explicitly
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ============================================================================
// Health Check Endpoint
// ============================================================================
app.get('/api/health', async (req, res) => {
    try {
        const groqModel = await groqService.verifyModel();
        res.json({
            status: 'online',
            service: 'Chatty AI Backend',
            creator: 'Akintayo Mofeoluwa Richard',
            groq: {
                status: 'ready',
                model: groqModel
            },
            webSearch: {
                configured: searchService.isAvailable(),
                provider: searchService.provider
            },
            imageSearch: {
                configured: imageSearchService.isAvailable(),
                provider: imageSearchService.provider
            },
            imageGeneration: {
                configured: imageGenerationService.isAvailable(),
                provider: imageGenerationService.providerName,
                model: imageGenerationService.model
            },
            documentService: {
                status: 'ready',
                supportedFormats: ['PDF', 'DOCX', 'TXT', 'CSV', 'JSON', 'MD', 'PNG', 'JPG', 'WEBP']
            },
            support: {
                status: 'ready',
                destination: supportService.destinationEmail
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: 'degraded',
            service: 'Chatty AI Backend',
            creator: 'Akintayo Mofeoluwa Richard',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================================================
// Protected Chat Route
// ============================================================================
app.post('/api/chat', verifyAuthToken, securityService.rateLimitMiddleware('chat'), async (req, res) => {
    try {
        const { messages, documentId, options } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: 'Invalid request: "messages" array is required.'
            });
        }

        const result = await aiRouter.routeChat({
            userId: req.userId,
            messages: messages,
            documentId: documentId || null,
            options: options || {}
        });

        return res.json({
            answer: result.answer,
            model: result.model,
            tool: result.tool || 'normal_chat',
            sources: result.sources || [],
            images: result.images || [],
            generatedImage: result.generatedImage || null,
            documentInfo: result.documentInfo || null
        });

    } catch (error) {
        console.error('[Server] /api/chat error:', error.message);
        return res.status(500).json({
            error: error.message || 'An error occurred while generating the AI response.'
        });
    }
});

// ============================================================================
// Protected Conversation Title Generator (Rule 12: 2-5 words topic title)
// ============================================================================
app.post('/api/conversations/title', verifyAuthToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.json({ title: 'New Conversation' });
        }
        const title = await aiRouter.generateConversationTitle(prompt);
        return res.json({ title });
    } catch (err) {
        console.error('[Server] Title generation error:', err.message);
        return res.json({ title: 'New Conversation' });
    }
});

// ============================================================================
// Protected Document Upload Endpoint
// ============================================================================
app.post('/api/documents/upload', verifyAuthToken, securityService.rateLimitMiddleware('upload'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file was uploaded.' });
        }

        // Validate file safety and format
        const validation = securityService.validateFileUpload(req.file);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        // Process and index document under user UID
        const docRecord = await documentService.processAndStoreDocument({
            userId: req.userId,
            fileBuffer: req.file.buffer,
            originalName: validation.safeName,
            mimeType: req.file.mimetype,
            size: req.file.size
        });

        return res.status(201).json({
            success: true,
            document: docRecord
        });

    } catch (err) {
        console.error('[Server] Document upload error:', err.message);
        return res.status(500).json({
            error: `Document processing failed: ${err.message}`
        });
    }
});

// ============================================================================
// Protected Document Listing & Deletion Endpoints
// ============================================================================
app.get('/api/documents', verifyAuthToken, (req, res) => {
    try {
        const userDocs = documentService.listDocuments(req.userId);
        res.json({ documents: userDocs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/documents/:id', verifyAuthToken, (req, res) => {
    try {
        const docId = req.params.id;
        const deleted = documentService.deleteDocument(req.userId, docId);
        if (deleted) {
            res.json({ success: true, message: 'Document deleted successfully.' });
        } else {
            res.status(404).json({ error: 'Document not found or access unauthorized.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// Protected Support & Issue Reporting Endpoint (Rules 33-41, 47-49)
// ============================================================================
app.post('/api/support/report', verifyAuthToken, securityService.rateLimitMiddleware('support'), async (req, res) => {
    try {
        const { subject, complaint, category, context } = req.body;

        // Ensure userEmail comes from verified auth token to prevent impersonation
        const userEmail = req.userEmail || (req.user && req.user.email);
        const userId = req.userId;

        if (!userEmail) {
            return res.status(400).json({
                error: 'Could not determine authenticated user email. Please ensure your account has a verified email address.'
            });
        }

        const reportResult = await supportService.submitReport({
            subject,
            complaint,
            category,
            userEmail,
            userId,
            context: context || {}
        });

        return res.status(200).json(reportResult);

    } catch (err) {
        console.error('[Server] /api/support/report error:', err.message);
        return res.status(400).json({
            error: err.message || "We couldn't submit your report right now. Please try again."
        });
    }
});

// Fallback to index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Chatty AI Server running at: http://localhost:${PORT}`);
    console.log(` Creator: Akintayo Mofeoluwa Richard`);
    console.log(` AI Provider: Groq (${process.env.GROQ_MODEL || 'verified available model'})`);
    console.log(`====================================================`);
});

module.exports = { app, server };

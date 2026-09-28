/**
 * Chatty AI — Support & Issue Reporting Service
 * Created by Akintayo Mofeoluwa Richard
 *
 * Implements:
 *   - Rule 33: "Report an Issue" / "Ask a Problem" system
 *   - Rule 35: Strict field validation & anti-impersonation
 *   - Rule 36: Server-side email delivery to chattyai119@gmail.com
 *   - Rule 37 & 38: Standardized email format & default footer
 *   - Rule 39: Non-sensitive context collection (version, browser, OS, conversation ID)
 *   - Rule 41: Anti-injection & CRLF protection
 *   - Rule 47: Unique Report ID (CHAT-YYYYMMDD-XXXXXX) & safe logging
 */

const nodemailer = require('nodemailer');

const SUPPORT_EMAIL_DESTINATION = 'chattyai119@gmail.com';

const ALLOWED_CATEGORIES = [
    'Bug / Broken Feature',
    'UI / Display Problem',
    'Login / Authentication Issue',
    'Web Search Problem',
    'Document Analysis Problem',
    'Image Generation / Search Problem',
    'Voice-to-Text Problem',
    'Performance / Latency Issue',
    'Other Question / Feedback'
];

class SupportService {
    constructor() {
        this.destinationEmail = SUPPORT_EMAIL_DESTINATION;
        this.transporter = null;
        this._initTransporter();
    }

    /**
     * Initializes the nodemailer transporter based on available environment credentials.
     */
    _initTransporter() {
        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, EMAIL_USER, EMAIL_PASS } = process.env;

        if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
            // Standard Custom SMTP Server
            this.transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: parseInt(SMTP_PORT || '587', 10),
                secure: SMTP_SECURE === 'true',
                auth: {
                    user: SMTP_USER,
                    pass: SMTP_PASS
                }
            });
        } else if (EMAIL_USER && EMAIL_PASS) {
            // Gmail or standard direct service
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: EMAIL_USER,
                    pass: EMAIL_PASS
                }
            });
        } else {
            // Development / Test JSON Transporter (captures email cleanly without live SMTP server)
            this.transporter = nodemailer.createTransport({
                jsonTransport: true
            });
        }
    }

    /**
     * Generates a unique Report ID formatted as: CHAT-YYYYMMDD-XXXXXX
     */
    generateReportId() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const datePart = `${year}${month}${day}`;
        
        // 6-character random uppercase alphanumeric
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `CHAT-${datePart}-${randomPart}`;
    }

    /**
     * Sanitizes headers to prevent CRLF email header injection.
     */
    sanitizeHeader(text) {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/[\r\n\t]/g, ' ').trim();
    }

    /**
     * Sanitizes plain text content.
     */
    sanitizeText(text, maxChars = 5000) {
        if (!text || typeof text !== 'string') return '';
        return text.trim().slice(0, maxChars);
    }

    /**
     * Validates an issue report payload.
     */
    validateReport({ subject, complaint, userEmail, userId, category }) {
        if (!userId || typeof userId !== 'string') {
            return { valid: false, error: 'Authentication required. User ID is missing.' };
        }

        if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
            return { valid: false, error: 'A valid authenticated email is required.' };
        }

        const cleanSubject = this.sanitizeHeader(subject);
        if (!cleanSubject || cleanSubject.length < 3) {
            return { valid: false, error: 'Please provide a subject of at least 3 characters.' };
        }
        if (cleanSubject.length > 150) {
            return { valid: false, error: 'Subject cannot exceed 150 characters.' };
        }

        const cleanComplaint = this.sanitizeText(complaint);
        if (!cleanComplaint || cleanComplaint.length < 10) {
            return { valid: false, error: 'Please provide a problem description of at least 10 characters.' };
        }
        if (cleanComplaint.length > 5000) {
            return { valid: false, error: 'Problem description cannot exceed 5000 characters.' };
        }

        const validCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'Other Question / Feedback';

        return {
            valid: true,
            subject: cleanSubject,
            complaint: cleanComplaint,
            category: validCategory,
            userEmail: this.sanitizeHeader(userEmail),
            userId
        };
    }

    /**
     * Submits an issue report and sends email to chattyai119@gmail.com.
     */
    async submitReport({ subject, complaint, category, userEmail, userId, context = {} }) {
        const validation = this.validateReport({ subject, complaint, userEmail, userId, category });
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const reportId = this.generateReportId();
        const timestamp = new Date().toISOString();

        // Technical non-sensitive context (Rule 39)
        const appVersion = context.version || '1.0.0';
        const interfaceArea = this.sanitizeHeader(context.interface || 'Main Application / Settings');
        const userAgent = this.sanitizeHeader(context.userAgent || 'Unknown Browser/OS');
        const conversationId = context.conversationId ? this.sanitizeHeader(context.conversationId) : 'None';

        // Plain Text Email Body (Rule 37 & 38)
        const textBody = `Chatty AI Issue Report
Report ID: ${reportId}

User Email:
${validation.userEmail}

Subject:
${validation.subject}

Problem:
${validation.complaint}

Submitted:
${timestamp}

User ID:
${validation.userId}

Chatty AI Interface:
${interfaceArea}

Feature:
${validation.category}

Technical Context:
- Chatty AI Version: ${appVersion}
- Client Agent: ${userAgent}
- Relevant Conversation ID: ${conversationId}

--------------------------------------------------
This issue was submitted through the Chatty AI Report an Issue system.`;

        // HTML Email Body (Modern Dark & Cyan Branding)
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080b18; color: #f1f5f9; padding: 24px; margin: 0; }
  .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
  .header { background: linear-gradient(135deg, #1e1b4b, #0f172a); padding: 24px; border-bottom: 1px solid #1e293b; }
  .title { color: #00f0ff; margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }
  .report-badge { display: inline-block; background-color: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 13px; font-weight: 600; margin-top: 6px; }
  .content { padding: 24px; }
  .field-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 4px; font-weight: 600; }
  .field-value { font-size: 15px; color: #f8fafc; background-color: #1e293b; padding: 10px 14px; border-radius: 8px; margin-bottom: 18px; line-height: 1.5; word-break: break-word; }
  .complaint-box { white-space: pre-wrap; background-color: #0b1329; border-left: 3px solid #3b82f6; }
  .context-list { list-style: none; padding: 0; margin: 0; font-size: 13px; color: #cbd5e1; }
  .context-list li { margin-bottom: 4px; }
  .footer { background-color: #090e1f; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #1e293b; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">Chatty AI — Issue Report</h1>
      <span class="report-badge">${reportId}</span>
    </div>
    <div class="content">
      <div class="field-label">User Email</div>
      <div class="field-value"><a href="mailto:${validation.userEmail}" style="color: #38bdf8;">${validation.userEmail}</a></div>

      <div class="field-label">Category / Feature</div>
      <div class="field-value">${validation.category}</div>

      <div class="field-label">Subject</div>
      <div class="field-value"><strong>${validation.subject}</strong></div>

      <div class="field-label">Problem Description</div>
      <div class="field-value complaint-box">${validation.complaint.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

      <div class="field-label">Technical Context</div>
      <div class="field-value">
        <ul class="context-list">
          <li><strong>Submitted:</strong> ${timestamp}</li>
          <li><strong>User ID:</strong> <code>${validation.userId}</code></li>
          <li><strong>Interface:</strong> ${interfaceArea}</li>
          <li><strong>Version:</strong> ${appVersion}</li>
          <li><strong>Client Agent:</strong> ${userAgent}</li>
          <li><strong>Conversation ID:</strong> <code>${conversationId}</code></li>
        </ul>
      </div>
    </div>
    <div class="footer">
      This issue was submitted through the Chatty AI Report an Issue system.<br>
      Created by Akintayo Mofeoluwa Richard
    </div>
  </div>
</body>
</html>`;

        const mailOptions = {
            from: process.env.SMTP_FROM || `Chatty AI Support <no-reply@chattyai.app>`,
            to: this.destinationEmail,
            replyTo: validation.userEmail,
            subject: `[Chatty AI Issue] [${reportId}] ${validation.subject}`,
            text: textBody,
            html: htmlBody
        };

        try {
            const sendResult = await this.transporter.sendMail(mailOptions);
            
            // Safe logging per Rule 47: Log success, timestamp, report ID. Never log secrets or credentials.
            console.log(`[SupportService] [SUCCESS] Report ${reportId} submitted successfully at ${timestamp} (To: ${this.destinationEmail})`);
            
            return {
                success: true,
                reportId,
                timestamp,
                message: 'Your issue has been submitted successfully.',
                note: "We'll review the report and use it to improve Chatty AI.",
                messageId: sendResult.messageId || null
            };
        } catch (emailError) {
            // Safe error logging per Rule 47
            console.error(`[SupportService] [ERROR] Email delivery failed for Report ${reportId} at ${timestamp}: ${emailError.message}`);
            throw new Error(`We couldn't submit your report right now. Please try again.`);
        }
    }
}

module.exports = new SupportService();

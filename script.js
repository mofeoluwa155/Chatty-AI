/**
 * Chatty AI — Core Frontend Controller
 * Created by Akintayo Mofeoluwa Richard
 *
 * Implements:
 *   - Rule 26: Personalized Welcome ("Good morning/afternoon/evening, [Name]")
 *   - Rule 12: 2-5 Word Automatic Conversation Titles
 *   - Rule 21: Voice-to-Text Web Speech API typing
 *   - Rule 28: Settings System & Custom Instructions
 *   - Multi-tool rendering (Document Analysis, Image Search, Image Gen, Web Citations)
 *   - Firebase Authentication & Cloud Firestore Persistence
 */

import { requireAuth, signOutUser, getAuthToken } from "./auth.js";
import { 
    createConversation, 
    loadUserConversations, 
    loadConversation, 
    saveConversation, 
    renameConversation, 
    deleteConversation
} from "./firestore-service.js";

(() => {
    'use strict';

    /* ======================================================================
       DOM Elements
       ====================================================================== */
    const $ = (id) => document.getElementById(id);

    const els = {
        authLoadingOverlay: $('auth-loading-overlay'),
        app: $('app'),
        
        // Sidebar
        sidebar: $('sidebar'),
        sidebarOverlay: $('sidebar-overlay'),
        sidebarToggle: $('sidebar-toggle'),
        newChatBtn: $('new-chat-btn'),
        searchInput: $('search-input'),
        conversationList: $('conversation-list'),
        conversationsEmpty: $('conversations-empty'),
        
        // User Profile & Dropdown
        userProfileBtn: $('user-profile-btn'),
        userAvatarInitials: $('user-avatar-initials'),
        userDisplayName: $('user-display-name'),
        userDisplayEmail: $('user-display-email'),
        profileDropdown: $('profile-dropdown'),
        dropdownUserName: $('dropdown-user-name'),
        dropdownUserEmail: $('dropdown-user-email'),
        themeToggleBtn: $('theme-toggle-btn'),
        themeToggleLabel: $('theme-toggle-label'),
        signoutBtn: $('signout-btn'),
        
        // Workspace
        modelBadge: $('model-badge'),
        clearChatBtn: $('clear-chat-btn'),
        headerSettingsBtn: $('header-settings-btn'),
        chatContainer: $('chat-container'),
        welcomeScreen: $('welcome-screen'),
        welcomeGreeting: $('welcome-greeting'),
        messagesList: $('messages-list'),
        thinkingIndicator: $('thinking-indicator'),
        
        // Composer & Attachment
        chatForm: $('chat-form'),
        messageInput: $('message-input'),
        sendBtn: $('send-btn'),
        attachmentBtn: $('attachment-btn'),
        voiceBtn: $('voice-btn'),
        docFileInput: $('doc-file-input'),
        attachedDocBar: $('attached-doc-bar'),
        attachedDocName: $('attached-doc-name'),
        attachedDocMeta: $('attached-doc-meta'),
        removeDocBtn: $('remove-doc-btn'),
        
        // Settings Modal (Rule 28)
        settingsModal: $('settings-modal'),
        settingsOpenBtn: $('settings-open-btn'),
        settingsCloseBtn: $('settings-close-btn'),
        settingsSaveBtn: $('settings-save-btn'),
        settingTheme: $('setting-theme'),
        settingPersonality: $('setting-personality'),
        settingCustomInstructions: $('setting-custom-instructions'),
        settingDetail: $('setting-detail'),
        settingReasoning: $('setting-reasoning'),
        settingsUserEmail: $('settings-user-email'),
        modalFooterSave: $('modal-footer-save'),

        // Report an Issue (Rules 33-49)
        dropdownReportBtn: $('dropdown-report-btn'),
        navItemSupport: $('nav-item-support'),
        reportForm: $('report-form'),
        reportEmail: $('report-email'),
        reportCategory: $('report-category'),
        reportSubject: $('report-subject'),
        reportComplaint: $('report-complaint'),
        reportIncludeContext: $('report-include-context'),
        reportSubmitBtn: $('report-submit-btn'),
        reportAlert: $('report-alert'),
        reportAlertTitle: $('report-alert-title'),
        reportAlertMessage: $('report-alert-message'),
        reportAlertIdBox: $('report-alert-id-box'),
        reportAlertId: $('report-alert-id'),

        // Templates
        userMsgTemplate: $('user-msg-template'),
        aiMsgTemplate: $('ai-msg-template'),
        convItemTemplate: $('conv-item-template')
    };

    /* ======================================================================
       State & Settings
       ====================================================================== */
    const state = {
        currentUser: null,
        activeConversationId: null,
        conversations: [],       // [{ id, title, createdAt, updatedAt, messages: [] }]
        activeDocument: null,    // { id, name, size, pageCount, extension, preview }
        isSending: false,
        isUploading: false,
        isListening: false,
        speechRecognizer: null,
        theme: 'dark',
        settings: {
            theme: 'dark',
            personality: 'informative',
            customInstructions: '',
            responseDetail: 'balanced',
            reasoningSnapshot: false
        }
    };

    /* ======================================================================
       Settings Management (Rule 28)
       ====================================================================== */
    const loadSavedSettings = () => {
        try {
            const saved = localStorage.getItem('chatty_settings');
            if (saved) {
                state.settings = { ...state.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('[Settings] Error loading saved settings:', e);
        }

        // Apply theme
        document.documentElement.setAttribute('data-theme', state.settings.theme || 'dark');
        state.theme = state.settings.theme || 'dark';
        if (els.settingTheme) els.settingTheme.value = state.theme;
        if (els.settingPersonality) els.settingPersonality.value = state.settings.personality || 'informative';
        if (els.settingCustomInstructions) els.settingCustomInstructions.value = state.settings.customInstructions || '';
        if (els.settingDetail) els.settingDetail.value = state.settings.responseDetail || 'balanced';
        if (els.settingReasoning) els.settingReasoning.checked = Boolean(state.settings.reasoningSnapshot);
    };

    const saveSettings = () => {
        state.settings.theme = els.settingTheme.value;
        state.settings.personality = els.settingPersonality.value;
        state.settings.customInstructions = els.settingCustomInstructions.value.trim();
        state.settings.responseDetail = els.settingDetail.value;
        state.settings.reasoningSnapshot = els.settingReasoning.checked;

        // Apply theme immediately
        document.documentElement.setAttribute('data-theme', state.settings.theme);
        state.theme = state.settings.theme;

        try {
            localStorage.setItem('chatty_settings', JSON.stringify(state.settings));
        } catch (e) {}

        closeSettingsModal();
    };

    /**
     * Switch the visible settings tab panel and highlight the active nav item.
     */
    const switchSettingsTab = (tabName) => {
        document.querySelectorAll('.settings-tab-panel').forEach(panel => { panel.hidden = true; });
        document.querySelectorAll('.settings-nav-item').forEach(btn => { btn.classList.remove('active'); });
        const panel = document.getElementById('tab-' + tabName);
        if (panel) panel.hidden = false;
        const navBtn = document.querySelector('.settings-nav-item[data-tab="' + tabName + '"]');
        if (navBtn) navBtn.classList.add('active');
        if (els.modalFooterSave) {
            els.modalFooterSave.style.display = (tabName === 'support') ? 'none' : '';
        }
    };

    const openSettingsModal = (targetTab) => {
        targetTab = targetTab || 'appearance';
        closeProfileDropdown();
        if (state.currentUser && els.settingsUserEmail) {
            els.settingsUserEmail.textContent = state.currentUser.email || 'Anonymous';
        }
        if (state.currentUser && els.reportEmail) {
            els.reportEmail.value = state.currentUser.email || '';
        }
        switchSettingsTab(targetTab);
        els.settingsModal.hidden = false;
    };

    const closeSettingsModal = () => {
        els.settingsModal.hidden = true;
        resetReportAlert();
    };

    const bindSettingsTabs = () => {
        document.querySelectorAll('.settings-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab) switchSettingsTab(tab);
            });
        });
    };

    const resetReportAlert = () => {
        if (!els.reportAlert) return;
        els.reportAlert.hidden = true;
        els.reportAlert.className = 'report-alert';
        if (els.reportAlertTitle) els.reportAlertTitle.textContent = '';
        if (els.reportAlertMessage) els.reportAlertMessage.textContent = '';
        if (els.reportAlertIdBox) els.reportAlertIdBox.hidden = true;
        if (els.reportAlertId) els.reportAlertId.textContent = '';
    };

    const showReportSuccess = (message, note, reportId) => {
        if (!els.reportAlert) return;
        els.reportAlert.className = 'report-alert success';
        els.reportAlert.hidden = false;
        if (els.reportAlertTitle) els.reportAlertTitle.textContent = 'Report Submitted Successfully';
        if (els.reportAlertMessage) els.reportAlertMessage.textContent = message + (note ? ' ' + note : '');
        if (reportId && els.reportAlertId && els.reportAlertIdBox) {
            els.reportAlertId.textContent = reportId;
            els.reportAlertIdBox.hidden = false;
        }
    };

    const showReportError = (message) => {
        if (!els.reportAlert) return;
        els.reportAlert.className = 'report-alert error';
        els.reportAlert.hidden = false;
        if (els.reportAlertTitle) els.reportAlertTitle.textContent = 'Submission Failed';
        if (els.reportAlertMessage) {
            els.reportAlertMessage.textContent = message || "We couldn't submit your report right now. Please try again.";
        }
    };

    const submitIssueReport = async (e) => {
        e.preventDefault();
        resetReportAlert();

        const subject = els.reportSubject ? els.reportSubject.value.trim() : '';
        const complaint = els.reportComplaint ? els.reportComplaint.value.trim() : '';
        const category = els.reportCategory ? els.reportCategory.value : 'Other Question / Feedback';
        const includeContext = els.reportIncludeContext ? els.reportIncludeContext.checked : false;

        if (!subject || subject.length < 3) {
            showReportError('Please enter a subject of at least 3 characters.');
            if (els.reportSubject) els.reportSubject.focus();
            return;
        }
        if (subject.length > 150) {
            showReportError('Subject cannot exceed 150 characters.');
            return;
        }
        if (!complaint || complaint.length < 10) {
            showReportError('Please describe the problem in at least 10 characters.');
            if (els.reportComplaint) els.reportComplaint.focus();
            return;
        }
        if (complaint.length > 5000) {
            showReportError('Problem description cannot exceed 5000 characters.');
            return;
        }

        const context = {};
        if (includeContext) {
            context.version = '1.0.0';
            context.interface = 'Settings - Report an Issue';
            context.userAgent = navigator.userAgent || 'Unknown';
            if (state.activeConversationId) {
                context.conversationId = state.activeConversationId;
            }
        }

        if (els.reportSubmitBtn) {
            els.reportSubmitBtn.disabled = true;
            const btnText = els.reportSubmitBtn.querySelector('.btn-text');
            if (btnText) btnText.textContent = 'Submitting...';
        }

        try {
            const token = await getAuthToken();
            if (!token) {
                showReportError('Authentication required. Please sign in and try again.');
                return;
            }
            const response = await fetch('/api/support/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ subject, complaint, category, context })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                showReportSuccess(data.message, data.note, data.reportId);
                if (els.reportSubject) els.reportSubject.value = '';
                if (els.reportComplaint) els.reportComplaint.value = '';
            } else {
                showReportError(data.error || "We couldn't submit your report right now. Please try again.");
            }
        } catch (err) {
            console.error('[ReportForm] Submission error:', err);
            showReportError("We couldn't submit your report right now. Please check your connection and try again.");
        } finally {
            if (els.reportSubmitBtn) {
                els.reportSubmitBtn.disabled = false;
                const btnText = els.reportSubmitBtn.querySelector('.btn-text');
                if (btnText) btnText.textContent = 'Submit Report';
            }
        }
    };

    /* ======================================================================
       Personalized Welcome (Rule 26)
       ====================================================================== */
    const updateWelcomeGreeting = () => {
        const hour = new Date().getHours();
        let timeGreeting = 'Good day';
        if (hour >= 5 && hour < 12) {
            timeGreeting = 'Good morning';
        } else if (hour >= 12 && hour < 18) {
            timeGreeting = 'Good afternoon';
        } else {
            timeGreeting = 'Good evening';
        }

        let name = '';
        if (state.currentUser) {
            name = state.currentUser.displayName || state.currentUser.email?.split('@')[0] || '';
            // Capitalize first letter of name
            if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        const fullGreeting = name ? `${timeGreeting}, ${name}` : timeGreeting;
        if (els.welcomeGreeting) {
            els.welcomeGreeting.textContent = fullGreeting;
        }
    };

    /* ======================================================================
       Utility Functions
       ====================================================================== */
    const escapeHTML = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    const formatTimestamp = (timestamp) => {
        const date = timestamp ? new Date(timestamp) : new Date();
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 KB';
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    /**
     * Parses Markdown-like text into structured HTML with syntax code blocks.
     */
    const renderMarkdownContent = (rawText) => {
        if (!rawText) return '';
        
        let content = escapeHTML(rawText);

        // Code blocks: ```lang ... ```
        content = content.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            const displayLang = (lang || 'code').toLowerCase();
            return `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span>${displayLang}</span>
                        <button class="btn-copy-code" type="button" aria-label="Copy code">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Copy code</span>
                        </button>
                    </div>
                    <pre><code class="language-${displayLang}">${code.trim()}</code></pre>
                </div>
            `;
        });

        // Inline code: `code`
        content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Bold: **text** or __text__
        content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic: *text*
        content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Split paragraphs on double line break
        const paragraphs = content.split(/\n\n+/);
        return paragraphs.map(p => {
            const trimmed = p.trim();
            if (trimmed.startsWith('<div class="code-block-wrapper"')) {
                return trimmed;
            }
            return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
        }).join('');
    };

    const scrollChatToBottom = (smooth = true) => {
        requestAnimationFrame(() => {
            els.chatContainer.scrollTo({
                top: els.chatContainer.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        });
    };

    const autoResizeTextarea = () => {
        const ta = els.messageInput;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
        updateSendBtnState();
    };

    const updateSendBtnState = () => {
        const hasText = els.messageInput.value.trim().length > 0;
        els.sendBtn.disabled = (!hasText && !state.activeDocument) || state.isSending || state.isUploading;
    };

    const updateWelcomeVisibility = () => {
        const hasMessages = els.messagesList.children.length > 0;
        els.welcomeScreen.hidden = hasMessages;
        if (!hasMessages) {
            updateWelcomeGreeting();
        }
    };

    /* ======================================================================
       Voice-to-Text Web Speech Recognition (Rule 21)
       ====================================================================== */
    const initVoiceRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            els.voiceBtn.title = 'Voice recognition is not supported in this browser.';
            return;
        }

        const recognizer = new SpeechRecognition();
        recognizer.continuous = false;
        recognizer.interimResults = true;
        recognizer.lang = 'en-US';

        recognizer.onstart = () => {
            state.isListening = true;
            els.voiceBtn.classList.add('is-recording');
            els.messageInput.placeholder = 'Listening... speak now';
        };

        recognizer.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            if (transcript) {
                els.messageInput.value = (els.messageInput.value ? els.messageInput.value + ' ' : '') + transcript;
                autoResizeTextarea();
            }
        };

        recognizer.onerror = (event) => {
            console.warn('[Voice] Speech recognition error:', event.error);
            stopVoiceRecognition();
        };

        recognizer.onend = () => {
            stopVoiceRecognition();
        };

        state.speechRecognizer = recognizer;
    };

    const toggleVoiceRecognition = () => {
        if (!state.speechRecognizer) {
            alert('Voice recognition is not supported in your browser or microphone access is disabled.');
            return;
        }

        if (state.isListening) {
            state.speechRecognizer.stop();
        } else {
            try {
                state.speechRecognizer.start();
            } catch (err) {
                console.warn('[Voice] Failed to start recognition:', err);
            }
        }
    };

    const stopVoiceRecognition = () => {
        state.isListening = false;
        els.voiceBtn.classList.remove('is-recording');
        els.messageInput.placeholder = 'Message Chatty AI...';
        autoResizeTextarea();
    };

    /* ======================================================================
       Document Attachment Handling
       ====================================================================== */
    const setAttachedDocument = (doc) => {
        state.activeDocument = doc;
        if (doc) {
            els.attachedDocName.textContent = doc.name;
            const metaStr = doc.pageCount ? `(${doc.pageCount} page${doc.pageCount > 1 ? 's' : ''} • ${formatFileSize(doc.size)})` : `(${formatFileSize(doc.size)})`;
            els.attachedDocMeta.textContent = metaStr;
            els.attachedDocBar.hidden = false;
        } else {
            els.attachedDocBar.hidden = true;
            if (els.docFileInput) els.docFileInput.value = '';
        }
        updateSendBtnState();
    };

    const handleFileUpload = async (file) => {
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert(`File "${file.name}" exceeds the 10MB limit.`);
            return;
        }

        state.isUploading = true;
        updateSendBtnState();
        showThinking();
        els.thinkingIndicator.querySelector('.thinking-text').textContent = `Uploading and processing "${file.name}"...`;

        try {
            const idToken = await getAuthToken();
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/documents/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`
                },
                body: formData
            });

            const data = await response.json();
            hideThinking();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to upload document.');
            }

            setAttachedDocument(data.document);
            els.messageInput.focus();

        } catch (err) {
            hideThinking();
            console.error('[Document] Upload failed:', err);
            alert(`Document upload error: ${err.message}`);
        } finally {
            state.isUploading = false;
            updateSendBtnState();
            els.thinkingIndicator.querySelector('.thinking-text').textContent = 'Chatty AI is thinking';
        }
    };

    /* ======================================================================
       Message Rendering
       ====================================================================== */
    const appendUserMessage = (text, timestamp = Date.now(), attachedDoc = null) => {
        const clone = els.userMsgTemplate.content.cloneNode(true);
        const bodyEl = clone.querySelector('.message-body');
        const timeEl = clone.querySelector('.message-time');
        const avatarEl = clone.querySelector('.avatar-user');

        let html = '';
        if (attachedDoc) {
            html += `
                <div class="tool-badge tool-badge-doc">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <span>Attached: ${escapeHTML(attachedDoc.name)}</span>
                </div>
            `;
        }

        html += `<p>${escapeHTML(text).replace(/\n/g, '<br>')}</p>`;
        bodyEl.innerHTML = html;
        timeEl.textContent = formatTimestamp(timestamp);

        const name = state.currentUser?.displayName || 'U';
        avatarEl.textContent = name.charAt(0).toUpperCase();

        els.messagesList.appendChild(clone);
        updateWelcomeVisibility();
        scrollChatToBottom();
    };

    const appendAIMessage = (text, timestamp = Date.now(), sources = [], images = [], generatedImage = null, tool = 'normal_chat', documentInfo = null) => {
        const clone = els.aiMsgTemplate.content.cloneNode(true);
        const row = clone.querySelector('.message-row-ai');
        const bodyEl = clone.querySelector('.message-body');
        const timeEl = clone.querySelector('.message-time');
        
        let toolBadgeHtml = '';
        if (tool === 'document_analysis' && documentInfo) {
            toolBadgeHtml = `
                <div class="tool-badge tool-badge-doc">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <span>Analyzed Document: ${escapeHTML(documentInfo.name)} (${documentInfo.pageCount || 1} pages)</span>
                </div>
            `;
        } else if (tool === 'web_search') {
            toolBadgeHtml = `
                <div class="tool-badge tool-badge-search">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <span>Live Web Search</span>
                </div>
            `;
        } else if (tool === 'image_search') {
            toolBadgeHtml = `
                <div class="tool-badge tool-badge-image">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <span>Image Search</span>
                </div>
            `;
        } else if (tool === 'image_generation') {
            toolBadgeHtml = `
                <div class="tool-badge tool-badge-image">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    <span>Generated Image</span>
                </div>
            `;
        }

        let mainHtml = toolBadgeHtml + renderMarkdownContent(text);

        // Render Generated Image Card
        if (generatedImage && generatedImage.url) {
            mainHtml += `
                <div class="generated-image-card">
                    <div class="generated-image-preview-box">
                        <img src="${generatedImage.url}" alt="${escapeHTML(generatedImage.prompt || 'Generated image')}" class="generated-image-preview" loading="lazy">
                    </div>
                    <div class="generated-image-footer">
                        <div class="generated-image-badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 14 14"></polyline>
                            </svg>
                            <span>${escapeHTML(generatedImage.model || 'black-forest-labs/flux.1-schnell')}</span>
                        </div>
                        <a href="${generatedImage.url}" download="chatty-ai-image.png" class="btn-download-image">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Download Image</span>
                        </a>
                    </div>
                </div>
            `;
        }

        // Render Image Search Grid
        if (Array.isArray(images) && images.length > 0) {
            let gridHtml = '<div class="image-search-grid">';
            images.forEach(img => {
                gridHtml += `
                    <a href="${escapeHTML(img.url)}" target="_blank" rel="noopener noreferrer" class="image-search-card" title="${escapeHTML(img.title)}">
                        <div class="image-search-thumb-box">
                            <img src="${escapeHTML(img.thumbnail || img.url)}" alt="${escapeHTML(img.title)}" class="image-search-thumb" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' fill=\\'none\\'><rect width=\\'100\\' height=\\'100\\' fill=\\'%23222\\'/></svg>'">
                        </div>
                        <div class="image-search-info">
                            <span class="image-search-title">${escapeHTML(img.title)}</span>
                            <span class="image-search-domain">${escapeHTML(img.domain || 'External Link')}</span>
                        </div>
                    </a>
                `;
            });
            gridHtml += '</div>';
            mainHtml += gridHtml;
        }

        bodyEl.innerHTML = mainHtml;
        timeEl.textContent = formatTimestamp(timestamp);

        // Wire copy code buttons inside code blocks
        row.querySelectorAll('.btn-copy-code').forEach(btn => {
            btn.addEventListener('click', async () => {
                const codeBlock = btn.closest('.code-block-wrapper').querySelector('code');
                if (codeBlock) {
                    await navigator.clipboard.writeText(codeBlock.textContent);
                    const label = btn.querySelector('span');
                    const orig = label.textContent;
                    label.textContent = 'Copied!';
                    setTimeout(() => { label.textContent = orig; }, 1500);
                }
            });
        });

        // Wire Toolbar Actions
        const copyBtn = row.querySelector('.btn-copy');
        const regenBtn = row.querySelector('.btn-regenerate');
        const likeBtn = row.querySelector('.btn-like');
        const dislikeBtn = row.querySelector('.btn-dislike');

        copyBtn.addEventListener('click', async () => {
            await navigator.clipboard.writeText(text);
            const label = copyBtn.querySelector('.action-label');
            const orig = label.textContent;
            label.textContent = 'Copied!';
            copyBtn.classList.add('is-active');
            setTimeout(() => {
                label.textContent = orig;
                copyBtn.classList.remove('is-active');
            }, 1500);
        });

        regenBtn.addEventListener('click', () => handleRegenerate());

        likeBtn.addEventListener('click', () => {
            likeBtn.classList.toggle('is-active');
            dislikeBtn.classList.remove('is-active');
        });

        dislikeBtn.addEventListener('click', () => {
            dislikeBtn.classList.toggle('is-active');
            likeBtn.classList.remove('is-active');
        });

        // Wire Sources Section for Web Search
        const sourcesContainer = row.querySelector('.sources-container');
        if (Array.isArray(sources) && sources.length > 0) {
            sourcesContainer.hidden = false;
            row.querySelector('.sources-count').textContent = sources.length;
            const toggleBtn = row.querySelector('.sources-toggle-btn');
            const listEl = row.querySelector('.sources-list');

            let sourcesHtml = '';
            sources.forEach((s, idx) => {
                sourcesHtml += `
                    <div class="source-item" style="padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                        <a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); font-size: 13px; font-weight: 500; text-decoration: none;">
                            [${idx + 1}] ${escapeHTML(s.title || s.domain || 'Source')}
                        </a>
                        <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${escapeHTML(s.snippet || s.domain || '')}</p>
                    </div>
                `;
            });
            listEl.innerHTML = sourcesHtml;

            toggleBtn.addEventListener('click', () => {
                const isHidden = listEl.hidden;
                listEl.hidden = !isHidden;
                toggleBtn.setAttribute('aria-expanded', String(isHidden));
            });
        }

        els.messagesList.appendChild(clone);
        updateWelcomeVisibility();
        scrollChatToBottom();
    };

    /* ======================================================================
       Thinking Indicator
       ====================================================================== */
    const showThinking = () => {
        els.thinkingIndicator.hidden = false;
        scrollChatToBottom();
    };

    const hideThinking = () => {
        els.thinkingIndicator.hidden = true;
    };

    /* ======================================================================
       Send Message & AI Request Flow (Rule 12: Title Generation)
       ====================================================================== */
    const sendMessage = async (rawPrompt) => {
        const text = (rawPrompt || els.messageInput.value).trim();
        const attachedDoc = state.activeDocument;

        if ((!text && !attachedDoc) || state.isSending || state.isUploading) return;

        const effectivePrompt = text || `Please summarize and analyze the attached document: ${attachedDoc.name}`;

        state.isSending = true;
        updateSendBtnState();

        // 1. Ensure an active conversation exists
        let activeConv = state.conversations.find(c => c.id === state.activeConversationId);
        let isFirstMessage = false;

        if (!activeConv) {
            isFirstMessage = true;
            const initialTitle = 'New Conversation';
            try {
                activeConv = await createConversation(state.currentUser.uid, initialTitle, []);
                state.conversations.unshift(activeConv);
                state.activeConversationId = activeConv.id;
                renderConversationSidebar();
            } catch (err) {
                console.error('[Chat] Failed to create conversation in Firestore:', err);
                activeConv = { id: 'local_' + Date.now(), title: initialTitle, messages: [] };
                state.conversations.unshift(activeConv);
                state.activeConversationId = activeConv.id;
            }
        }

        // 2. Add user message
        const userMsg = { 
            role: 'user', 
            content: effectivePrompt, 
            timestamp: Date.now(),
            attachedDoc: attachedDoc ? { id: attachedDoc.id, name: attachedDoc.name } : null
        };
        activeConv.messages.push(userMsg);
        appendUserMessage(effectivePrompt, userMsg.timestamp, attachedDoc);

        // Clear input field
        els.messageInput.value = '';
        autoResizeTextarea();

        // 3. Show thinking indicator
        showThinking();

        try {
            // 4. Obtain Firebase ID token
            const idToken = await getAuthToken();

            // 5. Call protected Express backend endpoint
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    messages: activeConv.messages.map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    documentId: attachedDoc ? attachedDoc.id : null,
                    options: state.settings
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned error status ${response.status}`);
            }

            const data = await response.json();
            hideThinking();

            if (!data.answer) {
                throw new Error('Received an empty response from Chatty AI.');
            }

            // 6. Record & Render AI Message
            const aiMsg = { 
                role: 'assistant', 
                content: data.answer, 
                timestamp: Date.now(),
                sources: data.sources || [],
                images: data.images || [],
                generatedImage: data.generatedImage || null,
                tool: data.tool || 'normal_chat',
                documentInfo: data.documentInfo || null
            };
            activeConv.messages.push(aiMsg);
            appendAIMessage(aiMsg.content, aiMsg.timestamp, aiMsg.sources, aiMsg.images, aiMsg.generatedImage, aiMsg.tool, aiMsg.documentInfo);

            // Update model badge
            if (data.model) {
                els.modelBadge.textContent = data.model;
            }

            // 7. Generate 2-5 word title on first message (Rule 12)
            if (isFirstMessage) {
                fetch('/api/conversations/title', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ prompt: effectivePrompt })
                })
                .then(r => r.json())
                .then(titleData => {
                    if (titleData.title) {
                        activeConv.title = titleData.title;
                        renderConversationSidebar();
                        renameConversation(state.currentUser.uid, activeConv.id, titleData.title).catch(() => {});
                    }
                })
                .catch(() => {});
            }

            // 8. Persist to Cloud Firestore
            saveConversation(state.currentUser.uid, activeConv.id, {
                messages: activeConv.messages,
                updatedAt: Date.now()
            }).catch(saveErr => {
                console.warn('[Firestore] Failed to save conversation update:', saveErr);
            });

        } catch (err) {
            hideThinking();
            console.error('[Chat] Messaging error:', err);
            appendAIMessage(`⚠️ **Error**: ${err.message || 'Failed to contact Chatty AI backend. Please verify your connection.'}`);
        } finally {
            state.isSending = false;
            updateSendBtnState();
            els.messageInput.focus();
        }
    };

    /* ======================================================================
       Regenerate Message Flow
       ====================================================================== */
    const handleRegenerate = async () => {
        if (state.isSending) return;
        const activeConv = state.conversations.find(c => c.id === state.activeConversationId);
        if (!activeConv || activeConv.messages.length === 0) return;

        // Remove last assistant message
        const lastMsg = activeConv.messages[activeConv.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
            activeConv.messages.pop();
            const aiRow = els.messagesList.querySelector('.message-row-ai:last-child');
            if (aiRow) aiRow.remove();
        }

        const lastUserPrompt = [...activeConv.messages].reverse().find(m => m.role === 'user');
        if (!lastUserPrompt) return;

        state.isSending = true;
        updateSendBtnState();
        showThinking();

        try {
            const idToken = await getAuthToken();
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    messages: activeConv.messages.map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    documentId: state.activeDocument ? state.activeDocument.id : null,
                    options: state.settings
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${response.status}`);
            }

            const data = await response.json();
            hideThinking();

            const aiMsg = { 
                role: 'assistant', 
                content: data.answer, 
                timestamp: Date.now(),
                sources: data.sources || [],
                images: data.images || [],
                generatedImage: data.generatedImage || null,
                tool: data.tool || 'normal_chat',
                documentInfo: data.documentInfo || null
            };
            activeConv.messages.push(aiMsg);
            appendAIMessage(aiMsg.content, aiMsg.timestamp, aiMsg.sources, aiMsg.images, aiMsg.generatedImage, aiMsg.tool, aiMsg.documentInfo);

            saveConversation(state.currentUser.uid, activeConv.id, {
                messages: activeConv.messages,
                updatedAt: Date.now()
            });

        } catch (err) {
            hideThinking();
            console.error('[Chat] Regenerate error:', err);
            appendAIMessage(`⚠️ **Error during regeneration**: ${err.message}`);
        } finally {
            state.isSending = false;
            updateSendBtnState();
        }
    };

    /* ======================================================================
       Conversation Management & Sidebar
       ====================================================================== */
    const startNewChat = () => {
        state.activeConversationId = null;
        setAttachedDocument(null);
        els.messagesList.innerHTML = '';
        updateWelcomeVisibility();
        renderConversationSidebar();
        closeMobileSidebar();
        els.messageInput.value = '';
        autoResizeTextarea();
        els.messageInput.focus();
    };

    const selectConversation = async (conversationId) => {
        if (state.activeConversationId === conversationId) {
            closeMobileSidebar();
            return;
        }

        state.activeConversationId = conversationId;
        renderConversationSidebar();
        closeMobileSidebar();

        els.messagesList.innerHTML = '';

        let conv = state.conversations.find(c => c.id === conversationId);
        
        if (!conv || !conv.messages || conv.messages.length === 0) {
            try {
                showThinking();
                const loaded = await loadConversation(state.currentUser.uid, conversationId);
                hideThinking();
                if (loaded) {
                    conv = loaded;
                    const idx = state.conversations.findIndex(c => c.id === conversationId);
                    if (idx !== -1) state.conversations[idx] = loaded;
                }
            } catch (err) {
                hideThinking();
                console.error('[Firestore] Failed to load individual conversation:', err);
            }
        }

        if (conv && conv.messages) {
            conv.messages.forEach(msg => {
                if (msg.role === 'user') {
                    appendUserMessage(msg.content, msg.timestamp, msg.attachedDoc);
                } else if (msg.role === 'assistant') {
                    appendAIMessage(msg.content, msg.timestamp, msg.sources, msg.images, msg.generatedImage, msg.tool, msg.documentInfo);
                }
            });
        }

        updateWelcomeVisibility();
        scrollChatToBottom(false);
    };

    const handleRenameConversation = async (conversationId, currentTitle) => {
        const newTitle = prompt('Rename conversation:', currentTitle);
        if (newTitle === null) return;
        const trimmed = newTitle.trim();
        if (!trimmed || trimmed === currentTitle) return;

        const conv = state.conversations.find(c => c.id === conversationId);
        if (conv) conv.title = trimmed;
        renderConversationSidebar();

        try {
            await renameConversation(state.currentUser.uid, conversationId, trimmed);
        } catch (err) {
            console.error('[Firestore] Failed to rename conversation:', err);
        }
    };

    const handleDeleteConversation = async (conversationId, title) => {
        const confirmed = confirm(`Are you sure you want to delete "${title || 'this conversation'}"?`);
        if (!confirmed) return;

        state.conversations = state.conversations.filter(c => c.id !== conversationId);

        if (state.activeConversationId === conversationId) {
            startNewChat();
        } else {
            renderConversationSidebar();
        }

        try {
            await deleteConversation(state.currentUser.uid, conversationId);
        } catch (err) {
            console.error('[Firestore] Failed to delete conversation:', err);
        }
    };

    const renderConversationSidebar = () => {
        els.conversationList.innerHTML = '';

        if (state.conversations.length === 0) {
            els.conversationsEmpty.hidden = false;
            return;
        }
        els.conversationsEmpty.hidden = true;

        state.conversations.forEach(conv => {
            const clone = els.convItemTemplate.content.cloneNode(true);
            const item = clone.querySelector('.conv-item');
            const link = clone.querySelector('.conv-link');
            const titleEl = clone.querySelector('.conv-title');
            const renameBtn = clone.querySelector('.btn-conv-rename');
            const deleteBtn = clone.querySelector('.btn-conv-delete');

            titleEl.textContent = conv.title || 'Untitled Chat';

            if (conv.id === state.activeConversationId) {
                item.classList.add('is-active');
            }

            link.addEventListener('click', () => selectConversation(conv.id));
            
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleRenameConversation(conv.id, conv.title);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteConversation(conv.id, conv.title);
            });

            els.conversationList.appendChild(clone);
        });
    };

    const filterConversations = (query) => {
        const q = (query || '').trim().toLowerCase();
        const items = els.conversationList.querySelectorAll('.conv-item');
        items.forEach(item => {
            const text = item.querySelector('.conv-title').textContent.toLowerCase();
            item.style.display = !q || text.includes(q) ? '' : 'none';
        });
    };

    /* ======================================================================
       Mobile Drawer & Overlay
       ====================================================================== */
    const openMobileSidebar = () => {
        els.sidebar.classList.add('is-open');
        els.sidebarOverlay.classList.add('is-visible');
    };

    const closeMobileSidebar = () => {
        els.sidebar.classList.remove('is-open');
        els.sidebarOverlay.classList.remove('is-visible');
    };

    const toggleMobileSidebar = () => {
        if (els.sidebar.classList.contains('is-open')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    };

    /* ======================================================================
       Profile Menu & Theme
       ====================================================================== */
    const toggleProfileDropdown = () => {
        const isHidden = els.profileDropdown.hidden;
        els.profileDropdown.hidden = !isHidden;
        els.userProfileBtn.setAttribute('aria-expanded', String(isHidden));
    };

    const closeProfileDropdown = () => {
        els.profileDropdown.hidden = true;
        els.userProfileBtn.setAttribute('aria-expanded', 'false');
    };

    const toggleTheme = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        state.theme = newTheme;
        state.settings.theme = newTheme;
        try { localStorage.setItem('chatty_settings', JSON.stringify(state.settings)); } catch (e) {}
        els.themeToggleLabel.textContent = newTheme === 'dark' ? 'Light Theme' : 'Dark Theme';
    };

    /* ======================================================================
       Event Wiring
       ====================================================================== */
    const bindEvents = () => {
        // Form submit
        els.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });

        // Textarea auto-resize
        els.messageInput.addEventListener('input', autoResizeTextarea);

        // Enter sends, Shift+Enter newlines
        els.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!els.sendBtn.disabled) {
                    sendMessage();
                }
            }
        });

        // Document attachment input
        els.attachmentBtn.addEventListener('click', () => {
            els.docFileInput.click();
        });

        els.docFileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                handleFileUpload(file);
            }
        });

        // Remove attached document
        els.removeDocBtn.addEventListener('click', () => {
            setAttachedDocument(null);
        });

        // Voice typing button (Rule 21)
        els.voiceBtn.addEventListener('click', toggleVoiceRecognition);

        // Settings Modal events (Rule 28 & Rules 33-49)
        els.settingsOpenBtn.addEventListener('click', () => openSettingsModal('appearance'));
        els.headerSettingsBtn.addEventListener('click', () => openSettingsModal('appearance'));
        els.settingsCloseBtn.addEventListener('click', closeSettingsModal);
        els.settingsSaveBtn.addEventListener('click', saveSettings);

        // Bind settings tab navigation
        bindSettingsTabs();

        // Report an Issue — via profile dropdown shortcut
        if (els.dropdownReportBtn) {
            els.dropdownReportBtn.addEventListener('click', () => openSettingsModal('support'));
        }

        // Report an Issue — form submit
        if (els.reportForm) {
            els.reportForm.addEventListener('submit', submitIssueReport);
        }

        // New chat button
        els.newChatBtn.addEventListener('click', startNewChat);


        // Clear chat view button
        els.clearChatBtn.addEventListener('click', () => {
            if (confirm('Clear the current messages view?')) {
                startNewChat();
            }
        });

        // Search input
        els.searchInput.addEventListener('input', (e) => filterConversations(e.target.value));

        // Suggestion cards
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const promptText = card.dataset.prompt;
                if (promptText) {
                    els.messageInput.value = promptText;
                    autoResizeTextarea();
                    sendMessage(promptText);
                }
            });
        });

        // Mobile drawer controls
        els.sidebarToggle.addEventListener('click', toggleMobileSidebar);
        els.sidebarOverlay.addEventListener('click', closeMobileSidebar);

        // User profile menu
        els.userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleProfileDropdown();
        });

        document.addEventListener('click', (e) => {
            if (!els.userProfileBtn.contains(e.target) && !els.profileDropdown.contains(e.target)) {
                closeProfileDropdown();
            }
            if (els.settingsModal && e.target === els.settingsModal) {
                closeSettingsModal();
            }
        });

        // Sign Out
        els.signoutBtn.addEventListener('click', () => signOutUser());

        // Theme toggle
        els.themeToggleBtn.addEventListener('click', toggleTheme);

        // Close on window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                closeMobileSidebar();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMobileSidebar();
                closeProfileDropdown();
                closeSettingsModal();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                startNewChat();
            }
        });
    };

    /* ======================================================================
       Initialization & Auth Guard
       ====================================================================== */
    const initApp = async (user) => {
        state.currentUser = user;

        const name = user.displayName || user.email.split('@')[0] || 'User';
        const email = user.email || '';
        const initials = name.charAt(0).toUpperCase();

        els.userDisplayName.textContent = name;
        els.userDisplayEmail.textContent = email;
        els.dropdownUserName.textContent = name;
        els.dropdownUserEmail.textContent = email;
        els.userAvatarInitials.textContent = initials;

        loadSavedSettings();
        initVoiceRecognition();
        updateWelcomeGreeting();
        bindEvents();
        autoResizeTextarea();
        updateSendBtnState();

        try {
            const userConversations = await loadUserConversations(user.uid);
            state.conversations = userConversations;
            renderConversationSidebar();
        } catch (err) {
            console.error('[Init] Error loading conversations:', err);
        }

        els.authLoadingOverlay.style.display = 'none';
        els.app.style.display = 'flex';
        els.messageInput.focus();

        console.log(`%c[Chatty AI] Authenticated as ${email}. Application ready.`, 'color:#00f0ff;font-weight:bold;');
    };

    // Route Guard: Blocks unauthenticated users and initializes with authenticated user
    requireAuth(initApp);

})();
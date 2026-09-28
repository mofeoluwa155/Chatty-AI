/**
 * Chatty AI — Pollinations Image Provider Adapter
 * Created by Akintayo Mofeoluwa Richard
 *
 * Uses Pollinations API (https://gen.pollinations.ai).
 * Endpoint: https://gen.pollinations.ai/image/{prompt}?model={model}
 * Supports Bearer authentication via POLLINATIONS_API_KEY.
 *
 * Standardized Default Model: black-forest-labs/flux.1-schnell
 * Docs: https://gen.pollinations.ai/docs
 */

const https = require('https');
const http = require('http');

class PollinationsProvider {
    constructor() {
        this.name = 'pollinations';
        this.defaultModel = process.env.IMAGE_GEN_MODEL || 'black-forest-labs/flux.1-schnell';
        this.apiKey = process.env.POLLINATIONS_API_KEY || null;
        this.timeoutMs = parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || '60000', 10);
        this.maxRetries = parseInt(process.env.IMAGE_GEN_MAX_RETRIES || '1', 10);
        this.maxPromptLength = parseInt(process.env.IMAGE_GEN_MAX_PROMPT_LENGTH || '4000', 10);
    }

    /**
     * Checks if Pollinations provider is configured.
     * Pollinations supports generation both with key (authenticated) and public fallback.
     */
    isConfigured() {
        return Boolean(this.apiKey && this.apiKey.length > 0 && this.apiKey !== 'YOUR_POLLINATIONS_API_KEY_HERE');
    }

    /**
     * Validates prompt server-side.
     */
    validatePrompt(prompt) {
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return {
                valid: false,
                errorCode: 'IMAGE_PROMPT_INVALID',
                errorMessage: 'Image generation prompt cannot be empty.'
            };
        }

        const clean = prompt.trim();
        if (clean.length > this.maxPromptLength) {
            return {
                valid: false,
                errorCode: 'IMAGE_PROMPT_INVALID',
                errorMessage: `Image prompt length (${clean.length} chars) exceeds maximum allowed length of ${this.maxPromptLength} chars.`
            };
        }

        return { valid: true, cleanPrompt: clean };
    }

    /**
     * Fetches the dynamic model catalogue from Pollinations API (GET /v1/models).
     * @returns {Promise<Array<string>>}
     */
    fetchAvailableModels() {
        return new Promise((resolve) => {
            const requestOptions = {
                hostname: 'gen.pollinations.ai',
                path: '/v1/models',
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                timeout: 10000
            };

            if (this.apiKey && this.apiKey !== 'YOUR_POLLINATIONS_API_KEY_HERE') {
                requestOptions.headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed)) {
                            const models = parsed.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
                            return resolve(models);
                        } else if (parsed && Array.isArray(parsed.data)) {
                            const models = parsed.data.map(m => m.id || m.name).filter(Boolean);
                            return resolve(models);
                        }
                        resolve([this.defaultModel, 'flux']);
                    } catch {
                        resolve([this.defaultModel, 'flux']);
                    }
                });
            });

            req.on('error', () => resolve([this.defaultModel, 'flux']));
            req.on('timeout', () => { req.destroy(); resolve([this.defaultModel, 'flux']); });
            req.end();
        });
    }

    /**
     * Generates an image using Pollinations API.
     */
    async generateImage({ prompt, options = {} }) {
        const validation = this.validatePrompt(prompt);
        if (!validation.valid) {
            return {
                success: false,
                provider: this.name,
                error: {
                    code: validation.errorCode,
                    message: validation.errorMessage
                }
            };
        }

        const cleanPrompt = validation.cleanPrompt;
        const model = options.model || this.defaultModel;
        const width = options.width || 1024;
        const height = options.height || 1024;
        const seed = options.seed || Math.floor(Math.random() * 1000000);

        let attempt = 0;
        let lastError = null;

        while (attempt <= this.maxRetries) {
            try {
                const result = await this._executeRequest(cleanPrompt, model, width, height, seed);
                return result;
            } catch (err) {
                lastError = err;
                console.warn(`[PollinationsProvider] Attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${err.message}`);

                // Don't retry client/auth/quota errors
                if (['IMAGE_PROVIDER_AUTH_FAILED', 'IMAGE_PROVIDER_RATE_LIMITED', 'IMAGE_PROMPT_INVALID'].includes(err.code)) {
                    break;
                }
                attempt++;
            }
        }

        return {
            success: false,
            provider: this.name,
            error: {
                code: lastError?.code || 'IMAGE_GENERATION_FAILED',
                message: lastError?.message || 'Image generation request failed.'
            }
        };
    }

    /**
     * Executes single HTTP/HTTPS fetch to Pollinations API.
     */
    _executeRequest(prompt, model, width, height, seed) {
        return new Promise((resolve, reject) => {
            const encodedPrompt = encodeURIComponent(prompt);
            const pathUrl = `/image/${encodedPrompt}?model=${encodeURIComponent(model)}&width=${width}&height=${height}&seed=${seed}&nologo=true`;

            const requestOptions = {
                hostname: 'gen.pollinations.ai',
                path: pathUrl,
                method: 'GET',
                headers: {
                    'Accept': 'image/*,application/json'
                },
                timeout: this.timeoutMs
            };

            if (this.apiKey && this.apiKey !== 'YOUR_POLLINATIONS_API_KEY_HERE') {
                requestOptions.headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const req = https.request(requestOptions, (res) => {
                const statusCode = res.statusCode;

                // Handle Redirects (301, 302, 303, 307, 308)
                if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
                    return resolve({
                        success: true,
                        type: 'image',
                        provider: this.name,
                        imageUrl: res.headers.location,
                        mimeType: 'image/jpeg',
                        metadata: {
                            model,
                            prompt,
                            provider: this.name,
                            redirectUrl: res.headers.location
                        }
                    });
                }

                // Authentication Failure
                if (statusCode === 401 || statusCode === 403) {
                    const err = new Error(`Pollinations API authentication failed (HTTP ${statusCode}). Please check POLLINATIONS_API_KEY.`);
                    err.code = 'IMAGE_PROVIDER_AUTH_FAILED';
                    return reject(err);
                }

                // Rate Limit / Quota Exceeded
                if (statusCode === 429) {
                    const err = new Error('Pollinations rate limit or quota exceeded. Please try again later.');
                    err.code = 'IMAGE_PROVIDER_RATE_LIMITED';
                    return reject(err);
                }

                // Server Unavailable / Bad Gateway
                if (statusCode >= 500) {
                    const err = new Error(`Pollinations server unavailable (HTTP ${statusCode}).`);
                    err.code = 'IMAGE_PROVIDER_UNAVAILABLE';
                    return reject(err);
                }

                if (statusCode !== 200) {
                    const err = new Error(`Pollinations returned unexpected status HTTP ${statusCode}.`);
                    err.code = 'IMAGE_PROVIDER_BAD_RESPONSE';
                    return reject(err);
                }

                const contentType = res.headers['content-type'] || 'image/png';

                // If response returned JSON error payload
                if (contentType.includes('application/json')) {
                    let jsonText = '';
                    res.on('data', chunk => jsonText += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(jsonText);
                            const err = new Error(parsed.error || parsed.message || 'Pollinations returned an error response.');
                            err.code = 'IMAGE_PROVIDER_BAD_RESPONSE';
                            reject(err);
                        } catch {
                            const err = new Error('Failed to parse Pollinations JSON error response.');
                            err.code = 'IMAGE_PROVIDER_BAD_RESPONSE';
                            reject(err);
                        }
                    });
                    return;
                }

                // Image Binary Payload — convert to base64 Data URL
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    try {
                        const buffer = Buffer.concat(chunks);
                        if (buffer.length === 0) {
                            const err = new Error('Pollinations returned empty image payload (0 bytes).');
                            err.code = 'IMAGE_PROVIDER_BAD_RESPONSE';
                            return reject(err);
                        }

                        const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
                        resolve({
                            success: true,
                            type: 'image',
                            provider: this.name,
                            imageUrl: dataUrl,
                            mimeType: contentType,
                            metadata: {
                                model,
                                prompt,
                                provider: this.name,
                                bytes: buffer.length
                            }
                        });
                    } catch (err) {
                        const parseErr = new Error(`Failed to process image buffer: ${err.message}`);
                        parseErr.code = 'IMAGE_PROVIDER_BAD_RESPONSE';
                        reject(parseErr);
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                const err = new Error(`Image generation timed out after ${this.timeoutMs}ms.`);
                err.code = 'IMAGE_PROVIDER_TIMEOUT';
                reject(err);
            });

            req.on('error', (err) => {
                const reqErr = new Error(`Network error contacting Pollinations: ${err.message}`);
                reqErr.code = 'IMAGE_PROVIDER_UNAVAILABLE';
                reject(reqErr);
            });

            req.end();
        });
    }
}

module.exports = new PollinationsProvider();

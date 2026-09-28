/**
 * Chatty AI — Image Generation Service (Provider Architecture)
 * Created by Akintayo Mofeoluwa Richard
 *
 * Generic Image Generation Service Facade.
 * Delegates image creation requests to provider adapters (e.g. Pollinations).
 *
 * Supported Provider: Pollinations (https://gen.pollinations.ai)
 * Provider Adapter: services/imageProviders/pollinationsProvider.js
 */

const pollinationsProvider = require('./imageProviders/pollinationsProvider');

class ImageGenerationService {
    constructor() {
        this.providerName = (process.env.IMAGE_GEN_PROVIDER || 'pollinations').toLowerCase();
        this.model = process.env.IMAGE_GEN_MODEL || 'black-forest-labs/flux.1-schnell';
        this.rateLimitMax = parseInt(process.env.IMAGE_GEN_RATE_LIMIT || '5', 10);
        this.userRateLimits = new Map(); // userId -> timestamps array

        // Registry of supported provider adapters
        this.providers = {
            pollinations: pollinationsProvider
        };
    }

    /**
     * Returns active provider adapter based on IMAGE_GEN_PROVIDER.
     */
    getProvider() {
        return this.providers[this.providerName] || null;
    }

    /**
     * Discovers available models from active provider catalogue.
     */
    async getAvailableModels() {
        const provider = this.getProvider();
        if (provider && typeof provider.fetchAvailableModels === 'function') {
            return await provider.fetchAvailableModels();
        }
        return [this.model, 'black-forest-labs/flux.1-schnell', 'flux'];
    }

    /**
     * Checks if active image generation provider is available & configured.
     */
    isAvailable() {
        const provider = this.getProvider();
        if (!provider) return false;
        return provider.isConfigured();
    }

    /**
     * Internal server-side per-user rate limit check.
     */
    _checkUserRateLimit(userId) {
        if (!userId) return { allowed: true };
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute sliding window

        let userHistory = this.userRateLimits.get(userId) || [];
        userHistory = userHistory.filter(ts => now - ts < windowMs);

        if (userHistory.length >= this.rateLimitMax) {
            return {
                allowed: false,
                reason: `Rate limit of ${this.rateLimitMax} image generations per minute reached.`
            };
        }

        userHistory.push(now);
        this.userRateLimits.set(userId, userHistory);
        return { allowed: true };
    }

    /**
     * Core normalized image generation function.
     * @param {object|string} params - Parameters object { prompt, userId, options } or prompt string
     * @param {object} [extraOptions] - Additional options if first arg is prompt string
     * @returns {Promise<{ success: boolean, available: boolean, type: string, provider: string, imageUrl?: string, mimeType?: string, model?: string, prompt?: string, metadata?: object, error?: object|string, reason?: string }>}
     */
    async generateImage(params, extraOptions = {}) {
        let prompt = '';
        let userId = 'anonymous';
        let options = {};

        if (typeof params === 'string') {
            prompt = params;
            options = extraOptions || {};
        } else if (params && typeof params === 'object') {
            prompt = params.prompt || '';
            userId = params.userId || 'anonymous';
            options = params.options || {};
        }

        // Rate limit check
        const rateCheck = this._checkUserRateLimit(userId);
        if (!rateCheck.allowed) {
            return {
                success: false,
                available: true,
                type: 'image',
                provider: this.providerName,
                error: {
                    code: 'IMAGE_PROVIDER_RATE_LIMITED',
                    message: rateCheck.reason
                },
                reason: rateCheck.reason
            };
        }

        const provider = this.getProvider();
        if (!provider) {
            return {
                success: false,
                available: false,
                type: 'image',
                provider: this.providerName,
                error: {
                    code: 'IMAGE_PROVIDER_UNSUPPORTED',
                    message: `Unsupported image provider "${this.providerName}". Supported providers: ${Object.keys(this.providers).join(', ')}.`
                },
                reason: `Unsupported image provider "${this.providerName}".`
            };
        }

        if (!this.isAvailable()) {
            return {
                success: false,
                available: false,
                type: 'image',
                provider: this.providerName,
                error: {
                    code: 'IMAGE_PROVIDER_NOT_CONFIGURED',
                    message: `Image provider "${this.providerName}" is not configured on the server. Please set POLLINATIONS_API_KEY in your .env file.`
                },
                reason: `Image provider "${this.providerName}" is not configured. Set POLLINATIONS_API_KEY in .env.`
            };
        }

        try {
            const result = await provider.generateImage({ prompt, options: { model: this.model, ...options } });
            if (result.success) {
                return {
                    success: true,
                    available: true,
                    type: 'image',
                    provider: result.provider,
                    imageUrl: result.imageUrl,
                    mimeType: result.mimeType || 'image/png',
                    model: result.metadata?.model || this.model,
                    prompt: prompt,
                    metadata: result.metadata || {}
                };
            } else {
                return {
                    success: false,
                    available: true,
                    type: 'image',
                    provider: result.provider || this.providerName,
                    error: result.error,
                    reason: result.error?.message || 'Image generation failed.'
                };
            }
        } catch (err) {
            console.error('[ImageGenerationService] Provider execution error:', err.message);
            return {
                success: false,
                available: true,
                type: 'image',
                provider: this.providerName,
                error: {
                    code: 'IMAGE_GENERATION_FAILED',
                    message: `Image generation failed: ${err.message}`
                },
                reason: err.message
            };
        }
    }

    /**
     * Backward-compatible alias wrapper for generate()
     */
    async generate(prompt, options = {}) {
        return this.generateImage(prompt, options);
    }
}

module.exports = new ImageGenerationService();

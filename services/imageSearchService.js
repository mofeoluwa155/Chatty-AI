/**
 * Chatty AI — Image Search Service
 * Created by Akintayo Mofeoluwa Richard
 *
 * Supports providers:
 *   - Pexels API            (IMAGE_SEARCH_PROVIDER=pexels, PEXELS_API_KEY=... or IMAGE_SEARCH_API_KEY=...)
 *   - Brave Image Search API(IMAGE_SEARCH_PROVIDER=brave, SEARCH_API_KEY=...)
 *   - SerpAPI Google Images (IMAGE_SEARCH_PROVIDER=serpapi, IMAGE_SEARCH_API_KEY=...)
 *   - Unsplash Search API   (IMAGE_SEARCH_PROVIDER=unsplash, IMAGE_SEARCH_API_KEY=...)
 *
 * Falls back gracefully when no provider or key is configured.
 * API keys remain backend-only. Never fabricates image URLs.
 */

const https = require('https');

class ImageSearchService {
    constructor() {
        this.apiKey = process.env.PEXELS_API_KEY || process.env.IMAGE_SEARCH_API_KEY || process.env.SEARCH_API_KEY || null;
        this.provider = (process.env.IMAGE_SEARCH_PROVIDER || (process.env.PEXELS_API_KEY ? 'pexels' : 'brave')).toLowerCase();
        this.maxResults = parseInt(process.env.IMAGE_SEARCH_MAX_RESULTS || '6', 10);
    }

    /**
     * Checks if a real image search provider is configured.
     */
    isAvailable() {
        return Boolean(this.apiKey && this.apiKey.length > 0 && !this.apiKey.includes('YOUR_'));
    }

    /**
     * Executes real image search and returns structured results.
     * @param {string} query - The search query string
     * @returns {Promise<{ available: boolean, results: Array<{title, url, thumbnail, source, domain}>, error?: string }>}
     */
    async search(query) {
        if (!query || !query.trim()) {
            return { available: false, results: [], error: 'Empty query provided.' };
        }

        if (!this.isAvailable()) {
            return {
                available: false,
                results: [],
                error: 'Image search is not configured on the server. Please set PEXELS_API_KEY or IMAGE_SEARCH_API_KEY in .env.'
            };
        }

        try {
            let results = [];
            if (this.provider === 'pexels') {
                results = await this._pexelsImageSearch(query.trim());
            } else if (this.provider === 'brave') {
                results = await this._braveImageSearch(query.trim());
            } else if (this.provider === 'serpapi') {
                results = await this._serpApiImageSearch(query.trim());
            } else if (this.provider === 'unsplash') {
                results = await this._unsplashSearch(query.trim());
            } else {
                results = await this._pexelsImageSearch(query.trim());
            }

            return {
                available: true,
                results: results.slice(0, this.maxResults),
                provider: this.provider
            };
        } catch (err) {
            console.error('[ImageSearchService] Error during image search:', err.message);
            return {
                available: true,
                results: [],
                error: `Image search provider error: ${err.message}`
            };
        }
    }

    /**
     * Alias method for search()
     */
    async searchImages(query) {
        return this.search(query);
    }

    /**
     * Pexels Image Search API integration.
     * Docs: https://www.pexels.com/api/documentation/
     */
    _pexelsImageSearch(query) {
        return new Promise((resolve) => {
            const encoded = encodeURIComponent(query);
            const options = {
                hostname: 'api.pexels.com',
                path: `/v1/search?query=${encoded}&per_page=${this.maxResults}`,
                method: 'GET',
                headers: {
                    'Authorization': this.apiKey
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            console.warn(`[ImageSearchService] Pexels returned status ${res.statusCode}`);
                            return resolve([]);
                        }
                        const parsed = JSON.parse(data);
                        const items = (parsed.photos || []).map(photo => ({
                            title: photo.alt || query || 'Photo',
                            url: photo.src?.large || photo.src?.original || photo.url || '',
                            thumbnail: photo.src?.medium || photo.src?.small || photo.src?.tiny || '',
                            source: `Photo by ${photo.photographer || 'Pexels'}`,
                            domain: 'pexels.com'
                        })).filter(img => img.url && img.thumbnail);
                        resolve(items);
                    } catch (e) {
                        console.error('[ImageSearchService] Pexels parse error:', e.message);
                        resolve([]);
                    }
                });
            });

            req.on('error', (err) => {
                console.error('[ImageSearchService] Pexels request error:', err.message);
                resolve([]);
            });

            req.end();
        });
    }

    /**
     * Brave Images Search API integration.
     * Docs: https://api.search.brave.com/app/documentation/web-search/get-started
     */
    _braveImageSearch(query) {
        return new Promise((resolve) => {
            const encoded = encodeURIComponent(query);
            const options = {
                hostname: 'api.search.brave.com',
                path: `/res/v1/images/search?q=${encoded}&count=${this.maxResults}&safesearch=moderate`,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'X-Subscription-Token': this.apiKey
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            console.warn(`[ImageSearchService] Brave returned status ${res.statusCode}`);
                            return resolve([]);
                        }
                        const parsed = JSON.parse(data);
                        const items = (parsed.results || []).map(item => ({
                            title: item.title || 'Image',
                            url: item.url || item.properties?.url || '',
                            thumbnail: item.thumbnail?.src || item.url || '',
                            source: item.source || item.properties?.domain || 'Web',
                            domain: this._extractDomain(item.url || item.source || '')
                        })).filter(img => img.url && img.thumbnail);
                        resolve(items);
                    } catch (e) {
                        console.error('[ImageSearchService] Parse error:', e.message);
                        resolve([]);
                    }
                });
            });

            req.on('error', (err) => {
                console.error('[ImageSearchService] Request error:', err.message);
                resolve([]);
            });

            req.end();
        });
    }

    /**
     * SerpApi Google Images integration.
     */
    _serpApiImageSearch(query) {
        return new Promise((resolve) => {
            const encoded = encodeURIComponent(query);
            const options = {
                hostname: 'serpapi.com',
                path: `/search.json?engine=google_images&q=${encoded}&num=${this.maxResults}&api_key=${this.apiKey}`,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            return resolve([]);
                        }
                        const parsed = JSON.parse(data);
                        const items = (parsed.images_results || []).map(item => ({
                            title: item.title || 'Image',
                            url: item.original || item.link || '',
                            thumbnail: item.thumbnail || item.original || '',
                            source: item.source || item.domain || 'Google Images',
                            domain: this._extractDomain(item.link || item.source || '')
                        })).filter(img => img.url && img.thumbnail);
                        resolve(items);
                    } catch (e) {
                        resolve([]);
                    }
                });
            });

            req.on('error', () => resolve([]));
            req.end();
        });
    }

    /**
     * Unsplash Search API integration.
     */
    _unsplashSearch(query) {
        return new Promise((resolve) => {
            const encoded = encodeURIComponent(query);
            const options = {
                hostname: 'api.unsplash.com',
                path: `/search/photos?query=${encoded}&per_page=${this.maxResults}&client_id=${this.apiKey}`,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) return resolve([]);
                        const parsed = JSON.parse(data);
                        const items = (parsed.results || []).map(item => ({
                            title: item.alt_description || item.description || 'Unsplash Photo',
                            url: item.urls?.regular || item.urls?.full || '',
                            thumbnail: item.urls?.small || item.urls?.thumb || '',
                            source: `Photo by ${item.user?.name || 'Unsplash'}`,
                            domain: 'unsplash.com'
                        })).filter(img => img.url && img.thumbnail);
                        resolve(items);
                    } catch (e) {
                        resolve([]);
                    }
                });
            });

            req.on('error', () => resolve([]));
            req.end();
        });
    }

    _extractDomain(urlStr) {
        try {
            return new URL(urlStr).hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    }
}

module.exports = new ImageSearchService();

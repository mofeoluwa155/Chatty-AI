/**
 * Chatty AI — Web Search Service
 * Created by Akintayo Mofeoluwa Richard
 *
 * Supports providers:
 *   - Tavily Search API (SEARCH_PROVIDER=tavily, SEARCH_API_KEY=... or TAVILY_API_KEY=...)
 *   - Brave Search API  (SEARCH_PROVIDER=brave, SEARCH_API_KEY=...)
 *   - SerpAPI           (SEARCH_PROVIDER=serpapi, SEARCH_API_KEY=...)
 *
 * Falls back gracefully with { available: false } if no provider is configured.
 * API keys never leave this file — never returned to client.
 */

const https = require('https');

class SearchService {
    constructor() {
        this.apiKey = process.env.TAVILY_API_KEY || process.env.SEARCH_API_KEY || null;
        this.provider = (process.env.SEARCH_PROVIDER || (process.env.TAVILY_API_KEY ? 'tavily' : 'brave')).toLowerCase();
        this.maxResults = parseInt(process.env.SEARCH_MAX_RESULTS || '5', 10);
    }

    /**
     * Returns whether a real search provider is configured.
     */
    isAvailable() {
        return Boolean(this.apiKey && this.apiKey.length > 0 && !this.apiKey.includes('YOUR_'));
    }

    /**
     * Performs a web search and returns an array of source objects.
     * @param {string} query - The search query string
     * @returns {Promise<Array<{ title, url, domain, snippet }>>}
     */
    async search(query) {
        if (!query || !query.trim()) return [];

        if (!this.isAvailable()) {
            console.warn('[SearchService] No search provider configured. Returning empty results.');
            return [];
        }

        try {
            if (this.provider === 'tavily') {
                return await this._tavilySearch(query.trim());
            } else if (this.provider === 'brave') {
                return await this._braveSearch(query.trim());
            } else if (this.provider === 'serpapi') {
                return await this._serpApiSearch(query.trim());
            } else {
                // If unknown provider, try Tavily first if key present, else Brave
                return await this._tavilySearch(query.trim());
            }
        } catch (err) {
            console.error('[SearchService] Search failed:', err.message);
            return []; // Fail gracefully — never crash the chat endpoint
        }
    }

    /**
     * Tavily Search API integration.
     * Docs: https://docs.tavily.com/
     */
    _tavilySearch(query) {
        return new Promise((resolve) => {
            const postData = JSON.stringify({
                api_key: this.apiKey,
                query: query,
                max_results: this.maxResults,
                search_depth: 'basic',
                include_answer: false
            });

            const options = {
                hostname: 'api.tavily.com',
                path: '/search',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            console.warn(`[SearchService] Tavily returned HTTP ${res.statusCode}`);
                            return resolve([]);
                        }
                        const parsed = JSON.parse(data);
                        const results = (parsed.results || []).map(item => ({
                            title: item.title || '',
                            url: item.url || '',
                            domain: this._extractDomain(item.url || ''),
                            snippet: item.content || item.snippet || ''
                        })).filter(r => r.url && r.title);
                        resolve(results);
                    } catch (e) {
                        console.error('[SearchService] Tavily parse error:', e.message);
                        resolve([]);
                    }
                });
            });

            req.on('error', (err) => {
                console.error('[SearchService] Tavily request error:', err.message);
                resolve([]);
            });

            req.write(postData);
            req.end();
        });
    }

    /**
     * Brave Search API integration.
     * Docs: https://api.search.brave.com/app/documentation/web-search/get-started
     */
    _braveSearch(query) {
        return new Promise((resolve) => {
            const encodedQuery = encodeURIComponent(query);
            const options = {
                hostname: 'api.search.brave.com',
                path: `/res/v1/web/search?q=${encodedQuery}&count=${this.maxResults}&text_decorations=false&safesearch=moderate`,
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
                            console.warn(`[SearchService] Brave Search returned HTTP ${res.statusCode}`);
                            return resolve([]);
                        }
                        const parsed = JSON.parse(data);
                        const results = (parsed.web?.results || []).map(item => ({
                            title: item.title || '',
                            url: item.url || '',
                            domain: this._extractDomain(item.url || ''),
                            snippet: item.description || ''
                        })).filter(r => r.url && r.title);
                        resolve(results);
                    } catch (e) {
                        console.error('[SearchService] Brave parse error:', e.message);
                        resolve([]);
                    }
                });
            });

            req.on('error', (err) => {
                console.error('[SearchService] Brave request error:', err.message);
                resolve([]);
            });

            req.end();
        });
    }

    /**
     * SerpAPI integration.
     * Docs: https://serpapi.com/search-api
     */
    _serpApiSearch(query) {
        return new Promise((resolve) => {
            const encodedQuery = encodeURIComponent(query);
            const options = {
                hostname: 'serpapi.com',
                path: `/search.json?q=${encodedQuery}&num=${this.maxResults}&api_key=${this.apiKey}&engine=google`,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            console.warn(`[SearchService] SerpAPI returned HTTP ${res.statusCode}`);
                            return resolve([]);
                        }
                        const parsed = JSON.parse(data);
                        const results = (parsed.organic_results || []).map(item => ({
                            title: item.title || '',
                            url: item.link || '',
                            domain: this._extractDomain(item.link || ''),
                            snippet: item.snippet || ''
                        })).filter(r => r.url && r.title).slice(0, this.maxResults);
                        resolve(results);
                    } catch (e) {
                        console.error('[SearchService] SerpAPI parse error:', e.message);
                        resolve([]);
                    }
                });
            });

            req.on('error', (err) => {
                console.error('[SearchService] SerpAPI request error:', err.message);
                resolve([]);
            });

            req.end();
        });
    }

    /**
     * Extracts domain from a URL string.
     */
    _extractDomain(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    }
}

module.exports = new SearchService();

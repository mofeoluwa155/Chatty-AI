'use strict';

module.exports = function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
        status: 'online',
        app: 'MathAI',
        aiConfigured: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || 'gpt-6.1-sol',
        mathsEngines: ['mathjs', 'nerdamer']
    });
};

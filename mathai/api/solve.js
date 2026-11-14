'use strict';

const { runMathTool } = require('../lib/math-tools');

const TOOL_DEFINITIONS = [
    {
        type: 'function',
        name: 'calculate',
        description: 'Evaluate a numeric arithmetic or mathematical expression. Use for arithmetic, fractions, percentages, trigonometric calculations, powers and roots.',
        parameters: {
            type: 'object',
            properties: { expression: { type: 'string' } },
            required: ['expression'],
            additionalProperties: false
        },
        strict: true
    },
    {
        type: 'function',
        name: 'simplify',
        description: 'Simplify an algebraic expression symbolically.',
        parameters: {
            type: 'object',
            properties: { expression: { type: 'string' } },
            required: ['expression'],
            additionalProperties: false
        },
        strict: true
    },
    {
        type: 'function',
        name: 'solve_equation',
        description: 'Solve an algebraic equation for one variable, such as x^2-5*x+6=0.',
        parameters: {
            type: 'object',
            properties: {
                equation: { type: 'string' },
                variable: { type: 'string' }
            },
            required: ['equation', 'variable'],
            additionalProperties: false
        },
        strict: true
    },
    {
        type: 'function',
        name: 'differentiate',
        description: 'Find the symbolic derivative of an expression with respect to a one-letter variable.',
        parameters: {
            type: 'object',
            properties: { expression: { type: 'string' }, variable: { type: 'string' } },
            required: ['expression', 'variable'],
            additionalProperties: false
        },
        strict: true
    },
    {
        type: 'function',
        name: 'integrate',
        description: 'Find the symbolic indefinite integral of an expression with respect to a one-letter variable.',
        parameters: {
            type: 'object',
            properties: { expression: { type: 'string' }, variable: { type: 'string' } },
            required: ['expression', 'variable'],
            additionalProperties: false
        },
        strict: true
    },
    {
        type: 'function',
        name: 'statistics',
        description: 'Calculate a statistical measure from a list of numerical data.',
        parameters: {
            type: 'object',
            properties: {
                values: { type: 'array', items: { type: 'number' } },
                operation: {
                    type: 'string',
                    enum: ['mean', 'median', 'mode', 'minimum', 'maximum', 'range', 'population_standard_deviation', 'sample_standard_deviation']
                }
            },
            required: ['values', 'operation'],
            additionalProperties: false
        },
        strict: true
    }
];

const SYSTEM_INSTRUCTIONS = [
    'You are MathAI, a rigorous and friendly mathematics tutor for learners from primary school to university.',
    'Your scope includes arithmetic, fractions, decimals, percentages, ratio, proportion, number, algebra, equations, inequalities, functions, sequences, geometry, measurement, Pythagoras, trigonometry, statistics, probability, graphs, vectors, matrices, differentiation, integration, limits, and other standard mathematics topics.',
    'Identify what the question asks and adapt to the selected learner level.',
    'In step-by-step mode, show numbered mathematical steps and explain why each important step is valid.',
    'In hint mode, give a useful first hint without revealing the full solution unless asked.',
    'In check-my-working mode, identify what is correct, find the first incorrect step, and explain how to fix it.',
    'Include units and state assumptions where needed. End a full solution with a clearly labelled final answer.',
    'Use mathematical tools for non-trivial computations whenever they apply. Do not claim a result was tool-verified unless a tool result supports it.',
    'If a tool fails or cannot handle the problem, say so and solve carefully without fabricating a tool result.',
    'Do not invent missing measurements, diagram details or exam-board rules.',
    'Do not reveal private chain-of-thought. Show concise educational working and conclusions.',
    'Use readable Markdown and LaTeX delimiters where helpful.'
].join('\n');

const memoryRateLimits = new Map();

function rateLimit(ip) {
    const now = Date.now();
    const recent = (memoryRateLimits.get(ip) || []).filter(function (time) {
        return now - time < 60000;
    });
    if (recent.length >= 12) return false;
    recent.push(now);
    memoryRateLimits.set(ip, recent);
    return true;
}

function extractText(response) {
    if (typeof response.output_text === 'string' && response.output_text.trim()) {
        return response.output_text.trim();
    }
    const chunks = [];
    for (const item of response.output || []) {
        if (item.type === 'message') {
            for (const part of item.content || []) {
                if (part.type === 'output_text' && part.text) chunks.push(part.text);
            }
        }
    }
    return chunks.join('\n').trim();
}

async function callModel(input) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-6.1-sol';
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            instructions: SYSTEM_INSTRUCTIONS,
            input: input,
            tools: TOOL_DEFINITIONS,
            tool_choice: 'auto',
            reasoning: { effort: 'medium' },
            max_output_tokens: 2200
        }),
        signal: AbortSignal.timeout(55000)
    });

    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
        const error = new Error((data.error && data.error.message) || ('OpenAI request failed with status ' + response.status + '.'));
        error.status = response.status;
        throw error;
    }
    return data;
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Use POST for maths questions.' });
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = String(forwarded || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim();
    if (!rateLimit(ip)) {
        return res.status(429).json({ error: 'Too many questions in a short time. Please pause for a minute and try again.' });
    }

    const body = req.body || {};
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const mode = ['step_by_step', 'hint', 'check'].includes(body.mode) ? body.mode : 'step_by_step';
    const level = typeof body.level === 'string' ? body.level.slice(0, 80) : 'Adaptive level';
    const working = typeof body.working === 'string' ? body.working.trim().slice(0, 2500) : '';

    if (!question) return res.status(400).json({ error: 'Enter a maths question first.' });
    if (question.length > 6000) return res.status(400).json({ error: 'Please keep each question under 6,000 characters.' });
    if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({
            error: 'The tutor interface is deployed, but its AI provider is not configured yet. Add OPENAI_API_KEY as a server-side Vercel environment variable, then redeploy.'
        });
    }

    const modeInstruction = {
        step_by_step: 'Teach the full solution step by step.',
        hint: 'Give a helpful first hint only. Do not reveal the complete answer yet.',
        check: 'Check the learner working. Identify what is correct, find the first mistake if any, and show how to correct it.'
    }[mode];

    const input = [{
        role: 'user',
        content: 'Learner level: ' + level + '\nRequested teaching mode: ' + modeInstruction + '\n' +
            (working ? ('Learner working:\n' + working + '\n') : '') + 'Maths question:\n' + question
    }];

    try {
        let response = await callModel(input);
        let toolCount = 0;

        while (toolCount < 8) {
            const calls = (response.output || []).filter(function (item) {
                return item.type === 'function_call';
            });
            if (calls.length === 0) break;

            input.push(...response.output);
            for (const call of calls) {
                let output;
                try {
                    output = runMathTool(call.name, JSON.parse(call.arguments || '{}'));
                } catch (error) {
                    output = { error: error.message, verifiedBy: null };
                }
                input.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output: JSON.stringify(output)
                });
                toolCount++;
            }
            response = await callModel(input);
        }

        const answer = extractText(response);
        if (!answer) {
            return res.status(502).json({ error: 'The maths model did not return a readable answer. Please try again.' });
        }
        return res.status(200).json({
            answer: answer,
            model: process.env.OPENAI_MODEL || 'gpt-6.1-sol',
            toolsUsed: toolCount
        });
    } catch (error) {
        console.error('[MathAI] Solve request failed:', error.message);
        const publicMessage = error.status === 401
            ? 'The AI provider rejected its API key. Check the OPENAI_API_KEY setting in Vercel.'
            : error.status === 429
                ? 'The AI provider is rate-limiting requests or has no available quota. Check the API account limits.'
                : 'MathAI could not complete that question. Please try again.';
        return res.status(502).json({ error: publicMessage });
    }
};

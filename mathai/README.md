# MathAI

MathAI is a responsive mathematics tutor web app. Its AI tutor is connected through a server-side OpenAI Responses API route. Numeric and symbolic maths functions are provided by Math.js and Nerdamer.

## Features

- Arithmetic, algebra, geometry, trigonometry, statistics, probability, graphs, vectors, matrices, calculus and more.
- Three teaching modes: step-by-step teaching, hints, and checking a learner working.
- Adjustable learning level from primary to university.
- Server-side AI requests: the provider key is never sent to the browser.
- Mathematical function tools for numeric calculations, algebraic simplification, equation solving, differentiation, integration and statistics.
- Vercel serverless API endpoints and responsive interface.

## Deploy to Vercel

The Git repository is mofeoluwa155/Chatty-AI; this app lives in the mathai/ directory. Set the Vercel project Root Directory to mathai.

Add these environment variables in Vercel:

- OPENAI_API_KEY — an API key created for the project. Keep this secret and never put it in frontend files.
- OPENAI_MODEL — optional. Defaults to gpt-6.1-sol.

Redeploy after adding or changing environment variables. Check /api/health to confirm that the server has detected the key.

API usage is billed separately from a ChatGPT subscription. Set a low usage budget and rate limits in the API provider account. A parent or guardian should help with account and billing setup for a teen developer.

## Tests

Run npm install and then npm test inside this folder.

## Important

AI-generated explanations can be wrong. MathAI uses maths libraries for supported calculations, but not every topic can be independently verified by the current tool set. Learners should check important results and follow their teacher exam requirements.

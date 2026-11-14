'use strict';

const form = document.getElementById('questionForm');
const questionInput = document.getElementById('questionInput');
const chatWindow = document.getElementById('chatWindow');
const sendButton = document.getElementById('sendButton');
const clearButton = document.getElementById('clearButton');
const modeSelect = document.getElementById('modeSelect');
const levelSelect = document.getElementById('levelSelect');
const workingField = document.getElementById('workingField');
const workingInput = document.getElementById('workingInput');
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');

let busy = false;
let conversation = [];

function renderMarkdown(value) {
  if (window.marked && window.DOMPurify) {
    const html = window.marked.parse(value, { breaks: true, gfm: true });
    return window.DOMPurify.sanitize(html);
  }
  return value.replace(/[&<>"]/g, function (ch) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
  }).replace(/\n/g, '<br>');
}

function addMessage(role, content, loading) {
  const article = document.createElement('article');
  article.className = 'message ' + (role === 'user' ? 'user-message' : 'assistant-message');
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? 'Y' : '∑';
  const wrap = document.createElement('div');
  wrap.className = 'message-content';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.textContent = role === 'user' ? 'YOU' : 'MATHAI';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  if (loading) {
    bubble.innerHTML = '<span class="loading-dots" aria-label="MathAI is thinking"><i></i><i></i><i></i></span>';
    article.dataset.loading = 'true';
  } else {
    bubble.innerHTML = renderMarkdown(content);
  }
  wrap.append(meta, bubble);
  article.append(role === 'user' ? wrap : avatar, role === 'user' ? avatar : wrap);
  chatWindow.append(article);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  if (!loading && window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([bubble]).catch(function () {});
  }
  return article;
}

async function checkHealth() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json();
    if (data.aiConfigured) {
      statusDot.className = 'status-dot online';
      statusLabel.textContent = 'AI brain connected';
    } else {
      statusDot.className = 'status-dot offline';
      statusLabel.textContent = 'AI key needs setup';
    }
  } catch {
    statusDot.className = 'status-dot offline';
    statusLabel.textContent = 'Tutor connection unavailable';
  }
}

function setBusy(value) {
  busy = value;
  sendButton.disabled = value;
  sendButton.querySelector('span:first-child').textContent = value ? 'Working…' : 'Ask MathAI';
}

async function ask(question) {
  if (busy || !question.trim()) return;
  setBusy(true);
  addMessage('user', question, false);
  const loading = addMessage('assistant', '', true);
  const prior = conversation.slice(-10);
  const payload = {
    question: question,
    history: prior,
    level: levelSelect.value,
    mode: modeSelect.value,
    working: modeSelect.value === 'check' ? workingInput.value : ''
  };

  try {
    const response = await fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    loading.remove();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    addMessage('assistant', data.answer, false);
    conversation.push({ role: 'user', content: question }, { role: 'assistant', content: data.answer });
    statusDot.className = 'status-dot online';
    statusLabel.textContent = 'Connected · ' + data.model;
  } catch (error) {
    loading.remove();
    addMessage('assistant', '**I could not solve that just now.**\n\n' + error.message, false);
    if (error.message.includes('OPENAI_API_KEY')) {
      statusDot.className = 'status-dot offline';
      statusLabel.textContent = 'AI key needs setup';
    }
  } finally {
    setBusy(false);
    questionInput.focus();
  }
}

form.addEventListener('submit', function (event) {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  questionInput.value = '';
  ask(question);
});

questionInput.addEventListener('keydown', function (event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

modeSelect.addEventListener('change', function () {
  workingField.hidden = modeSelect.value !== 'check';
});

document.querySelectorAll('.topic-chip').forEach(function (button) {
  button.addEventListener('click', function () {
    questionInput.value = button.dataset.prompt || '';
    questionInput.focus();
    questionInput.setSelectionRange(questionInput.value.length, questionInput.value.length);
  });
});

clearButton.addEventListener('click', function () {
  conversation = [];
  chatWindow.innerHTML = '';
  addMessage('assistant', 'Chat cleared. Send a new maths question whenever you are ready.', false);
});

checkHealth();

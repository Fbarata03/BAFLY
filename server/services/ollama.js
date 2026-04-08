/**
 * Ollama local AI service
 * Talks to a locally running Ollama instance (default: http://localhost:11434)
 * No API key needed — completely free.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

/**
 * List models available in the local Ollama instance.
 */
async function listModels() {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!res.ok) throw new Error(`Ollama unreachable: ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

/**
 * Send a chat completion request to Ollama.
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} [model]
 * @returns {Promise<string>} assistant reply text
 */
async function chat(messages, model = DEFAULT_MODEL) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama chat error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.message?.content ?? '';
}

/**
 * Generate a single completion (non-chat) from Ollama.
 * @param {string} prompt
 * @param {string} [model]
 * @returns {Promise<string>}
 */
async function generate(prompt, model = DEFAULT_MODEL) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama generate error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.response ?? '';
}

/**
 * Check if Ollama is running and reachable.
 * @returns {Promise<boolean>}
 */
async function isHealthy() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { chat, generate, listModels, isHealthy, DEFAULT_MODEL, OLLAMA_BASE_URL };

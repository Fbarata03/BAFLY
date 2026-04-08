/**
 * AI routes powered by Ollama (local, free, no API key required)
 *
 * GET  /api/ai/health          — check if Ollama is running
 * GET  /api/ai/models          — list locally available models
 * POST /api/ai/chat            — single-turn AI response
 * POST /api/ai/icebreaker      — generate a conversation starter
 * POST /api/ai/moderate        — check if a message is appropriate
 */

const express = require('express');
const router = express.Router();
const ollama = require('../services/ollama');

// GET /api/ai/health
router.get('/health', async (req, res) => {
  const healthy = await ollama.isHealthy();
  return res.json({
    ok: healthy,
    ollamaUrl: ollama.OLLAMA_BASE_URL,
    defaultModel: ollama.DEFAULT_MODEL,
  });
});

// GET /api/ai/models
router.get('/models', async (req, res) => {
  try {
    const models = await ollama.listModels();
    return res.json({ models });
  } catch (e) {
    return res.status(503).json({ error: 'Ollama not reachable', detail: e.message });
  }
});

// POST /api/ai/chat
// Body: { message: string, history?: Array<{role, content}>, model?: string }
router.post('/chat', async (req, res) => {
  const { message, history = [], model } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const systemPrompt = {
    role: 'system',
    content:
      'You are a friendly, concise assistant in a video chat app called BAFLY. ' +
      'Help users start conversations or answer quick questions. ' +
      'Keep responses short (2-3 sentences max).',
  };

  const messages = [systemPrompt, ...history, { role: 'user', content: message.trim() }];

  try {
    const reply = await ollama.chat(messages, model);
    return res.json({ reply });
  } catch (e) {
    return res.status(503).json({ error: 'AI unavailable', detail: e.message });
  }
});

// POST /api/ai/icebreaker
// Body: { topic?: string, model?: string }
router.post('/icebreaker', async (req, res) => {
  const { topic, model } = req.body || {};

  const prompt = topic
    ? `Generate one fun, light-hearted conversation starter about "${topic}" for a random video chat. One sentence only.`
    : 'Generate one fun, light-hearted conversation starter for meeting a random stranger on a video chat. One sentence only.';

  try {
    const reply = await ollama.generate(prompt, model);
    return res.json({ icebreaker: reply.trim() });
  } catch (e) {
    return res.status(503).json({ error: 'AI unavailable', detail: e.message });
  }
});

// POST /api/ai/moderate
// Body: { text: string, model?: string }
// Returns: { safe: boolean, reason?: string }
router.post('/moderate', async (req, res) => {
  const { text, model } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  const prompt =
    `Is the following message appropriate for a general-audience video chat platform? ` +
    `Reply with only JSON: {"safe": true} or {"safe": false, "reason": "<short reason>"}.\n\n` +
    `Message: ${text.slice(0, 500)}`;

  try {
    const raw = await ollama.generate(prompt, model);

    // Extract JSON from response
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return res.json({ safe: !!parsed.safe, reason: parsed.reason || null });
    }

    // Fallback: if we can't parse, assume safe
    return res.json({ safe: true, reason: null });
  } catch (e) {
    // If AI is down, default to allowing the message
    return res.json({ safe: true, reason: null, aiUnavailable: true });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const VALID_REASONS = ['spam', 'harassment', 'inappropriate_content', 'underage', 'other'];

// Qualquer utilizador pode submeter um report
router.post('/', async (req, res) => {
  const { reporter_id, reported_id, reason, description, screenshot } = req.body;

  if (!reported_id || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Invalid reason' });
  }

  const cleanDesc = description ? String(description).slice(0, 1000) : null;

  // Só aceita data URLs de imagem, limita a 200 KB
  const cleanScreenshot =
    screenshot &&
    typeof screenshot === 'string' &&
    screenshot.startsWith('data:image/')
      ? screenshot.slice(0, 204800)
      : null;

  try {
    await db.query(
      'INSERT INTO reports (reporter_id, reported_id, reason, description, status, screenshot) VALUES ($1, $2, $3, $4, $5, $6)',
      [reporter_id || null, reported_id, reason, cleanDesc, 'pending', cleanScreenshot]
    );
    res.status(201).json({ message: 'Report submitted' });
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Apenas admin
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*,
        u_rep.username AS reporter_name,
        u_rep.email AS reporter_email,
        u_rpt.username AS reported_name,
        u_rpt.email AS reported_email
       FROM reports r
       LEFT JOIN users u_rep ON u_rep.id = r.reporter_id
       LEFT JOIN users u_rpt ON u_rpt.id = r.reported_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC`,
      ['pending']
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Reports fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/dismiss/:id', requireAdmin, async (req, res) => {
  try {
    await db.query('UPDATE reports SET status = $1 WHERE id = $2', ['dismissed', req.params.id]);
    res.json({ message: 'Report dismissed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to dismiss report' });
  }
});

router.post('/ban', requireAdmin, async (req, res) => {
  const { user_id, reason, expires_at } = req.body;
  if (!user_id || !reason) return res.status(400).json({ error: 'Missing required fields' });
  try {
    await db.query('INSERT INTO bans (user_id, reason, expires_at) VALUES ($1, $2, $3)', [user_id, reason, expires_at || null]);
    await db.query('UPDATE reports SET status = $1 WHERE reported_id = $2', ['banned', user_id]);
    res.json({ message: 'User banned' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

module.exports = router;

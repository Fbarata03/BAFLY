const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

// Qualquer utilizador pode submeter um report
router.post('/', async (req, res) => {
  const { reporter_id, reported_id, reason, description } = req.body;
  try {
    await db.query(
      'INSERT INTO reports (reporter_id, reported_id, reason, description, status) VALUES ($1, $2, $3, $4, $5)',
      [reporter_id, reported_id, reason, description, 'pending']
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
    const result = await db.query('SELECT * FROM reports WHERE status = $1 ORDER BY created_at DESC', ['pending']);
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
  try {
    await db.query('INSERT INTO bans (user_id, reason, expires_at) VALUES ($1, $2, $3)', [user_id, reason, expires_at]);
    await db.query('UPDATE reports SET status = $1 WHERE reported_id = $2', ['banned', user_id]);
    res.json({ message: 'User banned' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

module.exports = router;

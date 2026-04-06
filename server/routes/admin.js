const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

// List users with active ban info
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 25;
    const offset = (page - 1) * limit;

    let users, count;
    if (search) {
      const term = `%${search}%`;
      users = await db.query(
        `SELECT u.id, u.username, u.email, u.provider, u.country, u.created_at,
          b.id AS ban_id, b.reason AS ban_reason, b.expires_at AS ban_expires
         FROM users u
         LEFT JOIN bans b ON b.user_id = u.id AND (b.expires_at IS NULL OR b.expires_at > NOW())
         WHERE u.username LIKE $1 OR u.email LIKE $2
         ORDER BY u.created_at DESC LIMIT $3 OFFSET $4`,
        [term, term, limit, offset]
      );
      count = await db.query(
        'SELECT COUNT(*) as total FROM users WHERE username LIKE $1 OR email LIKE $2',
        [term, term]
      );
    } else {
      users = await db.query(
        `SELECT u.id, u.username, u.email, u.provider, u.country, u.created_at,
          b.id AS ban_id, b.reason AS ban_reason, b.expires_at AS ban_expires
         FROM users u
         LEFT JOIN bans b ON b.user_id = u.id AND (b.expires_at IS NULL OR b.expires_at > NOW())
         ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      count = await db.query('SELECT COUNT(*) as total FROM users');
    }

    res.json({ users: users.rows, total: Number(count.rows[0].total) });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// List active bans
router.get('/bans', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.id, b.user_id, b.reason, b.expires_at, b.created_at,
        u.username, u.email
       FROM bans b
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.expires_at IS NULL OR b.expires_at > NOW()
       ORDER BY b.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Admin bans error:', err);
    res.status(500).json({ error: 'Failed to fetch bans' });
  }
});

// Unban user
router.post('/unban/:userId', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM bans WHERE user_id = $1', [req.params.userId]);
    await db.query("UPDATE reports SET status = 'dismissed' WHERE reported_id = $1 AND status = 'banned'", [req.params.userId]);
    res.json({ message: 'User unbanned' });
  } catch (err) {
    console.error('Unban error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

module.exports = router;

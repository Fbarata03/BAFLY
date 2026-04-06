const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/daily', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM stats_daily ORDER BY date DESC LIMIT 7');
    res.json(result.rows);
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/summary', requireAdmin, async (req, res) => {
  try {
    const isD1 = process.env.DB_DRIVER === 'd1';

    const sessionsToday = await db.query(
      isD1
        ? "SELECT COUNT(*) as total FROM sessions WHERE started_at >= date('now')"
        : 'SELECT COUNT(*) as total FROM sessions WHERE started_at >= CURRENT_DATE',
    );

    const onlineNow = await db.query('SELECT COUNT(*) as total FROM online_now');
    const pendingReports = await db.query('SELECT COUNT(*) as total FROM reports WHERE status = $1', ['pending']);

    const avgSessionTime = await db.query(
      isD1
        ? "SELECT AVG((julianday(ended_at) - julianday(started_at)) * 86400) as avg FROM sessions WHERE ended_at IS NOT NULL"
        : 'SELECT AVG(TIMESTAMPDIFF(SECOND, started_at, ended_at)) as avg FROM sessions WHERE ended_at IS NOT NULL',
    );

    res.json({
      sessionsToday: sessionsToday.rows[0].total,
      onlineNow: onlineNow.rows[0].total,
      pendingReports: pendingReports.rows[0].total,
      avgSessionTime: Math.round(avgSessionTime.rows[0].avg || 0)
    });
  } catch (error) {
    console.error('Summary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;

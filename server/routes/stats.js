const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/daily', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM stats_daily ORDER BY date DESC LIMIT 7');
    res.json(result.rows);
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const sessionsToday = await db.query('SELECT COUNT(*) as total FROM sessions WHERE started_at >= CURRENT_DATE');
    const onlineNow = await db.query('SELECT COUNT(*) as total FROM online_now');
    const pendingReports = await db.query('SELECT COUNT(*) as total FROM reports WHERE status = $1', ['pending']);
    const avgSessionTime = await db.query('SELECT AVG(TIMESTAMPDIFF(SECOND, started_at, ended_at)) as avg FROM sessions WHERE ended_at IS NOT NULL');

    res.json({
      sessionsToday: sessionsToday.rows[0].total,
      onlineNow: onlineNow.rows[0].total,
      pendingReports: pendingReports.rows[0].total,
      avgSessionTime: avgSessionTime.rows[0].avg || 0
    });
  } catch (error) {
    console.error('Summary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;

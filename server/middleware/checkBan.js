const db = require('../db');

module.exports = async function checkBan(socket) {
  const ip = socket.handshake.address;
  const socketId = socket.id;

  try {
    const result = await db.query('SELECT * FROM bans WHERE ip = $1 OR user_id = $2', [ip, socketId]);
    if (result.rows.length > 0) {
      const ban = result.rows[0];
      socket.emit('banned', { reason: ban.reason, expires_at: ban.expires_at });
      socket.disconnect();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Ban check error:', error);
    return false;
  }
};

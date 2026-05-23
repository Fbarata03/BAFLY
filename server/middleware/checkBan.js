const db = require('../db');

const getSocketIp = (socket) => {
  const xff = socket.handshake.headers?.['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  const addr = socket.handshake.address || '';
  if (addr.startsWith('::ffff:')) return addr.slice(7);
  return addr;
};

module.exports = async function checkBan(socket) {
  const ip = getSocketIp(socket);
  try {
    const result = await db.query(
      'SELECT reason, expires_at FROM bans WHERE ip = $1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1',
      [ip]
    );
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

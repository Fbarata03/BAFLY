const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const checkBan = require('./middleware/checkBan');
const crypto = require('crypto');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const statsRoutes = require('./routes/stats');
const initDB = require('./init_db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize DB tables
initDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/healthz', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const safeDbError = (e) => {
  const code = e && (e.code || e.errno || e.sqlState) ? String(e.code || e.errno || e.sqlState) : null;
  const message = e && e.message ? String(e.message) : null;
  const cleanMessage = message ? message.replace(/(mysql:\/\/)([^@]+)(@)/gi, '$1***$3') : null;
  return {
    code,
    message: cleanMessage ? cleanMessage.slice(0, 280) : null
  };
};

app.get('/api/health/db', async (req, res) => {
  try {
    await db.query('SELECT 1 as ok', []);
    return res.json({
      ok: true,
      hasDatabaseUrl: !!(process.env.DATABASE_URL || process.env.MYSQL_URL),
      sslMode: process.env.DB_SSL_MODE || null
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      hasDatabaseUrl: !!(process.env.DATABASE_URL || process.env.MYSQL_URL),
      sslMode: process.env.DB_SSL_MODE || null,
      error: safeDbError(e)
    });
  }
});

const getDbConfigInfo = () => {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (url) {
    try {
      const u = new URL(url);
      return {
        source: process.env.DATABASE_URL ? 'DATABASE_URL' : 'MYSQL_URL',
        host: u.hostname || null,
        port: u.port ? Number(u.port) : 3306,
        user: u.username ? decodeURIComponent(u.username) : null,
        database: (u.pathname || '').replace(/^\//, '') || null,
        hasPassword: !!u.password,
        passwordLength: u.password ? String(decodeURIComponent(u.password)).length : 0,
        sslModeFromUrl: (u.searchParams.get('ssl-mode') || u.searchParams.get('sslmode') || null)
      };
    } catch {
      return { source: process.env.DATABASE_URL ? 'DATABASE_URL' : 'MYSQL_URL', parseError: true };
    }
  }
  return {
    source: 'parts',
    host: process.env.DB_HOST || null,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : null,
    user: process.env.DB_USER || null,
    database: process.env.DB_NAME || null,
    hasPassword: !!process.env.DB_PASS,
    passwordLength: process.env.DB_PASS ? String(process.env.DB_PASS).length : 0
  };
};

app.get('/api/health/db/config', (req, res) => {
  return res.json({
    ...getDbConfigInfo(),
    sslModeEnv: process.env.DB_SSL_MODE || null
  });
});

const buildTurnIceServers = () => {
  const useHmac = String(process.env.TURN_USE_HMAC || '').toLowerCase() === 'true';
  let username;
  let credential;

  if (useHmac) {
    const secret = process.env.TURN_SHARED_SECRET || 'openrelayprojectsecret';
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const identity = process.env.TURN_HMAC_IDENTITY || 'bafly';
    username = `${expiresAt}:${identity}`;
    credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  } else {
    username = process.env.TURN_USERNAME || 'openrelayproject';
    credential = process.env.TURN_CREDENTIAL || 'openrelayprojectsecret';
  }

  return [
    { urls: 'turn:openrelay.metered.ca:80',                      username, credential },
    { urls: 'turn:openrelay.metered.ca:80?transport=udp',        username, credential },
    { urls: 'turn:openrelay.metered.ca:443',                     username, credential },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp',       username, credential },
    { urls: 'turns:openrelay.metered.ca:443',                    username, credential },
    { urls: 'turns:openrelay.metered.ca:443?transport=tcp',      username, credential },
  ];
};

app.get('/api/webrtc/ice', (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19305' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    ...buildTurnIceServers()
  ];
  return res.json({ iceServers });
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

const geoCache = new Map();

const normalizeIp = (ip) => {
  if (!ip) return null;
  const s = String(ip).trim();
  if (s.startsWith('::ffff:')) return s.slice(7);
  if (s === '::1') return '127.0.0.1';
  return s;
};

const getIpFromHeaders = (headers) => {
  const xff = headers['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    return normalizeIp(first);
  }
  return null;
};

const getIpFromRequest = (req) => {
  const fromHeader = getIpFromHeaders(req.headers || {});
  return fromHeader || normalizeIp(req.socket?.remoteAddress);
};

const isPrivateIp = (ip) => {
  const s = normalizeIp(ip);
  if (!s) return true;
  if (s === '127.0.0.1') return true;
  if (s.startsWith('10.')) return true;
  if (s.startsWith('192.168.')) return true;
  const m = s.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
};

const lookupGeoByIp = async (ip) => {
  const normalized = normalizeIp(ip);
  if (!normalized || isPrivateIp(normalized)) return null;
  const cached = geoCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = `https://ipwho.is/${encodeURIComponent(normalized)}?fields=success,country,country_code`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  const value = data && data.success && data.country_code
    ? { countryCode: String(data.country_code).toUpperCase(), countryName: data.country ? String(data.country) : null }
    : null;

  geoCache.set(normalized, { value, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
  return value;
};

app.get('/api/geo/me', async (req, res) => {
  try {
    const ip = getIpFromRequest(req);
    const geo = await lookupGeoByIp(ip);
    return res.json({ ip, ...geo });
  } catch (e) {
    return res.json({ ip: null, countryCode: null, countryName: null });
  }
});

// Queues for matchmaking
let queue = []; // { socket, gender, country, joinedAt }

// Stats tracking
const getOnlineCount = () => io.engine?.clientsCount ?? 0;
const getQueueSize = () => queue.filter((u) => u && u.socket && u.socket.connected && !u.socket.data?.inMatch).length;
const broadcastStatus = () => {
  io.emit('status', { onlineCount: getOnlineCount(), queueSize: getQueueSize() });
  io.emit('online_count', getOnlineCount());
};

const FLEX_MS = 3000;

app.get('/api/health/matchmaking', (req, res) => {
  const now = Date.now();
  const items = queue.map((u) => ({
    gender: u.gender,
    country: u.country,
    waitMs: now - (u.joinedAt || now)
  }));

  const byCountry = items.reduce((acc, it) => {
    const k = it.country || 'Any';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return res.json({
    onlineCount: getOnlineCount(),
    queueSize: items.length,
    byCountry
  });
});

const canMatch = (a, b, now) => {
  const timeA = now - (a.joinedAt || now);
  const timeB = now - (b.joinedAt || now);
  const flexible = timeA > FLEX_MS || timeB > FLEX_MS;
  const genderMatch = flexible || a.gender === 'Any' || b.gender === 'Any' || a.gender === b.gender;
  const countryMatch = flexible || a.country === 'Any' || b.country === 'Any' || a.country === b.country;
  return genderMatch && countryMatch;
};

const attemptMatchAll = () => {
  if (queue.length < 2) return;
  const now = Date.now();
  queue = queue.filter((u) => u && u.socket && u.socket.connected);
  queue.sort((x, y) => (x.joinedAt || now) - (y.joinedAt || now));

  const used = new Set();
  const pairs = [];
  for (let i = 0; i < queue.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < queue.length; j++) {
      if (used.has(j)) continue;
      if (canMatch(queue[i], queue[j], now)) {
        used.add(i);
        used.add(j);
        pairs.push([queue[i], queue[j]]);
        break;
      }
    }
  }

  if (!pairs.length) return;

  const keep = [];
  for (let i = 0; i < queue.length; i++) {
    if (!used.has(i)) keep.push(queue[i]);
  }
  queue = keep;

  pairs.forEach(([user, otherUser]) => {
    const roomId = `room_${user.socket.id}_${otherUser.socket.id}`;
    user.socket.join(roomId);
    otherUser.socket.join(roomId);
    user.socket.data.inMatch = true;
    otherUser.socket.data.inMatch = true;
    user.socket.emit('matched', { role: 'caller', roomId, partnerGeo: otherUser.geo || null, selfGeo: user.geo || null });
    otherUser.socket.emit('matched', { role: 'callee', roomId, partnerGeo: user.geo || null, selfGeo: otherUser.geo || null });
    db.query('INSERT INTO sessions (room_id, user1_id, user2_id) VALUES ($1, $2, $3)', [roomId, user.socket.id, otherUser.socket.id]).catch(() => {});
  });

  broadcastStatus();
};

setInterval(attemptMatchAll, 750);

io.on('connection', async (socket) => {
  broadcastStatus();

  socket.on('get_online_count', () => {
    socket.emit('online_count', getOnlineCount());
    socket.emit('status', { onlineCount: getOnlineCount(), queueSize: getQueueSize() });
  });
  try {
    const ip = getIpFromHeaders(socket.handshake?.headers || {}) || normalizeIp(socket.handshake?.address);
    const geo = await lookupGeoByIp(ip);
    socket.data.geo = geo || null;
  } catch (e) {
    socket.data.geo = null;
  }
  
  // Track online status in DB
  try {
    await db.query('INSERT INTO online_now (socket_id) VALUES ($1)', [socket.id]);
  } catch (e) {
    console.error("DB Online status error", e);
  }

  const removeFromQueue = () => {
    queue = queue.filter(u => u.socket.id !== socket.id);
    broadcastStatus();
  };

  const normalizeFilters = (data) => {
    const rawGender = data && typeof data.gender === 'string' ? data.gender : 'Any';
    const rawCountry = data && typeof data.country === 'string' ? data.country : 'Any';
    const gender = String(rawGender).trim() || 'Any';
    const c = String(rawCountry).trim() || 'Any';
    const country = c !== 'Any' && c.length === 2 ? c.toUpperCase() : c;
    return { gender, country };
  };

  socket.on('join_queue', async (data) => {
    // Check if banned
    const isBanned = await checkBan(socket);
    if (isBanned) return;

    if (socket.data?.inMatch) return;

    removeFromQueue();

    const { gender, country } = normalizeFilters(data);
    const newUser = {
      socket,
      gender,
      country,
      geo: socket.data.geo || null,
      joinedAt: Date.now(),
      matched: false
    };

    // Matchmaking logic
    findMatch(newUser);
  });

  socket.on('offer', (data) => {
    const { roomId, sdp } = data;
    socket.to(roomId).emit('offer', { sdp });
  });

  socket.on('answer', (data) => {
    const { roomId, sdp } = data;
    socket.to(roomId).emit('answer', { sdp });
  });

  socket.on('ice_candidate', (data) => {
    const { roomId, candidate } = data;
    socket.to(roomId).emit('ice_candidate', { candidate });
  });

  socket.on('message', (data) => {
    const { roomId, text } = data;
    // Broadcast to room
    socket.to(roomId).emit('message', { text });
    
    // Log to DB (optional based on requirements, but user asked for INSERT INTO messages)
    db.query('INSERT INTO messages (room_id, text, sender_socket) VALUES ($1, $2, $3)', [roomId, text, socket.id]).catch(console.error);
  });

  socket.on('camera_state', (data) => {
    const { roomId, enabled } = data || {};
    socket.to(roomId).emit('camera_state', { enabled: !!enabled });
  });

  socket.on('mic_state', (data) => {
    const { roomId, enabled } = data || {};
    socket.to(roomId).emit('mic_state', { enabled: !!enabled });
  });

  socket.on('request_ice_restart', (data) => {
    const { roomId } = data || {};
    if (!roomId) return;
    socket.to(roomId).emit('request_ice_restart');
  });

  socket.on('next', () => {
    handleDisconnectFromRoom(socket);
    socket.data.inMatch = false;
    removeFromQueue();
    broadcastStatus();
    // User wants to find another match
    // Client should emit join_queue again after next
  });

  socket.on('disconnect', async () => {
    broadcastStatus();
    handleDisconnectFromRoom(socket);
    socket.data.inMatch = false;
    
    // Remove from DB online tracking
    try {
      await db.query('DELETE FROM online_now WHERE socket_id = $1', [socket.id]);
    } catch (e) {
      console.error("DB Online removal error", e);
    }
    
    // Remove from queue if present
    removeFromQueue();
  });

  function handleDisconnectFromRoom(socket) {
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit('stranger_disconnected');
        socket.leave(room);
        socket.data.inMatch = false;
        
        // Update session in DB
        db.query('UPDATE sessions SET ended_at = CURRENT_TIMESTAMP, end_reason = $1 WHERE room_id = $2 AND ended_at IS NULL', ['disconnected', room]).catch(console.error);
      }
    });
  }

  function findMatch(user) {
    const now = Date.now();
    
    // Look for a match in the queue
    const matchIndex = queue.findIndex(other => {
      if (other.socket.id === user.socket.id) return false;
      
      const timeInQueue = now - other.joinedAt;
      const isFlexible = timeInQueue > 3000;

      if (isFlexible) return true; // Match anything if they've been waiting > 10s

      // Match based on gender/country if specified
      const genderMatch = (user.gender === 'Any' || other.gender === 'Any' || user.gender === other.gender);
      const countryMatch = (user.country === 'Any' || other.country === 'Any' || user.country === other.country);
      
      return genderMatch && countryMatch;
    });

    if (matchIndex !== -1) {
      const otherUser = queue.splice(matchIndex, 1)[0];
      const roomId = `room_${user.socket.id}_${otherUser.socket.id}`;
      
      user.socket.join(roomId);
      otherUser.socket.join(roomId);

      user.socket.data.inMatch = true;
      otherUser.socket.data.inMatch = true;

      queue = queue.filter(u => u.socket.id !== user.socket.id && u.socket.id !== otherUser.socket.id);

      user.socket.emit('matched', { role: 'caller', roomId, partnerGeo: otherUser.geo || null, selfGeo: user.geo || null });
      otherUser.socket.emit('matched', { role: 'callee', roomId, partnerGeo: user.geo || null, selfGeo: otherUser.geo || null });

      // Log session to DB
      db.query('INSERT INTO sessions (room_id, user1_id, user2_id) VALUES ($1, $2, $3)', [roomId, user.socket.id, otherUser.socket.id]).catch(console.error);
      broadcastStatus();
    } else {
      queue.push(user);
      user.socket.emit('waiting');
      broadcastStatus();
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

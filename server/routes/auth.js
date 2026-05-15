const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db');
require('dotenv').config();

const base64UrlToBuffer = (s) => {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(s).length / 4) * 4, '=');
  return Buffer.from(b64, 'base64');
};

const base64UrlToString = (s) => base64UrlToBuffer(s).toString('utf8');

const getClientBaseUrl = () => process.env.CLIENT_BASE_URL || 'http://localhost:5173';

const createOAuthState = async (provider) => {
  const state = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  await db.query('INSERT INTO oauth_states (state, provider, expires_at) VALUES ($1, $2, $3)', [state, provider, expiresAt]).catch(() => {});
  return state;
};

const consumeOAuthState = async (state, expectedProvider) => {
  try {
    const result = await db.query('SELECT provider, expires_at FROM oauth_states WHERE state = $1', [state]);
    await db.query('DELETE FROM oauth_states WHERE state = $1', [state]);
    if (!result.rows.length) return false;
    const entry = result.rows[0];
    if (entry.provider !== expectedProvider) return false;
    if (new Date(entry.expires_at) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
};

const pickUsername = async (preferred) => {
  const base = String(preferred || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  const candidateBase = (base && base !== 'admin') ? base.slice(0, 32) : `user_${crypto.randomBytes(4).toString('hex')}`;
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? candidateBase : `${candidateBase}_${i}`;
    const existing = await db.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [candidate]);
    if (!existing.rows.length) return candidate;
  }
  return `user_${crypto.randomBytes(8).toString('hex')}`;
};

const upsertOAuthUser = async ({ provider, providerId, email, displayName }) => {
  const existing = await db.query(
    'SELECT id, username FROM users WHERE provider = $1 AND provider_id = $2 LIMIT 1',
    [provider, providerId],
  );

  if (existing.rows.length) {
    const user = existing.rows[0];
    await db.query(
      'UPDATE users SET email = $1, display_name = $2 WHERE id = $3',
      [email || null, displayName || null, user.id],
    );
    return { id: user.id, username: user.username };
  }

  const id = crypto.randomUUID();
  const preferredUsername = email ? String(email).split('@')[0] : (displayName || `${provider}_${String(providerId).slice(-6)}`);
  const username = await pickUsername(preferredUsername);

  await db.query(
    'INSERT INTO users (id, username, provider, provider_id, email, display_name) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, username, provider, providerId, email || null, displayName || null],
  );

  return { id, username };
};

const verifyGoogleIdToken = async (idToken) => {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error('google_tokeninfo_failed');
  const payload = await res.json();
  if (payload.error) throw new Error(payload.error);
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('invalid_audience');
  if (!payload.sub) throw new Error('missing_sub');
  if (payload.exp && Date.now() / 1000 >= Number(payload.exp)) throw new Error('token_expired');
  return payload;
};

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
    const normalizedUsername = String(username).trim();
    if (!normalizedUsername || normalizedUsername.length < 3) return res.status(400).json({ error: 'Username too short' });
    if (normalizedUsername.toLowerCase() === 'admin') return res.status(400).json({ error: 'Username not allowed' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password too short' });

    const existing = await db.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [normalizedUsername]);
    if (existing.rows.length) return res.status(409).json({ error: 'Username already taken' });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const id = crypto.randomUUID();
    await db.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [id, normalizedUsername, passwordHash]);

    const token = jwt.sign({ userId: id, username: normalizedUsername, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id, username: normalizedUsername } });
  } catch (e) {
    console.error('Register error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
    const normalizedUsername = String(username).trim();

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    if (normalizedUsername === adminUser && String(password) === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ user: adminUser, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: { username: adminUser, role: 'admin' } });
    }

    const result = await db.query('SELECT id, username, password_hash FROM users WHERE username = $1 LIMIT 1', [normalizedUsername]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    if (!user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, username: user.username, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, username: user.username, role: 'user' } });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/google/start', async (req, res) => {
  console.log('[GOOGLE_START] ID:', !!process.env.GOOGLE_CLIENT_ID, '| SEC:', !!process.env.GOOGLE_CLIENT_SECRET, '| URI:', !!process.env.GOOGLE_REDIRECT_URI);
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    if (String(process.env.OAUTH_DEV_MODE).toLowerCase() === 'true') {
      (async () => {
        try {
          const user = await upsertOAuthUser({
            provider: 'dev-google',
            providerId: 'dev_google_user',
            email: 'dev.google@example.com',
            displayName: 'Dev Google User',
          });
          const token = jwt.sign(
            { userId: user.id, username: user.username, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
          );
          return res.redirect(`${getClientBaseUrl()}/auth?token=${encodeURIComponent(token)}`);
        } catch (e) {
          return res.status(500).send('Dev Google OAuth failed');
        }
      })();
      return;
    }
    return res.status(501).send('Google OAuth not configured');
  }
  const state = await createOAuthState('google');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return res.redirect(url.toString());
});

router.get('/google/callback', async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      return res.status(501).send('Google OAuth not configured');
    }
    const code = req.query.code;
    const state = req.query.state;
    if (!code || !state || !(await consumeOAuthState(state, 'google'))) {
      return res.status(400).send('Invalid OAuth state');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.id_token) {
      return res.status(401).send('Google token exchange failed');
    }

    const payload = await verifyGoogleIdToken(tokenData.id_token);
    const providerId = String(payload.sub);
    const email = payload.email ? String(payload.email) : null;
    const displayName = payload.name ? String(payload.name) : null;

    const user = await upsertOAuthUser({ provider: 'google', providerId, email, displayName });
    const token = jwt.sign({ userId: user.id, username: user.username, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.redirect(`${getClientBaseUrl()}/auth?token=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error('Google OAuth error:', e);
    return res.status(500).send('Google OAuth error');
  }
});

router.get('/facebook/start', async (req, res) => {
  console.log('[FACEBOOK_START] ID:', !!process.env.FACEBOOK_APP_ID, '| SEC:', !!process.env.FACEBOOK_APP_SECRET, '| URI:', !!process.env.FACEBOOK_REDIRECT_URI);
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET || !process.env.FACEBOOK_REDIRECT_URI) {
    if (String(process.env.OAUTH_DEV_MODE).toLowerCase() === 'true') {
      (async () => {
        try {
          const user = await upsertOAuthUser({
            provider: 'dev-facebook',
            providerId: 'dev_facebook_user',
            email: 'dev.facebook@example.com',
            displayName: 'Dev Facebook User',
          });
          const token = jwt.sign(
            { userId: user.id, username: user.username, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
          );
          return res.redirect(`${getClientBaseUrl()}/auth?token=${encodeURIComponent(token)}`);
        } catch (e) {
          return res.status(500).send('Dev Facebook OAuth failed');
        }
      })();
      return;
    }
    return res.status(501).send('Facebook OAuth not configured');
  }
  const state = await createOAuthState('facebook');
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', process.env.FACEBOOK_APP_ID);
  url.searchParams.set('redirect_uri', process.env.FACEBOOK_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'public_profile');
  url.searchParams.set('state', state);
  return res.redirect(url.toString());
});

router.get('/facebook/callback', async (req, res) => {
  try {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET || !process.env.FACEBOOK_REDIRECT_URI) {
      return res.status(501).send('Facebook OAuth not configured');
    }
    const code = req.query.code;
    const state = req.query.state;
    if (!code || !state || !(await consumeOAuthState(state, 'facebook'))) {
      return res.status(400).send('Invalid OAuth state');
    }

    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', process.env.FACEBOOK_APP_ID);
    tokenUrl.searchParams.set('redirect_uri', process.env.FACEBOOK_REDIRECT_URI);
    tokenUrl.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set('code', String(code));
    const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(401).send('Facebook token exchange failed');
    }

    const meUrl = new URL('https://graph.facebook.com/me');
    meUrl.searchParams.set('fields', 'id,name,email');
    meUrl.searchParams.set('access_token', tokenData.access_token);
    const meRes = await fetch(meUrl.toString(), { method: 'GET' });
    const me = await meRes.json().catch(() => ({}));
    if (!meRes.ok || !me.id) {
      return res.status(401).send('Facebook profile fetch failed');
    }

    const user = await upsertOAuthUser({
      provider: 'facebook',
      providerId: String(me.id),
      email: me.email ? String(me.email) : null,
      displayName: me.name ? String(me.name) : null,
    });

    const token = jwt.sign({ userId: user.id, username: user.username, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.redirect(`${getClientBaseUrl()}/auth?token=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error('Facebook OAuth error:', e);
    return res.status(500).send('Facebook OAuth error');
  }
});

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Unauthorized' });
    const token = parts[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload && payload.user === 'admin') {
      return res.json({ user: { username: 'admin', role: 'admin' } });
    }
    if (!payload || !payload.userId) return res.status(401).json({ error: 'Unauthorized' });
    const r = await db.query('SELECT id, username, display_name, provider, email FROM users WHERE id = $1 LIMIT 1', [payload.userId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const u = r.rows[0];
    return res.json({ user: { id: u.id, username: u.username, displayName: u.display_name, provider: u.provider, email: u.email, role: 'user' } });
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

// Ban check — verifica por IP e userId se autenticado
router.get('/ban-check', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  let userId = null;
  if (token) {
    try { const p = jwt.verify(token, process.env.JWT_SECRET); userId = p.userId || null; } catch {}
  }
  try {
    const result = userId
      ? await db.query('SELECT reason, expires_at FROM bans WHERE (ip = $1 OR user_id = $2) AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1', [ip, userId])
      : await db.query('SELECT reason, expires_at FROM bans WHERE ip = $1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1', [ip]);
    if (result.rows.length > 0) {
      const b = result.rows[0];
      return res.json({ banned: true, reason: b.reason, expires_at: b.expires_at });
    }
    return res.json({ banned: false });
  } catch { return res.json({ banned: false }); }
});

module.exports = router;

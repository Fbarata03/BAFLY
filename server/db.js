const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

const fromDatabaseUrl = () => {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (!url) return null;
  try {
    const u = new URL(url);
    const params = u.searchParams;
    const host = u.hostname;
    const port = u.port ? Number(u.port) : 3306;
    const user = decodeURIComponent(u.username || '');
    const password = decodeURIComponent(u.password || '');
    const database = (u.pathname || '').replace(/^\//, '') || process.env.DB_NAME || 'defaultdb';
    const sslMode = (params.get('ssl-mode') || params.get('sslmode') || '').toUpperCase();
    if (sslMode === 'REQUIRED' && !process.env.DB_SSL_MODE) {
      process.env.DB_SSL_MODE = 'REQUIRED';
    }
    return { host, port, user, password, database };
  } catch {
    return null;
  }
};

const buildSslConfig = () => {
  const mustSSL = String(process.env.DB_SSL_MODE || '').toUpperCase() === 'REQUIRED' || String(process.env.DB_SSL || '').toLowerCase() === 'true';
  if (!mustSSL) return undefined;

  const caBase64 = process.env.DB_SSL_CA_BASE64;
  const caPlain = process.env.DB_SSL_CA;
  let ca;
  if (caBase64) {
    try { ca = Buffer.from(caBase64, 'base64').toString('utf8').replace(/\r\n/g, '\n'); } catch {}
  } else if (caPlain) {
    ca = String(caPlain).replace(/\\n/g, '\n');
  }
  return { ca: ca || undefined, rejectUnauthorized: false, minVersion: 'TLSv1.2' };
};

const initPool = async () => {
  if (!pool) {
    const ssl = buildSslConfig();

    const shouldCreateDb = String(process.env.DB_CREATE_IF_NOT_EXISTS || '').toLowerCase() === 'true';
    if (shouldCreateDb) {
      try {
        const tempConn = await mysql.createConnection({
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          user: process.env.DB_USER,
          password: process.env.DB_PASS,
          ssl
        });
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        await tempConn.end();
      } catch (e) {
        // Ignore create errors (cloud providers often restrict CREATE DATABASE)
      }
    }

    const urlCfg = fromDatabaseUrl();
    const cfg = urlCfg || {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    };

    pool = mysql.createPool({
      ...cfg,
      ssl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
};

module.exports = {
  query: async (text, params) => {
    const mysqlText = text.replace(/\$\d+/g, '?');
    const p = await initPool();
    const [rows] = await p.execute(mysqlText, params);
    return { rows };
  },
  initPool
};

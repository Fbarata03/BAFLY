const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

const initPool = async () => {
  if (!pool) {
    // First connect without DB to create it if not exists
    const tempConn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASS
    });

    await tempConn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    await tempConn.end();

    // Now create the pool with the DB
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
};

module.exports = {
  query: async (text, params) => {
    // Convert $1, $2... to ? for MySQL
    const mysqlText = text.replace(/\$\d+/g, '?');
    const p = await initPool();
    const [rows] = await p.execute(mysqlText, params);
    return { rows };
  },
  initPool
};

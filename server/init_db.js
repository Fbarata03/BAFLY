const db = require('./db');

const createTables = async () => {
  try {
    console.log("Initializing MySQL tables...");
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255),
        gender VARCHAR(50),
        country VARCHAR(50),
        is_banned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await db.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await db.query('ALTER TABLE users MODIFY username VARCHAR(255) NOT NULL');
    } catch (e) {}

    try {
      await db.query('ALTER TABLE users ADD COLUMN provider VARCHAR(50) NULL');
    } catch (e) {}

    try {
      await db.query('ALTER TABLE users ADD COLUMN provider_id VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await db.query('ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await db.query('ALTER TABLE users ADD COLUMN display_name VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await db.query('CREATE UNIQUE INDEX users_provider_unique ON users (provider, provider_id)');
    } catch (e) {}

    try {
      await db.query('ALTER TABLE reports ADD COLUMN screenshot MEDIUMTEXT NULL');
    } catch (e) {}

    await db.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id VARCHAR(255),
        user1_id VARCHAR(255),
        user2_id VARCHAR(255),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        end_reason VARCHAR(255)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id VARCHAR(255),
        text TEXT,
        sender_socket VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id VARCHAR(255),
        reported_id VARCHAR(255),
        reason VARCHAR(255),
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS bans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255),
        ip VARCHAR(255),
        reason TEXT,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS stats_daily (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE UNIQUE,
        total_sessions INT DEFAULT 0,
        avg_session_time INT DEFAULT 0
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS online_now (
        id INT AUTO_INCREMENT PRIMARY KEY,
        socket_id VARCHAR(255) UNIQUE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS oauth_states (
        state VARCHAR(64) PRIMARY KEY,
        provider VARCHAR(32) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Limpar online_now ao arrancar (entradas antigas de sessões anteriores)
    await db.query('DELETE FROM online_now WHERE 1=1').catch(() => {});

    console.log("MySQL tables initialized successfully!");
  } catch (err) {
    console.error("Error initializing MySQL tables:", err);
  }
};

module.exports = createTables;

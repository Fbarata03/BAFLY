-- BAFLY Database Schema
-- Created for cloud deployment (AWS RDS, Google Cloud SQL, Azure, etc.)

CREATE DATABASE IF NOT EXISTS bafly;
USE bafly;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  gender VARCHAR(50),
  country VARCHAR(50),
  is_banned BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255) NULL,
  provider VARCHAR(50) NULL,
  provider_id VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  display_name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX users_provider_unique (provider, provider_id)
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(255),
  user1_id VARCHAR(255),
  user2_id VARCHAR(255),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  end_reason VARCHAR(255)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(255),
  text TEXT,
  sender_socket VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id VARCHAR(255),
  reported_id VARCHAR(255),
  reason VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bans Table
CREATE TABLE IF NOT EXISTS bans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255),
  ip VARCHAR(255),
  reason TEXT,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Statistics Table
CREATE TABLE IF NOT EXISTS stats_daily (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE UNIQUE,
  total_sessions INT DEFAULT 0,
  avg_session_time INT DEFAULT 0
);

-- Online Now Table
CREATE TABLE IF NOT EXISTS online_now (
  id INT AUTO_INCREMENT PRIMARY KEY,
  socket_id VARCHAR(255) UNIQUE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

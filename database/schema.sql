-- Database schema for VROOM Traffic AI
CREATE DATABASE IF NOT EXISTS vroomdb;
USE vroomdb;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    disabled BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- Simulation Results table for model comparison
CREATE TABLE IF NOT EXISTS simulation_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    strategy VARCHAR(255) NOT NULL,
    model_name VARCHAR(255) DEFAULT 'N/A',
    scenario VARCHAR(255) NOT NULL,
    network VARCHAR(255) DEFAULT 'Hasselt XL',
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    avg_queue FLOAT NOT NULL,
    avg_speed FLOAT NOT NULL DEFAULT 0.0,
    avg_wait_time FLOAT NOT NULL,
    teleports INT NOT NULL,
    throughput INT NOT NULL,
    total_vehicles INT NOT NULL DEFAULT 0,
    total_steps INT NOT NULL,
    data_points LONGTEXT NOT NULL
);

-- Simulation Presets table for user-specific settings
CREATE TABLE IF NOT EXISTS simulation_presets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    scenario VARCHAR(255) NOT NULL,
    strategy VARCHAR(255) NOT NULL,
    update_interval INT NOT NULL,
    sam_model VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_scenario (user_id, scenario)
);


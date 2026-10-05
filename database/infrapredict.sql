CREATE DATABASE IF NOT EXISTS infrapredict CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE infrapredict;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NULL,
  mobile VARCHAR(15) UNIQUE NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('citizen','admin') NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(40) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  citizen_name VARCHAR(100) NOT NULL,
  citizen_mobile VARCHAR(15) NOT NULL,
  citizen_email VARCHAR(150) NOT NULL,
  infrastructure VARCHAR(100) NOT NULL,
  severity ENUM('Critical','High','Medium','Low') NOT NULL,
  location VARCHAR(255) DEFAULT '',
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  description TEXT,
  department VARCHAR(150) NOT NULL,
  risk INT NOT NULL DEFAULT 25,
  status ENUM('Pending','In Progress','Resolved') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaint_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_complaint_user(user_id),
  INDEX idx_complaint_status(status),
  INDEX idx_complaint_department(department)
);

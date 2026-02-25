-- Database: booking_app

CREATE DATABASE IF NOT EXISTS booking_app;
USE booking_app;

-- Users (for login + roles)

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venues and events

CREATE TABLE IF NOT EXISTS venues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  state_code VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  venue_id INT NOT NULL,
  event_datetime DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- Seat sections and seats

CREATE TABLE IF NOT EXISTS seat_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  booking_fee_type ENUM('FLAT', 'PERCENT') NOT NULL DEFAULT 'FLAT',
  booking_fee_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  section_id INT NOT NULL,
  seat_label VARCHAR(50) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  status ENUM('AVAILABLE', 'BOOKED') NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_seat (event_id, seat_label),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (section_id) REFERENCES seat_sections(id)
);

-- Seat locking for concurrency control

CREATE TABLE IF NOT EXISTS seat_locks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  seat_id INT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  locked_until DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_lock_event_seat (event_id, seat_id),
  INDEX idx_lock_expiry (locked_until),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);

-- Coupons

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  discount_type ENUM('FLAT', 'PERCENT') NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  max_discount_amount DECIMAL(10,2) DEFAULT NULL,
  min_order_value DECIMAL(10,2) DEFAULT 0,
  expiry_at DATETIME NOT NULL,
  global_usage_limit INT DEFAULT NULL,
  per_user_limit INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_events (
  coupon_id INT NOT NULL,
  event_id INT NOT NULL,
  PRIMARY KEY (coupon_id, event_id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  booking_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_coupon_user (coupon_id, user_id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id)
);

-- Bookings

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  event_id INT NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL,
  booking_fee_amount DECIMAL(10,2) NOT NULL,
  coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_cgst DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_sgst DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_igst DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  payment_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS booking_seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  seat_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_booking_seat (booking_id, seat_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);


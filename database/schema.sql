-- CineOpt database schema (MySQL 8)
CREATE DATABASE IF NOT EXISTS cineopt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cineopt;

CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS theatres (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150) NOT NULL,
  `rows`      SMALLINT UNSIGNED NOT NULL,
  `columns`   SMALLINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_theatres_size CHECK (`rows` > 0 AND `columns` > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS seats (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  theatre_id    INT UNSIGNED NOT NULL,
  `row_number`  SMALLINT UNSIGNED NOT NULL,
  seat_number   SMALLINT UNSIGNED NOT NULL,
  seat_label    VARCHAR(10) NOT NULL,
  x_coordinate  DECIMAL(7,2) NOT NULL,
  y_coordinate  DECIMAL(7,2) NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  seat_type     ENUM('standard', 'premium', 'recliner') NOT NULL DEFAULT 'standard',
  status        ENUM('available', 'booked') NOT NULL DEFAULT 'available',
  PRIMARY KEY (id),
  UNIQUE KEY uq_seats_position (theatre_id, `row_number`, seat_number),
  UNIQUE KEY uq_seats_label (theatre_id, seat_label),
  KEY idx_seats_theatre_status (theatre_id, status),
  CONSTRAINT fk_seats_theatre FOREIGN KEY (theatre_id) REFERENCES theatres (id) ON DELETE CASCADE,
  CONSTRAINT chk_seats_price CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  theatre_id      INT UNSIGNED NOT NULL,
  total_price     DECIMAL(10,2) NOT NULL,
  algorithm_used  ENUM('greedy', 'knapsack', 'genetic', 'manual') NOT NULL DEFAULT 'manual',
  fitness_score   DECIMAL(6,2) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bookings_user (user_id, created_at),
  KEY idx_bookings_theatre (theatre_id),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_theatre FOREIGN KEY (theatre_id) REFERENCES theatres (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- UNIQUE(seat_id): a seat can belong to at most one booking, enforced by the database itself.
CREATE TABLE IF NOT EXISTS booking_seats (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id  INT UNSIGNED NOT NULL,
  seat_id     INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_booking_seats_seat (seat_id),
  UNIQUE KEY uq_booking_seats_pair (booking_id, seat_id),
  CONSTRAINT fk_booking_seats_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_seats_seat FOREIGN KEY (seat_id) REFERENCES seats (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_requests (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id              INT UNSIGNED NOT NULL,
  theatre_id           INT UNSIGNED NOT NULL,
  people_count         SMALLINT UNSIGNED NOT NULL,
  max_budget           DECIMAL(10,2) NOT NULL,
  preferred_region     ENUM('front', 'center', 'back', 'left', 'right', 'anywhere') NOT NULL DEFAULT 'anywhere',
  togetherness_weight  DECIMAL(3,2) NOT NULL,
  preference_weight    DECIMAL(3,2) NOT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_booking_requests_user (user_id),
  KEY idx_booking_requests_theatre (theatre_id),
  CONSTRAINT fk_booking_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_requests_theatre FOREIGN KEY (theatre_id) REFERENCES theatres (id) ON DELETE CASCADE,
  CONSTRAINT chk_requests_people CHECK (people_count BETWEEN 1 AND 20),
  CONSTRAINT chk_requests_weights CHECK (togetherness_weight BETWEEN 0 AND 1 AND preference_weight BETWEEN 0 AND 1)
) ENGINE=InnoDB;

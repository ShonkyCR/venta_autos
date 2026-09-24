-- =======================================================
-- SCRIPT SQL PARA PHPMYADMIN / MYSQL (BASE DE DATOS: venta_autos)
-- =======================================================

CREATE DATABASE IF NOT EXISTS `venta_autos` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `venta_autos`;

-- 1. Tabla de Usuarios Administradores
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `salt` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de Sesiones Activas
CREATE TABLE IF NOT EXISTS `sessions` (
  `token` VARCHAR(255) PRIMARY KEY,
  `user_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabla de Vehículos
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `brand` VARCHAR(100) NOT NULL,
  `model` VARCHAR(100) NOT NULL,
  `year` INT NOT NULL,
  `price` DECIMAL(15, 2) NOT NULL,
  `currency` VARCHAR(10) DEFAULT 'CRC',
  `mileage` INT DEFAULT 0,
  `vehicle_type` VARCHAR(50) DEFAULT 'SUV',
  `transmission` VARCHAR(50) DEFAULT 'Automática',
  `fuel` VARCHAR(50) DEFAULT 'Gasolina',
  `status` VARCHAR(50) DEFAULT 'Publicado',
  `featured` TINYINT(1) DEFAULT 0,
  `description` TEXT,
  `image` VARCHAR(255) DEFAULT 'sedan.jpeg',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabla de Consultas de Clientes (Leads)
CREATE TABLE IF NOT EXISTS `leads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `vehicle_id` INT NULL,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50),
  `email` VARCHAR(150),
  `message` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =======================================================
-- DATOS DE MUESTRA (ADMIN + 5 VEHÍCULOS EN COLONES CRC)
-- =======================================================

-- Limpieza preventiva
DELETE FROM `sessions`;
DELETE FROM `users`;
DELETE FROM `vehicles`;

-- Insertar Usuario Administrador Predeterminado (usuario: admin | clave: admin123)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`) VALUES
(1, 'admin', 'admin@autofolio.cr', '1af03cc8d00a1f8a621966ce6701194334d29f27c27fb50ab52a402b8af202e4d36cc9282d4ebe681571dcec74495628eb36d4527019222cadb1630ac5455a08', 'a1b2c3d4e5f678901234567890abcdef', 'admin');

-- Insertar 5 Autos de Muestra con Precios en Colones (CRC)
INSERT INTO `vehicles` (`id`, `brand`, `model`, `year`, `price`, `currency`, `mileage`, `vehicle_type`, `transmission`, `fuel`, `status`, `featured`, `description`, `image`) VALUES
(101, 'Toyota', 'Hilux SRV 4x4', 2023, 24500000.00, 'CRC', 18400, 'Pick-up', 'Automática', 'Diésel', 'Publicado', 1, 'Una pick-up lista para el trabajo y la aventura, con historial de agencia y garantía vigente.', 'pickup.jpeg'),
(102, 'BMW', 'X5 xDrive40i', 2022, 36800000.00, 'CRC', 22100, 'SUV', 'Automática', 'Gasolina', 'Publicado', 1, 'Confort premium, tecnología intuitiva y una presencia que se nota desde cualquier ángulo.', 'luxury-black.jpeg'),
(103, 'Mercedes-Benz', 'C 200 AMG Line', 2024, 34200000.00, 'CRC', 7800, 'Sedán', 'Automática', 'Híbrido', 'Publicado', 1, 'Diseño sofisticado y una experiencia de conducción silenciosa, ágil y conectada.', 'sedan.jpeg'),
(104, 'Ford', 'Ranger Wildtrak', 2023, 27500000.00, 'CRC', 12600, 'Pick-up', 'Automática', 'Diésel', 'Reservado', 0, 'Capacidad, seguridad y diseño robusto para moverse con confianza en cualquier terreno.', 'pickup.jpeg'),
(105, 'Hyundai', 'Tucson Limited 4WD', 2023, 18900000.00, 'CRC', 15200, 'SUV', 'Automática', 'Gasolina', 'Publicado', 1, 'Espacio familiar con acabados de lujo, tracción integral y excelente rendimiento de combustible.', 'luxury-black.jpeg');

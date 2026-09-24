const mysql = require('mysql2/promise');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

let useMySQL = false;
let mysqlPool = null;
let sqliteDb = null;

// Encriptación de contraseñas
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

// Inicializar Conexión a Base de Datos
async function initDatabase() {
  const passwordsToTry = [process.env.DB_PASSWORD, '123456', '', 'root', 'admin'].filter(p => p !== undefined);

  for (const pwd of passwordsToTry) {
    try {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: pwd,
        port: Number(process.env.DB_PORT) || 3306
      });
      await conn.query('CREATE DATABASE IF NOT EXISTS `venta_autos` DEFAULT CHARACTER SET utf8mb4;');
      await conn.end();

      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: pwd,
        database: 'venta_autos',
        port: Number(process.env.DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10
      });

      useMySQL = true;
      console.log('✓ Conectado a la base de datos MySQL (venta_autos)');
      break;
    } catch (err) {
      // Intentar siguiente contraseña
    }
  }

  if (useMySQL) {
    await setupMySQLSchema();
  } else {
    console.log('⚠️ No se pudo conectar a MySQL local, usando SQLite como respaldo.');
    setupSQLiteSchema();
  }
}

// Configuración de Esquema MySQL
async function setupMySQLSchema() {
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      salt VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(255) PRIMARY KEY,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brand VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      year INT NOT NULL,
      price DECIMAL(15,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'CRC',
      mileage INT DEFAULT 0,
      vehicle_type VARCHAR(50) DEFAULT 'SUV',
      transmission VARCHAR(50) DEFAULT 'Automática',
      fuel VARCHAR(50) DEFAULT 'Gasolina',
      status VARCHAR(50) DEFAULT 'Publicado',
      featured TINYINT(1) DEFAULT 0,
      description TEXT,
      image VARCHAR(255) DEFAULT 'sedan.jpeg',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vehicle_id INT NULL,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(150),
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Sembrar Usuario Admin si la tabla está vacía
  const [users] = await mysqlPool.query('SELECT COUNT(*) as count FROM users');
  if (users[0].count === 0) {
    const { salt, hash } = hashPassword('admin123');
    await mysqlPool.query(
      'INSERT INTO users (username, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin@autofolio.cr', hash, salt, 'admin']
    );
    console.log('✓ Usuario admin predeterminado creado (admin / admin123)');
  }

  // Sembrar Vehículos de muestra si la tabla está vacía
  const [vehicles] = await mysqlPool.query('SELECT COUNT(*) as count FROM vehicles');
  if (vehicles[0].count === 0) {
    const seed = [
      [101, 'Toyota', 'Hilux SRV 4x4', 2023, 24500000, 'CRC', 18400, 'Pick-up', 'Automática', 'Diésel', 'Publicado', 1, 'Una pick-up lista para el trabajo y la aventura, con historial de agencia y garantía vigente.', 'pickup.jpeg'],
      [102, 'BMW', 'X5 xDrive40i', 2022, 36800000, 'CRC', 22100, 'SUV', 'Automática', 'Gasolina', 'Publicado', 1, 'Confort premium, tecnología intuitiva y una presencia que se nota desde cualquier ángulo.', 'luxury-black.jpeg'],
      [103, 'Mercedes-Benz', 'C 200 AMG Line', 2024, 34200000, 'CRC', 7800, 'Sedán', 'Automática', 'Híbrido', 'Publicado', 1, 'Diseño sofisticado y una experiencia de conducción silenciosa, ágil y conectada.', 'sedan.jpeg'],
      [104, 'Ford', 'Ranger Wildtrak', 2023, 27500000, 'CRC', 12600, 'Pick-up', 'Automática', 'Diésel', 'Reservado', 0, 'Capacidad, seguridad y diseño robusto para moverse con confianza en cualquier terreno.', 'pickup.jpeg'],
      [105, 'Hyundai', 'Tucson Limited 4WD', 2023, 18900000, 'CRC', 15200, 'SUV', 'Automática', 'Gasolina', 'Publicado', 1, 'Espacio familiar con acabados de lujo, tracción integral y excelente rendimiento de combustible.', 'luxury-black.jpeg']
    ];

    for (const v of seed) {
      await mysqlPool.query(
        'INSERT INTO vehicles (id, brand, model, year, price, currency, mileage, vehicle_type, transmission, fuel, status, featured, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        v
      );
    }
    console.log('✓ 5 vehículos de muestra insertados en Colones (CRC)');
  }
}

// Configuración de Esquema SQLite Respaldo
function setupSQLiteSchema() {
  sqliteDb = new DatabaseSync(path.join(__dirname, 'database.sqlite'));
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'CRC',
      mileage INTEGER DEFAULT 0,
      vehicle_type TEXT DEFAULT 'SUV',
      transmission TEXT DEFAULT 'Automática',
      fuel TEXT DEFAULT 'Gasolina',
      status TEXT DEFAULT 'Publicado',
      featured INTEGER DEFAULT 0,
      description TEXT,
      image TEXT DEFAULT 'sedan.jpeg',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const userCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCheck.count === 0) {
    const { salt, hash } = hashPassword('admin123');
    sqliteDb.prepare('INSERT INTO users (username, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)').run('admin', 'admin@autofolio.cr', hash, salt, 'admin');
  }

  const vehicleCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM vehicles').get();
  if (vehicleCheck.count === 0) {
    const seed = [
      [101, 'Toyota', 'Hilux SRV 4x4', 2023, 24500000, 'CRC', 18400, 'Pick-up', 'Automática', 'Diésel', 'Publicado', 1, 'Una pick-up lista para el trabajo y la aventura, con historial de agencia y garantía vigente.', 'pickup.jpeg'],
      [102, 'BMW', 'X5 xDrive40i', 2022, 36800000, 'CRC', 22100, 'SUV', 'Automática', 'Gasolina', 'Publicado', 1, 'Confort premium, tecnología intuitiva y una presencia que se nota desde cualquier ángulo.', 'luxury-black.jpeg'],
      [103, 'Mercedes-Benz', 'C 200 AMG Line', 2024, 34200000, 'CRC', 7800, 'Sedán', 'Automática', 'Híbrido', 'Publicado', 1, 'Diseño sofisticado y una experiencia de conducción silenciosa, ágil y conectada.', 'sedan.jpeg'],
      [104, 'Ford', 'Ranger Wildtrak', 2023, 27500000, 'CRC', 12600, 'Pick-up', 'Automática', 'Diésel', 'Reservado', 0, 'Capacidad, seguridad y diseño robusto para moverse con confianza en cualquier terreno.', 'pickup.jpeg'],
      [105, 'Hyundai', 'Tucson Limited 4WD', 2023, 18900000, 'CRC', 15200, 'SUV', 'Automática', 'Gasolina', 'Publicado', 1, 'Espacio familiar con acabados de lujo, tracción integral y excelente rendimiento de combustible.', 'luxury-black.jpeg']
    ];
    for (const v of seed) {
      sqliteDb.prepare('INSERT INTO vehicles (id, brand, model, year, price, currency, mileage, vehicle_type, transmission, fuel, status, featured, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...v);
    }
  }
}

// --- MÉTODOS DE AUTENTICACIÓN Y USUARIOS ---

async function loginUser(usernameOrEmail, password) {
  if (useMySQL) {
    const [rows] = await mysqlPool.query('SELECT * FROM users WHERE username = ? OR email = ?', [usernameOrEmail, usernameOrEmail]);
    const user = rows[0];
    if (!user) return null;
    if (!verifyPassword(password, user.salt, user.password_hash)) return null;

    const token = crypto.randomBytes(32).toString('hex');
    await mysqlPool.query('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, user.id]);

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    };
  } else {
    const user = sqliteDb.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(usernameOrEmail, usernameOrEmail);
    if (!user) return null;
    if (!verifyPassword(password, user.salt, user.password_hash)) return null;

    const token = crypto.randomBytes(32).toString('hex');
    sqliteDb.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    };
  }
}

async function getUserByToken(token) {
  if (!token) return null;
  if (useMySQL) {
    const [rows] = await mysqlPool.query(`
      SELECT u.id, u.username, u.email, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `, [token]);
    return rows[0] || null;
  } else {
    return sqliteDb.prepare(`
      SELECT u.id, u.username, u.email, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `).get(token) || null;
  }
}

async function logoutUser(token) {
  if (!token) return;
  if (useMySQL) {
    await mysqlPool.query('DELETE FROM sessions WHERE token = ?', [token]);
  } else {
    sqliteDb.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
}

async function createUser({ username, email, password, role = 'admin' }) {
  const { salt, hash } = hashPassword(password);
  if (useMySQL) {
    const [res] = await mysqlPool.query('INSERT INTO users (username, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)', [username, email, hash, salt, role]);
    return { id: res.insertId, username, email, role };
  } else {
    const res = sqliteDb.prepare('INSERT INTO users (username, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)').run(username, email, hash, salt, role);
    return { id: Number(res.lastInsertRowid), username, email, role };
  }
}

async function getAllUsers() {
  if (useMySQL) {
    const [rows] = await mysqlPool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id DESC');
    return rows;
  } else {
    return sqliteDb.prepare('SELECT id, username, email, role, created_at FROM users ORDER BY id DESC').all();
  }
}

async function deleteUser(id) {
  if (useMySQL) {
    await mysqlPool.query('DELETE FROM users WHERE id = ?', [id]);
  } else {
    sqliteDb.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}

// --- MÉTODOS DE VEHÍCULOS ---

function formatVehicleRow(row) {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    year: row.year,
    price: Number(row.price),
    currency: row.currency || 'CRC',
    mileage: row.mileage,
    vehicleType: row.vehicle_type,
    transmission: row.transmission,
    fuel: row.fuel,
    status: row.status,
    featured: Boolean(row.featured),
    description: row.description,
    image: row.image,
    createdAt: row.created_at
  };
}

async function getAllVehicles() {
  if (useMySQL) {
    const [rows] = await mysqlPool.query('SELECT * FROM vehicles ORDER BY id DESC');
    return rows.map(formatVehicleRow);
  } else {
    const rows = sqliteDb.prepare('SELECT * FROM vehicles ORDER BY id DESC').all();
    return rows.map(formatVehicleRow);
  }
}

async function getVehicleById(id) {
  if (useMySQL) {
    const [rows] = await mysqlPool.query('SELECT * FROM vehicles WHERE id = ?', [id]);
    return rows[0] ? formatVehicleRow(rows[0]) : null;
  } else {
    const row = sqliteDb.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
    return row ? formatVehicleRow(row) : null;
  }
}

async function createVehicle(v) {
  const brand = v.brand;
  const model = v.model;
  const year = Number(v.year) || 2025;
  const price = Number(v.price) || 0;
  const currency = v.currency || 'CRC';
  const mileage = Number(v.mileage) || 0;
  const vehicleType = v.vehicleType || v.vehicle_type || 'SUV';
  const transmission = v.transmission || 'Automática';
  const fuel = v.fuel || 'Gasolina';
  const status = v.status || 'Publicado';
  const featured = v.featured ? 1 : 0;
  const description = v.description || '';
  const image = v.image || 'sedan.jpeg';

  if (useMySQL) {
    const [res] = await mysqlPool.query(`
      INSERT INTO vehicles (brand, model, year, price, currency, mileage, vehicle_type, transmission, fuel, status, featured, description, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [brand, model, year, price, currency, mileage, vehicleType, transmission, fuel, status, featured, description, image]);
    return getVehicleById(res.insertId);
  } else {
    const res = sqliteDb.prepare(`
      INSERT INTO vehicles (brand, model, year, price, currency, mileage, vehicle_type, transmission, fuel, status, featured, description, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(brand, model, year, price, currency, mileage, vehicleType, transmission, fuel, status, featured, description, image);
    return getVehicleById(res.lastInsertRowid);
  }
}

async function updateVehicle(id, v) {
  const brand = v.brand;
  const model = v.model;
  const year = Number(v.year) || 2025;
  const price = Number(v.price) || 0;
  const currency = v.currency || 'CRC';
  const mileage = Number(v.mileage) || 0;
  const vehicleType = v.vehicleType || v.vehicle_type || 'SUV';
  const transmission = v.transmission || 'Automática';
  const fuel = v.fuel || 'Gasolina';
  const status = v.status || 'Publicado';
  const featured = v.featured ? 1 : 0;
  const description = v.description || '';
  const image = v.image || 'sedan.jpeg';

  if (useMySQL) {
    await mysqlPool.query(`
      UPDATE vehicles
      SET brand = ?, model = ?, year = ?, price = ?, currency = ?, mileage = ?,
          vehicle_type = ?, transmission = ?, fuel = ?, status = ?, featured = ?,
          description = ?, image = ?
      WHERE id = ?
    `, [brand, model, year, price, currency, mileage, vehicleType, transmission, fuel, status, featured, description, image, id]);
    return getVehicleById(id);
  } else {
    sqliteDb.prepare(`
      UPDATE vehicles
      SET brand = ?, model = ?, year = ?, price = ?, currency = ?, mileage = ?,
          vehicle_type = ?, transmission = ?, fuel = ?, status = ?, featured = ?,
          description = ?, image = ?
      WHERE id = ?
    `).run(brand, model, year, price, currency, mileage, vehicleType, transmission, fuel, status, featured, description, image, id);
    return getVehicleById(id);
  }
}

async function deleteVehicle(id) {
  if (useMySQL) {
    await mysqlPool.query('DELETE FROM vehicles WHERE id = ?', [id]);
  } else {
    sqliteDb.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
  }
}

async function createLead({ vehicle_id, name, phone, email, message }) {
  if (useMySQL) {
    const [res] = await mysqlPool.query('INSERT INTO leads (vehicle_id, name, phone, email, message) VALUES (?, ?, ?, ?, ?)', [vehicle_id || null, name, phone || '', email || '', message || '']);
    return { id: res.insertId };
  } else {
    const res = sqliteDb.prepare('INSERT INTO leads (vehicle_id, name, phone, email, message) VALUES (?, ?, ?, ?, ?)').run(vehicle_id || null, name, phone || '', email || '', message || '');
    return { id: Number(res.lastInsertRowid) };
  }
}

module.exports = {
  initDatabase,
  loginUser,
  getUserByToken,
  logoutUser,
  createUser,
  getAllUsers,
  deleteUser,
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  createLead
};

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir archivos estáticos
app.use(express.static(__dirname));

// Middleware de autenticación opcional
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado. Inicie sesión.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const user = await db.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error verificando sesión' });
  }
}

// --- RUTAS DE AUTENTICACIÓN Y USUARIOS ---

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario/correo y contraseña son requeridos.' });
  }

  try {
    const result = await db.loginUser(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Credenciales incorrectas. Verifique usuario y contraseña.' });
    }
    res.json({ message: 'Inicio de sesión exitoso', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Error en inicio de sesión: ' + err.message });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await db.logoutUser(req.token);
    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authMiddleware, async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios (usuario, correo y clave).' });
  }
  try {
    const newUser = await db.createUser({ username, email, password, role: role || 'admin' });
    res.status(201).json(newUser);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'El nombre de usuario o correo ya está registrado.' });
    }
    res.status(500).json({ error: 'Error al crear el usuario: ' + err.message });
  }
});

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  const userId = Number(req.params.id);
  if (req.user.id === userId) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario en uso.' });
  }
  try {
    await db.deleteUser(userId);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SUBIDA DE FOTOS DESDE EL EQUIPO ---
const UPLOAD_MIME = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

app.post('/api/upload', authMiddleware, async (req, res) => {
  const data = req.body && req.body.data;
  const match = typeof data === 'string'
    ? data.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/i)
    : null;

  if (!match) {
    return res.status(400).json({ error: 'Imagen no válida. Formatos permitidos: JPG, PNG, WEBP o GIF.' });
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) {
    return res.status(400).json({ error: 'No se pudo leer la imagen.' });
  }
  if (buffer.length > 8 * 1024 * 1024) {
    return res.status(413).json({ error: 'La imagen supera el máximo de 8 MB.' });
  }

  const ext = UPLOAD_MIME[match[1].toLowerCase()] || 'jpg';
  const name = `vehiculo-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  const assetsDir = path.join(__dirname, 'assets');

  try {
    await fs.promises.mkdir(assetsDir, { recursive: true });
    await fs.promises.writeFile(path.join(assetsDir, name), buffer);
    res.json({ name });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar la imagen: ' + err.message });
  }
});

// --- RUTAS DE VEHÍCULOS (CRUD) ---

app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await db.getAllVehicles();
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await db.getVehicleById(Number(req.params.id));
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado.' });
    }
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicles', authMiddleware, async (req, res) => {
  const { brand, model, year, price } = req.body;
  if (!brand || !model || !year || !price) {
    return res.status(400).json({ error: 'Marca, modelo, año y precio son requeridos.' });
  }
  try {
    const newVehicle = await db.createVehicle(req.body);
    res.status(201).json(newVehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vehicles/:id', authMiddleware, async (req, res) => {
  const vehicleId = Number(req.params.id);
  try {
    const existing = await db.getVehicleById(vehicleId);
    if (!existing) {
      return res.status(404).json({ error: 'El vehículo a editar no existe.' });
    }
    const updated = await db.updateVehicle(vehicleId, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:id', authMiddleware, async (req, res) => {
  const vehicleId = Number(req.params.id);
  try {
    const existing = await db.getVehicleById(vehicleId);
    if (!existing) {
      return res.status(404).json({ error: 'El vehículo a eliminar no existe.' });
    }
    await db.deleteVehicle(vehicleId);
    res.json({ message: 'Vehículo eliminado con éxito.', id: vehicleId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads', async (req, res) => {
  const { vehicle_id, name, phone, email, message } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  try {
    const lead = await db.createLead({ vehicle_id, name, phone, email, message });
    res.status(201).json({ message: 'Consulta registrada exitosamente', lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inicializar la base de datos y arrancar el servidor
db.initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor activo en: http://localhost:${PORT}`);
    console.log(`💾 Base de datos activa: MySQL (venta_autos)`);
    console.log(`🔑 Administrador: admin / admin123`);
    console.log(`====================================================`);
  });
}).catch(err => {
  console.error('Error fatal inicializando BD:', err);
});

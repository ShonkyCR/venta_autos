# AutoFolio CR — Sistema de Venta de Autos con Base de Datos SQLite

Esta aplicación ahora incluye un servidor backend Node.js y una base de datos local **SQLite** (`database.sqlite`) para gestionar de forma persistente los usuarios administradores y el inventario de vehículos con todas sus acciones CRUD.

## Características Principales

1. **Gestión de Usuarios Administradores (Seguridad):**
   - Inicio de sesión seguro con contraseñas encriptadas (PBKDF2/SHA-512) y gestión de tokens de sesión.
   - Protección de rutas y del panel administrativo.
   - Posibilidad de registrar nuevos usuarios administradores o eliminar existentes.
   - **Credenciales por defecto:**
     - **Usuario:** `admin`
     - **Contraseña:** `admin123`

2. **Base de Datos de Vehículos (CRUD Completo):**
   - **Crear / Guardar:** Permite agregar nuevos vehículos con todos sus detalles (marca, modelo, año, precio, tipo, transmisión, combustible, etc.).
   - **Leer:** Muestra el catálogo en vivo con filtros de búsqueda por palabra clave, tipo y combustible.
   - **Editar:** Modifica los datos de cualquier vehículo en la base de datos con actualización inmediata.
   - **Eliminar:** Elimina vehículos del sistema con confirmación de seguridad.

3. **Captura de Consultas (Leads):**
   - Guarda en la base de datos las consultas registradas por los clientes desde las fichas de los vehículos.

---

## Cómo Ejecutar la Aplicación

1. **Instalar dependencias (Express y Cors):**
   ```bash
   npm install
   ```

2. **Iniciar el Servidor y la Base de Datos:**
   ```bash
   npm start
   ```

3. **Abrir en el Navegador:**
   Visita `http://localhost:3000` en tu navegador.

---

## Rutas y Secciones

- `#/` — Página principal con vehículos destacados.
- `#/catalog` — Catálogo interactivo con filtros de búsqueda.
- `#/vehicle/:id` — Ficha de vehículo con formulario de contacto y enlace a WhatsApp.
- `#/login` — Pantalla de inicio de sesión para administradores.
- `#/admin` — Panel de administración para gestionar autos y usuarios.

---

## Estructura del Proyecto

- `server.js` — Servidor Express y API REST (`/api/auth`, `/api/vehicles`, `/api/users`, `/api/leads`).
- `database.js` — Controlador de la base de datos SQLite con `node:sqlite`.
- `database.sqlite` — Archivo de la base de datos local (se crea automáticamente si no existe).
- `app.js` — Lógica frontend e integración con el backend.
- `styles.css` — Estilos de la aplicación, formularios y panel admin.
- `index.html` — Archivo HTML principal.
- `assets/` — Galería de imágenes de los vehículos.

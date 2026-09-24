<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Conexión a MySQL en XAMPP
$db_host = 'localhost';
$db_name = 'venta_autos';
$passwords = ['123456', '', 'root', 'admin'];
$pdo = null;

foreach ($passwords as $pwd) {
    try {
        $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", 'root', $pwd, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        break;
    } catch (Exception $e) {
        // Probar siguiente clave
    }
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo conectar a la base de datos MySQL venta_autos. Verifique XAMPP.']);
    exit;
}

// Asegurar columna 'images' para múltiples fotos
try {
    $pdo->exec("ALTER TABLE vehicles ADD COLUMN images TEXT NULL;");
} catch (Exception $e) { }

// Helper para usuario autenticado por token
function getAuthUser($pdo) {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($headers['authorization']) ? $headers['authorization'] : '');
    if (!$authHeader || strpos($authHeader, 'Bearer ') !== 0) {
        return null;
    }
    $token = trim(substr($authHeader, 7));
    $stmt = $pdo->prepare("SELECT u.id, u.username, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?");
    $stmt->execute([$token]);
    return $stmt->fetch() ?: null;
}

$method = $_SERVER['REQUEST_METHOD'];
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (!$endpoint) {
    if (strpos($path, '/api/vehicles') !== false) $endpoint = 'vehicles';
    else if (strpos($path, '/api/auth/login') !== false) $endpoint = 'login';
    else if (strpos($path, '/api/auth/me') !== false) $endpoint = 'me';
    else if (strpos($path, '/api/auth/logout') !== false) $endpoint = 'logout';
    else if (strpos($path, '/api/users') !== false) $endpoint = 'users';
    else if (strpos($path, '/api/leads') !== false) $endpoint = 'leads';
}

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// --- ENDPOINT: VEHICLES ---
if ($endpoint === 'vehicles' || strpos($path, 'vehicles') !== false) {
    if ($method === 'GET') {
        if ($id > 0) {
            $stmt = $pdo->prepare("SELECT * FROM vehicles WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['error' => 'Vehículo no encontrado']);
                exit;
            }
            echo json_encode(formatVehicle($row));
            exit;
        }

        $stmt = $pdo->query("SELECT * FROM vehicles ORDER BY id DESC");
        $rows = $stmt->fetchAll();
        $list = array_map('formatVehicle', $rows);
        echo json_encode($list);
        exit;
    }

    $user = getAuthUser($pdo);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Acceso no autorizado']);
        exit;
    }

    $rawImages = isset($input['images']) ? (is_array($input['images']) ? json_encode($input['images']) : $input['images']) : '';

    if ($method === 'POST') {
        $stmt = $pdo->prepare("INSERT INTO vehicles (brand, model, year, price, currency, mileage, vehicle_type, transmission, fuel, status, featured, description, image, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['brand'] ?? '',
            $input['model'] ?? '',
            (int)($input['year'] ?? 2025),
            (float)($input['price'] ?? 0),
            $input['currency'] ?? 'CRC',
            (int)($input['mileage'] ?? 0),
            $input['vehicleType'] ?? $input['vehicle_type'] ?? 'SUV',
            $input['transmission'] ?? 'Automática',
            $input['fuel'] ?? 'Gasolina',
            $input['status'] ?? 'Publicado',
            !empty($input['featured']) ? 1 : 0,
            $input['description'] ?? '',
            $input['image'] ?? 'sedan.jpeg',
            $rawImages
        ]);
        $newId = $pdo->lastInsertId();
        $stmtSel = $pdo->prepare("SELECT * FROM vehicles WHERE id = ?");
        $stmtSel->execute([$newId]);
        echo json_encode(formatVehicle($stmtSel->fetch()));
        exit;
    }

    if ($method === 'PUT' && $id > 0) {
        $stmt = $pdo->prepare("UPDATE vehicles SET brand=?, model=?, year=?, price=?, currency=?, mileage=?, vehicle_type=?, transmission=?, fuel=?, status=?, featured=?, description=?, image=?, images=? WHERE id=?");
        $stmt->execute([
            $input['brand'] ?? '',
            $input['model'] ?? '',
            (int)($input['year'] ?? 2025),
            (float)($input['price'] ?? 0),
            $input['currency'] ?? 'CRC',
            (int)($input['mileage'] ?? 0),
            $input['vehicleType'] ?? $input['vehicle_type'] ?? 'SUV',
            $input['transmission'] ?? 'Automática',
            $input['fuel'] ?? 'Gasolina',
            $input['status'] ?? 'Publicado',
            !empty($input['featured']) ? 1 : 0,
            $input['description'] ?? '',
            $input['image'] ?? 'sedan.jpeg',
            $rawImages,
            $id
        ]);
        $stmtSel = $pdo->prepare("SELECT * FROM vehicles WHERE id = ?");
        $stmtSel->execute([$id]);
        echo json_encode(formatVehicle($stmtSel->fetch()));
        exit;
    }

    if ($method === 'DELETE' && $id > 0) {
        $stmt = $pdo->prepare("DELETE FROM vehicles WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['message' => 'Vehículo eliminado', 'id' => $id]);
        exit;
    }
}

// --- ENDPOINT: AUTH LOGIN ---
if ($endpoint === 'login' || strpos($path, 'login') !== false) {
    if ($method === 'POST') {
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$username, $username]);
        $u = $stmt->fetch();

        if ($u) {
            $computedHash = bin2hex(hash_pbkdf2('sha512', $password, $u['salt'], 1000, 64, true));
            if ($computedHash === $u['password_hash']) {
                $token = bin2hex(random_bytes(32));
                $stmtToken = $pdo->prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)");
                $stmtToken->execute([$token, $u['id']]);
                echo json_encode([
                    'message' => 'Inicio de sesión exitoso',
                    'token' => $token,
                    'user' => ['id' => (int)$u['id'], 'username' => $u['username'], 'email' => $u['email'], 'role' => $u['role']]
                ]);
                exit;
            }
        }

        http_response_code(401);
        echo json_encode(['error' => 'Credenciales incorrectas. Verifique usuario y contraseña.']);
        exit;
    }
}

// --- ENDPOINT: AUTH ME ---
if ($endpoint === 'me' || strpos($path, 'me') !== false) {
    $user = getAuthUser($pdo);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Sesión inválida']);
        exit;
    }
    echo json_encode(['user' => $user]);
    exit;
}

// --- ENDPOINT: LOGOUT ---
if ($endpoint === 'logout' || strpos($path, 'logout') !== false) {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    if ($authHeader && strpos($authHeader, 'Bearer ') === 0) {
        $token = trim(substr($authHeader, 7));
        $stmt = $pdo->prepare("DELETE FROM sessions WHERE token = ?");
        $stmt->execute([$token]);
    }
    echo json_encode(['message' => 'Sesión cerrada']);
    exit;
}

// --- ENDPOINT: USERS ---
if ($endpoint === 'users' || strpos($path, 'users') !== false) {
    $user = getAuthUser($pdo);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Acceso no autorizado']);
        exit;
    }

    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT id, username, email, role, created_at FROM users ORDER BY id DESC");
        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($method === 'POST') {
        $uName = $input['username'] ?? '';
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        $role = $input['role'] ?? 'admin';

        $salt = bin2hex(random_bytes(16));
        $hash = bin2hex(hash_pbkdf2('sha512', $password, $salt, 1000, 64, true));

        try {
            $stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$uName, $email, $hash, $salt, $role]);
            echo json_encode(['id' => (int)$pdo->lastInsertId(), 'username' => $uName, 'email' => $email, 'role' => $role]);
            exit;
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['error' => 'El usuario o correo ya está registrado']);
            exit;
        }
    }

    if ($method === 'DELETE' && $id > 0) {
        if ($user['id'] === $id) {
            http_response_code(400);
            echo json_encode(['error' => 'No puedes eliminar tu propio usuario']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['message' => 'Usuario eliminado']);
        exit;
    }
}

// --- ENDPOINT: LEADS ---
if ($endpoint === 'leads' || strpos($path, 'leads') !== false) {
    if ($method === 'POST') {
        $stmt = $pdo->prepare("INSERT INTO leads (vehicle_id, name, phone, email, message) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            (int)($input['vehicle_id'] ?? 0),
            $input['name'] ?? '',
            $input['phone'] ?? '',
            $input['email'] ?? '',
            $input['message'] ?? ''
        ]);
        echo json_encode(['message' => 'Consulta registrada']);
        exit;
    }
}

function formatVehicle($r) {
    if (!$r) return null;
    $rawImages = isset($r['images']) && !empty($r['images']) ? $r['images'] : null;
    $imagesArray = [];
    if ($rawImages) {
        $decoded = json_decode($rawImages, true);
        if (is_array($decoded)) {
            $imagesArray = $decoded;
        } else {
            $imagesArray = array_filter(array_map('trim', explode(',', $rawImages)));
        }
    }
    if (empty($imagesArray) && !empty($r['image'])) {
        $imagesArray = [$r['image']];
    }

    return [
        'id' => (int)$r['id'],
        'brand' => $r['brand'],
        'model' => $r['model'],
        'year' => (int)$r['year'],
        'price' => (float)$r['price'],
        'currency' => $r['currency'] ?: 'CRC',
        'mileage' => (int)$r['mileage'],
        'vehicleType' => $r['vehicle_type'],
        'transmission' => $r['transmission'],
        'fuel' => $r['fuel'],
        'status' => $r['status'],
        'featured' => (bool)$r['featured'],
        'description' => $r['description'],
        'image' => $r['image'],
        'images' => $imagesArray
    ];
}

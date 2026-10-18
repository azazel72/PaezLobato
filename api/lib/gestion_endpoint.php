<?php
declare(strict_types=1);
require_once __DIR__ . '/../servicios/gestion.php';
require_once __DIR__ . '/respuesta.php';
require_once __DIR__ . '/php_log.php';

// Cada ruta fija su recurso. null mantiene el acceso antiguo de gestion/api.php.
function atenderPeticionGestion(?string $recurso = null): void
{
    try {
        $metodo = $_SERVER['REQUEST_METHOD'] ?? '';
        if (!in_array($metodo, ['GET', 'POST'], true)) {
            header('Allow: GET, POST');
            responderJson(['ok' => false, 'error' => 'Método no permitido.'], 405);
            return;
        }
        $pdo = fabricacionPdo();
        if ($metodo === 'GET') {
            $recurso = $recurso ?? ($_GET['recurso'] ?? 'resumen');
            if (!is_string($recurso)) throw new InvalidArgumentException('Recurso no válido.');
            responderJson(['ok' => true] + listarRecursoGestion($pdo, $recurso));
            return;
        }
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            $host = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
            $port = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_PORT);
            if (strcasecmp($host . ($port ? ':' . $port : ''), $_SERVER['HTTP_HOST'] ?? '') !== 0) throw new InvalidArgumentException('Origen de petición no permitido.');
        }
        $datos = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($datos)) throw new InvalidArgumentException('Datos no válidos.');
        $accion = $datos['accion'] ?? '';
        $recurso = $recurso ?? ($accion === 'crear_proveedor' ? 'proveedores' : ($datos['recurso'] ?? ''));
        if (!is_string($recurso)) throw new InvalidArgumentException('Recurso no válido.');
        if ($accion === 'crear_proveedor' && $recurso === 'proveedores') {
            $resultado = crearProveedorGestion($pdo, $datos);
        } elseif ($accion === 'editar') {
            $resultado = editarRecursoGestion($pdo, $recurso, $datos);
        } else {
            throw new InvalidArgumentException('Acción no disponible.');
        }
        responderJson(['ok' => true] + $resultado);
    } catch (Throwable $error) {
        $validacion = $error instanceof InvalidArgumentException || $error instanceof JsonException;
        registrarLogPhp('[nueva gestión PHP] ' . $error->getMessage());
        responderJson(['ok' => false, 'error' => $validacion ? $error->getMessage() : 'No se pudo completar la operación. Revisa la conexión de la BBDD.'], $validacion ? 400 : 500);
    }
}

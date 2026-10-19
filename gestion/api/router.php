<?php
declare(strict_types=1);
require_once __DIR__ . '/datos.php';
require_once __DIR__ . '/cuadrantes.php';
require_once __DIR__ . '/cuadrante-completo.php';
require_once __DIR__ . '/listados.php';
require_once __DIR__ . '/servicios/escritorio.php';
require_once __DIR__ . '/modulos/planificacion/servicio.php';
require_once __DIR__ . '/modulos/documentos/servicio.php';

function gOrigin(): void
{
    if (!isset($_SERVER['HTTP_ORIGIN'])) return;
    $origin = parse_url($_SERVER['HTTP_ORIGIN']);
    $host = ($origin['host'] ?? '') . (isset($origin['port']) ? ':' . $origin['port'] : '');
    if (strcasecmp($host, $_SERVER['HTTP_HOST'] ?? '') !== 0) throw new InvalidArgumentException('Origen no permitido.');
}
function gRespond(array $data, int $status = 200): void
{
    http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function gDispatch(PDO $pdo, string $method, string $resource, array $data = [], array $params = [], bool $desktop = false): array
{
    if ($method === 'GET') {
        if ($resource === 'documentos_envinados') return gDocumentosEnvinados($pdo, $params);
        if ($resource === 'resumen' || $resource === 'lotes' || $desktop) return listarRecursoGestion($pdo, $resource);
        if (in_array($resource, ['cuadrantes', 'cuadrante_completo'], true)) return gCCDataset($pdo, gDate($params['fecha'] ?? ''));
        if (in_array($resource, ['inventario_flejes', 'inventario_maderas', 'asistencias_mensuales'], true)) return gInforme($pdo, $resource, $params);
        return gDataset($pdo, $resource);
    }
    if ($method !== 'POST') throw new InvalidArgumentException('Método no permitido.');
    if ($resource === 'planificacion_entradas') return gInicializarPlan($pdo, $data);
    if ($resource === 'documentos_envinados') return gGuardarDocumentos($pdo, $data);
    if ($desktop) {
        $action = $data['accion'] ?? '';
        if ($action === 'editar') return editarRecursoGestion($pdo, $resource, $data);
        if ($action === 'crear') return crearMaestroGestion($pdo, $resource, $data);
        if ($action === 'crear_proveedor' && $resource === 'proveedores') return crearProveedorGestion($pdo, $data);
        if ($action === 'eliminar') return eliminarMaestroGestion($pdo, $resource, $data);
        throw new InvalidArgumentException('Acción no disponible.');
    }
    if (in_array($resource, ['cuadrantes', 'cuadrante_completo'], true)) return gCCMutate($pdo, $data);
    return gSave($pdo, $resource, $data);
}

function gHandleRequest(?string $fixedResource = null, bool $desktop = false): void
{
    try {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (!in_array($method, ['GET', 'POST'], true)) { header('Allow: GET, POST'); gRespond(['ok' => false, 'error' => 'Método no permitido.'], 405); return; }
        $resource = $fixedResource ?? ($_GET['resource'] ?? ($desktop ? ($_GET['recurso'] ?? 'resumen') : ''));
        if (!is_string($resource)) throw new InvalidArgumentException('Recurso no válido.');
        if ($resource === 'archivos' && !$desktop) { require __DIR__ . '/archivos.php'; return; }
        $desktop = $desktop || ($_GET['format'] ?? '') === 'desktop';
        $data = [];
        if ($method === 'POST') {
            gOrigin();
            $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($data)) throw new InvalidArgumentException('Datos no válidos.');
            if ($desktop && $fixedResource === null && !isset($_GET['resource'])) $resource = ($data['accion'] ?? '') === 'crear_proveedor' ? 'proveedores' : ($data['recurso'] ?? '');
            if (!is_string($resource)) throw new InvalidArgumentException('Recurso no válido.');
        }
        $pdo = fabricacionPdo();
        $result = gDispatch($pdo, $method, $resource, $data, $_GET, $desktop);
        gRespond(['ok' => true] + $result);
    } catch (Throwable $e) {
        $valid = $e instanceof InvalidArgumentException || $e instanceof JsonException;
        if ($e instanceof PDOException && $e->getCode() === '23000') { $valid = true; $message = 'No se puede guardar: registro duplicado o relacionado con otros datos.'; }
        else $message = $valid ? $e->getMessage() : 'No se pudo completar la operación. Comprueba la conexión y vuelve a intentarlo.';
        if (!$valid) error_log('[gestion nueva] ' . $e->getMessage());
        gRespond(['ok' => false, 'error' => $message], $valid ? 400 : 500);
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) gHandleRequest();

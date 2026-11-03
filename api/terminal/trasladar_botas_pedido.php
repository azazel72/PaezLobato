<?php
declare(strict_types=1);
require_once __DIR__ . '/../servicios/trasladar_botas_pedido.php';
require_once __DIR__ . '/../lib/php_log.php';
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '')!=='POST') { header('Allow: POST'); http_response_code(405); echo json_encode(['ok'=>false,'error'=>'Utiliza POST.']); exit; }
try {
    if (isset($_SERVER['HTTP_ORIGIN']) && parse_url($_SERVER['HTTP_ORIGIN'],PHP_URL_HOST)!==explode(':',$_SERVER['HTTP_HOST'] ?? '')[0]) throw new InvalidArgumentException('Origen no permitido.');
    $datos=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
    if (!is_array($datos)) throw new InvalidArgumentException('Petición no válida.');
    echo json_encode(trasladarBotasPedido(fabricacionPdo(),$datos),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    $validacion=$e instanceof InvalidArgumentException || $e instanceof JsonException;
    http_response_code($validacion ? 400 : 500); registrarLogPhp('[traslado botas] '.$e->getMessage());
    echo json_encode(['ok'=>false,'error'=>$validacion ? $e->getMessage() : 'No se pudo confirmar el traslado. Recarga los pedidos para comprobar la asignación actual.'],JSON_UNESCAPED_UNICODE);
}

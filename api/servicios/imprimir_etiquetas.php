<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/database.php';
require_once __DIR__ . '/../config/impresion.php';

function listaCodigosEtiqueta(array $datos): array
{
    $codigos = $datos['codigos'] ?? null;
    if (!is_array($codigos) || !array_is_list($codigos) || !$codigos) {
        throw new InvalidArgumentException('Debes indicar una lista de códigos.');
    }
    if (count($codigos) > 500) throw new InvalidArgumentException('No se pueden solicitar más de 500 etiquetas en una petición.');
    foreach ($codigos as $codigo) {
        // Impedir que un dato se interprete como un comando de la impresora.
        if (!is_string($codigo) || trim($codigo) === '' || mb_strlen($codigo, 'UTF-8') > 60 || preg_match('/[\x00-\x1f\x7f\^~]/u', $codigo)) {
            throw new InvalidArgumentException('La lista contiene un código no válido.');
        }
    }
    // Una aparición equivale a una etiqueta, incluidos los duplicados.
    return $codigos;
}

function etiquetaBotaZpl(string $codigo): string
{
    listaCodigosEtiqueta(['codigos' => [$codigo]]);
    // Mismas dimensiones y cálculo de Code128 que en la plantilla Python.
    $modulos = 11 * mb_strlen($codigo, 'UTF-8') + 37;
    $ancho = max(1, min(4, intdiv(344 - 2 * 10, $modulos)));
    $x = (int) floor((344 - $modulos * $ancho) / 2) - 20;
    $plantilla = file_get_contents(__DIR__ . '/../plantillas/bota.zpl');
    if ($plantilla === false) throw new RuntimeException('No se pudo leer la plantilla de etiquetas.');
    return strtr($plantilla, ['{{codigo}}' => $codigo, '{{barcode_x}}' => (string) $x, '{{modulo}}' => (string) $ancho]);
}

function enviarEtiquetasZpl(string $zpl): void
{
    $config = configuracionImpresoraEtiquetas();
    $socket = @stream_socket_client('tcp://' . $config['host'] . ':' . $config['puerto'], $errorNumero, $errorTexto, $config['timeout']);
    if ($socket === false) throw new RuntimeException('No se pudo conectar con la impresora.');
    try {
        stream_set_timeout($socket, $config['timeout']);
        $total = strlen($zpl);
        $enviado = 0;
        while ($enviado < $total) {
            $bytes = @fwrite($socket, substr($zpl, $enviado));
            $estado = stream_get_meta_data($socket);
            if ($bytes === false || $bytes === 0 || $estado['timed_out']) {
                throw new RuntimeException('El envío a la impresora no se completó; algunas etiquetas pueden haberse enviado.');
            }
            $enviado += $bytes;
        }
    } finally {
        fclose($socket);
    }
}

function imprimirEtiquetasBotas(PDO $pdo, array $datos, ?callable $enviar = null): array
{
    $codigos = listaCodigosEtiqueta($datos);
    $consulta = $pdo->prepare("SELECT codigo FROM productos WHERE tipo = 'BOTA' AND is_deleted = 0 AND codigo IN (" . implode(',', array_fill(0, count($codigos), '?')) . ')');
    $consulta->execute($codigos);
    $existentes = array_fill_keys($consulta->fetchAll(PDO::FETCH_COLUMN), true);
    foreach ($codigos as $codigo) {
        if (!isset($existentes[$codigo])) throw new InvalidArgumentException('Hay códigos de botas que no han sido creados.');
    }
    $zpl = implode('', array_map('etiquetaBotaZpl', $codigos));
    ($enviar ?? 'enviarEtiquetasZpl')($zpl);
    // Mismo resultado que imprimir_etiqueta_fabricacion de Python.
    return ['ok' => true, 'codigos' => $codigos, 'cantidad' => count($codigos)];
}

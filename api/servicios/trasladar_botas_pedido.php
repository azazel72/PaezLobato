<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';
function trasladarBotasPedido(PDO $pdo, array $datos): array
{
    $ids=[];
    foreach (['origen_id','destino_id'] as $key) {
        $valor=$datos[$key] ?? null;
        $id=is_bool($valor) ? false : filter_var($valor,FILTER_VALIDATE_INT);
        if ($id===false || $id<0) throw new InvalidArgumentException('Selecciona origen y destino.');
        $ids[]=$id;
    }
    $codigos=$datos['codigos'] ?? null;
    if (!is_array($codigos) || !array_is_list($codigos) || !$codigos || count($codigos)>500) throw new InvalidArgumentException('Indica entre 1 y 500 códigos.');
    foreach ($codigos as $codigo) if (!is_string($codigo) || trim($codigo)==='' || mb_strlen($codigo)>60) throw new InvalidArgumentException('Código no válido.');
    try {
        $filas=fabricacionProcedimientoFilas($pdo,'pa_trasladar_botas_pedido',[
            ...$ids,json_encode($codigos,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
        ]);
    } catch (PDOException $e) {
        if ($e->getCode()==='45000') throw new InvalidArgumentException($e->errorInfo[2] ?? 'No se pudo validar el traslado.');
        throw $e;
    }
    if (!$filas || !(bool)$filas[0]['ok']) throw new RuntimeException('El PA no confirmó el traslado.');
    return ['ok'=>true,'cantidad'=>(int)$filas[0]['cantidad']];
}

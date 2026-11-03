"""Compara PHP con la plantilla Python. No conecta con BBDD ni impresora."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('plantilla', root / 'servidor/impresion/imprimir_etiqueta.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
printer = module.ImprimirEtiqueta()
codes = ['A', 'AB', 'LOTE00101011-261100001', 'X' * 60, 'MADERAÑ-261100001']
script = """<?php
require getcwd() . '/api/servicios/imprimir_etiquetas.php';
$codigos = json_decode(%s, true, 512, JSON_THROW_ON_ERROR);
$etiquetas = array_map('etiquetaBotaZpl', $codigos);
foreach (['', '^XA', '~JA', "codigo\\n", str_repeat('A', 61)] as $invalido) {
    try { listaCodigosEtiqueta(['codigos' => [$invalido]]); throw new RuntimeException('Código inválido aceptado'); }
    catch (InvalidArgumentException $e) {}
}
if (listaCodigosEtiqueta(['codigos' => ['A', 'A']]) !== ['A', 'A']) throw new RuntimeException('Se perdieron duplicados');
echo json_encode($etiquetas, JSON_THROW_ON_ERROR);
""" % ("'" + json.dumps(codes, ensure_ascii=True).replace("'", "\\'") + "'")
result = subprocess.run([shutil.which('php') or 'C:/xampp/php/php.exe'], input=script, text=True, encoding='utf-8', capture_output=True, cwd=root, check=True)
labels = json.loads(result.stdout)
for code, label in zip(codes, labels, strict=True):
    assert label == printer.obtener_etiqueta('botas', code, copies=1), f'ZPL distinto para {code}'
print('OK: ZPL idéntico a Python, longitudes pares/impares, Unicode, duplicados y validaciones; sin imprimir.')

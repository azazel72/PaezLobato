# Fabricación e impresión de botas

El botón de fabricación envía a `api/fabricacion_crear_botas.php` la fabricación,
los IDs de los lotes de botas seleccionados, el ID del lote de fondos, batidero,
operarios y cantidad entera de etiquetas. PHP comprueba la selección actual y
confirma todos los cambios en una transacción MySQL.

Por cada bota:

- Crea un producto BOTA y su relación con operario y batidero.
- Reparte el consumo de DUELA de la receta entre los lotes seleccionados.
  Trabaja con unidades de 0.0001 y reparte el resto sin perder cantidad.
- Incrementa `consumido` y `contador_botas` (+1) en cada lote participante.
- Incrementa `consumido` del lote de fondos en dos veces el consumo FONDO/FONDOS
  de la receta, y su `contador_fondos` en dos.
- Registra una traza por lote de botas y una única traza de fondos con
  `id_bota = productos.id` y la cantidad de los dos fondos.
- Incrementa los contadores de fabricación y pedido en uno.

PHP descuenta también los tipos FLEJE de la receta (incluidos 40 y 70) por cada
bota, de las entradas seleccionadas (estado 1), por fecha e ID. Agota y cierra las
entradas anteriores; la última absorbe el resto y permanece seleccionada aunque
el saldo sea negativo, como en el flujo anterior. Si falta una entrada seleccionada
para algún fleje de la receta, toda la fabricación se revierte.
La carga y selección del menú Fleje usan GET/POST en `api/entradas_flejes.php`,
sin pasar por Python. El flujo no escribe en palets ni trazabilidad antigua.
La selección de los lotes permanece activa. Como en el flujo anterior, el consumo
puede superar el cubicaje registrado (los lotes de fondos pueden partir de cero).

La numeración mantiene prefijo del primer lote, operario, batidero, separador
`-`/`X`, año, mes y contador anual de cinco dígitos. Un bloqueo MySQL serializa la
creación para evitar códigos repetidos entre peticiones simultáneas.

Solo después del commit, JavaScript envía `{codigos: [...]}` a la acción Python
`imprimir_etiqueta_fabricacion`. Python comprueba que las botas existen y manda
una etiqueta por elemento con el generador ZPL existente. No crea productos ni
descuenta cantidades. Confirma el envío al dispositivo, no la salida física del papel.

Los códigos confirmados quedan pendientes en la pestaña hasta que Python acepta
el envío. Si falla la impresión, el mismo botón pasa a «Reintentar impresión» y
reenvía los códigos sin volver a llamar al endpoint de creación. Un doble clic
no lanza dos fabricaciones.

El script `DDL/001_v3_0_lotes_y_movimientos.sql` define directamente
`contador_fondos` en `a_lotes_fondos` e `id_bota` en `a_trazabilidad_fondos`,
sin migraciones adicionales ni `ALTER TABLE`.

Tras desplegar, recargar el proceso Python y el frontend. El payload antiguo de
fabricación ya no se acepta en Python.

Validaciones focalizadas, sin imprimir etiquetas reales:

- `C:/xampp/php/php.exe pruebas/test_fabricacion_php.php`: tablas temporales
  con el esquema real, descuentos, trazas, contadores y rollback.
- `node pruebas/test_fabricacion_impresion.js`: orden PHP/impresora, fallos y reintentos.
- `python -B pruebas/test_impresion_codigos.py`: contrato Python con impresora simulada.

El breadcrumb escribe `[breadcrumb] clic` con texto, destino y pantalla de origen.

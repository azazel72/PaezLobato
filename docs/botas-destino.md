# Botas → Destino

La vista consulta `api/terminal/destino_resumen.php` (solo lectura). La expedición
y el envío a envinar mantienen las acciones existentes por WebSocket.

El pedido actual se consulta directamente en `productos.pedido_id`. El valor 0
corresponde a ANÓNIMO. `pedido_fabricacion_id` conserva el pedido al fabricar y
`produccion_id` conserva la fabricación semanal. La migración resuelve el pedido
original por fabricación y, para productos antiguos, por trazabilidad. Se ejecuta
solo al añadir los campos: repetir el script no revierte traslados ni el valor 0.
Las consultas nuevas de Destino usan los PA `pa_destino_pedidos` y `pa_destino_botas`.

Las tarjetas muestran solicitadas (`pedidos.cantidad`), fabricadas
(`pedidos.cantidad_fabricada`), a cliente (botas actualmente en estado 6) y a
envinadas (estado actual 4). La lista y los botones solo incluyen botas en
estados 1 y 2. Son contadores de estado actual, no un historial de envíos. Se
conserva el filtro de pedidos activos (estado 2), incluyendo ahora los pedidos
que ya no tienen botas pendientes.

ANÓNIMO es un grupo azul permanente, incluso con el filtro de pendientes activado.
Agrupa botas con `pedido_id=0`. No se crea un pedido ficticio ni se cambia el enum
destino. Su botón circular abre el modal de traslado entre pedidos. No muestra
contadores de solicitadas/fabricadas ni permite expedir/envinar directamente.

El modal permite escanear o pegar entre 1 y 500 códigos, con origen y destino
distintos. El PA `pa_trasladar_botas_pedido` comprueba que todos pertenecen al origen
y están en estados 1/2. El destino puede ser 0 o un pedido activo C/E. Cambia solo
`pedido_id` y conserva `pedido_fabricacion_id` y `produccion_id` sin alterarlos.
No se pide motivo ni se guarda tabla de historial. Si alguno de los códigos falla,
no se cambia ninguno. Un reintento con origen obsoleto se rechaza y pide recargar.
Los contadores históricos de pedidos y fabricación no cambian con los traslados.
Expedición y envinado en Python validan y bloquean la bota por pedido actual, no
por las fabricaciones del pedido. Es necesario reiniciar Python después de desplegar.

Instalación local, con copia previa automática de botas y esquemas:
`php SQL/aplicar_botas_pedido.php`. Usa, en este orden:
`SQL/actualizaciones/20261103_botas_pedido.sql` y
`SQL/actualizaciones/20261103_pa_botas_pedido.sql`.
Los scripts contienen solo la solución final, sin tabla de historial ni pasos
para crearla y borrarla. No cambia el número de versión de BBDD.
El instalador solo admite CLI. Los PA de creación y consulta participan
en la transacción llamante; el de traslado gestiona su propia transacción.

Pruebas: `php test/test_destino_resumen.php` (tablas temporales) y
`node test/test_destino_resumen.js`.
También `php test/test_trasladar_botas_pedido.php`, `php test/test_fabricacion_php.php`,
`node test/test_mover_botas_pedido.js` y `python -B test/test_destino_pedido_python.py`.

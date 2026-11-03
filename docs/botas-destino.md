# Botas → Destino

La vista consulta `api/terminal/destino_resumen.php` (solo lectura). La expedición
y el envío a envinar mantienen las acciones existentes por WebSocket.

El pedido se resuelve por `productos.produccion_id` → `fabricacion_semanal.id` →
`fabricacion_semanal.pedido_id`. Si falta el vínculo directo se utiliza una sola
relación de `trazabilidad_producto`/`trazabilidad_fabricacion` para productos antiguos.
No existe un `pedido_id` independiente en productos. Varias fabricaciones pueden
aparecer en una sola tarjeta de pedido.

Las tarjetas muestran solicitadas (`pedidos.cantidad`), fabricadas
(`pedidos.cantidad_fabricada`), a cliente (botas actualmente en estado 6) y a
envinar (estados actuales 3 y 4). La lista y los botones solo incluyen botas en
estados 1 y 2. Son contadores de estado actual, no un historial de envíos. Se
conserva el filtro de pedidos activos (estado 2), incluyendo ahora los pedidos
que ya no tienen botas pendientes.

ANÓNIMO es un grupo visual azul permanente. Agrupa botas sin pedido resoluble o
con destino distinto de C/CLIENTE/E/ENVINADO; conserva su fabricación semanal si
existe. No se crea un pedido ficticio, no se cambia el enum destino ni la BBDD.
Su cantidad solicitada no aplica y sus fabricadas se cuentan desde productos.
No incluye acciones de expedición, envinado ni traslado entre pedidos.

Un futuro cambio de pedido deberá separar la asignación comercial actual de la
fabricación original. No se debe cambiar `produccion_id` ni el pedido de la
fabricación semanal para mover una sola bota. La asignación y su historial por
producto deberán ser respetados tanto por el listado como por las validaciones
de expedición/envinado; guardar movimientos por sí solo no cambia esas consultas.
Ese mecanismo no está implementado.

Pruebas: `php test/test_destino_resumen.php` (tablas temporales) y
`node test/test_destino_resumen.js`.

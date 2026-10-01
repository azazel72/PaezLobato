# Acciones de lotes en Cierre semanal

El cierre procedente de Fabricación carga todas las fabricaciones activas y todos
los lotes de `a_lotes_botas` desde PHP. Los dos selectores de cada tarjeta se
construyen con esa misma lista en memoria, excluyendo el ID de la propia tarjeta.

- **Reasignar consumo a otro lote:** resta consumo al lote de la tarjeta y lo suma
  al lote elegido.
- **Reasignar consumo desde otro lote:** resta consumo al lote elegido y lo suma
  al lote de la tarjeta. Sustituye la acción anterior «Reasignar sobrante».

Ambas acciones conservan cubicajes y contadores de botas. La cantidad debe ser
positiva, no superar el consumo del origen y no dejar negativo el restante del
receptor. Los cálculos se hacen en unidades enteras de 0.0001.

También se mantienen **Enviar a procesado** y **Enviar a desperdicio**. Ambas
incrementan el consumido del lote de botas, sin superar su restante ni cambiar
su cubicaje o contador. Procesado pide un código de lote destino: PHP crea el
lote en `a_lotes_procesados` o aumenta el cubicaje del existente si su material
y tipo coinciden. Desperdicio registra destino 0 y situación `desperdicio`;
procesado registra el ID destino con situación `procesado`. El origen siempre
es el lote de botas y la cantidad es positiva. Se guardan al confirmar, en la
misma transacción, y Restablecer también deshace estas salidas pendientes.

El botón **Actualizar cambios** envía todo el borrador en una sola petición a
`api/cierre_semanal_lotes.php`; esta vista no utiliza Python ni las acciones
antiguas por WebSocket.

Los cambios actualizan las dos tarjetas y el resumen de operaciones pendientes.
No se escriben datos hasta pulsar **Actualizar cambios**. **Restablecer cambios**
recupera la copia original. El borrador se conserva al cambiar de fabricación o
salir y volver a esta vista, mientras la página permanezca cargada.

`api/cierre_semanal_lotes.php` bloquea los lotes implicados y compara sus valores
con los originales del borrador. Si otra operación ha cambiado las cantidades,
rechaza el guardado con HTTP 409. Revalida todas las operaciones y confirma los
consumidos y los registros en `a_movimientos` en una única transacción; ambos
extremos del movimiento de reasignación tienen situación `botas`. Si falla, se conserva el
borrador en pantalla.

En `a_movimientos`, la cantidad es siempre positiva. `origen_id` corresponde al
lote que aumenta su consumo y disminuye su restante; `destino_id` corresponde al
que reduce consumo y recupera restante. Por ejemplo, ceder 0.2000 de consumo de
A a B registra origen B, destino A y cantidad 0.2000. El borrador describe la
cesión de consumo y PHP convierte esa dirección al registrar el movimiento.

Los ENUM de situaciones del CREATE de `a_movimientos` incluyen también la cadena
vacía explícita y `desperdicio`. Este cambio en el script no ejecuta ninguna
migración sobre la BBDD existente.

Pruebas focalizadas:

- `node pruebas/test_cierre_lotes.js`
- `C:/xampp/php/php.exe pruebas/test_cierre_lotes.php` (solo tablas temporales).

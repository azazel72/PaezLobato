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
consumidos y los registros en `a_ajustes_consumo` en una única transacción. Los
traslados materiales continúan en `a_movimientos`. Si falla, se conserva el
borrador en pantalla.

En `a_ajustes_consumo`, origen es el lote que reduce su consumido y destino el que
lo aumenta. Cada registro conserva códigos, cantidad positiva, consumidos de ambos
lotes antes/después, fecha, motivo y un grupo/orden para reconstruir la confirmación.
El motivo predeterminado es «Reasignación de consumo en cierre semanal»; el contrato
acepta un motivo específico por operación. `usuario_id` es nullable: PHP no puede
validar la sesión en memoria de Python. Se reserva al contexto autenticado de
servidor mediante el tercer argumento de `confirmarCambiosLotesCierre`, nunca al
ID que envíe libremente el cliente. Sin ese contexto se registra NULL.
No se reclasifican ni eliminan los movimientos históricos de consumo.

Los ENUM de situaciones del CREATE de `a_movimientos` incluyen también la cadena
vacía explícita y `desperdicio`. Este cambio en el script no ejecuta ninguna
migración sobre la BBDD existente.

Pruebas focalizadas:

- `node test/test_cierre_lotes.js`
- `C:/xampp/php/php.exe test/test_cierre_lotes.php` (solo tablas temporales).
# Enviar restante entre lotes de botas

La opción «Enviar restante» aparece con restante positivo. La cantidad debe ser
positiva y no superar `cubicaje - consumido` del origen. El borrador resta esa
cantidad del cubicaje original del origen y la suma al destino, conservando los
consumos y contadores. Al confirmar, se valida de nuevo dentro de la transacción
y se registra en `a_movimientos` con los IDs reales origen/destino y situación
`botas` en ambos lados. No requiere cambios de esquema ni versión de BBDD.

Interfaz propia: `terminal/js/terminal-cierre-enviar-restante.js`.
Pruebas: `node test/test_enviar_restante.js` y `php test/test_enviar_restante.php`
(esta última solo escribe en tablas temporales).

La tabla `a_ajustes_consumo` se crea con
`SQL/actualizaciones/20261103_a_ajustes_consumo.sql`. Los nuevos ajustes de consumo
no generan registros en `a_movimientos`. La migración no cambia la versión de BBDD.
Prueba del registro y rollback: `php test/test_ajustes_consumo.php`, con las tres
tablas de escritura aisladas como temporales.

El registro de cada ajuste se realiza mediante `pa_registrar_ajuste_consumo`,
instalado con `SQL/actualizaciones/20261103_pa_registrar_ajuste_consumo.sql`.
El PA valida cantidad, balances, IDs y motivo, e inserta la auditoría. No modifica
lotes ni ejecuta COMMIT: participa en la transacción que coordina PHP para que el
registro y el cambio de consumidos se confirmen o reviertan conjuntamente.

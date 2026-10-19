# Cuadrante

Vista unica accesible desde **Cuadrante**. Sustituye a las dos opciones previas.
El JS de la pantalla simple ha sido eliminado.

## Funciones trasladadas

| Función de referencia | Nueva vista |
| --- | --- |
| Consultar semana desde fecha | Fecha, anterior/siguiente y actualizar |
| Semana J/V/L/M/X | Cinco columnas, desde jueves a miércoles, sin sábado/domingo |
| Empleados ordenados por código | Lista lateral con orden numérico, alias, código y búsqueda |
| Asignar arrastrando desde la lista | Fichas arrastrables con tabla desbloqueada |
| Mover una ficha entre celdas | Conserva el ID de la asignación y la mueve de día/puesto |
| Quitar una ficha devolviéndola a la lista | Zona de devolución y botón quitar, con confirmación |
| Aviso de empleado ya asignado ese día | Muestra los puestos y pide confirmar la asignación adicional |
| Evitar repetir empleado en la misma celda | Comprobación tanto en JS como en PHP |
| Clonar día arrastrando la cabecera | Cabecera arrastrable y formulario de clonado |
| Mantener o reemplazar destino | Opción de combinar sin duplicar; reemplazo con confirmación |
| Resaltar columnas en hover/origen/destino | Colores propios del nuevo estilo |
| Extender jueves a toda la semana | Reemplaza viernes/lunes/martes/miércoles, con confirmación |
| Rotación de batideros | Usa orden e ID, admite dos o más puestos y rota según los destinos no festivos |
| Festivos | Columnas diferenciadas; bloquea nuevas asignaciones y clonado; extender conserva esos destinos |
| Indicadores J/V/L/M/X de cobertura | Marcas de asignado/sin asignar/festivo en cada ficha |
| Aviso de faltas | Punto rojo si falta el jueves, ámbar si solo faltan otros días; excluye festivos |
| Mismo color / mismo ancho / Ver faltas | Interruptores locales a esta ventana |
| Inactivos utilizados | Se muestran si la semana ya los utiliza; se ocultan los inactivos sin uso |
| Puestos ordenados | Orden, nombre e ID; inactivos usados permanecen visibles |
| Limpiar semana | Confirmación y baja lógica de las asignaciones |
| Guardado en cada operación | Transacción, detección de conflictos y restauración visual ante errores |

Se conserva el formulario **Asignar usuario** y la asignacion desde la lista de
empleados. Las fichas existentes no abren formularios de edicion: se mueven por
arrastre o se retiran. Se han quitado los lapices de filas, el titulo y las
observaciones de la vista y de la impresion, junto a la accion API `metadata`.
No se borran esos campos ni sus valores existentes en la BBDD.

Las anchuras se ajustan arrastrando el separador de empleados o el borde derecho
de cada cabecera (Puesto y días). También admiten flechas izquierda/derecha al
enfocar el tirador con Tab. Funcionan con el candado cerrado y se conservan al
actualizar o cambiar de semana mientras la ventana siga abierta. Las columnas
ampliadas permiten desplazamiento horizontal sin comprimir las demás.
`node gestion/tests/cuadrante-anchuras.cjs` verifica el ajuste y sus límites.

CSV e impresion/PDF siguen disponibles, igual que las preferencias y las acciones
de clonado, extension y limpieza. El candado solo controla el arrastre directo.

## Archivos nuevos

- `gestion/vistas/cuadrante-completo.html`: estructura de la vista.
- `gestion/css/cuadrante-completo.css`: estilos exclusivos, incluida tabla con cabeceras opacas.
- `gestion/js/cuadrante-completo-modelo.js`: fechas, orden, cobertura y exportación segura.
- `gestion/js/cuadrante-completo.js`: interfaz, arrastre, formularios e impresión.
- `gestion/api/cuadrante-completo.php`: operaciones incrementales sobre la planificación.
- `gestion/tests/cuadrante-completo.php` y `.cjs`: pruebas de operaciones y modelo.

La entrada sigue siendo `gestion/api/router.php?resource=cuadrantes`.
GET recibe `fecha`; POST recibe `inicio`, `version` y una acción: `assign`,
`remove`, `clone`, `extend` o `clear`. Consulta las tablas existentes;
no requiere cambiar el esquema ni su versión.

## Pruebas

Ejecutar desde la raíz del repositorio:

```powershell
node gestion/tests/cuadrante-completo.cjs
C:\xampp\php\php.exe gestion/tests/cuadrante-completo.php
```

Las pruebas PHP escriben exclusivamente en tablas TEMPORARY de su conexión.
Comprueban asignaciones, movimientos, conflictos, clonado, festivos, rotación,
limpieza, rollback y rechazo de versiones obsoletas. La revisión visual y del
arrastre nativo queda pendiente cuando haya un navegador conectado a la sesión.

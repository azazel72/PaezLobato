# Nueva gestión

Abrir `/paezlobato_nuevo/gestion/` cuando el proyecto esté dentro de esa carpeta,
o `/gestion/` si la raíz del sitio es el repositorio. Apache sirve `index.html`.

La muestra utiliza Tabulator 6.3.1 ya disponible en `static/` y jsPanel 4.16.1
guardado en `gestion/vendor/`. No necesita un proceso de Python ni conexión a un CDN.

La entrada común de la API es `gestion/api/router.php`. Usa la conexión PHP
compartida y su selección de equipo/puerto. La lógica de resumen, lotes y los
primeros maestros está en `gestion/api/servicios/escritorio.php`; los demás módulos
se distribuyen entre `datos.php`, `cuadrantes.php`, `listados.php` y `archivos.php`.
`api/gestion/*.php`, `gestion/api.php` y `gestion/api/index.php` conservan las URL
anteriores como adaptadores hacia el mismo router. El frontend ya no las llama.
Lee lotes, proveedores, materiales y ubicaciones. Las celdas editables guardan
al confirmar con Enter o salir del editor; Escape cancela. Si PHP rechaza el
cambio, se restaura el valor anterior. Cubicajes y consumidos son de consulta.
Las altas se abren desde Crear en cada listado; ya no hay una ventana independiente
de «Nuevo proveedor» en el menú ni en los accesos directos.

Proveedores, Materiales y Ubicaciones abren con la edición bloqueada. El candado
habilita únicamente la edición de las celdas editables. El lápiz abre y permite
guardar el formulario con independencia del candado, también en estos tres
maestros y en Lotes. Eliminar mantiene su confirmación y es independiente del candado.
Cada eliminación pide confirmación y rechaza registros con referencias declaradas
en la BBDD. Crear abre un formulario propio; las ubicaciones requieren instalación
y orden. La búsqueda general filtra al escribir y se combina con los filtros de
las cabeceras de columna. Los filtros de columna empiezan ocultos; el icono de
embudo permite mostrarlos y, al ocultarlos, los limpia. Crear y el candado también
usan iconos con tooltip. El pie reúne el número de registros, la leyenda de edición
y el estado, junto a la fecha y hora de la última carga correcta del listado
(hora de Madrid). Estas funciones están en `gestion/js/maestros.js`.

Las ventanas se arrastran y redimensionan dentro del escritorio. La barra inferior
permite recuperarlas tras minimizar. «Vista general» minimiza las abiertas.

Referencias: https://tabulator.info/docs/6.3/edit/ y https://jspanel.de/.

Los JavaScript están en `gestion/js/` y los estilos en `gestion/css/`.

El menú lateral agrupa las vistas en Ficheros maestros, Entradas, Fabricación,
Ambiente, Listados y Admin. Todas las categorías empiezan plegadas. Admin contiene la
subcategoría Estados, también plegada, con los seis catálogos de estados.
Vista general permanece como acceso directo. Se conservan todas las vistas.
Los separadores internos siguen las agrupaciones del menú anterior.

## Operaciones y planificaciones

El menú incluye Ambiente; planificación de entradas; entradas, líneas y flejes;
planificación de pedidos; analíticas de vino; las tres trazabilidades; consumos;
documentos de botas envinadas; palets, productos y cubicaje estándar.
Todas las tablas de datos tienen filtros y exportación XLS, CSV y PDF, además
de impresión. Las tablas editables mantienen candado para celdas, lápiz para
formularios y confirmación al eliminar.

La planificación de entradas reúne camiones por proveedor, materiales y
facturación con filtro de año. El botón de añadir proveedores completa únicamente
los registros que faltan. Muestra totales y meses; resalta los previstos que no
coinciden con pactados menos descuentos. Desde cada proveedor se abre la ventana
de entradas y líneas relacionadas, con acceso a sus archivos.
La planificación de pedidos reúne pedidos y sus semanas de fabricación.

Documentos de botas envinadas permite seleccionar varias botas, subir un archivo
y vincularlo a todas en una transacción, vincular un archivo existente,
descargarlo y desvincularlo de una bota con confirmación.

Los módulos nuevos están dentro de `gestion/js/`, con las vistas compuestas en
`gestion/vistas/` y estilos en `gestion/css/operaciones.css`.
Los nuevos PHP están separados por área en `gestion/api/modulos/`.
El mapa de recursos, reglas y pruebas está en [api/README.md](api/README.md).

«Fabricación → Consumos por producto» mantiene la nueva tabla `a_consumos`:
tipo de producto, consumo de duelas, fleje 40, fleje 70 y fondo. Permite una
receta por tipo, con cuatro decimales y valores no negativos. Incluye formulario,
edición en tabla con candado, eliminación confirmada y exportaciones.
La creación de la tabla está en `sql/001_a_consumos.sql`. Es independiente del
consumo que utiliza actualmente el terminal; no se han convertido recetas anteriores.

## Nuevos módulos

El menú incluye todos los maestros de la gestión anterior: clientes, instalaciones,
los seis catálogos de estados, usuarios, roles, puestos de trabajo, tostados,
festivos y archivos, además de proveedores, materiales y ubicaciones. También
incorpora tipos de producto, pedidos, fabricación semanal y cuadrantes.

Los nuevos listados usan `js/ui-datos.js` y sus módulos propios:
`maestros-catalogo.js`, `pedidos.js`, `fabricacion-semanal.js`, `cuadrante-completo.js`
y `listados.js`. El menú se conecta en `js/navegacion.js`; sus estilos están en
`css/modulos.css`. No se cargan JS ni CSS de la aplicación anterior.

La implementación de la API está íntegramente en `gestion/api/`. Comparte únicamente
la conexión PHP configurada en el proyecto. El catálogo permite campos y tablas
explícitos, valida referencias y comprueba una versión del registro al editar o
eliminar. Usuarios guarda contraseñas bcrypt y nunca devuelve sus hashes.
Los listados nuevos permiten edición directa tras desbloquear el candado: texto,
números, fechas, sí/no y combos de referencias. Enter, cambiar una selección o
salir de la celda guarda; Escape cancela. Un error restaura el valor anterior.
El servidor devuelve la fila normalizada y su versión nueva para la siguiente
edición. El lápiz mantiene disponible el formulario completo incluso con la tabla
bloqueada; las contraseñas se editan únicamente en ese formulario. Los campos derivados
y los informes siguen siendo de consulta. Las columnas reparten el ancho disponible
con `fitColumns`; la columna de acciones queda fija y conserva su separación gruesa.
Los borrados comprueban tanto las FK como las relaciones del catálogo y usan
baja lógica donde la tabla ya dispone de ella. No hay migraciones de BBDD.

Pedidos permite consultar, crear, editar y eliminar registros. Desde una fila
se abre su fabricación semanal. Esta empieza en lunes y deriva tipo, material
y tostado del pedido; al cambiar el tostado del pedido se actualizan sus líneas.

Cuadrante muestra la semana J/V/L/M/X, con lista de empleados y arrastre.
El formulario Asignar usuario permite crear asignaciones sin desbloquear la tabla.
No muestra ni permite editar el titulo ni las observaciones de la semana, y no
incluye lapices ni formularios para editar asignaciones existentes. Los movimientos
por arrastre, la retirada de fichas, el clonado y la extension se mantienen.
Cada operacion se guarda al momento, con comprobacion de version de la semana.

Listados incluye inventario de flejes, inventario de maderas por tipo/material/
ubicación/instalación y asistencias mensuales. Permite filtrar, agrupar inventarios,
ocultar saldos cero, descargar Excel (.xls), CSV y PDF e imprimir.
Los totales se muestran en la misma fila que el título de cada grupo y siguen
visibles al plegarlo. Sin agrupación hay una única cabecera «Total». La fila de
grupo completa pliega/despliega; dos iconos permiten plegar o desplegar todos.
En maderas, tipo de duela, madera e instalación son casillas acumulables.
La leyenda mensual usa «Enero 2026 · 01/01/2026 a 31/01/2026 · Laborables: 22».
Las exportaciones incluyen todos los datos filtrados, aun con grupos plegados,
y conservan cabeceras de grupo con sus totales. Excel conserva valores numéricos.
Estas funciones se definen en `js/listados.js`, `js/listados-exportar.js` y
`css/listados.css`. `node gestion/tests/listados.cjs` verifica agrupaciones,
totales, leyendas y generación real de XLS/XLSX/PDF, además de CSV e impresión.

Todos los listados de datos (lotes, maestros, estados, pedidos y fabricación
semanal) ofrecen descarga directa de Excel (.xls, BIFF8) y PDF, además de CSV
e impresión. Exportan las filas filtradas y las columnas visibles, sin acciones,
con los nombres de los combos en lugar de sus identificadores. El cuadrante
incluye los mismos formatos para la semana consultada, con puestos, empleados
y festivos. Las pruebas de listados verifican también los archivos reales de
estas tablas y del cuadrante.
Las asistencias cuentan fechas distintas en puestos
ordinarios y asignaciones en los puestos marcados para listado, excluyendo bajas.

Archivos tiene subida desde el listado y descarga por ID. Las nuevas subidas se
guardan en `gestion/archivos/`, con acceso directo bloqueado por `.htaccess`.
La descarga también puede leer los archivos existentes de `archivos/`, sin
modificarlos. Las subidas admiten hasta 15 MB, sujetas al límite de PHP.

## Verificación

`C:\xampp\php\php.exe gestion/tests/backend.php` comprueba CRUD, validación,
referencias, contraseñas, conflictos, pedido/fabricación y cuadrantes/asistencia.
Crea tablas TEMPORARY que ocultan las tablas reales solo en esa conexión. Las
escrituras de las pruebas no alteran datos, secuencias ni esquema permanentes.
`node gestion/tests/edicion-tabla.cjs` prueba los editores, combos, cancelación,
guardado con versión y restauración ante errores sin navegador ni BBDD.

Se verificaron además las consultas de todos los recursos y la respuesta HTTP.
La comprobación visual queda pendiente cuando haya un navegador conectado.

## Entrada de la API

`router.php` recibe las peticiones y las deriva; las consultas y reglas de negocio
permanecen en sus módulos. El nombre `index.php` sería igualmente válido para una
API (la respuesta la determina PHP y su Content-Type), pero `router.php` distingue
explícitamente la entrada de datos de la página `gestion/index.html`.

Ejemplos: `api/router.php?resource=pedidos`, `?resource=resumen`,
`?resource=lotes` y `?resource=archivos&id=123` para descargar un archivo.
Los primeros tres maestros usan `format=desktop` para conservar su contrato
de edición de celdas; el resto utiliza el contrato de formularios con versión.
Todos comparten validación de método, origen y formato de errores en el router.

## Cuadrante

El menu ofrece una unica vista **Cuadrante**, procedente del anterior Cuadrante
completo. Se ha retirado la pantalla simple anterior y su archivo JS. Mantiene
arrastre, clonado, rotacion, festivos, faltas, preferencias, limpieza y el formulario
Asignar usuario, sin edicion de titulo/observaciones ni lapices de filas.
La entrada actual es `resource=cuadrantes`; `cuadrante_completo` queda como alias
para clientes anteriores. No se modifican las columnas ni los datos de la BBDD.

Funciones, archivos y pruebas: [cuadrante-completo.md](docs/cuadrante-completo.md).

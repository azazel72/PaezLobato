# Nueva gestión

Abrir `/paezlobato_nuevo/gestion/` cuando el proyecto esté dentro de esa carpeta,
o `/gestion/` si la raíz del sitio es el repositorio. Apache sirve `index.html`.

La muestra utiliza Tabulator 6.3.1 ya disponible en `static/` y jsPanel 4.16.1
guardado en `gestion/vendor/`. No necesita un proceso de Python ni conexión a un CDN.

Los endpoints de `api/gestion/` usan la conexión PHP compartida y su selección
de equipo/puerto. Las consultas y las escrituras se encuentran en
`api/servicios/gestion.php`. `gestion/api.php` conserva el acceso anterior.
Lee lotes, proveedores, materiales y ubicaciones. Las celdas editables guardan
al confirmar con Enter o salir del editor; Escape cancela. Si PHP rechaza el
cambio, se restaura el valor anterior. Cubicajes y consumidos son de consulta.
El formulario de alta crea proveedores reales en la BBDD.

Las ventanas se arrastran y redimensionan dentro del escritorio. La barra inferior
permite recuperarlas tras minimizar. «Vista general» minimiza las abiertas.

Referencias: https://tabulator.info/docs/6.3/edit/ y https://jspanel.de/.

Los JavaScript están en `gestion/js/` y los estilos en `gestion/css/`.

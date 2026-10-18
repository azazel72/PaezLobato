# Organización del frontend y de PHP

```text
terminal/
  index.html                  Frontend móvil
  js/                         Funcionalidades del terminal
  css/                        Estilos del terminal
gestion/
  index.html                  Nueva gestión con escritorio MDI
  js/                         JavaScript de la nueva gestión
  css/                        Estilos de la nueva gestión
  vendor/                     jsPanel
shared/js/                    Conexión y token usados por el nuevo terminal
static/                       Librerías compartidas
imagenes/                     Recursos gráficos compartidos
api/
  config/database.php         Selección de equipo, usuario y puerto MySQL
  config/aplicacion.php       Constantes y configuración de la aplicación
  lib/database.php            Conexión PDO y llamadas a procedimientos
  lib/respuesta.php           Respuestas JSON
  lib/php_log.php             Registro de errores
  lib/gestion_endpoint.php    Tramitación HTTP de la nueva gestión
  gestion/                    Endpoints por recurso: lotes, proveedores,
                              materiales, ubicaciones y resumen
  terminal/                   Endpoints del móvil
  archivos/                   Subida, descarga y eliminación de adjuntos
  servicios/                  Consultas y operaciones compartidas de negocio
gestion.html                  Gestión anterior, conservada en la raíz
js/                           JavaScript de la gestión anterior
css/                          Estilos de la gestión anterior
index.html                    Acceso de compatibilidad: redirige a terminal/
```

Los scripts del terminal llaman a `../api/terminal/`; los adjuntos usan
`../api/archivos/`. La nueva gestión llama a `../api/gestion/`.

Los archivos PHP antiguos de `api/` permanecen como delegados para conservar
las URLs anteriores, especialmente las usadas por la gestión antigua. Los
antiguos includes de servicios también siguen disponibles. No se duplica la
lógica PHP: reside en los archivos de sus nuevas carpetas.

Los scripts comunes que necesita el terminal se copian a `shared/js/` para
mantener intactos los archivos que utiliza la gestión anterior. La carpeta
`archivos/` de datos adjuntos y la de `logs/` conservan su ubicación original.

Esta reorganización no cambia tablas, datos ni versiones de la BBDD.

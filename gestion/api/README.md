# API de la nueva gestión

La entrada HTTP sigue siendo `router.php?resource=...`. El frontend no llama
directamente a los ficheros de los módulos ni depende del servidor Python.
La conexión compartida está en `../../api/lib/database.php`.

| Área | Recursos | Localización y responsabilidad |
| --- | --- | --- |
| Escritorio | resumen, lotes, maestros con `format=desktop` | `servicios/escritorio.php`: contrato del escritorio inicial |
| Maestros | clientes, usuarios, roles, estados, etc. | `catalogo.php`: campos y referencias del catálogo original |
| Ambiente | ambientes | `modulos/ambiente/catalogo.php`: temperaturas y humedades |
| Entradas | entradas, lineas_entrada, entradas_flejes | `modulos/entradas/catalogo.php` y `reglas.php`: campos, entrada anulada y restante del fleje |
| Fabricación | analiticas, palets, productos, trazabilidad_procesado, trazabilidad_fabricacion, trazabilidad_producto, consumos, cubicaje | `modulos/fabricacion/catalogo.php` y `reglas.php`: tipos de referencias, palets derivados de su línea, configuraciones únicas |
| Consumos por producto | a_consumos | `modulos/fabricacion/consumos-producto.php`: tipo de producto y consumos de duelas, fleje 40, fleje 70 y fondo |
| Planificación | plan_camiones, plan_material, plan_facturacion | `modulos/planificacion/catalogo.php` y `reglas.php`: meses, límites del año, totales calculados y duplicados |
| Inicialización anual | planificacion_entradas, POST `initialize` | `modulos/planificacion/servicio.php`: completa proveedores, los tres materiales y facturación sin sobrescribir datos existentes |
| Documentos de envinado | documentos_envinados | `modulos/documentos/servicio.php`: resumen, archivos por bota, vinculación y desvinculación por lotes |
| Archivos | archivos | `archivos.php`: subida y descarga. La subida con `producto_ids` vincula el documento en la misma transacción |
| Cuadrante | cuadrantes | `cuadrante-completo.php`: semana, asignaciones, clonado y rotaciones |
| Informes | inventario_flejes, inventario_maderas, asistencias_mensuales | `listados.php`: consultas y cálculos de informes |

## Contrato común de las tablas editables

GET devuelve `config`, `rows` y `lookups`. Cada fila incluye `_version`.
POST admite `create` con `data`, o `update`/`delete` con `id` y `version`.
`datos.php` ejecuta validación, transacción, bloqueo de fila y comprobación de
versión. Un conflicto exige actualizar antes de volver a guardar. Los borrados
comprueban referencias y aplican la baja lógica cuando existe en la tabla.

`modulos/catalogos.php` registra los catálogos nuevos y `modulos/reglas.php`
despacha sus reglas. Los campos numéricos comunes se definen en
`modulos/campos.php`: enteros o decimales con precisión, mínimos y máximos.
`refTypes` restringe referencias al tipo permitido tanto en PHP como en los combos.
`computed` contiene únicamente expresiones SQL declaradas en los catálogos:
se consultan y se devuelven al guardar, sin aceptar escrituras desde el cliente.

Para añadir un recurso, crear su catálogo y sus reglas dentro del área,
registrarlos en los dos archivos de registro y utilizar el contrato común.
Los flujos que afectan a varias tablas llevan un `servicio.php` propio y una
ruta explícita en `router.php`. No se deducen nombres de tablas del cliente.

La tabla histórica `estados_flejes` tiene un ID cero y carece de AUTO_INCREMENT.
El catálogo declara `zeroId` y `manualId` para respetar su estructura existente.
Ese comportamiento respeta el esquema histórico y no cambia su estructura.

La tabla nueva `a_consumos` se crea con `gestion/sql/001_a_consumos.sql`.
Contiene una receta por tipo de producto, con cuatro consumos no negativos y
cuatro decimales. Se mantiene independiente de `consumos`; su incorporación al
proceso de fabricación del terminal requiere una modificación expresa de ese flujo.
El SQL es repetible y no cambia la versión de la BBDD.

## Pruebas

Desde la raíz del proyecto:

```powershell
C:\xampp\php\php.exe gestion/tests/operaciones.php
C:\xampp\php\php.exe gestion/tests/backend.php
C:\xampp\php\php.exe gestion/tests/cuadrante-completo.php
node gestion/tests/edicion-tabla.cjs
node gestion/tests/listados.cjs
```

Las pruebas de PHP escriben exclusivamente en tablas TEMPORARY de su propia
conexión, creadas con LIKE y comprobadas antes de escribir; no copian triggers.
Verifican operaciones completas, validación, rollback, versiones y relaciones.
No modifican datos reales, secuencias ni esquema permanente.

`/gestion/tests/interfaz.html` comprueba en navegador la apertura y cierre de las
ventanas, los formularios, los paneles de planificación y los botones de
exportación. Solo realiza consultas: no envía formularios ni crea registros.

# Cierre semanal

## Objetivo

La vista `Cierre semanal` sirve para analizar una línea de `fabricacion_semanal` desde dos puntos de vista:

- control de producción
- control de consumo

Se accede desde:

- El botón `Cierre semanal` de `vista_fabricacion`, tras seleccionar una fabricación.
- `vista_consumo_semanal`

La vista es común para ambos flujos y siempre trabaja sobre un `fabricacion_semanal_id`.

## Archivos implicados

- Frontend HTML: `index.html`
- Frontend JS: `js/terminal-cierre-semanal.js`
- Navegación: `js/terminal.js`
- Backend nueva acción WS: `servidor/logica/acciones.py`
- Backend nueva API: `servidor/colector.py`

## Entrada funcional

El botón `Cierre semanal` llama a:

- `abrirVistaCierreSemanalDesdeLinea(lineaId, origenVista)`

Esto guarda:

- `estadoCierreSemanal.lineaId`
- `estadoCierreSemanal.origenVista`

y después navega a:

- `vista_cierre_semanal`

La vista usa ese `lineaId` para pedir al backend el resumen completo.

## API nueva

Se ha añadido una acción nueva de WebSocket:

- `obtener_cierre_semanal`

Payload esperado:

```json
{
  "fabricacion_semanal_id": 123
}
```

Respuesta esperada:

- `linea`
- `pedido`
- `consumo_unitario_bota`
- `totales`
- `consistencias`
- `palets`
- `codigos_botas`

## Qué calcula el backend

La API `obtener_cierre_semanal` no modifica datos. Solo compone y valida información.

### 1. Datos base

Recupera:

- `FabricacionSemanalDB` por `fabricacion_semanal_id`
- `PedidoDB` asociado
- `TipoProductoDB` de la bota
- `MaterialDB`

### 2. Consumo unitario por bota

Busca en `ConsumoDB` los consumos de la bota actual y selecciona el consumible cuyo tipo es `DUELA`.

Ese valor se devuelve como:

- `consumo_unitario_bota`

Es el valor que se usa para comprobar si el consumo de botas cuadra con el consumo de palets.

### 3. Trazabilidad de fabricación

Recupera todas las filas de:

- `TrazabilidadFabricacionDB`

para esa línea semanal.

Con esas trazas localiza:

- los `PaletDB` implicados
- las relaciones de `TrazabilidadProductoDB`
- los `ProductoDB` asociados

### 4. Botas fabricadas reales

Las botas fabricadas reales se calculan desde `ProductoDB` enlazado a través de `TrazabilidadProductoDB`.

Solo cuentan productos cuyo:

- `producto.tipo == "BOTA"`

De ahí salen:

- `codigos_botas`
- `botas_registradas`

## Reglas de consistencia implementadas

La vista se apoya en dos reglas obligatorias.

### Regla 1. Fabricación semanal

Debe cumplirse:

```text
fabricacion_semanal.cantidad_fabricada == total de botas recuperadas
```

Comparación real:

- `cantidad_bbdd_semana = linea.cantidad_fabricada`
- `botas_registradas = count(codigos_botas)`

Resultado devuelto:

- `consistencias.semana_fabricada_coincide`

Si no coincide, también se devuelve la diferencia.

### Regla 2. Consumo

Debe cumplirse:

```text
botas_recuperadas * consumo_unitario_bota == total consumido de palets
```

Comparación real:

- `consumo_calculado_botas = botas_registradas * consumo_unitario_bota`
- `consumo_total_palets = suma de palet.consumido de las trazas`

Resultado devuelto:

- `consistencias.consumo_coincide`

Si no coincide, también se devuelve la diferencia.

## Qué muestra la vista

### Cabecera

La cabecera muestra:

- pedido
- tipo de bota
- madera
- fecha de inicio
- resumen semanal
- resumen total del pedido
- resultado de las dos comprobaciones de consistencia

### KPIs

La cuadrícula de KPIs muestra:

- semana pedida
- semana fabricada
- pedido total
- pedido fabricado
- botas registradas
- m3 total
- m3 consumidos
- m3 restantes
- control semana BBDD vs botas
- control consumo botas vs palets

### Bloque de palets/lotes

Cada item muestra:

- palet
- lote inferido desde el código
- m3 total
- m3 consumidos
- m3 sobrante
- si queda en negativo
- botas fabricadas registradas en esa traza
- botas posibles con el sobrante
- esperado semana / total

### Bloque de códigos

Lista todos los códigos de botas fabricadas recuperados desde trazabilidad de producto.

## Qué significa cada acción

Las acciones de la vista están dejadas como flujo técnico preparado, pero sin lógica final de escritura profunda. No modifican negocio todavía.

### 1. Reasignar consumo negativo

Objetivo:

- mover parte del consumo imputado desde una traza/palet en negativo hacia otra traza/palet con capacidad suficiente

Técnicamente, esto implicará:

- identificar una traza origen con `m3_sobrante < 0`
- identificar una traza destino compatible
- recalcular cuánto consumo se traslada
- actualizar el reparto de consumo entre trazas

A nivel de datos, la solución final tendrá que decidir una de estas dos estrategias:

- ajustar solo los `consumido` de `PaletDB`
- o repartir realmente la imputación entre filas de `TrazabilidadFabricacionDB`

La segunda es la opción correcta si se quiere mantener trazabilidad fina y auditabilidad.

### 2. Convertir sobrante en palet procesado

Objetivo:

- transformar el sobrante de uno o varios palets en un nuevo palet procesado ubicado en `almacen`

Técnicamente, esto implicará:

- seleccionar el sobrante positivo de una o varias trazas/palets
- crear un nuevo `PaletDB` procesado
- llevar a cero el sobrante útil de los palets origen
- registrar el movimiento en `TrazabilidadProcesadoDB`

Campos esperables del nuevo palet:

- `procesado = 1`
- `ubicacion = almacen`
- mismo material
- tipo producto correspondiente
- cubicaje igual al sobrante consolidado

## Qué NO hace actualmente la vista

Actualmente `Cierre semanal`:

- no cierra estados
- no modifica `fabricacion_semanal`
- no corrige consumos
- no crea palets procesados
- no rellena `trazabilidad_procesado`

Solo:

- lee
- consolida
- valida
- muestra incoherencias
- deja preparadas las acciones futuras

## Motivo de diseño

Se ha creado una API nueva en vez de reutilizar combinaciones de APIs existentes porque:

- la vista necesita una composición coherente de varias tablas
- necesita validaciones cruzadas entre producción y consumo
- no se querían modificar métodos existentes de negocio

Así se mantiene aislado el comportamiento nuevo en:

- una acción WS nueva
- un método nuevo del `Colector`
- un JS nuevo específico de la vista

## Extensión prevista

La evolución natural de esta vista sería añadir APIs nuevas, independientes de la lógica ya existente:

- `reasignar_consumo_negativo`
- `crear_palet_procesado_desde_cierre`
- `cerrar_fabricacion_semanal`

La recomendación es mantenerlas separadas de los métodos actuales de fabricación y consumo, para no mezclar la operativa de planta con la regularización de cierre.

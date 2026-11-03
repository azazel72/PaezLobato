# Pruebas

Las pruebas están reunidas aquí. Las de Gestión se encuentran en `gestion/`;
las del terminal y servidor, en la raíz de esta carpeta. También se incluyen aquí
los recursos, etiquetas de ejemplo y utilidades manuales de impresión.

Ejecutar desde la raíz del proyecto, por ejemplo:

```powershell
node test/gestion/perfiles.cjs
node test/gestion/listados.cjs
python -B test/test_impresion_php.py
python -B -m unittest test.test_impresion_codigos
```

La prueba de interfaz se abre en `/test/gestion/interfaz.html` (añadiendo el
prefijo del proyecto cuando proceda). Las pruebas PHP requieren MySQL y utilizan
tablas temporales; consultar sus cabeceras antes de ejecutarlas.

`test_layout.py` es una prueba manual que **envía una etiqueta real a la impresora**;
no ejecutarla dentro de una batería automática. Las pruebas de lotes compartidos
y palets/fondos necesitan las dependencias Python del servidor.

En la comprobación del traslado, todas las pruebas JavaScript de Gestión pasaron.
Las antiguas del terminal alcanzan el código fuente, pero presentan expectativas
pendientes de actualizar en `test_cierre_lotes.js`, `test_fabricacion_impresion.js`,
`test_flejes_php_frontend.js` y `test_procesar_stock.js` (resultados del borrador,
URL antiguas de API y selección predeterminada). El traslado no cambia estas reglas
ni la lógica de la aplicación.

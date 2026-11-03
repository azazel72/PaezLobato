La etiqueta `bota.zpl` reproduce la salida de
`servidor/impresion/imprimir_etiqueta.py`, incluido el logotipo. Los parámetros
dinámicos son `{{codigo}}`, `{{barcode_x}}` y `{{modulo}}`.

El endpoint independiente `POST /api/terminal/imprimir_etiquetas.php` recibe JSON:

```json
{"codigos":["CODIGO_DE_BOTA_EXISTENTE"]}
```

Comprueba que las botas existen y envía una etiqueta por aparición a la impresora
configurada en `api/config/impresion.php`. Devuelve el mismo resultado de éxito
que `imprimir_etiqueta_fabricacion` de Python:

```json
{"ok":true,"codigos":["CODIGO_DE_BOTA_EXISTENTE"],"cantidad":1}
```

Los errores devuelven `ok: false` y `error`, con HTTP 400 para validación y 500
para fallos de envío. Un envío correcto confirma la escritura TCP, no la salida
física de la etiqueta. Un fallo parcial puede haber enviado algunas etiquetas.
No crea productos ni modifica existencias. La interfaz sigue usando Python.

Prueba sin BBDD ni impresora: `python test/test_impresion_php.py`.

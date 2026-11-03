import socket
import math

PRINTER_IP = "192.168.1.155"
PRINTER_PORT = 9100

LABEL_W = 400
LABEL_H = 800
MARGIN = 20

BAR_HEIGHT = 200   # alto de barras (dots). Girado 90º ocupa el eje X.
GAP = 20           # separación entre barcode y texto manual (dots)

def send_raw_zpl(zpl: str):
    data = zpl.encode("utf-8")
    with socket.create_connection((PRINTER_IP, PRINTER_PORT), timeout=5) as s:
        s.sendall(data)

def code128_modules_for_n_chars(n: int) -> int:
    # Aproximación estándar: Start(11) + n*11 + Check(11) + Stop(13) + Term(2) = 11n + 37
    return 11 * n + 37

def build_label(value: str, copies: int = 1) -> str:
    if not value:
        raise ValueError("El valor no puede estar vacío.")
    if copies < 1:
        raise ValueError("copies debe ser >= 1")

    avail_long = LABEL_H - 2 * MARGIN  # 760 dots (largo útil)
    modules = code128_modules_for_n_chars(len(value))

    # módulo lo más grande posible sin pasarnos del largo útil
    module_width = max(1, avail_long // modules)
    barcode_long = module_width * modules  # largo aproximado del símbolo (dots)

    avail_w = LABEL_W - 2 * MARGIN
    avail_h = LABEL_H - 2 * MARGIN

    # Barcode girado 90º:
    # - BAR_HEIGHT ocupa X
    # - barcode_long ocupa Y
    x = MARGIN + (avail_w - BAR_HEIGHT) // 2
    y = MARGIN + (avail_h - barcode_long) // 2

    # Texto manual “debajo” en orientación R => hacia +X
    text_x = x + BAR_HEIGHT + GAP
    text_y = y

    # Fuente (ajusta a gusto)
    font_h = 38
    font_w = 32

    return f"""^XA
^PW{LABEL_W}
^LL{LABEL_H}
^CI28
^LH0,0

^FO{x},{y}
^BY{module_width},2,{BAR_HEIGHT}
^BCR,,N,N,N
^FD{value}^FS

^FO{text_x},{text_y}
^A0R,{font_h},{font_w}
^FB{barcode_long},1,0,C,0
^FD{value}^FS

^PQ{copies}
^XZ
"""

def print_label(value: str, copies: int = 1):
    send_raw_zpl(build_label(value, copies=copies))

if __name__ == "__main__":
    print_label("A1B2C3D4E5F6G7H-000*", copies=1)
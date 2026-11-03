import socket

PRINTER_IP = "192.168.1.155"
PRINTER_PORT = 9100

# Prueba con 300 primero. Si no cuadra, pon 203.
DPI = 203

LABEL_W_MM = 50
LABEL_H_MM = 100

def mm_to_dots(mm: float, dpi: int) -> int:
    # dots = mm * (dpi / 25.4)
    return int(round(mm * dpi / 25.4))

def build_zpl_concentric_rectangles(w_dots: int, h_dots: int) -> str:
    # 5 rectángulos concéntricos (marcos), separaciones crecientes
    # Grosor de línea 2 dots para que se vea bien.
    thickness = 2

    # Márgenes (insets) en dots: 0, 20, 40, 60, 80 (ajústalo si quieres)
    insets = [0, 20, 40, 60, 80]

    parts = []
    parts.append("^XA")
    parts.append(f"^PW{w_dots}")
    parts.append(f"^LL{h_dots}")
    parts.append("^CI28")
    parts.append("^LH0,0")  # origen

    for inset in insets:
        rw = w_dots - 2 * inset
        rh = h_dots - 2 * inset
        if rw <= 0 or rh <= 0:
            continue
        # ^GBw,h,thickness  (sin relleno)
        parts.append(f"^FO{inset},{inset}^GB{rw},{rh},{thickness}^FS")

    # Opcional: cruz central para referencia
    cx = w_dots // 2
    cy = h_dots // 2
    parts.append(f"^FO{cx-1},0^GB2,{h_dots},1^FS")   # línea vertical
    parts.append(f"^FO0,{cy-1}^GB{w_dots},2,1^FS")   # línea horizontal

    parts.append("^XZ")
    return "\n".join(parts)

def send_raw(zpl: str):
    data = zpl.encode("utf-8")
    with socket.create_connection((PRINTER_IP, PRINTER_PORT), timeout=5) as s:
        s.sendall(data)

if __name__ == "__main__":
    w = mm_to_dots(LABEL_W_MM, DPI)
    h = mm_to_dots(LABEL_H_MM, DPI)

    zpl = build_zpl_concentric_rectangles(w, h)
    send_raw(zpl)
    print(f"Enviado. DPI={DPI} => PW={w} dots, LL={h} dots")
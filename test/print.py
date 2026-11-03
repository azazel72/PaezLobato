import socket

PRINTER_IP = "192.168.1.200"
PRINTER_PORT = 9100

# 43mm x 29mm @ 203dpi (8 dots/mm)
LABEL_W = 344
LABEL_H = 232
MARGIN = 12
GAP = 8
QR_CENTER_OFFSET_X = 7
QR_OFFSET_Y = 16  # ~2 mm a 203 dpi


def send_raw_zpl(zpl: str):
    data = zpl.encode("utf-8")
    with socket.create_connection((PRINTER_IP, PRINTER_PORT), timeout=5) as s:
        s.sendall(data)

def build_label(value: str, copies: int = 1) -> str:
    if not value:
        raise ValueError("El valor no puede estar vacío.")
    if copies < 1:
        raise ValueError("copies debe ser >= 1")

    avail_w = LABEL_W - 2 * MARGIN
    avail_h = LABEL_H - 2 * MARGIN

    font_h = 22
    font_w = 18
    text_h = font_h

    qr_h = max(0, avail_h - text_h - GAP)
    qr_size = min(avail_w, qr_h)

    qr_x = MARGIN + (avail_w - qr_size) // 2 + QR_CENTER_OFFSET_X
    qr_y_base = MARGIN
    qr_y = qr_y_base + QR_OFFSET_Y

    text_x = MARGIN
    text_y = qr_y_base + qr_size + GAP
    text_w = avail_w

    qr_mag = 5

    return f"""^XA
^PW{LABEL_W}
^LL{LABEL_H}
^CI28
^LH0,0

^FO{qr_x},{qr_y}
^BQN,2,{qr_mag}
^FDLA,{value}^FS

^FO{text_x},{text_y}
^A0N,{font_h},{font_w}
^FB{text_w},1,0,C,0
^FD{value}^FS

^PQ{copies}
^XZ
"""

def print_label(value: str, copies: int = 1):
    send_raw_zpl(build_label(value, copies=copies))

if __name__ == "__main__":
    print_label("A1B2C3D4E5F6G7H-000*", copies=1)

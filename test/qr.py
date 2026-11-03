import socket

PRINTER_IP = "192.168.1.200"
PRINTER_PORT = 9100

# 43mm x 29mm @ 203dpi (8 dots/mm)
LABEL_W = 344
LABEL_H = 232
GAP = 8

FONT_H = 22
FONT_W = 18

# Capacidades en bytes para modo Byte (8-bit) con ECC M, versiones 1..40.
QR_BYTE_CAPACITY_M = [
    14, 26, 42, 62, 84, 106, 122, 152, 180, 213,
    251, 287, 331, 362, 412, 450, 504, 560, 624, 666,
    711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370,
    1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331,
]


def send_raw_zpl(zpl: str):
    data = zpl.encode("utf-8")
    with socket.create_connection((PRINTER_IP, PRINTER_PORT), timeout=5) as s:
        s.sendall(data)


def choose_qr_version(byte_len: int) -> int:
    for idx, cap in enumerate(QR_BYTE_CAPACITY_M, start=1):
        if byte_len <= cap:
            return idx
    raise ValueError("El contenido es demasiado largo para QR ECC-M.")


def build_qr_label(value: str, copies: int = 1) -> str:
    if not value:
        raise ValueError("El valor no puede estar vacio.")
    if copies < 1:
        raise ValueError("copies debe ser >= 1")

    byte_len = len(value.encode("utf-8"))
    version = choose_qr_version(byte_len)
    modules = 21 + 4 * (version - 1)

    # Reservar el texto abajo y calcular la magnificacion maxima que cabe.
    max_qr_h = LABEL_H - FONT_H - GAP
    mag = min(LABEL_W // modules, max_qr_h // modules)
    if mag < 1:
        raise ValueError("El QR no cabe en la etiqueta con estos parametros.")

    qr_size = modules * mag
    block_h = qr_size + GAP + FONT_H

    qr_x = (LABEL_W - qr_size) // 2
    qr_y = (LABEL_H - block_h) // 2
    text_y = qr_y + qr_size + GAP

    return f"""^XA
^PW{LABEL_W}
^LL{LABEL_H}
^CI28
^LH0,0

^FO{qr_x},{qr_y}
^BQN,2,{mag}
^FDLA,{value}^FS

^FO0,{text_y}
^A0N,{FONT_H},{FONT_W}
^FB{LABEL_W},1,0,C,0
^FD{value}^FS

^PQ{copies}
^XZ
"""


def print_label(value: str, copies: int = 1):
    send_raw_zpl(build_qr_label(value, copies=copies))


if __name__ == "__main__":
    print_label("A1B2C3D4E5F6G7H-000*", copies=1)

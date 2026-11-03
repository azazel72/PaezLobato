import socket

PRINTER_IP = "192.168.1.200"
PRINTER_PORT = 9100

# 43mm x 29mm @ 203dpi
LABEL_W = 344
LABEL_H = 232


def send_raw_zpl(zpl: str):
    data = zpl.encode("utf-8")
    with socket.create_connection((PRINTER_IP, PRINTER_PORT), timeout=5) as s:
        s.sendall(data)


def build_calibration_label(copies: int = 1) -> str:
    cx = LABEL_W // 2
    cy = LABEL_H // 2

    return f"""^XA
^PW{LABEL_W}
^LL{LABEL_H}
^CI28
^LH0,0

^FO0,0^GB{LABEL_W},{LABEL_H},2^FS
^FO10,10^GB{LABEL_W - 20},{LABEL_H - 20},1^FS

^FO{cx},0^GB1,{LABEL_H},1^FS
^FO0,{cy}^GB{LABEL_W},1,1^FS

^FO{cx - 5},{cy - 5}^GB10,10,2^FS

^FO6,6^A0N,18,14^FD(0,0)^FS
^FO{LABEL_W - 85},6^A0N,18,14^FD({LABEL_W},0)^FS
^FO6,{LABEL_H - 24}^A0N,18,14^FD(0,{LABEL_H})^FS

^FO0,{LABEL_H - 24}
^A0N,20,16
^FB{LABEL_W},1,0,C,0
^FDCalibracion 43x29mm^FS

^PQ{copies}
^XZ
"""


if __name__ == "__main__":
    send_raw_zpl(build_calibration_label(copies=1))

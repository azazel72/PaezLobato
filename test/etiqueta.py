import socket

PRINTER_IP = "192.168.1.155"
PRINTER_PORT = 9100
TEMPLATE = "E:BC90TXT.ZPL"

def send(zpl: str):
    with socket.create_connection((PRINTER_IP, PRINTER_PORT), timeout=5) as s:
        s.sendall(zpl.encode("utf-8"))

def print_label(value):
    zpl = f"""
^XA
^XF{TEMPLATE}^FS
^FN1^FD{value}^FS
^XZ
"""
    send(zpl)

print_label("A1B2C3D4E5F6G7H")

if __name__ == "__main__":
    print_label("A1B2C3D4E5F6G7H", copies=1)
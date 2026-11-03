import socket

PRINTER_IP = "192.168.1.155"
PRINTER_PORT = 9100

TEMPLATE = "E:BC90.ZPL"

def send(zpl: str):
    with socket.create_connection((PRINTER_IP, PRINTER_PORT), timeout=5) as s:
        s.sendall(zpl.encode("utf-8"))

def upload_template():
    zpl = f"""
^XA
^DF{TEMPLATE}^FS
^PW400
^LL800
^CI28
^LH0,0

^BY3,2,200

^FO100,80
^BCR,,N,N,N
^FD{{DATA}}^FS

^FO325,80
^A0R,40,34
^FD{{DATA}}^FS

^XZ
"""
    send(zpl)

upload_template()
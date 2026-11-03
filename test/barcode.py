import socket


class ImprimirEtiqueta:
    PRINTER_IP = "192.168.1.69"
    PRINTER_PORT = 9100

    # 43mm x 29mm @ 203dpi (8 dots/mm)
    LABEL_W = 344
    LABEL_H = 232
    MARGIN = 10
    GAP = 6

    FONT_H = 30
    FONT_W = 22
    TITLE_FONT_H = 22
    TITLE_FONT_W = 16
    TITLE_LINE_GAP = 1
    TITLE_CHAR_SPACING = 1
    TITLE_SHIFT_LEFT = 10
    TITLE_ALLOW_OVERLAP = 24  # permite meterse en zona blanca del logo (~3 mm)
    BARCODE_MAX_MODULE_W = 4
    BARCODE_HEIGHT_REDUCTION = 0
    HEADER_CENTER_SHIFT_X = 18
    HEADER_SHIFT_Y = 8
    BARCODE_RAISE_Y = 10
    CODE_BLOCK_SHIFT_X = -20  # ~5 mm @ 203 dpi
    TEXT_SHIFT_X = 0

    LOGO_MAX_W = 84
    LOGO_MAX_H = 60
    TITLE_LINE_1 = "TONELERIA"
    TITLE_LINE_2 = "ANTONIO"
    TITLE_LINE_3 = "PAEZ LOBATO"

    LOGO_W = 84
    LOGO_H = 60
    LOGO_GFA = "^GFA,1120,1120,14,000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001C000000000000000000000000003E00000000000000000000000000FF80000000000000000000000003FFE000000000000000000000000FF3F800000000000000000000001FC1FC00000000000000000000007F007F0000000000000000000001FC001FC000000000000000000003F80007E00000000000000000000FE00003F80000000000000000003F800000FE0000000000000000007F003C003F000000000000000001FC003C001FC00000000000000007F0007E0007F0000000000000001FE0007E0001FC000000000000003F8000E60000FE00000000000000FE0000E700003F80000000000003F80000E700000FE0000000000007F00001FF800007F000000000001FC00001FF800001FC00000000007F000001C38000007F0000000001FE00000381C000001FC000000003F800000381C000000FE00000000FE00000000000000003F80000003FC00000000000000000FE0000007F0000000000000000007F000001FC0000000000000000001FC00007F0001FC01C01FF07FC0007F0000FE0003FE03C01FF0FFC0003FC003F800038F03E01C0003C0000FE007E000038707E01C0007800003F00FC000038707601C000F000001F80F000003FF0E701FE00E000000780F000003FE0E701FE01C000000780F000003F80FF81C003C000000780F000003801FF81C0078000000780F000003801E381C00F0000000780F000003801C1C1FF0FFC00000780F00000180381C1FF0FFE00000780F000000000000000000000000780F000000000000000000000000780FC00000000000000000000000F807E00000000000000000000003F003F800000003E003000000000FE001FE0000000FF007800000003FC0007F0000000E7807C00000007F00001FC000000C380FC0000001FC000007F000000F000EC0000007F0000003FC00000FE00CE000001FE0000000FE000003F81CE000003F800000003F800000F81FF00000FE000000000FE0000C383FF00003F80000000007F0001C383FF00007F00000000001FC000FF83838001FC000000000007F0007F07038007F0000000000001FC003C0301001FC0000000000000FE00000000003F800000000000003F8000000000FE000000000000000FE000000003F80000000000000007F80000000FF00000000000000001FC0000001FC000000000000000007F0000007F0000000000000000001FC00001FC0000000000000000000FF00003F800000000000000000003F8000FE000000000000000000000FE003F80000000000000000000003F80FE00000000000000000000001FC1FC000000000000000000000007FFF0000000000000000000000001FFC00000000000000000000000007F000000000000000000000000003E00000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

    def __init__(self, printer_ip: str | None = None, printer_port: int | None = None):
        if printer_ip:
            self.PRINTER_IP = printer_ip
        if printer_port:
            self.PRINTER_PORT = printer_port

    def send_raw_zpl(self, zpl: str):
        data = zpl.encode("utf-8")
        with socket.create_connection((self.PRINTER_IP, self.PRINTER_PORT), timeout=5) as s:
            s.sendall(data)

    def _code128_modules_for_n_chars(self, n: int) -> int:
        # Start + data + check + stop + termination
        return 11 * n + 37

    def _build_label_botas(self, value: str, copies: int = 1) -> str:
        if not value:
            raise ValueError("El valor no puede estar vacio.")
        if copies < 1:
            raise ValueError("copies debe ser >= 1")

        avail_w = self.LABEL_W - (2 * self.MARGIN)
        modules = self._code128_modules_for_n_chars(len(value))
        module_width = max(1, min(self.BARCODE_MAX_MODULE_W, avail_w // modules))
        barcode_w = modules * module_width
        bar_x = ((self.LABEL_W - barcode_w) // 2) + self.CODE_BLOCK_SHIFT_X

        # Bloque superior alineado al ancho del barcode.
        header_y = self.MARGIN + self.HEADER_SHIFT_Y
        logo_x = self.HEADER_CENTER_SHIFT_X
        logo_y = header_y + max(0, (self.LOGO_MAX_H - self.LOGO_H) // 2)

        title_right = self.LABEL_W - self.MARGIN
        title_left_min = logo_x + self.LOGO_W + 8 - self.TITLE_ALLOW_OVERLAP - 60
        line2_estimated_w = len(self.TITLE_LINE_2) * (self.TITLE_FONT_W + self.TITLE_CHAR_SPACING)
        line3_estimated_w = len(self.TITLE_LINE_3) * (self.TITLE_FONT_W + self.TITLE_CHAR_SPACING)
        title_max_w = max(20, title_right - title_left_min)
        title_w = min(title_max_w, max(20, line2_estimated_w, line3_estimated_w))
        title_x = title_right - title_w - self.TITLE_SHIFT_LEFT
        title_x = max(title_left_min, title_x)
        title_block_h = (3 * self.TITLE_FONT_H) + (2 * self.TITLE_LINE_GAP)
        title_y = logo_y + max(0, (self.LOGO_H - title_block_h) // 2)

        header_h = max(self.LOGO_H, title_block_h) + 40
        barcode_top = max(self.MARGIN, header_y + header_h - self.BARCODE_RAISE_Y)

        bar_h = max(64, self.LABEL_H - barcode_top - self.GAP - self.FONT_H - self.MARGIN)
        bar_y = barcode_top
        text_y = bar_y + bar_h + self.GAP
        text_x = self.MARGIN + self.CODE_BLOCK_SHIFT_X + self.TEXT_SHIFT_X
        text_w = self.LABEL_W - (2 * self.MARGIN) - self.CODE_BLOCK_SHIFT_X
        title_y_2 = title_y + self.TITLE_FONT_H + self.TITLE_LINE_GAP
        title_y_3 = title_y_2 + self.TITLE_FONT_H + self.TITLE_LINE_GAP

        return f"""^XA
^PW{self.LABEL_W}
^LL{self.LABEL_H}
^CI28
^LH0,0

^FO{logo_x},{logo_y}
{self.LOGO_GFA}

^FO{title_x},{title_y}
^A0N,{self.TITLE_FONT_H},{self.TITLE_FONT_W}
^FB{title_w},1,0,C,0
^FD{self.TITLE_LINE_1}^FS
^FO{title_x + 1},{title_y}
^A0N,{self.TITLE_FONT_H},{self.TITLE_FONT_W}
^FB{title_w},1,0,C,0
^FD{self.TITLE_LINE_1}^FS

^FO{title_x},{title_y_2}
^A0N,{self.TITLE_FONT_H},{self.TITLE_FONT_W}
^FB{title_w},1,0,C,0
^FD{self.TITLE_LINE_2}^FS
^FO{title_x + 1},{title_y_2}
^A0N,{self.TITLE_FONT_H},{self.TITLE_FONT_W}
^FB{title_w},1,0,C,0
^FD{self.TITLE_LINE_2}^FS

^FO{title_x},{title_y_3}
^A0N,{self.TITLE_FONT_H},{self.TITLE_FONT_W}
^FB{title_w},1,0,C,0
^FD{self.TITLE_LINE_3}^FS
^FO{title_x + 1},{title_y_3}
^A0N,{self.TITLE_FONT_H},{self.TITLE_FONT_W}
^FB{title_w},1,0,C,0
^FD{self.TITLE_LINE_3}^FS

^FO{bar_x},{bar_y}
^BY{module_width},2,{bar_h-self.BARCODE_HEIGHT_REDUCTION}
^BCN,,N,N,N
^FD{value}^FS

^FO{text_x+10},{text_y}
^A0N,{self.FONT_H},{self.FONT_W}
^FB{text_w-10},1,0,C,0
^FD{value}^FS

^PQ{copies}
^XZ
"""

    def _build_label_palets(self, value: str, copies: int = 1) -> str:
        # Placeholder: usa mismo esquema que botas hasta que se defina uno distinto.
        return self._build_label_botas(value, copies=copies)
    
    def obtener_etiqueta(self, tipo: str, value: str, copies: int = 1):
        if tipo == "botas":
            return self._build_label_botas(value, copies=copies)
        elif tipo == "palets":
            return self._build_label_palets(value, copies=copies)
        else:
            raise ValueError("Tipo de etiqueta no soportado.")
        
    def imprimir_zpl(self, zpl: str):
        self.send_raw_zpl(zpl)

    def imprimir_etiqueta(self, tipo: str, value: str, copies: int = 1):
        if tipo == "botas":
            zpl = self._build_label_botas(value, copies=copies)
        elif tipo == "palets":
            zpl = self._build_label_palets(value, copies=copies)
        else:
            raise ValueError("Tipo de etiqueta no soportado.")
        self.send_raw_zpl(zpl)


ie = ImprimirEtiqueta()
ie.imprimir_etiqueta("botas", "91AU4049811-260300003", 1)

"""Prueba aislada del contrato de impresión; no conecta a BBDD ni impresora."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest


class Campo:
    def __eq__(self, _other):
        return self

    def in_(self, _other):
        return self


class Consulta:
    def where(self, _condition):
        return self


class ImpresionCodigosTest(unittest.TestCase):
    def setUp(self):
        self.etiquetas = []
        self.envios = []
        self.existentes = ['BOTA1', 'BOTA2']
        prueba = self

        class Sesion:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                pass

            def exec(self, _query):
                return SimpleNamespace(all=lambda: prueba.existentes)

        class Impresora:
            def obtener_etiqueta(self, tipo, codigo, copies=1):
                prueba.etiquetas.append((tipo, codigo, copies))
                return f'ZPL:{codigo};'

            def imprimir_zpl(self, contenido):
                prueba.envios.append(contenido)
                if getattr(prueba, 'fallar', False):
                    raise OSError('Impresora desconectada')

        ruta = Path(__file__).resolve().parents[1] / 'servidor/colector.py'
        arbol = ast.parse(ruta.read_text(encoding='utf-8-sig'))
        metodo = next(n for n in ast.walk(arbol) if isinstance(n, ast.FunctionDef) and n.name == 'imprimir_etiqueta_fabricacion')
        entorno = {'DB': SimpleNamespace(crear_sesion=Sesion),
                   'ProductoDB': SimpleNamespace(codigo=Campo(), tipo=Campo()),
                   'select': lambda *_args: Consulta(), 'ImprimirEtiqueta': Impresora}
        exec(compile(ast.Module(body=[metodo], type_ignores=[]), str(ruta), 'exec'), entorno)
        self.imprimir = lambda data: entorno['imprimir_etiqueta_fabricacion'](None, data)

    def test_lista_una_etiqueta_por_codigo_sin_escrituras(self):
        respuesta = self.imprimir({'codigos': ['BOTA2', 'BOTA1', 'BOTA2']})
        self.assertTrue(respuesta['ok'])
        self.assertEqual(respuesta['cantidad'], 3)
        self.assertEqual(self.etiquetas, [('botas', 'BOTA2', 1), ('botas', 'BOTA1', 1), ('botas', 'BOTA2', 1)])
        self.assertEqual(self.envios, ['ZPL:BOTA2;ZPL:BOTA1;ZPL:BOTA2;'])

    def test_rechaza_payload_antiguo_y_codigos_inexistentes(self):
        for payload in [{'fabricacion_semanal_id': 1}, {'codigos': []}, {'codigos': 'BOTA1'}, {'codigos': [None]}, {'codigos': ['NO_EXISTE']}]:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                self.imprimir(payload)
        self.assertEqual(self.envios, [])

    def test_fallo_impresora_se_comunica_al_cliente(self):
        self.fallar = True
        with self.assertRaises(OSError):
            self.imprimir({'codigos': ['BOTA1']})


if __name__ == '__main__':
    unittest.main()

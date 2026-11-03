"""Validaciones reales de expedición/envinado, aisladas de BBDD y WebSocket."""
import ast
from pathlib import Path
from types import SimpleNamespace as NS
import unittest

class Field:
    def __eq__(self, _): return self
    def in_(self, _): return self
    def desc(self): return self

class Producto:
    codigo = Field()

class Contenedor:
    pedido_id = Field()
    contenedor = Field()
    id = Field()

class Pedido: pass
class Ubicacion: pass
class Instalacion: pass

class DestinoPedidoTests(unittest.TestCase):
    def ejecutar(self, metodo, pedido=2, estado=1):
        producto=NS(id=1,codigo='BOTA',tipo='BOTA',pedido_id=2,pedido_fabricacion_id=1,produccion_id=10,estado=estado)
        prueba=self
        class Query:
            def __init__(self, model): self.model=model
            def where(self, *_): return self
            def order_by(self, *_): return self
            def with_for_update(self): prueba.bloqueado=True; return self
        class Session:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def get(self, model, id):
                if model is Pedido: return NS(id=id,destino='C' if metodo.startswith('expedir') else 'E')
                if model is Ubicacion: return NS(id=id,instalacion_id=1)
                return NS(id=id,tipo='B')
            def exec(self, query): return NS(all=lambda:[producto],first=lambda:NS(id=9))
            def add(self, _): pass
            def commit(self): prueba.confirmado=True
            def refresh(self, _): pass
        ruta=Path(__file__).resolve().parents[1]/'servidor/colector.py'
        tree=ast.parse(ruta.read_text(encoding='utf-8-sig'))
        node=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name==metodo)
        ctx={'DB':NS(crear_sesion=Session),'ProductoDB':Producto,'PedidoDB':Pedido,
             'UbicacionDB':Ubicacion,'InstalacionDB':Instalacion,'ContenedorDB':Contenedor,
             'ProductoDTO':NS(from_db=lambda p:p),'ContenedorDTO':NS(from_db=lambda p:p),'select':Query}
        exec(compile(ast.Module(body=[node],type_ignores=[]),str(ruta),'exec'),ctx)
        self.confirmado=False; self.bloqueado=False
        result=ctx[metodo](NS(maestros=NS(productos={},contenedores={})),{'pedido_id':pedido,'codigos':['BOTA'],'contenedor':'C1','ubicacion_id':1})
        self.assertTrue(self.bloqueado)
        self.assertEqual(producto.produccion_id,10)
        self.assertEqual(producto.pedido_fabricacion_id,1)
        return result

    def test_usa_pedido_actual_sin_exigir_fabricacion_del_destino(self):
        for metodo in ['expedir_productos_destino','envinar_productos_destino']:
            with self.subTest(metodo=metodo):
                self.assertEqual(self.ejecutar(metodo)['cantidad'],1)
                self.assertTrue(self.confirmado)
                with self.assertRaises(ValueError): self.ejecutar(metodo,pedido=1)
                self.assertFalse(self.confirmado)

    def test_bloquea_botas_ya_enviadas(self):
        for metodo in ['expedir_productos_destino','envinar_productos_destino']:
            for estado in [3,4,6]:
                with self.subTest(metodo=metodo,estado=estado), self.assertRaises(ValueError): self.ejecutar(metodo,estado=estado)
                self.assertFalse(self.confirmado)

if __name__=='__main__': unittest.main()

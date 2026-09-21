import unittest
from unittest.mock import patch

from sqlmodel import Session, SQLModel, create_engine, select

from servidor.conexiones.crud_routes import CrudRoutes  # noqa: F401
from servidor.colector import Colector
from servidor.modelos import FabricacionSemanalDB, PaletDB, TrazabilidadFabricacionDB
from servidor.persistencia import DB


class LotesCompartidosTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine, tables=[
            FabricacionSemanalDB.__table__, PaletDB.__table__, TrazabilidadFabricacionDB.__table__,
        ])
        with Session(self.engine) as session:
            session.add(FabricacionSemanalDB(id=28, pedido_id=1, tipo_producto_id=5, estado=2))
            session.add(FabricacionSemanalDB(id=29, pedido_id=2, tipo_producto_id=5, estado=2))
            session.add(PaletDB(id=512, codigo="CAST-FRA#000215", cubicaje=5, consumido=1, procesado=True))
            session.add(PaletDB(id=513, codigo="HUERFANO#000216", cubicaje=2, consumido=0, procesado=True))
            session.add(TrazabilidadFabricacionDB(id=10, fabricacion_semanal_id=28, palet_id=512, estado=0))
            session.add(TrazabilidadFabricacionDB(id=11, fabricacion_semanal_id=None, palet_id=513, estado=1))
            session.commit()
        self.colector = Colector.__new__(Colector)
        self.sesiones = patch.object(DB, "crear_sesion", side_effect=lambda: Session(self.engine))
        self.sesiones.start()

    def tearDown(self):
        self.sesiones.stop()
        self.engine.dispose()

    def test_las_dos_lineas_ven_los_mismos_palets_sin_duplicar_volumen(self):
        self.assertEqual(len(self.colector.listar_trazabilidad_fabricacion(28)), 1)
        self.assertEqual(len(self.colector.listar_trazabilidad_fabricacion(29)), 0)
        self.assertEqual(len(self.colector.listar_trazabilidad_fabricacion(29, incluir_huerfanas=True)), 1)
        inicial = self.colector.listar_trazabilidad_fabricacion(29, incluir_compartidas=True)
        self.assertEqual({item["palet_id"] for item in inicial}, {512, 513})
        self.assertTrue(all(item["estado"] == 1 for item in inicial))

        self.colector.actualizar_estado_lote_fabricacion_compartida({
            "fabricacion_semanal_id": 29, "lote": "CAST-FRA", "estado": 0,
        })
        with Session(self.engine) as session:
            trazas = session.exec(select(TrazabilidadFabricacionDB).where(TrazabilidadFabricacionDB.palet_id == 512)).all()
            self.assertEqual({traza.fabricacion_semanal_id for traza in trazas}, {28, 29})
            _, grupos = self.colector._obtener_trazas_palets_por_lote(session, 29, "CAST-FRA")
            usadas = self.colector._consumir_duela_bota_desde_trazas(
                session, [{"lote": "CAST-FRA", "trazas_palets": grupos}], 0.5,
            )
            self.assertEqual(usadas[0].fabricacion_semanal_id, 29)
            session.commit()

        linea_28 = self.colector.listar_trazabilidad_fabricacion(28, incluir_compartidas=True)
        linea_29 = self.colector.listar_trazabilidad_fabricacion(29, incluir_compartidas=True)
        self.assertEqual(len(linea_28), 2)
        self.assertEqual(len(linea_29), 2)
        self.assertEqual(next(item for item in linea_28 if item["palet_id"] == 512)["palet_consumido"], 1.5)
        self.assertEqual(next(item for item in linea_29 if item["palet_id"] == 512)["palet_consumido"], 1.5)
        self.assertEqual(next(item for item in linea_29 if item["palet_id"] == 512)["estado"], 0)

        self.colector.actualizar_estado_lote_fabricacion_compartida({
            "fabricacion_semanal_id": 29, "lote": "CAST-FRA", "estado": 1,
        })
        self.assertEqual(next(item for item in self.colector.listar_trazabilidad_fabricacion(28, incluir_compartidas=True)
                              if item["palet_id"] == 512)["estado"], 0)
        self.assertEqual(next(item for item in self.colector.listar_trazabilidad_fabricacion(29, incluir_compartidas=True)
                              if item["palet_id"] == 512)["estado"], 1)

    def test_muestra_propias_huerfanas_y_otras_no_finalizadas(self):
        with Session(self.engine) as session:
            session.add(FabricacionSemanalDB(id=30, pedido_id=3, tipo_producto_id=5, estado=3))
            session.add(FabricacionSemanalDB(id=31, pedido_id=4, tipo_producto_id=5, estado=4))
            session.add(PaletDB(id=514, codigo="CAST-FRA#000217", cubicaje=5, consumido=0, procesado=True))
            session.add(PaletDB(id=515, codigo="FINALIZADO#000218", cubicaje=5, consumido=5, procesado=True))
            session.add(PaletDB(id=516, codigo="COMPARTIDO#000219", cubicaje=5, consumido=0, procesado=True))
            session.add(PaletDB(id=517, codigo="CAST-FRA#000220", cubicaje=5, consumido=6, procesado=True))
            session.add(PaletDB(id=518, codigo="CAST-FRA#000221", cubicaje=5, consumido=5, procesado=True))
            session.add(TrazabilidadFabricacionDB(fabricacion_semanal_id=30, palet_id=514, estado=0))
            session.add(TrazabilidadFabricacionDB(fabricacion_semanal_id=30, palet_id=515, estado=0))
            session.add(TrazabilidadFabricacionDB(fabricacion_semanal_id=30, palet_id=516, estado=0))
            session.add(TrazabilidadFabricacionDB(fabricacion_semanal_id=28, palet_id=516, estado=1))
            session.add(TrazabilidadFabricacionDB(fabricacion_semanal_id=31, palet_id=517, estado=0))
            session.add(TrazabilidadFabricacionDB(fabricacion_semanal_id=29, palet_id=518, estado=1))
            session.commit()

        listado = self.colector.listar_trazabilidad_fabricacion(29, incluir_compartidas=True)
        self.assertEqual({item["palet_id"] for item in listado}, {512, 513, 516, 517, 518})
        self.colector.actualizar_estado_lote_fabricacion_compartida({
            "fabricacion_semanal_id": 29, "lote": "CAST-FRA", "estado": 0,
        })
        with Session(self.engine) as session:
            propias = session.exec(select(TrazabilidadFabricacionDB).where(
                TrazabilidadFabricacionDB.fabricacion_semanal_id == 29
            )).all()
            self.assertEqual({traza.palet_id for traza in propias}, {512, 517, 518})


if __name__ == "__main__":
    unittest.main()

import unittest
from unittest.mock import patch

from sqlmodel import Session, SQLModel, create_engine, select

# El paquete de conexiones inicializa sus rutas antes de importar Colector.
from servidor.conexiones.crud_routes import CrudRoutes  # noqa: F401
from servidor.colector import Colector
from servidor.modelos import ConsumoDB, PaletDB, ProveedorDB, TipoProductoDB, TrazabilidadFabricacionDB, TrazabilidadProcesadoDB
from servidor.persistencia import DB


class PaletsFondosTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine, tables=[
            ProveedorDB.__table__, PaletDB.__table__, TrazabilidadProcesadoDB.__table__,
            ConsumoDB.__table__, TipoProductoDB.__table__, TrazabilidadFabricacionDB.__table__,
        ])
        with Session(self.engine) as session:
            session.add(ProveedorDB(id=1, nombre="Proveedor Uno"))
            session.add(PaletDB(id=10, codigo="STOCK", cubicaje=10, consumido=0, procesado=False))
            session.commit()
        self.colector = Colector.__new__(Colector)
        self.sesiones = patch.object(DB, "crear_sesion", side_effect=lambda: Session(self.engine))
        self.sesiones.start()

    def tearDown(self):
        self.sesiones.stop()
        self.engine.dispose()

    def test_acumula_en_un_solo_palet_y_muestra_saldo_negativo(self):
        for volumen in (2, 3):
            self.colector.agregar_palet_fondos_desde_stock({
                "proveedor_id": 1, "palet_origen_id": 10, "cubicaje": volumen, "paquetes": 1,
            })
        with Session(self.engine) as session:
            origen = session.get(PaletDB, 10)
            destinos = session.exec(select(PaletDB).where(PaletDB.codigo == "Proveedor Uno#fondos")).all()
            trazas = session.exec(select(TrazabilidadProcesadoDB)).all()
            self.assertEqual(origen.consumido, 5)
            self.assertEqual(len(destinos), 1)
            self.assertEqual(destinos[0].cubicaje, 5)
            self.assertEqual(len(trazas), 2)
            destinos[0].consumido = 6
            session.add(destinos[0])
            session.commit()
        self.assertEqual(self.colector.listar_palets_fondos()[0]["restante"], -1)

    def test_cada_bota_descuenta_dos_veces_el_consumo_de_fondos(self):
        with Session(self.engine) as session:
            palet = PaletDB(codigo="Proveedor Uno#fondos", cubicaje=1, consumido=0, procesado=True)
            session.add(palet)
            session.commit()
            self.colector._consumir_fondos_bota(session, palet, 0.6)
            session.commit()
        self.assertAlmostEqual(self.colector.listar_palets_fondos()[0]["restante"], -0.2)

    def test_acepta_un_palet_existente_por_codigo(self):
        with Session(self.engine) as session:
            session.add(PaletDB(codigo="PALET-1", cubicaje=4, consumido=0, procesado=True))
            session.commit()
        self.colector.agregar_palet_fondos_desde_stock({
            "proveedor_id": 1, "lote_palet": "PALET-1", "cubicaje": 1.5,
        })
        with Session(self.engine) as session:
            origen = session.exec(select(PaletDB).where(PaletDB.codigo == "PALET-1")).one()
            self.assertEqual(origen.consumido, 1.5)
        self.assertEqual(self.colector.listar_palets_fondos()[0]["cubicaje"], 1.5)

    def test_impresion_rechaza_el_payload_antiguo_de_fabricacion(self):
        with self.assertRaisesRegex(ValueError, "lista de codigos"):
            self.colector.imprimir_etiqueta_fabricacion({
                "fabricacion_semanal_id": 1,
                "lotes": ["LOTE0001"],
                "tipo": "BOTA",
                "operarios_ids": [1],
                "batidero": 11,
                "cantidad_etiquetas": 1,
            })

    def test_receta_no_acepta_consumo_de_duela_cero(self):
        with Session(self.engine) as session:
            session.add(TipoProductoDB(id=12, tipo="DUELA", codigo="DU130", descripcion="Duela"))
            session.add(ConsumoDB(bota_id=5, consumible_id=12, consumo=0))
            session.commit()
            with self.assertRaisesRegex(ValueError, "consumo de DUELA mayor que cero"):
                self.colector._obtener_receta_bota(session, 5)

    def test_receta_suma_duelas_y_fondos(self):
        with Session(self.engine) as session:
            session.add(TipoProductoDB(id=12, tipo="DUELA", codigo="DU130", descripcion="Duela 1"))
            session.add(TipoProductoDB(id=16, tipo="DUELA", codigo="DU070", descripcion="Duela 2"))
            session.add(TipoProductoDB(id=7, tipo="FONDO", codigo="F60", descripcion="Fondo 1"))
            session.add(TipoProductoDB(id=8, tipo="FONDO", codigo="F70", descripcion="Fondo 2"))
            session.add(ConsumoDB(bota_id=5, consumible_id=12, consumo=0.12))
            session.add(ConsumoDB(bota_id=5, consumible_id=16, consumo=0.2))
            session.add(ConsumoDB(bota_id=5, consumible_id=7, consumo=0.1))
            session.add(ConsumoDB(bota_id=5, consumible_id=8, consumo=0.15))
            session.commit()
            duela, fondos, _ = self.colector._obtener_receta_bota(session, 5)
            self.assertAlmostEqual(duela, 0.32)
            self.assertAlmostEqual(fondos, 0.25)
            self.assertAlmostEqual(self.colector._obtener_consumo_unitario_bota_session(session, 5), 0.32)

    def test_receta_no_acepta_fondos_sin_consumo(self):
        with Session(self.engine) as session:
            session.add(TipoProductoDB(id=12, tipo="DUELA", codigo="DU130", descripcion="Duela"))
            session.add(ConsumoDB(bota_id=5, consumible_id=12, consumo=0.5))
            session.commit()
            with self.assertRaisesRegex(ValueError, "consumo de FONDO mayor que cero"):
                self.colector._obtener_receta_bota(session, 5)

    def test_una_bota_aplica_ambas_sumas_a_sus_palets(self):
        with Session(self.engine) as session:
            duela = PaletDB(codigo="DUELA", cubicaje=10, consumido=0, procesado=True)
            fondos = PaletDB(codigo="Proveedor Uno#fondos", cubicaje=10, consumido=0, procesado=True)
            session.add(duela)
            session.add(fondos)
            session.flush()
            traza = TrazabilidadFabricacionDB(palet_id=duela.id, estado=0)
            session.add(traza)
            session.flush()
            self.colector._consumir_duela_bota_desde_trazas(
                session, [{"lote": "DUELA", "trazas_palets": [(traza, duela)]}], 0.32,
            )
            self.colector._consumir_fondos_bota(session, fondos, 0.25)
            session.commit()
            self.assertAlmostEqual(duela.consumido, 0.32)
            self.assertAlmostEqual(fondos.consumido, 0.5)


if __name__ == "__main__":
    unittest.main()

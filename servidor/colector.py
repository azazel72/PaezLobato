from datetime import date, datetime, timedelta
from calendar import monthrange
import re
import logging
import sys
import threading
from typing import List, get_args
from sqlmodel import Session

from servidor.herramientas.utilidades import obtener_anterior_dia_semana
from servidor.herramientas.BcryptHelper import BcryptHelper

from .modelos import ClienteDB, EstadoPedidoDB, EstadoFabricacionSemanalDB, EstadoProductoDB, EstadoFlejeDB, EstadoTrazabilidadFabricacionDB, EstadoPaletDB
from .modelos import InstalacionDB, UbicacionDB, ProveedorDB, UsuarioDB, RolDB, PuestoTrabajoDB, MaterialDB, ContenedorDB, EntradaDB, LineaEntradaDB, PaletDB, ProductoDB, ProductoOperarioDB, ArchivoSubidoDB, AmbienteDB, DiaFestivoDB, EntradaFlejeDB, CubicajeDB, TostadoDB
from .modelos import PedidoDB, AnaliticaDB, BotaEnvinadaAnaliticaDB, BotaEnvinadaArchivoDB
from .modelos import TipoProductoDB, FabricacionSemanalDB, TrazabilidadProcesadoDB, TrazabilidadFabricacionDB, TrazabilidadMovimientoDB, TrazabilidadProductoDB, ConsumoDB
from .modelos import PlanCamionDB, PlanFacturacionDB, PlanMaterialDB, CuadranteDB, CuadranteDetalleDB
from .persistencia import GenericRepository, DB
from sqlmodel import select
from sqlalchemy import extract, func, or_
from .dominio import PlanificacionEntradasDTO, MaestrosDTO, PlanMaterialDTO, PlanFacturacionDTO, PlanCamionDTO, CuadranteDTO, CuadranteDetalleDTO, FabricacionDTO
from .dominio import ClienteDTO, EstadoPedidoDTO, EstadoFabricacionSemanalDTO, EstadoProductoDTO, EstadoFlejeDTO, EstadoTrazabilidadFabricacionDTO, EstadoPaletDTO, InstalacionDTO, UbicacionDTO, ProveedorDTO, UsuarioDTO, RolDTO, PuestoTrabajoDTO, MaterialDTO, ContenedorDTO, EntradaDTO, LineaEntradaDTO, PaletDTO, ProductoDTO, ArchivoSubidoDTO, AmbienteDTO, DiaFestivoDTO, EntradaFlejeDTO, CubicajeDTO, TostadoDTO, CuadrantesDTO
from .dominio import PedidoDTO, AnaliticaDTO, TipoProductoDTO, FabricacionSemanalDTO, TrazabilidadProcesadoDTO, TrazabilidadFabricacionDTO, TrazabilidadProductoDTO, ConsumoDTO
from servidor.impresion import ImprimirEtiqueta
from servidor.conexiones.broadcast import broadcast_error, broadcast_event

logger = logging.getLogger("paezlobato_colector")

class Colector:

    colector: "Colector" = None
    planificacion_entradas: "PlanificacionEntradasDTO" = None
    maestros: "MaestrosDTO" = None
    cuadrantes: "CuadrantesDTO" = None
    fabricacion: "FabricacionDTO" = None


    def __init__(self):
        Colector.colector = self
        self.planificacion_entradas = PlanificacionEntradasDTO()
        self.maestros = MaestrosDTO()
        self.cuadrantes = CuadrantesDTO()
        self.fabricacion = FabricacionDTO()

        self.repo_facturacion = GenericRepository(PlanFacturacionDB)
        self.repo_camiones = GenericRepository(PlanCamionDB)
        self.repo_materiales = GenericRepository(PlanMaterialDB)

        self.repo_clientes = GenericRepository(ClienteDB)
        self.repo_estados_pedidos = GenericRepository(EstadoPedidoDB)
        self.repo_estados_fabricacion_semanal = GenericRepository(EstadoFabricacionSemanalDB)
        self.repo_estados_productos = GenericRepository(EstadoProductoDB)
        self.repo_estados_flejes = GenericRepository(EstadoFlejeDB)
        self.repo_estados_trazabilidad_fabricacion = GenericRepository(EstadoTrazabilidadFabricacionDB)
        self.repo_estados_palets = GenericRepository(EstadoPaletDB)
        self.repo_instalaciones = GenericRepository(InstalacionDB)
        self.repo_ubicaciones = GenericRepository(UbicacionDB)
        self.repo_proveedores = GenericRepository(ProveedorDB)
        self.repo_puestos_trabajo = GenericRepository(PuestoTrabajoDB)

        self.repo_materiales_maestro = GenericRepository(MaterialDB)
        self.repo_contenedores = GenericRepository(ContenedorDB)
        self.repo_entradas = GenericRepository(EntradaDB)
        self.repo_lineas_entrada = GenericRepository(LineaEntradaDB)
        self.repo_palets = GenericRepository(PaletDB)
        self.repo_productos = GenericRepository(ProductoDB)
        self.repo_archivos_subidos = GenericRepository(ArchivoSubidoDB)
        self.repo_ambientes = GenericRepository(AmbienteDB)
        self.repo_dias_festivos = GenericRepository(DiaFestivoDB)
        self.repo_entradas_flejes = GenericRepository(EntradaFlejeDB)
        self.repo_cubicaje = GenericRepository(CubicajeDB)
        self.repo_tostados = GenericRepository(TostadoDB)
        self.repo_pedidos = GenericRepository(PedidoDB)
        self.repo_analiticas = GenericRepository(AnaliticaDB)
        self.repo_bota_envinada_analitica = GenericRepository(BotaEnvinadaAnaliticaDB)
        self.repo_bota_envinada_archivo = GenericRepository(BotaEnvinadaArchivoDB)
        self.repo_tipos_producto = GenericRepository(TipoProductoDB)
        self.repo_fabricacion_semanal = GenericRepository(FabricacionSemanalDB)
        self.repo_trazabilidad_procesado = GenericRepository(TrazabilidadProcesadoDB)
        self.repo_trazabilidad_fabricacion = GenericRepository(TrazabilidadFabricacionDB)
        self.repo_trazabilidad_producto = GenericRepository(TrazabilidadProductoDB)
        self.repo_consumos = GenericRepository(ConsumoDB)

        self.repo_usuarios = GenericRepository(UsuarioDB)
        self.repo_roles = GenericRepository(RolDB)

        self.repo_cuadrantes = GenericRepository(CuadranteDB)
        self.repo_cuadrante_detalles = GenericRepository(CuadranteDetalleDB)

    def _descripcion_tipo_producto(self, tipo_producto_id: int | None) -> str:
        if not tipo_producto_id:
            return "-"
        tipo = self.fabricacion.tipos_producto.get(int(tipo_producto_id))
        if not tipo:
            return str(tipo_producto_id)
        return tipo.descripcion or tipo.codigo or str(tipo_producto_id)

    def _descripcion_producto(self, producto_id: int | None) -> str:
        if not producto_id:
            return "-"
        producto = self.maestros.productos.get(int(producto_id))
        if not producto:
            return str(producto_id)
        return producto.codigo or str(producto_id)

    def _descripcion_material(self, material_id: int | None) -> str:
        if not material_id:
            return "-"
        material = self.maestros.materiales.get(int(material_id))
        if not material:
            return str(material_id)
        return material.descripcion or str(material_id)

    def _descripcion_tostado(self, tostado_id: int | None) -> str:
        if not tostado_id:
            return "-"
        tostado = self.maestros.tostados.get(int(tostado_id)) if self.maestros.tostados else None
        if not tostado:
            return str(tostado_id)
        return tostado.descripcion or str(tostado_id)

    def _es_tipo_duela(self, tipo_producto_id: int | None) -> bool:
        if not tipo_producto_id:
            return False
        tipo = self.fabricacion.tipos_producto.get(int(tipo_producto_id))
        return str(getattr(tipo, "tipo", "")).upper() == "DUELA" if tipo else False

    def _campos_analitica(self) -> list[dict]:
        return [
            {"clave": "deposito", "etiqueta": "Depósito", "unidad": ""},
            {"clave": "litros", "etiqueta": "Litros", "unidad": "l"},
            {"clave": "alcohol", "etiqueta": "Alcohol", "unidad": "% vol"},
            {"clave": "av", "etiqueta": "AV", "unidad": "g/l"},
            {"clave": "ph", "etiqueta": "pH", "unidad": ""},
            {"clave": "ntu", "etiqueta": "NTU", "unidad": "NTU"},
            {"clave": "azucar", "etiqueta": "Azúcar", "unidad": "g/l"},
            {"clave": "numero_botas", "etiqueta": "nº botas", "unidad": ""},
            {"clave": "cliente", "etiqueta": "Cliente", "unidad": ""},
            {"clave": "tipo_bota", "etiqueta": "Tipo bota", "unidad": ""},
            {"clave": "vo_at", "etiqueta": "vo(@)", "unidad": ""},
            {"clave": "observaciones", "etiqueta": "Observaciones", "unidad": ""},
        ]

    def _normalizar_estado_analitica(self, estado: str | None) -> str:
        valor = str(estado or "ACTIVA").strip().upper()
        if valor not in {"ACTIVA", "FINALIZADA"}:
            return "ACTIVA"
        return valor

    def _obtener_campos_derivados_pedido(self, pedido_id: int | None) -> dict:
        pedido = self.fabricacion.pedidos.get(int(pedido_id or 0)) if pedido_id else None
        if not pedido:
            return {
                "tipo_producto_id": None,
                "material_id": None,
                "tostado_id": None,
            }
        return {
            "tipo_producto_id": pedido.tipo_producto_id if pedido.tipo_producto_id not in ("", None) else None,
            "material_id": pedido.material_id if pedido.material_id not in ("", None) else None,
            "tostado_id": pedido.tostado_id if pedido.tostado_id not in ("", None) else None,
        }

    def _validar_tostado_pedido(self, data: dict | None, obligatorio: bool = True):
        tostado_id = (data or {}).get("tostado_id")
        if tostado_id in (None, ""):
            if obligatorio:
                raise ValueError("El tostado es obligatorio en cada linea de pedido.")
            return
        if int(tostado_id) not in (self.maestros.tostados or {}):
            raise ValueError("tostado_id no valido.")

    def _sincronizar_tostado_pedido_en_fabricacion(self, session: Session, pedido_id: int | None, tostado_id: int | None):
        if not pedido_id:
            return
        lineas = session.exec(
            select(FabricacionSemanalDB).where(FabricacionSemanalDB.pedido_id == int(pedido_id))
        ).all()
        for linea in lineas:
            linea.tostado_id = int(tostado_id) if tostado_id not in (None, "") else None
            session.add(linea)
            if linea.id and self.fabricacion.fabricacion_semanal.get(int(linea.id)):
                self.fabricacion.fabricacion_semanal[int(linea.id)].tostado_id = linea.tostado_id

    def _actualizar_cache_analitica(self, analitica: AnaliticaDB | None):
        if not analitica or not analitica.id:
            return
        self.fabricacion.analiticas[int(analitica.id)] = AnaliticaDTO.from_db(analitica)

    def _resolver_productos_bota_por_codigos(self, session: Session, codigos: list[str]) -> tuple[list[ProductoDB], dict[str, ProductoDB]]:
        productos = session.exec(
            select(ProductoDB).where(ProductoDB.codigo.in_(codigos))
        ).all() if codigos else []
        productos_por_codigo = {str(producto.codigo or "").strip(): producto for producto in productos}
        return productos, productos_por_codigo

    def _resolver_contexto_productos(self, session: Session, productos: list[ProductoDB]) -> tuple[dict[int, int], set[int]]:
        trazabilidades_producto = session.exec(
            select(TrazabilidadProductoDB).where(
                TrazabilidadProductoDB.producto_id.in_([int(producto.id) for producto in productos if producto.id])
            )
        ).all() if productos else []
        trazabilidades_fabricacion = session.exec(select(TrazabilidadFabricacionDB)).all()
        trazabilidades_fabricacion_por_id = {int(traza.id): traza for traza in trazabilidades_fabricacion if traza.id}
        linea_por_producto_id = {}
        for traza_producto in trazabilidades_producto:
            producto_rel_id = int(traza_producto.producto_id or 0)
            traza_fabricacion = trazabilidades_fabricacion_por_id.get(int(traza_producto.trazabilidad_fabricacion_id or 0))
            if not producto_rel_id or not traza_fabricacion:
                continue
            linea_por_producto_id[producto_rel_id] = int(traza_fabricacion.fabricacion_semanal_id or 0)
        return linea_por_producto_id, {
            int(traza.id) for traza in trazabilidades_fabricacion if traza.id
        }

    #region Métodos Maestros


    def obtener_datos_maestros(self) -> dict:
        with DB.crear_sesion() as session:
            tostados = self.repo_tostados.list_all(session)
            clientes = self.repo_clientes.list_all(session)
            estados_pedidos = self.repo_estados_pedidos.list_all(session)
            estados_fabricacion_semanal = self.repo_estados_fabricacion_semanal.list_all(session)
            estados_productos = self.repo_estados_productos.list_all(session)
            estados_flejes = self.repo_estados_flejes.list_all(session)
            estados_trazabilidad_fabricacion = self.repo_estados_trazabilidad_fabricacion.list_all(session)
            estados_palets = self.repo_estados_palets.list_all(session)
            instalaciones = self.repo_instalaciones.list_all(session)
            ubicaciones = self.repo_ubicaciones.list_all(session)
            proveedores = self.repo_proveedores.list_all(session)
            usuarios = self.repo_usuarios.list_all(session)
            roles = self.repo_roles.list_all(session)
            puestos_trabajo = self.repo_puestos_trabajo.list_all(session)
            materiales = self.repo_materiales_maestro.list_all(session)
            contenedores = self.repo_contenedores.list_all(session)
            entradas = self.repo_entradas.list_all(session)
            lineas_entrada = self.repo_lineas_entrada.list_all(session)
            palets = self.repo_palets.list_all(session)
            productos = self.repo_productos.list_all(session)
            archivos_subidos = self.repo_archivos_subidos.list_all(session)
            ambientes = self.repo_ambientes.list_all(session)
            dias_festivos = self.repo_dias_festivos.list_all(session)
            entradas_flejes = self.repo_entradas_flejes.list_all(session)
            cubicajes = self.repo_cubicaje.list_all(session)

            self.maestros.clientes = {cliente.id: ClienteDTO.from_db(cliente) for cliente in clientes}
            self.maestros.estados_pedidos = {estado.id: EstadoPedidoDTO.from_db(estado) for estado in estados_pedidos}
            self.maestros.estados_fabricacion_semanal = {estado.id: EstadoFabricacionSemanalDTO.from_db(estado) for estado in estados_fabricacion_semanal}
            self.maestros.estados_productos = {estado.id: EstadoProductoDTO.from_db(estado) for estado in estados_productos}
            self.maestros.estados_flejes = {estado.id: EstadoFlejeDTO.from_db(estado) for estado in estados_flejes}
            self.maestros.estados_trazabilidad_fabricacion = {estado.id: EstadoTrazabilidadFabricacionDTO.from_db(estado) for estado in estados_trazabilidad_fabricacion}
            self.maestros.estados_palets = {estado.id: EstadoPaletDTO.from_db(estado) for estado in estados_palets}
            self.maestros.instalaciones = {instalacion.id: InstalacionDTO.from_db(instalacion) for instalacion in instalaciones}
            self.maestros.ubicaciones = {ubicacion.id: UbicacionDTO.from_db(ubicacion) for ubicacion in ubicaciones}
            self.maestros.proveedores = {proveedor.id: ProveedorDTO.from_db(proveedor) for proveedor in proveedores}
            self.maestros.usuarios = {usuario.id: UsuarioDTO.from_db(usuario) for usuario in usuarios}
            self.maestros.roles = {rol.id: RolDTO.from_db(rol) for rol in roles}
            self.maestros.puestos_trabajo = {puesto.id: PuestoTrabajoDTO.from_db(puesto) for puesto in puestos_trabajo}
            self.maestros.materiales = {material.id: MaterialDTO.from_db(material) for material in materiales}
            self.maestros.contenedores = {contenedor.id: ContenedorDTO.from_db(contenedor) for contenedor in contenedores}
            self.maestros.entradas = {entrada.id: EntradaDTO.from_db(entrada) for entrada in entradas}
            self.maestros.lineas_entrada = {linea.id: LineaEntradaDTO.from_db(linea) for linea in lineas_entrada}
            self.maestros.palets = {palet.id: PaletDTO.from_db(palet) for palet in palets}
            self.maestros.productos = {producto.id: ProductoDTO.from_db(producto) for producto in productos}
            self.maestros.archivos_subidos = {archivo.id: ArchivoSubidoDTO.from_db(archivo) for archivo in archivos_subidos}
            self.maestros.ambientes = {ambiente.id: AmbienteDTO.from_db(ambiente) for ambiente in ambientes}
            self.maestros.dias_festivos = {dia.id: DiaFestivoDTO.from_db(dia) for dia in dias_festivos}
            self.maestros.entradas_flejes = {entrada.id: EntradaFlejeDTO.from_db(entrada) for entrada in entradas_flejes}
            self.maestros.cubicaje = {cubicaje.id: CubicajeDTO.from_db(cubicaje) for cubicaje in cubicajes}
            self.maestros.tostados = {tostado.id: TostadoDTO.from_db(tostado) for tostado in tostados}

            #print("Datos maestros cargados:", self.maestros)
            #print("Datos clientes cargados:", self.maestros.clientes)

    def obtener_fabricacion(self) -> FabricacionDTO:
        with DB.crear_sesion() as session:
            ordenes = self.repo_pedidos.list_all(session)
            analiticas = self.repo_analiticas.list_all(session)
            tipos = self.repo_tipos_producto.list_all(session)
            lineas = self.repo_fabricacion_semanal.list_all(session)
            traz_procesado = self.repo_trazabilidad_procesado.list_all(session)
            traz_fabricacion = self.repo_trazabilidad_fabricacion.list_all(session)
            traz_producto = self.repo_trazabilidad_producto.list_all(session)
            consumos = self.repo_consumos.list_all(session)

            self.fabricacion.pedidos = {
                orden.id: PedidoDTO.from_db(orden) for orden in ordenes
            }
            self.fabricacion.analiticas = {
                analitica.id: AnaliticaDTO.from_db(analitica) for analitica in analiticas
            }
            self.fabricacion.tipos_producto = {
                tipo.id: TipoProductoDTO.from_db(tipo) for tipo in tipos
            }
            self.fabricacion.fabricacion_semanal = {
                linea.id: FabricacionSemanalDTO.from_db(linea) for linea in lineas
            }
            self.fabricacion.trazabilidad_procesado = {
                traz.id: TrazabilidadProcesadoDTO.from_db(traz) for traz in traz_procesado
            }
            self.fabricacion.trazabilidad_fabricacion = {
                traz.id: TrazabilidadFabricacionDTO.from_db(traz) for traz in traz_fabricacion
            }
            self.fabricacion.trazabilidad_producto = {
                traz.id: TrazabilidadProductoDTO.from_db(traz) for traz in traz_producto
            }
            self.fabricacion.consumos = {
                consumo.id: ConsumoDTO.from_db(consumo) for consumo in consumos
            }

            return self.fabricacion


    def modificar_maestro(self, data):
        tabla = data.get("tabla")
        entrada_id = data.get("id")
        campo = data.get("campo")
        valor = data.get("valor")
        objeto = None

        with DB.crear_sesion() as session:
            repo, maestro, objeto = self.obtener_repo(tabla)
            
            DTO = maestro.get(entrada_id)
            self.checkUpdate(DTO, tabla, entrada_id, campo)
            if tabla == "usuarios":
                if campo == "codigo":
                    valor = str(valor or "").strip()[:2]
                if campo == "clave":
                    valor = BcryptHelper.hash_password(valor or "")
            if tabla == "analiticas" and campo == "estado":
                valor = self._normalizar_estado_analitica(valor)
            valor = self._normalizar_vacio_numerico(objeto, campo, valor)
            setattr(DTO, campo, valor)
            if tabla == "pedidos":
                self._validar_tostado_pedido(DTO.model_dump(), obligatorio=(campo == "tostado_id"))
            if tabla == "fabricacion_semanal" and campo == "pedido_id":
                derivados = self._obtener_campos_derivados_pedido(DTO.pedido_id)
                DTO.tipo_producto_id = derivados["tipo_producto_id"]
                DTO.material_id = derivados["material_id"]
                DTO.tostado_id = derivados["tostado_id"]
            if tabla == "palets" and campo == "linea_entrada_id":
                linea = self.maestros.lineas_entrada.get(int(valor)) if valor not in (None, "") else None
                DTO.tipo_producto_id = linea.tipo_producto_id if linea else None
                DTO.material_id = linea.material_id if linea else None
            if tabla == "entradas_flejes":
                DTO.restante = float(DTO.peso or 0) - float(DTO.consumido or 0)
            if hasattr(DTO, "bind_db_model"):
                DTO.bind_db_model(repo.model)
            updated = DTO.to_db()
            repo.update(session, updated)
            maestro[entrada_id] = DTO
            if tabla == "pedidos" and campo == "tostado_id":
                self._sincronizar_tostado_pedido_en_fabricacion(session, entrada_id, DTO.tostado_id)
                try:
                    session.commit()
                except Exception:
                    session.rollback()
                    raise
            valor_respuesta = "" if (tabla == "usuarios" and campo == "clave") else valor
            valor_log = "<oculto>" if (tabla == "usuarios" and campo == "clave") else valor
            logger.info(f"Entrada ID {entrada_id} modificada: {campo} = {valor_log}")
            respuesta = {"id": entrada_id, "campo": campo, "valor": valor_respuesta}
            if tabla == "palets" and campo == "linea_entrada_id":
                respuesta["valores"] = {
                    "tipo_producto_id": DTO.tipo_producto_id,
                    "material_id": DTO.material_id,
                }
            if tabla == "fabricacion_semanal" and campo == "pedido_id":
                respuesta["valores"] = {
                    "tipo_producto_id": DTO.tipo_producto_id,
                    "material_id": DTO.material_id,
                    "tostado_id": DTO.tostado_id,
                }
            return respuesta


    def eliminar_maestro(self, data):
        tabla = data.get("tabla")
        entrada_id = data.get("id")

        with DB.crear_sesion() as session:
            repo, maestro, objeto = self.obtener_repo(tabla)
            repo.delete(session, entrada_id)
            try:
                session.commit()
            except Exception:
                session.rollback()
                raise

            #Actualizado en memoria
            maestro.pop(entrada_id, None)
            logger.info(f"Entrada ID {entrada_id} eliminada.")
            return {"id": entrada_id }



    def insertar_maestro(self, data):
        tabla = data.get("tabla")
        objeto = None

        with DB.crear_sesion() as session:
            repo, maestro, objeto = self.obtener_repo(tabla)
            data = self._normalizar_data_vacia_numerica(objeto, data)
            if tabla == "palets":
                data = dict(data or {})
                linea_entrada_id = data.get("linea_entrada_id")
                if linea_entrada_id not in (None, "") and not data.get("tipo_producto_id") and not data.get("material_id"):
                    linea = self.maestros.lineas_entrada.get(int(linea_entrada_id))
                    if not linea:
                        raise ValueError("linea_entrada_id no valido.")
                    data["tipo_producto_id"] = linea.tipo_producto_id
                    data["material_id"] = linea.material_id
            if tabla == "pedidos":
                data = dict(data or {})
                self._validar_tostado_pedido(data)
            if tabla == "fabricacion_semanal":
                data = dict(data or {})
                derivados = self._obtener_campos_derivados_pedido(data.get("pedido_id"))
                data["tipo_producto_id"] = derivados["tipo_producto_id"]
                data["material_id"] = derivados["material_id"]
                data["tostado_id"] = derivados["tostado_id"]
            if tabla == "usuarios":
                data = dict(data or {})
                data["alias"] = data.get("alias")
                data["nombre"] = data.get("nombre")
                data["codigo"] = data.get("codigo")[:2] or None
                data["rol_id"] = int(data.get("rol_id") or self.maestros.obtener_rol_id_por_defecto())
                clave_plana = str(data.get("clave") or "")
                if clave_plana.strip() == "":
                    raise ValueError("La clave es obligatoria.")
                data["clave"] = BcryptHelper.hash_password(clave_plana)
                data["empleado"] = bool(data.get("empleado", False))
            if tabla == "analiticas":
                data = dict(data or {})
                data["estado"] = self._normalizar_estado_analitica(data.get("estado"))

            objeto_DTO = objeto(id=0, **data)
            if tabla == "entradas_flejes":
                objeto_DTO.restante = float(objeto_DTO.peso or 0) - float(objeto_DTO.consumido or 0)
            if hasattr(objeto_DTO, "bind_db_model"):
                objeto_DTO.bind_db_model(repo.model)
            objeto_DB = objeto_DTO.to_db()
            objeto_DB.id = None  # Asegura que el ID sea None para la inserción
            new = repo.insert(session, objeto_DB)
            objeto_DTO = objeto.from_db(new)
            maestro[new.id] = objeto_DTO
            logger.info(f"Insertado ID {new.id} en la tabla {tabla}")
            if tabla == "usuarios":
                return objeto_DTO.model_copy(update={"clave": ""})
            return objeto_DTO
    #endregion

    #region Métodos Entradas
    def obtener_planificacion_entradas(self, año: int, actualizar_local = True) -> PlanificacionEntradasDTO:
        with DB.crear_sesion() as session:
            plan_camiones = self.repo_camiones.list_by_year(session, año)
            plan_facturacion = self.repo_facturacion.list_by_year(session, año)
            plan_materiales = self.repo_materiales.list_by_year(session, año)

            planificacion_entradas_dto = PlanificacionEntradasDTO(
                año=año,
                plan_camiones=[PlanCamionDTO.from_db(pc) for pc in plan_camiones],
                plan_facturacion=PlanFacturacionDTO.from_db(plan_facturacion[0]) if plan_facturacion else None,
                plan_materiales=[PlanMaterialDTO.from_db(pm) for pm in plan_materiales]
            )
        
            if actualizar_local:
                self.planificacion_entradas = planificacion_entradas_dto

            return planificacion_entradas_dto
        
    def agregar_planificacion_entradas(self, año: int) -> PlanificacionEntradasDTO:
        with DB.crear_sesion() as session:
            plan_camiones = self.repo_camiones.list_by_year(session, año)
            proveedores = self.repo_proveedores.list_all(session)

            plan_proveedores_ids = {pc.proveedor_id for pc in plan_camiones if pc.proveedor_id is not None}
            proveedores_faltantes = [p for p in proveedores if p.id not in plan_proveedores_ids]

            logger.info(f"Proveedores faltantes para el año {año}: {[p.nombre for p in proveedores_faltantes]}")
            nuevas = [PlanCamionDB(proveedor_id=p.id, año=año) for p in proveedores_faltantes]
            self.repo_camiones.insert_all(session, nuevas)
            try:
                session.commit()
            except Exception:
                session.rollback()
                raise
            logger.info("Entradas de proveedores agregadas correctamente.")
            return self.obtener_planificacion_entradas(año)

    def modificar_entrada(self, data):
        tabla = data.get("tabla")
        entrada_id = data.get("id")
        campo = data.get("campo")
        valor = data.get("valor")
        objeto = None

        with DB.crear_sesion() as session:
            repo, busqueda, objeto = self.obtener_repo(tabla)

            DTO = busqueda(entrada_id)
            self.checkUpdate(DTO, tabla, entrada_id, campo)  

            valor = self._normalizar_vacio_numerico(objeto, campo, valor)
            setattr(DTO, campo, valor)
            updated = DTO.to_db()
            repo.update(session, updated)

            logger.info(f"Entrada ID {entrada_id} modificada: {campo} = {valor}")
            return {"id": entrada_id, "campo": campo, "valor": valor}
    #endregion

    #region Mètodos Listados Entradas
    def listar_entradas_planificacion(self, año: int, proveedor_id: int | None):
        with DB.crear_sesion() as session:
            statement = select(EntradaDB)
            if proveedor_id:
                statement = statement.where(EntradaDB.proveedor_id == proveedor_id)
            if año:
                statement = statement.where(extract("year", EntradaDB.fecha) == año)
            entradas = session.exec(statement).all()
            return [EntradaDTO.from_db(entrada) for entrada in entradas]

    def listar_lineas_entrada(self, entrada_id: int):
        with DB.crear_sesion() as session:
            statement = select(LineaEntradaDB).where(LineaEntradaDB.entrada_id == entrada_id)
            lineas = session.exec(statement).all()
            return [LineaEntradaDTO.from_db(linea) for linea in lineas]

    def listar_archivos_entidad(self, entidad: str, entidad_id: int):
        with DB.crear_sesion() as session:
            statement = select(ArchivoSubidoDB).where(
                ArchivoSubidoDB.entidad == entidad,
                ArchivoSubidoDB.entidad_id == entidad_id,
                ArchivoSubidoDB.is_deleted == False,
            )
            archivos = session.exec(statement).all()
            return [ArchivoSubidoDTO.from_db(archivo) for archivo in archivos]
    #endregion

    #region Metodos Listados Fabricacion
    def listar_pedidos(self, filtros: dict | None = None):
        with DB.crear_sesion() as session:
            statement = select(PedidoDB)
            filtros = filtros or {}

            año = filtros.get("año")
            estados = [int(v) for v in (filtros.get("estados") or []) if str(v).strip() != ""]
            clientes = [int(v) for v in (filtros.get("clientes") or []) if str(v).strip() != ""]
            destinos_raw = [str(v).strip().upper() for v in (filtros.get("destinos") or []) if str(v).strip() != ""]
            tipos_producto = [int(v) for v in (filtros.get("tipos_producto") or []) if str(v).strip() != ""]
            material_id = filtros.get("material_id")
            materiales = [int(v) for v in (filtros.get("materiales") or []) if str(v).strip() != ""]
            fecha = filtros.get("fecha")

            destino_aliases = {
                "C": {"C", "CLIENTE"},
                "E": {"E", "ENVINADO"},
            }
            destinos = sorted({alias for valor in destinos_raw for alias in destino_aliases.get(valor, {valor})})

            if año:
                statement = statement.where(extract("year", PedidoDB.fecha) == int(año))
            if estados:
                statement = statement.where(PedidoDB.estado.in_(estados))
            if clientes:
                statement = statement.where(PedidoDB.cliente_id.in_(clientes))
            if destinos:
                statement = statement.where(PedidoDB.destino.in_(destinos))
            if tipos_producto:
                statement = statement.where(PedidoDB.tipo_producto_id.in_(tipos_producto))
            if materiales:
                statement = statement.where(PedidoDB.material_id.in_(materiales))
            elif material_id not in (None, ""):
                statement = statement.where(PedidoDB.material_id == int(material_id))
            if fecha not in (None, ""):
                statement = statement.where(PedidoDB.fecha == fecha)

            statement = statement.order_by(PedidoDB.fecha.desc(), PedidoDB.id.desc())
            ordenes = session.exec(statement).all()
            return [PedidoDTO.from_db(orden) for orden in ordenes]

    def listar_fabricacion_semanal(self, pedido_id: int):
        with DB.crear_sesion() as session:
            statement = select(FabricacionSemanalDB).where(FabricacionSemanalDB.pedido_id == pedido_id)
            lineas = session.exec(statement).all()
            return [FabricacionSemanalDTO.from_db(linea) for linea in lineas]

    def listar_resumen_fabricacion_consumo(self):
        with DB.crear_sesion() as session:
            statement = (
                select(FabricacionSemanalDB, PedidoDB, TipoProductoDB, MaterialDB, TostadoDB)
                .join(PedidoDB, PedidoDB.id == FabricacionSemanalDB.pedido_id, isouter=True)
                .join(TipoProductoDB, TipoProductoDB.id == FabricacionSemanalDB.tipo_producto_id, isouter=True)
                .join(MaterialDB, MaterialDB.id == FabricacionSemanalDB.material_id, isouter=True)
                .join(TostadoDB, TostadoDB.id == FabricacionSemanalDB.tostado_id, isouter=True)
                .where(FabricacionSemanalDB.estado == 2)
                .order_by(FabricacionSemanalDB.fecha_inicio.desc(), FabricacionSemanalDB.id.desc())
            )
            filas = session.exec(statement).all()

            resumen = []
            for linea, pedido, tipo, material, tostado in filas:
                resumen.append({
                    "id": linea.id,
                    "pedido_id": linea.pedido_id,
                    "fecha_inicio": linea.fecha_inicio.isoformat() if linea.fecha_inicio else None,
                    "tipo_producto_id": linea.tipo_producto_id,
                    "material_id": linea.material_id,
                    "tostado_id": linea.tostado_id,
                    "cantidad": int(linea.cantidad or 0),
                    "cantidad_fabricada": int(linea.cantidad_fabricada or 0),
                    "pedido_descripcion": (pedido.descripcion if pedido else None) or f"Pedido {linea.pedido_id or '-'}",
                    "pedido_total": int((pedido.cantidad if pedido else 0) or 0),
                    "pedido_fabricado": int((pedido.cantidad_fabricada if pedido else 0) or 0),
                    "tipo_descripcion": ((tipo.descripcion if tipo else None) or (tipo.codigo if tipo else None) or "-"),
                    "material_descripcion": ((material.descripcion if material else None) or "-"),
                    "tostado_descripcion": ((tostado.descripcion if tostado else None) or "-"),
                })
            return resumen

    def listar_analiticas(self, filtros: dict | None = None):
        filtros = filtros or {}
        estados = {
            self._normalizar_estado_analitica(estado)
            for estado in (filtros.get("estados") or [])
            if str(estado).strip() != ""
        }

        with DB.crear_sesion() as session:
            analiticas = session.exec(
                select(AnaliticaDB).order_by(AnaliticaDB.fecha.desc(), AnaliticaDB.id.desc())
            ).all()

            items = []
            for analitica in analiticas:
                estado = self._normalizar_estado_analitica(analitica.estado)
                if estados and estado not in estados:
                    continue
                items.append({
                    "id": analitica.id,
                    "fecha": analitica.fecha.isoformat() if analitica.fecha else None,
                    "descripcion": analitica.descripcion,
                    "estado": estado,
                    "campos_total": len(self._campos_analitica()),
                    "campos_cumplimentados": sum(
                        1 for campo in self._campos_analitica()
                        if str(getattr(analitica, campo["clave"], "") or "").strip() != ""
                    ),
                    "created_at": analitica.created_at.isoformat() if analitica.created_at else None,
                    "updated_at": analitica.updated_at.isoformat() if analitica.updated_at else None,
                })
            return items

    def obtener_analitica(self, analitica_id: int):
        analitica_id = int(analitica_id or 0)
        if not analitica_id:
            raise ValueError("analitica_id es obligatorio.")

        with DB.crear_sesion() as session:
            analitica = session.get(AnaliticaDB, analitica_id)
            if not analitica:
                raise ValueError("Analitica no encontrada.")
            return {
                "id": analitica.id,
                "fecha": analitica.fecha.isoformat() if analitica.fecha else None,
                "descripcion": analitica.descripcion,
                "estado": self._normalizar_estado_analitica(analitica.estado),
                "valores": {
                    campo["clave"]: getattr(analitica, campo["clave"], None)
                    for campo in self._campos_analitica()
                },
            }

    def guardar_analitica(self, data: dict | None = None):
        data = data or {}
        analitica_id = int(data.get("id") or 0)
        descripcion = str(data.get("descripcion") or "").strip()
        fecha_raw = data.get("fecha")
        estado = self._normalizar_estado_analitica(data.get("estado"))
        valores = data.get("valores") or {}

        if not descripcion:
            raise ValueError("descripcion es obligatoria.")
        if not fecha_raw:
            raise ValueError("fecha es obligatoria.")

        fecha = date.fromisoformat(str(fecha_raw))

        with DB.crear_sesion() as session:
            if analitica_id:
                analitica = session.get(AnaliticaDB, analitica_id)
                if not analitica:
                    raise ValueError("Analitica no encontrada.")
            else:
                analitica = AnaliticaDB(fecha=fecha, descripcion=descripcion, estado=estado)

            analitica.fecha = fecha
            analitica.descripcion = descripcion
            analitica.estado = estado
            for campo in self._campos_analitica():
                clave = campo["clave"]
                if isinstance(valores, dict):
                    valor = valores.get(clave)
                else:
                    valor = None
                setattr(analitica, clave, str(valor).strip() if valor not in (None, "") else None)

            session.add(analitica)
            session.commit()
            session.refresh(analitica)

            self._actualizar_cache_analitica(analitica)
            return self.obtener_analitica(int(analitica.id))

    def listar_productos_por_filtros(self, filtros: dict | None = None):
        filtros = filtros or {}
        tipos_filtro = {
            str(tipo).strip().upper()
            for tipo in (filtros.get("tipos") or [])
            if str(tipo).strip() != ""
        }
        pedido_estado = filtros.get("pedido_estado")
        pedido_destino = str(filtros.get("pedido_destino") or "").strip().upper()
        estados_producto = {
            int(estado)
            for estado in (filtros.get("estados_producto") or [])
            if str(estado).strip() != ""
        }

        with DB.crear_sesion() as session:
            pedidos = self.repo_pedidos.list_all(session)
            clientes = self.repo_clientes.list_all(session)
            tipos = self.repo_tipos_producto.list_all(session)
            materiales = self.repo_materiales_maestro.list_all(session)
            estados = self.repo_estados_productos.list_all(session)
            lineas = self.repo_fabricacion_semanal.list_all(session)
            productos = self.repo_productos.list_all(session)
            trazabilidades_producto = self.repo_trazabilidad_producto.list_all(session)
            trazabilidades_fabricacion = self.repo_trazabilidad_fabricacion.list_all(session)

            pedidos_por_id = {pedido.id: pedido for pedido in pedidos}
            clientes_por_id = {cliente.id: cliente for cliente in clientes}
            tipos_por_id = {tipo.id: tipo for tipo in tipos}
            materiales_por_id = {material.id: material for material in materiales}
            estados_por_id = {estado.id: estado for estado in estados}
            lineas_por_id = {linea.id: linea for linea in lineas}
            trazabilidades_fabricacion_por_id = {traza.id: traza for traza in trazabilidades_fabricacion}

            lineas_por_pedido = {}
            for linea in lineas:
                if linea.pedido_id is None:
                    continue
                lineas_por_pedido.setdefault(int(linea.pedido_id), []).append(linea)

            linea_por_producto_id = {}
            for traza_producto in trazabilidades_producto:
                producto_id = int(traza_producto.producto_id or 0)
                if not producto_id or producto_id in linea_por_producto_id:
                    continue
                traza_fabricacion = trazabilidades_fabricacion_por_id.get(int(traza_producto.trazabilidad_fabricacion_id or 0))
                if not traza_fabricacion:
                    continue
                linea = lineas_por_id.get(int(traza_fabricacion.fabricacion_semanal_id or 0))
                if linea:
                    linea_por_producto_id[producto_id] = linea

            productos_resueltos = []
            for producto in productos:
                tipo_producto = str(producto.tipo or "").strip().upper()
                if tipos_filtro and tipo_producto not in tipos_filtro:
                    continue

                linea = lineas_por_id.get(int(producto.produccion_id or 0))
                if not linea:
                    linea = linea_por_producto_id.get(int(producto.id or 0))
                pedido = pedidos_por_id.get(int(getattr(linea, "pedido_id", 0) or 0))
                if not pedido:
                    continue

                if pedido_estado is not None and int(pedido.estado or 0) != int(pedido_estado):
                    continue
                if pedido_destino and str(pedido.destino or "").strip().upper() != pedido_destino:
                    continue

                if not linea:
                    lineas_pedido = lineas_por_pedido.get(int(pedido.id or 0), [])
                    if len(lineas_pedido) == 1:
                        linea = lineas_pedido[0]

                cliente = clientes_por_id.get(int(pedido.cliente_id or 0))
                tipo = tipos_por_id.get(int(getattr(linea, "tipo_producto_id", 0) or 0))
                material_id = producto.material_id if producto.material_id is not None else getattr(linea, "material_id", None)
                material = materiales_por_id.get(int(material_id or 0))
                estado_producto = int(producto.estado or 0)
                estado = estados_por_id.get(estado_producto)

                productos_resueltos.append({
                    "id": producto.id,
                    "codigo": producto.codigo,
                    "producto_tipo": producto.tipo,
                    "estado": estado_producto,
                    "estado_descripcion": getattr(estado, "descripcion", None) or str(estado_producto),
                    "pedido_id": pedido.id,
                    "pedido_numero": pedido.numero,
                    "pedido_descripcion": pedido.descripcion,
                    "pedido_destino": pedido.destino,
                    "pedido_estado": pedido.estado,
                    "cliente_id": pedido.cliente_id,
                    "cliente_nombre": getattr(cliente, "nombre", None) or "",
                    "tipo_producto_id": getattr(linea, "tipo_producto_id", None),
                    "tipo_producto_descripcion": getattr(tipo, "descripcion", None) or getattr(tipo, "codigo", None) or "",
                    "material_id": material_id,
                    "material_descripcion": getattr(material, "descripcion", None) or "",
                    "contenedor_id": producto.contenedor_id,
                    "fabricacion_semanal_id": getattr(linea, "id", None),
                    "fabricacion_cantidad": getattr(linea, "cantidad", 0) if linea else 0,
                    "fabricacion_cantidad_fabricada": getattr(linea, "cantidad_fabricada", 0) if linea else 0,
                })

            items = [
                item for item in productos_resueltos
                if not estados_producto or int(item.get("estado") or 0) in estados_producto
            ]

            items.sort(key=lambda item: (
                int(item.get("estado") or 0),
                str(item.get("cliente_nombre") or "").lower(),
                str(item.get("pedido_numero") or "").lower(),
                str(item.get("codigo") or "").lower(),
            ))
            return items

    def _palets_elegibles_fabricacion_compartida(self, session: Session, trazas, fabricacion_semanal_id: int) -> set[int]:
        linea_id = int(fabricacion_semanal_id or 0)
        otras_lineas_ids = {
            int(traza.fabricacion_semanal_id)
            for traza in trazas
            if traza.fabricacion_semanal_id is not None
            and int(traza.fabricacion_semanal_id) != linea_id
        }
        otras_lineas_no_finalizadas = set()
        if otras_lineas_ids:
            otras_lineas_no_finalizadas = {
                int(linea.id)
                for linea in session.exec(
                    select(FabricacionSemanalDB).where(
                        FabricacionSemanalDB.id.in_(otras_lineas_ids),
                        or_(FabricacionSemanalDB.estado.is_(None), FabricacionSemanalDB.estado != 3),
                    )
                ).all()
            }
        return {
            int(traza.palet_id)
            for traza in trazas
            if traza.palet_id and (
                traza.fabricacion_semanal_id is None
                or int(traza.fabricacion_semanal_id) == linea_id
                or int(traza.fabricacion_semanal_id) in otras_lineas_no_finalizadas
            )
        }

    # Firma anterior: def listar_trazabilidad_fabricacion(self, fabricacion_semanal_id: int | None, incluir_huerfanas: bool = False):
    def listar_trazabilidad_fabricacion(self, fabricacion_semanal_id: int | None, incluir_huerfanas: bool = False, incluir_compartidas: bool = False):
        with DB.crear_sesion() as session:
            statement = select(TrazabilidadFabricacionDB)
            # Código anterior del listado de Fabricar botas, conservado para revertir:
            # if fabricacion_semanal_id:
            #     if incluir_huerfanas:
            #         statement = statement.where(
            #             or_(
            #                 TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id,
            #                 TrazabilidadFabricacionDB.fabricacion_semanal_id.is_(None),
            #             )
            #         )
            #     else:
            #         statement = statement.where(
            #             TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id
            #         )
            # else:
            #     statement = statement.where(TrazabilidadFabricacionDB.fabricacion_semanal_id.is_(None))
            if not incluir_compartidas:
                if fabricacion_semanal_id:
                    if incluir_huerfanas:
                        statement = statement.where(
                            or_(
                                TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id,
                                TrazabilidadFabricacionDB.fabricacion_semanal_id.is_(None),
                            )
                        )
                    else:
                        statement = statement.where(
                            TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id
                        )
                else:
                    statement = statement.where(TrazabilidadFabricacionDB.fabricacion_semanal_id.is_(None))
            trazas = session.exec(statement).all()
            if incluir_compartidas:
                palets_elegibles = self._palets_elegibles_fabricacion_compartida(session, trazas, fabricacion_semanal_id)
                # Antes se agrupaban todas las trazas, incluidas las de otras fabricaciones finalizadas:
                # trazas_por_palet = {}
                # for traza in trazas:
                #     trazas_por_palet.setdefault(traza.palet_id, []).append(traza)
                trazas = [traza for traza in trazas if traza.palet_id in palets_elegibles]
                trazas_por_palet = {}
                for traza in trazas:
                    trazas_por_palet.setdefault(traza.palet_id, []).append(traza)
                registros = []
                for trazas_palet in trazas_por_palet.values():
                    propias = [traza for traza in trazas_palet if traza.fabricacion_semanal_id == fabricacion_semanal_id]
                    representante = (propias[0] if propias else trazas_palet[0])
                    registros.append((
                        representante,
                        0 if any(int(traza.estado or 0) == 0 for traza in propias) else 1,
                        sum(int(traza.cantidad_fabricada or 0) for traza in trazas_palet),
                    ))
            else:
                registros = [(traza, traza.estado, traza.cantidad_fabricada) for traza in trazas]
            palet_ids = {t.palet_id for t in trazas if t.palet_id}
            palet_map = {}
            material_ids = set()
            if palet_ids:
                palets = session.exec(select(PaletDB).where(PaletDB.id.in_(palet_ids))).all()
                palet_map = {
                    p.id: {
                        "codigo": p.codigo,
                        "cubicaje": float(p.cubicaje or 0),
                        "consumido": float(p.consumido or 0),
                        "material_id": p.material_id,
                    }
                    for p in palets
                }
                material_ids = {
                    int(p.material_id)
                    for p in palets
                    if p.material_id is not None
                }
            materiales = {}
            if material_ids:
                materiales = {
                    int(material.id): material
                    for material in session.exec(select(MaterialDB).where(MaterialDB.id.in_(material_ids))).all()
                    if material.id is not None
                }
            return [
                {
                    "id": t.id,
                    "fabricacion_semanal_id": t.fabricacion_semanal_id,
                    "sin_origen_fabricacion": t.fabricacion_semanal_id is None,
                    "palet_id": t.palet_id,
                    "palet_codigo": (palet_map.get(t.palet_id) or {}).get("codigo"),
                    "palet_cubicaje": (palet_map.get(t.palet_id) or {}).get("cubicaje"),
                    "palet_consumido": (palet_map.get(t.palet_id) or {}).get("consumido"),
                    "material_id": (palet_map.get(t.palet_id) or {}).get("material_id"),
                    "material_descripcion": getattr(
                        materiales.get((palet_map.get(t.palet_id) or {}).get("material_id")),
                        "descripcion",
                        None,
                    ),
                    # Código anterior: "cantidad_fabricada": t.cantidad_fabricada,
                    # Código anterior: "estado": t.estado,
                    "cantidad_fabricada": cantidad_fabricada,
                    "estado": estado,
                }
                # Código anterior: for t in trazas
                for t, estado, cantidad_fabricada in registros
            ]

    def obtener_cierre_semanal(self, fabricacion_semanal_id: int):
        with DB.crear_sesion() as session:
            linea = session.get(FabricacionSemanalDB, fabricacion_semanal_id)
            if not linea:
                raise ValueError("No se encontró la línea de fabricación semanal.")

            pedido = session.get(PedidoDB, int(linea.pedido_id or 0)) if linea.pedido_id else None
            tipo_bota = session.get(TipoProductoDB, int(linea.tipo_producto_id or 0)) if linea.tipo_producto_id else None
            material = session.get(MaterialDB, int(linea.material_id or 0)) if linea.material_id else None

            consumos = session.exec(
                select(ConsumoDB).where(ConsumoDB.bota_id == int(linea.tipo_producto_id or 0))
            ).all()
            consumible_ids = [int(c.consumible_id or 0) for c in consumos if c.consumible_id]
            tipos_consumibles = {}
            if consumible_ids:
                tipos_consumibles = {
                    int(item.id): item
                    for item in session.exec(
                        select(TipoProductoDB).where(TipoProductoDB.id.in_(consumible_ids))
                    ).all()
                    if item.id
                }
            consumo_bota = 0.0
            for consumo in consumos:
                tipo_consumible = tipos_consumibles.get(int(consumo.consumible_id or 0))
                if str(getattr(tipo_consumible, "tipo", "")).strip().upper() == "DUELA":
                    consumo_bota += float(consumo.consumo or 0)

            trazas = session.exec(
                select(TrazabilidadFabricacionDB).where(
                    or_(
                        TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id,
                        TrazabilidadFabricacionDB.fabricacion_semanal_id.is_(None),
                    ),
                    TrazabilidadFabricacionDB.estado == 0,
                )
            ).all()
            traza_ids = [int(t.id) for t in trazas if t.id]
            palet_ids = sorted({int(t.palet_id) for t in trazas if t.palet_id})
            palets = {}
            if palet_ids:
                palets = {
                    int(p.id): p
                    for p in session.exec(select(PaletDB).where(PaletDB.id.in_(palet_ids))).all()
                    if p.id
                }

            trazas_producto = []
            if traza_ids:
                trazas_producto = session.exec(
                    select(TrazabilidadProductoDB).where(
                        TrazabilidadProductoDB.trazabilidad_fabricacion_id.in_(traza_ids)
                    )
                ).all()

            producto_ids = [int(tp.producto_id) for tp in trazas_producto if tp.producto_id]
            productos = {}
            if producto_ids:
                productos = {
                    int(p.id): p
                    for p in session.exec(select(ProductoDB).where(ProductoDB.id.in_(producto_ids))).all()
                    if p.id
                }

            codigos_botas = sorted(
                [
                    str(producto.codigo).strip()
                    for producto in productos.values()
                    if str(producto.tipo or "").strip().upper() == "BOTA" and str(producto.codigo or "").strip()
                ],
                key=lambda x: [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", x)],
            )

            productos_por_traza = {}
            for traza_producto in trazas_producto:
                productos_por_traza.setdefault(int(traza_producto.trazabilidad_fabricacion_id or 0), []).append(
                    productos.get(int(traza_producto.producto_id or 0))
                )

            palets_detalle = []
            total_m3 = 0.0
            total_consumido_palets = 0.0
            total_botas_registradas_traza = 0
            for traza in trazas:
                palet = palets.get(int(traza.palet_id or 0))
                codigo_palet = getattr(palet, "codigo", None) or traza.palet_id
                cubicaje = float(getattr(palet, "cubicaje", 0) or 0)
                consumido = float(getattr(palet, "consumido", 0) or 0)
                restante = cubicaje - consumido
                productos_traza = [p for p in productos_por_traza.get(int(traza.id or 0), []) if p]
                botas_traza = [p for p in productos_traza if str(p.tipo or "").strip().upper() == "BOTA"]
                botas_registradas = len(botas_traza)
                total_m3 += cubicaje
                total_consumido_palets += consumido
                total_botas_registradas_traza += botas_registradas
                palets_detalle.append({
                    "trazabilidad_id": traza.id,
                    "palet_id": traza.palet_id,
                    "palet_codigo": codigo_palet,
                    "lote": (str(codigo_palet).split("#", 1)[0].strip()[:8] if codigo_palet else ""),
                    "m3_total": cubicaje,
                    "m3_consumidos": consumido,
                    "m3_sobrante": restante,
                    "negativa": restante < 0,
                    "negativo": restante < 0,
                    "cantidad_fabricada_bbdd": int(traza.cantidad_fabricada or 0),
                    "botas_registradas": botas_registradas,
                    "botas_posibles": int((restante // consumo_bota) if consumo_bota > 0 and restante > 0 else 0),
                    "estado": int(traza.estado or 0),
                    "codigos_botas": [str(p.codigo).strip() for p in botas_traza if str(p.codigo or "").strip()],
                })

            cantidad_bbdd_semana = int(linea.cantidad_fabricada or 0)
            consumo_calculado_botas = float(total_botas_registradas_traza) * float(consumo_bota or 0)
            diferencias = {
                "semana_vs_botas": cantidad_bbdd_semana - total_botas_registradas_traza,
                "consumo_vs_palets": round(consumo_calculado_botas - total_consumido_palets, 6),
            }

            return {
                "linea": {
                    "id": linea.id,
                    "pedido_id": linea.pedido_id,
                    "fecha_inicio": linea.fecha_inicio.isoformat() if linea.fecha_inicio else None,
                    "tipo_producto_id": linea.tipo_producto_id,
                    "tipo_producto_descripcion": getattr(tipo_bota, "descripcion", None) or getattr(tipo_bota, "codigo", None) or "",
                    "material_id": linea.material_id,
                    "material_descripcion": getattr(material, "descripcion", None) or "",
                    "tostado_id": linea.tostado_id,
                    "tostado_descripcion": self._descripcion_tostado(linea.tostado_id),
                    "cantidad": int(linea.cantidad or 0),
                    "cantidad_fabricada": cantidad_bbdd_semana,
                    "estado": int(linea.estado or 0) if linea.estado is not None else None,
                },
                "pedido": {
                    "id": getattr(pedido, "id", None),
                    "descripcion": getattr(pedido, "descripcion", "") or "",
                    "cantidad": int(getattr(pedido, "cantidad", 0) or 0),
                    "cantidad_fabricada": int(getattr(pedido, "cantidad_fabricada", 0) or 0),
                    "estado": int(getattr(pedido, "estado", 0) or 0) if pedido else None,
                },
                "consumo_unitario_bota": consumo_bota,
                "totales": {
                    "m3_total": total_m3,
                    "m3_consumidos_palets": total_consumido_palets,
                    "botas_registradas": total_botas_registradas_traza,
                    "botas_posibles": sum(int(item["botas_posibles"]) for item in palets_detalle),
                    "negativos": sum(1 for item in palets_detalle if item["negativo"]),
                },
                "consistencias": {
                    "semana_fabricada_coincide": cantidad_bbdd_semana == total_botas_registradas_traza,
                    "consumo_coincide": abs(consumo_calculado_botas - total_consumido_palets) < 0.000001,
                    "cantidad_bbdd_semana": cantidad_bbdd_semana,
                    "botas_registradas": total_botas_registradas_traza,
                    "consumo_calculado_botas": consumo_calculado_botas,
                    "consumo_total_palets": total_consumido_palets,
                    "diferencias": diferencias,
                },
                "palets": palets_detalle,
                "codigos_botas": codigos_botas,
            }

    def _obtener_consumo_unitario_bota_session(self, session: Session, tipo_producto_id: int) -> float:
        if not tipo_producto_id:
            return 0.0
        consumos = session.exec(
            select(ConsumoDB).where(ConsumoDB.bota_id == int(tipo_producto_id)).order_by(ConsumoDB.id)
        ).all()
        consumible_ids = [int(c.consumible_id or 0) for c in consumos if c.consumible_id]
        tipos_consumibles = {}
        if consumible_ids:
            tipos_consumibles = {
                int(item.id): item
                for item in session.exec(
                    select(TipoProductoDB).where(TipoProductoDB.id.in_(consumible_ids))
                ).all()
                if item.id
            }
        return sum(
            float(consumo.consumo or 0)
            for consumo in consumos
            if str(getattr(tipos_consumibles.get(int(consumo.consumible_id or 0)), "tipo", "")).strip().upper() == "DUELA"
        )

    def _obtener_estado_fabricacion_finalizado_session(self, session: Session) -> EstadoFabricacionSemanalDB:
        estado = session.exec(
            select(EstadoFabricacionSemanalDB)
            .where(func.upper(EstadoFabricacionSemanalDB.descripcion) == "FINALIZADO")
            .order_by(EstadoFabricacionSemanalDB.id)
        ).first()
        if not estado:
            raise ValueError("No existe el estado Finalizado en estados_fabricacion_semanal.")
        return estado

    def _obtener_ubicacion_almacen_cierre(self, session) -> UbicacionDB:
        ubicacion = session.exec(
            select(UbicacionDB)
            .where(func.upper(UbicacionDB.descripcion) == "ALMACEN")
            .order_by(UbicacionDB.id)
        ).first()
        if ubicacion:
            return ubicacion
        return self._obtener_ubicacion_procesados(session)

    def _actualizar_cache_palet(self, palet: PaletDB):
        if palet and palet.id:
            self.maestros.palets[palet.id] = PaletDTO.from_db(palet)

    def _actualizar_cache_traza_fabricacion(self, traza: TrazabilidadFabricacionDB):
        if traza and traza.id:
            self.fabricacion.trazabilidad_fabricacion[traza.id] = TrazabilidadFabricacionDTO.from_db(traza)

    def _actualizar_cache_traza_producto(self, traza_producto: TrazabilidadProductoDB):
        if traza_producto and traza_producto.id:
            self.fabricacion.trazabilidad_producto[traza_producto.id] = TrazabilidadProductoDTO.from_db(traza_producto)

    def _actualizar_cache_traza_procesado(self, traza_procesado: TrazabilidadProcesadoDB):
        if traza_procesado and traza_procesado.id:
            self.fabricacion.trazabilidad_procesado[traza_procesado.id] = TrazabilidadProcesadoDTO.from_db(traza_procesado)

    def reasignar_consumo_negativo_cierre(self, data):
        trazabilidad_origen_id = data.get("trazabilidad_origen_id")
        trazabilidad_destino_id = data.get("trazabilidad_destino_id")
        m3_mover = data.get("m3_mover")
        if not trazabilidad_origen_id or not trazabilidad_destino_id:
            raise ValueError("trazabilidad_origen_id y trazabilidad_destino_id son obligatorios.")
        if m3_mover is None or str(m3_mover).strip() == "":
            raise ValueError("m3_mover es obligatorio.")

        m3_mover_val = float(m3_mover)

        with DB.crear_sesion() as session:
            traza_origen = session.get(TrazabilidadFabricacionDB, int(trazabilidad_origen_id))
            traza_destino = session.get(TrazabilidadFabricacionDB, int(trazabilidad_destino_id))
            if not traza_origen or not traza_destino:
                raise ValueError("No se encontró la trazabilidad origen o destino.")
            if int(traza_origen.fabricacion_semanal_id or 0) != int(traza_destino.fabricacion_semanal_id or 0):
                raise ValueError("Origen y destino deben pertenecer a la misma fabricación semanal.")
            if int(traza_origen.id or 0) == int(traza_destino.id or 0):
                raise ValueError("Origen y destino deben ser diferentes.")

            palet_origen = session.get(PaletDB, int(traza_origen.palet_id or 0))
            palet_destino = session.get(PaletDB, int(traza_destino.palet_id or 0))
            if not palet_origen or not palet_destino:
                raise ValueError("No se encontró el palet origen o destino.")

            consumo_origen = float(palet_origen.consumido or 0) - m3_mover_val
            consumo_destino = float(palet_destino.consumido or 0) + m3_mover_val
            palet_origen.consumido = consumo_origen
            palet_destino.consumido = consumo_destino
            session.add(palet_origen)
            session.add(palet_destino)
            session.commit()
            session.refresh(palet_origen)
            session.refresh(palet_destino)

            self._actualizar_cache_palet(palet_origen)
            self._actualizar_cache_palet(palet_destino)

            return self.obtener_cierre_semanal(int(traza_origen.fabricacion_semanal_id))

    def crear_palet_procesado_desde_cierre(self, data):
        fabricacion_semanal_id = data.get("fabricacion_semanal_id")
        fabricacion_semanal_destino_id = data.get("fabricacion_semanal_destino_id")
        items = data.get("items") or []
        if not fabricacion_semanal_id:
            raise ValueError("fabricacion_semanal_id es obligatorio.")
        if not isinstance(items, list) or not items:
            raise ValueError("Debe indicar al menos un origen para procesar.")

        with DB.crear_sesion() as session:
            linea = session.get(FabricacionSemanalDB, int(fabricacion_semanal_id))
            if not linea:
                raise ValueError("No se encontró la línea de fabricación semanal.")

            origenes = []
            material_id = None
            tipo_producto_id = None
            cubicaje_total = 0.0
            prefijo = ""
            for item in items:
                trazabilidad_id = item.get("trazabilidad_id")
                m3 = item.get("m3")
                if not trazabilidad_id or m3 is None or str(m3).strip() == "":
                    raise ValueError("Cada item debe incluir trazabilidad_id y m3.")
                traza = session.get(TrazabilidadFabricacionDB, int(trazabilidad_id))
                if not traza or int(traza.fabricacion_semanal_id or 0) != int(fabricacion_semanal_id):
                    raise ValueError("Una trazabilidad no pertenece a la línea semanal indicada.")
                palet = session.get(PaletDB, int(traza.palet_id or 0))
                if not palet:
                    raise ValueError("No se encontró un palet origen.")
                restante = max(float(palet.cubicaje or 0) - float(palet.consumido or 0), 0.0)
                m3_val = float(m3)
                if m3_val <= 0:
                    raise ValueError("El m3 a procesar debe ser mayor que 0.")
                if m3_val > restante + 0.000001:
                    raise ValueError("El m3 a procesar supera el sobrante del palet origen.")
                if material_id is None:
                    material_id = palet.material_id
                    tipo_producto_id = palet.tipo_producto_id
                    prefijo = self._extraer_prefijo_lote(palet.codigo or "")
                else:
                    if int(material_id or 0) != int(palet.material_id or 0):
                        raise ValueError("Todos los palets origen deben tener el mismo material.")
                    if int(tipo_producto_id or 0) != int(palet.tipo_producto_id or 0):
                        raise ValueError("Todos los palets origen deben tener el mismo tipo de producto.")
                cubicaje_total += m3_val
                origenes.append((palet, m3_val))

            ubicacion_destino = self._obtener_ubicacion_almacen_cierre(session)
            contador = self._siguiente_contador_global_palets(session)
            codigo_nuevo = f"{prefijo or 'PROC'}#{contador:06d}"
            while session.exec(select(PaletDB).where(PaletDB.codigo == codigo_nuevo)).first():
                contador += 1
                codigo_nuevo = f"{prefijo or 'PROC'}#{contador:06d}"

            palet_destino = PaletDB(
                codigo=codigo_nuevo,
                linea_entrada_id=None,
                tipo_producto_id=tipo_producto_id,
                material_id=material_id,
                cubicaje=cubicaje_total,
                consumido=0.0,
                estado=1,
                ubicacion_id=ubicacion_destino.id,
                procesado=True,
            )
            session.add(palet_destino)
            session.flush()

            linea_destino = None
            if fabricacion_semanal_destino_id:
                linea_destino = session.get(FabricacionSemanalDB, int(fabricacion_semanal_destino_id))
                if not linea_destino:
                    raise ValueError("No se encontró la fabricación semanal destino.")
                if int(linea_destino.estado or 0) not in (1, 2):
                    raise ValueError("La fabricación semanal destino no está disponible.")
                session.add(TrazabilidadFabricacionDB(
                    fabricacion_semanal_id=int(linea_destino.id),
                    palet_id=int(palet_destino.id),
                    cantidad_fabricada=0,
                    estado=0,
                ))

            trazas_proc = []
            for palet_origen, m3_val in origenes:
                palet_origen.consumido = float(palet_origen.consumido or 0) + float(m3_val)
                session.add(palet_origen)
                traza_proc = TrazabilidadProcesadoDB(
                    palet_origen_id=int(palet_origen.id),
                    palet_destino_id=int(palet_destino.id),
                )
                session.add(traza_proc)
                session.flush()
                trazas_proc.append(traza_proc)

            session.commit()
            session.refresh(palet_destino)
            self._actualizar_cache_palet(palet_destino)
            for palet_origen, _m3_val in origenes:
                session.refresh(palet_origen)
                self._actualizar_cache_palet(palet_origen)
            for traza_proc in trazas_proc:
                self._actualizar_cache_traza_procesado(traza_proc)

            return {
                "ok": True,
                "palet_destino": PaletDTO.from_db(palet_destino).model_dump(),
                "cubicaje_procesado": cubicaje_total,
                "fabricacion_semanal_destino_id": int(linea_destino.id) if linea_destino else None,
                "cierre": self.obtener_cierre_semanal(int(fabricacion_semanal_id)),
            }

    def cerrar_fabricacion_semanal(self, data):
        fabricacion_semanal_id = data.get("fabricacion_semanal_id")
        force = bool(data.get("force"))
        if not fabricacion_semanal_id:
            raise ValueError("fabricacion_semanal_id es obligatorio.")

        cierre = self.obtener_cierre_semanal(int(fabricacion_semanal_id))
        negativos = int((cierre.get("totales") or {}).get("negativos") or 0)
        consistencias = cierre.get("consistencias") or {}
        if not force:
            if negativos > 0:
                raise ValueError("No se puede cerrar mientras existan palets en negativo.")
            if not consistencias.get("semana_fabricada_coincide"):
                raise ValueError("No se puede cerrar: la cantidad fabricada semanal no coincide con las botas recuperadas.")
            if not consistencias.get("consumo_coincide"):
                raise ValueError("No se puede cerrar: el consumo de botas no coincide con el consumido total de palets.")

        with DB.crear_sesion() as session:
            linea = session.get(FabricacionSemanalDB, int(fabricacion_semanal_id))
            if not linea:
                raise ValueError("No se encontró la línea de fabricación semanal.")
            pedido = session.get(PedidoDB, int(linea.pedido_id or 0)) if linea.pedido_id else None
            estado_final = self._obtener_estado_fabricacion_finalizado_session(session)

            linea.cantidad_fabricada = int((cierre.get("totales") or {}).get("botas_registradas") or 0)
            linea.estado = int(estado_final.id)
            session.add(linea)

            if pedido:
                lineas_pedido = session.exec(
                    select(FabricacionSemanalDB).where(FabricacionSemanalDB.pedido_id == int(pedido.id))
                ).all()
                pedido.cantidad_fabricada = sum(
                    int(linea.cantidad_fabricada or 0) if int(linea.id or 0) == int(fabricacion_semanal_id)
                    else int(linea_pedido.cantidad_fabricada or 0)
                    for linea_pedido in lineas_pedido
                )
                session.add(pedido)

            session.commit()
            session.refresh(linea)
            self.fabricacion.fabricacion_semanal[linea.id] = FabricacionSemanalDTO.from_db(linea)
            if pedido:
                session.refresh(pedido)
                self.fabricacion.pedidos[pedido.id] = PedidoDTO.from_db(pedido)

            return {
                "ok": True,
                "linea_id": int(linea.id),
                "estado_id": int(linea.estado or 0),
                "cantidad_fabricada": int(linea.cantidad_fabricada or 0),
                "pedido_cantidad_fabricada": int(getattr(pedido, "cantidad_fabricada", 0) or 0),
                "cierre": self.obtener_cierre_semanal(int(fabricacion_semanal_id)),
            }

    def trasladar_sobrantes_cierre_semanal(self, data):
        fabricacion_semanal_id = int(data.get("fabricacion_semanal_id") or 0)
        destino_id = int(data.get("fabricacion_semanal_destino_id") or 0) or None
        crear_palet_hijo = bool(data.get("crear_palet_hijo"))
        if not fabricacion_semanal_id:
            raise ValueError("fabricacion_semanal_id es obligatorio.")

        with DB.crear_sesion() as session:
            origen = session.get(FabricacionSemanalDB, fabricacion_semanal_id)
            if not origen:
                raise ValueError("No se encontró la fabricación semanal origen.")
            destino = session.get(FabricacionSemanalDB, destino_id) if destino_id else None
            if destino_id and not destino:
                raise ValueError("No se encontró la fabricación semanal destino.")
            if destino and int(destino.estado or 0) not in (1, 2):
                raise ValueError("La fabricación semanal destino no está disponible.")

            trazas = session.exec(select(TrazabilidadFabricacionDB).where(
                TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id
            )).all()
            hijos = []
            palets_asignados = []
            trazas_destino_existentes = set()
            if destino:
                trazas_destino_existentes = {
                    int(item.palet_id) for item in session.exec(select(TrazabilidadFabricacionDB).where(
                        TrazabilidadFabricacionDB.fabricacion_semanal_id == int(destino.id)
                    )).all() if item.palet_id
                }
            for traza in trazas:
                palet_origen = session.get(PaletDB, int(traza.palet_id or 0))
                if not palet_origen:
                    continue
                sobrante = float(palet_origen.cubicaje or 0) - float(palet_origen.consumido or 0)
                if sobrante <= 0.000001:
                    palet_origen.estado = 2
                    session.add(palet_origen)
                    continue
                if crear_palet_hijo:
                    contador = self._siguiente_contador_global_palets(session)
                    prefijo = self._extraer_prefijo_lote(palet_origen.codigo or "") or "TRAS"
                    codigo_hijo = f"{prefijo}#{contador:06d}"
                    while session.exec(select(PaletDB).where(PaletDB.codigo == codigo_hijo)).first():
                        contador += 1
                        codigo_hijo = f"{prefijo}#{contador:06d}"
                    palet_hijo = PaletDB(codigo=codigo_hijo, tipo_producto_id=palet_origen.tipo_producto_id,
                        material_id=palet_origen.material_id, cubicaje=sobrante, consumido=0.0, estado=1,
                        ubicacion_id=palet_origen.ubicacion_id, procesado=bool(palet_origen.procesado))
                    palet_origen.consumido = float(palet_origen.cubicaje or 0)
                    palet_origen.estado = 2
                    session.add(palet_origen)
                    session.add(palet_hijo)
                    session.flush()
                    session.add(TrazabilidadMovimientoDB(fabricacion_semanal_id=fabricacion_semanal_id,
                        palet_origen_id=int(palet_origen.id), palet_destino_id=int(palet_hijo.id), cantidad=sobrante))
                    palet_para_destino = palet_hijo
                    hijos.append({"palet_origen_id": palet_origen.id, "palet_hijo_id": palet_hijo.id, "codigo": codigo_hijo, "m3": sobrante})
                else:
                    palet_para_destino = palet_origen
                if destino and int(palet_para_destino.id) not in trazas_destino_existentes:
                    session.add(TrazabilidadFabricacionDB(fabricacion_semanal_id=int(destino.id),
                        palet_id=int(palet_para_destino.id), cantidad_fabricada=0, estado=0))
                    trazas_destino_existentes.add(int(palet_para_destino.id))
                    palets_asignados.append(int(palet_para_destino.id))

            estado_final = self._obtener_estado_fabricacion_finalizado_session(session)
            origen.estado = int(estado_final.id)
            session.add(origen)
            session.commit()
            self.obtener_fabricacion()
            return {"ok": True, "fabricacion_semanal_id": fabricacion_semanal_id, "estado_id": int(origen.estado),
                    "palets_hijos": hijos, "palets_asignados": palets_asignados}

    def actualizar_cambios_cierre_semanal(self, data):
        linea_id = int(data.get("fabricacion_semanal_id") or 0)
        operaciones = data.get("operaciones") or []
        if not linea_id or not isinstance(operaciones, list):
            raise ValueError("fabricacion_semanal_id y operaciones son obligatorios.")
        with DB.crear_sesion() as session:
            trazas = session.exec(select(TrazabilidadFabricacionDB).where(
                or_(
                    TrazabilidadFabricacionDB.fabricacion_semanal_id == linea_id,
                    TrazabilidadFabricacionDB.fabricacion_semanal_id.is_(None),
                ),
                TrazabilidadFabricacionDB.estado == 0,
            )).all()
            trazas_ids_cierre = {int(traza.id) for traza in trazas if traza.id}
            palets_por_lote = {}
            for traza in trazas:
                palet = session.get(PaletDB, int(traza.palet_id or 0))
                if palet:
                    lote = self._extraer_prefijo_lote(palet.codigo or "")
                    palets_por_lote.setdefault(lote, []).append(palet)

            def palets_lote(lote):
                palets = sorted(palets_por_lote.get(str(lote or ""), []), key=lambda palet: int(palet.id or 0))
                if not palets:
                    raise ValueError(f"No hay palets para el lote {lote}.")
                return palets

            def ajustar_consumo(palets, cantidad):
                pendiente = abs(float(cantidad))
                if cantidad > 0:
                    for palet in palets:
                        if pendiente <= 0:
                            break
                        disponible = max(float(palet.cubicaje or 0) - float(palet.consumido or 0), 0.0)
                        delta = min(disponible, pendiente)
                        palet.consumido = float(palet.consumido or 0) + delta
                        session.add(palet)
                        pendiente -= delta
                    if pendiente > 0.000001:
                        raise ValueError("El lote no tiene m3 sobrantes suficientes.")
                    return

                for palet in reversed(palets):
                    if pendiente <= 0:
                        break
                    consumido = max(float(palet.consumido or 0), 0.0)
                    delta = min(consumido, pendiente)
                    palet.consumido = float(palet.consumido or 0) - delta
                    session.add(palet)
                    pendiente -= delta
                if pendiente > 0.000001:
                    raise ValueError("El lote no tiene m3 consumidos suficientes para revertir el ajuste.")

            for operacion in operaciones:
                tipo = str(operacion.get("tipo") or "")
                detalle = operacion.get("detalle") or {}
                m3 = float(detalle.get("m3") or 0)
                if tipo == "reasignar":
                    origen, destino = palets_lote(detalle.get("origen")), palets_lote(detalle.get("destino"))
                    palet_origen, palet_destino = origen[-1], destino[-1]
                    cubicaje_origen = float(palet_origen.cubicaje or 0) - m3
                    cubicaje_destino = float(palet_destino.cubicaje or 0) + m3
                    palet_origen.cubicaje = cubicaje_origen
                    palet_destino.cubicaje = cubicaje_destino
                    session.add(palet_origen)
                    session.add(palet_destino)
                elif tipo == "reasignar_consumo":
                    traza_origen = session.get(TrazabilidadFabricacionDB, int(detalle.get("trazabilidad_origen_id") or 0))
                    traza_destino = session.get(TrazabilidadFabricacionDB, int(detalle.get("trazabilidad_destino_id") or 0))
                    if not traza_origen or not traza_destino or int(traza_origen.id or 0) not in trazas_ids_cierre or int(traza_destino.id or 0) not in trazas_ids_cierre:
                        raise ValueError("Las trazabilidades de reasignación no pertenecen al cierre semanal.")
                    palet_origen = session.get(PaletDB, int(traza_origen.palet_id or 0))
                    palet_destino = session.get(PaletDB, int(traza_destino.palet_id or 0))
                    if not palet_origen or not palet_destino:
                        raise ValueError("No se encontraron los palés de reasignación.")
                    consumo_origen = float(palet_origen.consumido or 0) - m3
                    consumo_destino = float(palet_destino.consumido or 0) + m3
                    palet_origen.consumido = consumo_origen
                    palet_destino.consumido = consumo_destino
                    session.add(palet_origen)
                    session.add(palet_destino)
                elif tipo == "desperdicio":
                    if m3 <= 0:
                        raise ValueError("El desperdicio debe ser mayor que cero.")
                    ajustar_consumo(palets_lote(detalle.get("lote")), m3)
                elif tipo == "procesado":
                    origen = palets_lote(detalle.get("lote"))
                    if m3 <= 0:
                        raise ValueError("El procesado debe ser mayor que cero.")
                    codigo = str(detalle.get("palet_destino_codigo") or "").strip()
                    if not codigo or session.exec(select(PaletDB).where(PaletDB.codigo == codigo)).first():
                        raise ValueError("El código de palet procesado es obligatorio y debe ser único.")
                    ajustar_consumo(origen, m3)
                    palet_hijo = PaletDB(codigo=codigo, tipo_producto_id=origen[0].tipo_producto_id,
                        material_id=origen[0].material_id, cubicaje=m3, consumido=0.0, estado=1,
                        ubicacion_id=origen[0].ubicacion_id, procesado=True)
                    session.add(palet_hijo)
                    session.flush()
                    for palet in origen:
                        session.add(TrazabilidadProcesadoDB(palet_origen_id=int(palet.id), palet_destino_id=int(palet_hijo.id)))
                else:
                    raise ValueError(f"Operación de cierre no soportada: {tipo}.")
            for traza in trazas:
                palet = session.get(PaletDB, int(traza.palet_id or 0))
                if palet and float(palet.consumido or 0) >= float(palet.cubicaje or 0) - 0.000001:
                    palet.estado = 2
                    session.add(palet)
            session.commit()
        self.obtener_fabricacion()
        return {"ok": True, "cierre": self.obtener_cierre_semanal(linea_id)}

    def listar_palets_consumo(self):
        with DB.crear_sesion() as session:
            stmt = (
                select(
                    PaletDB.id,
                    PaletDB.codigo,
                    PaletDB.procesado,
                    PaletDB.ubicacion_id,
                    UbicacionDB.descripcion,
                    UbicacionDB.instalacion_id,
                    PaletDB.tipo_producto_id,
                    PaletDB.material_id,
                    PaletDB.cubicaje,
                    PaletDB.consumido,
                )
                .select_from(PaletDB)
                .join(UbicacionDB, UbicacionDB.id == PaletDB.ubicacion_id, isouter=True)
                .where(PaletDB.linea_entrada_id.is_(None))
                .where(PaletDB.procesado.is_(False))
                .order_by(UbicacionDB.descripcion, PaletDB.tipo_producto_id, PaletDB.material_id, PaletDB.codigo)
            )
            rows = session.exec(stmt).all()
            resultado = []
            for row in rows:
                restante = max(float(row[8] or 0) - float(row[9] or 0), 0.0)
                if restante <= 0:
                    continue
                if row[5] is None:
                    continue
                if row[6] is None or row[7] is None:
                    continue
                resultado.append(
                    {
                        "id": row[0],
                        "codigo": row[1] or "",
                        "procesado": bool(row[2]),
                        "ubicacion_id": row[3],
                        "ubicacion": row[4] or "Sin ubicación",
                        "id_instalacion": row[5],
                        "tipo_producto": row[6],
                        "id_material": row[7],
                        "cubicaje": float(row[8] or 0),
                        "consumido": float(row[9] or 0),
                        "cantidad_stock": float(row[8] or 0),
                        "cantidad_consumida": float(row[9] or 0),
                        "restante": restante,
                    }
                )
            return resultado

    def expedir_productos_destino(self, data):
        data = data or {}
        pedido_id = int(data.get("pedido_id") or 0)
        codigos = [
            str(codigo).strip()
            for codigo in (data.get("codigos") or [])
            if str(codigo).strip() != ""
        ]
        contenedor = str(data.get("contenedor") or "").strip()

        if not pedido_id:
            raise ValueError("pedido_id es obligatorio.")
        if not contenedor:
            raise ValueError("contenedor es obligatorio.")
        if not codigos:
            raise ValueError("codigos es obligatorio.")

        codigos_unicos = list(dict.fromkeys(codigos))

        with DB.crear_sesion() as session:
            pedido = session.get(PedidoDB, pedido_id)
            if not pedido:
                raise ValueError("pedido no encontrado.")
            destinoPedido = str(pedido.destino or "").strip().upper() 
            if destinoPedido != "CLIENTE" and destinoPedido != "C":
                raise ValueError("Solo se pueden expedir pedidos con destino CLIENTE.")

            lineas = session.exec(
                select(FabricacionSemanalDB).where(FabricacionSemanalDB.pedido_id == pedido_id)
            ).all()
            lineas_ids = {int(linea.id) for linea in lineas if linea.id}
            if not lineas_ids:
                raise ValueError("El pedido no tiene fabricación semanal.")

            productos = session.exec(
                select(ProductoDB).where(ProductoDB.codigo.in_(codigos_unicos))
            ).all()
            productos_por_codigo = {str(producto.codigo or "").strip(): producto for producto in productos}
            trazabilidades_producto = session.exec(
                select(TrazabilidadProductoDB).where(
                    TrazabilidadProductoDB.producto_id.in_([int(producto.id) for producto in productos if producto.id])
                )
            ).all() if productos else []
            trazabilidades_fabricacion = session.exec(select(TrazabilidadFabricacionDB)).all()
            trazabilidades_fabricacion_por_id = {int(traza.id): traza for traza in trazabilidades_fabricacion if traza.id}
            linea_por_producto_id = {}
            for traza_producto in trazabilidades_producto:
                producto_rel_id = int(traza_producto.producto_id or 0)
                traza_fabricacion = trazabilidades_fabricacion_por_id.get(int(traza_producto.trazabilidad_fabricacion_id or 0))
                if not producto_rel_id or not traza_fabricacion:
                    continue
                linea_por_producto_id[producto_rel_id] = int(traza_fabricacion.fabricacion_semanal_id or 0)

            faltantes = [codigo for codigo in codigos_unicos if codigo not in productos_por_codigo]
            if faltantes:
                raise ValueError(f"No se encontraron estos códigos: {', '.join(faltantes)}")

            productos_validos = []
            for codigo in codigos_unicos:
                producto = productos_por_codigo[codigo]
                linea_producto_id = int(producto.produccion_id or 0) or int(linea_por_producto_id.get(int(producto.id or 0)) or 0)
                if linea_producto_id not in lineas_ids:
                    raise ValueError(f"El código {codigo} no pertenece al pedido seleccionado.")
                productos_validos.append(producto)

            contenedor_db = session.exec(
                select(ContenedorDB)
                .where(ContenedorDB.pedido_id == pedido_id)
                .where(ContenedorDB.contenedor == contenedor)
                .order_by(ContenedorDB.id.desc())
            ).first()
            if not contenedor_db:
                contenedor_db = ContenedorDB(
                    contenedor=contenedor,
                    pedido_id=pedido_id,
                )
                session.add(contenedor_db)
                session.flush()

            actualizados = []
            for producto in productos_validos:
                producto.estado = 6
                producto.contenedor_id = contenedor_db.id
                session.add(producto)
                actualizados.append(producto)

            session.commit()

            for producto in actualizados:
                session.refresh(producto)
                self.maestros.productos[producto.id] = ProductoDTO.from_db(producto)
            self.maestros.contenedores[contenedor_db.id] = ContenedorDTO.from_db(contenedor_db)

            return {
                "ok": True,
                "pedido_id": pedido_id,
                "contenedor": contenedor,
                "contenedor_id": contenedor_db.id,
                "cantidad": len(actualizados),
                "codigos": [producto.codigo for producto in actualizados],
            }

    def envinar_productos_destino(self, data):
        data = data or {}
        pedido_id = int(data.get("pedido_id") or 0)
        ubicacion_id = int(data.get("ubicacion_id") or 0)
        codigos = [
            str(codigo).strip()
            for codigo in (data.get("codigos") or [])
            if str(codigo).strip() != ""
        ]

        if not pedido_id:
            raise ValueError("pedido_id es obligatorio.")
        if not ubicacion_id:
            raise ValueError("ubicacion_id es obligatorio.")
        if not codigos:
            raise ValueError("codigos es obligatorio.")

        codigos_unicos = list(dict.fromkeys(codigos))

        with DB.crear_sesion() as session:
            pedido = session.get(PedidoDB, pedido_id)
            if not pedido:
                raise ValueError("pedido no encontrado.")
            destinoPedido = str(pedido.destino or "").strip().upper() 
            if destinoPedido != "ENVINADO" and destinoPedido != "E":
                raise ValueError("Solo se pueden envinar pedidos con destino ENVINADO.")

            ubicacion = session.get(UbicacionDB, ubicacion_id)
            if not ubicacion:
                raise ValueError("ubicacion no encontrada.")

            instalacion = session.get(InstalacionDB, int(ubicacion.instalacion_id or 0))
            tipo_instalacion = str(getattr(instalacion, "tipo", "") or "").strip().upper()
            if not instalacion or tipo_instalacion != "B":
                raise ValueError("La ubicación seleccionada debe pertenecer a una instalación de tipo B.")

            lineas = session.exec(
                select(FabricacionSemanalDB).where(FabricacionSemanalDB.pedido_id == pedido_id)
            ).all()
            lineas_ids = {int(linea.id) for linea in lineas if linea.id}
            if not lineas_ids:
                raise ValueError("El pedido no tiene fabricación semanal.")

            productos = session.exec(
                select(ProductoDB).where(ProductoDB.codigo.in_(codigos_unicos))
            ).all()
            productos_por_codigo = {str(producto.codigo or "").strip(): producto for producto in productos}
            trazabilidades_producto = session.exec(
                select(TrazabilidadProductoDB).where(
                    TrazabilidadProductoDB.producto_id.in_([int(producto.id) for producto in productos if producto.id])
                )
            ).all() if productos else []
            trazabilidades_fabricacion = session.exec(select(TrazabilidadFabricacionDB)).all()
            trazabilidades_fabricacion_por_id = {int(traza.id): traza for traza in trazabilidades_fabricacion if traza.id}
            linea_por_producto_id = {}
            for traza_producto in trazabilidades_producto:
                producto_rel_id = int(traza_producto.producto_id or 0)
                traza_fabricacion = trazabilidades_fabricacion_por_id.get(int(traza_producto.trazabilidad_fabricacion_id or 0))
                if not producto_rel_id or not traza_fabricacion:
                    continue
                linea_por_producto_id[producto_rel_id] = int(traza_fabricacion.fabricacion_semanal_id or 0)

            faltantes = [codigo for codigo in codigos_unicos if codigo not in productos_por_codigo]
            if faltantes:
                raise ValueError(f"No se encontraron estos códigos: {', '.join(faltantes)}")

            actualizados = []
            for codigo in codigos_unicos:
                producto = productos_por_codigo[codigo]
                linea_producto_id = int(producto.produccion_id or 0) or int(linea_por_producto_id.get(int(producto.id or 0)) or 0)
                if linea_producto_id not in lineas_ids:
                    raise ValueError(f"El código {codigo} no pertenece al pedido seleccionado.")
                producto.estado = 3
                producto.ubicacion_id = ubicacion.id
                session.add(producto)
                actualizados.append(producto)

            session.commit()

            for producto in actualizados:
                session.refresh(producto)
                self.maestros.productos[producto.id] = ProductoDTO.from_db(producto)

            return {
                "ok": True,
                "pedido_id": pedido_id,
                "ubicacion_id": ubicacion.id,
                "cantidad": len(actualizados),
                "codigos": [producto.codigo for producto in actualizados],
                "estado": 3,
            }

    def listar_resumen_envinado(self, filtros: dict | None = None):
        filtros = filtros or {}
        estados = {
            int(estado)
            for estado in (filtros.get("estados") or [3, 4])
            if str(estado).strip() != ""
        }

        with DB.crear_sesion() as session:
            analiticas = session.exec(select(AnaliticaDB)).all()
            productos = session.exec(
                select(ProductoDB).where(
                    ProductoDB.tipo == "BOTA",
                    ProductoDB.estado.in_(list(estados)),
                )
            ).all()
            if not productos:
                analiticas_activas = [
                    {
                        "id": analitica.id,
                        "fecha": analitica.fecha.isoformat() if analitica.fecha else None,
                        "descripcion": analitica.descripcion,
                        "estado": self._normalizar_estado_analitica(analitica.estado),
                    }
                    for analitica in analiticas
                    if self._normalizar_estado_analitica(analitica.estado) == "ACTIVA"
                ]
                return {"pendientes": [], "envinadas": [], "analiticas_activas": analiticas_activas}

            pedidos = self.repo_pedidos.list_all(session)
            clientes = self.repo_clientes.list_all(session)
            instalaciones = self.repo_instalaciones.list_all(session)
            ubicaciones = self.repo_ubicaciones.list_all(session)
            lineas = self.repo_fabricacion_semanal.list_all(session)
            estados_producto = self.repo_estados_productos.list_all(session)
            relaciones_analitica = session.exec(select(BotaEnvinadaAnaliticaDB)).all()
            relaciones_archivo = session.exec(select(BotaEnvinadaArchivoDB)).all()
            trazabilidades_producto = session.exec(
                select(TrazabilidadProductoDB).where(
                    TrazabilidadProductoDB.producto_id.in_([int(producto.id) for producto in productos if producto.id])
                )
            ).all()
            trazabilidades_fabricacion = session.exec(select(TrazabilidadFabricacionDB)).all()

            pedidos_por_id = {int(pedido.id): pedido for pedido in pedidos if pedido.id}
            clientes_por_id = {int(cliente.id): cliente for cliente in clientes if cliente.id}
            instalaciones_por_id = {int(instalacion.id): instalacion for instalacion in instalaciones if instalacion.id}
            ubicaciones_por_id = {int(ubicacion.id): ubicacion for ubicacion in ubicaciones if ubicacion.id}
            lineas_por_id = {int(linea.id): linea for linea in lineas if linea.id}
            estados_por_id = {int(estado.id): estado for estado in estados_producto if estado.id is not None}
            analiticas_por_id = {int(analitica.id): analitica for analitica in analiticas if analitica.id}
            trazas_por_id = {int(traza.id): traza for traza in trazabilidades_fabricacion if traza.id}

            linea_por_producto_id = {}
            for traza_producto in trazabilidades_producto:
                producto_id = int(traza_producto.producto_id or 0)
                traza = trazas_por_id.get(int(traza_producto.trazabilidad_fabricacion_id or 0))
                if producto_id and traza and int(traza.fabricacion_semanal_id or 0):
                    linea_por_producto_id[producto_id] = int(traza.fabricacion_semanal_id or 0)

            analitica_por_producto_id = {
                int(rel.producto_id): int(rel.analitica_id)
                for rel in relaciones_analitica
                if rel.producto_id and rel.analitica_id
            }
            archivos_por_producto_id = {}
            for rel in relaciones_archivo:
                producto_id = int(rel.producto_id or 0)
                if not producto_id:
                    continue
                archivos_por_producto_id[producto_id] = archivos_por_producto_id.get(producto_id, 0) + 1

            items = []
            for producto in productos:
                producto_id = int(producto.id or 0)
                linea = lineas_por_id.get(int(producto.produccion_id or 0) or linea_por_producto_id.get(producto_id, 0))
                pedido = pedidos_por_id.get(int(getattr(linea, "pedido_id", 0) or 0))
                cliente = clientes_por_id.get(int(getattr(pedido, "cliente_id", 0) or 0))
                ubicacion = ubicaciones_por_id.get(int(producto.ubicacion_id or 0))
                instalacion = instalaciones_por_id.get(int(getattr(ubicacion, "instalacion_id", 0) or 0))
                analitica = analiticas_por_id.get(analitica_por_producto_id.get(producto_id, 0))
                texto_ubicacion = str(getattr(ubicacion, "descripcion", "") or "").strip()
                texto_instalacion = str(getattr(instalacion, "nombre", "") or "").strip()
                ubicacion_texto = f"{texto_instalacion} - {texto_ubicacion}".strip(" -")
                estado_id = int(producto.estado or 0)
                items.append({
                    "id": producto_id,
                    "codigo": str(producto.codigo or "").strip(),
                    "estado": estado_id,
                    "estado_descripcion": getattr(estados_por_id.get(estado_id), "descripcion", None) or str(estado_id),
                    "ubicacion_id": producto.ubicacion_id,
                    "ubicacion": ubicacion_texto or "-",
                    "pedido_id": getattr(pedido, "id", None),
                    "pedido_numero": getattr(pedido, "numero", None) or getattr(pedido, "descripcion", None) or "",
                    "cliente_nombre": getattr(cliente, "nombre", None) or "",
                    "analitica_id": getattr(analitica, "id", None),
                    "analitica_descripcion": getattr(analitica, "descripcion", None) or "",
                    "analitica_fecha": analitica.fecha.isoformat() if getattr(analitica, "fecha", None) else None,
                    "documentos_count": archivos_por_producto_id.get(producto_id, 0),
                })

            pendientes = [item for item in items if int(item.get("estado") or 0) == 3]
            envinadas = [item for item in items if int(item.get("estado") or 0) == 4]
            pendientes.sort(key=lambda item: (str(item.get("ubicacion") or ""), str(item.get("codigo") or "")))
            envinadas.sort(key=lambda item: (str(item.get("analitica_descripcion") or ""), str(item.get("codigo") or "")))

            analiticas_activas = [
                {
                    "id": analitica.id,
                    "fecha": analitica.fecha.isoformat() if analitica.fecha else None,
                    "descripcion": analitica.descripcion,
                    "estado": self._normalizar_estado_analitica(analitica.estado),
                }
                for analitica in analiticas
                if self._normalizar_estado_analitica(analitica.estado) == "ACTIVA"
            ]
            analiticas_activas.sort(key=lambda item: (str(item["fecha"] or ""), str(item["descripcion"] or "")))

            return {
                "pendientes": pendientes,
                "envinadas": envinadas,
                "analiticas_activas": analiticas_activas,
            }

    def envinar_botas_pendientes(self, data: dict | None = None):
        data = data or {}
        analitica_id = int(data.get("analitica_id") or 0)
        codigos = [
            str(codigo).strip()
            for codigo in (data.get("codigos") or [])
            if str(codigo).strip() != ""
        ]
        if not analitica_id:
            raise ValueError("analitica_id es obligatorio.")
        if not codigos:
            raise ValueError("codigos es obligatorio.")

        codigos_unicos = list(dict.fromkeys(codigos))

        with DB.crear_sesion() as session:
            ahora = datetime.now()
            analitica = session.get(AnaliticaDB, analitica_id)
            if not analitica:
                raise ValueError("Analitica no encontrada.")
            if self._normalizar_estado_analitica(analitica.estado) != "ACTIVA":
                raise ValueError("La analitica seleccionada no esta activa.")

            _, productos_por_codigo = self._resolver_productos_bota_por_codigos(session, codigos_unicos)
            faltantes = [codigo for codigo in codigos_unicos if codigo not in productos_por_codigo]
            if faltantes:
                raise ValueError(f"No se encontraron estos códigos: {', '.join(faltantes)}")

            resultado = []
            for codigo in codigos_unicos:
                producto = productos_por_codigo[codigo]
                if str(producto.tipo or "").strip().upper() != "BOTA":
                    raise ValueError(f"El código {codigo} no corresponde a una bota.")
                if int(producto.estado or 0) != 3:
                    raise ValueError(f"El código {codigo} no esta pendiente de envinar.")

                producto.estado = 4
                session.add(producto)

                relacion = session.exec(
                    select(BotaEnvinadaAnaliticaDB).where(BotaEnvinadaAnaliticaDB.producto_id == int(producto.id))
                ).first()
                if not relacion:
                    relacion = BotaEnvinadaAnaliticaDB(
                        producto_id=int(producto.id),
                        analitica_id=analitica_id,
                        created_at=ahora,
                        updated_at=ahora,
                    )
                else:
                    relacion.analitica_id = analitica_id
                    relacion.updated_at = ahora
                session.add(relacion)
                resultado.append(str(producto.codigo or "").strip())

            session.commit()
            for producto in productos_por_codigo.values():
                if producto.id:
                    self.maestros.productos[producto.id] = ProductoDTO.from_db(producto)

            return {
                "ok": True,
                "analitica_id": analitica_id,
                "cantidad": len(resultado),
                "codigos": resultado,
            }

    def vincular_archivos_botas_envinadas(self, data: dict | None = None):
        data = data or {}
        archivo_ids = [
            int(archivo_id)
            for archivo_id in (data.get("archivo_ids") or [])
            if str(archivo_id).strip() != ""
        ]
        producto_ids = [
            int(producto_id)
            for producto_id in (data.get("producto_ids") or [])
            if str(producto_id).strip() != ""
        ]
        codigos = [
            str(codigo).strip()
            for codigo in (data.get("codigos") or [])
            if str(codigo).strip() != ""
        ]
        if not archivo_ids:
            raise ValueError("archivo_ids es obligatorio.")
        if not producto_ids and not codigos:
            raise ValueError("producto_ids o codigos es obligatorio.")

        with DB.crear_sesion() as session:
            if codigos and not producto_ids:
                productos, productos_por_codigo = self._resolver_productos_bota_por_codigos(session, list(dict.fromkeys(codigos)))
                faltantes = [codigo for codigo in codigos if codigo not in productos_por_codigo]
                if faltantes:
                    raise ValueError(f"No se encontraron estos códigos: {', '.join(faltantes)}")
                producto_ids = [int(producto.id) for producto in productos if producto.id]

            productos = session.exec(
                select(ProductoDB).where(ProductoDB.id.in_(list(dict.fromkeys(producto_ids))))
            ).all()
            productos_por_id = {int(producto.id): producto for producto in productos if producto.id}
            if len(productos_por_id) != len(set(producto_ids)):
                raise ValueError("Alguna bota seleccionada no existe.")

            archivos = session.exec(
                select(ArchivoSubidoDB).where(ArchivoSubidoDB.id.in_(list(dict.fromkeys(archivo_ids))))
            ).all()
            archivos_por_id = {int(archivo.id): archivo for archivo in archivos if archivo.id}
            if len(archivos_por_id) != len(set(archivo_ids)):
                raise ValueError("Alguno de los archivos no existe.")

            creados = 0
            ahora = datetime.now()
            for producto in productos_por_id.values():
                if str(producto.tipo or "").strip().upper() != "BOTA" or int(producto.estado or 0) != 4:
                    raise ValueError(f"La bota {producto.codigo} no esta envinada.")
                for archivo_id in archivo_ids:
                    existente = session.exec(
                        select(BotaEnvinadaArchivoDB).where(
                            BotaEnvinadaArchivoDB.producto_id == int(producto.id),
                            BotaEnvinadaArchivoDB.archivo_subido_id == int(archivo_id),
                        )
                    ).first()
                    if existente:
                        continue
                    session.add(BotaEnvinadaArchivoDB(
                        producto_id=int(producto.id),
                        archivo_subido_id=int(archivo_id),
                        created_at=ahora,
                    ))
                    creados += 1

            session.commit()
            return {
                "ok": True,
                "archivo_ids": archivo_ids,
                "producto_ids": sorted(productos_por_id.keys()),
                "enlaces_creados": creados,
            }

    def listar_archivos_bota_envinada(self, producto_id: int):
        producto_id = int(producto_id or 0)
        if not producto_id:
            raise ValueError("producto_id es obligatorio.")

        with DB.crear_sesion() as session:
            relaciones = session.exec(
                select(BotaEnvinadaArchivoDB).where(BotaEnvinadaArchivoDB.producto_id == producto_id)
            ).all()
            archivo_ids = [int(rel.archivo_subido_id) for rel in relaciones if rel.archivo_subido_id]
            if not archivo_ids:
                return []
            archivos = session.exec(
                select(ArchivoSubidoDB).where(
                    ArchivoSubidoDB.id.in_(archivo_ids),
                    ArchivoSubidoDB.is_deleted == False,
                )
            ).all()
            archivos.sort(key=lambda item: int(item.id or 0), reverse=True)
            return [ArchivoSubidoDTO.from_db(archivo) for archivo in archivos]

    def listar_cubicaje(self):
        with DB.crear_sesion() as session:
            cubicajes = session.exec(select(CubicajeDB)).all()
            return [CubicajeDTO.from_db(cubicaje) for cubicaje in cubicajes]

    def obtener_contexto_consumo(self, data):
        data = data or {}
        tipo_producto_id = int(data.get("tipo_producto_id") or 0)
        material_id = int(data.get("material_id") or 0)
        ubicacion_id = int(data.get("ubicacion_id") or 0)

        with DB.crear_sesion() as session:
            stmt = (
                select(
                    PaletDB.id,
                    PaletDB.codigo,
                    PaletDB.ubicacion_id,
                    UbicacionDB.instalacion_id,
                    PaletDB.tipo_producto_id,
                    PaletDB.material_id,
                    PaletDB.cubicaje,
                    PaletDB.consumido,
                )
                .select_from(PaletDB)
                .join(UbicacionDB, UbicacionDB.id == PaletDB.ubicacion_id, isouter=True)
                .where(PaletDB.linea_entrada_id.is_(None))
                .where(PaletDB.procesado.is_(False))
            )
            if tipo_producto_id:
                stmt = stmt.where(PaletDB.tipo_producto_id == tipo_producto_id)
            if material_id:
                stmt = stmt.where(PaletDB.material_id == material_id)
            if ubicacion_id:
                stmt = stmt.where(UbicacionDB.instalacion_id == ubicacion_id)

            palets_db = session.exec(stmt).all()
            palets = []
            for p in palets_db:
                restante = max(float(p[6] or 0) - float(p[7] or 0), 0.0)
                if restante <= 0:
                    continue
                if p[3] is None:
                    continue
                if p[4] is None or p[5] is None:
                    continue
                palets.append({
                    "id": p[0],
                    "codigo": p[1] or "",
                    "ubicacion_id": p[2],
                    "id_instalacion": p[3],
                    "tipo_producto": p[4],
                    "id_material": p[5],
                    "cubicaje": float(p[6] or 0),
                    "consumido": float(p[7] or 0),
                    "cantidad_stock": float(p[6] or 0),
                    "cantidad_consumida": float(p[7] or 0),
                    "restante": restante,
                })

            cubicaje_estandar = 0.0
            if tipo_producto_id:
                cubicaje = session.exec(
                    select(CubicajeDB).where(CubicajeDB.tipo_producto_id == tipo_producto_id)
                ).first()
                if cubicaje:
                    cubicaje_estandar = float(cubicaje.cubicaje_estandar or 0)

            return {
                "palets": palets,
                "cubicaje_estandar": cubicaje_estandar,
            }

    def listar_palets_tapas(self):
        with DB.crear_sesion() as session:
            palets = session.exec(
                select(PaletDB).where(
                    PaletDB.codigo.endswith("#tapas"),
                    PaletDB.procesado.is_(True),
                    PaletDB.linea_entrada_id.is_(None),
                ).order_by(PaletDB.codigo)
            ).all()
            return [
                {
                    "id": palet.id,
                    "codigo": palet.codigo,
                    "cubicaje": float(palet.cubicaje or 0),
                    "consumido": float(palet.consumido or 0),
                    "restante": float(palet.cubicaje or 0) - float(palet.consumido or 0),
                }
                for palet in palets
            ]

    def agregar_palet_tapas_desde_stock(self, data):
        proveedor_id = int(data.get("proveedor_id") or 0)
        palet_origen_id = int(data.get("palet_origen_id") or 0)
        lote_palet = str(data.get("lote_palet") or "").strip()
        cubicaje = float(data.get("cubicaje") or 0)
        paquetes = int(data.get("paquetes") or 1)
        volumen = cubicaje * paquetes
        if not proveedor_id or (not palet_origen_id and not lote_palet) or cubicaje <= 0 or paquetes < 1:
            raise ValueError("Proveedor, palet origen, cubicaje y paquetes válidos son obligatorios.")

        with DB.crear_sesion() as session:
            with session.begin():
                proveedor = session.exec(
                    select(ProveedorDB).where(ProveedorDB.id == proveedor_id).with_for_update()
                ).first()
                consulta_origen = select(PaletDB)
                consulta_origen = consulta_origen.where(
                    PaletDB.id == palet_origen_id if palet_origen_id else PaletDB.codigo == lote_palet
                ).with_for_update()
                origen = session.exec(consulta_origen).first()
                if not proveedor or not str(proveedor.nombre or "").strip():
                    raise ValueError("Proveedor no encontrado.")
                if not origen or (palet_origen_id and (origen.linea_entrada_id is not None or bool(origen.procesado))):
                    raise ValueError("El palet origen no está disponible.")
                if volumen > float(origen.cubicaje or 0) - float(origen.consumido or 0) + 0.000001:
                    raise ValueError("El cubicaje solicitado supera el restante del palet origen.")

                codigo = f"{proveedor.nombre.strip()}#tapas"
                if origen.codigo == codigo:
                    raise ValueError("El palet de tapas no puede ser su propio origen.")
                if len(codigo) > 60:
                    raise ValueError("El nombre del proveedor es demasiado largo para el código del palet de tapas.")
                destino = session.exec(select(PaletDB).where(PaletDB.codigo == codigo)).first()
                if destino:
                    if not destino.procesado or destino.linea_entrada_id is not None:
                        raise ValueError("El código de tapas ya está usado por otro palet.")
                    destino.cubicaje = float(destino.cubicaje or 0) + volumen
                else:
                    destino = PaletDB(
                        codigo=codigo,
                        linea_entrada_id=None,
                        tipo_producto_id=origen.tipo_producto_id,
                        material_id=origen.material_id,
                        cubicaje=volumen,
                        consumido=0.0,
                        estado=1,
                        ubicacion_id=origen.ubicacion_id,
                        procesado=True,
                    )
                    session.add(destino)
                    session.flush()
                if float(destino.cubicaje or 0) > float(destino.consumido or 0):
                    destino.estado = 1
                origen.consumido = float(origen.consumido or 0) + volumen
                session.add(origen)
                session.add(destino)
                session.add(TrazabilidadProcesadoDB(
                    palet_origen_id=origen.id,
                    palet_destino_id=destino.id,
                ))
            return {"id": destino.id, "codigo": destino.codigo, "cubicaje": destino.cubicaje}

    def agregar_trazabilidad_fabricacion(self, session: Session, fabricacion_semanal_id: int | None, palet: PaletDB):
        statement = select(TrazabilidadFabricacionDB).where(TrazabilidadFabricacionDB.palet_id == palet.id)
        if fabricacion_semanal_id:
            statement = statement.where(TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id)
        else:
            statement = statement.where(TrazabilidadFabricacionDB.fabricacion_semanal_id.is_(None))
        existente = session.exec(statement).first()
        if existente:
            raise ValueError("El palet ya esta asociado a esta linea de trazabilidad.")

        trazabilidad = TrazabilidadFabricacionDB(
            fabricacion_semanal_id=fabricacion_semanal_id,
            palet_id=palet.id,
            estado=1,
        )
        session.add(trazabilidad)
        session.flush()

        return {
            "fabricacion_semanal_id": fabricacion_semanal_id,
            "trazabilidad": trazabilidad,
            "palet": palet,
        }

    def agregar_trazabilidad_fabricacion_desde_palet(self, data):
        fabricacion_semanal_id = data.get("fabricacion_semanal_id")
        lote_palet = (data.get("lote_palet") or "").strip()
        cubicaje = data.get("cubicaje")

        if not lote_palet:
            raise ValueError("lote_palet es obligatorio.")
        if cubicaje is None or str(cubicaje).strip() == "":
            raise ValueError("cubicaje es obligatorio.")

        with DB.crear_sesion() as session:
            palet = session.exec(
                select(PaletDB).where(PaletDB.codigo == lote_palet)
            ).first()
            if not palet:
                raise ValueError("No se encontro palet para lote_palet.")

            retorno = self.agregar_trazabilidad_fabricacion(session, fabricacion_semanal_id, palet)
            session.commit()
            session.refresh(retorno["trazabilidad"])
            return retorno


    def agregar_trazabilidad_fabricacion_desde_palet_stock(self, data):
        fabricacion_semanal_id = data.get("fabricacion_semanal_id")
        palet_origen_id = data.get("palet_origen_id")
        lote = (data.get("lote") or "").strip()
        cubicaje = data.get("cubicaje")
        paquetes = data.get("paquetes")

        if not palet_origen_id:
            raise ValueError("palet_origen_id es obligatorio.")
        if not lote:
            raise ValueError("lote es obligatorio.")
        if cubicaje is None or str(cubicaje).strip() == "":
            raise ValueError("cubicaje es obligatorio.")

        cubicaje_val = float(cubicaje) * float(paquetes or 1)
        if cubicaje_val <= 0:
            raise ValueError("cubicaje debe ser mayor que 0.")

        with DB.crear_sesion() as session:
            palet_origen = session.get(PaletDB, int(palet_origen_id))
            if not palet_origen:
                raise ValueError("palet_origen no encontrado.")
            if palet_origen.linea_entrada_id is not None:
                raise ValueError("El palet origen no es un palet de stock.")
            if bool(palet_origen.procesado):
                raise ValueError("El palet origen ya esta procesado.")

            restante_origen = max(float(palet_origen.cubicaje or 0) - float(palet_origen.consumido or 0), 0.0)
            if cubicaje_val > restante_origen:
                raise ValueError("El cubicaje solicitado supera el restante del palet origen.")

            palet_origen.consumido = float(palet_origen.consumido or 0) + cubicaje_val
            session.add(palet_origen)
            session.flush()

            contador = self._siguiente_contador_global_palets(session)
            codigo_nuevo = f"{lote}#{contador:06d}"

            palet_nuevo = PaletDB(
                codigo=codigo_nuevo,
                linea_entrada_id=None,
                tipo_producto_id=palet_origen.tipo_producto_id,
                material_id=palet_origen.material_id,
                cubicaje=cubicaje_val,
                consumido=0.0,
                estado=palet_origen.estado,
                ubicacion_id=palet_origen.ubicacion_id,
                procesado=True,
            )
            session.add(palet_nuevo)
            session.flush()

            session.add(
                TrazabilidadProcesadoDB(
                    palet_origen_id=palet_origen.id,
                    palet_destino_id=palet_nuevo.id,
                )
            )
            
            retorno = self.agregar_trazabilidad_fabricacion(session, fabricacion_semanal_id, palet_nuevo)
            session.commit()
            session.refresh(palet_origen)
            session.refresh(palet_nuevo)
            session.refresh(retorno["trazabilidad"])
            return retorno

    def _normalizar_segmento_stock(self, texto, fallback="stock"):
        base = re.sub(r"[^A-Za-z0-9]+", "_", str(texto or fallback).strip().lower()).strip("_")
        return base or fallback

    def _generar_prefijo_stock_movido(self, palet_origen: PaletDB, ubicacion_destino_id: int | None = None) -> str:
        tipo = self.fabricacion.tipos_producto.get(int(palet_origen.tipo_producto_id or 0))
        material = self.maestros.materiales.get(int(palet_origen.material_id or 0))
        tipo_txt = self._normalizar_segmento_stock(
            getattr(tipo, "codigo", None) or getattr(tipo, "descripcion", None) or "duela",
            "duela",
        )
        material_txt = self._normalizar_segmento_stock(
            getattr(material, "descripcion", None) or getattr(material, "nombre", None) or "madera",
            "madera",
        )
        if ubicacion_destino_id:
            ubicacion = self.maestros.ubicaciones.get(int(ubicacion_destino_id))
            ubicacion_txt = self._normalizar_segmento_stock(
                getattr(ubicacion, "descripcion", None) or getattr(ubicacion, "nombre", None) or ubicacion_destino_id,
                "ubicacion",
            )
            return f"stock_{tipo_txt}_{material_txt}_{ubicacion_txt}"
        return f"stock_{tipo_txt}_{material_txt}"

    def mover_stock(self, data):
        palet_origen_id = data.get("palet_origen_id")
        ubicacion_destino_id = data.get("ubicacion_destino_id")
        cubicaje = data.get("cubicaje")
        paquetes = data.get("paquetes")

        if not palet_origen_id:
            raise ValueError("palet_origen_id es obligatorio.")
        if not ubicacion_destino_id:
            raise ValueError("ubicacion_destino_id es obligatorio.")
        if cubicaje is None or str(cubicaje).strip() == "":
            raise ValueError("cubicaje es obligatorio.")

        cubicaje_total = float(cubicaje) * float(paquetes or 1)
        if cubicaje_total <= 0:
            raise ValueError("cubicaje debe ser mayor que 0.")

        with DB.crear_sesion() as session:
            palet_origen = session.get(PaletDB, int(palet_origen_id))
            if not palet_origen:
                raise ValueError("palet_origen no encontrado.")
            if palet_origen.linea_entrada_id is not None:
                raise ValueError("El palet origen no es stock.")
            if bool(palet_origen.procesado):
                raise ValueError("El palet origen esta procesado.")
            if not palet_origen.tipo_producto_id or not palet_origen.material_id:
                raise ValueError("El palet origen no tiene tipo o madera.")
            if int(palet_origen.ubicacion_id or 0) == int(ubicacion_destino_id):
                raise ValueError("La ubicacion destino debe ser distinta del origen.")

            restante_origen = max(float(palet_origen.cubicaje or 0) - float(palet_origen.consumido or 0), 0.0)
            if cubicaje_total > restante_origen:
                raise ValueError("El cubicaje solicitado supera el restante del palet origen.")

            palet_destino = session.exec(
                select(PaletDB)
                .where(PaletDB.linea_entrada_id.is_(None))
                .where(PaletDB.procesado.is_(False))
                .where(PaletDB.tipo_producto_id == palet_origen.tipo_producto_id)
                .where(PaletDB.material_id == palet_origen.material_id)
                .where(PaletDB.ubicacion_id == int(ubicacion_destino_id))
                .order_by(PaletDB.codigo, PaletDB.id)
            ).first()

            creado = False
            if palet_destino:
                palet_destino.cubicaje = float(palet_destino.cubicaje or 0) + cubicaje_total
                session.add(palet_destino)
            else:
                codigo_nuevo = self._generar_prefijo_stock_movido(palet_origen, int(ubicacion_destino_id))
                palet_destino = PaletDB(
                    codigo=codigo_nuevo,
                    linea_entrada_id=None,
                    tipo_producto_id=palet_origen.tipo_producto_id,
                    material_id=palet_origen.material_id,
                    cubicaje=cubicaje_total,
                    consumido=0.0,
                    estado=palet_origen.estado,
                    ubicacion_id=int(ubicacion_destino_id),
                    procesado=False,
                )
                session.add(palet_destino)
                creado = True

            palet_origen.consumido = float(palet_origen.consumido or 0) + cubicaje_total
            session.add(palet_origen)
            session.commit()
            session.refresh(palet_origen)
            session.refresh(palet_destino)

            self.maestros.palets[palet_origen.id] = PaletDTO.from_db(palet_origen)
            self.maestros.palets[palet_destino.id] = PaletDTO.from_db(palet_destino)

            return {
                "ok": True,
                "creado": creado,
                "origen": PaletDTO.from_db(palet_origen).model_dump(),
                "destino": PaletDTO.from_db(palet_destino).model_dump(),
                "cubicaje_movido": cubicaje_total,
            }

    def _obtener_ubicacion_procesados(self, session) -> UbicacionDB:
        ubicacion = session.exec(
            select(UbicacionDB)
            .join(InstalacionDB, InstalacionDB.id == UbicacionDB.instalacion_id)
            .where(func.upper(UbicacionDB.descripcion) == "PROCESADOS")
            .where(func.upper(InstalacionDB.nombre) == "PROCESADOS")
            .order_by(UbicacionDB.id)
        ).first()
        if not ubicacion:
            raise ValueError("No existe la ubicacion Procesados - Procesados.")
        return ubicacion

    def procesar_stock(self, data):
        palet_origen_id = data.get("palet_origen_id")
        cubicaje = data.get("cubicaje")
        paquetes = data.get("paquetes")

        if not palet_origen_id:
            raise ValueError("palet_origen_id es obligatorio.")
        if cubicaje is None or str(cubicaje).strip() == "":
            raise ValueError("cubicaje es obligatorio.")

        cubicaje_total = float(cubicaje) * float(paquetes or 1)
        if cubicaje_total <= 0:
            raise ValueError("cubicaje debe ser mayor que 0.")

        with DB.crear_sesion() as session:
            palet_origen = session.get(PaletDB, int(palet_origen_id))
            if not palet_origen:
                raise ValueError("palet_origen no encontrado.")
            if palet_origen.linea_entrada_id is not None:
                raise ValueError("El palet origen no es stock.")
            if bool(palet_origen.procesado):
                raise ValueError("El palet origen ya esta procesado.")

            restante_origen = max(float(palet_origen.cubicaje or 0) - float(palet_origen.consumido or 0), 0.0)
            if cubicaje_total > restante_origen:
                raise ValueError("El cubicaje solicitado supera el restante del palet origen.")

            ubicacion_procesados = self._obtener_ubicacion_procesados(session)
            prefijo = self._extraer_prefijo_lote(palet_origen.codigo or "")
            if not prefijo:
                raise ValueError("No se pudo determinar el prefijo del palet origen.")
            codigo_nuevo = prefijo

            palet_destino = PaletDB(
                codigo=codigo_nuevo,
                linea_entrada_id=None,
                tipo_producto_id=palet_origen.tipo_producto_id,
                material_id=palet_origen.material_id,
                cubicaje=cubicaje_total,
                consumido=0.0,
                estado=palet_origen.estado,
                ubicacion_id=ubicacion_procesados.id,
                procesado=True,
            )
            session.add(palet_destino)
            session.flush()

            session.add(
                TrazabilidadProcesadoDB(
                    palet_origen_id=palet_origen.id,
                    palet_destino_id=palet_destino.id,
                )
            )

            palet_origen.consumido = float(palet_origen.consumido or 0) + cubicaje_total
            session.add(palet_origen)
            session.commit()
            session.refresh(palet_origen)
            session.refresh(palet_destino)

            self.maestros.palets[palet_origen.id] = PaletDTO.from_db(palet_origen)
            self.maestros.palets[palet_destino.id] = PaletDTO.from_db(palet_destino)

            return {
                "ok": True,
                "origen": PaletDTO.from_db(palet_origen).model_dump(),
                "destino": PaletDTO.from_db(palet_destino).model_dump(),
                "cubicaje_procesado": cubicaje_total,
            }

    def eliminar_trazabilidad_fabricacion(self, data):
        trazabilidad_id = data.get("id")
        if not trazabilidad_id:
            raise ValueError("id es obligatorio.")
        with DB.crear_sesion() as session:
            trazabilidad = session.get(TrazabilidadFabricacionDB, trazabilidad_id)
            if not trazabilidad:
                raise ValueError("Registro no encontrado.")
            if trazabilidad.cantidad_fabricada and trazabilidad.cantidad_fabricada > 0:
                raise ValueError("No se puede eliminar con cantidad > 0.")
            session.delete(trazabilidad)
            session.commit()
            return {"id": trazabilidad_id}

    def actualizar_estado_trazabilidad_fabricacion(self, data):
        trazabilidad_id = data.get("id")
        estado = data.get("estado", 0)
        if not trazabilidad_id:
            raise ValueError("id es obligatorio.")
        with DB.crear_sesion() as session:
            trazabilidad = session.get(TrazabilidadFabricacionDB, trazabilidad_id)
            if not trazabilidad:
                raise ValueError("Registro no encontrado.")
            trazabilidad.estado = int(estado)
            session.add(trazabilidad)
            session.commit()
            session.refresh(trazabilidad)
            return {
                "id": trazabilidad.id,
                "estado": trazabilidad.estado,
            }

    def actualizar_estado_lote_fabricacion_compartida(self, data):
        linea_id = int(data.get("fabricacion_semanal_id") or 0)
        lote = self._normalizar_lote_traza(data.get("lote"))
        estado = int(data.get("estado"))
        if not linea_id or not lote or estado not in (0, 1):
            raise ValueError("Fabricación semanal, lote y estado válidos son obligatorios.")

        with DB.crear_sesion() as session:
            with session.begin():
                linea = session.exec(
                    select(FabricacionSemanalDB).where(FabricacionSemanalDB.id == linea_id).with_for_update()
                ).first()
                if not linea:
                    raise ValueError("Línea de fabricación no encontrada.")
                trazas = session.exec(select(TrazabilidadFabricacionDB)).all()
                # Antes se incluían todos los palets trazados, incluso los de otras fabricaciones finalizadas:
                # palet_ids = {int(traza.palet_id) for traza in trazas if traza.palet_id}
                palet_ids = self._palets_elegibles_fabricacion_compartida(session, trazas, linea_id)
                palets = session.exec(select(PaletDB).where(PaletDB.id.in_(palet_ids))).all() if palet_ids else []
                palets_lote = [
                    palet for palet in palets
                    if self._extraer_prefijo_lote(palet.codigo) == lote
                ]
                if not palets_lote:
                    raise ValueError("No hay palets en trazabilidad para el lote seleccionado.")

                propias = {}
                for traza in trazas:
                    if traza.fabricacion_semanal_id == linea_id and traza.palet_id:
                        propias.setdefault(int(traza.palet_id), []).append(traza)
                for palet in palets_lote:
                    trazas_propias = propias.get(int(palet.id), [])
                    if trazas_propias:
                        for propia in trazas_propias:
                            propia.estado = estado
                            session.add(propia)
                    elif estado == 0:
                        session.add(TrazabilidadFabricacionDB(
                            fabricacion_semanal_id=linea_id,
                            palet_id=palet.id,
                            cantidad_fabricada=0,
                            estado=0,
                        ))
            return {"fabricacion_semanal_id": linea_id, "lote": lote, "estado": estado}

    def imprimir_etiqueta_fabricacion(self, data, ws=None):
        trazabilidad_ids = data.get("trazabilidad_ids") or []
        fabricacion_semanal_id = data.get("fabricacion_semanal_id")
        lotes = data.get("lotes") or []
        tipo = data.get("tipo") or "BOTA"
        cantidad_etiquetas = int(data.get("cantidad_etiquetas") or 1)
        operarios_ids_input = data.get("operarios_ids") or []
        batidero = data.get("batidero")
        palet_tapas_id = int(data.get("palet_tapas_id") or 0)
        if not isinstance(operarios_ids_input, list):
            operarios_ids_input = [operarios_ids_input]
        operarios_ids_producto = self._normalizar_ids_operarios(operarios_ids_input)
        operarios_ids_codigo = list(operarios_ids_producto)
        batidero_id = None
        codigos_batidero_validos = {11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43, 51, 52, 53}
        try:
            if batidero is not None and batidero != "":
                batidero_id = int(batidero)
        except (TypeError, ValueError):
            batidero_id = None
        if batidero_id is not None and batidero_id not in codigos_batidero_validos:
            raise ValueError("Codigo de batidero invalido. Valores permitidos: 11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43, 51, 52, 53.")
        if batidero_id is not None:
            if operarios_ids_codigo:
                resto = [op for op in operarios_ids_codigo[1:] if op != batidero_id]
                operarios_ids_codigo = [operarios_ids_codigo[0], batidero_id] + resto
            else:
                operarios_ids_codigo = [batidero_id]

        lotes_normalizados = [self._normalizar_lote_traza(lote) for lote in (lotes or [])]
        lotes_normalizados = [lote for lote in lotes_normalizados if lote]

        if tipo == "BOTA":
            if not fabricacion_semanal_id:
                raise ValueError("fabricacion_semanal_id es obligatorio.")
            if not palet_tapas_id:
                raise ValueError("Debe seleccionar un origen de tapas.")
            if not isinstance(lotes, list) or not lotes_normalizados:
                raise ValueError("Debe seleccionar al menos un lote.")
            if batidero_id is None:
                raise ValueError("batidero es obligatorio para fabricar botas.")
            if not operarios_ids_producto:
                raise ValueError("Debe indicar al menos un operario para fabricar botas.")
        elif not trazabilidad_ids:
            raise ValueError("No hay trazabilidades activas.")
        if cantidad_etiquetas < 1:
            raise ValueError("cantidad_etiquetas debe ser mayor o igual a 1.")

        with DB.crear_sesion() as session:
            try:
                with session.begin():
                    if operarios_ids_producto:
                        ids_existentes = set(session.exec(
                            select(UsuarioDB.id).where(UsuarioDB.id.in_(operarios_ids_producto))
                        ).all())
                        operarios_ids_producto = [op for op in operarios_ids_producto if op in ids_existentes]
                    if tipo == "BOTA" and not operarios_ids_producto:
                        raise ValueError("No hay operarios validos para fabricar botas.")

                    trazas = []
                    palet_codigos = []
                    linea_ref = None
                    produccion_id = None
                    grupos_trazas_palets_lote = []

                    if tipo == "BOTA":
                        linea_ref = session.get(FabricacionSemanalDB, int(fabricacion_semanal_id))
                        if not linea_ref:
                            raise ValueError("Linea de fabricacion no encontrada.")
                        produccion_id = linea_ref.id
                        grupos_trazas_palets_lote = self._obtener_trazas_palets_por_lotes(
                            session,
                            int(fabricacion_semanal_id),
                            lotes_normalizados,
                            # Código anterior: incluir_huerfanas=True,
                            incluir_huerfanas=False,
                        )
                        # Código anterior, conservado para revertir:
                        # for grupo in grupos_trazas_palets_lote:
                        #     for traza, _palet in grupo["trazas_palets"]:
                        #         if traza.fabricacion_semanal_id is None:
                        #             traza.fabricacion_semanal_id = int(fabricacion_semanal_id)
                        #             session.add(traza)
                        trazas = [
                            traza
                            for grupo in grupos_trazas_palets_lote
                            for traza, _palet in grupo["trazas_palets"]
                        ]
                        palet_codigos = [
                            palet.codigo
                            for grupo in grupos_trazas_palets_lote
                            for _traza, palet in grupo["trazas_palets"]
                            if palet.codigo
                        ]
                    else:
                        trazas = session.exec(
                            select(TrazabilidadFabricacionDB).where(
                                TrazabilidadFabricacionDB.id.in_(trazabilidad_ids)
                            )
                        ).all()

                        if not trazas:
                            raise ValueError("Trazabilidades no encontradas.")

                        for t in trazas:
                            if t.estado != 0:
                                raise ValueError("Hay trazabilidades no activas.")

                        if not palet_codigos:
                            palet_ids = [t.palet_id for t in trazas]
                            palets = session.exec(select(PaletDB).where(PaletDB.id.in_(palet_ids))).all()
                            palet_map = {p.id: p.codigo for p in palets}
                            palet_codigos = [palet_map.get(t.palet_id, "") for t in trazas]

                        if trazas:
                            linea_ref = session.get(FabricacionSemanalDB, trazas[0].fabricacion_semanal_id)
                            if linea_ref:
                                produccion_id = linea_ref.id

                    codigos_generados = []
                    ultimo_producto_id = None
                    consumo_duela = 0.0
                    consumo_fondos = 0.0
                    consumos_fleje = []
                    if tipo == "BOTA" and linea_ref:
                        consumo_duela, consumo_fondos, consumos_fleje = self._obtener_receta_bota(session, linea_ref.tipo_producto_id)
                    palet_tapas = None
                    if tipo == "BOTA" and palet_tapas_id:
                        palet_tapas = session.get(PaletDB, palet_tapas_id)
                        if not palet_tapas or not str(palet_tapas.codigo or "").endswith("#tapas") or not palet_tapas.procesado:
                            raise ValueError("El origen de tapas seleccionado no es válido.")

                    lotes_origenes = lotes_normalizados if tipo == "BOTA" else palet_codigos

                    for _ in range(cantidad_etiquetas):
                        codigo = self._generar_codigo_producto(session, trazas, lotes_origenes, operarios_ids_codigo)
                        logger.info("Etiqueta fabricacion: codigo=%s origenes=%s", codigo, palet_codigos)
                        codigos_generados.append(codigo)

                        producto = ProductoDB(
                            tipo=tipo,
                            codigo=codigo,
                            tipo_producto_id=linea_ref.tipo_producto_id if linea_ref else None,
                            material_id=linea_ref.material_id if linea_ref else None,
                            tostado_id=linea_ref.tostado_id if linea_ref else None,
                            produccion_id=produccion_id,
                            estado=1,
                        )
                        session.add(producto)
                        session.flush()
                        session.refresh(producto)
                        ultimo_producto_id = producto.id

                        trazas_producto = list(trazas)
                        if tipo == "BOTA" and linea_ref:
                            trazas_producto = self._consumir_duela_bota_desde_trazas(
                                session,
                                grupos_trazas_palets_lote,
                                consumo_duela,
                            )
                            if palet_tapas:
                                self._consumir_tapas_bota(session, palet_tapas, consumo_fondos)
                            for consumo_fleje in consumos_fleje:
                                self._consumir_flejes_seleccionados(
                                    session,
                                    int(consumo_fleje.consumible_id),
                                    float(consumo_fleje.consumo or 0),
                                )

                        for operario_id in operarios_ids_producto:
                            session.add(
                                ProductoOperarioDB(
                                    producto_id=producto.id,
                                    usuario_id=operario_id,
                                    codigo_batidero=batidero_id if tipo == "BOTA" else None,
                                )
                            )

                        for t in trazas_producto:
                            session.add(TrazabilidadProductoDB(trazabilidad_fabricacion_id=t.id, producto_id=producto.id))
                    if linea_ref:
                        linea_ref.cantidad_fabricada = int(linea_ref.cantidad_fabricada or 0) + cantidad_etiquetas
                        session.add(linea_ref)
                        if linea_ref.pedido_id:
                            pedido = session.get(PedidoDB, int(linea_ref.pedido_id))
                            if pedido:
                                pedido.cantidad_fabricada = int(pedido.cantidad_fabricada or 0) + cantidad_etiquetas
                                session.add(pedido)
            except Exception as exc:
                session.rollback()
                logger.error("Error al crear etiqueta: %s", exc)
                try:
                    import asyncio
                    from servidor.conexiones.broadcast import broadcast_error

                    asyncio.run(
                        broadcast_error(
                            "No se pudo crear la etiqueta. Revisa los datos e intentalo de nuevo.",
                            scope="cliente" if ws is not None else "all",
                            target_ws=ws,
                        )
                    )
                except Exception:
                    pass
                raise

            threading.Thread(
                target=self._imprimir_etiquetas_async,
                args=(codigos_generados, palet_codigos, ws),
                daemon=True,
            ).start()

            return {
                "producto_id": ultimo_producto_id,
                "codigo": codigos_generados[-1] if codigos_generados else "",
                "codigos": codigos_generados,
                "cantidad": cantidad_etiquetas,
            }

    def _imprimir_etiqueta_async(self, codigo: str, origenes: list[str], ws=None):
        self._imprimir_etiquetas_async([codigo], origenes, ws)

    def _imprimir_etiquetas_async(self, codigos: list[str], origenes: list[str], ws=None):
        try:
            impresora = ImprimirEtiqueta()
            etiqueta = ""
            for codigo in codigos:
                etiqueta = etiqueta + impresora.obtener_etiqueta("botas", codigo, copies=1)
                #impresora.imprimir_etiqueta("botas", codigo, copies=1)
            impresora.imprimir_zpl(etiqueta)
            try:
                import asyncio

                #si error, probar await broadcast_event(...) sin asyncio.run
                # o asyncio.create_task(broadcast_event(...)) si ya estamos dentro de un loop
                asyncio.run(
                    broadcast_event(
                        "async_print",
                        {"codigo": codigos, "origenes": origenes, "tipo": "botas"},
                        scope="cliente" if ws is not None else "all",
                        target_ws=ws,
                    )
                )
            except Exception:
                pass
        except Exception as exc:
            msg = f"Fallo al imprimir etiquetas {codigos} (origenes: {origenes}): {exc}"
            logger.error(msg)
            try:
                import asyncio

                asyncio.run(
                    broadcast_error(
                        msg,
                        scope="cliente" if ws is not None else "all",
                        target_ws=ws,
                    )
                )
            except Exception:
                pass

    def _construir_codigo_base(self, codigos):
        codigos = [c for c in codigos if c]
        if not codigos:
            raise ValueError("Codigos de palet vacios.")
        base = codigos[0]
        sep = "-"
        if len(codigos) > 1:
            sep = "X"
        return base, sep

    def _normalizar_ids_operarios(self, ids):
        vistos = set()
        normalizados = []
        for op in ids or []:
            try:
                op_id = int(op)
            except (TypeError, ValueError):
                continue
            if op_id in vistos:
                continue
            vistos.add(op_id)
            normalizados.append(op_id)
        return normalizados

    def _normalizar_lote_traza(self, lote: str | None) -> str:
        return str(lote or "").strip()[:8]

    def _obtener_trazas_palets_por_lote(self, session, fabricacion_semanal_id: int, lote: str, incluir_huerfanas: bool = False):
        lote_normalizado = self._normalizar_lote_traza(lote)
        if not lote_normalizado:
            raise ValueError("No se pudo determinar el lote seleccionado.")

        statement = (
            select(TrazabilidadFabricacionDB)
            .where(TrazabilidadFabricacionDB.estado == 0)
            .order_by(TrazabilidadFabricacionDB.id)
        )
        if incluir_huerfanas:
            statement = statement.where(
                or_(
                    TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id,
                    TrazabilidadFabricacionDB.fabricacion_semanal_id.is_(None),
                )
            )
        else:
            statement = statement.where(TrazabilidadFabricacionDB.fabricacion_semanal_id == fabricacion_semanal_id)
        trazas = session.exec(statement).all()
        if not trazas:
            raise ValueError("No hay trazabilidades activas para la linea seleccionada.")

        palet_ids = [t.palet_id for t in trazas if t.palet_id]
        palets = session.exec(
            select(PaletDB)
            .where(PaletDB.id.in_(palet_ids))
            .order_by(PaletDB.codigo, PaletDB.id)
            # Código anterior: sin .with_for_update()
            .with_for_update()
        ).all() if palet_ids else []
        palets_por_id = {p.id: p for p in palets}

        resultado = []
        for traza in trazas:
            palet = palets_por_id.get(traza.palet_id)
            if not palet:
                continue
            if self._extraer_prefijo_lote(palet.codigo) != lote_normalizado:
                continue
            resultado.append((traza, palet))

        if not resultado:
            raise ValueError("No hay palets en trazabilidad para el lote seleccionado.")

        resultado.sort(key=lambda item: ((item[1].codigo or ""), int(item[1].id or 0), int(item[0].id or 0)))
        return lote_normalizado, resultado

    def _obtener_trazas_palets_por_lotes(self, session, fabricacion_semanal_id: int, lotes: list[str], incluir_huerfanas: bool = False):
        lotes_normalizados = []
        vistos = set()
        for lote in lotes or []:
            lote_normalizado = self._normalizar_lote_traza(lote)
            if not lote_normalizado or lote_normalizado in vistos:
                continue
            vistos.add(lote_normalizado)
            lotes_normalizados.append(lote_normalizado)

        if not lotes_normalizados:
            raise ValueError("No se pudo determinar el lote seleccionado.")

        resultado = []
        for lote_normalizado in lotes_normalizados:
            _, trazas_lote = self._obtener_trazas_palets_por_lote(
                session,
                fabricacion_semanal_id,
                lote_normalizado,
                incluir_huerfanas=incluir_huerfanas,
            )
            resultado.append({
                "lote": lote_normalizado,
                "trazas_palets": trazas_lote,
            })

        return resultado

    def _obtener_receta_bota(self, session, tipo_producto_id: int):
        consumos = session.exec(
            select(ConsumoDB).where(ConsumoDB.bota_id == tipo_producto_id).order_by(ConsumoDB.id)
        ).all()
        if not consumos:
            raise ValueError("La bota no tiene receta de consumos.")

        consumible_ids = {c.consumible_id for c in consumos if c.consumible_id}
        tipos_db = session.exec(
            select(TipoProductoDB).where(TipoProductoDB.id.in_(consumible_ids))
        ).all() if consumible_ids else []
        tipos_por_id = {tp.id: str(tp.tipo or "").upper() for tp in tipos_db}

        consumos_duela = [c for c in consumos if tipos_por_id.get(c.consumible_id) == "DUELA"]
        consumos_fondos = [c for c in consumos if tipos_por_id.get(c.consumible_id) in ("FONDO", "FONDOS")]
        consumos_fleje = [c for c in consumos if tipos_por_id.get(c.consumible_id) == "FLEJE"]

        consumo_duela = sum(float(c.consumo or 0) for c in consumos_duela)
        consumo_fondos = sum(float(c.consumo or 0) for c in consumos_fondos)
        if consumo_duela <= 0:
            raise ValueError("La bota no tiene un consumo de DUELA mayor que cero en Consumos.")
        if consumo_fondos <= 0:
            raise ValueError("La bota no tiene un consumo de FONDO mayor que cero en Consumos para descontar tapas.")

        # if len(consumos_duela) != 1:
        #     raise ValueError("La receta de la bota debe tener exactamente una duela.")
        # if len(consumos_fleje) != 2:
        #     raise ValueError("La receta de la bota debe tener exactamente dos flejes.")

        return consumo_duela, consumo_fondos, consumos_fleje

    def _consumir_tapas_bota(self, session, palet_tapas: PaletDB, consumo_fondos: float):
        palet_tapas.consumido = float(palet_tapas.consumido or 0) + 2 * consumo_fondos
        if float(palet_tapas.consumido or 0) >= float(palet_tapas.cubicaje or 0):
            palet_tapas.estado = 2
        session.add(palet_tapas)

    def _consumir_duela_bota_desde_trazas(self, session, grupos_trazas_palets, consumo_unitario: float):
        if not grupos_trazas_palets:
            raise ValueError("No hay trazas de lote para consumir duela.")

        trazas_usadas = []
        grupos_validos = [grupo for grupo in (grupos_trazas_palets or []) if grupo.get("trazas_palets")]
        if not grupos_validos:
            raise ValueError("No hay trazas de lote para consumir duela.")

        consumo_por_lote = float(consumo_unitario or 0) / len(grupos_validos)

        for grupo in grupos_validos:
            pendiente = consumo_por_lote
            ultima_traza = None
            ultimo_palet = None
            primera_traza_consumida = None

            for traza, palet in grupo["trazas_palets"]:
                ultima_traza = traza
                ultimo_palet = palet
                if pendiente <= 0:
                    break

                restante = float(palet.cubicaje or 0) - float(palet.consumido or 0)
                if restante <= 0:
                    continue

                if primera_traza_consumida is None:
                    traza.cantidad_fabricada = int(traza.cantidad_fabricada or 0) + 1
                    session.add(traza)
                    primera_traza_consumida = traza
                    trazas_usadas.append(traza)
                elif all(t.id != traza.id for t in trazas_usadas):
                    trazas_usadas.append(traza)

                delta = min(restante, pendiente)
                palet.consumido = float(palet.consumido or 0) + delta
                if float(palet.consumido or 0) >= float(palet.cubicaje or 0):
                    palet.estado = 2
                session.add(palet)

                pendiente -= delta

            if pendiente > 0:
                if ultima_traza is None or ultimo_palet is None:
                    raise ValueError("No se pudo determinar el ultimo palet del lote.")
                if primera_traza_consumida is None:
                    ultima_traza.cantidad_fabricada = int(ultima_traza.cantidad_fabricada or 0) + 1
                    session.add(ultima_traza)
                    primera_traza_consumida = ultima_traza
                    trazas_usadas.append(ultima_traza)
                elif all(t.id != ultima_traza.id for t in trazas_usadas):
                    trazas_usadas.append(ultima_traza)

                ultimo_palet.consumido = float(ultimo_palet.consumido or 0) + pendiente
                if float(ultimo_palet.consumido or 0) >= float(ultimo_palet.cubicaje or 0):
                    ultimo_palet.estado = 2
                session.add(ultimo_palet)

        return trazas_usadas

    def _consumir_palets_en_orden(self, session, palets: list[PaletDB], consumo_total: float):
        if not palets:
            raise ValueError("No hay palets disponibles para aplicar el consumo.")

        pendiente = float(consumo_total or 0)
        for idx, palet in enumerate(palets):
            if pendiente <= 0:
                break
            es_ultimo = idx == len(palets) - 1
            disponible = float(palet.cubicaje or 0) - float(palet.consumido or 0)
            delta = pendiente if es_ultimo else min(max(disponible, 0.0), pendiente)
            palet.consumido = float(palet.consumido or 0) + delta
            if not es_ultimo and float(palet.consumido or 0) >= float(palet.cubicaje or 0):
                palet.estado = 2
            session.add(palet)
            pendiente -= delta

    def _consumir_flejes_seleccionados(self, session, tipo_producto_id: int, consumo_total: float):
        entradas = session.exec(
            select(EntradaFlejeDB)
            .where(EntradaFlejeDB.is_deleted == False)
            .where(EntradaFlejeDB.estado == 1)
            .where(EntradaFlejeDB.tipo_producto_id == tipo_producto_id)
            .order_by(EntradaFlejeDB.fecha, EntradaFlejeDB.id)
        ).all()
        if not entradas:
            raise ValueError(f"No hay flejes seleccionados para el tipo {tipo_producto_id}.")

        pendiente = float(consumo_total or 0)
        for idx, entrada in enumerate(entradas):
            if pendiente <= 0:
                break
            es_ultima = idx == len(entradas) - 1
            disponible = float(entrada.peso or 0) - float(entrada.consumido or 0)
            delta = pendiente if es_ultima else min(max(disponible, 0.0), pendiente)
            entrada.consumido = float(entrada.consumido or 0) + delta
            entrada.restante = float(entrada.peso or 0) - float(entrada.consumido or 0)
            if not es_ultima and float(entrada.consumido or 0) >= float(entrada.peso or 0):
                entrada.estado = 2
            session.add(entrada)

            pendiente -= delta

    def _extraer_prefijo_lote(self, palet_codigo: str | None) -> str:
        if not palet_codigo:
            return ""
        # Para los codigos de palet tipo "lote#000001" tomamos solo la parte lote.
        texto = str(palet_codigo).split("#", 1)[0]
        return texto[:8]

    def _formatear_operarios(self, operarios_ids: list[int]) -> str:
        op1 = operarios_ids[0] if len(operarios_ids) > 0 else None
        op2 = operarios_ids[1] if len(operarios_ids) > 1 else None
        part1 = f"{int(op1) % 100:02d}" if op1 is not None else "00"
        part2 = f"{int(op2) % 100:02d}" if op2 is not None else "00"
        return f"{part1}{part2}"

    def _siguiente_contador_anual(self, session, year_two: str, sep: str) -> int:
        like_pattern = f"%{sep}{year_two}_______"
        statement = select(ProductoDB.codigo).where(ProductoDB.codigo.like(like_pattern))
        codigos = session.exec(statement).all()
        max_cont = 0
        sufijo_len = len(sep) + 2 + 2 + 5
        for codigo in codigos:
            if not codigo or len(codigo) < sufijo_len:
                continue
            tail = codigo[-sufijo_len:]
            if not tail.startswith(f"{sep}{year_two}") or not tail[-5:].isdigit():
                continue
            cont = int(tail[-5:])
            if cont > max_cont:
                max_cont = cont
        return max_cont + 1

    def _siguiente_contador_global_palets(self, session) -> int:
        codigos = session.exec(select(PaletDB.codigo)).all()
        patron = re.compile(r"#(\d{6})$")
        max_cont = 0
        for codigo in codigos:
            if not codigo:
                continue
            m = patron.search(str(codigo))
            if not m:
                continue
            cont = int(m.group(1))
            if cont > max_cont:
                max_cont = cont
        return max_cont + 1

    def siguiente_codigo_palet(self, data):
        lote = (data.get("lote") or "").strip()
        palet_codigo = data.get("palet_codigo")
        prefijo = lote or self._extraer_prefijo_lote(palet_codigo)
        if not prefijo:
            raise ValueError("No se pudo determinar el prefijo del lote.")

        with DB.crear_sesion() as session:
            contador = self._siguiente_contador_global_palets(session)
            codigo_nuevo = f"{prefijo}#{contador:06d}"
            while session.exec(select(PaletDB).where(PaletDB.codigo == codigo_nuevo)).first():
                contador += 1
                codigo_nuevo = f"{prefijo}#{contador:06d}"
            return {"codigo": codigo_nuevo, "prefijo": prefijo, "contador": contador}

    def _generar_codigo_producto(self, session, trazas, lotes_origenes, operarios_ids: list[int]) -> str:
        sep = "X" if len([c for c in (lotes_origenes or []) if c]) > 1 else "-"

        prefijo_lote = ""
        if lotes_origenes:
            prefijo_lote = lotes_origenes[0]
        else:
            palet_id = trazas[0].palet_id if trazas else None
            if palet_id:
                palet = session.get(PaletDB, palet_id)
                if palet:
                    prefijo_lote = self._extraer_prefijo_lote(palet.codigo)

        operarios_part = self._formatear_operarios(operarios_ids)
        year_two = str(date.today().year % 100).zfill(2)
        month_two = str(date.today().month).zfill(2)
        contador = self._siguiente_contador_anual(session, year_two, sep)

        return f"{prefijo_lote}{operarios_part}{sep}{year_two}{month_two}{contador:05d}"

    def inventario_duelas(self) -> dict:
        with DB.crear_sesion() as session:
            stmt = (
                select(
                    PaletDB.tipo_producto_id,
                    TipoProductoDB.descripcion,
                    PaletDB.material_id,
                    MaterialDB.descripcion,
                    UbicacionDB.id,
                    UbicacionDB.descripcion,
                    func.count(PaletDB.id).label("total_palets"),
                    func.coalesce(func.sum(PaletDB.cubicaje), 0).label("total_cubicaje"),
                    func.coalesce(func.sum(PaletDB.consumido), 0).label("total_consumido"),
                    func.coalesce(func.sum(PaletDB.cubicaje - PaletDB.consumido), 0).label("total_restante"),
                )
                .select_from(PaletDB)
                .join(TipoProductoDB, TipoProductoDB.id == PaletDB.tipo_producto_id, isouter=True)
                .join(MaterialDB, MaterialDB.id == PaletDB.material_id, isouter=True)
                .join(UbicacionDB, UbicacionDB.id == PaletDB.ubicacion_id, isouter=True)
                .where(PaletDB.procesado == False)
                .where(func.upper(TipoProductoDB.tipo) == "DUELA")
                .group_by(
                    PaletDB.tipo_producto_id,
                    TipoProductoDB.descripcion,
                    PaletDB.material_id,
                    MaterialDB.descripcion,
                    UbicacionDB.id,
                    UbicacionDB.descripcion,
                )
                .order_by(TipoProductoDB.descripcion, MaterialDB.descripcion, UbicacionDB.descripcion)
            )
            rows = session.exec(stmt).all()

            return {
                "palets_por_tipo_material_ubicacion": [
                    {
                        "tipo_producto_id": row[0],
                        "tipo_producto": row[1] or "Sin tipo",
                        "material_id": row[2],
                        "material": row[3] or "Sin material",
                        "ubicacion_id": row[4],
                        "ubicacion": row[5] or "Sin ubicación",
                        "total_palets": int(row[6] or 0),
                        "total_cubicaje": float(row[7] or 0),
                        "total_consumido": float(row[8] or 0),
                        "total_restante": float(row[9] or 0),
                    }
                    for row in rows
                ],
            }

    def inventario_flejes(self) -> dict:
        with DB.crear_sesion() as session:
            stmt = (
                select(
                    EntradaFlejeDB.id,
                    EntradaFlejeDB.fecha,
                    EntradaFlejeDB.tipo_producto_id,
                    TipoProductoDB.tipo,
                    TipoProductoDB.descripcion,
                    EntradaFlejeDB.lote,
                    EntradaFlejeDB.peso,
                    EntradaFlejeDB.consumido,
                    (EntradaFlejeDB.peso - EntradaFlejeDB.consumido).label("restante_calc"),
                    EntradaFlejeDB.estado,
                    EntradaFlejeDB.created_at,
                    EntradaFlejeDB.updated_at,
                    EntradaFlejeDB.deleted_at,
                    EntradaFlejeDB.is_deleted,
                    EntradaFlejeDB.created_by,
                    EntradaFlejeDB.updated_by,
                    EntradaFlejeDB.deleted_by,
                )
                .select_from(EntradaFlejeDB)
                .join(TipoProductoDB, TipoProductoDB.id == EntradaFlejeDB.tipo_producto_id, isouter=True)
                .where(EntradaFlejeDB.is_deleted == False)
                .order_by(EntradaFlejeDB.fecha.desc(), EntradaFlejeDB.id.desc())
            )
            rows = session.exec(stmt).all()

            return {
                "inventario_flejes": [
                    {
                        "id": row[0],
                        "fecha": row[1].isoformat() if row[1] else None,
                        "tipo_producto_id": row[2],
                        "tipo_producto_tipo": row[3] or "",
                        "tipo_producto_descripcion": row[4] or "",
                        "tipo_producto_consumo": 0.0,
                        "lote": row[5] or "",
                        "peso": float(row[6] or 0),
                        "consumido": float(row[7] or 0),
                        "restante": float(row[8] or 0),
                        "estado": int(row[9] or 0),
                        "created_at": row[10].isoformat() if row[10] else None,
                        "updated_at": row[11].isoformat() if row[11] else None,
                        "deleted_at": row[12].isoformat() if row[12] else None,
                        "is_deleted": bool(row[13]),
                        "created_by": row[14] or "",
                        "updated_by": row[15] or "",
                        "deleted_by": row[16] or "",
                    }
                    for row in rows
                ]
            }

    def listar_asistencias_mensuales(self, año: int | None, mes: int | None) -> dict:
        año_num = int(año or 0)
        mes_num = int(mes or 0)
        if año_num <= 0 or mes_num < 1 or mes_num > 12:
            raise ValueError("Mes o año no válidos.")

        ultimo_dia = monthrange(año_num, mes_num)[1]
        fecha_inicio = date(año_num, mes_num, 1)
        fecha_fin = date(año_num, mes_num, ultimo_dia)

        with DB.crear_sesion() as session:
            detalles = session.exec(
                select(CuadranteDetalleDB).where(
                    CuadranteDetalleDB.fecha >= fecha_inicio,
                    CuadranteDetalleDB.fecha <= fecha_fin,
                )
            ).all()
            dias_festivos = session.exec(
                select(DiaFestivoDB).where(
                    DiaFestivoDB.fecha >= fecha_inicio,
                    DiaFestivoDB.fecha <= fecha_fin,
                )
            ).all()

            usuarios = self.repo_usuarios.list_all(session)
            puestos = self.repo_puestos_trabajo.list_all(session)

        usuarios_por_id = {int(usuario.id): usuario for usuario in usuarios if usuario.id}
        puestos_por_id = {int(puesto.id): puesto for puesto in puestos if puesto.id}

        conteos_por_usuario: dict[int, dict] = {}
        puestos_listado_en_datos: set[int] = set()

        for detalle in detalles:
            usuario_id = int(detalle.usuario_id or 0)
            puesto_id = int(detalle.puesto_id or 0)
            if not usuario_id or not puesto_id:
                continue

            puesto = puestos_por_id.get(puesto_id)
            if puesto is None:
                continue

            fila = conteos_por_usuario.setdefault(usuario_id, {
                "asistencia_fechas": set(),
                "puestos": {},
            })

            if bool(getattr(puesto, "listado", False)):
                fila["puestos"][puesto_id] = int(fila["puestos"].get(puesto_id, 0)) + 1
                puestos_listado_en_datos.add(puesto_id)
            else:
                if getattr(detalle, "fecha", None) is not None:
                    fila["asistencia_fechas"].add(detalle.fecha)

        usuarios_incluir: list = []
        for usuario in usuarios:
            if not getattr(usuario, "id", None):
                continue
            if bool(getattr(usuario, "empleado", False)) or int(usuario.id) in conteos_por_usuario:
                usuarios_incluir.append(usuario)

        def ordenar_usuarios(usuario):
            codigo = str(getattr(usuario, "codigo", "") or "").strip()
            nombre = str(getattr(usuario, "nombre", "") or getattr(usuario, "alias", "") or "")
            return (0 if codigo else 1, codigo, nombre.casefold(), int(getattr(usuario, "id", 0) or 0))

        usuarios_incluir.sort(key=ordenar_usuarios)

        puestos_listado = [
            puesto for puesto in puestos
            if getattr(puesto, "id", None)
            and bool(getattr(puesto, "listado", False))
            and (
                bool(getattr(puesto, "activo", True))
                or int(puesto.id) in puestos_listado_en_datos
            )
        ]
        puestos_listado.sort(key=lambda puesto: (
            int(getattr(puesto, "orden", 0) or 0),
            str(getattr(puesto, "nombre", "") or "").casefold(),
            int(getattr(puesto, "id", 0) or 0),
        ))

        festivos_mes = {
            dia.fecha for dia in dias_festivos
            if getattr(dia, "fecha", None) is not None
        }
        dias_laborables = 0
        cursor = fecha_inicio
        while cursor <= fecha_fin:
            if cursor.weekday() < 5 and cursor not in festivos_mes:
                dias_laborables += 1
            cursor += timedelta(days=1)

        filas = []
        for usuario in usuarios_incluir:
            usuario_id = int(usuario.id)
            conteos = conteos_por_usuario.get(usuario_id, {"asistencia_fechas": set(), "puestos": {}})
            filas.append({
                "usuario_id": usuario_id,
                "codigo": getattr(usuario, "codigo", None),
                "alias": getattr(usuario, "alias", None),
                "nombre": getattr(usuario, "nombre", None),
                "asistencia": len(conteos.get("asistencia_fechas", set()) or set()),
                "puestos": {
                    str(puesto.id): int(conteos["puestos"].get(int(puesto.id), 0) or 0)
                    for puesto in puestos_listado
                },
            })

        return {
            "año": año_num,
            "mes": mes_num,
            "fecha_inicio": fecha_inicio.isoformat(),
            "fecha_fin": fecha_fin.isoformat(),
            "dias_laborables": dias_laborables,
            "columnas_puestos": [
                {
                    "id": int(puesto.id),
                    "nombre": str(getattr(puesto, "nombre", "") or f"Puesto {puesto.id}"),
                    "orden": int(getattr(puesto, "orden", 0) or 0),
                }
                for puesto in puestos_listado
            ],
            "filas": filas,
        }
    #endregion

    #region Métodos Cuadrantes
    def obtener_cuadrante_actual(self) -> dict:
        if not self.cuadrantes.cuadrante_actual:
            fecha_inicial = obtener_anterior_dia_semana().isoformat()
            actual = self.obtener_cuadrante(fecha_inicial)
            self.cuadrantes.cuadrante_actual = actual    

    def obtener_cuadrante(self, fecha: str, actualizar_local = False) -> CuadranteDTO:
        with DB.crear_sesion() as session:
            cuadrante = self.repo_cuadrantes.list_by_start_date(session, fecha)
            if cuadrante is None:
                cuadrante = self.insertar_cuadrante(date.fromisoformat(fecha))

            detalles = self.repo_cuadrante_detalles.list_by_cuadrante_id(session, cuadrante.id)

            cuadrante_dto = CuadranteDTO.from_db(cuadrante)
            cuadrante_dto.detalles = [CuadranteDetalleDTO.from_db(det) for det in detalles]
        
            if actualizar_local:
                self.cuadrante = cuadrante_dto

            return cuadrante_dto

    def listar_dias_festivos_rango(self, fecha_inicio: str, fecha_fin: str) -> list[DiaFestivoDTO]:
        if not fecha_inicio or not fecha_fin:
            raise ValueError("fecha_inicio y fecha_fin son requeridas")

        fecha_inicio_dt = date.fromisoformat(str(fecha_inicio))
        fecha_fin_dt = date.fromisoformat(str(fecha_fin))
        if fecha_fin_dt < fecha_inicio_dt:
            raise ValueError("fecha_fin no puede ser anterior a fecha_inicio")

        with DB.crear_sesion() as session:
            dias = self.repo_dias_festivos.list_by_date_range(session, "fecha", fecha_inicio_dt, fecha_fin_dt)
            dias.sort(key=lambda item: (getattr(item, "fecha", None), getattr(item, "id", 0) or 0))
            return [DiaFestivoDTO.from_db(dia) for dia in dias]

    def insertar_cuadrante(self, fecha: date) -> CuadranteDB:
        with DB.crear_sesion() as session:
            DTO = CuadranteDTO(
                id=None,
                fecha_inicio=fecha,
                fecha_fin=fecha + timedelta(days=6),
                titulo="",
                observaciones="",
                detalles=[],
            )
            return self.repo_cuadrantes.insert(session, DTO.to_db())

    def _obtener_fechas_festivas(self, session: Session, fecha_inicio: date, fecha_fin: date) -> set[date]:
        return {
            item.fecha
            for item in self.repo_dias_festivos.list_by_date_range(session, "fecha", fecha_inicio, fecha_fin)
            if getattr(item, "fecha", None) is not None
        }

    def _validar_nueva_asignacion_cuadrante(
        self,
        session: Session,
        *,
        fecha: date,
        puesto_id: int,
        usuario_id: int,
    ) -> None:
        if fecha in self._obtener_fechas_festivas(session, fecha, fecha):
            raise ValueError("No se pueden crear nuevas asignaciones en un día festivo.")

    def insertar_detalle_cuadrante(self, data) -> CuadranteDetalleDTO:
        cuadrante_id = data.get("cuadrante_id")
        fecha = data.get("fecha")
        puesto_id = data.get("puesto_id")
        usuario_id = data.get("usuario_id")
        with DB.crear_sesion() as session:
            fecha_dt = date.fromisoformat(fecha)
            self._validar_nueva_asignacion_cuadrante(
                session,
                fecha=fecha_dt,
                puesto_id=int(puesto_id),
                usuario_id=int(usuario_id),
            )
            DTO = CuadranteDetalleDTO(
                id=None,
                cuadrante_id=cuadrante_id,
                puesto_id=puesto_id,
                fecha=fecha_dt,
                usuario_id=usuario_id,
            )
            return CuadranteDetalleDTO.from_db(self.repo_cuadrante_detalles.insert(session, DTO.to_db()))

    def actualizar_detalle_cuadrante(self, data) -> CuadranteDetalleDTO:
        entrada_id = data.get("id")
        cuadrante_id = data.get("cuadrante_id")
        fecha = data.get("fecha")
        puesto_id = data.get("puesto_id")
        usuario_id = data.get("usuario_id")

        with DB.crear_sesion() as session:
            fecha_dt = date.fromisoformat(fecha)
            self._validar_nueva_asignacion_cuadrante(
                session,
                fecha=fecha_dt,
                puesto_id=int(puesto_id),
                usuario_id=int(usuario_id),
            )
            DTO = CuadranteDetalleDTO(
                id=entrada_id,
                cuadrante_id=cuadrante_id,
                puesto_id=puesto_id,
                fecha=fecha_dt,
                usuario_id=usuario_id,
            )
            updated = CuadranteDetalleDTO.to_db(DTO)
            return CuadranteDetalleDTO.from_db(self.repo_cuadrante_detalles.update(session, updated))

    def eliminar_detalle_cuadrante(self, data):
        id = data.get("id")

        with DB.crear_sesion() as session:
            self.repo_cuadrante_detalles.delete(session, id)
            try:
                session.commit()
            except Exception:
                session.rollback()
                raise
            logger.info(f"Detalle de cuadrante ID {id} eliminado.")
            return {"id": id }

    def limpiar_cuadrante(self, data) -> CuadranteDTO:
        cuadrante_id = data.get("cuadrante_id")

        if not cuadrante_id:
            raise ValueError("cuadrante_id requerido")

        with DB.crear_sesion() as session:
            cuadrante = self.repo_cuadrantes.get(session, cuadrante_id)
            if not cuadrante:
                raise ValueError(f"No existe cuadrante con id {cuadrante_id}")

            detalles = self.repo_cuadrante_detalles.list_by_cuadrante_id(session, cuadrante_id)
            for detalle in detalles:
                session.delete(detalle)

            try:
                session.commit()
            except Exception:
                session.rollback()
                raise

            cuadrante_dto = CuadranteDTO.from_db(cuadrante)
            cuadrante_dto.detalles = []
            return cuadrante_dto

    def clonar_columna_cuadrante(self, data) -> CuadranteDTO:
        cuadrante_id = data.get("cuadrante_id")
        fecha_origen = data.get("fecha_origen")
        fecha_destino = data.get("fecha_destino")
        mantener_datos_destino = bool(data.get("mantener_datos_destino"))

        if not cuadrante_id:
            raise ValueError("cuadrante_id requerido")
        if not fecha_origen or not fecha_destino:
            raise ValueError("fecha_origen y fecha_destino son requeridas")
        if fecha_origen == fecha_destino:
            raise ValueError("fecha_origen y fecha_destino deben ser diferentes")

        fecha_origen_date = date.fromisoformat(fecha_origen)
        fecha_destino_date = date.fromisoformat(fecha_destino)

        with DB.crear_sesion() as session:
            cuadrante = self.repo_cuadrantes.get(session, cuadrante_id)
            if not cuadrante:
                raise ValueError(f"No existe cuadrante con id {cuadrante_id}")

            fechas_festivas = self._obtener_fechas_festivas(
                session,
                min(fecha_origen_date, fecha_destino_date),
                max(fecha_origen_date, fecha_destino_date),
            )
            if fecha_origen_date in fechas_festivas or fecha_destino_date in fechas_festivas:
                raise ValueError("No se puede clonar desde o hacia un día festivo.")

            detalles = self.repo_cuadrante_detalles.list_by_cuadrante_id(session, cuadrante_id)
            detalles_origen = [d for d in detalles if d.fecha == fecha_origen_date]
            detalles_destino = [d for d in detalles if d.fecha == fecha_destino_date]

            if not mantener_datos_destino:
                for det in detalles_destino:
                    session.delete(det)
                detalles_destino = []

            firmas_destino = {(d.puesto_id, d.usuario_id) for d in detalles_destino}
            nuevos_detalles = []
            for det in detalles_origen:
                firma = (det.puesto_id, det.usuario_id)
                if firma in firmas_destino:
                    continue
                firmas_destino.add(firma)
                nuevos_detalles.append(
                    CuadranteDetalleDB(
                        fecha=fecha_destino_date,
                        cuadrante_id=cuadrante_id,
                        puesto_id=det.puesto_id,
                        usuario_id=det.usuario_id,
                        orden_en_puesto=det.orden_en_puesto,
                    )
                )

            if nuevos_detalles:
                session.add_all(nuevos_detalles)

            try:
                session.commit()
            except Exception:
                session.rollback()
                raise

            detalles_actualizados = self.repo_cuadrante_detalles.list_by_cuadrante_id(session, cuadrante_id)
            cuadrante_dto = CuadranteDTO.from_db(cuadrante)
            cuadrante_dto.detalles = [CuadranteDetalleDTO.from_db(det) for det in detalles_actualizados]
            return cuadrante_dto

    def extender_jueves_semana_cuadrante(self, data):
        cuadrante_id = data.get("cuadrante_id")
        fecha_origen = data.get("fecha")

        if not cuadrante_id:
            raise ValueError("cuadrante_id requerido")
        if not fecha_origen:
            raise ValueError("fecha requerida (YYYY-MM-DD)")

        fecha_jueves = date.fromisoformat(str(fecha_origen))
        # Jueves -> Viernes (+1) -> Lunes (+3) -> Martes (+1) -> Miercoles (+1)
        fechas_destino = [
            fecha_jueves + timedelta(days=1),
            fecha_jueves + timedelta(days=4),
            fecha_jueves + timedelta(days=5),
            fecha_jueves + timedelta(days=6),
        ]

        with DB.crear_sesion() as session:
            cuadrante = self.repo_cuadrantes.get(session, cuadrante_id)
            if not cuadrante:
                raise ValueError(f"No existe cuadrante con id {cuadrante_id}")

            fechas_festivas = self._obtener_fechas_festivas(
                session,
                fecha_jueves,
                max(fechas_destino),
            )
            detalles = self.repo_cuadrante_detalles.list_by_cuadrante_id(session, cuadrante_id)
            detalles_jueves = [d for d in detalles if d.fecha == fecha_jueves]
            if not detalles_jueves:
                raise ValueError("El jueves indicado no tiene asignaciones en este cuadrante.")

            puestos = self.repo_puestos_trabajo.list_all(session)
            puestos_batidero = [
                puesto for puesto in puestos
                if str(getattr(puesto, "nombre", "")).strip().upper().startswith("BATIDERO")
            ]
            puestos_batidero.sort(key=lambda p: ((getattr(p, "orden", 0) or 0), (getattr(p, "id", 0) or 0)))
            batidero_ids = [p.id for p in puestos_batidero if p.id is not None]
            batidero_index = {puesto_id: idx for idx, puesto_id in enumerate(batidero_ids)}

            fechas_destino_laborables = [fecha_destino for fecha_destino in fechas_destino if fecha_destino not in fechas_festivas]

            for indice_destino, fecha_destino in enumerate(fechas_destino_laborables):
                # Borrar previamente todo lo del dia destino para este cuadrante
                for det in [d for d in detalles if d.fecha == fecha_destino]:
                    session.delete(det)

                # Insertar copias desde jueves, rotando puestos de batidero.
                # Con 2 puestos mantiene la alternancia previa; con 3 rota sobre los tres.
                nuevos = []
                rotacion = (indice_destino + 1) % len(batidero_ids) if batidero_ids else 0
                for det in detalles_jueves:
                    puesto_destino_id = det.puesto_id
                    idx_origen = batidero_index.get(puesto_destino_id)
                    if idx_origen is not None and rotacion:
                        idx_destino = (idx_origen + rotacion) % len(batidero_ids)
                        puesto_destino_id = batidero_ids[idx_destino]

                    nuevos.append(
                        CuadranteDetalleDB(
                            fecha=fecha_destino,
                            cuadrante_id=cuadrante_id,
                            puesto_id=puesto_destino_id,
                            usuario_id=det.usuario_id,
                            orden_en_puesto=det.orden_en_puesto,
                        )
                    )

                if nuevos:
                    session.add_all(nuevos)

            try:
                session.commit()
            except Exception:
                session.rollback()
                raise

            detalles_actualizados = self.repo_cuadrante_detalles.list_by_cuadrante_id(session, cuadrante_id)
            cuadrante_dto = CuadranteDTO.from_db(cuadrante)
            cuadrante_dto.detalles = [CuadranteDetalleDTO.from_db(det) for det in detalles_actualizados]
            return cuadrante_dto
    #endregion

    #region Métodos Auxiliares
    def obtener_repo(self, tabla):
        if tabla == "clientes":
            repo = self.repo_clientes
            maestro = self.maestros.clientes
            objeto = ClienteDTO
        elif tabla == "estados_pedidos":
            repo = self.repo_estados_pedidos
            maestro = self.maestros.estados_pedidos
            objeto = EstadoPedidoDTO
        elif tabla == "estados_fabricacion_semanal":
            repo = self.repo_estados_fabricacion_semanal
            maestro = self.maestros.estados_fabricacion_semanal
            objeto = EstadoFabricacionSemanalDTO
        elif tabla == "estados_productos":
            repo = self.repo_estados_productos
            maestro = self.maestros.estados_productos
            objeto = EstadoProductoDTO
        elif tabla == "estados_flejes":
            repo = self.repo_estados_flejes
            maestro = self.maestros.estados_flejes
            objeto = EstadoFlejeDTO
        elif tabla == "estados_trazabilidad_fabricacion":
            repo = self.repo_estados_trazabilidad_fabricacion
            maestro = self.maestros.estados_trazabilidad_fabricacion
            objeto = EstadoTrazabilidadFabricacionDTO
        elif tabla == "estados_palets":
            repo = self.repo_estados_palets
            maestro = self.maestros.estados_palets
            objeto = EstadoPaletDTO
        elif tabla == "instalaciones":
            repo = self.repo_instalaciones
            maestro = self.maestros.instalaciones
            objeto = InstalacionDTO
        elif tabla == "puestos_trabajo":
            repo = self.repo_puestos_trabajo
            maestro = self.maestros.puestos_trabajo
            objeto = PuestoTrabajoDTO
        elif tabla == "ubicaciones":
            repo = self.repo_ubicaciones
            maestro = self.maestros.ubicaciones
            objeto = UbicacionDTO
        elif tabla == "proveedores":
            repo = self.repo_proveedores
            maestro = self.maestros.proveedores
            objeto = ProveedorDTO
        elif tabla == "usuarios":
            repo = self.repo_usuarios
            maestro = self.maestros.usuarios
            objeto = UsuarioDTO
        elif tabla == "roles":
            repo = self.repo_roles
            maestro = self.maestros.roles
            objeto = RolDTO
        elif tabla == "planificacion_entradas":
            repo = self.repo_camiones
            maestro = self.planificacion_entradas.buscar_camion_por_id
            objeto = PlanCamionDTO
        elif tabla == "materiales":
            repo = self.repo_materiales_maestro
            maestro = self.maestros.materiales
            objeto = MaterialDTO
        elif tabla == "entradas":
            repo = self.repo_entradas
            maestro = self.maestros.entradas
            objeto = EntradaDTO
        elif tabla == "lineas_entrada":
            repo = self.repo_lineas_entrada
            maestro = self.maestros.lineas_entrada
            objeto = LineaEntradaDTO
        elif tabla == "palets":
            repo = self.repo_palets
            maestro = self.maestros.palets
            objeto = PaletDTO
        elif tabla == "productos":
            repo = self.repo_productos
            maestro = self.maestros.productos
            objeto = ProductoDTO
        elif tabla == "archivos_subidos":
            repo = self.repo_archivos_subidos
            maestro = self.maestros.archivos_subidos
            objeto = ArchivoSubidoDTO
        elif tabla == "ambientes":
            repo = self.repo_ambientes
            maestro = self.maestros.ambientes
            objeto = AmbienteDTO
        elif tabla == "dias_festivos":
            repo = self.repo_dias_festivos
            maestro = self.maestros.dias_festivos
            objeto = DiaFestivoDTO
        elif tabla == "entradas_flejes":
            repo = self.repo_entradas_flejes
            maestro = self.maestros.entradas_flejes
            objeto = EntradaFlejeDTO
        elif tabla == "cubicaje":
            repo = self.repo_cubicaje
            maestro = self.maestros.cubicaje
            objeto = CubicajeDTO
        elif tabla == "tostados":
            repo = self.repo_tostados
            maestro = self.maestros.tostados
            objeto = TostadoDTO
        elif tabla == "pedidos":
            repo = self.repo_pedidos
            maestro = self.fabricacion.pedidos
            objeto = PedidoDTO
        elif tabla == "analiticas":
            repo = self.repo_analiticas
            maestro = self.fabricacion.analiticas
            objeto = AnaliticaDTO
        elif tabla == "tipos_producto":
            repo = self.repo_tipos_producto
            maestro = self.fabricacion.tipos_producto
            objeto = TipoProductoDTO
        elif tabla == "fabricacion_semanal":
            repo = self.repo_fabricacion_semanal
            maestro = self.fabricacion.fabricacion_semanal
            objeto = FabricacionSemanalDTO
        elif tabla == "trazabilidad_procesado":
            repo = self.repo_trazabilidad_procesado
            maestro = self.fabricacion.trazabilidad_procesado
            objeto = TrazabilidadProcesadoDTO
        elif tabla == "trazabilidad_fabricacion":
            repo = self.repo_trazabilidad_fabricacion
            maestro = self.fabricacion.trazabilidad_fabricacion
            objeto = TrazabilidadFabricacionDTO
        elif tabla == "trazabilidad_producto":
            repo = self.repo_trazabilidad_producto
            maestro = self.fabricacion.trazabilidad_producto
            objeto = TrazabilidadProductoDTO
        elif tabla == "consumos":
            repo = self.repo_consumos
            maestro = self.fabricacion.consumos
            objeto = ConsumoDTO
        elif tabla == "plan_materiales":
            repo = self.repo_materiales
            maestro = self.planificacion_entradas.buscar_material_por_id
            objeto = PlanMaterialDTO
        elif tabla == "facturacion":
            repo = self.repo_facturacion
            maestro = self.planificacion_entradas.buscar_facturacion_por_id
            objeto = PlanFacturacionDTO
        elif tabla == "cuadrantes":
            repo = self.repo_cuadrantes
            maestro = None
            objeto = CuadranteDTO
        elif tabla == "cuadrante_detalles":
            repo = self.repo_cuadrante_detalles
            maestro = None
            objeto = CuadranteDetalleDTO
        else:
            raise ValueError(f"Tabla '{tabla}' no reconocida.")

        return repo, maestro, objeto

    #region Operarios Fabricacion (planificacion)
    def _ultimos_dias_laborables(self, dias_previos: int = 3, base: date | None = None) -> List[date]:
        if base is None:
            base = date.today()
        fechas = [base]
        cursor = base
        count = 0
        while count < dias_previos:
            cursor = cursor - timedelta(days=1)
            if cursor.weekday() >= 5:
                continue
            fechas.append(cursor)
            count += 1
        return fechas

    def listar_operarios_planificacion_fabricacion(self, filtros: dict | None = None) -> list:
        filtros = filtros or {}
        dias_previos = int(filtros.get("dias_previos") or 3)
        if dias_previos < 0:
            dias_previos = 0
        incluir_otros = bool(filtros.get("incluir_otros", True))
        puesto_nombre = (filtros.get("puesto_nombre") or "").strip().upper()

        fechas = self._ultimos_dias_laborables(dias_previos=dias_previos)
        fechas_set = set(fechas)
        with DB.crear_sesion() as session:
            consulta_puestos = select(PuestoTrabajoDB)
            if not puesto_nombre:
                consulta_puestos = consulta_puestos.where(PuestoTrabajoDB.fabricacion == True)  # noqa: E712
            puestos = session.exec(consulta_puestos).all()
            if puesto_nombre:
                puestos = [p for p in puestos if (p.nombre or "").strip().upper() == puesto_nombre]
            puestos_map = {p.id: p for p in puestos}
            puestos_ids = list(puestos_map.keys())

            usuarios = session.exec(
                select(UsuarioDB).where(UsuarioDB.empleado == True)  # noqa: E712
            ).all()
            usuarios_map = {u.id: u for u in usuarios}

            detalles = []
            if puestos_ids:
                detalles = session.exec(
                    select(CuadranteDetalleDB).where(
                        CuadranteDetalleDB.puesto_id.in_(puestos_ids),
                        CuadranteDetalleDB.fecha.in_(list(fechas_set)),
                    )
                ).all()

            resultado = []
            usados = set()
            for det in detalles:
                usuario = usuarios_map.get(det.usuario_id)
                if usuario:
                    usados.add(usuario.id)
                resultado.append({
                    "origen": "planificacion",
                    "fecha": det.fecha.isoformat() if det.fecha else None,
                    "puesto_id": det.puesto_id,
                    "puesto_nombre": puestos_map.get(det.puesto_id).nombre if det.puesto_id in puestos_map else None,
                    "usuario_id": det.usuario_id,
                    "usuario": {
                        "id": usuario.id,
                        "alias": usuario.alias,
                        "nombre": usuario.nombre,
                        "rol_id": usuario.rol_id,
                        "empleado": usuario.empleado,
                    } if usuario else None,
                    "orden_en_puesto": det.orden_en_puesto,
                })

            if incluir_otros:
                for usuario in usuarios:
                    if usuario.id in usados:
                        continue
                    resultado.append({
                        "origen": "otros",
                        "fecha": None,
                        "puesto_id": None,
                        "puesto_nombre": None,
                        "usuario_id": usuario.id,
                        "usuario": {
                            "id": usuario.id,
                            "alias": usuario.alias,
                            "nombre": usuario.nombre,
                            "rol_id": usuario.rol_id,
                            "empleado": usuario.empleado,
                        },
                        "orden_en_puesto": None,
                    })

            return resultado

    def listar_botas_diarias(self, fecha: str | None = None):
        fecha_ref = date.today()
        if fecha not in (None, ""):
            fecha_ref = date.fromisoformat(str(fecha))

        with DB.crear_sesion() as session:
            enlaces_operario = session.exec(
                select(ProductoOperarioDB).where(
                    func.date(ProductoOperarioDB.created_at) == fecha_ref
                )
            ).all()
            if not enlaces_operario:
                return []

            producto_ids = sorted({int(item.producto_id) for item in enlaces_operario if item.producto_id})
            productos = session.exec(
                select(ProductoDB).where(ProductoDB.id.in_(producto_ids))
            ).all()
            productos = [
                producto for producto in productos
                if str(getattr(producto, "tipo", "")).strip().upper() == "BOTA"
            ]
            if not productos:
                return []

            productos_por_id = {int(producto.id): producto for producto in productos if producto.id}
            producto_ids = sorted(productos_por_id.keys())

            enlaces_traza = session.exec(
                select(TrazabilidadProductoDB).where(
                    TrazabilidadProductoDB.producto_id.in_(producto_ids)
                )
            ).all()
            traza_ids = sorted({
                int(item.trazabilidad_fabricacion_id)
                for item in enlaces_traza
                if item.trazabilidad_fabricacion_id
            })
            trazas_fabricacion = session.exec(
                select(TrazabilidadFabricacionDB).where(
                    TrazabilidadFabricacionDB.id.in_(traza_ids)
                )
            ).all() if traza_ids else []
            trazas_por_id = {int(item.id): item for item in trazas_fabricacion if item.id}

            palet_ids = sorted({int(item.palet_id) for item in trazas_fabricacion if item.palet_id})
            palets = session.exec(
                select(PaletDB).where(PaletDB.id.in_(palet_ids))
            ).all() if palet_ids else []
            palets_por_id = {int(item.id): item for item in palets if item.id}

            linea_ids = sorted({
                int(producto.produccion_id or 0)
                for producto in productos
                if int(producto.produccion_id or 0) > 0
            } | {
                int(item.fabricacion_semanal_id or 0)
                for item in trazas_fabricacion
                if int(item.fabricacion_semanal_id or 0) > 0
            })
            lineas = session.exec(
                select(FabricacionSemanalDB).where(FabricacionSemanalDB.id.in_(linea_ids))
            ).all() if linea_ids else []
            lineas_por_id = {int(item.id): item for item in lineas if item.id}

            pedido_ids = sorted({int(item.pedido_id) for item in lineas if item.pedido_id})
            pedidos = session.exec(
                select(PedidoDB).where(PedidoDB.id.in_(pedido_ids))
            ).all() if pedido_ids else []
            pedidos_por_id = {int(item.id): item for item in pedidos if item.id}

            tipo_ids = sorted({int(item.tipo_producto_id) for item in lineas if item.tipo_producto_id})
            tipos = session.exec(
                select(TipoProductoDB).where(TipoProductoDB.id.in_(tipo_ids))
            ).all() if tipo_ids else []
            tipos_por_id = {int(item.id): item for item in tipos if item.id}

            material_ids = sorted({int(item.material_id) for item in lineas if item.material_id})
            materiales = session.exec(
                select(MaterialDB).where(MaterialDB.id.in_(material_ids))
            ).all() if material_ids else []
            materiales_por_id = {int(item.id): item for item in materiales if item.id}

            estados = session.exec(select(EstadoProductoDB)).all()
            estados_por_id = {int(item.id): item for item in estados if item.id}

            usuario_ids = sorted({int(item.usuario_id) for item in enlaces_operario if item.usuario_id})
            usuarios = session.exec(
                select(UsuarioDB).where(UsuarioDB.id.in_(usuario_ids))
            ).all() if usuario_ids else []
            usuarios_por_id = {int(item.id): item for item in usuarios if item.id}

            enlaces_operario_por_producto = {}
            for item in enlaces_operario:
                producto_id = int(item.producto_id or 0)
                if producto_id not in productos_por_id:
                    continue
                enlaces_operario_por_producto.setdefault(producto_id, []).append(item)

            trazas_por_producto = {}
            for item in enlaces_traza:
                producto_id = int(item.producto_id or 0)
                traza = trazas_por_id.get(int(item.trazabilidad_fabricacion_id or 0))
                if not traza or producto_id not in productos_por_id:
                    continue
                trazas_por_producto.setdefault(producto_id, []).append(traza)

            items = []
            for producto_id, producto in productos_por_id.items():
                enlaces_producto = enlaces_operario_por_producto.get(producto_id, [])
                if not enlaces_producto:
                    continue

                fecha_creacion = min(
                    (item.created_at for item in enlaces_producto if item.created_at is not None),
                    default=None,
                )
                codigo_batidero = next(
                    (int(item.codigo_batidero) for item in enlaces_producto if item.codigo_batidero not in (None, "")),
                    None,
                )

                operarios = []
                usuarios_vistos = set()
                for item in sorted(
                    enlaces_producto,
                    key=lambda row: ((row.created_at.isoformat() if row.created_at else ""), int(row.usuario_id or 0)),
                ):
                    usuario_id = int(item.usuario_id or 0)
                    if not usuario_id or usuario_id in usuarios_vistos:
                        continue
                    usuarios_vistos.add(usuario_id)
                    usuario = usuarios_por_id.get(usuario_id)
                    operarios.append({
                        "id": usuario_id,
                        "nombre": getattr(usuario, "nombre", None) or getattr(usuario, "alias", None) or f"Operario {usuario_id}",
                    })

                trazas = trazas_por_producto.get(producto_id, [])
                palets_codigo = []
                lotes = []
                palets_vistos = set()
                lotes_vistos = set()
                fabricacion_semanal_id = int(producto.produccion_id or 0)
                for traza in trazas:
                    if not fabricacion_semanal_id:
                        fabricacion_semanal_id = int(traza.fabricacion_semanal_id or 0)
                    palet = palets_por_id.get(int(traza.palet_id or 0))
                    codigo_palet = str(getattr(palet, "codigo", "") or "").strip()
                    if codigo_palet and codigo_palet not in palets_vistos:
                        palets_vistos.add(codigo_palet)
                        palets_codigo.append(codigo_palet)
                    lote = self._normalizar_lote_traza(codigo_palet)
                    if lote and lote not in lotes_vistos:
                        lotes_vistos.add(lote)
                        lotes.append(lote)

                linea = lineas_por_id.get(fabricacion_semanal_id)
                pedido = pedidos_por_id.get(int(getattr(linea, "pedido_id", 0) or 0))
                tipo = tipos_por_id.get(int(getattr(linea, "tipo_producto_id", 0) or 0))
                material = materiales_por_id.get(int(getattr(linea, "material_id", 0) or 0))

                items.append({
                    "producto_id": producto_id,
                    "codigo": str(producto.codigo or "").strip(),
                    "estado": int(producto.estado or 0),
                    "estado_descripcion": getattr(estados_por_id.get(int(producto.estado or 0)), "descripcion", None) or str(int(producto.estado or 0)),
                    "fecha": fecha_creacion.isoformat() if fecha_creacion else None,
                    "codigo_batidero": codigo_batidero,
                    "operarios": operarios,
                    "fabricacion_semanal_id": fabricacion_semanal_id or None,
                    "pedido_id": getattr(pedido, "id", None),
                    "pedido_numero": getattr(pedido, "numero", None),
                    "pedido_descripcion": getattr(pedido, "descripcion", None) or "",
                    "tipo_producto_id": getattr(linea, "tipo_producto_id", None),
                    "tipo_producto_descripcion": getattr(tipo, "descripcion", None) or getattr(tipo, "codigo", None) or "",
                    "material_id": getattr(linea, "material_id", None),
                    "material_descripcion": getattr(material, "descripcion", None) or "",
                    "tostado_id": getattr(linea, "tostado_id", None),
                    "tostado_descripcion": self._descripcion_tostado(getattr(linea, "tostado_id", None)),
                    "palets": palets_codigo,
                    "lotes": lotes,
                })

            items.sort(
                key=lambda item: (
                    str(item.get("fecha") or ""),
                    str(item.get("codigo") or ""),
                ),
                reverse=True,
            )
            return items

    def buscar_botas_por_codigo(self, codigo: str | None = None):
        texto = str(codigo or "").strip()
        if not texto:
            return []

        with DB.crear_sesion() as session:
            productos = session.exec(
                select(ProductoDB).where(
                    ProductoDB.tipo == "BOTA",
                    ProductoDB.codigo.like(f"%{texto}%"),
                )
            ).all()
            productos = [
                producto for producto in productos
                if str(getattr(producto, "tipo", "")).strip().upper() == "BOTA"
            ]
            if not productos:
                return []

            productos_por_id = {int(producto.id): producto for producto in productos if producto.id}
            producto_ids = sorted(productos_por_id.keys())

            enlaces_operario = session.exec(
                select(ProductoOperarioDB).where(
                    ProductoOperarioDB.producto_id.in_(producto_ids)
                )
            ).all()
            enlaces_traza = session.exec(
                select(TrazabilidadProductoDB).where(
                    TrazabilidadProductoDB.producto_id.in_(producto_ids)
                )
            ).all()
            traza_ids = sorted({
                int(item.trazabilidad_fabricacion_id)
                for item in enlaces_traza
                if item.trazabilidad_fabricacion_id
            })
            trazas_fabricacion = session.exec(
                select(TrazabilidadFabricacionDB).where(
                    TrazabilidadFabricacionDB.id.in_(traza_ids)
                )
            ).all() if traza_ids else []
            trazas_por_id = {int(item.id): item for item in trazas_fabricacion if item.id}

            palet_ids = sorted({int(item.palet_id) for item in trazas_fabricacion if item.palet_id})
            palets = session.exec(
                select(PaletDB).where(PaletDB.id.in_(palet_ids))
            ).all() if palet_ids else []
            palets_por_id = {int(item.id): item for item in palets if item.id}

            linea_ids = sorted({
                int(producto.produccion_id or 0)
                for producto in productos
                if int(producto.produccion_id or 0) > 0
            } | {
                int(item.fabricacion_semanal_id or 0)
                for item in trazas_fabricacion
                if int(item.fabricacion_semanal_id or 0) > 0
            })
            lineas = session.exec(
                select(FabricacionSemanalDB).where(FabricacionSemanalDB.id.in_(linea_ids))
            ).all() if linea_ids else []
            lineas_por_id = {int(item.id): item for item in lineas if item.id}

            pedido_ids = sorted({int(item.pedido_id) for item in lineas if item.pedido_id})
            pedidos = session.exec(
                select(PedidoDB).where(PedidoDB.id.in_(pedido_ids))
            ).all() if pedido_ids else []
            pedidos_por_id = {int(item.id): item for item in pedidos if item.id}

            tipo_ids = sorted({int(item.tipo_producto_id) for item in lineas if item.tipo_producto_id})
            tipos = session.exec(
                select(TipoProductoDB).where(TipoProductoDB.id.in_(tipo_ids))
            ).all() if tipo_ids else []
            tipos_por_id = {int(item.id): item for item in tipos if item.id}

            material_ids = sorted({int(item.material_id) for item in lineas if item.material_id})
            materiales = session.exec(
                select(MaterialDB).where(MaterialDB.id.in_(material_ids))
            ).all() if material_ids else []
            materiales_por_id = {int(item.id): item for item in materiales if item.id}

            estados = session.exec(select(EstadoProductoDB)).all()
            estados_por_id = {int(item.id): item for item in estados if item.id}

            usuario_ids = sorted({int(item.usuario_id) for item in enlaces_operario if item.usuario_id})
            usuarios = session.exec(
                select(UsuarioDB).where(UsuarioDB.id.in_(usuario_ids))
            ).all() if usuario_ids else []
            usuarios_por_id = {int(item.id): item for item in usuarios if item.id}

            enlaces_operario_por_producto = {}
            for item in enlaces_operario:
                producto_id = int(item.producto_id or 0)
                if producto_id not in productos_por_id:
                    continue
                enlaces_operario_por_producto.setdefault(producto_id, []).append(item)

            trazas_por_producto = {}
            for item in enlaces_traza:
                producto_id = int(item.producto_id or 0)
                traza = trazas_por_id.get(int(item.trazabilidad_fabricacion_id or 0))
                if not traza or producto_id not in productos_por_id:
                    continue
                trazas_por_producto.setdefault(producto_id, []).append(traza)

            items = []
            for producto_id, producto in productos_por_id.items():
                enlaces_producto = enlaces_operario_por_producto.get(producto_id, [])
                fecha_creacion = min(
                    (item.created_at for item in enlaces_producto if item.created_at is not None),
                    default=None,
                )
                codigo_batidero = next(
                    (int(item.codigo_batidero) for item in enlaces_producto if item.codigo_batidero not in (None, "")),
                    None,
                )

                operarios = []
                usuarios_vistos = set()
                for item in sorted(
                    enlaces_producto,
                    key=lambda row: ((row.created_at.isoformat() if row.created_at else ""), int(row.usuario_id or 0)),
                ):
                    usuario_id = int(item.usuario_id or 0)
                    if not usuario_id or usuario_id in usuarios_vistos:
                        continue
                    usuarios_vistos.add(usuario_id)
                    usuario = usuarios_por_id.get(usuario_id)
                    operarios.append({
                        "id": usuario_id,
                        "nombre": getattr(usuario, "nombre", None) or getattr(usuario, "alias", None) or f"Operario {usuario_id}",
                    })

                trazas = trazas_por_producto.get(producto_id, [])
                palets_codigo = []
                lotes = []
                palets_vistos = set()
                lotes_vistos = set()
                fabricacion_semanal_id = int(producto.produccion_id or 0)
                for traza in trazas:
                    if not fabricacion_semanal_id:
                        fabricacion_semanal_id = int(traza.fabricacion_semanal_id or 0)
                    palet = palets_por_id.get(int(traza.palet_id or 0))
                    codigo_palet = str(getattr(palet, "codigo", "") or "").strip()
                    if codigo_palet and codigo_palet not in palets_vistos:
                        palets_vistos.add(codigo_palet)
                        palets_codigo.append(codigo_palet)
                    lote = self._normalizar_lote_traza(codigo_palet)
                    if lote and lote not in lotes_vistos:
                        lotes_vistos.add(lote)
                        lotes.append(lote)

                linea = lineas_por_id.get(fabricacion_semanal_id)
                pedido = pedidos_por_id.get(int(getattr(linea, "pedido_id", 0) or 0))
                tipo = tipos_por_id.get(int(getattr(linea, "tipo_producto_id", 0) or 0))
                material = materiales_por_id.get(int(getattr(linea, "material_id", 0) or 0))

                items.append({
                    "producto_id": producto_id,
                    "codigo": str(producto.codigo or "").strip(),
                    "estado": int(producto.estado or 0),
                    "estado_descripcion": getattr(estados_por_id.get(int(producto.estado or 0)), "descripcion", None) or str(int(producto.estado or 0)),
                    "fecha": fecha_creacion.isoformat() if fecha_creacion else None,
                    "codigo_batidero": codigo_batidero,
                    "operarios": operarios,
                    "fabricacion_semanal_id": fabricacion_semanal_id or None,
                    "pedido_id": getattr(pedido, "id", None),
                    "pedido_numero": getattr(pedido, "numero", None),
                    "pedido_descripcion": getattr(pedido, "descripcion", None) or "",
                    "tipo_producto_id": getattr(linea, "tipo_producto_id", None),
                    "tipo_producto_descripcion": getattr(tipo, "descripcion", None) or getattr(tipo, "codigo", None) or "",
                    "material_id": getattr(linea, "material_id", None),
                    "material_descripcion": getattr(material, "descripcion", None) or "",
                    "tostado_id": getattr(linea, "tostado_id", None),
                    "tostado_descripcion": self._descripcion_tostado(getattr(linea, "tostado_id", None)),
                    "palets": palets_codigo,
                    "lotes": lotes,
                })

            items.sort(
                key=lambda item: (
                    str(item.get("fecha") or ""),
                    str(item.get("codigo") or ""),
                ),
                reverse=True,
            )
            return items

    def reimprimir_etiqueta_bota(self, data, ws=None):
        producto_id = int(data.get("producto_id") or 0)
        if not producto_id:
            raise ValueError("producto_id es obligatorio.")

        with DB.crear_sesion() as session:
            producto = session.get(ProductoDB, producto_id)
            if not producto:
                raise ValueError("Producto no encontrado.")
            if str(getattr(producto, "tipo", "")).strip().upper() != "BOTA":
                raise ValueError("Solo se pueden reimprimir etiquetas de botas.")

            enlaces = session.exec(
                select(TrazabilidadProductoDB).where(
                    TrazabilidadProductoDB.producto_id == producto_id
                )
            ).all()
            traza_ids = [int(item.trazabilidad_fabricacion_id) for item in enlaces if item.trazabilidad_fabricacion_id]
            trazas = session.exec(
                select(TrazabilidadFabricacionDB).where(
                    TrazabilidadFabricacionDB.id.in_(traza_ids)
                )
            ).all() if traza_ids else []
            palet_ids = sorted({int(item.palet_id) for item in trazas if item.palet_id})
            palets = session.exec(
                select(PaletDB).where(PaletDB.id.in_(palet_ids))
            ).all() if palet_ids else []
            origenes = [
                str(item.codigo).strip()
                for item in palets
                if str(getattr(item, "codigo", "")).strip()
            ]
            codigo = str(producto.codigo or "").strip()

        threading.Thread(
            target=self._imprimir_etiquetas_async,
            args=([codigo], origenes, ws),
            daemon=True,
        ).start()
        return {
            "producto_id": producto_id,
            "codigo": codigo,
        }
    #endregion
    
    def checkUpdate(self, objeto, tabla, entrada_id, campo):
        if not objeto:
            raise ValueError(f"Entrada con ID {entrada_id} no encontrada en la tabla '{tabla}'.")
        if not hasattr(objeto, campo):
            raise ValueError(f"Campo '{campo}' no existe en la entrada de la tabla '{tabla}'.")

    def _es_union_con_none(self, annotation) -> tuple[bool, tuple]:
        args = tuple(get_args(annotation) or ())
        if not args:
            return False, ()
        contiene_none = any(arg is type(None) for arg in args)
        return contiene_none, args

    def _normalizar_vacio_numerico(self, dto_cls, campo: str, valor):
        # Solo normaliza campos de negocio de tipo cantidad*/estado* cuando llega "".
        if valor != "":
            return valor
        nombre = str(campo or "").strip().lower()
        if not (nombre.startswith("cantidad") or nombre.startswith("estado")):
            return valor
        field_info = getattr(dto_cls, "model_fields", {}).get(campo) if dto_cls else None
        if not field_info:
            return valor

        annotation = field_info.annotation
        contiene_none, args = self._es_union_con_none(annotation)
        tipos = args if args else (annotation,)

        es_int = int in tipos
        es_float = float in tipos

        if not (es_int or es_float):
            return valor

        if nombre.startswith("estado"):
            # En estados opcionales respetamos null; en no opcionales usamos 0.
            return None if contiene_none else 0
        return 0.0 if es_float else 0

    def _normalizar_data_vacia_numerica(self, dto_cls, data: dict | None):
        normalizada = dict(data or {})
        for campo, valor in list(normalizada.items()):
            normalizada[campo] = self._normalizar_vacio_numerico(dto_cls, campo, valor)
        return normalizada

    def limpiar_datos(self):
        #self.datos.clear()
        pass
    #endregion

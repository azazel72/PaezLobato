# app/routes/crud_routes.py
import logging
from typing import Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from servidor.colector import Colector
from servidor.logica.acciones import obtener_acciones
from servidor.logica.autorizacion import requiere_autenticacion, tiene_permiso_para_accion
from servidor.conexiones.request_message import RequestMessage
from servidor.conexiones.response_message import ResponseMessage
from servidor.conexiones.broadcast import set_registry, broadcast_error
from servidor.conexiones.sesiones import Sesiones

logger = logging.getLogger("paezlobato_crud_routes")

class CrudRoutes:

    @staticmethod
    def get_router():
        router = APIRouter(tags=["CRUD"])

        svc = {}
        clients = set()
        client_state = {}
        set_registry(clients, client_state)
        ACCIONES = obtener_acciones()

        # =======================
        # CRUD Endpoints
        # =======================
        @router.get("/items")
        async def list_items():
            await broadcast({"type": "list_request"})
            return len(clients)


        @router.post("/items")
        async def create_item(item: dict):
            created = await svc.create(item)
            await broadcast({"type": "created", "item": created})
            return JSONResponse(content=created, status_code=201)


        @router.patch("/items/{item_id}")
        async def patch_item(item_id: int, patch: dict):
            try:
                updated = await svc.update_partial(item_id, patch)
                await broadcast({"type": "updated", "item": updated})
                return updated
            except KeyError:
                raise HTTPException(status_code=404, detail="Item not found")


        @router.delete("/items/{item_id}")
        async def delete_item(item_id: int):
            try:
                await svc.delete(item_id)
                await broadcast({"type": "deleted", "id": item_id})
                return {"ok": True}
            except KeyError:
                raise HTTPException(status_code=404, detail="Item not found")


        # =======================
        # WebSocket
        # =======================
        @router.websocket("/ws")
        async def websocket_endpoint(ws: WebSocket):
            await ws.accept()

            clients.add(ws)
            client_state[ws] = {"pantalla": None, "contexto": {}}
            token = ws.query_params.get("token")
            sesion = None
            if token:
                sesion = Sesiones.vincular_ws(token, ws)
                if sesion is not None:
                    payload = Sesiones.exportar_payload(sesion)
                    await ws.send_json(ResponseMessage.ok("login", payload).model_dump())
            logger.info(
                "ws conectado: ws_id=%s token_presente=%s token_huella=%s sesion_vinculada=%s sesiones_activas=%s",
                id(ws), bool(token), Sesiones.huella_token(token), bool(sesion), len(Sesiones.sesiones),
            )

            try:
                while True:
                    raw = await ws.receive_text()
                    print(raw)
                    try:
                        msg = ResponseMessage[Any].model_validate_json(raw)
                    except ValidationError as e:
                        await ws.send_json(ResponseMessage.fail("error", "invalid_payload").model_dump())
                        continue

                    await accion_recibida(ws, msg)

            except WebSocketDisconnect:
                clients.discard(ws)
                client_state.pop(ws, None)
                Sesiones.liberar_ws(ws)

        # =======================
        # Broadcast común
        # =======================
        async def broadcast(message: dict):
            if not clients:
                return
            to_remove = []
            for ws in clients:
                try:
                    await ws.send_json(message)
                except Exception:
                    to_remove.append(ws)
            for ws in to_remove:
                clients.discard(ws)
                client_state.pop(ws, None)

        async def broadcast_pantalla(pantalla: str, data: dict):
            if not clients:
                return
            to_remove = []
            for ws in clients:
                estado = client_state.get(ws, {})
                if estado.get("pantalla") != pantalla:
                    continue
                try:
                    rm = ResponseMessage.ok("fabricacion_actualizar", data).model_dump()
                    safe_data = jsonable_encoder(rm)
                    await ws.send_json(safe_data)
                except Exception:
                    to_remove.append(ws)
            for ws in to_remove:
                clients.discard(ws)
                client_state.pop(ws, None)


        async def accion_recibida(ws: WebSocket, msg: "RequestMessage"):
            # Procesa el mensaje recibido via WebSocket
            logger.info("Accion recibida: %s", msg.action)
            try:
                if msg.action == "set_pantalla":
                    pantalla = (msg.data or {}).get("pantalla")
                    contexto = (msg.data or {}).get("contexto") or {}
                    client_state[ws] = {"pantalla": pantalla, "contexto": contexto}
                    rm = ResponseMessage.ok(msg.action, {"ok": True}, msg.request_id).model_dump()
                    safe_data = jsonable_encoder(rm)
                    await ws.send_json(safe_data)
                    return

                sesion = Sesiones.obtener_por_ws(ws)
                if requiere_autenticacion(msg.action) and sesion is None:
                    logger.warning(
                        "ws unauthorized: action=%s request_id=%s ws_id=%s token_presente=%s token_huella=%s sesiones_activas=%s",
                        msg.action, msg.request_id, id(ws), bool(ws.query_params.get("token")),
                        Sesiones.huella_token(ws.query_params.get("token")), len(Sesiones.sesiones),
                    )
                    await ws.send_json(ResponseMessage.fail(msg.action, "unauthorized", msg.request_id).model_dump())
                    return

                if False and requiere_autenticacion(msg.action) and not tiene_permiso_para_accion(sesion, msg.action):
                    await ws.send_json(ResponseMessage.fail(msg.action, "forbidden", msg.request_id).model_dump())
                    return

                handler = ACCIONES.get(msg.action)
                if handler:
                    print("datos recibidos", msg.data)
                    result = handler(ws, msg)
                    if result is not None:
                        rm: Any = ResponseMessage.ok(msg.action, result, msg.request_id).model_dump()
                        safe_data = jsonable_encoder(rm)
                        await ws.send_json(safe_data)
                        if msg.action in {
                            "agregar_trazabilidad_fabricacion_desde_palet_stock",
                            "agregar_palet_fondos_desde_stock",
                            "agregar_trazabilidad_fabricacion_desde_palet",
                            "actualizar_estado_trazabilidad_fabricacion",
                            "actualizar_estado_lote_fabricacion_compartida",
                            "eliminar_trazabilidad_fabricacion",
                            "mover_stock",
                            "procesar_stock",
                        }:
                            tabla_cambio = "palets_fondos" if msg.action == "agregar_palet_fondos_desde_stock" else "trazabilidad_fabricacion"
                            await broadcast_pantalla("vista_fabricacion", {"tabla": tabla_cambio})
                            await broadcast_pantalla("vista_consumo", {"tabla": tabla_cambio})
                            await broadcast_pantalla("vista_fabricacion_semanal", {"tabla": "trazabilidad_fabricacion"})
                            await broadcast_pantalla("vista_consumo_semanal", {"tabla": "trazabilidad_fabricacion"})
                            await broadcast_pantalla("gestion_fabricacion", {"tabla": "trazabilidad_fabricacion"})
                            await broadcast_pantalla("vista_ubicacion", {"tabla": "palets", "refetch_maestros": True})
                            await broadcast_pantalla("vista_mover_stock", {"tabla": "palets", "refetch_maestros": True})
                        elif msg.action in {"modificar_maestro", "insertar_maestro", "eliminar_maestro"}:
                            tabla = (msg.data or {}).get("tabla")
                            if tabla in {"pedidos", "tipos_producto", "fabricacion_semanal", "trazabilidad_fabricacion", "productos", "consumos"}:
                                await broadcast_pantalla("vista_fabricacion", {"tabla": tabla})
                                await broadcast_pantalla("vista_consumo", {"tabla": tabla})
                                await broadcast_pantalla("vista_fabricacion_semanal", {"tabla": tabla})
                                await broadcast_pantalla("vista_consumo_semanal", {"tabla": tabla})
                                await broadcast_pantalla("vista_salidas", {"tabla": tabla})
                                await broadcast_pantalla("vista_envinado", {"tabla": tabla})
                                await broadcast_pantalla("gestion_fabricacion", {"tabla": tabla})
                            elif tabla in {
                                "puestos_trabajo",
                                "usuarios",
                                "estados_pedidos",
                                "estados_fabricacion_semanal",
                                "estados_productos",
                                "estados_trazabilidad_fabricacion",
                                "estados_palets",
                                "ambientes",
                                "entradas_flejes",
                            }:
                                await broadcast_pantalla("vista_fabricacion", {"tabla": tabla, "refetch_maestros": True})
                                await broadcast_pantalla("vista_consumo", {"tabla": tabla, "refetch_maestros": True})
                                await broadcast_pantalla("vista_fabricacion_semanal", {"tabla": tabla, "refetch_maestros": True})
                                await broadcast_pantalla("vista_consumo_semanal", {"tabla": tabla, "refetch_maestros": True})
                                await broadcast_pantalla("vista_salidas", {"tabla": tabla, "refetch_maestros": True})
                                await broadcast_pantalla("vista_envinado", {"tabla": tabla, "refetch_maestros": True})
                                await broadcast_pantalla("gestion_fabricacion", {"tabla": tabla, "refetch_maestros": True})
                    else:
                        await ws.send_json(ResponseMessage.fail(msg.action, "no_result", msg.request_id).model_dump())
                else:
                    await ws.send_json(ResponseMessage.fail("unknown_action", msg.action, msg.request_id).model_dump())
            except Exception as e:
                logger.error("Error al procesar la accion %s: %s", msg.action, str(e))
                await ws.send_json(ResponseMessage.fail(msg.action, str(e), msg.request_id).model_dump())

        return router


class ConexionWS:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket

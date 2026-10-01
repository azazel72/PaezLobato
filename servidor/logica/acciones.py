from typing import Dict

from servidor.colector import Colector
from servidor.logica.login import cerrar_sesion, iniciar_sesion


def listar_aliases_usuarios(ws, req):
    usuarios = (Colector.colector.maestros.usuarios or {}) if Colector.colector and Colector.colector.maestros else {}
    alias_unicos: set[str] = set()

    for usuario in usuarios.values():
        alias = (getattr(usuario, "alias", "") or "").strip()
        if alias:
            alias_unicos.add(alias)

    return sorted(alias_unicos, key=str.casefold)

def obtener_acciones() -> Dict[str, any]:
    return {
        "login": iniciar_sesion,
        "logout": cerrar_sesion,
        "lista_aliases_usuarios": listar_aliases_usuarios,
        "maestros": lambda ws, req: Colector.colector.maestros,
        "fabricacion": lambda ws, req: Colector.colector.obtener_fabricacion(),
        "cargar_planificacion_entradas": lambda ws, req: Colector.colector.obtener_planificacion_entradas(req.data.get("año")),
        "agregar_planificacion_entradas": lambda ws, req: Colector.colector.agregar_planificacion_entradas(req.data.get("año")),
        "listar_entradas_planificacion": lambda ws, req: Colector.colector.listar_entradas_planificacion(req.data.get("año"), req.data.get("proveedor_id")),
        "listar_lineas_entrada": lambda ws, req: Colector.colector.listar_lineas_entrada(req.data.get("entrada_id")),
        "listar_pedidos": lambda ws, req: Colector.colector.listar_pedidos(req.data or {}),
        "listar_analiticas": lambda ws, req: Colector.colector.listar_analiticas(req.data or {}),
        "obtener_analitica": lambda ws, req: Colector.colector.obtener_analitica(req.data.get("analitica_id")),
        "guardar_analitica": lambda ws, req: Colector.colector.guardar_analitica(req.data or {}),
        "listar_productos_por_filtros": lambda ws, req: Colector.colector.listar_productos_por_filtros(req.data or {}),
        "expedir_productos_destino": lambda ws, req: Colector.colector.expedir_productos_destino(req.data or {}),
        "envinar_productos_destino": lambda ws, req: Colector.colector.envinar_productos_destino(req.data or {}),
        "listar_resumen_envinado": lambda ws, req: Colector.colector.listar_resumen_envinado(req.data or {}),
        "envinar_botas_pendientes": lambda ws, req: Colector.colector.envinar_botas_pendientes(req.data or {}),
        "vincular_archivos_botas_envinadas": lambda ws, req: Colector.colector.vincular_archivos_botas_envinadas(req.data or {}),
        "listar_archivos_bota_envinada": lambda ws, req: Colector.colector.listar_archivos_bota_envinada(req.data.get("producto_id")),
        "listar_fabricacion_semanal": lambda ws, req: Colector.colector.listar_fabricacion_semanal(req.data.get("pedido_id")),
        "listar_resumen_fabricacion_consumo": lambda ws, req: Colector.colector.listar_resumen_fabricacion_consumo(),
        "listar_trazabilidad_fabricacion": lambda ws, req: Colector.colector.listar_trazabilidad_fabricacion(
            (req.data or {}).get("fabricacion_semanal_id"),
            bool((req.data or {}).get("incluir_huerfanas")),
            # Código anterior: la llamada terminaba tras incluir_huerfanas.
            bool((req.data or {}).get("incluir_compartidas")),
        ),
        "obtener_cierre_semanal": lambda ws, req: Colector.colector.obtener_cierre_semanal(req.data.get("fabricacion_semanal_id")),
        "reasignar_consumo_negativo_cierre": lambda ws, req: Colector.colector.reasignar_consumo_negativo_cierre(req.data or {}),
        "crear_palet_procesado_desde_cierre": lambda ws, req: Colector.colector.crear_palet_procesado_desde_cierre(req.data or {}),
        "trasladar_sobrantes_cierre_semanal": lambda ws, req: Colector.colector.trasladar_sobrantes_cierre_semanal(req.data or {}),
        "actualizar_cambios_cierre_semanal": lambda ws, req: Colector.colector.actualizar_cambios_cierre_semanal(req.data or {}),
        "cerrar_fabricacion_semanal": lambda ws, req: Colector.colector.cerrar_fabricacion_semanal(req.data or {}),
        "listar_palets_consumo": lambda ws, req: Colector.colector.listar_palets_consumo(),
        "listar_cubicaje": lambda ws, req: Colector.colector.listar_cubicaje(),
        "obtener_contexto_consumo": lambda ws, req: Colector.colector.obtener_contexto_consumo(req.data),
        "listar_palets_fondos": lambda ws, req: Colector.colector.listar_palets_fondos(),
        "agregar_palet_fondos_desde_stock": lambda ws, req: Colector.colector.agregar_palet_fondos_desde_stock(req.data or {}),
        "agregar_trazabilidad_fabricacion_desde_palet": lambda ws, req: Colector.colector.agregar_trazabilidad_fabricacion_desde_palet(req.data),
        "agregar_trazabilidad_fabricacion_desde_palet_stock": lambda ws, req: Colector.colector.agregar_trazabilidad_fabricacion_desde_palet_stock(req.data),
        "eliminar_trazabilidad_fabricacion": lambda ws, req: Colector.colector.eliminar_trazabilidad_fabricacion(req.data),
        "actualizar_estado_trazabilidad_fabricacion": lambda ws, req: Colector.colector.actualizar_estado_trazabilidad_fabricacion(req.data),
        "actualizar_estado_lote_fabricacion_compartida": lambda ws, req: Colector.colector.actualizar_estado_lote_fabricacion_compartida(req.data or {}),
        "imprimir_etiqueta_fabricacion": lambda ws, req: Colector.colector.imprimir_etiqueta_fabricacion(req.data, ws),
        "listar_operarios_planificacion_fabricacion": lambda ws, req: Colector.colector.listar_operarios_planificacion_fabricacion(req.data or {}),
        "listar_botas_diarias": lambda ws, req: Colector.colector.listar_botas_diarias(req.data.get("fecha")),
        "buscar_botas_por_codigo": lambda ws, req: Colector.colector.buscar_botas_por_codigo(req.data.get("codigo")),
        "reimprimir_etiqueta_bota": lambda ws, req: Colector.colector.reimprimir_etiqueta_bota(req.data or {}, ws),
        "listar_archivos_entidad": lambda ws, req: Colector.colector.listar_archivos_entidad(req.data.get("entidad"), req.data.get("entidad_id")),
        "inventario_duelas": lambda ws, req: Colector.colector.inventario_duelas(),
        "inventario_flejes": lambda ws, req: Colector.colector.inventario_flejes(),
        "listar_asistencias_mensuales": lambda ws, req: Colector.colector.listar_asistencias_mensuales(
            (req.data or {}).get("año"),
            (req.data or {}).get("mes"),
        ),
        "listar_dias_festivos_rango": lambda ws, req: Colector.colector.listar_dias_festivos_rango(
            (req.data or {}).get("fecha_inicio"),
            (req.data or {}).get("fecha_fin"),
        ),
        "siguiente_codigo_palet": lambda ws, req: Colector.colector.siguiente_codigo_palet(req.data or {}),
        "mover_stock": lambda ws, req: Colector.colector.mover_stock(req.data or {}),
        "procesar_stock": lambda ws, req: Colector.colector.procesar_stock(req.data or {}),
        "modificar_maestro": lambda ws, req: Colector.colector.modificar_maestro(req.data),
        "modificar_entrada": lambda ws, req: Colector.colector.modificar_entrada(req.data),
        "eliminar_maestro": lambda ws, req: Colector.colector.eliminar_maestro(req.data),
        "insertar_maestro": lambda ws, req: Colector.colector.insertar_maestro(req.data),
        "cargar_cuadrantes": lambda ws, req: Colector.colector.obtener_cuadrante(req.data.get("fecha")),
        "extender_jueves_semana_cuadrante": lambda ws, req: Colector.colector.extender_jueves_semana_cuadrante(req.data),
        "clonar_columna_cuadrante": lambda ws, req: Colector.colector.clonar_columna_cuadrante(req.data),
        "limpiar_cuadrante": lambda ws, req: Colector.colector.limpiar_cuadrante(req.data),
        "actualizar_detalle_cuadrante": lambda ws, req: Colector.colector.actualizar_detalle_cuadrante(req.data),
        "insertar_detalle_cuadrante": lambda ws, req: Colector.colector.insertar_detalle_cuadrante(req.data),
        "eliminar_detalle_cuadrante": lambda ws, req: Colector.colector.eliminar_detalle_cuadrante(req.data),
    }

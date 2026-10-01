from servidor.colector import Colector
from servidor.conexiones.sesiones import Sesion


ACCIONES_PUBLICAS = {"login", "logout", "set_pantalla", "lista_aliases_usuarios"}

PERMISOS_POR_ACCION = {
    "cargar_planificacion_entradas": {"planificacion"},
    "agregar_planificacion_entradas": {"planificacion"},
    "listar_entradas_planificacion": {"planificacion", "recepcion"},
    "listar_lineas_entrada": {"recepcion"},
    "listar_operarios_planificacion_fabricacion": {"planificacion", "fabricacion"},
    "listar_pedidos": {"planificacion", "fabricacion"},
    "listar_analiticas": {"fabricacion", "expedicion"},
    "obtener_analitica": {"fabricacion", "expedicion"},
    "guardar_analitica": {"fabricacion", "expedicion"},
    "listar_productos_por_filtros": {"expedicion", "fabricacion"},
    "expedir_productos_destino": {"expedicion"},
    "envinar_productos_destino": {"expedicion", "fabricacion"},
    "listar_resumen_envinado": {"fabricacion", "expedicion"},
    "envinar_botas_pendientes": {"fabricacion"},
    "vincular_archivos_botas_envinadas": {"fabricacion"},
    "listar_archivos_bota_envinada": {"fabricacion", "expedicion"},
    "listar_fabricacion_semanal": {"fabricacion"},
    "listar_resumen_fabricacion_consumo": {"fabricacion"},
    "listar_trazabilidad_fabricacion": {"trazabilidad", "fabricacion"},
    "obtener_cierre_semanal": {"fabricacion"},
    "reasignar_consumo_negativo_cierre": {"fabricacion"},
    "crear_palet_procesado_desde_cierre": {"fabricacion"},
    "trasladar_sobrantes_cierre_semanal": {"fabricacion"},
    "actualizar_cambios_cierre_semanal": {"fabricacion"},
    "cerrar_fabricacion_semanal": {"fabricacion"},
    "listar_palets_consumo": {"fabricacion"},
    "obtener_contexto_consumo": {"fabricacion"},
    "listar_palets_fondos": {"fabricacion"},
    "agregar_palet_fondos_desde_stock": {"fabricacion"},
    "agregar_trazabilidad_fabricacion_desde_palet": {"trazabilidad", "fabricacion"},
    "agregar_trazabilidad_fabricacion_desde_palet_stock": {"trazabilidad", "fabricacion"},
    "eliminar_trazabilidad_fabricacion": {"trazabilidad", "fabricacion"},
    "actualizar_estado_trazabilidad_fabricacion": {"trazabilidad", "fabricacion"},
    "actualizar_estado_lote_fabricacion_compartida": {"trazabilidad", "fabricacion"},
    "imprimir_etiqueta_fabricacion": {"fabricacion"},
    "listar_botas_diarias": {"fabricacion"},
    "buscar_botas_por_codigo": {"trazabilidad", "fabricacion", "expedicion"},
    "reimprimir_etiqueta_bota": {"fabricacion"},
    "listar_archivos_entidad": {"fabricacion", "expedicion", "trazabilidad"},
    "inventario_duelas": {"recepcion", "fabricacion"},
    "inventario_flejes": {"recepcion", "fabricacion"},
    "listar_asistencias_mensuales": {"planificacion", "fabricacion", "recepcion"},
    "listar_cubicaje": {"fabricacion"},
    "siguiente_codigo_palet": {"ubicacion", "fabricacion"},
    "mover_stock": {"ubicacion"},
    "procesar_stock": {"ubicacion"},
    "cargar_cuadrantes": {"planificacion", "fabricacion"},
    "extender_jueves_semana_cuadrante": {"planificacion"},
    "clonar_columna_cuadrante": {"planificacion"},
    "limpiar_cuadrante": {"planificacion"},
    "actualizar_detalle_cuadrante": {"planificacion"},
    "insertar_detalle_cuadrante": {"planificacion"},
    "eliminar_detalle_cuadrante": {"planificacion"},
}

ACCIONES_ADMIN = {
    "maestros",
    "fabricacion",
    "modificar_maestro",
    "modificar_entrada",
    "eliminar_maestro",
    "insertar_maestro",
}


def requiere_autenticacion(action: str) -> bool:
    return action not in ACCIONES_PUBLICAS


def tiene_permiso_para_accion(sesion: Sesion | None, action: str) -> bool:
    if sesion is None or sesion.usuario is None:
        return False

    rol_id = sesion.usuario.rol_id
    rol = Colector.colector.maestros.roles.get(rol_id) if rol_id is not None and Colector.colector.maestros.roles else None
    if rol is None:
        return False

    if rol.administrador:
        return True

    if action in ACCIONES_ADMIN:
        return False

    permisos_requeridos = PERMISOS_POR_ACCION.get(action)
    if not permisos_requeridos:
        return True

    return any(bool(getattr(rol, permiso, False)) for permiso in permisos_requeridos)

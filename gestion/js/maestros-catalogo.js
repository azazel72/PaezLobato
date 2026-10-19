'use strict';

const GestionCatalogo = {
    items: [
        ['clientes', 'Clientes', 'person-vcard'], ['instalaciones', 'Instalaciones', 'houses'],
        ['estados_pedidos', 'Estados de pedidos', 'circle'], ['estados_fabricacion_semanal', 'Estados de fabricación semanal', 'circle'],
        ['estados_productos', 'Estados de productos', 'circle'], ['estados_flejes', 'Estados de flejes', 'circle'],
        ['estados_trazabilidad_fabricacion', 'Estados de trazabilidad', 'circle'], ['estados_palets', 'Estados de palets', 'circle'],
        ['usuarios', 'Usuarios', 'people'], ['roles', 'Roles', 'person-badge'], ['puestos_trabajo', 'Puestos de trabajo', 'person-workspace'],
        ['tostados', 'Tostados', 'fire'], ['dias_festivos', 'Días festivos', 'calendar-event'], ['archivos_subidos', 'Archivos subidos', 'paperclip'],
        ['tipos_producto', 'Tipos de producto', 'tags'],
    ],
    open(resource) {
        const item = this.items.find(([key]) => key === resource);
        if (item) return GestionUI.open(resource, item[1], { icon: item[2] });
    },
};

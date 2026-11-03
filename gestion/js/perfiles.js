'use strict';

// Visibilidad del escritorio. No sustituye la autorización de operaciones en PHP.
const GestionPerfiles = (() => {
    const permisos = ['planificacion', 'recepcion', 'ubicacion', 'fabricacion', 'expedicion', 'trazabilidad', 'administrador'];
    const requisitos = {
        planificacion_entradas: ['planificacion'],
        tipos_producto: ['administrador'],
        tostados: ['administrador'],
    };
    let perfil = null;
    const activo = value => value === true || value === 1 || value === '1';

    function puedeAbrir(resource) {
        const required = requisitos[resource] || [];
        return !perfil || perfil.administrador || required.length === 0 || required.some(key => perfil[key]);
    }

    function aplicar() {
        document.querySelectorAll('[data-view], [data-table], [data-permiso]').forEach(element => {
            const permission = element.dataset.permiso;
            element.hidden = permission
                ? !!perfil && !perfil.administrador && !perfil[permission]
                : !puedeAbrir(element.dataset.view || element.dataset.table);
        });
    }

    // Recibe el registro del rol (incluidas sus banderas), nunca un rol por defecto.
    // null conserva el acceso inicial abierto hasta disponer de autenticación PHP.
    function establecerPerfil(rol) {
        perfil = rol == null ? null : Object.fromEntries(permisos.map(key => [key, activo(rol[key])]));
        aplicar();
    }

    document.addEventListener('click', event => {
        const control = event.target.closest('[data-view], [data-table]');
        if (control && !puedeAbrir(control.dataset.view || control.dataset.table)) {
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, true);
    aplicar();
    return { establecerPerfil, puedeAbrir };
})();

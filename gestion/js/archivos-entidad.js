'use strict';

const GestionArchivosEntidad = {
    async open(entity, id, title) {
        const key = `archivos-${entity}-${id}`;
        if (windows.has(key)) { focusWindow(key); return; }
        const entry = GestionUI.shell(key, `Archivos · ${title}`, 'paperclip'); if (!entry) return;
        entry.isCurrent = () => windows.get(key) === entry;
        return GestionUI.open('archivos_subidos', entry.title, {
            entry, defaults: { entidad: entity, entidad_id: id },
            setup(source) { source.extraFilter = row => row.entidad === entity && Number(row.entidad_id) === Number(id); },
            form(form, controls) {
                controls.entidad.readOnly = true; controls.entidad_id.readOnly = true;
            },
        });
    },
};

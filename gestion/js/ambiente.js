'use strict';

const GestionAmbiente = {
    open() { return GestionOperaciones.open('ambientes', 'Ambiente', { icon: 'thermometer-half', date: 'fecha', defaults: () => ({ fecha: GestionUI.today() }) }); },
};

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = [
    { dataset: { permiso: 'administrador' } },
    { dataset: { view: 'tipos_producto' } },
    { dataset: { view: 'tostados' } },
    { dataset: { view: 'planificacion_entradas' } },
    { dataset: { view: 'pedidos' } },
];
let listener;
const context = vm.createContext({ document: {
    querySelectorAll: () => elements,
    addEventListener: (_, callback) => { listener = callback; },
} });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/perfiles.js'), 'utf8'), context);
const profiles = vm.runInContext('GestionPerfiles', context);
assert(elements.every(element => !element.hidden), 'Sin perfil se conserva el acceso inicial');
profiles.establecerPerfil({ administrador: '0', planificacion: '0', fabricacion: '1' });
assert(elements.slice(0, 4).every(element => element.hidden), 'Un rol sin privilegios no ve maestros ni planificación');
assert.equal(elements[4].hidden, false, 'Pedidos mantiene su acceso anterior');
assert.equal(profiles.puedeAbrir('tostados'), false);
let prevented = false;
listener({ target: { closest: () => elements[2] }, preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
assert(prevented, 'Se bloquean las acciones de navegación restringidas');
profiles.establecerPerfil({ planificacion: 1 });
assert.equal(elements[3].hidden, false, 'Se respeta el permiso de planificación');
assert.equal(elements[0].hidden, true);
profiles.establecerPerfil({ administrador: '1' });
assert(elements.every(element => !element.hidden), 'Administrador conserva todos los accesos');
profiles.establecerPerfil(null);
assert(elements.every(element => !element.hidden));
console.log('OK: visibilidad inicial, roles, administrador y bloqueo de navegación');

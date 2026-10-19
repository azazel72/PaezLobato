// Pruebas del editor y del guardado sin navegador ni escrituras en la BBDD.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.events = {}; this.value = ''; this.classList = { add() {}, remove() {} }; }
    setAttribute(name, value) { this[name] = value; }
    append(...children) { this.children.push(...children); }
    addEventListener(name, callback) { this.events[name] = callback; }
    checkValidity() { return !this.required || this.value !== ''; }
    reportValidity() { this.reported = true; return this.checkValidity(); }
    querySelector() { return null; }
    focus() { this.focused = true; }
    select() {}
    emit(name, key) { this.events[name]?.({ key, preventDefault() {}, stopPropagation() {} }); }
}
const notices = [];
const context = vm.createContext({
    document: { createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }) },
    notify: message => notices.push(message), loadOverview() {}, windows: new Map(),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui-datos.js'), 'utf8') + '\nglobalThis.ui = GestionUI;', context);
const ui = context.ui;
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/maestros.js'), 'utf8') + '\nglobalThis.master = gestionMaestros;', context);
let pencilClicks = 0, deleteClicks = 0;
const legacyColumns = context.master.columns({ editing: false, pending: 0, loading: false }, [], () => deleteClicks++, () => pencilClicks++);
const actions = legacyColumns.at(-1).formatter({ getRow: () => ({ getData: () => ({ id: 1 }) }) });
assert.equal(actions.children[0].disabled, false); actions.children[0].emit('click');
assert.equal(actions.children[1].disabled, false); actions.children[1].emit('click');
assert.equal(pencilClicks, 1); assert.equal(deleteClicks, 1);
console.log('OK: lápiz y acciones de los maestros iniciales independientes del candado.');
const entry = { lookups: { instalaciones: [{ value: 7, label: 'Almacén' }, { value: 9, label: 'Fábrica' }] }, label: (_, value) => String(value) };
const field = { label: 'Instalación', type: 'select', ref: 'instalaciones', required: true };
let saved = [], cancelled = 0;
const editor = ui.cellEditor(entry, 'instalacion_id', field, { getValue: () => 7 }, callback => callback(), value => saved.push(value), () => cancelled++);
assert.equal(editor.tagName, 'select');
assert.equal(editor.value, '7');
assert.equal(editor.children[1].textContent, 'Fábrica');
editor.value = '9'; editor.emit('change'); editor.emit('blur');
assert.deepEqual(saved, ['9']); assert.equal(cancelled, 0);
const escape = ui.cellEditor(entry, 'instalacion_id', field, { getValue: () => 7 }, () => {}, value => saved.push(value), () => cancelled++);
escape.emit('keydown', 'Escape'); escape.emit('blur');
assert.equal(cancelled, 1); assert.deepEqual(saved, ['9']);
const empty = ui.cellEditor(entry, 'instalacion_id', field, { getValue: () => '' }, () => {}, value => saved.push(value), () => cancelled++);
empty.emit('keydown', 'Enter'); assert.equal(empty.reported, true); assert.deepEqual(saved, ['9']);
const destino = ui.cellEditor(entry, 'destino', { label: 'Destino', type: 'select', options: { C: 'Cliente', E: 'Envinado' }, required: true }, { getValue: () => 'CLIENTE' }, () => {}, () => {}, () => {});
assert.equal(destino.value, 'C');
console.log('OK: combos por ID, etiquetas, alias, confirmación única, Escape y campos obligatorios.');

(async () => {
    const rowData = { id: 5, nombre: ' Nombre nuevo ', _version: 'version-inicial' };
    const row = { getData: () => rowData, update: async data => Object.assign(rowData, data) };
    let restored = false;
    const cell = { getValue: () => rowData.nombre, getOldValue: () => 'Nombre anterior', getRow: () => row, getElement: () => new Element('div'), restoreOldValue: () => { restored = true; rowData.nombre = 'Nombre anterior'; } };
    const state = { config: { fields: { nombre: { type: 'text' }, clave: { type: 'password' }, calculado: { type: 'number', readonly: true } } }, pending: 0, status() {}, applyFilters() {}, table: { redraw() {} } };
    ui.request = async (_, payload) => {
        assert.equal(payload.version, 'version-inicial');
        assert.equal(payload.data.nombre, ' Nombre nuevo ');
        assert.equal('clave' in payload.data, false); assert.equal('calculado' in payload.data, false);
        return { row: { id: 5, nombre: 'Nombre nuevo', _version: 'version-actualizada' } };
    };
    await ui.saveCell('clientes', state, cell);
    assert.equal(rowData.nombre, 'Nombre nuevo'); assert.equal(rowData._version, 'version-actualizada'); assert.equal(state.pending, 0); assert.equal(restored, false);
    ui.request = async () => { throw new Error('Conflicto de edición'); };
    rowData.nombre = 'Cambio rechazado'; await ui.saveCell('clientes', state, cell);
    assert.equal(restored, true); assert.equal(rowData.nombre, 'Nombre anterior'); assert.equal(state.pending, 0); assert.equal(notices.at(-1), 'Conflicto de edición');
    console.log('OK: guardado de celda con versión, normalización y restauración ante errores.');
    const locked = { config: { title: 'Clientes', fields: { nombre: { label: 'Nombre', type: 'text', required: true } } }, lookups: {}, editing: false, pending: 0, loading: false, reload: async () => {} };
    context.windows.set('clientes', locked);
    let openedForm, closed = false, savedForm = false;
    context.createWindow = (_, title, icon, form) => { openedForm = form; return { pending: 0, panel: { close: () => { closed = true; } } }; };
    ui.request = async (_, payload) => { assert.equal(payload.action, 'update'); assert.equal(payload.version, 'version-bloqueada'); savedForm = true; return { id: 5 }; };
    ui.form('clientes', locked, { id: 5, nombre: 'Edición desde lápiz', _version: 'version-bloqueada' });
    assert.ok(openedForm, 'No abre formulario con el candado bloqueado');
    await openedForm.events.submit({ preventDefault() {} });
    assert.equal(savedForm, true); assert.equal(closed, true); assert.equal(locked.editing, false);
    console.log('OK: el lápiz abre y guarda sin desbloquear la edición de tabla.');
})().catch(error => { console.error(error); process.exitCode = 1; });

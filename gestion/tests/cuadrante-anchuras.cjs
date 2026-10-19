const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class Element {
    constructor(width = 0) {
        this.width = width; this.style = { setProperty(key, value) { this[key] = value; } };
        this.attributes = {}; this.events = {}; this.children = []; this.classes = new Set();
        this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, callback) { this.events[type] = callback; }
    getBoundingClientRect() { return { width: this.width }; }
    append(child) { this.children.push(child); }
    prepend(child) { this.group = child; }
    replaceChildren(...children) { this.children = children; }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
    fire(type, values = {}) {
        const event = { pointerId: 1, button: 0, clientX: 0, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...values };
        this.events[type](event); return event;
    }
}
const context = vm.createContext({ document: { createElement: () => new Element() } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/cuadrante-anchuras.js'), 'utf8') + '\nglobalThis.resize = GestionCuadranteAnchuras;', context);
const resize = context.resize;
const root = new Element(), pool = new Element(220), separator = new Element(), layout = new Element(); layout.clientWidth = 900;
const table = new Element();
table.headers = [145, 160, 160, 160, 160, 160].map((width, index) => { const el = new Element(width); el.textContent = index ? `Día ${index}` : 'Puesto'; return el; });
table.querySelectorAll = () => table.headers;
table.querySelector = () => table.group;
root.querySelector = selector => ({ '.cc-layout': layout, '.cc-pool': pool, '.cc-pool-resizer': separator, '.cc-table': table })[selector];
const entry = { content: root, locked: true };
resize.bind(entry); resize.table(entry);
separator.fire('pointerdown', { clientX: 220 }); separator.fire('pointermove', { clientX: 300 });
assert.equal(layout.style['--cc-pool-width'], '300px'); assert.ok(root.classes.has('cc-resizing'));
separator.fire('pointermove', { clientX: -200 }); assert.equal(layout.style['--cc-pool-width'], '120px');
separator.fire('pointermove', { clientX: 2000 }); assert.equal(layout.style['--cc-pool-width'], '713px');
separator.fire('pointercancel'); assert.equal(separator.capture, null); assert.equal(root.classes.has('cc-resizing'), false);

const handle = table.headers[2].children[0];
const start = handle.fire('pointerdown', { clientX: 400 }); assert.ok(start.prevented && start.stopped);
handle.fire('pointermove', { pointerId: 2, clientX: 450 }); assert.equal(entry.columnWidths, undefined);
handle.fire('pointermove', { clientX: 450 });
assert.equal(entry.columnWidths[2], 210); assert.equal(entry.columnWidths[1], 160);
assert.equal(table.style.width, '995px'); assert.equal(table.group.children[2].style.width, '210px');
handle.fire('pointerup'); assert.equal(root.classes.has('cc-resizing'), false);
handle.fire('keydown', { key: 'ArrowLeft' }); assert.equal(entry.columnWidths[2], 200);
handle.fire('keydown', { key: 'Home' }); assert.equal(entry.columnWidths[2], 80);
assert.equal(handle.attributes['aria-valuenow'], '80');
assert.ok(handle.fire('dragstart').prevented);
table.headers = table.headers.map(header => { const el = new Element(header.width); el.textContent = header.textContent; return el; });
resize.table(entry); assert.equal(table.group.children[2].style.width, '80px');
assert.equal(table.headers[2].children[0].attributes['aria-valuenow'], '80');
console.log('OK: anchuras de empleados y columnas con candado cerrado, límites, puntero, teclado y conservación al renderizar.');

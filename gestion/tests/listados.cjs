const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const XLSX = require(path.join(root, 'static/js/xlsx.full.min.js'));
const pdfModule = require(path.join(root, 'static/js/jspdf.umd.min.js'));
const plugin = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'static/js/jspdf.plugin.autotable.min.js'), 'utf8'), { module: plugin, exports: plugin.exports, require: () => pdfModule });
class Element {
 constructor(tag) { this.tag = tag; this.children = []; this.style = {}; }
 append(...children) { this.children.push(...children); }
 setAttribute() {}
 click() {}
 get innerHTML() { return String(this.textContent || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}
let bookBytes, pdfBytes, csvBlob, bookFilename;
function PDF(options) { const doc = new pdfModule.jsPDF(options); doc.save = () => { pdfBytes = Buffer.from(doc.output('arraybuffer')); }; return doc; }
PDF.API = pdfModule.jsPDF.API;
const context = vm.createContext({
 document: { createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }) },
 GestionUI: { text: value => { const el = new Element('span'); el.textContent = value; return el; } },
 numberFormat: new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 }),
 XLSX: { ...XLSX, writeFile: (book, filename, options) => { bookFilename = filename; bookBytes = Buffer.from(XLSX.write(book, { type: 'buffer', bookType: options?.bookType || 'xlsx' })); } },
 jspdf: { jsPDF: PDF }, Blob, URL: { createObjectURL: blob => { csvBlob = blob; return 'blob:test'; }, revokeObjectURL() {} }, setTimeout: callback => callback(),
});
for (const name of ['listados.js', 'listados-exportar.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name), 'utf8'), context);
vm.runInContext('globalThis.reports=GestionListados;globalThis.exporter=GestionListadosExportar;', context);
const reports = context.reports, exporter = context.exporter;
const columns = reports.columns('inventario_maderas', {});
const data = [
 { tipo_producto: 'Duela A', material: 'Roble', ubicacion: 'Uno', instalacion: 'Nave 1', palets: 2, cubicaje: 3.5, consumido: 1, restante: 2.5 },
 { tipo_producto: 'Duela A', material: 'Roble', ubicacion: 'Dos', instalacion: 'Nave 1', palets: 3, cubicaje: 4, consumido: 2, restante: 2 },
 { tipo_producto: 'Duela A', material: 'Castaño', ubicacion: 'Tres', instalacion: 'Nave 2', palets: 1, cubicaje: 2, consumido: 0, restante: 2 },
];
const entry = { reportColumns: columns, groupFields: ['tipo_producto', 'material', 'instalacion'], table: { getData: () => data }, exportTitle: 'Inventario de maderas', legend: '' };
assert.equal(reports.groupKey(entry, data[0]), 'Duela A | Roble | Nave 1');
let snapshot = exporter.snapshot(entry);
assert.equal(snapshot.rows.filter(r => r.summary).length, 2);
assert.equal(snapshot.rows[0].values[4], 5);
assert.equal(snapshot.rows[0].values[7], 4.5);
entry.groupFields = [];
snapshot = exporter.snapshot(entry);
assert.equal(snapshot.rows[0].values[0], 'Total');
assert.equal(snapshot.rows[0].values[4], 6);
assert.equal(snapshot.rows[0].values[7], 6.5);
assert.equal(snapshot.rows.length, 4, 'El plegado no debe eliminar filas de la exportacion');
const group = reports.groupHeader(entry, 'Total', data, { isVisible: () => false });
assert.ok(group.children[0].children[0].className.includes('chevron-right'));
assert.equal(group.children.at(-1).textContent, '6,5');
assert.equal(reports.attendanceLegend({ inicio: '2026-01-01', fin: '2026-01-31', laborables: 22 }), 'Enero 2026 · 01/01/2026 a 31/01/2026 · Laborables: 22');
assert.equal(columns.some(c => c.bottomCalc), false);
console.log('OK: agrupaciones acumulativas, Total sin agrupar, totales en cabecera y leyenda mensual.');

// Simula la reconstrucción de componentes que Tabulator realiza al plegar.
// También cubre grupos anidados y elementos que aún no están en el DOM.
const visibility = new Map([['A', true], ['A/a', true], ['A/b', true], ['B', true], ['C', true]]);
let generation = 0, blocked = false, defaultOpen;
const components = parent => [...visibility.keys()].filter(key => key.includes('/') ? key.slice(0, key.lastIndexOf('/')) === parent : parent === '').map(key => {
 const version = generation;
 return { getKey: () => key.split('/').at(-1), getSubGroups: () => components(key), isVisible: () => visibility.get(key), getElement: () => null,
  hide: () => { if (version === generation) { visibility.set(key, false); generation++; } },
  show: () => { if (version === generation) { visibility.set(key, true); generation++; } },
 };
});
const bulk = { table: { getGroups: () => components(''), getColumns: () => [], blockRedraw: () => { blocked = true; }, restoreRedraw: () => { blocked = false; }, setGroupStartOpen: value => { defaultOpen = value; generation++; } }, content: { querySelectorAll: () => [] } };
reports.setAllGroups(bulk, false);
assert.ok([...visibility.values()].every(value => value === false)); assert.equal(blocked, false); assert.equal(defaultOpen, false);
reports.setAllGroups(bulk, true);
assert.ok([...visibility.values()].every(value => value === true)); assert.equal(blocked, false); assert.equal(defaultOpen, true);
reports.setAllGroups(bulk, true);
assert.ok([...visibility.values()].every(value => value === true));
console.log('OK: plegar y desplegar todos los grupos, incluidos anidados, con reconstruccion de componentes.');

(async () => {
 exporter.export(entry, 'test', 'xlsx');
 assert.equal(bookBytes.slice(0, 2).toString(), 'PK');
 const book = XLSX.read(bookBytes, { type: 'buffer' });
 const rows = XLSX.utils.sheet_to_json(book.Sheets.Listado, { header: 1 });
 const total = rows.find(row => row[0] === 'Total');
 assert.equal(total[4], 6); assert.equal(typeof total[4], 'number'); assert.equal(total[7], 6.5);
 assert.equal(book.Sheets.Listado['!merges'][0].e.c, 3);
 exporter.export(entry, 'test', 'xls');
 assert.equal(bookFilename, 'test.xls');
 assert.equal(bookBytes.subarray(0, 8).toString('hex'), 'd0cf11e0a1b11ae1', 'Excel BIFF8 real, no HTML renombrado');
 const xls = XLSX.read(bookBytes, { type: 'buffer' });
 assert.equal(XLSX.utils.sheet_to_json(xls.Sheets.Listado, { header: 1 }).find(row => row[0] === 'Total')[7], 6.5);
 exporter.export(entry, 'test', 'pdf');
 assert.equal(pdfBytes.slice(0, 4).toString(), '%PDF');
 exporter.export(entry, 'test', 'csv');
 const csv = await csvBlob.text(); assert.ok(csv.includes('"Total"')); assert.ok(csv.includes('"6.5"'));
 const html = exporter.html(entry); assert.ok(html.includes('colspan="4"')); assert.ok(!html.includes('[object HTMLSpanElement]'));
 data[0].tipo_producto = '<img src=x onerror=alert(1)>';
 entry.groupFields = ['tipo_producto'];
 assert.ok(exporter.html(entry).includes('&lt;img')); assert.ok(!exporter.html(entry).includes('<img'));
 console.log('OK: XLSX real con numeros y celdas combinadas, PDF real, CSV e impresion con totales y escape de texto.');

 const definitions = [{ title: 'Cliente', field: 'cliente_id' }, { title: 'Cantidad', field: 'cantidad' }, { title: 'Oculta', field: 'oculta', visible: false }, { title: 'Acciones', field: '_acciones' }, { title: 'Acciones' }];
 const filtered = { title: 'Pedidos', config: { fields: { cantidad: { type: 'number' } } }, label: (key, value) => key === 'cliente_id' ? 'Cliente visible' : value,
  table: { getColumns: () => definitions.map(def => ({ getDefinition: () => def })), getData: mode => { assert.equal(mode, 'active'); return [{ cliente_id: 4, cantidad: '12.5', oculta: 'SECRETO' }]; } } };
 const tableSnapshot = exporter.tableSnapshot(filtered);
 assert.equal(tableSnapshot.columns.length, 2);
 assert.equal(tableSnapshot.rows[0].values[0], 'Cliente visible');
 assert.equal(tableSnapshot.rows[0].values[1], 12.5);
 exporter.exportSnapshot(tableSnapshot, 'pedidos', 'xls');
 const tableBook = XLSX.read(bookBytes, { type: 'buffer' });
 const tableRows = XLSX.utils.sheet_to_json(tableBook.Sheets.Listado, { header: 1 });
 assert.equal(tableRows.at(-1)[0], 'Cliente visible'); assert.equal(tableRows.at(-1)[1], 12.5);
 exporter.exportSnapshot(tableSnapshot, 'pedidos', 'pdf'); assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF');

 for (const name of ['cuadrante-completo-modelo.js', 'cuadrante-completo.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name), 'utf8'), context);
 vm.runInContext('globalThis.quadrant = GestionCuadranteCompleto;', context);
 const week = { state: { inicio: '2026-10-15', fin: '2026-10-21', festivos: ['2026-10-16'], usuarios: [{ id: 1, nombre: 'Ana', activo: 1 }], puestos: [{ id: 1, nombre: 'Batidero', activo: 1, orden: 1 }], details: [{ puesto_id: 1, usuario_id: 1, fecha: '2026-10-15' }] } };
 context.quadrant.action(week, 'xls'); assert.equal(bookFilename, 'cuadrante_2026-10-15.xls');
 const weekBook = XLSX.read(bookBytes, { type: 'buffer' });
 const weekRows = XLSX.utils.sheet_to_json(weekBook.Sheets.Listado, { header: 1 });
 assert.ok(weekRows.some(row => row.includes('Ana'))); assert.ok(weekRows.some(row => row.includes('2026-10-16 (festivo)')));
 context.quadrant.action(week, 'pdf'); assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF');
 console.log('OK: XLS BIFF8 y PDF en tablas filtradas con etiquetas y numeros, y cuadrante con asignaciones y festivos.');
})().catch(error => { console.error(error); process.exitCode = 1; });

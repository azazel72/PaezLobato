const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ renderizarAccionPedidoDestino: () => '<button>Acción existente</button>' });
for (const file of ['terminal-productos-destino.js','terminal-destino-resumen.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../terminal/js', file), 'utf8'), context);
}
const group = { pedidoId:0, pedidoNumero:'ANÓNIMO', cliente:'Sin pedido', pedidoDestino:'ANONIMO', solicitadas:null, fabricadas:1, enviadasCliente:0, enviadasEnvinar:0, codigos:['<bota>'], botas:[{codigo:'<bota>',fabricacion_semanal_id:9}] };
const anonymous = context.renderizarResumenPedidoDestino(group);
assert.match(anonymous, /destino-pedido-card-anonimo/);
assert.match(anonymous, /Fabricación 9/);
assert.match(anonymous, /&lt;bota&gt;/);
assert.match(anonymous, /bi-arrow-repeat/);
assert.match(anonymous, /disabled/);
assert(!anonymous.includes('destino-pedido-cifras'), 'Anónimo no muestra contadores');
const normal = context.renderizarResumenPedidoDestino({...group,pedidoId:1,pedidoDestino:'C',solicitadas:10,fabricadas:4,enviadasCliente:2});
assert.match(normal, /Solicitadas: 10 · Fabricadas: 4 · Expedidas: 2/);
assert(!normal.includes('Envinadas:'));
assert.match(normal, /Acción existente/);
assert(!normal.includes('destino-pedido-destino'), 'Los contadores sustituyen la leyenda');
const envinado = context.renderizarResumenPedidoDestino({...group,pedidoId:2,pedidoDestino:'E',solicitadas:8,fabricadas:5,envinadas:3});
assert.match(envinado, /Envinadas: 3/);
assert(!envinado.includes('Expedidas:'));
console.log('OK: contadores, anónimo azul, trazabilidad visible y acciones existentes conservadas.');

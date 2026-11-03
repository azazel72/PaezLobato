const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ids = ['mover-botas-origen','mover-botas-destino','mover-botas-codigos','mover-botas-estado','modalMoverBotasPedido'];
const elements = Object.fromEntries(ids.map(id => [id,{value:'',textContent:''}]));
const requests = [];
const avisos = [];
let fail = false;
const context = vm.createContext({
    document:{getElementById:id=>elements[id]},
    crypto:{getRandomValues:array=>array.fill(12)},
    bootstrap:{Modal:{getOrCreateInstance:()=>({hide(){}})}},
    cargarResumenPedidosDestino:async()=>{},alert:mensaje=>avisos.push(mensaje),
    fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:!fail,json:async()=>fail?{ok:false,error:'Conflicto'}:{ok:true,cantidad:1}};},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../terminal/js/terminal-mover-botas-pedido.js'),'utf8'),context);
vm.runInContext("trasladoBotasPedido.pedidos=[{pedidoId:1,codigos:['A']},{pedidoId:2,codigos:['B']}];",context);
assert.deepEqual(Array.from(context.codigosTrasladoBotas(' A\nB; C, D|E ')),['A','B','C','D','E']);
const event={preventDefault(){},currentTarget:{querySelectorAll:()=>[]}};
(async()=>{
    elements['mover-botas-origen'].value='1'; elements['mover-botas-destino'].value='2';
    elements['mover-botas-codigos'].value='B';
    await context.confirmarTrasladoBotasPedido(event);
    assert.equal(requests.length,0,'No envía códigos ajenos al origen');
    elements['mover-botas-codigos'].value='A\nA';
    await context.confirmarTrasladoBotasPedido(event); assert.equal(requests.length,0,'No envía duplicados');
    elements['mover-botas-codigos'].value='A';
    fail=true; await context.confirmarTrasladoBotasPedido(event);
    assert.equal(elements['mover-botas-estado'].textContent,'Conflicto');
    fail=false; await context.confirmarTrasladoBotasPedido(event);
    assert.deepEqual(Object.keys(requests[1]).sort(),['codigos','destino_id','origen_id']);
    assert.deepEqual(requests[1].codigos,['A']);
    assert.equal(requests[1].origen_id,1); assert.equal(requests[1].destino_id,2);
    assert.deepEqual(avisos,['1 bota(s) correctamente transferida(s).']);
    console.log('OK: validación de códigos/origen, duplicados y petición sin motivo ni historial.');
})().catch(error=>{console.error(error);process.exitCode=1;});

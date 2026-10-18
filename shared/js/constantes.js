const wsScheme = location.protocol === "https:" ? "wss" : "ws";
const puertoWs = 5001;
const wsUrl = `${wsScheme}://${location.hostname}:${puertoWs}/ws`;
//const wsUrl = `${wsScheme}://212.227.228.46:${puertoWs}/ws`;

const MESES = [
  ["ene","Enero"],["feb","Febrero"],["mar","Marzo"],["abr","Abril"],
  ["may","Mayo"],["jun","Junio"],["jul","Julio"],["ago","Agosto"],
  ["sep","Septiembre"],["oct","Octubre"],["nov","Noviembre"],["dic","Diciembre"],
];

const pendingWsRequests = new Map();
const timeoutWsRequestMs = 10000;


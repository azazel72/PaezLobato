async function POST(url, body = {}) {
    try {
    console.info("[php] POST", url, body);
        const token = window.SharedAuthToken?.getToken?.();
        const res = await fetch(url, {
            method:"POST",
            credentials:"same-origin",
            headers:{
                "Content-Type":"application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        console.info("[php] POST respuesta", url, data);
        return data;
    } catch (error) {
        console.error("Error en la petición POST:", error);
    }
}

async function GET(url) {
    try {
    console.info("[php] GET", url);
        const token = window.SharedAuthToken?.getToken?.();
        const res = await fetch(url, {
            method:"GET",
            credentials:"same-origin",
            headers: token ? { "Authorization": `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        console.info("[php] GET respuesta", url, data);
        return data;
    } catch {
        throw new Error("Error de conexión al servidor");
    }
}

const genId = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

function diagnosticoAutenticacionWs() {
  const token = String(window.SharedAuthToken?.getToken?.() || "");
  const ws = conn && conn.socket;
  return {
    token_presente: Boolean(token),
    token_huella: token ? `${token.length}:${token.slice(-6)}` : null,
    pantalla: typeof pantallaActual !== "undefined" ? pantallaActual : null,
    websocket_estado: ws?.readyState ?? null,
  };
}

function construirWsUrl(urlBase) {
  const token = window.SharedAuthToken?.getToken?.();
  if (!token) return urlBase;

  const separador = urlBase.includes("?") ? "&" : "?";
  return `${urlBase}${separador}token=${encodeURIComponent(token)}`;
}

function conectar(url, { onOpen, onClose, onMessage, maxDelayMs = 15000 } = {}) {
  let ws, backoff = 500, closedByUser = false;

  const connect = () => {
    setWsState('connecting');
    const urlConexion = construirWsUrl(url);
    console.info("[ws-auth] conectando", diagnosticoAutenticacionWs());
    ws = new WebSocket(urlConexion);

    ws.onopen = () => {
      backoff = 500;
      console.info("[ws-auth] conectado", diagnosticoAutenticacionWs());
      onOpen?.(ws);
    };

    ws.onmessage = (ev) => onMessage?.(ev.data);

    ws.onclose = (event) => {
      console.warn("[ws-auth] desconectado", {
        ...diagnosticoAutenticacionWs(),
        codigo: event.code,
        motivo: event.reason || null,
        cierre_limpio: event.wasClean,
      });
      onClose?.();
      if (!closedByUser) {
        const delay = Math.min(backoff, maxDelayMs);
        setTimeout(connect, delay);
        backoff *= 2;
      }
    };

    ws.onerror = () => {
      console.warn("[ws-auth] error de WebSocket", diagnosticoAutenticacionWs());
      try { ws.close(); } catch {}
    };
  };

  connect();

  return {
    get socket() { return ws; },
    close() { closedByUser = true; try { ws?.close(); } catch {} },
  };
}

function send(action, data) {
  var msg = JSON.stringify({ action: action, data: data });
  var ws = conn && conn.socket;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
  else alert("No conectado al servidor.");
}

async function wsRequest(action, data={}) {
  return new Promise((resolve, reject) => {
    const requestId = genId();
    const msg = JSON.stringify({ action: action, data: data, request_id: requestId });
    const ws = conn && conn.socket;
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.debug("[ws-auth] solicitud", { action, request_id: requestId, ...diagnosticoAutenticacionWs() });
      pendingWsRequests.set(requestId, { resolve, reject });
      ws.send(msg);
      setTimeout(() => {
        if (pendingWsRequests.has(requestId)) {
          pendingWsRequests.delete(requestId);
          reject(new Error("Timeout en la solicitud WebSocket"));
        }
      }, timeoutWsRequestMs);
    } else {
      reject(new Error("WebSocket no está conectado"));
    }
  });
}

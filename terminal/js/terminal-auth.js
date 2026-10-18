const overlay = document.getElementById("login-overlay");
const box = document.getElementById("login-box");
const wsText = document.getElementById("ws-text");
const form = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("btn-logout");
const aliasToggleButton = document.getElementById("username-aliases-toggle");
const passInput = document.getElementById("password");
const userInput = document.getElementById("username");
const loginFeedback = document.getElementById("login-feedback");
const userAliasList = document.getElementById("username-aliases");

var conn = null;

const terminalAuthState = {
    autenticado: false,
    reconectando: false,
};

function conexionInicial() {
    conn = conectar(wsUrl, {
        onOpen: clienteConectado,
        onClose: clienteDesconectado,
        onMessage: routeMessage,
    });
    mostrarLogin();
    setFeedback("Esperando conexión con el servidor.");
}

function clienteConectado() {
    mostrarConectado();
    cargarAliasesDisponibles();
    setFeedback("Conexión establecida. Esperando inicio de sesión.");
    console.log("Conectado al servidor");
}

function clienteDesconectado() {
    terminalAuthState.autenticado = false;
    terminalAuthState.reconectando = true;
    mostrarDesconectado();
    mostrarLogin();
    setFeedback("Sin conexión con el servidor. Reintentando…", true);
    console.log("Desconectado del servidor");
}

function setWsState(state) {
    box.classList.remove("ws--connecting", "ws--open", "ws--closed");
    box.classList.add(`ws--${state}`);
    loginButton.disabled = state !== "open";

    if (state === "open") {
        wsText.textContent = "Conectado";
        return;
    }
    if (state === "closed") {
        wsText.textContent = "Desconectado";
        return;
    }
    wsText.textContent = terminalAuthState.reconectando ? "Reintentando conexión…" : "Conectando…";
}

function mostrarLogin() {
    overlay.hidden = false;
    userInput.disabled = false;
    passInput.disabled = false;
    if (!userInput.value.trim()) {
        setTimeout(() => userInput.focus(), 50);
    }
}

function ocultarLogin() {
    overlay.hidden = true;
}

function setAliasListOpen(isOpen) {
    if (!userAliasList || !aliasToggleButton) return;
    const hasAliases = userAliasList.childElementCount > 0;
    const shouldOpen = Boolean(isOpen) && hasAliases;
    userAliasList.hidden = !shouldOpen;
    aliasToggleButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function toggleAliasList() {
    if (!userAliasList) return;
    setAliasListOpen(userAliasList.hidden);
}

function enviarLogout() {
    window.SharedAuthToken?.clearToken?.();
    userInput.value = "";
    passInput.value = "";
    terminalAuthState.autenticado = false;
    terminalAuthState.reconectando = false;
    document.getElementById("nav-username").innerText = "Usuario";
    mostrarLogin();
}

async function cargarAliasesDisponibles() {
    try {
        const aliases = await wsRequest("lista_aliases_usuarios", {});
        actualizarListadoAliases(aliases);
    } catch (error) {
        console.warn("No se pudieron cargar los alias de usuarios:", error);
    }
}

function seleccionarAlias(alias) {
    userInput.value = alias;
    userInput.focus();
    setAliasListOpen(false);
}

function actualizarListadoAliases(aliases) {
    if (!userAliasList) return;

    userAliasList.innerHTML = "";
    if (!Array.isArray(aliases)) return;

    userAliasList.hidden = aliases.length === 0;
    setAliasListOpen(false);

    const vistos = new Set();
    for (const alias of aliases) {
        const texto = (alias || "").toString().trim();
        if (!texto || vistos.has(texto.toLowerCase())) continue;
        vistos.add(texto.toLowerCase());

        const button = document.createElement("button");
        button.type = "button";
        button.className = "login-alias-pill";
        button.textContent = texto;
        button.addEventListener("click", () => seleccionarAlias(texto));
        userAliasList.appendChild(button);
    }
}

if (aliasToggleButton) {
    aliasToggleButton.addEventListener("click", (event) => {
        event.preventDefault();
        toggleAliasList();
    });
}

document.addEventListener("click", (event) => {
    if (!userAliasList || !aliasToggleButton) return;
    if (userAliasList.hidden) return;
    const target = event.target;
    if (userAliasList.contains(target) || aliasToggleButton.contains(target) || userInput.contains(target)) return;
    setAliasListOpen(false);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setAliasListOpen(false);
});

function mostrarConectado() {
    setWsState("open");
}

function mostrarDesconectado() {
    setWsState("closed");
}

function setFeedback(texto, isError = false) {
    if (!loginFeedback) return;
    loginFeedback.textContent = texto || "";
    loginFeedback.classList.toggle("is-error", isError);
}

function enviarLogin() {
    const usuario = userInput.value.trim();
    const clave = passInput.value.trim();
    const ws = conn && conn.socket;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        mostrarLogin();
        mostrarDesconectado();
        setFeedback("No hay conexión con el servidor. Espera a la reconexión.", true);
        return;
    }

    if (!usuario || !clave) {
        setFeedback("Introduce usuario y clave.", true);
        return;
    }

    setFeedback("Validando credenciales…");
    send("login", { user: usuario, pass: clave });
}

function respuesta_login(response) {
    if (!response?.data) {
        terminalAuthState.autenticado = false;
        mostrarLogin();
        setFeedback("No se pudo iniciar sesión.", true);
        return;
    }

    const token = response.data.access_token || response.data.token || null;
    if (token) {
        window.SharedAuthToken?.setToken?.(token);
    }

    terminalAuthState.autenticado = true;
    terminalAuthState.reconectando = false;
    document.getElementById("nav-username").innerText = response.data.fullname || response.data.nombre || response.data.alias || "Usuario";
    actualizarListadoAliases(response.data.aliases);
    passInput.value = "";
    setFeedback("");
    ocultarLogin();
    enviarPantalla?.();
    console.log("Inicio de sesión exitoso:", response.data);
}

if (form) {
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        enviarLogin();
    });
}

if (loginButton) {
    loginButton.addEventListener("click", (event) => {
        event.preventDefault();
        enviarLogin();
    });
}

if (logoutButton) {
    logoutButton.addEventListener("click", (event) => {
        event.preventDefault();
        enviarLogout();
    });
}

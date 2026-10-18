function prepararEventosRecepcion() {
  document
    .querySelector("#vista_recepcion table#tabla_entradas_recepcion tbody")
    .addEventListener("click", function (event) {
      const fila = event.target.closest("tr");
      if (!fila) return;
      seleccionarRecepcion(fila);
    });

  document
    .querySelector("#vista_recepcion table#tabla_contenido_entrada_recepcion")
    .addEventListener("click", function (event) {
      const fila = event.target.closest("tr");
      if (!fila) return;
      seleccionarContenidoEntrada(fila);
    });
}

// Cache sencillo para maestros que necesitamos mostrar en recepción.
const terminalMaestros = {
  proveedores: null,
  materiales: null,
  tipos_producto: null,
};
let entradaRecepcionActualId = null;

async function asegurarMaestrosTerminal() {
  // Si ya los tenemos, no hacemos nada
  if (terminalMaestros.proveedores && terminalMaestros.materiales && terminalMaestros.tipos_producto) return;
  try {
    const [resp, fabricacion] = await Promise.all([wsRequest("maestros", {}), wsRequest("fabricacion", {})]);
    if (resp && resp.proveedores) terminalMaestros.proveedores = resp.proveedores;
    if (resp && resp.materiales) terminalMaestros.materiales = resp.materiales;
    if (fabricacion && fabricacion.tipos_producto) terminalMaestros.tipos_producto = fabricacion.tipos_producto;
    if (!terminalMaestros.proveedores) terminalMaestros.proveedores = {};
    if (!terminalMaestros.materiales) terminalMaestros.materiales = {};
    if (!terminalMaestros.tipos_producto) terminalMaestros.tipos_producto = {};
  } catch (err) {
    console.error("No se pudieron cargar maestros para terminal:", err);
    terminalMaestros.proveedores = terminalMaestros.proveedores || {};
    terminalMaestros.materiales = terminalMaestros.materiales || {};
    terminalMaestros.tipos_producto = terminalMaestros.tipos_producto || {};
  }
}

async function cargarEntradasRecepcion() {
  const tbody = document.querySelector("#tabla_entradas_recepcion tbody");
  try {
    await asegurarMaestrosTerminal();
    const añoActual = new Date().getFullYear();
    const entradas =
      (await wsRequest("listar_entradas_planificacion", { "año": añoActual, proveedor_id: null })) || [];
    const pendientes = entradas
      .filter((e) => !e.entregado && !e.anulado)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    tbody.innerHTML = "";
    if (!pendientes.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "No hay entradas pendientes";
      tr.appendChild(td);
      tbody.appendChild(tr);
      actualizarTablaLineas([], null);
      return;
    }

    pendientes.forEach((e) => {
      const tr = document.createElement("tr");
      tr.dataset.entradaId = e.id;
      tr.dataset.numero = e.numero || e.id;
      tr.dataset.fecha = e.fecha;
      tr.dataset.proveedorId = e.proveedor_id;
      const prov =
        terminalMaestros.proveedores?.[e.proveedor_id]?.nombre ||
        (typeof e.proveedor_id !== "undefined" ? String(e.proveedor_id) : "");
      tr.dataset.proveedorNombre = prov;
      tr.innerHTML = `
        <td>${e.numero || e.id}</td>
        <td>${formatearFechaEuropea(e.fecha)}</td>
        <td>${prov}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="3">Error al cargar entradas</td></tr>`;
  }
}

function seleccionarRecepcion(fila) {
  const vista_recepcion = document.getElementById("vista_recepcion");
  vista_recepcion.setAttribute("modo", "contenido_entrada");

  const entradaId = Number(fila.dataset.entradaId);
  entradaRecepcionActualId = entradaId;
  const numero = fila.dataset.numero || entradaId;
  const fecha = formatearFechaEuropea(fila.dataset.fecha);
  const proveedorNombre = fila.dataset.proveedorNombre || fila.children?.[2]?.textContent || "";
  const titulo = `Entrada ${numero}, ${fecha}${proveedorNombre ? ", " + proveedorNombre : ""}`;
  document.querySelector(".entrada_recepcion_seleccionado").textContent = titulo;

  cargarLineasRecepcion(entradaId);
}

function seleccionarContenidoEntrada(fila) {
  if (fila.closest("tfoot")) {
    const vista_recepcion = document.getElementById("vista_recepcion");
    vista_recepcion.setAttribute("modo", "listado_entradas");
  } else {
    verificarLineaEntradaRecepcion(fila);
  }
}

function verificarLineaEntradaRecepcion(fila) {
  const descripcion = fila.dataset.lineaDescripcion || fila.children?.[0]?.textContent || "";
  const bultosPrevistos = fila.dataset.bultos || "0";
  const kilosPrevistos = fila.dataset.kilos || "0";
  const bultosEntregados = fila.dataset.bultosEntregados || bultosPrevistos;

  const material = document.getElementById("materialEtiqueta");
  const bultosPrev = document.getElementById("recepcion-bultos-previstos");
  const kilosPrev = document.getElementById("recepcion-kilos-previstos");
  const bultosRec = document.getElementById("recepcion-bultos-recibidos");
  const btnConfirmar = document.getElementById("recepcion-confirmar-verificacion");

  if (material) material.textContent = descripcion;
  if (bultosPrev) bultosPrev.value = bultosPrevistos;
  if (kilosPrev) kilosPrev.value = kilosPrevistos;
  if (bultosRec) bultosRec.value = bultosEntregados;
  if (btnConfirmar) {
    btnConfirmar.dataset.lineaId = fila.dataset.lineaId || "";
  }

  const modal = new bootstrap.Modal(document.getElementById("miModal"));
  modal.show();
}

async function cargarLineasRecepcion(entradaId) {
  const tbody = document.querySelector("#tabla_contenido_entrada_recepcion tbody");
  try {
    const lineas = (await wsRequest("listar_lineas_entrada", { entrada_id: entradaId })) || [];
    actualizarTablaLineas(lineas);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4">Error al cargar lineas</td></tr>`;
  }
}

function actualizarTablaLineas(lineas) {
  const tbody = document.querySelector("#tabla_contenido_entrada_recepcion tbody");
  tbody.innerHTML = "";
  if (!lineas || !lineas.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Sin lineas";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  lineas.forEach((l) => {
    const tr = document.createElement("tr");
    tr.dataset.lineaId = l.id ?? "";
    tr.dataset.tipoProductoId = l.tipo_producto_id ?? "";
    tr.dataset.materialId = l.material_id ?? "";
    tr.dataset.bultos = l.bultos ?? 0;
    tr.dataset.kilos = l.kilos ?? 0;
    tr.dataset.bultosEntregados = l.bultos_entregados ?? 0;
    const tipo = terminalMaestros.tipos_producto?.[l.tipo_producto_id]?.descripcion || "";
    const material = terminalMaestros.materiales?.[l.material_id]?.descripcion || "";
    const descripcion = [tipo, material].filter(Boolean).join(" | ");
    tr.dataset.lineaDescripcion = descripcion;
    tr.innerHTML = `
      <td>${descripcion}</td>
      <td>${l.kilos ?? ""}</td>
      <td>${l.bultos ?? ""}</td>
      <td><i class="bi bi-check-circle"></i></td>
    `;
    tbody.appendChild(tr);
  });
}

function formatearFechaEuropea(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

document.addEventListener("click", async (event) => {
  const btn = event.target.closest("#recepcion-confirmar-verificacion");
  if (!btn) return;
  const lineaId = Number(btn.dataset.lineaId || 0);
  if (!lineaId) return;

  const bultosRec = Number(document.getElementById("recepcion-bultos-recibidos")?.value || 0);
  if (bultosRec < 0) {
    alert("Los valores recibidos no pueden ser negativos.");
    return;
  }

  try {
    await wsRequest("modificar_maestro", { tabla: "lineas_entrada", id: lineaId, campo: "bultos_entregados", valor: bultosRec });
    await wsRequest("modificar_maestro", { tabla: "lineas_entrada", id: lineaId, campo: "verificado", valor: true });
    const modalEl = document.getElementById("miModal");
    const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
    if (modal) modal.hide();
    const vista_recepcion = document.getElementById("vista_recepcion");
    const modo = vista_recepcion?.getAttribute("modo");
    if (modo === "contenido_entrada" && entradaRecepcionActualId) {
      await cargarLineasRecepcion(entradaRecepcionActualId);
    }
  } catch (err) {
    console.error(err);
    alert("No se pudo verificar la linea.");
  }
});

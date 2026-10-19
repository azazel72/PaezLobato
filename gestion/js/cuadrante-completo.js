'use strict';

const GestionCuadranteCompleto = {
    key: 'cuadrantes',
    opening: false,
    async open() {
        if (windows.has(this.key)) { focusWindow(this.key); return; }
        if (this.opening) return;
        this.opening = true;
        try {
            const response = await fetch('vistas/cuadrante-completo.html?v=20261019d', { cache: 'no-store' });
            if (!response.ok) throw new Error('No se pudo cargar la vista del cuadrante completo.');
            const mount = document.createElement('div'); mount.innerHTML = await response.text(); const root = mount.firstElementChild;
            const entry = createWindow(this.key, 'Cuadrante', 'calendar2-week', root); if (!entry) return;
            entry.content = root; entry.locked = true; entry.dragToken = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
            const get = name => root.querySelector(`[data-cc="${name}"]`);
            entry.get = get; entry.date = get('date'); entry.date.value = GestionUI.today();
            entry.status = message => { get('status').textContent = message; };
            entry.refreshUI = () => this.render(entry);
            entry.busy = () => {
                const busy = !!entry.pending || !!entry.loading;
                root.classList.toggle('cc-busy', busy);
                root.querySelectorAll('.cc-toolbar button, .cc-toolbar input, .cc-preferences input, .cc-pool input').forEach(control => { control.disabled = busy; });
            };
            entry.reload = async (date = entry.date.value) => {
                if (entry.pending || entry.loading || !entry.date.reportValidity()) return;
                entry.loading = true; entry.busy(); entry.status('Cargando…');
                try {
                    const data = await GestionUI.request(this.key, null, { fecha: date });
                    if (windows.get(this.key) !== entry) return;
                    entry.state = data; entry.date.value = data.inicio; this.render(entry); GestionUI.stamp(root); entry.status('Datos actualizados');
                } catch (error) { if (entry.state) entry.date.value = entry.state.inicio; entry.status('Error de carga'); notify(error.message, true); }
                finally { entry.loading = false; entry.busy(); }
            };
            entry.mutate = async payload => {
                if (entry.pending || entry.loading || !entry.state) { notify('Espera a que termine la operación.'); return false; }
                entry.pending++; entry.busy(); entry.status('Guardando…');
                try {
                    entry.state = await GestionUI.request(this.key, { inicio: entry.state.inicio, version: entry.state.version, ...payload });
                    this.render(entry); GestionUI.stamp(root); entry.status('Cambio guardado'); return true;
                } catch (error) { entry.status('Cambio no guardado · Actualiza si el cuadrante ha cambiado'); notify(error.message, true); return false; }
                finally { entry.pending--; entry.busy(); }
            };
            get('people-search').addEventListener('input', () => this.renderPool(entry));
            for (const [name, cls] of [['uniform-color', 'cc-uniform-color'], ['uniform-width', 'cc-uniform-width'], ['absences', 'cc-show-absences']]) get(name).addEventListener('change', event => root.classList.toggle(cls, event.target.checked));
            root.querySelector('.cc-toolbar').addEventListener('click', event => {
                const action = event.target.closest('[data-cc-action]')?.dataset.ccAction;
                if (action && !entry.pending && !entry.loading) void this.action(entry, action);
            });
            entry.date.addEventListener('change', () => entry.reload());
            this.bindDrops(entry);
            GestionCuadranteAnchuras.bind(entry);
            entry.panel.maximize(); await entry.reload();
        } catch (error) { notify(error.message, true); }
        finally { this.opening = false; }
    },
    async action(entry, action) {
        const model = CuadranteCompletoModelo;
        if (action === 'refresh') return entry.reload();
        if (action === 'previous' || action === 'next') {
            if (!entry.state && !entry.date.reportValidity()) return;
            entry.date.value = model.addDays(entry.state?.inicio || entry.date.value, action === 'previous' ? -7 : 7);
            return entry.reload();
        }
        if (!entry.state) return;
        if (action === 'lock') {
            entry.locked = !entry.locked;
            const lock = entry.content.querySelector('[data-cc-action="lock"]'); lock.setAttribute('aria-pressed', String(!entry.locked));
            lock.title = entry.locked ? 'Desbloquear edición en tabla' : 'Bloquear edición en tabla'; lock.setAttribute('aria-label', lock.title);
            lock.innerHTML = `<i class="bi bi-${entry.locked ? 'lock-fill' : 'unlock'}"></i>`;
            entry.get('hint').textContent = entry.locked ? 'Edición en tabla bloqueada · Asignar usuario mediante formulario' : 'Arrastra empleados, fichas o cabeceras de día · Los cambios se guardan al instante';
            this.render(entry); return;
        }
        if (action === 'assign') return this.assignForm(entry);
        if (action === 'clone') return this.cloneForm(entry);
        if (action === 'clear' && window.confirm('¿Quitar todas las asignaciones de esta semana?')) return entry.mutate({ action: 'clear' });
        if (action === 'extend' && window.confirm('Se copiará el jueves al viernes, lunes, martes y miércoles, reemplazando esos días y rotando los batideros. Los festivos se conservan. ¿Continuar?')) return entry.mutate({ action: 'extend' });
        if (action === 'csv') return this.exportCSV(entry);
        if (action === 'xls' || action === 'pdf') {
            try {
                const [head, ...body] = this.exportRows(entry);
                GestionListadosExportar.exportSnapshot({ title: 'Cuadrante', legend: `${entry.state.inicio} — ${entry.state.fin}`, leading: 1, columns: head.map(title => ({ title })), rows: body.map(values => ({ summary: false, values })) }, `cuadrante_${entry.state.inicio}`, action);
            } catch (error) { notify(error.message, true); }
            return;
        }
        if (action === 'print') return this.print(entry);
    },
    pill(entry, userId, detail = null) {
        const model = CuadranteCompletoModelo; const state = entry.state;
        const user = state.usuarios.find(u => Number(u.id) === Number(userId));
        const pill = document.createElement('div'); pill.className = 'cc-pill'; pill.style.setProperty('--cc-hue', String(Number(userId) * 47 % 360));
        pill.draggable = !entry.locked; pill.dataset.ccUser = userId;
        if (detail) pill.dataset.ccDetail = detail.id;
        pill.classList.toggle('cc-inactive', !Number(user?.activo));
        pill.classList.toggle('cc-used', state.details.some(d => Number(d.usuario_id) === Number(userId)));
        const name = document.createElement(detail ? 'span' : 'button'); if (!detail) name.type = 'button'; name.className = 'cc-person-name';
        name.textContent = `${user?.codigo ? user.codigo + ' · ' : ''}${model.name(state, userId)}`;
        if (!detail) {
            name.title = 'Asignar empleado mediante formulario';
            name.addEventListener('click', () => this.assignForm(entry, null, null, userId));
        }
        pill.append(name);
        const coverage = model.coverage(state, userId); const missing = coverage.filter(d => !d.holiday && !d.assigned);
        const dot = document.createElement('span'); dot.className = 'cc-absence-dot'; dot.hidden = !missing.length;
        dot.classList.toggle('cc-partial', coverage[0].holiday || !!coverage[0].assigned); dot.title = missing.length ? 'Sin asignar: ' + missing.map(d => d.date).join(', ') : 'Semana cubierta'; pill.append(dot);
        const marks = document.createElement('div'); marks.className = 'cc-day-marks';
        for (const day of coverage) { const mark = document.createElement('span'); mark.textContent = day.letter; mark.className = day.holiday ? 'cc-holiday-mark' : day.assigned ? 'cc-covered' : 'cc-missing'; mark.title = `${day.date} · ${day.holiday ? 'Festivo' : day.assigned ? 'Asignado' : 'Sin asignar'}`; marks.append(mark); }
        pill.append(marks);
        if (detail) {
            const remove = GestionUI.button('x', 'Quitar asignación', () => this.remove(entry, detail)); remove.className = 'cc-remove'; pill.append(remove);
        }
        return pill;
    },
    renderPool(entry) {
        if (!entry.state) return;
        const model = CuadranteCompletoModelo; const host = entry.get('people'); host.replaceChildren();
        const search = model.normalize(entry.get('people-search').value);
        const people = model.people(entry.state).filter(u => model.normalize(`${u.codigo || ''} ${u.nombre || ''} ${u.alias || ''}`).includes(search));
        for (const user of people) host.append(this.pill(entry, user.id));
        entry.get('pool-count').textContent = String(people.length);
    },
    render(entry) {
        const state = entry.state; if (!state) return;
        const model = CuadranteCompletoModelo; const days = model.days(state); const positions = model.positions(state);
        entry.get('week-title').textContent = `${state.inicio} — ${state.fin}`;
        const table = entry.content.querySelector('.cc-table'); const head = table.querySelector('thead'); const body = table.querySelector('tbody'); head.replaceChildren(); body.replaceChildren();
        const headers = document.createElement('tr'); const positionHeader = document.createElement('th'); positionHeader.scope = 'col'; positionHeader.textContent = 'Puesto'; positionHeader.className = 'cc-position'; headers.append(positionHeader);
        for (const day of days) {
            const th = document.createElement('th'); th.scope = 'col'; th.dataset.ccDate = day.date; th.className = day.holiday ? 'cc-holiday' : '';
            const label = document.createElement('div'); label.className = 'cc-day-header'; label.dataset.ccDay = day.date; label.draggable = !entry.locked && !day.holiday;
            label.textContent = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`));
            label.title = day.holiday ? 'Festivo · No admite asignaciones ni clonado' : 'Arrastra a otra cabecera para clonar este día';
            if (day.holiday) { const small = document.createElement('small'); small.textContent = 'Festivo'; label.append(small); }
            th.append(label); headers.append(th);
        }
        head.append(headers);
        for (const position of positions) {
            const tr = document.createElement('tr'); tr.classList.toggle('cc-inactive-row', !Number(position.activo));
            const name = document.createElement('th'); name.scope = 'row'; name.className = 'cc-position'; name.textContent = position.nombre; tr.append(name);
            for (const day of days) {
                const cell = document.createElement('td'); cell.dataset.ccDate = day.date; cell.dataset.ccPosition = position.id; cell.className = day.holiday ? 'cc-holiday' : '';
                const slot = document.createElement('div'); slot.className = 'cc-slot';
                const details = state.details.filter(d => d.fecha === day.date && Number(d.puesto_id) === Number(position.id));
                for (const detail of details) slot.append(this.pill(entry, detail.usuario_id, detail));
                if (!details.length) { const blank = document.createElement('span'); blank.className = 'cc-empty'; blank.textContent = day.holiday ? 'Festivo' : 'Sin asignar'; slot.append(blank); }
                cell.append(slot); tr.append(cell);
            }
            body.append(tr);
        }
        this.renderPool(entry);
        GestionCuadranteAnchuras.table(entry);
        entry.get('count').textContent = `${state.details.length} asignaciones · ${new Set(state.details.map(d => String(d.usuario_id))).size} empleados`;
    },
    dragData(event) {
        try { return JSON.parse(event.dataTransfer.getData('application/x-gestion-cuadrante-completo')); } catch { return null; }
    },
    bindDrops(entry) {
        const root = entry.content; const type = 'application/x-gestion-cuadrante-completo';
        const clear = () => root.querySelectorAll('.cc-drag-source,.cc-drop,.cc-column-source,.cc-column-target').forEach(el => el.classList.remove('cc-drag-source', 'cc-drop', 'cc-column-source', 'cc-column-target'));
        const mark = (date, cls) => root.querySelectorAll('[data-cc-date]').forEach(el => { if (el.dataset.ccDate === date) el.classList.add(cls); });
        root.addEventListener('dragstart', event => {
            if (entry.locked || entry.pending || entry.loading || !entry.state) { event.preventDefault(); return; }
            const pill = event.target.closest('.cc-pill'); const day = event.target.closest('[data-cc-day]');
            let payload;
            if (pill) payload = { user: Number(pill.dataset.ccUser), detail: pill.dataset.ccDetail ? Number(pill.dataset.ccDetail) : null };
            else if (day) { payload = { day: day.dataset.ccDay }; mark(payload.day, 'cc-column-source'); }
            if (!payload) return;
            payload.token = entry.dragToken; payload.week = entry.state.inicio; payload.version = entry.state.version;
            event.dataTransfer.setData(type, JSON.stringify(payload)); event.dataTransfer.effectAllowed = payload.day ? 'copy' : 'move'; event.target.classList.add('cc-drag-source');
        });
        root.addEventListener('dragover', event => {
            if (entry.locked || entry.pending || entry.loading || !event.dataTransfer.types.includes(type)) return;
            const cell = event.target.closest('td[data-cc-position]'); const header = event.target.closest('th[data-cc-date]'); const pool = event.target.closest('[data-cc="pool-zone"]');
            const date = cell?.dataset.ccDate || header?.dataset.ccDate;
            if (date && entry.state.festivos.includes(date)) return;
            if (cell || header || pool) { event.preventDefault(); event.dataTransfer.dropEffect = header ? 'copy' : 'move'; (cell || pool)?.classList.add('cc-drop'); if (header) mark(date, 'cc-column-target'); }
        });
        root.addEventListener('dragleave', event => {
            const target = event.target.closest('.cc-drop'); if (target && !target.contains(event.relatedTarget)) target.classList.remove('cc-drop');
            const header = event.target.closest('th[data-cc-date]'); if (header && !header.contains(event.relatedTarget)) root.querySelectorAll('.cc-column-target').forEach(el => el.classList.remove('cc-column-target'));
        });
        root.addEventListener('drop', event => {
            const data = this.dragData(event); clear();
            if (!data || entry.locked || entry.pending || entry.loading) return;
            event.preventDefault();
            if (data.token !== entry.dragToken || data.week !== entry.state.inicio || data.version !== entry.state.version) { notify('La ficha pertenece a otra vista o a una versión anterior. Vuelve a arrastrarla.', true); return; }
            const cell = event.target.closest('td[data-cc-position]'); const header = event.target.closest('th[data-cc-date]');
            if (data.day && header) return this.cloneForm(entry, data.day, header.dataset.ccDate);
            const detail = data.detail ? entry.state.details.find(d => Number(d.id) === data.detail) : null;
            if (data.detail && !detail) { notify('La asignación ya no existe. Actualiza.', true); return; }
            if (data.user && cell) void this.assign(entry, data.user, Number(cell.dataset.ccPosition), cell.dataset.ccDate, detail);
            else if (detail && event.target.closest('[data-cc="pool-zone"]')) void this.remove(entry, detail);
        });
        root.addEventListener('dragend', clear);
        root.addEventListener('mouseover', event => { const th = event.target.closest('th[data-cc-date]'); if (th) mark(th.dataset.ccDate, 'cc-column-hover'); });
        root.addEventListener('mouseout', event => { const th = event.target.closest('th[data-cc-date]'); if (th && !th.contains(event.relatedTarget)) root.querySelectorAll('.cc-column-hover').forEach(el => el.classList.remove('cc-column-hover')); });
    },
    async assign(entry, user, position, date, detail = null, version = null) {
        const state = entry.state; const model = CuadranteCompletoModelo;
        if (!state || entry.pending || entry.loading) return false;
        if (version && version !== state.version) { notify('El cuadrante ha cambiado. Vuelve a abrir el formulario.', true); return false; }
        if (!model.days(state).some(day => day.date === date && !day.holiday)) { notify('No se puede asignar en festivos ni fuera de los días de trabajo.', true); return false; }
        const same = state.details.find(d => Number(d.usuario_id) === Number(user) && Number(d.puesto_id) === Number(position) && d.fecha === date);
        if (same) { notify('El empleado ya está asignado a esa celda.'); return false; }
        const conflicts = model.conflicts(state, user, date, detail?.id);
        if (conflicts.length) {
            const names = [...new Set(conflicts.map(d => state.puestos.find(p => Number(p.id) === Number(d.puesto_id))?.nombre || `Puesto ${d.puesto_id}`))].join(', ');
            if (!window.confirm(`El empleado ya está asignado ese día en: ${names}. ¿Asignarlo también a este puesto?`)) return false;
        }
        return entry.mutate({ action: 'assign', usuario_id: Number(user), puesto_id: Number(position), fecha: date, detail_id: detail?.id, allow_conflicts: !!conflicts.length });
    },
    async remove(entry, detail) {
        if (entry.pending || entry.loading) return false;
        if (!window.confirm(`¿Quitar a ${CuadranteCompletoModelo.name(entry.state, detail.usuario_id)} de esta asignación (${detail.fecha})?`)) return false;
        return entry.mutate({ action: 'remove', detail_id: detail.id });
    },
    dialog(entry, suffix, title, build, submit) {
        if (entry.pending || entry.loading || !entry.state) return;
        const key = `cc-${suffix}`; if (windows.has(key)) { focusWindow(key); return; }
        const form = document.createElement('form'); form.className = 'data-form cc-form';
        const heading = document.createElement('h2'); heading.textContent = title; form.append(heading);
        const controls = build(form); const actions = document.createElement('div'); actions.className = 'data-form-actions';
        const save = document.createElement('button'); save.type = 'submit'; save.className = 'primary-button'; save.textContent = 'Aplicar y guardar';
        const status = document.createElement('span'); status.setAttribute('role', 'status'); actions.append(save, status); form.append(actions);
        const child = createWindow(key, title, 'pencil', form, true); if (!child) return;
        child.panel.resize({ height: Math.min(520, desktop.clientHeight - 36) });
        const week = entry.state.inicio; const version = entry.state.version;
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (child.pending || !form.reportValidity()) return;
            if (windows.get(this.key) !== entry || entry.state.inicio !== week || entry.state.version !== version) { status.textContent = 'La semana ha cambiado. Vuelve a abrir el formulario.'; return; }
            child.pending++; save.disabled = true; status.textContent = 'Guardando…';
            try { if (await submit(controls, version)) { child.pending--; child.panel.close(); } else { child.pending--; status.textContent = 'No se han aplicado cambios.'; } }
            catch (error) { child.pending--; status.textContent = error.message; notify(error.message, true); }
            finally { save.disabled = false; }
        });
        form.querySelector('select,input')?.focus();
    },
    select(form, title, choices, value) {
        const label = document.createElement('label'); label.textContent = title; const select = document.createElement('select'); select.required = true;
        const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Selecciona…'; select.append(blank);
        for (const choice of choices) { const option = document.createElement('option'); option.value = choice.value; option.textContent = choice.label; select.append(option); }
        select.value = value ?? ''; label.append(select); form.append(label); return select;
    },
    assignForm(entry, position, date, user) {
        const model = CuadranteCompletoModelo; const days = model.days(entry.state).filter(d => !d.holiday);
        if (!days.length) { notify('Esta semana no tiene días de trabajo disponibles.'); return; }
        this.dialog(entry, `assign-${position || 'new'}`, 'Asignar usuario', form => {
            const employee = this.select(form, 'Empleado', model.people(entry.state).map(u => ({ value: u.id, label: `${u.codigo ? u.codigo + ' · ' : ''}${model.name(entry.state, u.id)}` })), user);
            const puesto = this.select(form, 'Puesto', model.positions(entry.state).map(p => ({ value: p.id, label: p.nombre })), position);
            const day = this.select(form, 'Día', days.map(d => ({ value: d.date, label: d.date })), days.some(d => d.date === date) ? date : days[0].date);
            return { employee, puesto, day };
        }, (controls, version) => this.assign(entry, controls.employee.value, controls.puesto.value, controls.day.value, null, version));
    },
    cloneForm(entry, from, to) {
        const days = CuadranteCompletoModelo.days(entry.state).filter(d => !d.holiday);
        if (days.length < 2) { notify('Se necesitan dos días no festivos para clonar.'); return; }
        if ((from && !days.some(d => d.date === from)) || (to && !days.some(d => d.date === to))) { notify('No se puede clonar desde o hacia un festivo.'); return; }
        if (from && from === to) return;
        this.dialog(entry, 'clone', 'Clonar día', form => {
            const choices = days.map(d => ({ value: d.date, label: d.date }));
            const origin = this.select(form, 'Origen', choices, from || days[0].date);
            const destination = this.select(form, 'Destino', choices, to || days[1].date);
            const label = document.createElement('label'); label.className = 'check-label'; const keep = document.createElement('input'); keep.type = 'checkbox'; label.append(keep, document.createTextNode('Mantener datos del destino (sin duplicarlos)')); form.append(label);
            const help = document.createElement('p'); help.textContent = 'Si no marcas esta opción, se reemplazarán todas las asignaciones del destino.'; form.append(help);
            return { origin, destination, keep };
        }, async c => {
            if (c.origin.value === c.destination.value) throw new Error('Elige días diferentes.');
            if (!c.keep.checked && !window.confirm('¿Reemplazar las asignaciones del día de destino?')) return false;
            return entry.mutate({ action: 'clone', from: c.origin.value, to: c.destination.value, keep: c.keep.checked });
        });
    },
    exportRows(entry) {
        const state = entry.state; const model = CuadranteCompletoModelo; const days = model.days(state);
        return [['Puesto', ...days.map(d => d.date + (d.holiday ? ' (festivo)' : ''))], ...model.positions(state).map(p => [p.nombre, ...days.map(day => state.details.filter(d => Number(d.puesto_id) === Number(p.id) && d.fecha === day.date).map(d => model.name(state, d.usuario_id)).join(', '))])];
    },
    exportCSV(entry) {
        const rows = this.exportRows(entry).map(row => row.map(CuadranteCompletoModelo.csv).join(';'));
        const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = `cuadrante_${entry.state.inicio}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    print(entry) {
        const escape = CuadranteCompletoModelo.html; const rows = this.exportRows(entry); const [head, ...body] = rows;
        const frame = document.createElement('iframe'); frame.hidden = true; frame.title = 'Imprimir cuadrante';
        frame.onload = () => { frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true }); frame.contentWindow.focus(); frame.contentWindow.print(); };
        frame.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuadrante ${escape(entry.state.inicio)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial;color:#233536}h1{font-size:20px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #aebcad;padding:8px;vertical-align:top;overflow-wrap:anywhere}th{background:#edf2e9;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}p{line-height:1.5}</style></head><body><h1>Cuadrante</h1><p>${escape(entry.state.inicio)} — ${escape(entry.state.fin)}</p><table><thead><tr>${head.map(v => `<th>${escape(v)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(v => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
        entry.content.append(frame);
    },
};


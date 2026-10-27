// Floating status panel for slow work (bulk queue, approvals, imports, scans, single AI calls), so a
// request that takes a minute never looks like nothing happened. Also guards against double clicks.

const COLLAPSE_KEY = 'stcg_tasks_collapsed';
const LINGER_MS = 4000;
const LINGER_ERROR_MS = 10000;

/** @type {Map<number, object>} */
const tasks = new Map();
let nextId = 1;
let panel = null;
let timer = null;

function isCollapsed() {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

function setCollapsed(value) {
    try { localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0'); } catch { /* private mode */ }
}

function elapsed(task) {
    const seconds = Math.floor(((task.finishedAt || Date.now()) - task.startedAt) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function percent(task) {
    return task.total ? Math.min(100, Math.round(task.done / task.total * 100)) : null;
}

function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'stcg_tasks';
    panel.className = 'stcg-tasks';
    panel.innerHTML = `
        <div class="stcg-tasks-head" title="Collapse / expand">
            <i class="stcg-tasks-icon"></i>
            <span class="stcg-tasks-title"></span>
            <i class="fa-solid fa-chevron-down stcg-tasks-chevron"></i>
        </div>
        <div class="stcg-tasks-list"></div>`;
    panel.querySelector('.stcg-tasks-head').addEventListener('click', () => {
        setCollapsed(!isCollapsed());
        render();
    });
    panel.querySelector('.stcg-tasks-list').addEventListener('click', e => {
        const button = /** @type {HTMLElement} */ (e.target).closest('[data-stop]');
        if (button) tasks.get(Number(button.getAttribute('data-stop')))?.onStop?.();
    });
    return panel;
}

/** Modal dialogs sit in the browser's top layer, so the panel moves into the topmost open one to stay visible. */
function place() {
    const dialog = Array.from(document.querySelectorAll('dialog[open]:not([closing])')).pop();
    const parent = dialog || document.body;
    if (panel.parentElement !== parent) parent.appendChild(panel);
}

/** Updates a task's row in place (rebuilding it every tick would swallow clicks on Stop). */
function renderTask(list, task) {
    let row = list.querySelector(`[data-task="${task.id}"]`);
    if (!row) {
        row = document.createElement('div');
        row.setAttribute('data-task', String(task.id));
        row.innerHTML = `
            <div class="stcg-task-top">
                <span class="stcg-task-label"></span>
                <span class="stcg-task-meta"></span>
                <i class="fa-solid fa-stop stcg-task-stop" data-stop="${task.id}" title="Stop"></i>
            </div>
            <div class="stcg-task-bar"><div></div></div>
            <div class="stcg-task-detail"></div>`;
        list.appendChild(row);
    }
    const pct = percent(task);
    const counts = task.total ? `${task.done}/${task.total} · ${pct}% · ` : '';
    row.className = `stcg-task${task.finished ? ' done' : ''}${task.error ? ' failed' : ''}`;
    row.querySelector('.stcg-task-label').textContent = task.label;
    row.querySelector('.stcg-task-meta').textContent = `${counts}${elapsed(task)}`;
    /** @type {HTMLElement} */ (row.querySelector('.stcg-task-stop')).hidden = !task.onStop || task.finished;
    row.querySelector('.stcg-task-bar').classList.toggle('indeterminate', pct === null && !task.finished);
    /** @type {HTMLElement} */ (row.querySelector('.stcg-task-bar > div')).style.width = `${task.finished ? 100 : (pct ?? 100)}%`;
    const detail = /** @type {HTMLElement} */ (row.querySelector('.stcg-task-detail'));
    detail.textContent = task.detail || '';
    detail.hidden = !task.detail;
}

function render() {
    if (!tasks.size) {
        clearInterval(timer);
        timer = null;
        panel?.remove();
        return;
    }
    ensurePanel();
    place();
    // Ticks the elapsed time (and re-homes the panel when a dialog opens or closes).
    timer ??= setInterval(render, 1000);

    const all = [...tasks.values()];
    const running = all.filter(t => !t.finished);
    const failed = all.some(t => t.error);
    const collapsed = isCollapsed();
    panel.classList.toggle('collapsed', collapsed);
    panel.querySelector('.stcg-tasks-icon').className = `stcg-tasks-icon fa-solid ${running.length ? 'fa-gear fa-spin' : failed ? 'fa-triangle-exclamation' : 'fa-check'}`;
    const first = running[0];
    const summary = first && collapsed
        ? ` · ${first.label}${percent(first) !== null ? ` ${percent(first)}%` : ''} · ${elapsed(first)}`
        : '';
    panel.querySelector('.stcg-tasks-title').textContent = running.length
        ? `Card Generator: ${running.length} running${summary}`
        : 'Card Generator: done';
    const list = panel.querySelector('.stcg-tasks-list');
    for (const row of Array.from(list.children)) {
        if (!tasks.has(Number(row.getAttribute('data-task')))) row.remove();
    }
    for (const task of all) renderTask(list, task);
}

/**
 * Shows a task in the panel until it finishes.
 * @param {string} label What is running, e.g. "Bulk generation"
 * @param {object} [options]
 * @param {number} [options.total] Number of steps; 0 shows an indeterminate bar
 * @param {string} [options.detail] Current step
 * @param {() => void} [options.onStop] Shows a Stop button
 */
export function startTask(label, { total = 0, detail = '', onStop = null } = {}) {
    const task = { id: nextId++, label, total, done: 0, detail, onStop, startedAt: Date.now(), finishedAt: 0, finished: false, error: false };
    tasks.set(task.id, task);
    render();
    return {
        /** @param {{label?: string, total?: number, done?: number, detail?: string}} patch */
        update(patch) {
            if (task.finished) return;
            Object.assign(task, patch);
            render();
        },
        finish(detail = 'Done.', { error = false } = {}) {
            if (task.finished) return;
            Object.assign(task, { finished: true, finishedAt: Date.now(), error, detail });
            render();
            setTimeout(() => { tasks.delete(task.id); render(); }, error ? LINGER_ERROR_MS : LINGER_MS);
        },
    };
}

const runningActions = new Set();

export function isRunning(key) {
    return runningActions.has(key);
}

/**
 * Runs an action at most once at a time. While it runs, body gets `stcg-running-<key>` so CSS can
 * disable the buttons that start it, wherever they are rendered.
 */
export async function exclusive(key, fn) {
    if (runningActions.has(key)) {
        toastr.info('Already running. Progress is shown in the Card Generator panel.', 'Card Generator');
        return undefined;
    }
    runningActions.add(key);
    document.body.classList.add(`stcg-running-${key}`);
    try {
        return await fn();
    } finally {
        runningActions.delete(key);
        document.body.classList.remove(`stcg-running-${key}`);
    }
}

/**
 * Wraps a Popup onClosing handler so a second click on OK while the first is still saving is ignored.
 * SillyTavern's popup has no such guard, so double clicks created everything twice.
 */
export function guardClosing(handler) {
    let closing = false;
    return async (popup) => {
        if (closing) return false;
        closing = true;
        const result = popup.result;
        popup.dlg?.classList.add('stcg-closing');
        try {
            const ok = await handler(popup);
            // The ignored click cleared the popup's result; put it back so show() resolves correctly.
            if (ok) {
                popup.result = result;
                popup.value = result;
            }
            return ok;
        } finally {
            closing = false;
            popup.dlg?.classList.remove('stcg-closing');
        }
    };
}

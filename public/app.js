const state = {
  user: null,
  monthCursor: new Date(),
  logs: [],
  selectedDate: new Date().toISOString().slice(0, 10),
  editingId: null
};

const authView = document.getElementById('authView');
const dashboardView = document.getElementById('dashboardView');
const authForm = document.getElementById('authForm');
const registerBtn = document.getElementById('registerBtn');
const authMessage = document.getElementById('authMessage');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const logForm = document.getElementById('logForm');
const logDate = document.getElementById('logDate');
const logText = document.getElementById('logText');
const monthTitle = document.getElementById('monthTitle');
const calendarGrid = document.getElementById('calendarGrid');
const detailsList = document.getElementById('detailsList');
const detailsDateTitle = document.getElementById('detailsDateTitle');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');

document.getElementById('prevMonth').addEventListener('click', () => shiftMonth(-1));
document.getElementById('nextMonth').addEventListener('click', () => shiftMonth(1));
logoutBtn.addEventListener('click', logout);

authForm.addEventListener('submit', (e) => submitAuth(e, '/api/login'));
registerBtn.addEventListener('click', (e) => submitAuth(e, '/api/register'));
logForm.addEventListener('submit', submitLog);
cancelEditBtn.addEventListener('click', resetForm);

function monthKey(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(delta) {
  state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + delta, 1);
  loadLogs();
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

async function submitAuth(event, path) {
  event.preventDefault();
  authMessage.textContent = '';
  try {
    const payload = {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    };
    const data = await api(path, { method: 'POST', body: JSON.stringify(payload) });
    state.user = data.user;
    renderAuthState();
    await loadLogs();
  } catch (err) {
    authMessage.textContent = err.message;
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  state.user = null;
  renderAuthState();
}

function renderAuthState() {
  if (state.user) {
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    userEmail.textContent = state.user.email;
    logDate.value = state.selectedDate;
  } else {
    authView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

async function loadLogs() {
  const data = await api(`/api/logs?month=${monthKey(state.monthCursor)}`);
  state.logs = data.logs;
  renderCalendar();
  renderDetails(state.selectedDate);
}

function groupByDate(logs) {
  return logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {});
}

function renderCalendar() {
  const year = state.monthCursor.getFullYear();
  const month = state.monthCursor.getMonth();
  monthTitle.textContent = state.monthCursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  calendarGrid.innerHTML = '';

  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grouped = groupByDate(state.logs);

  for (let i = 0; i < startOffset; i++) {
    const filler = document.createElement('div');
    filler.className = 'day-cell outside';
    calendarGrid.appendChild(filler);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = `day-cell ${state.selectedDate === cellDate ? 'selected' : ''}`;
    cell.innerHTML = `<div class="day-number">${day}</div><div class="indicators"></div>`;
    const indicators = cell.querySelector('.indicators');

    (grouped[cellDate] || []).forEach((log) => {
      const bubble = document.createElement('span');
      bubble.className = 'indicator';
      bubble.style.background = log.indicator_color;
      bubble.textContent = log.indicator_letter;
      bubble.title = `${log.activity_type || 'unknown'} ${log.duration_minutes ? `(${log.duration_minutes}m)` : ''}`;
      indicators.appendChild(bubble);
    });

    cell.addEventListener('click', () => {
      state.selectedDate = cellDate;
      logDate.value = cellDate;
      renderCalendar();
      renderDetails(cellDate);
    });

    calendarGrid.appendChild(cell);
  }
}

function renderDetails(date) {
  const logs = state.logs.filter((log) => log.date === date);
  detailsDateTitle.textContent = date;
  detailsList.innerHTML = logs.length ? '' : '<li class="muted">No entries for this day yet.</li>';

  logs.forEach((log) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <strong>${log.activity_type || 'Unknown'}</strong>
      <div>${log.duration_minutes ? `${log.duration_minutes} min` : 'Duration N/A'}${log.category ? ` • ${log.category}` : ''}</div>
      <div class="muted">Raw: ${log.raw_text}</div>
      <div class="muted">Created: ${new Date(log.created_at).toLocaleString()} • Updated: ${new Date(log.updated_at).toLocaleString()}</div>
      <div class="row actions-row">
        <button data-edit="${log.id}" class="secondary">Edit</button>
        <button data-delete="${log.id}" class="secondary">Delete</button>
      </div>
    `;
    detailsList.appendChild(item);
  });

  detailsList.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(Number(btn.dataset.edit)));
  });
  detailsList.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => removeLog(Number(btn.dataset.delete)));
  });
}

function startEdit(id) {
  const log = state.logs.find((item) => item.id === id);
  if (!log) return;
  state.editingId = id;
  formTitle.textContent = 'Edit Workout';
  cancelEditBtn.classList.remove('hidden');
  logDate.value = log.date;
  logText.value = log.raw_text;
}

function resetForm() {
  state.editingId = null;
  formTitle.textContent = 'Add Workout';
  cancelEditBtn.classList.add('hidden');
  logDate.value = state.selectedDate;
  logText.value = '';
}

async function submitLog(event) {
  event.preventDefault();
  const payload = { date: logDate.value, raw_text: logText.value };
  if (!payload.date || !payload.raw_text) return;

  if (state.editingId) {
    await api(`/api/logs/${state.editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await api('/api/logs', { method: 'POST', body: JSON.stringify(payload) });
  }

  state.selectedDate = payload.date;
  resetForm();
  await loadLogs();
}

async function removeLog(id) {
  await api(`/api/logs/${id}`, { method: 'DELETE' });
  await loadLogs();
}

async function bootstrap() {
  try {
    const data = await api('/api/me');
    state.user = data.user;
    renderAuthState();
    if (state.user) {
      await loadLogs();
    }
  } catch {
    renderAuthState();
  }
}

bootstrap();

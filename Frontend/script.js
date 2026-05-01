// ⚠️ Change this to your deployed backend URL when going live
const API_URL ='https://backend-32gs.onrender.com';

// ─── STATE ───
let currentMonth = new Date();
let selectedDate  = new Date();
let allEvents     = {};        // { 'YYYY-MM-DD': [event, ...] }
let selectedColor = '#4285f4';
let reminderMap   = {};        // { eventId: timeoutId }
let notifGranted  = false;

// ─── BOOT ───
document.addEventListener('DOMContentLoaded', async () => {
    await requestNotifPermission();
    await loadAllEvents();
    renderCalendar();
    await renderEventsPanel(fmtDate(selectedDate));
    setupListeners();
});

// ─── NOTIFICATIONS ───
async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    notifGranted = p === 'granted';
}

function scheduleReminder(ev) {
    if (!ev.reminder || ev.reminder === 0 || !ev.time) return;
    const eventDT    = new Date(`${ev.date}T${ev.time}`);
    const reminderDT = new Date(eventDT.getTime() - ev.reminder * 60000);
    const delay      = reminderDT - Date.now();
    if (delay <= 0) return;

    cancelReminder(ev._id);
    reminderMap[ev._id] = setTimeout(() => {
        if (notifGranted) {
            new Notification(`⏰ ${ev.title}`, {
                body: `Starts in ${fmtReminderLabel(ev.reminder)}${ev.description ? '\n' + ev.description : ''}`,
                icon: '/favicon.ico'
            });
        }
    }, delay);
}

function cancelReminder(id) {
    if (reminderMap[id]) { clearTimeout(reminderMap[id]); delete reminderMap[id]; }
}

// ─── API ───
async function loadAllEvents() {
    try {
        const res  = await fetch(`${API_URL}/all`);
        const data = await res.json();
        if (!data.success) return;
        allEvents = {};
        data.events.forEach(ev => {
            (allEvents[ev.date] = allEvents[ev.date] || []).push(ev);
            scheduleReminder(ev);
        });
    } catch { showToast('Cannot reach server'); }
}

async function fetchByDate(dateStr) {
    try {
        const res  = await fetch(`${API_URL}/${dateStr}`);
        const data = await res.json();
        return data.success ? data.events : [];
    } catch { return []; }
}

async function apiCreate(payload) {
    const r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return r.json();
}

async function apiUpdate(id, payload) {
    const r = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return r.json();
}

async function apiDelete(id) {
    const r = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    return r.json();
}

// ─── CALENDAR RENDER ───
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function renderCalendar() {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    document.getElementById('monthYear').textContent = `${MONTHS[m]} ${y}`;

    const grid      = document.getElementById('calGrid');
    const today     = new Date();
    const firstDay  = new Date(y, m, 1).getDay();
    const daysInMo  = new Date(y, m + 1, 0).getDate();
    const prevDays  = new Date(y, m, 0).getDate();
    grid.innerHTML  = '';

    // prev-month filler
    for (let i = firstDay - 1; i >= 0; i--) {
        const date = new Date(y, m, -i);
        const dateStr = fmtDate(date);
        const events  = allEvents[dateStr] || [];
        const dots    = events.slice(0, 3).map(e =>
            `<div class="dot" style="background:${e.color || '#4285f4'}"></div>`
        ).join('');
        const cell = makeCell(date.getDate(), dateStr, true, fmtDate(today) === dateStr, fmtDate(selectedDate) === dateStr, dots);
        cell.addEventListener('click', () => selectDate(date));
        grid.appendChild(cell);
    }

    // current month
    for (let d = 1; d <= daysInMo; d++) {
        const dateStr  = fmtDateParts(y, m, d);
        const isToday  = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
        const isSel    = selectedDate.getFullYear() === y && selectedDate.getMonth() === m && selectedDate.getDate() === d;
        const events   = allEvents[dateStr] || [];
        const dots     = events.slice(0, 3).map(e =>
            `<div class="dot" style="background:${e.color || '#4285f4'}"></div>`
        ).join('');

        const cell = makeCell(d, dateStr, false, isToday, isSel, dots);
        cell.addEventListener('click', () => selectDate(new Date(y, m, d)));
        grid.appendChild(cell);
    }

    // next-month filler
    const total = Math.ceil((firstDay + daysInMo) / 7) * 7;
    for (let i = 1; i <= total - firstDay - daysInMo; i++) {
        const date = new Date(y, m, daysInMo + i);
        const dateStr = fmtDate(date);
        const events  = allEvents[dateStr] || [];
        const dots    = events.slice(0, 3).map(e =>
            `<div class="dot" style="background:${e.color || '#4285f4'}"></div>`
        ).join('');
        const cell = makeCell(date.getDate(), dateStr, true, fmtDate(today) === dateStr, fmtDate(selectedDate) === dateStr, dots);
        cell.addEventListener('click', () => selectDate(date));
        grid.appendChild(cell);
    }
}

function makeCell(dayNum, dateStr, other, isToday, isSel, dots = '') {
    const div = document.createElement('div');
    div.className = 'cal-day' +
        (other    ? ' other-month' : '') +
        (isToday  ? ' today'       : '') +
        (isSel    ? ' selected'    : '');
    div.dataset.date = dateStr;
    div.innerHTML = `<div class="day-num">${dayNum}</div><div class="dots-row">${dots}</div>`;
    return div;
}

async function selectDate(date) {
    selectedDate = date;
    // Auto-navigate calendar if user clicked a filler date from another month
    if (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear()) {
        currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    }
    renderCalendar();
    await renderEventsPanel(fmtDate(date));
}

// ─── EVENTS PANEL ───
async function renderEventsPanel(dateStr) {
    const labelEl = document.getElementById('selectedDateLabel');
    const countEl = document.getElementById('eventCount');
    const listEl  = document.getElementById('eventsList');

    // Date label
    const d       = new Date(dateStr + 'T00:00:00');
    const isToday = fmtDate(new Date()) === dateStr;
    const opts    = { weekday: 'short', month: 'long', day: 'numeric' };
    labelEl.textContent = (isToday ? 'Today — ' : '') + d.toLocaleDateString('en-US', opts);

    listEl.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;

    const events = await fetchByDate(dateStr);
    allEvents[dateStr] = events;

    countEl.textContent = events.length ? `${events.length} event${events.length > 1 ? 's' : ''}` : '';

    if (!events.length) {
        listEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-xmark"></i>
                <p>No events — tap <strong>+</strong> to add one</p>
            </div>`;
        return;
    }

    events.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    listEl.innerHTML = events.map(buildCard).join('');

    listEl.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', () => openEdit(btn.dataset.id)));
    listEl.querySelectorAll('.del-btn').forEach(btn =>
        btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}

function buildCard(ev) {
    const timeLabel = ev.time ? fmt12h(ev.time) : 'All day';
    const reminderBadge = ev.reminder
        ? `<span class="badge badge-reminder"><i class="fas fa-bell"></i>${fmtReminderLabel(ev.reminder)}</span>` : '';
    const recurBadge = ev.recurring && ev.recurring !== 'none'
        ? `<span class="badge badge-recurring"><i class="fas fa-redo"></i>${cap(ev.recurring)}</span>` : '';

    return `
    <div class="event-card" style="border-left-color:${ev.color || '#4285f4'}">
        <div class="card-body">
            <div class="card-title">${esc(ev.title)}</div>
            <div class="card-time"><i class="fas fa-clock"></i>${timeLabel}</div>
            ${ev.description ? `<div class="card-desc">${esc(ev.description)}</div>` : ''}
            <div class="card-badges">${reminderBadge}${recurBadge}</div>
        </div>
        <div class="card-actions">
            <button class="icon-btn edit-btn" data-id="${ev._id}" title="Edit">
                <i class="fas fa-pencil"></i>
            </button>
            <button class="icon-btn del-btn del" data-id="${ev._id}" title="Delete">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    </div>`;
}

// ─── MODAL ───
function openAdd() {
    document.getElementById('modalTitle').textContent  = 'New Event';
    document.getElementById('eventId').value           = '';
    document.getElementById('eventTitle').value        = '';
    document.getElementById('eventDate').value         = fmtDate(selectedDate);
    loadTimeIntoPicker('');
    document.getElementById('eventDescription').value  = '';
    document.getElementById('eventReminder').value     = '0';
    document.getElementById('eventRecurring').value    = 'none';
    setColor('#4285f4');
    showModal();
}

async function openEdit(id) {
    let ev = null;
    for (const arr of Object.values(allEvents)) {
        ev = arr.find(e => e._id === id);
        if (ev) break;
    }
    if (!ev) { showToast('Event not found'); return; }

    document.getElementById('modalTitle').textContent  = 'Edit Event';
    document.getElementById('eventId').value           = ev._id;
    document.getElementById('eventTitle').value        = ev.title;
    document.getElementById('eventDate').value         = ev.date;
    loadTimeIntoPicker(ev.time || '');
    document.getElementById('eventDescription').value  = ev.description || '';
    document.getElementById('eventReminder').value     = ev.reminder || '0';
    document.getElementById('eventRecurring').value    = ev.recurring || 'none';
    setColor(ev.color || '#4285f4');
    showModal();
}

function showModal() {
    document.getElementById('backdrop').classList.add('show');
    document.getElementById('eventModal').classList.add('show');
    document.getElementById('fabBtn').classList.add('open');
    setTimeout(() => document.getElementById('eventTitle').focus(), 350);
}

function hideModal() {
    document.getElementById('backdrop').classList.remove('show');
    document.getElementById('eventModal').classList.remove('show');
    document.getElementById('fabBtn').classList.remove('open');
    closeTimePicker();
}

function setColor(c) {
    selectedColor = c;
    document.querySelectorAll('.color-dot').forEach(d =>
        d.classList.toggle('active', d.dataset.color === c));
}

// ─── SAVE / DELETE ───
async function handleSave() {
    const id    = document.getElementById('eventId').value.trim();
    const title = document.getElementById('eventTitle').value.trim();
    const date  = document.getElementById('eventDate').value;

    if (!title) { showToast('Title is required'); document.getElementById('eventTitle').focus(); return; }
    if (!date)  { showToast('Date is required'); return; }

    const saveBtn = document.getElementById('saveEvent');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    const payload = {
        title,
        date,
        time:        document.getElementById('eventTime').value,
        description: document.getElementById('eventDescription').value.trim(),
        color:       selectedColor,
        reminder:    parseInt(document.getElementById('eventReminder').value) || 0,
        recurring:   document.getElementById('eventRecurring').value
    };

    try {
        const result = id ? await apiUpdate(id, payload) : await apiCreate(payload);

        if (result.success) {
            if (id) { cancelReminder(id); scheduleReminder(result.event); }
            else    { scheduleReminder(result.event); }
            showToast(id ? 'Event updated ✓' : 'Event added ✓');
            hideModal();
            await loadAllEvents();
            renderCalendar();
            await renderEventsPanel(fmtDate(selectedDate));
        } else {
            showToast(result.message || 'Something went wrong');
        }
    } catch { showToast('Network error. Try again.'); }
    finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Save';
    }
}

async function handleDelete(id) {
    // Find the event to check if it's part of a recurring group
    let targetEvent = null;
    for (const arr of Object.values(allEvents)) {
        targetEvent = arr.find(e => e._id === id);
        if (targetEvent) break;
    }

    if (targetEvent && targetEvent.groupId) {
        // Get count of group members
        try {
            const res   = await fetch(`${API_URL}/group/${targetEvent.groupId}/count`);
            const data  = await res.json();
            const count = data.success ? data.count : '?';
            showRdelDialog(
                `This event repeats. There are ${count} total occurrences.\nWhat do you want to delete?`,
                // Delete only this
                async () => {
                    await doDeleteOne(id);
                },
                // Delete all
                async () => {
                    await doDeleteGroup(targetEvent.groupId);
                }
            );
        } catch {
            showToast('Network error');
        }
    } else {
        // Non-recurring — simple confirm
        if (!confirm('Delete this event permanently?')) return;
        await doDeleteOne(id);
    }
}

async function doDeleteOne(id) {
    try {
        const res = await apiDelete(id);
        if (res.success) {
            cancelReminder(id);
            showToast('Event deleted');
            await loadAllEvents();
            renderCalendar();
            await renderEventsPanel(fmtDate(selectedDate));
        } else { showToast('Delete failed'); }
    } catch { showToast('Network error'); }
}

async function doDeleteGroup(groupId) {
    try {
        const res  = await fetch(`${API_URL}/group/${groupId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(`Deleted ${data.deletedCount} recurring events`);
            await loadAllEvents();
            renderCalendar();
            await renderEventsPanel(fmtDate(selectedDate));
        } else { showToast('Delete failed'); }
    } catch { showToast('Network error'); }
}

function showRdelDialog(msg, onThis, onAll) {
    document.getElementById('rdelMsg').textContent = msg;
    document.getElementById('rdelBackdrop').classList.add('show');
    document.getElementById('rdelBox').classList.add('show');

    const cleanup = () => {
        document.getElementById('rdelBackdrop').classList.remove('show');
        document.getElementById('rdelBox').classList.remove('show');
        document.getElementById('rdelThis').onclick   = null;
        document.getElementById('rdelAll').onclick    = null;
        document.getElementById('rdelCancel').onclick = null;
        document.getElementById('rdelBackdrop').onclick = null;
    };

    document.getElementById('rdelThis').onclick   = () => { cleanup(); onThis(); };
    document.getElementById('rdelAll').onclick    = () => { cleanup(); onAll(); };
    document.getElementById('rdelCancel').onclick = cleanup;
    document.getElementById('rdelBackdrop').onclick = cleanup;
}

// ─── CUSTOM TIME PICKER ───
let tpHour = 12, tpMin = 0, tpAmPm = 'AM', tpOpen = false;

function initTimePicker() {
    const display  = document.getElementById('timeDisplay');
    const dropdown = document.getElementById('timeDropdown');

    // Toggle open/close
    display.addEventListener('click', () => tpOpen ? closeTimePicker() : openTimePicker());
    display.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tpOpen ? closeTimePicker() : openTimePicker(); }
        if (e.key === 'Escape') closeTimePicker();
    });

    // Arrows
    document.getElementById('hourUp').addEventListener('click',   () => { tpHour = tpHour >= 12 ? 1 : tpHour + 1; renderTP(); });
    document.getElementById('hourDown').addEventListener('click', () => { tpHour = tpHour <= 1 ? 12 : tpHour - 1; renderTP(); });
    document.getElementById('minUp').addEventListener('click',    () => { tpMin  = tpMin  >= 59 ? 0 : tpMin + 1;  renderTP(); });
    document.getElementById('minDown').addEventListener('click',  () => { tpMin  = tpMin  <= 0 ? 59 : tpMin - 1;  renderTP(); });

    // AM / PM
    document.getElementById('amBtn').addEventListener('click', () => { tpAmPm = 'AM'; renderTP(); });
    document.getElementById('pmBtn').addEventListener('click', () => { tpAmPm = 'PM'; renderTP(); });

    // Apply
    document.getElementById('timeOk').addEventListener('click', () => {
        applyTime();
        closeTimePicker();
    });

    // Clear
    document.getElementById('timeClear').addEventListener('click', () => {
        document.getElementById('eventTime').value = '';
        const txt = document.getElementById('timeDisplayText');
        txt.textContent = 'Select time';
        txt.classList.remove('has-value');
        closeTimePicker();
    });

    // Close on outside click
    document.addEventListener('click', e => {
        if (tpOpen && !document.getElementById('timeDisplay').contains(e.target)
                   && !dropdown.contains(e.target)) {
            closeTimePicker();
        }
    });

    renderTP();
}

function openTimePicker() {
    tpOpen = true;
    document.getElementById('timeDisplay').classList.add('open');
    document.getElementById('timeDropdown').classList.add('show');
    renderTP();
}

function closeTimePicker() {
    tpOpen = false;
    document.getElementById('timeDisplay').classList.remove('open');
    document.getElementById('timeDropdown').classList.remove('show');
}

function renderTP() {
    document.getElementById('hourVal').textContent = String(tpHour).padStart(2, '0');
    document.getElementById('minVal').textContent  = String(tpMin).padStart(2, '0');
    document.getElementById('amBtn').classList.toggle('active', tpAmPm === 'AM');
    document.getElementById('pmBtn').classList.toggle('active', tpAmPm === 'PM');
}

function applyTime() {
    // Convert to 24h for storage
    let h24 = tpHour;
    if (tpAmPm === 'AM' && tpHour === 12) h24 = 0;
    if (tpAmPm === 'PM' && tpHour !== 12) h24 = tpHour + 12;

    const val = `${pad(h24)}:${pad(tpMin)}`;
    document.getElementById('eventTime').value = val;

    const txt = document.getElementById('timeDisplayText');
    txt.textContent = `${tpHour}:${pad(tpMin)} ${tpAmPm}`;
    txt.classList.add('has-value');
}

// Load existing 24h time value into picker state
function loadTimeIntoPicker(val24) {
    if (!val24) {
        tpHour = 12; tpMin = 0; tpAmPm = 'AM';
        const txt = document.getElementById('timeDisplayText');
        txt.textContent = 'Select time';
        txt.classList.remove('has-value');
        renderTP();
        return;
    }
    let [h, m] = val24.split(':').map(Number);
    tpAmPm = h >= 12 ? 'PM' : 'AM';
    tpHour = h % 12 || 12;
    tpMin  = m;
    renderTP();

    const txt = document.getElementById('timeDisplayText');
    txt.textContent = `${tpHour}:${pad(tpMin)} ${tpAmPm}`;
    txt.classList.add('has-value');
}

// ─── LISTENERS ───
function setupListeners() {
    initTimePicker();
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1); renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1); renderCalendar();
    });

    document.getElementById('fabBtn').addEventListener('click', openAdd);
    document.getElementById('closeModal').addEventListener('click', hideModal);
    document.getElementById('cancelModal').addEventListener('click', hideModal);
    document.getElementById('backdrop').addEventListener('click', hideModal);
    document.getElementById('saveEvent').addEventListener('click', handleSave);

    document.querySelectorAll('.color-dot').forEach(d =>
        d.addEventListener('click', () => setColor(d.dataset.color)));

    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideModal(); });
}

// ─── HELPERS ───
function fmtDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtDateParts(y, m, d) {
    return `${y}-${pad(m+1)}-${pad(d)}`;
}
function pad(n) { return String(n).padStart(2,'0'); }

function fmt12h(t) {
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${pad(m)} ${ap}`;
}

function fmtReminderLabel(min) {
    if (min < 60)   return `${min}m before`;
    if (min < 1440) return `${min/60}h before`;
    return `${min/1440}d before`;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function esc(t) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(t));
    return d.innerHTML;
}

let toastTimer;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/**
 * TaskCal — Full-Featured To-Do List & Calendar
 * A complete task management app with calendar views, categories, 
 * priorities, recurrence, reminders, drag-and-drop, and localStorage persistence.
 */

// ===== State =====
const STORAGE_KEY = 'taskcal_data';
const QUICK_TODO_KEY = 'taskcal_quick_todos';
let tasks = [];
let quickTodos = [];
let currentView = 'month';
let currentDate = new Date();
let selectedDate = null;
let activeCategory = 'all';
let searchQuery = '';
let editingTaskId = null;
let selectedColor = '#667eea';
let reminderTimers = {};

const CATEGORIES = {
  personal: { label: 'Personal', emoji: '👤', color: 'var(--cat-personal)' },
  work: { label: 'Work', emoji: '💼', color: 'var(--cat-work)' },
  health: { label: 'Health', emoji: '💪', color: 'var(--cat-health)' },
  finance: { label: 'Finance', emoji: '💰', color: 'var(--cat-finance)' },
  learning: { label: 'Learning', emoji: '📚', color: 'var(--cat-learning)' },
  social: { label: 'Social', emoji: '🎉', color: 'var(--cat-social)' },
};

const RECURRENCE_LABELS = {
  daily: '🔄 Daily',
  weekly: '🔄 Weekly',
  biweekly: '🔄 Bi-weekly',
  monthly: '🔄 Monthly',
  yearly: '🔄 Yearly',
};

// ===== DOM Helpers =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== Storage =====
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function saveQuickTodos() {
  localStorage.setItem(QUICK_TODO_KEY, JSON.stringify(quickTodos));
}

function loadQuickTodos() {
  try {
    const raw = localStorage.getItem(QUICK_TODO_KEY);
    if (raw) {
      quickTodos = JSON.parse(raw);
    }
  } catch {
    quickTodos = [];
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      tasks = JSON.parse(raw);
    }
  } catch {
    tasks = [];
  }
}

// ===== ID Generator =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ===== Date Helpers =====
function startOfDay(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(a, b) {
  const da = startOfDay(a);
  const db = startOfDay(b);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

function isToday(d) {
  return isSameDay(d, new Date());
}

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function toDateString(d) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function getWeekStart(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return startOfDay(date);
}

function getMonthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getDaysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function isOverdue(task) {
  if (task.completed) return false;
  const now = startOfDay(new Date());
  const taskDate = startOfDay(new Date(task.date));
  return taskDate < now;
}

function daysBetween(a, b) {
  const da = startOfDay(a);
  const db = startOfDay(b);
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

// ===== Recurrence Helpers =====
function generateRecurringDates(task) {
  if (!task.recurrence || task.recurrence === 'none') return [task.date];

  const startDate = new Date(task.date);
  const endDate = task.endDate ? new Date(task.endDate) : addDays(startDate, 365);
  const dates = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(toDateString(current));

    switch (task.recurrence) {
      case 'daily': current.setDate(current.getDate() + 1); break;
      case 'weekly': current.setDate(current.getDate() + 7); break;
      case 'biweekly': current.setDate(current.getDate() + 14); break;
      case 'monthly': current.setMonth(current.getMonth() + 1); break;
      case 'yearly': current.setFullYear(current.getFullYear() + 1); break;
      default: current.setDate(current.getDate() + 1);
    }
  }

  return dates;
}

function getFilteredTasks() {
  let filtered = tasks;

  if (activeCategory !== 'all') {
    filtered = filtered.filter(t => t.category === activeCategory);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }

  return filtered;
}

// ===== Rendering: Calendar Header =====
function renderCalendarHeader() {
  const dateEl = $('#current-date');
  const opts = { month: 'long', year: 'numeric' };

  if (currentView === 'month' || currentView === 'list') {
    dateEl.textContent = currentDate.toLocaleDateString('en-US', opts);
  } else if (currentView === 'week') {
    const weekStart = getWeekStart(currentDate);
    const weekEnd = addDays(weekStart, 6);
    const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    dateEl.textContent = `${startStr} — ${endStr}`;
  } else if (currentView === 'day') {
    dateEl.textContent = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
}

// ===== Rendering: Month View =====
function renderMonthView() {
  const container = $('#calendar-container');
  const filtered = getFilteredTasks();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(currentDate);
  const daysInPrevMonth = getDaysInMonth(new Date(year, month - 1));

  let html = '<div class="calendar-grid">';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  html += dayNames.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    let dayNum, dateObj, isOther = false;

    if (i < firstDay) {
      dayNum = daysInPrevMonth - firstDay + i + 1;
      dateObj = new Date(year, month - 1, dayNum);
      isOther = true;
    } else if (i >= firstDay + daysInMonth) {
      dayNum = i - firstDay - daysInMonth + 1;
      dateObj = new Date(year, month + 1, dayNum);
      isOther = true;
    } else {
      dayNum = i - firstDay + 1;
      dateObj = new Date(year, month, dayNum);
    }

    const dateStr = toDateString(dateObj);
    const todayClass = isToday(dateObj) ? ' today' : '';
    const otherClass = isOther ? ' other-month' : '';
    const selectedClass = selectedDate && isSameDay(dateObj, selectedDate) ? ' selected' : '';

    const dayTasks = filtered.filter(t => {
      const dates = generateRecurringDates(t);
      return dates.includes(dateStr);
    });

    html += `<div class="cal-day${todayClass}${otherClass}${selectedClass}" data-date="${dateStr}" 
              onclick="openDayPanel('${dateStr}')"
              ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${dateStr}')" ondragleave="handleDragLeave(event)">`;
    html += `<div class="day-number">${dayNum}</div>`;
    html += '<div class="day-tasks">';

    const maxShow = 3;
    dayTasks.slice(0, maxShow).forEach(task => {
      const completedClass = task.completed ? ' completed' : '';
      const highClass = task.priority === 'high' ? ' priority-high' : '';
      html += `<div class="day-task-chip${completedClass}${highClass}" 
                style="background: ${task.color || '#667eea'}"
                draggable="true" 
                ondragstart="handleDragStart(event, '${task.id}')"
                data-task-id="${task.id}"
                onclick="event.stopPropagation(); editTask('${task.id}')"
                title="${task.title}${task.time ? ' @ ' + formatTime(task.time) : ''}">${task.title}</div>`;
    });

    if (dayTasks.length > maxShow) {
      html += `<div class="day-more" onclick="openDayPanel('${dateStr}')">+${dayTasks.length - maxShow} more</div>`;
    }

    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// ===== Rendering: Week View =====
function renderWeekView() {
  const container = $('#calendar-container');
  const filtered = getFilteredTasks();
  const weekStart = getWeekStart(currentDate);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let html = '<div class="week-view">';
  html += '<div class="cal-header-cell" style="background: var(--bg-secondary)"></div>';

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const todayClass = isToday(day) ? ' today' : '';
    html += `<div class="week-header-cell${todayClass}">
      <div class="week-header-day">${dayNames[i]}</div>
      <div class="week-header-date">${day.getDate()}</div>
    </div>`;
  }

  for (let hour = 0; hour < 24; hour++) {
    const h12 = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    html += `<div class="time-label">${h12} ${ampm}</div>`;

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dateStr = toDateString(day);
      const hourTasks = filtered.filter(t => {
        const dates = generateRecurringDates(t);
        if (!dates.includes(dateStr)) return false;
        if (!t.time) return hour === 0;
        const taskHour = parseInt(t.time.split(':')[0]);
        return taskHour === hour;
      });

      html += `<div class="week-cell" data-date="${dateStr}" data-hour="${hour}">`;
      hourTasks.forEach(task => {
        const completedClass = task.completed ? ' completed' : '';
        html += `<div class="day-task-chip${completedClass}" 
                  style="background: ${task.color || '#667eea'}"
                  draggable="true"
                  ondragstart="handleDragStart(event, '${task.id}')"
                  onclick="event.stopPropagation(); editTask('${task.id}')"
                  title="${task.title}">${task.title}</div>`;
      });
      html += '</div>';
    }
  }

  html += '</div>';
  container.innerHTML = html;
}

// ===== Rendering: Day View =====
function renderDayView() {
  const container = $('#calendar-container');
  const filtered = getFilteredTasks();
  const dateStr = toDateString(currentDate);
  const dayTasks = filtered.filter(t => {
    const dates = generateRecurringDates(t);
    return dates.includes(dateStr);
  });

  let html = '<div class="day-view">';

  for (let hour = 0; hour < 24; hour++) {
    const h12 = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    html += `<div class="time-label">${h12} ${ampm}</div>`;

    const hourTasks = dayTasks.filter(t => {
      if (!t.time) return hour === 0;
      return parseInt(t.time.split(':')[0]) === hour;
    });

    html += `<div class="day-hour-cell" data-date="${dateStr}" data-hour="${hour}">`;
    hourTasks.forEach(task => {
      const completedClass = task.completed ? ' completed' : '';
      const highClass = task.priority === 'high' ? ' priority-high' : '';
      html += `<div class="day-task-chip${completedClass}${highClass}" 
                style="background: ${task.color || '#667eea'}"
                draggable="true"
                ondragstart="handleDragStart(event, '${task.id}')"
                onclick="event.stopPropagation(); editTask('${task.id}')"
                title="${task.title}">${task.title}${task.time ? ' @ ' + formatTime(task.time) : ''}</div>`;
    });
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// ===== Rendering: List View =====
function renderListView() {
  const container = $('#calendar-container');
  const filtered = getFilteredTasks().sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priOrder = { high: 0, medium: 1, low: 2 };
    if (priOrder[a.priority] !== priOrder[b.priority]) return priOrder[a.priority] - priOrder[b.priority];
    return new Date(a.date) - new Date(b.date);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state fade-in">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No tasks yet. Click "+ New Task" to get started!</div>
      </div>`;
    return;
  }

  const groups = {};
  filtered.forEach(task => {
    const dates = generateRecurringDates(task);
    dates.forEach(d => {
      if (!groups[d]) groups[d] = [];
      groups[d].push(task);
    });
  });

  Object.keys(groups).forEach(d => {
    const seen = new Set();
    groups[d] = groups[d].filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  });

  const sortedDates = Object.keys(groups).sort();

  let html = '<div class="list-view">';
  sortedDates.forEach(dateStr => {
    const dateObj = new Date(dateStr + 'T00:00:00');
    const isOverdueDate = startOfDay(dateObj) < startOfDay(new Date());
    const label = isToday(dateObj) ? 'Today' : formatDate(dateObj);

    html += `<div style="font-size:0.8rem;font-weight:600;color:${isOverdueDate && !isToday(dateObj) ? 'var(--danger)' : 'var(--text-muted)'};margin:16px 0 8px;padding-left:4px;">${label}</div>`;

    groups[dateStr].forEach(task => {
      const completedClass = task.completed ? ' completed' : '';
      const catInfo = CATEGORIES[task.category] || CATEGORIES.personal;

      html += `<div class="task-card fade-in" style="border-left-color:${task.color || '#667eea'}" onclick="editTask('${task.id}')">
        <div class="task-card-header">
          <div class="task-card-checkbox${task.completed ? ' checked' : ''}" 
               onclick="event.stopPropagation(); toggleTask('${task.id}')"></div>
          <div class="task-card-title${completedClass}">${task.title}</div>
        </div>
        <div class="task-card-meta">
          ${task.time ? `<span class="task-card-time">🕐 ${formatTime(task.time)}</span>` : ''}
          <span class="task-card-priority ${task.priority}">${task.priority}</span>
          <span class="task-card-category">${catInfo.emoji} ${catInfo.label}</span>
          ${task.recurrence && task.recurrence !== 'none' ? `<span class="task-card-recurrence">${RECURRENCE_LABELS[task.recurrence]}</span>` : ''}
        </div>
      </div>`;
    });
  });

  html += '</div>';
  container.innerHTML = html;
}

// ===== Rendering: Day Panel =====
function openDayPanel(dateStr) {
  const panel = $('#day-panel');
  const title = $('#day-panel-title');
  const list = $('#day-tasks-list');
  const dateObj = new Date(dateStr + 'T00:00:00');

  title.textContent = isToday(dateObj) ? "Today's Tasks" : formatDate(dateObj);

  const filtered = getFilteredTasks();
  const dayTasks = filtered.filter(t => {
    const dates = generateRecurringDates(t);
    return dates.includes(dateStr);
  });

  if (dayTasks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">No tasks for this day</div>
      </div>`;
  } else {
    list.innerHTML = dayTasks.map(task => {
      const completedClass = task.completed ? ' completed' : '';
      const catInfo = CATEGORIES[task.category] || CATEGORIES.personal;

      return `<div class="task-card fade-in" style="border-left-color:${task.color || '#667eea'}" onclick="editTask('${task.id}')">
        <div class="task-card-header">
          <div class="task-card-checkbox${task.completed ? ' checked' : ''}" 
               onclick="event.stopPropagation(); toggleTask('${task.id}')"></div>
          <div class="task-card-title${completedClass}">${task.title}</div>
        </div>
        ${task.description ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0 6px">${task.description}</div>` : ''}
        <div class="task-card-meta">
          ${task.time ? `<span class="task-card-time">🕐 ${formatTime(task.time)}</span>` : ''}
          <span class="task-card-priority ${task.priority}">${task.priority}</span>
          <span class="task-card-category">${catInfo.emoji} ${catInfo.label}</span>
          ${task.recurrence && task.recurrence !== 'none' ? `<span class="task-card-recurrence">${RECURRENCE_LABELS[task.recurrence]}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  panel.classList.remove('hidden');
}

// ===== Rendering: Sidebar =====
function renderSidebar() {
  const catContainer = $('#category-filters');
  let catHtml = `<button class="category-chip${activeCategory === 'all' ? ' active' : ''}" data-category="all">
    <span class="chip-dot" style="background: linear-gradient(135deg, #667eea, #764ba2)"></span>
    All Tasks
  </button>`;

  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const count = tasks.filter(t => t.category === key).length;
    catHtml += `<button class="category-chip${activeCategory === key ? ' active' : ''}" data-category="${key}">
      <span class="chip-dot" style="background: ${cat.color}"></span>
      ${cat.emoji} ${cat.label}
      ${count > 0 ? `<span style="margin-left:auto;font-size:0.7rem;color:var(--text-muted)">${count}</span>` : ''}
    </button>`;
  });
  catContainer.innerHTML = catHtml;

  catContainer.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeCategory = chip.dataset.category;
      renderAll();
    });
  });

  const upcomingContainer = $('#upcoming-tasks');
  const now = startOfDay(new Date());
  const upcoming = tasks
    .filter(t => !t.completed)
    .filter(t => {
      const dates = generateRecurringDates(t);
      return dates.some(d => startOfDay(new Date(d)) >= now);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  if (upcoming.length === 0) {
    upcomingContainer.innerHTML = '<div class="upcoming-empty">No upcoming tasks 🎉</div>';
  } else {
    upcomingContainer.innerHTML = upcoming.map(task => {
      const dateObj = new Date(task.date + 'T00:00:00');
      const isTaskOverdue = isOverdue(task);
      const label = isToday(dateObj) ? 'Today' : formatDate(dateObj);
      const catInfo = CATEGORIES[task.category] || CATEGORIES.personal;

      return `<div class="upcoming-item${isTaskOverdue ? ' overdue' : ''}" onclick="editTask('${task.id}')">
        <span>${catInfo.emoji}</span>
        <span class="upcoming-title">${task.title}</span>
        <span class="upcoming-date">${label}</span>
      </div>`;
    }).join('');
  }

  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  $('#stat-total').textContent = total;
  $('#stat-done').textContent = done;
  $('#stat-overdue').textContent = overdue;
}

// ===== Main Render =====
function renderAll() {
  renderCalendarHeader();
  renderSidebar();

  switch (currentView) {
    case 'month': renderMonthView(); break;
    case 'week': renderWeekView(); break;
    case 'day': renderDayView(); break;
    case 'list': renderListView(); break;
  }
}

// ===== Task CRUD =====
function createTask(data) {
  const task = {
    id: generateId(),
    title: data.title.trim(),
    description: (data.description || '').trim(),
    date: data.date,
    time: data.time || '',
    endDate: data.endDate || '',
    priority: data.priority || 'medium',
    category: data.category || 'personal',
    recurrence: data.recurrence || 'none',
    reminder: data.reminder || 'none',
    color: data.color || '#667eea',
    completed: false,
    createdAt: new Date().toISOString(),
  };

  tasks.push(task);
  saveData();
  scheduleReminder(task);
  renderAll();
  showToast('Task created! ✨', 'success');
  return task;
}

function updateTask(id, data) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;

  tasks[idx] = { ...tasks[idx], ...data };
  saveData();
  clearReminder(id);
  scheduleReminder(tasks[idx]);
  renderAll();
  showToast('Task updated! ✏️', 'info');
  return tasks[idx];
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveData();
  clearReminder(id);
  renderAll();
  showToast('Task deleted 🗑️', 'warning');
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveData();
  clearReminder(id);
  renderAll();

  if (task.completed) {
    showToast('Task completed! 🎉', 'success');
  }
}

function moveTask(taskId, newDate) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.date = newDate;
  saveData();
  clearReminder(taskId);
  scheduleReminder(task);
  renderAll();
  showToast('Task moved! 📅', 'info');
}

// ===== Modal =====
function openModal(dateStr) {
  const overlay = $('#modal-overlay');
  const form = $('#task-form');
  const title = $('#modal-title');
  const deleteBtn = $('#delete-task-btn');

  form.reset();
  editingTaskId = null;
  selectedColor = '#667eea';

  $$('.color-swatch').forEach(s => s.classList.remove('active'));
  $('.color-swatch[data-color="#667eea"]').classList.add('active');

  if (dateStr) {
    $('#task-date').value = dateStr;
  } else {
    $('#task-date').value = toDateString(new Date());
  }

  title.textContent = 'New Task';
  deleteBtn.style.display = 'none';

  overlay.classList.remove('hidden');
  setTimeout(() => $('#task-title').focus(), 100);
}

function openEditModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const overlay = $('#modal-overlay');
  const title = $('#modal-title');
  const deleteBtn = $('#delete-task-btn');

  editingTaskId = taskId;

  $('#task-title').value = task.title;
  $('#task-description').value = task.description || '';
  $('#task-date').value = task.date;
  $('#task-time').value = task.time || '';
  $('#task-end-date').value = task.endDate || '';
  $('#task-priority').value = task.priority;
  $('#task-category').value = task.category;
  $('#task-recurrence').value = task.recurrence;
  $('#task-reminder').value = task.reminder;
  $('#task-id').value = task.id;

  selectedColor = task.color || '#667eea';
  $$('.color-swatch').forEach(s => s.classList.remove('active'));
  const activeSwatch = $(`.color-swatch[data-color="${selectedColor}"]`);
  if (activeSwatch) activeSwatch.classList.add('active');

  title.textContent = 'Edit Task';
  deleteBtn.style.display = 'inline-flex';

  overlay.classList.remove('hidden');
  setTimeout(() => $('#task-title').focus(), 100);
}

function closeModal() {
  $('#modal-overlay').classList.add('hidden');
  editingTaskId = null;
}

function editTask(id) {
  openEditModal(id);
}

// ===== Reminders =====
function scheduleReminder(task) {
  if (!task.reminder || task.reminder === 'none' || task.completed) return;

  const taskDateTime = new Date(`${task.date}T${task.time || '09:00'}:00`);
  let offsetMs = 0;

  switch (task.reminder) {
    case 'at-time': offsetMs = 0; break;
    case '5min': offsetMs = 5 * 60 * 1000; break;
    case '15min': offsetMs = 15 * 60 * 1000; break;
    case '30min': offsetMs = 30 * 60 * 1000; break;
    case '1hour': offsetMs = 60 * 60 * 1000; break;
    case '1day': offsetMs = 24 * 60 * 60 * 1000; break;
  }

  const reminderTime = new Date(taskDateTime.getTime() - offsetMs);
  const now = new Date();
  const delay = reminderTime.getTime() - now.getTime();

  if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000 && !reminderTimers[task.id]) {
    reminderTimers[task.id] = setTimeout(() => {
      triggerReminder(task);
    }, delay);
  }
}

function clearReminder(taskId) {
  if (reminderTimers[taskId]) {
    clearTimeout(reminderTimers[taskId]);
    delete reminderTimers[taskId];
  }
}

function triggerReminder(task) {
  showToast(`⏰ Reminder: ${task.title}`, 'warning');

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('TaskCal Reminder', {
      body: task.title,
      icon: '📅',
    });
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function initReminders() {
  tasks.forEach(task => {
    if (!task.completed) {
      scheduleReminder(task);
    }
  });
}

// ===== Quick To-Do =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addQuickTodo(title) {
  if (!title.trim()) return;
  
  const todo = {
    id: 'qt_' + generateId(),
    text: title.trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  quickTodos.unshift(todo);
  saveQuickTodos();
  renderQuickTodos();
  showToast('To-do added! ✅', 'success');
}

function toggleQuickTodo(id) {
  const todo = quickTodos.find(t => t.id === id);
  if (!todo) return;
  
  todo.completed = !todo.completed;
  saveQuickTodos();
  renderQuickTodos();
  
  if (todo.completed) {
    showToast('Completed! 🎉', 'success');
  }
}

function deleteQuickTodo(id) {
  quickTodos = quickTodos.filter(t => t.id !== id);
  saveQuickTodos();
  renderQuickTodos();
}

function renderQuickTodos() {
  const container = $('#quick-todo-list');
  if (!container) return;
  
  if (quickTodos.length === 0) {
    container.innerHTML = '<div class="quick-todo-empty">No quick to-dos yet</div>';
    return;
  }
  
  container.innerHTML = quickTodos.map(todo => {
    const completedClass = todo.completed ? ' completed' : '';
    const checkedClass = todo.completed ? ' checked' : '';
    const safeText = escapeHtml(todo.text);
    
    return `<div class="quick-todo-item${completedClass}">
      <div class="quick-todo-checkbox${checkedClass}" 
           onclick="toggleQuickTodo('${todo.id}')"></div>
      <span class="quick-todo-text">${safeText}</span>
      <button class="quick-todo-delete" onclick="deleteQuickTodo('${todo.id}')" aria-label="Delete">✕</button>
    </div>`;
  }).join('');
}

function initQuickTodoListeners() {
  const input = $('#quick-todo-input');
  const addBtn = $('#quick-todo-add-btn');
  
  if (!input || !addBtn) return;
  
  addBtn.addEventListener('click', () => {
    addQuickTodo(input.value);
    input.value = '';
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addQuickTodo(input.value);
      input.value = '';
    }
  });
}

// ===== Toast =====
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Drag & Drop =====
let draggedTaskId = null;

function handleDragStart(event, taskId) {
  draggedTaskId = taskId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', taskId);
  event.target.classList.add('dragging');
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event, dateStr) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  const taskId = event.dataTransfer.getData('text/plain') || draggedTaskId;
  if (taskId) {
    moveTask(taskId, dateStr);
  }

  $$('.day-task-chip.dragging').forEach(el => el.classList.remove('dragging'));
  draggedTaskId = null;
}

// ===== Search =====
function handleSearch(query) {
  searchQuery = query;
  renderAll();
}

// ===== Navigation =====
function goToToday() {
  currentDate = new Date();
  selectedDate = new Date();
  renderAll();
}

function goToPrev() {
  switch (currentView) {
    case 'month':
      currentDate.setMonth(currentDate.getMonth() - 1);
      break;
    case 'week':
      currentDate.setDate(currentDate.getDate() - 7);
      break;
    case 'day':
      currentDate.setDate(currentDate.getDate() - 1);
      break;
  }
  renderAll();
}

function goToNext() {
  switch (currentView) {
    case 'month':
      currentDate.setMonth(currentDate.getMonth() + 1);
      break;
    case 'week':
      currentDate.setDate(currentDate.getDate() + 7);
      break;
    case 'day':
      currentDate.setDate(currentDate.getDate() + 1);
      break;
  }
  renderAll();
}

function setView(view) {
  currentView = view;
  $$('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  renderAll();
}

// ===== Event Listeners =====
function initEventListeners() {
  $('#new-task-btn').addEventListener('click', () => openModal(toDateString(currentDate)));
  $('#mobile-new-btn').addEventListener('click', () => openModal(toDateString(currentDate)));

  $('#modal-close').addEventListener('click', closeModal);
  $('#cancel-btn').addEventListener('click', closeModal);
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  $('#task-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const data = {
      title: $('#task-title').value,
      description: $('#task-description').value,
      date: $('#task-date').value,
      time: $('#task-time').value,
      endDate: $('#task-end-date').value,
      priority: $('#task-priority').value,
      category: $('#task-category').value,
      recurrence: $('#task-recurrence').value,
      reminder: $('#task-reminder').value,
      color: selectedColor,
    };

    if (data.recurrence && data.recurrence !== 'none' && data.endDate) {
      if (new Date(data.endDate) < new Date(data.date)) {
        showToast('End date must be after start date', 'error');
        return;
      }
    }

    if (editingTaskId) {
      updateTask(editingTaskId, data);
    } else {
      createTask(data);
    }

    closeModal();
  });

  $('#delete-task-btn').addEventListener('click', () => {
    if (editingTaskId && confirm('Delete this task?')) {
      deleteTask(editingTaskId);
      closeModal();
    }
  });

  $$('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      $$('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      selectedColor = swatch.dataset.color;
    });
  });

  $('#today-btn').addEventListener('click', goToToday);
  $('#prev-btn').addEventListener('click', goToPrev);
  $('#next-btn').addEventListener('click', goToNext);

  $$('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  $('#close-panel-btn').addEventListener('click', () => {
    $('#day-panel').classList.add('hidden');
  });

  let searchTimeout;
  $('#search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(e.target.value), 200);
  });

  $('#hamburger').addEventListener('click', () => {
    $('#sidebar').classList.add('open');
  });

  $('#sidebar-close').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900) {
      const sidebar = $('#sidebar');
      const hamburger = $('#hamburger');
      if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    switch (e.key) {
      case 'n':
      case 'N':
        e.preventDefault();
        openModal(toDateString(currentDate));
        break;
      case 't':
      case 'T':
        e.preventDefault();
        goToToday();
        break;
      case 'ArrowLeft':
        goToPrev();
        break;
      case 'ArrowRight':
        goToNext();
        break;
      case '1': setView('month'); break;
      case '2': setView('week'); break;
      case '3': setView('day'); break;
      case '4': setView('list'); break;
      case 'Escape':
        closeModal();
        $('#day-panel').classList.add('hidden');
        break;
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      $('#sidebar').classList.remove('open');
    }
  });
}

// ===== Init =====
function init() {
  loadData();
  loadQuickTodos();
  initEventListeners();
  initQuickTodoListeners();
  requestNotificationPermission();
  initReminders();
  renderQuickTodos();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

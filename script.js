const STORAGE_KEY = "parisPortraitCalendarEvents";
const SHARED_SCHEDULE_PATH = "schedule.json";
const weekdayNames = ["一", "二", "三", "四", "五", "六", "日"];

const state = {
  currentDate: new Date(),
  selectedDateKey: getDateKey(new Date()),
  selectedEventIndex: null,
  events: {},
};

const monthTitle = document.getElementById("monthTitle");
const weekdayRow = document.getElementById("weekdayRow");
const calendarGrid = document.getElementById("calendarGrid");
const dayEventsList = document.getElementById("dayEventsList");
const eventForm = document.getElementById("eventForm");
const selectedDateTitle = document.getElementById("selectedDateTitle");
const eventDateInput = document.getElementById("eventDate");
const eventIndexInput = document.getElementById("eventIndex");
const titleInput = document.getElementById("titleInput");
const startTimeInput = document.getElementById("startTimeInput");
const endTimeInput = document.getElementById("endTimeInput");
const statusInput = document.getElementById("statusInput");
const deleteButton = document.getElementById("deleteButton");
const newEventButton = document.getElementById("newEventButton");
const exportSharedButton = document.getElementById("exportSharedButton");
const exportButton = document.getElementById("exportButton");
const importInput = document.getElementById("importInput");
const syncNote = document.getElementById("syncNote");

document.getElementById("prevMonth").addEventListener("click", () => {
  state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 1);
  renderCalendar();
});

newEventButton.addEventListener("click", () => {
  state.selectedEventIndex = null;
  populateForm(state.selectedDateKey, null);
  renderDayEventsList();
});

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const dateKey = eventDateInput.value;
  if (!dateKey) {
    return;
  }

  const startTime = startTimeInput.value;
  const endTime = endTimeInput.value;

  if (startTime >= endTime) {
    window.alert("结束时间必须晚于开始时间。");
    return;
  }

  const record = {
    id: eventIndexInput.value || createEventId(),
    date: dateKey,
    title: titleInput.value.trim(),
    startTime,
    endTime,
    status: statusInput.value,
  };

  const dayEvents = getDayEvents(dateKey);
  const existingIndex = dayEvents.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    dayEvents[existingIndex] = record;
  } else {
    dayEvents.push(record);
  }

  dayEvents.sort(compareEvents);
  state.events[dateKey] = dayEvents;
  state.selectedEventIndex = dayEvents.findIndex((item) => item.id === record.id);

  persistEvents();
  renderCalendar();
  renderDayEventsList();
  populateForm(dateKey, state.selectedEventIndex);
});

deleteButton.addEventListener("click", () => {
  const dateKey = eventDateInput.value;
  const eventId = eventIndexInput.value;
  const dayEvents = getDayEvents(dateKey);

  if (!dateKey || !eventId || dayEvents.length === 0) {
    clearForm();
    return;
  }

  const nextEvents = dayEvents.filter((item) => item.id !== eventId);

  if (nextEvents.length === 0) {
    delete state.events[dateKey];
    state.selectedEventIndex = null;
    persistEvents();
    renderCalendar();
    renderDayEventsList();
    populateForm(dateKey, null);
    return;
  }

  state.events[dateKey] = nextEvents;
  state.selectedEventIndex = 0;
  persistEvents();
  renderCalendar();
  renderDayEventsList();
  populateForm(dateKey, 0);
});

exportButton.addEventListener("click", () => {
  const data = JSON.stringify(state.events, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const monthStamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `paris-photo-calendar-${monthStamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

exportSharedButton.addEventListener("click", () => {
  const data = JSON.stringify(state.events, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "schedule.json";
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!isValidImportedValue(parsed)) {
      throw new Error("invalid");
    }

    state.events = normalizeEventMap(parsed);
    state.selectedEventIndex = null;
    persistEvents();
    renderCalendar();
    populateForm(state.selectedDateKey, null);
    renderDayEventsList();
  } catch {
    window.alert("导入失败，请选择有效的日程 JSON 文件。");
  } finally {
    importInput.value = "";
  }
});

function loadEvents() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistEvents() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
  updateSyncNote("你当前看到的是本地最新版本。导出共享日程后上传到 GitHub，合作者就能看到更新。");
}

function isValidImportedValue(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeEventMap(value) {
  const normalized = {};

  if (!value || typeof value !== "object") {
    return normalized;
  }

  Object.entries(value).forEach(([dateKey, rawValue]) => {
    const asArray = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
    const validEvents = asArray
      .filter(isValidEventRecord)
      .map((item, index) => ({
        id: item.id || `${dateKey}-${index}-${item.startTime}`,
        date: item.date || dateKey,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        status: item.status,
      }))
      .sort(compareEvents);

    if (validEvents.length > 0) {
      normalized[dateKey] = validEvents;
    }
  });

  return normalized;
}

function isValidEventRecord(event) {
  return (
    event &&
    typeof event === "object" &&
    typeof event.title === "string" &&
    typeof event.startTime === "string" &&
    typeof event.endTime === "string" &&
    typeof event.status === "string"
  );
}

function compareEvents(left, right) {
  return left.startTime.localeCompare(right.startTime);
}

function getDayEvents(dateKey) {
  return state.events[dateKey] ? [...state.events[dateKey]] : [];
}

function renderWeekdays() {
  weekdayRow.innerHTML = "";
  weekdayNames.forEach((name) => {
    const cell = document.createElement("div");
    cell.className = "weekday-cell";
    cell.textContent = name;
    weekdayRow.appendChild(cell);
  });
}

function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const totalDays = lastOfMonth.getDate();
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
  const todayKey = getDateKey(new Date());

  monthTitle.textContent = firstOfMonth.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
  });

  calendarGrid.innerHTML = "";

  for (let index = 0; index < totalCells; index += 1) {
    const cellDate = new Date(year, month, index - startOffset + 1);
    const dateKey = getDateKey(cellDate);
    const isOtherMonth = cellDate.getMonth() !== month;
    const isSelected = dateKey === state.selectedDateKey;
    const isToday = dateKey === todayKey;
    const dayEvents = getDayEvents(dateKey);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";

    if (isOtherMonth) {
      cell.classList.add("is-other-month");
    }

    if (isSelected) {
      cell.classList.add("is-selected");
    }

    if (isToday) {
      cell.classList.add("is-today");
    }

    cell.addEventListener("click", () => {
      state.selectedDateKey = dateKey;
      state.selectedEventIndex = dayEvents.length > 0 ? 0 : null;
      populateForm(dateKey, state.selectedEventIndex);
      renderCalendar();
      renderDayEventsList();
    });

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = String(cellDate.getDate());
    cell.appendChild(number);

    const eventList = document.createElement("div");
    eventList.className = "event-list";

    dayEvents.forEach((eventRecord) => {
      eventList.appendChild(createEventChip(eventRecord));
    });

    cell.appendChild(eventList);
    calendarGrid.appendChild(cell);
  }
}

function renderDayEventsList() {
  const dayEvents = getDayEvents(state.selectedDateKey);
  dayEventsList.innerHTML = "";

  if (dayEvents.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "day-event-empty";
    emptyState.textContent = "当天还没有行程，点击“新增一条”开始添加。";
    dayEventsList.appendChild(emptyState);
    return;
  }

  dayEvents.forEach((eventRecord, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "day-event-item";

    if (index === state.selectedEventIndex) {
      item.classList.add("is-active");
    }

    item.addEventListener("click", () => {
      state.selectedEventIndex = index;
      populateForm(state.selectedDateKey, index);
      renderDayEventsList();
    });

    const top = document.createElement("div");
    top.className = "day-event-top";
    top.innerHTML = `<span>${eventRecord.startTime} - ${eventRecord.endTime}</span><span>${getStatusLabel(eventRecord.status)}</span>`;

    const title = document.createElement("div");
    title.className = "day-event-title";
    title.textContent = eventRecord.title;

    item.append(top, title);
    dayEventsList.appendChild(item);
  });
}

function createEventChip(eventRecord) {
  const chip = document.createElement("div");
  chip.className = `event-chip ${getStatusClass(eventRecord.status)}`;

  const time = document.createElement("span");
  time.className = "event-time";
  time.textContent = `${eventRecord.startTime} - ${eventRecord.endTime}`;

  const title = document.createElement("span");
  title.className = "event-title";
  title.textContent = eventRecord.title;

  chip.append(time, title);
  return chip;
}

function populateForm(dateKey, eventIndex) {
  state.selectedDateKey = dateKey;
  eventDateInput.value = dateKey;
  updateSelectedDateText(dateKey);

  const dayEvents = getDayEvents(dateKey);
  const existing = Number.isInteger(eventIndex) && eventIndex >= 0 ? dayEvents[eventIndex] : null;

  if (existing) {
    eventIndexInput.value = existing.id;
    titleInput.value = existing.title;
    startTimeInput.value = existing.startTime;
    endTimeInput.value = existing.endTime;
    statusInput.value = existing.status;
  } else {
    eventIndexInput.value = "";
    clearForm();
  }
}

function clearForm() {
  titleInput.value = "";
  startTimeInput.value = "09:00";
  endTimeInput.value = "10:00";
  statusInput.value = "booked";
}

function updateSelectedDateText(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  selectedDateTitle.textContent = date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusClass(status) {
  if (status === "booked") {
    return "status-booked";
  }

  if (status === "unavailable") {
    return "status-unavailable";
  }

  return "status-rest-day";
}

function getStatusLabel(status) {
  if (status === "booked") {
    return "已预约";
  }

  if (status === "unavailable") {
    return "不可约";
  }

  return "休息日";
}

function createEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateSyncNote(text) {
  syncNote.textContent = text;
}

async function initializeCalendar() {
  const localEvents = normalizeEventMap(loadEvents());

  try {
    const response = await fetch(`${SHARED_SCHEDULE_PATH}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("shared schedule unavailable");
    }

    const sharedValue = await response.json();
    const sharedEvents = normalizeEventMap(sharedValue);
    state.events = Object.keys(localEvents).length > 0 ? localEvents : sharedEvents;

    if (Object.keys(localEvents).length > 0) {
      updateSyncNote("已载入本地修改版本。若要让合作者看到更新，请导出共享日程并上传新的 schedule.json。");
    } else {
      updateSyncNote("当前显示的是共享日程。你修改后需要导出共享日程并上传新的 schedule.json。");
    }
  } catch {
    state.events = localEvents;
    updateSyncNote("暂时没有读取到共享日程，当前显示的是本地版本。");
  }

  renderWeekdays();
  populateForm(state.selectedDateKey, null);
  renderCalendar();
  renderDayEventsList();
}

initializeCalendar();

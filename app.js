/* ===========================================================
   StudyBoard — plain JavaScript (no build step, no frameworks)
   Public-safe Supabase integration with no local storage or auth.
   Configure by setting window.MAVIS_SUPABASE_CONFIG before app.js.
=========================================================== */

(function () {
  "use strict";

  /* ---------------- Constants ---------------- */
  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  var MODALITIES = ["On-Site", "Online", "Hybrid"];
  var DEFAULT_TASK_TYPES = ["Assignment", "Quiz", "Exam", "Project", "Reading", "Lab"];
  var DEFAULT_TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
  var STATUSES = ["To Do", "In Progress", "Submitted", "Completed"];
  var TOAST_TIMEOUT = 4000; // Duration for toast messages
  var PRIORITIES = DEFAULT_TASK_PRIORITIES.slice();
  var DEFAULT_PAYMENT_METHODS = ["Cash", "Card", "E-Wallet", "Bank Transfer", "Allowance"];
  var DEFAULT_BUDGET_CATEGORIES = ["Food", "Transport", "School Supplies", "Rent", "Utilities", "Leisure", "Health", "Savings", "Income", "Other"];

  // New UI Customization Constants
  var DEFAULT_ACCENT_COLOR = "#0d9488"; // Teal
  var DEFAULT_LAYOUT_DENSITY = "comfortable";
  var DEFAULT_SIDEBAR_EXPAND_ON_HOVER = true;
  var DEFAULT_ACCESSIBILITY_MODE = "default";
  var DEFAULT_LANDING_TAB = "dashboard";

  var COURSE_COLORS = ["#0d9488", "#d97706", "#0284c7", "#e11d48", "#7c3aed", "#65a30d"];
  var PIE_COLORS = ["#0d9488", "#d97706", "#0284c7", "#e11d48", "#7c3aed", "#65a30d", "#64748b", "#ec4899"];
  var PRIORITY_BADGE = { Low: "badge-low", Medium: "badge-medium", High: "badge-high", Urgent: "badge-urgent" };
  var PRIORITY_LEVEL = { Low: 1, Medium: 2, High: 3, Urgent: 4 };
  var PRIORITY_HEX = { Low: "#64748b", Medium: "#0284c7", High: "#d97706", Urgent: "#e11d48" };
  var CATEGORY_HEX = { Class: "#0d9488", Event: "#7c3aed", Personal: "#0284c7" };

  var TIME_SLOTS = (function () {
    var slots = [];
    for (var h = 7; h <= 22; h++) {
      slots.push(pad2(h) + ":00");
      if (h !== 22) slots.push(pad2(h) + ":30");
    }
    return slots;
  })();

  /* ---------------- Utilities ---------------- */
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function fmtMoney(n) {
    var num = Number(n);
    if (isNaN(num)) num = 0;
    return num.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
  }
  function fmtTime12(hhmm) {
    if (!hhmm) return "";
    var parts = hhmm.split(":").map(Number);
    var h = parts[0], m = parts[1];
    var period = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + pad2(m) + " " + period;
  }
  function minutesOf(hhmm) {
    var parts = hhmm.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }
  function daysBetween(dateStr) {
    var target = new Date(dateStr + "T00:00:00");
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  }
  function dateKey(y, m, d) { return y + "-" + pad2(m + 1) + "-" + pad2(d); }
  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }
  // New helper to get RGB components for CSS variables
  function hexToRgbComponents(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split('').map(function(c) { return c + c; }).join('');
    if (h.length !== 6) return [13, 148, 136]; // Default to teal on error
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return [r, g, b];
  }

  // Helper to determine text color for contrast
  function getLuminance(hex) {
    var rgb = hexToRgbComponents(hex);
    var r = rgb[0] / 255;
    var g = rgb[1] / 255;
    var b = rgb[2] / 255;
    // For sRGB, linearize first
    r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getContrastTextColor(hex) {
    return getLuminance(hex) > 0.5 ? '#000000' : '#FFFFFF';
  }

  /* ---------------- Icons (inline SVG, feather-style) ---------------- */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    calendarDays: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15v-6"/><path d="M17 12a1.5 1.5 0 0 0 0 3h4v-3Z"/>',
    listChecks: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 5l1 1 2-2"/><path d="M4 11l1 1 2-2"/><path d="M4 17l1 1 2-2"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    gradCap: '<path d="M22 10L12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
    trendUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    trendDown: '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    chevLeft: '<polyline points="15 18 9 12 15 6"/>',
    chevRight: '<polyline points="9 18 15 12 9 6"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    dropper: '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><path d="M14.5 11.5 13 13l-1.5-1.5L10 13l1.5 1.5L10 16l1.5 1.5L13 16l1.5 1.5L16 16l-1.5-1.5L16 13l-1.5-1.5z"/>',
    arrowUpRight: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
    search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>'
  };
  function icon(name, size, cls) {
    size = size || 16;
    return '<svg class="' + (cls || "") + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || "") + '</svg>';
  }

  /* ---------------- State ---------------- */
  var state = { courses: [], tasks: [], transactions: [], toasts: [], settings: {
    theme: "light",
    appName: "Mavis",
    budgetCategories: DEFAULT_BUDGET_CATEGORIES.slice(),
    paymentMethods: DEFAULT_PAYMENT_METHODS.slice(),
    taskCategories: ["Class", "Event", "Personal"],
    taskPriorities: DEFAULT_TASK_PRIORITIES.slice(),
    taskTypes: DEFAULT_TASK_TYPES.slice(),
    showDashboardMoneyMonitor: true,
    showDashboardExpenseBreakdown: true,
    showDashboardMiniCalendar: true,
    showScheduleTimeline: true, // Existing, but now configurable
    showSidebar: true, // Existing, but now configurable
    accentColor: DEFAULT_ACCENT_COLOR, // New
    layoutDensity: DEFAULT_LAYOUT_DENSITY, // New
    sidebarExpandOnHover: DEFAULT_SIDEBAR_EXPAND_ON_HOVER, // New
    accessibilityMode: DEFAULT_ACCESSIBILITY_MODE, // New
    defaultLandingTab: DEFAULT_LANDING_TAB, // New
    genCalShow: { Class: true, Event: true, Personal: true }
  }};
  var ui = {
    tab: "dashboard",
    sidebarOpen: true,
    fabOpen: false,
    modal: null,
    scheduleView: "table",
    formDraft: {},
    taskView: "kanban",
    taskFilter: "All",
    taskSort: "daysLeft",
    budgetMonth: new Date().getMonth(),
    budgetYear: new Date().getFullYear(),
    settingsTab: 'interface',
    budgetView: 'overview',
    budgetSearchQuery: "",
    budgetDateFilter: "",
    searchQuery: "",
    editingBudget: false,
    miniCalCursor: { y: new Date().getFullYear(), m: new Date().getMonth(), d: new Date().getDate() }, // New
    genCalCursor: { y: new Date().getFullYear(), m: new Date().getMonth(), d: new Date().getDate() },
    taskCalCursor: { y: new Date().getFullYear(), m: new Date().getMonth() },
    generalCalendarView: 'month',
    lastSaveTime: null,
    isSaving: false,
  };

  function defaultSettings() {
    return {
      theme: "light",
      appName: "Mavis",
      budgetCategories: DEFAULT_BUDGET_CATEGORIES.slice(),
      paymentMethods: DEFAULT_PAYMENT_METHODS.slice(),
      taskCategories: ["Class", "Event", "Personal"],
      taskPriorities: DEFAULT_TASK_PRIORITIES.slice(),
      taskTypes: DEFAULT_TASK_TYPES.slice(),
      showDashboardMoneyMonitor: true,
      showDashboardExpenseBreakdown: true,
      showDashboardMiniCalendar: true,
      showScheduleTimeline: true,
      showSidebar: true,
      accentColor: DEFAULT_ACCENT_COLOR,
      layoutDensity: DEFAULT_LAYOUT_DENSITY,
      sidebarExpandOnHover: DEFAULT_SIDEBAR_EXPAND_ON_HOVER,
      accessibilityMode: DEFAULT_ACCESSIBILITY_MODE,
      defaultLandingTab: DEFAULT_LANDING_TAB,
      genCalShow: { Class: true, Event: true, Personal: true }
    };
  }

  function normalizeDateValue(value) {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" && value.length === 10 && value.indexOf("-") === 4) {
      var parts = value.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])); // Use UTC to prevent timezone issues
      }
    }
    var asDate = new Date(value);
    return isNaN(asDate.getTime()) ? null : asDate;
  }

  function toDateForDb(value) {
    var parsed = normalizeDateValue(value);
    return parsed && !isNaN(parsed.getTime()) ? new Date(parsed.getTime()) : null;
  }

  function toInputDateString(value) {
    var parsed = normalizeDateValue(value);
    if (!parsed) return "";
    return parsed.getFullYear() + "-" + pad2(parsed.getMonth() + 1) + "-" + pad2(parsed.getDate());
  }

  function normalizeCourseForUi(course) {
    var normalized = {
      id: course.id,
      name: course.name,
      code: course.code,
      professor: course.professor,
      startDate: toInputDateString(course.start_date),
      endDate: toInputDateString(course.end_date),
      color: course.color,
      schedules: course.schedules || []
    };

    // Backward compatibility for data from DB that might be in old format
    if (course.days && (!course.schedules || course.schedules.length === 0)) {
        normalized.schedules = [{
            days: course.days || [],
            startTime: course.start_time || "09:00",
            endTime: course.end_time || "10:00",
            modality: course.modality || "On-Site",
            room: course.room || ""
        }];
    }

    // Ensure every schedule has default values
    normalized.schedules = normalized.schedules.map(function(s) {
      return Object.assign({ days: [], startTime: "09:00", endTime: "10:00", modality: "On-Site", room: "" }, s);
    });

    return normalized;
  }

  function normalizeTaskForUi(task) {
    return {
      id: task.id,
      category: task.category,
      title: task.title,
      courseName: task["courseName"],
      taskType: task["taskType"],
      taskCode: task["taskCode"],
      status: task.status,
      priority: task.priority,
      dueDate: toInputDateString(task.due_date),
      dueTime: task.due_time || "23:59",
      description: task.description,
      location: task.location
    };
  }

  function normalizeTransactionForUi(transaction) {
    return Object.assign({}, transaction, { date: toInputDateString(transaction.date) });
  }

  function getSupabaseClient() {
    return window.MAVIS_SUPABASE || null;
  }

  function isSupabaseReady() {
    return !!getSupabaseClient();
  }

  async function fetchBoardData() {
    var client = getSupabaseClient();
    if (!client) {
      state.courses = [];
      state.tasks = [];
      state.transactions = [];
      state.settings = defaultSettings();
      return;
    }

    try {
      var results = await Promise.all([
        client.from("courses").select("*"),
        client.from("tasks").select("*").order("due_date", { ascending: true }),
        client.from("transactions").select("*").order("date", { ascending: true }),
        client.from("board_settings").select("*").limit(1)
      ]);

      var courseData = results[0] && results[0].data ? results[0].data : [];
      var taskData = results[1] && results[1].data ? results[1].data : [];
      var transactionData = results[2] && results[2].data ? results[2].data : [];
      var settingsData = results[3] && results[3].data && results[3].data.length ? results[3].data[0] : null;
      
      state.courses = courseData.map(normalizeCourseForUi); // No longer seeding if data exists
      state.tasks = taskData.map(normalizeTaskForUi);
      state.transactions = transactionData.map(normalizeTransactionForUi);
      if (settingsData) {
        state.settings = Object.assign(defaultSettings(), {
          theme: settingsData.theme,
          appName: settingsData["appName"],
          budgetCategories: settingsData["budgetCategories"],
          paymentMethods: settingsData["paymentMethods"],
          taskCategories: settingsData["taskCategories"],
          taskPriorities: settingsData["taskPriorities"],
          taskTypes: settingsData["taskTypes"],
          showDashboardMoneyMonitor: settingsData["showDashboardMoneyMonitor"],
          showDashboardExpenseBreakdown: settingsData["showDashboardExpenseBreakdown"],
          showDashboardMiniCalendar: settingsData["showDashboardMiniCalendar"],
          showScheduleTimeline: settingsData["showScheduleTimeline"],
          showSidebar: settingsData["showSidebar"],
          accentColor: settingsData["accent_color"] || DEFAULT_ACCENT_COLOR,
          layoutDensity: settingsData["layout_density"] || DEFAULT_LAYOUT_DENSITY,
          sidebarExpandOnHover: settingsData["sidebar_expand_on_hover"] !== undefined ? settingsData["sidebar_expand_on_hover"] : DEFAULT_SIDEBAR_EXPAND_ON_HOVER,
          accessibilityMode: settingsData["accessibility_mode"] || DEFAULT_ACCESSIBILITY_MODE,
          defaultLandingTab: settingsData["default_landing_tab"] || DEFAULT_LANDING_TAB,
          genCalShow: settingsData["genCalShow"] || { Class: true, Event: true, Personal: true }
        });
      }
    } catch (err) {
      console.warn("Supabase fetch failed, using demo data in memory.", err);
      state.courses = [];
      state.tasks = [];
      state.transactions = [];
      state.settings = defaultSettings();
    }
  }

  function buildSettingsRow() {
    var s = state.settings || defaultSettings();
    return {
      id: "board",
      theme: s.theme,
      "appName": s.appName,
      "budgetCategories": s.budgetCategories,
      "paymentMethods": s.paymentMethods,
      "taskCategories": s.taskCategories,
      "taskPriorities": s.taskPriorities,
      "taskTypes": s.taskTypes,
      "showDashboardMoneyMonitor": s.showDashboardMoneyMonitor,
      "showDashboardExpenseBreakdown": s.showDashboardExpenseBreakdown,
      "showDashboardMiniCalendar": s.showDashboardMiniCalendar,
      "showScheduleTimeline": s.showScheduleTimeline,
      "showSidebar": s.showSidebar,
      "accent_color": s.accentColor,
      "layout_density": s.layoutDensity,
      "sidebar_expand_on_hover": s.sidebarExpandOnHover,
      "accessibility_mode": s.accessibilityMode,
      "default_landing_tab": s.defaultLandingTab,
      "genCalShow": s.genCalShow
    };
  }

  async function reconcileSupabaseTable(tableName, rows, idKey) {
    var client = getSupabaseClient();
    if (!client || !Array.isArray(rows)) return;

    var ids = rows.filter(function (row) { return !!(row && row[idKey]); }).map(function (row) { return row[idKey]; });
    var existing = await client.from(tableName).select(idKey);
    var existingRows = existing && Array.isArray(existing.data) ? existing.data : [];
    var staleIds = existingRows
      .map(function (row) { return row[idKey]; })
      .filter(function (id) { return ids.indexOf(id) === -1; });

    var upsertPromise = rows.length
      ? client.from(tableName).upsert(rows, { onConflict: idKey })
      : Promise.resolve();

    var deletePromise = staleIds.length
      ? client.from(tableName).delete().in(idKey, staleIds)
      : Promise.resolve();

    await Promise.all([upsertPromise, deletePromise]);
  }

  async function syncBoardData() {
    var client = getSupabaseClient();
    if (!client) return;

    var courseRows = state.courses.map(function (course) {
      // Prepare for DB: remove old top-level fields if they exist
      return {
        id: course.id, name: course.name, code: course.code, professor: course.professor,
        start_date: toDateForDb(course.startDate),
        end_date: toDateForDb(course.endDate),
        color: course.color,
        // The schedules array is saved directly as JSONB
        schedules: course.schedules || []
      };
    });
    var taskRows = state.tasks.map(function (task) {
      return {
        id: task.id, category: task.category, title: task.title,
        "courseName": task.courseName, "taskType": task.taskType, "taskCode": task.taskCode,
        status: task.status, priority: task.priority, due_date: toDateForDb(task.dueDate),
        due_time: task.dueTime, description: task.description, location: task.location // Ensure all task fields are saved
      };
    });
    var transactionRows = state.transactions.map(function (txn) {
      return { id: txn.id, date: toDateForDb(txn.date), category: txn.category, item: txn.item,
               type: txn.type, amount: txn.amount, method: txn.method };
    });

    await Promise.all([
      reconcileSupabaseTable("courses", courseRows, "id"),
      reconcileSupabaseTable("tasks", taskRows, "id"),
      reconcileSupabaseTable("transactions", transactionRows, "id"),
      client.from("board_settings").upsert([buildSettingsRow()], { onConflict: "id" })
    ]);
  }

  async function loadState() {
    await fetchBoardData();
  }
  async function persist() { // Renamed from persist to syncBoardData for clarity
    var client = getSupabaseClient();

    if (!client) {
      return;
    }
    try {
      await syncBoardData();
    } catch (err) {
      console.error("Supabase sync failed.", err);
    }
  }
  function commit() {
    ui.isSaving = true;
    renderSaveStatus();
    return persist().then(function () {
        ui.isSaving = false;
        ui.lastSaveTime = new Date();
        render();
    }).catch(function(err) {
        ui.isSaving = false;
        console.error("Commit failed:", err);
        showToast("Failed to save changes. Please check your connection.", "error");
        render();
        throw err; // Re-throw to propagate error
    });
  }

  /* ---------------- Shared helpers ---------------- */
  function renderSaveStatus() {
    var els = document.querySelectorAll(".db-status-value");
    var short_els = document.querySelectorAll(".db-status-value-short");
    if (!els.length) return;

    var label = "Supabase not configured"; // Default if not ready
    if (!window.MAVIS_SUPABASE_CONFIG || !window.MAVIS_SUPABASE_CONFIG.url || !window.MAVIS_SUPABASE_CONFIG.anonKey) {
        label = "Supabase config missing!"; // More specific if config object is empty
    }

    var short_label = "Offline";

    if (isSupabaseReady()) {
        label = "All changes saved";
        short_label = "Saved";
        if (ui.isSaving) {
            label = "Saving...";
            short_label = "...";
        } else if (ui.lastSaveTime) {
            var diff = (new Date() - ui.lastSaveTime) / 1000;
            if (diff < 5) { label = "Saved just now"; short_label = "Now"; }
            else if (diff < 60) { var s = Math.floor(diff); label = "Saved " + s + "s ago"; short_label = s + "s"; }
            else { var m = Math.floor(diff / 60); label = "Saved " + m + "m ago"; short_label = m + "m"; }
        }
    } else if (window.MAVIS_SUPABASE_CONFIG && window.MAVIS_SUPABASE_CONFIG.url && window.MAVIS_SUPABASE_CONFIG.anonKey) {
        label = "Connecting...";
        short_label = "...";
    }
    els.forEach(function (e) { e.textContent = label; });
    short_els.forEach(function (e) { e.textContent = short_label; });
  }

  function getBudgetCategories() {
    var categories = state.settings && state.settings.budgetCategories;
    return Array.isArray(categories) && categories.length ? categories.slice() : DEFAULT_BUDGET_CATEGORIES.slice();
  }
  function getPaymentMethods() {
    var methods = state.settings && state.settings.paymentMethods;
    return Array.isArray(methods) && methods.length ? methods.slice() : DEFAULT_PAYMENT_METHODS.slice();
  }
  function getTaskCategories() {
    var categories = state.settings && state.settings.taskCategories;
    return Array.isArray(categories) && categories.length ? categories.slice() : ["Class", "Event", "Personal"];
  }
  function getTaskPriorities() {
    var priorities = state.settings && state.settings.taskPriorities;
    return Array.isArray(priorities) && priorities.length ? priorities.slice() : DEFAULT_TASK_PRIORITIES.slice();
  }
  function getTaskTypes() {
    var types = state.settings && state.settings.taskTypes;
    return Array.isArray(types) && types.length ? types.slice() : DEFAULT_TASK_TYPES.slice();
  }
  function getCurrentBudget() {
    var total = state.transactions.reduce(function (sum, t) {
      var amount = Number(t.amount) || 0;
      return sum + (t.type === "Income" ? amount : -amount);
    }, 0);
    return isFinite(total) ? total : 0;
  }
  function getAccountSnapshot() {
    var onHand = 0;
    var online = 0;
    state.transactions.forEach(function (t) {
      var amount = Number(t.amount) || 0;
      var delta = t.type === "Income" ? amount : -amount;
      var method = t.method || "Cash";
      if (method === "Cash" || method === "Allowance") onHand += delta;
      else if (method === "Card" || method === "E-Wallet" || method === "Bank Transfer") online += delta;
      else onHand += delta;
    });
    return { onHand: onHand, online: online, total: onHand + online };
  }

  function getCategoryColor(category) {
    if (category === 'Class') {
      return state.settings.accentColor || DEFAULT_ACCENT_COLOR;
    }
    return CATEGORY_HEX[category] || '#64748b';
  }

  function getMonthDots(y, m) {
    var dots = {};
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    for (var d = 1; d <= daysInMonth; d++) {
      var dow = new Date(y, m, d).getDay();
      var set = {};
      state.courses.forEach(function (c) {
        if ((c.schedules || []).some(function(s) { return s.days.indexOf(dow) !== -1; })) {
          set["Class"] = true;
        }
      });
      state.tasks.forEach(function (t) { if (t.dueDate === dateKey(y, m, d)) set[t.category] = true; });
      var keys = Object.keys(set);
      if (keys.length) dots[d] = keys;
    }
    return dots;
  }

  // Toast notification functions
  function showToast(message, type) {
    var id = uid();
    state.toasts.push({ id: id, message: message, type: type || 'success' });
    renderToasts();
    setTimeout(function () {
      removeToast(id);
    }, TOAST_TIMEOUT);
  }

  function removeToast(id) {
    state.toasts = state.toasts.filter(function (t) { return t.id !== id; });
    renderToasts();
  }

  function renderToasts() {
    var container = document.getElementById("toast-container");
    if (container) container.innerHTML = state.toasts.map(function (toast) {
      var iconName = toast.type === 'error' ? 'alert' : 'check';
      return '<div class="toast ' + toast.type + '"><span class="toast-icon">' + icon(iconName, 18) + '</span><span class="toast-message">' + escapeHtml(toast.message) + '</span></div>';
    }).join("");
  }

  /* ---------------- Render: Shell ---------------- */

  function render() {
    var app = document.getElementById("app");
    app.innerHTML = renderShell();
    renderSaveStatus();
    applySettingsToDom(); // Apply settings to DOM after rendering shell
    renderToasts();
  }

  function renderShell() {
    var theme = state.settings.theme || "light";
    document.documentElement.setAttribute("data-theme", theme);
    var nav = [
      { id: "dashboard", label: "Dashboard", ic: "dashboard" },
      { id: "schedule", label: "Schedule", ic: "calendar" },
      { id: "budget", label: "Budget", ic: "wallet" },
      { id: "tasks", label: "Tasks", ic: "listChecks" },
      { id: "calendar", label: "Calendar", ic: "calendarDays" },
      { id: "settings", label: "Settings", ic: "gradCap" }
    ];

    var sidebarNav = nav.map(function (n) {
      return '<button class="nav-btn ' + (ui.tab === n.id ? "active" : "") + '" onclick="App.setTab(\'' + n.id + "')\">" + icon(n.ic, 16, "nav-icon") + '<span>' + n.label + "</span></button>";
    }).join("");

    var bottomNav = nav.map(function (n) {
      return '<button class="bottom-nav-btn ' + (ui.tab === n.id ? "active" : "") + '" onclick="App.setTab(\'' + n.id + "')\">" + icon(n.ic, 18) + "<span>" + n.label + "</span></button>";
    }).join("");

    var html = '<div class="layout">';
    var brandMark = icon("gradCap", 18, "brand-cap"); // Changed to use icon helper

    var sidebarClasses = ['sidebar'];
    var sidebarEvents = '';
    if (!state.settings.showSidebar) {
      sidebarClasses.push('closed');
      if (state.settings.sidebarExpandOnHover) {
        sidebarEvents = 'onmouseenter="App.openSidebarOnHover()" onmouseleave="App.closeSidebarOnHover()"';
      }
    }
    var themeLabel = theme === "dark" ? "Light mode" : "Dark mode";

    html += '<aside class="' + sidebarClasses.join(' ') + '" ' + sidebarEvents + '>' +
      '<button type="button" class="brand brand-toggle" onclick="App.toggleSidebar()">' +
      '<div class="brand-badge">' + brandMark + '</div><span class="brand-name">' + escapeHtml(state.settings.appName || "Mavis") + '</span>' +
      '</button>' +
      '<nav class="nav">' + sidebarNav + '</nav>' +
      '<div class="db-status-expanded">' + // Changed to use brandMark
        'Database: <span class="db-status-value">Saved</span>' +
      '</div>' +
      '<div class="db-status-collapsed"><span class="db-status-value-short"></span></div>' +
      '<button class="theme-btn" onclick="App.toggleTheme()">' + icon(theme === "dark" ? "sun" : "moon", 16) + '<span class="theme-text">' + themeLabel + '</span></button>' +
      '</aside>';

    html += '<div class="topbar">' +
      '<div class="topbar-left">' +
        '<div class="topbar-brand-badge">' + brandMark + '</div>' +
        '<div class="topbar-text-group">' +
          '<span class="topbar-title">' + escapeHtml(state.settings.appName || "Mavis") + '</span>' +
          '<div class="topbar-status-badge"><span class="db-status-value-short"></span></div>' +
        '</div>' +
      '</div>' +
      '<div class="topbar-actions">' +
      '<button class="icon-btn" onclick="App.toggleTheme()">' + icon(theme === "dark" ? "sun" : "moon", 18) + '</button>' +
      '</div></div>';

    html += '<main class="main">' + renderPage() + '</main>';

    html += '<nav class="bottom-nav">' + bottomNav + '</nav>'; // Moved inside layout

    if (ui.tab === "dashboard") {
      if (ui.fabOpen) html += '<div class="fab-scrim" onclick="App.closeFab()"></div>';
      html += renderFab();
    }

    html += '<div id="toast-container"></div>'; // Toast container
    if (ui.modal) html += renderModal();

    html += '</div>';
    return html;
  }

  function renderSearchBar() {
    var placeholder = "Search tasks and courses...";
    if (ui.tab === 'tasks') {
        placeholder = "Search tasks";
    } else if (ui.tab === 'schedule') {
        placeholder = "Search Courses";
    }
    return '<div class="global-search-container">' +
        icon("search", 18, "global-search-icon") +
        '<input class="global-search-input" type="search" placeholder="' + placeholder + '" oninput="App.handleSearch(this.value)" value="' + escapeHtml(ui.searchQuery) + '">' +
    '</div>';
  }
  function renderMainContent() {
    var mainEl = document.querySelector(".main");
    if (mainEl) {
        mainEl.innerHTML = renderPage();
    }
  }

  function renderPage() {
    if (ui.searchQuery) {
      return renderSearchResults();
    }
    switch (ui.tab) {
      case "dashboard": return renderDashboard();
      case "schedule": return renderSchedule();
      case "budget": return renderBudget();
      case "tasks": return renderTasks();
      case "calendar": return renderGeneralCalendar();
      case "settings": return renderSettings();
      default: return "";
    }
  }

  function renderSearchResults() {
    var query = ui.searchQuery.toLowerCase().trim();
    if (!query) return "";

    // Determine what to search based on the current tab
    var searchCourses = ui.tab === 'dashboard' || ui.tab === 'schedule';
    var searchTasks = ui.tab === 'dashboard' || ui.tab === 'tasks';

    var filteredCourses = [];
    if (searchCourses) {
        filteredCourses = state.courses.filter(function(c) {
            return (c.name && c.name.toLowerCase().startsWith(query)) ||
                   (c.code && c.code.toLowerCase().startsWith(query)) ||
                   (c.professor && c.professor.toLowerCase().startsWith(query));
        });
    }

    var filteredTasks = [];
    if (searchTasks) {
        filteredTasks = state.tasks.filter(function(t) {
            return (t.title && t.title.toLowerCase().startsWith(query)) ||
                   (t.description && t.description.toLowerCase().startsWith(query)) ||
                   (t.courseName && t.courseName.toLowerCase().startsWith(query));
        });
    }

    var html = renderSearchBar() +
    '<h2 style="margin:0 0 20px;font-size:18px">Search Results for: <span style="color:var(--primary-color)">"' + escapeHtml(ui.searchQuery) + '"</span></h2>';

    if (filteredCourses.length === 0 && filteredTasks.length === 0) {
        var emptyMessage = "No matching items found.";
        if (ui.tab === 'tasks') emptyMessage = "No matching tasks found.";
        if (ui.tab === 'schedule') emptyMessage = "No matching courses found.";
        return html + '<p class="empty-note">' + emptyMessage + '</p>';
    }

    if (filteredCourses.length > 0) {
        html += '<p class="section-label">Courses (' + filteredCourses.length + ')</p>';
        html += '<div class="grid grid-2" style="align-items:start">';
        filteredCourses.forEach(function(course) {
            html += '<div class="card" onclick="App.openCourseModal(\'' + course.id + '\')" style="cursor:pointer; transition: all 0.2s ease;" onkeydown="if(event.key===\'Enter\'){App.openCourseModal(\'' + course.id + '\');}" tabindex="0">' +
                '<p style="font-weight:700; font-size: 15px; margin:0 0 4px;">' + escapeHtml(course.name) + ' <span style="font-weight:500; color: var(--text-muted);">(' + escapeHtml(course.code) + ')</span></p>' +
                '<p style="font-size:13px;color:var(--text-muted); margin:0;">' + escapeHtml(course.professor) + '</p>' +
                '</div>';
        });
        html += '</div>';
    }

    if (filteredTasks.length > 0) {
        var marginTop = filteredCourses.length > 0 ? 'style="margin-top:24px;"' : '';
        html += '<p class="section-label" ' + marginTop + '>Tasks (' + filteredTasks.length + ')</p>';
        filteredTasks.forEach(function(task) {
            html += '<div class="task-row" onclick="App.openTaskModal(\'' + task.id + '\')" style="cursor:pointer"><div style="min-width:0">' +
              '<p class="task-row-title">' + escapeHtml(task.title) + '</p>' +
              '<p class="task-row-sub">' + escapeHtml(task.courseName || task.category) + ' &middot; ' + task.dueDate + '</p>' +
              '</div><div style="display:flex;gap:6px;flex-shrink:0">' +
              '<span class="badge ' + PRIORITY_BADGE[task.priority] + '">' + task.priority + '</span>' +
              '<span class="badge badge-slate">' + (daysBetween(task.dueDate) <= 0 ? "Due today" : daysBetween(task.dueDate) + "d left") + '</span>' +
              '</div></div>';
        });
    }

    return html;
  }

  function renderMoneyMonitorCard() {
    var acc = getAccountSnapshot();
    var currentBalance = getCurrentBudget();
    return '<div class="card"><h3 class="card-title">Money monitor</h3>' +
      '<div class="metric" style="margin-bottom:12px;padding:16px"><p class="metric-label">On-hand</p><p class="metric-value">' + fmtMoney(acc.onHand) + '</p></div>' +
      '<div class="metric" style="margin-bottom:12px;padding:16px"><p class="metric-label">Online</p><p class="metric-value" style="color:var(--sky)">' + fmtMoney(acc.online) + '</p></div>' +
      '<div class="metric" style="padding:16px"><p class="metric-label">Total available</p><p class="metric-value">' + fmtMoney(currentBalance) + '</p></div>' +
      '</div>';
  }

  function renderExpenseBreakdownCard(month, year) {
    var monthTx = state.transactions.filter(function (t) {
      var d = new Date(t.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
    var currMonthCategories = {};
    monthTx.filter(function (t) { return t.type === "Expense"; }).forEach(function (t) {
      currMonthCategories[t.category] = (currMonthCategories[t.category] || 0) + Number(t.amount);
    });
    var pieData = Object.keys(currMonthCategories).map(function (name) { return { name: name, value: currMonthCategories[name] }; });
    var pieTotal = pieData.reduce(function (s, p) { return s + p.value; }, 0);
    var html = '<div class="card"><h3 class="card-title">Expense breakdown (' + MONTH_NAMES[month] + ')</h3>';
    if (pieData.length === 0) {
      html += '<p class="empty-note">No expenses recorded this month.</p>';
    } else {
      var gradientParts = [];
      var acc = 0;
      pieData.forEach(function (p, i) {
        var pct = (p.value / pieTotal) * 100;
        var color = PIE_COLORS[i % PIE_COLORS.length];
        gradientParts.push(color + " " + acc + "% " + (acc + pct) + "%");
        acc += pct;
      });
      html += '<div class="pie-wrap"><div class="pie-circle" style="background:conic-gradient(' + gradientParts.join(", ") + ')"></div>' +
        '<div class="pie-legend">' + pieData.map(function (p, i) {
          var pct = ((p.value / pieTotal) * 100).toFixed(0);
          return '<div class="pie-legend-item"><span class="pie-legend-swatch" style="background:' + PIE_COLORS[i % PIE_COLORS.length] + '"></span>' + p.name + ' — <b>' + fmtMoney(p.value) + '</b> (' + pct + '%)</div>';
        }).join("") + '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function renderSettings() {
    var taskCategories = Array.isArray(state.settings.taskCategories) && state.settings.taskCategories.length ? state.settings.taskCategories.slice() : ["Class", "Event", "Personal"];
    var taskPriorities = Array.isArray(state.settings.taskPriorities) && state.settings.taskPriorities.length ? state.settings.taskPriorities.slice() : DEFAULT_TASK_PRIORITIES.slice();
    var taskTypes = Array.isArray(state.settings.taskTypes) && state.settings.taskTypes.length ? state.settings.taskTypes.slice() : DEFAULT_TASK_TYPES.slice();
    var html = '<div class="toolbar"><h2 style="margin:0;font-size:18px">Website settings</h2><div class="toolbar-right"><button class="btn" onclick="App.setTab(\'dashboard\')">Back to dashboard</button></div></div>';

    var tabs = { interface: 'Interface', tasks: 'Tasks', budget: 'Budget' };
    html += '<div class="view-switch" style="margin-bottom: 20px;">' +
        Object.keys(tabs).map(function(tabId) {
            return '<button class="' + (ui.settingsTab === tabId ? "active" : "") + '" onclick="App.setSettingsTab(\'' + tabId + '\')">' + tabs[tabId] + '</button>';
        }).join("") +
    '</div>';

    if (ui.settingsTab === 'interface') {
        html += '<div class="grid grid-2" style="align-items:start">' +
            '<div class="card"><h3 class="card-title">UI Customization</h3>' +
            '<div style="display:grid;gap:18px">' +
            '<div><p class="section-label" style="margin:0 0 8px">Accent Color</p>' +
            '<div class="chip-row" style="align-items:center;gap:12px;flex-wrap:wrap;">' +
                '<div class="custom-color-picker-wrap">' +
                '<button type="button" class="custom-color-picker-btn" style="background-color:' + escapeHtml(state.settings.accentColor) + '; color:' + getContrastTextColor(state.settings.accentColor) + ';" onclick="document.getElementById(\'accent-color-input\').click()">' + icon("dropper", 18, "custom-color-picker-icon") + '</button>' +
                '<input type="color" id="accent-color-input" class="custom-color-picker-input" value="' + escapeHtml(state.settings.accentColor) + '" oninput="App.previewAccentColor(this.value)" onchange="App.setAccentColor(this.value)" />' +
                '</div>' +
                COURSE_COLORS.map(function(c) { return '<button type="button" class="color-dot ' + (state.settings.accentColor === c ? "active" : "") + '" style="background:' + c + ';" data-color="' + c + '" onclick="App.setAccentColor(\'' + c + '\')"></button>'; }).join("") +
            '</div></div>' +
            '<div><p class="section-label" style="margin:0 0 8px">Layout Density</p><div class="radio-group-pills"><label class="radio-label-pill"><input type="radio" name="layoutDensity" value="comfortable" onchange="App.setLayoutDensity(this.value)" ' + (state.settings.layoutDensity === "comfortable" ? 'checked' : '') + '><span>Comfortable</span></label><label class="radio-label-pill"><input type="radio" name="layoutDensity" value="compact" onchange="App.setLayoutDensity(this.value)" ' + (state.settings.layoutDensity === "compact" ? 'checked' : '') + '><span>Compact</span></label></div></div>' +
            '<div><p class="section-label" style="margin:0 0 8px">Sidebar Behavior (Desktop)</p><div class="radio-group-pills"><label class="radio-label-pill"><input type="radio" name="sidebarBehavior" value="alwaysOpen" onchange="App.setSidebarBehavior(this.value)" ' + (state.settings.showSidebar && !state.settings.sidebarExpandOnHover ? 'checked' : '') + '><span>Always Open</span></label><label class="radio-label-pill"><input type="radio" name="sidebarBehavior" value="expandOnHover" onchange="App.setSidebarBehavior(this.value)" ' + (!state.settings.showSidebar && state.settings.sidebarExpandOnHover ? 'checked' : '') + '><span>Expand on Hover</span></label><label class="radio-label-pill"><input type="radio" name="sidebarBehavior" value="alwaysClosed" onchange="App.setSidebarBehavior(this.value)" ' + (!state.settings.showSidebar && !state.settings.sidebarExpandOnHover ? 'checked' : '') + '><span>Always Closed</span></label></div></div>' +
            '<div><p class="section-label" style="margin:0 0 8px">Accessibility Mode</p><div class="radio-group-pills"><label class="radio-label-pill"><input type="radio" name="accessibilityMode" value="default" onchange="App.setAccessibilityMode(this.value)" ' + (state.settings.accessibilityMode === "default" ? 'checked' : '') + '><span>Default</span></label><label class="radio-label-pill"><input type="radio" name="accessibilityMode" value="highContrast" onchange="App.setAccessibilityMode(this.value)" ' + (state.settings.accessibilityMode === "highContrast" ? 'checked' : '') + '><span>High Contrast</span></label><label class="radio-label-pill"><input type="radio" name="accessibilityMode" value="reducedMotion" onchange="App.setAccessibilityMode(this.value)" ' + (state.settings.accessibilityMode === "reducedMotion" ? 'checked' : '') + '><span>Reduced Motion</span></label></div></div>' +
            '<div><p class="section-label" style="margin:0 0 8px">Default Landing Tab</p><select class="input" onchange="App.setDefaultLandingTab(this.value)">' + ['dashboard', 'schedule', 'budget', 'tasks', 'calendar', 'settings'].map(function(tab) { return '<option value="' + tab + '" ' + (state.settings.defaultLandingTab === tab ? 'selected' : '') + '>' + tab.charAt(0).toUpperCase() + tab.slice(1) + '</option>'; }).join('') + '</select></div>' +
            '</div></div>' +
            '<div class="card"><h3 class="card-title">Dashboard Widgets</h3><div style="display:grid;gap:4px">' +
            '<div class="setting-switch-row"><span>Money Monitor</span><label class="switch"><input type="checkbox" ' + (state.settings.showDashboardMoneyMonitor ? 'checked' : '') + ' onchange="App.toggleSetting(\'showDashboardMoneyMonitor\')"><span class="slider"></span></label></div>' +
            '<div class="setting-switch-row"><span>Expense Breakdown</span><label class="switch"><input type="checkbox" ' + (state.settings.showDashboardExpenseBreakdown ? 'checked' : '') + ' onchange="App.toggleSetting(\'showDashboardExpenseBreakdown\')"><span class="slider"></span></label></div>' +
            '<div class="setting-switch-row"><span>Mini Calendar</span><label class="switch"><input type="checkbox" ' + (state.settings.showDashboardMiniCalendar ? 'checked' : '') + ' onchange="App.toggleSetting(\'showDashboardMiniCalendar\')"><span class="slider"></span></label></div>' +
            '<div class="setting-switch-row"><span>Today\'s Schedule Timeline</span><label class="switch"><input type="checkbox" ' + (state.settings.showScheduleTimeline ? 'checked' : '') + ' onchange="App.toggleSetting(\'showScheduleTimeline\')"><span class="slider"></span></label></div>' +
            '</div></div>' +
        '</div>';
    } else if (ui.settingsTab === 'tasks') {
        html += '<div>' +
            '<div class="card"><h3 class="card-title">Task settings</h3>' +
            '<div style="display:grid;gap:18px">' +
            '<div><p class="section-label" style="margin:0 0 8px">Task categories</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">' + taskCategories.map(function (category) { return '<span class="badge badge-slate" style="display:inline-flex;align-items:center;gap:6px">' + escapeHtml(category) + '<button class="icon-btn" title="Remove" style="padding:0;min-width:16px" onclick="App.removeTaskCategory(\'' + escapeHtml(category).replace(/'/g, "\\'") + '\')">' + icon("x", 12) + '</button></span>'; }).join("") + '</div><div style="display:flex;gap:8px"><input id="task-category-input" class="input" placeholder="Add task category" /><button class="btn btn-sm" onclick="App.addTaskCategory()">Add</button></div></div>' +
            '<div><p class="section-label" style="margin:0 0 8px">Priority categories</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">' + taskPriorities.map(function (priority) { return '<span class="badge badge-slate" style="display:inline-flex;align-items:center;gap:6px">' + escapeHtml(priority) + '<button class="icon-btn" title="Remove" style="padding:0;min-width:16px" onclick="App.removeTaskPriority(\'' + escapeHtml(priority).replace(/'/g, "\\'") + '\')">' + icon("x", 12) + '</button></span>'; }).join("") + '</div><div style="display:flex;gap:8px"><input id="task-priority-input" class="input" placeholder="Add priority" /><button class="btn btn-sm" onclick="App.addTaskPriority()">Add</button></div></div>' +
            '<div><p class="section-label" style="margin:0 0 8px">Task type</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">' + taskTypes.map(function (type) { return '<span class="badge badge-slate" style="display:inline-flex;align-items:center;gap:6px">' + escapeHtml(type) + '<button class="icon-btn" title="Remove" style="padding:0;min-width:16px" onclick="App.removeTaskType(\'' + escapeHtml(type).replace(/'/g, "\\'") + '\')">' + icon("x", 12) + '</button></span>'; }).join("") + '</div><div style="display:flex;gap:8px"><input id="task-type-input" class="input" placeholder="Add task type" /><button class="btn btn-sm" onclick="App.addTaskType()">Add</button></div></div>' +
            '</div></div>' +
        '</div>';
    } else if (ui.settingsTab === 'budget') {
        html += '<div>' +
            '<div class="card"><h3 class="card-title">Budget categories & payment methods</h3>' +
            '<div style="display:grid;gap:18px">' +
            '<div><p class="section-label" style="margin:0 0 8px">Expense categories</p><div style="display:flex;flex-wrap:wrap;gap:8px">' + getBudgetCategories().map(function (category) { return '<span class="badge badge-slate" style="display:inline-flex;align-items:center;gap:6px">' + escapeHtml(category) + '<button class="icon-btn" title="Remove" style="padding:0;min-width:16px" onclick="App.removeBudgetCategory(\'' + escapeHtml(category).replace(/'/g, "\\'") + '\')">' + icon("x", 12) + '</button></span>'; }).join("") + '</div><div style="display:flex;gap:8px;margin-top:10px"><input id="budget-category-input" class="input" placeholder="Add category" /><button class="btn btn-sm" onclick="App.addBudgetCategory()">Add</button></div></div>' +
            '<div><p class="section-label" style="margin:0 0 8px">Payment methods</p><div style="display:flex;flex-wrap:wrap;gap:8px">' + getPaymentMethods().map(function (method) { return '<span class="badge badge-slate" style="display:inline-flex;align-items:center;gap:6px">' + escapeHtml(method) + '<button class="icon-btn" title="Remove" style="padding:0;min-width:16px" onclick="App.removePaymentMethod(\'' + escapeHtml(method).replace(/'/g, "\\'") + '\')">' + icon("x", 12) + '</button></span>'; }).join("") + '</div><div style="display:flex;gap:8px;margin-top:10px"><input id="payment-method-input" class="input" placeholder="Add method" /><button class="btn btn-sm" onclick="App.addPaymentMethod()">Add</button></div></div>' +
            '</div></div>' +
        '</div>';
    }

    return html;
  }

  /* ---------------- Dashboard ---------------- */
  function renderDashboard() {
    var totalIncome = state.transactions.filter(function (t) { return t.type === "Income"; }).reduce(function (s, t) { return s + Number(t.amount); }, 0);
    var totalExpenses = state.transactions.filter(function (t) { return t.type === "Expense"; }).reduce(function (s, t) { return s + Number(t.amount); }, 0);
    var remaining = totalIncome - totalExpenses;
    
    // The progress bar should show expenses relative to income.
    // If there's no income, any expense is 100% of the "budget".
    var pctUsed = totalIncome > 0 ? Math.min(100, (totalExpenses / Math.max(totalIncome, 1)) * 100) : (totalExpenses > 0 ? 100 : 0);
    var low = pctUsed >= 80;

    var upcoming = state.tasks
      .filter(function (t) { return t.status !== "Completed" && t.status !== "Submitted"; })
      .map(function (t) { return Object.assign({}, t, { daysLeft: daysBetween(t.dueDate) }); })
      .filter(function (t) { return t.daysLeft <= 3; })
      .sort(function (a, b) { return a.daysLeft - b.daysLeft; });

    var html = renderSearchBar();

    // Conditional rendering for schedule timeline
    if (state.settings.showScheduleTimeline) {
      html += renderScheduleTimeline();
    } else {
      html += '<div class="card" style="margin-bottom:20px;"><h3 class="card-title">' + icon("clock", 16) + ' Today\'s Schedule Timeline</h3><p class="empty-note">Today\'s schedule timeline is hidden. You can enable it in settings.</p></div>';
    }

    html += '<div style="margin-top:20px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
      '<p class="section-label" style="margin:0">Finances</p>' +
      '<button class="btn-pill" onclick="App.setTab(\'budget\')">Full budget ' + icon("arrowUpRight", 12) + '</button></div>';
    html += '<div class="grid grid-3">';
    html += '<div class="metric"><p class="metric-label">Total income</p><p class="metric-value">' + fmtMoney(totalIncome) + '</p></div>';
    html += '<div class="metric"><p class="metric-label">Total expenses</p><p class="metric-value danger">' + fmtMoney(totalExpenses) + '</p></div>';
    html += '<div class="metric">' +
      '<p class="metric-label">Remaining balance</p>' +
      '<p class="metric-value ' + (remaining < 0 ? "danger" : "") + '">' + fmtMoney(remaining) + '</p>' +
      '<div class="progress"><div class="progress-fill ' + (low ? "danger" : "") + '" style="width:' + pctUsed + '%"></div></div>' +
      (low ? '<p class="warn-text">' + icon("alert", 12) + ' Budget running low</p>' : "") +
      '</div>';
    html += '</div></div>';

    html += '<div class="grid grid-2" style="margin-top:20px;align-items:start">';
    html += '<div class="card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<h3 class="card-title" style="margin:0">' + icon("listChecks", 16) + ' Upcoming tasks</h3>' +
      '<button class="btn-pill" onclick="App.setTab(\'tasks\')">All tasks ' + icon("arrowUpRight", 12) + '</button>' +
      '</div>';
    if (upcoming.length === 0) {
      html += '<p style="font-size:13px;color:var(--text-faint)">Nothing due in the next 3 days.</p>';
    } else {
      upcoming.forEach(function (t) {
        html += '<div class="task-row" onclick="App.openTaskModal(\'' + t.id + '\')" style="cursor:pointer"><div style="min-width:0">' +
          '<p class="task-row-title">' + escapeHtml(t.title) + '</p>' +
          '<p class="task-row-sub">' + escapeHtml(t.courseName || t.category) + ' &middot; ' + t.dueDate + '</p>' +
          '</div><div style="display:flex;gap:6px;flex-shrink:0">' +
          '<span class="badge ' + PRIORITY_BADGE[t.priority] + '">' + t.priority + '</span>' +
          '<span class="badge badge-slate">' + (t.daysLeft <= 0 ? "Due today" : t.daysLeft + "d left") + '</span>' +
          '</div></div>';
      });
    }
    html += '</div>';

    if (state.settings.showDashboardMoneyMonitor) html += renderMoneyMonitorCard();
    if (state.settings.showDashboardExpenseBreakdown) html += renderExpenseBreakdownCard(new Date().getMonth(), new Date().getFullYear());
    if (state.settings.showDashboardMiniCalendar) html += renderMiniCalendar();
    html += '</div>';

    return html;
  }

  function renderScheduleTimeline() {
    var now = new Date();
    var dow = now.getDay();
    var todayDateKey = todayStr();

    // Check for items to determine which view to render
    var d = new Date(todayDateKey + "T00:00:00");
    var hasItems = state.courses.some(function (course) {
        return (course.schedules || []).some(function(schedule) { return schedule.days.indexOf(d.getDay()) !== -1; });
      }) || state.tasks.some(function (t) { return t.dueDate === todayDateKey; });

    var bodyHtml;
    if (hasItems) {
      // If there are items, render the detailed list inside a scrollable container
      bodyHtml = '<div class="timeline-day-view-body">' + renderDayDetailList(todayDateKey) + '</div>';
    } else {
      // Otherwise, render a clean empty state
      bodyHtml = '<div class="timeline-empty-wrap"><div class="timeline-empty">No classes or tasks scheduled today.</div></div>';
    }

    return '<div class="card" style="padding:0;">' +
      '<div class="timeline-head">' +
        '<h3 class="card-title" style="margin:0">' + icon("clock", 16) + ' Today &middot; ' + DAY_LABELS[dow] + '</h3>' +
        '<span style="font-size:11px;color:var(--text-faint);font-family:monospace">' + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + '</span>' +
      '</div>' +
      bodyHtml +
      '</div>';
  }

  function renderMiniCalendar() {
    var cur = ui.miniCalCursor;
    var dots = getMonthDots(cur.y, cur.m);
    var firstDow = new Date(cur.y, cur.m, 1).getDay();
    var daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
    var today = new Date();

    var cells = "";
    for (var i = 0; i < firstDow; i++) cells += '<div></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var isToday = today.getFullYear() === cur.y && today.getMonth() === cur.m && today.getDate() === d;
      var dayKey = dateKey(cur.y, cur.m, d);
      var daySchedule = state.courses.filter(function (c) {
          var dow = new Date(cur.y, cur.m, d).getDay();
          return (c.schedules || []).some(function(s) { return s.days.indexOf(dow) !== -1; });
      }).flatMap(function (c) {
          return (c.schedules || []).filter(function(s) { return s.days.indexOf(new Date(cur.y, cur.m, d).getDay()) !== -1; }).map(function(s) { return c.name + " " + fmtTime12(s.startTime) + "-" + fmtTime12(s.endTime); });
      });
      var taskSchedule = state.tasks.filter(function (t) { return t.dueDate === dayKey; }).map(function (t) {
        return (t.category || "Personal") + ": " + (t.title || "Task") + " " + (t.dueTime ? fmtTime12(t.dueTime) : "Any time");
      });
      var combinedSchedule = daySchedule.concat(taskSchedule);
      var tooltip = combinedSchedule.length ? combinedSchedule.join("\n") : "No classes or tasks";
      var timelineCats = [];
      if (dots[d]) timelineCats = timelineCats.concat(dots[d]);
      state.tasks.filter(function (t) { return t.dueDate === dayKey; }).forEach(function (t) {
        var cat = t.category || "Personal";
        if (timelineCats.indexOf(cat) === -1) timelineCats.push(cat);
      });
      var dotHtml = "";
      if (timelineCats.length) {
        dotHtml = '<span class="mini-cal-dots">' + timelineCats.slice(0, 3).map(function (cat) {
          return '<span style="background:' + getCategoryColor(cat) + '"></span>'; // Background for dots is handled by CSS for .today
        }).join("") + '</span>';
      }
      cells += '<button class="mini-cal-day ' + (isToday ? "today" : "") + '" data-tooltip="' + escapeHtml(tooltip) + '" title="' + escapeHtml(tooltip) + '" onclick="App.openDayDetail(\'' + dayKey + '\')">' + d + dotHtml + '</button>';
    }

    var dow = DAY_NAMES.map(function (d) { return '<div class="mini-cal-dow">' + d + '</div>'; }).join("");

    return '<div class="card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<h3 class="card-title" style="margin:0">' + icon("calendarDays", 16) + ' ' + MONTH_NAMES[cur.m] + ' ' + cur.y + '</h3>' +
      '<div style="display:flex;gap:4px">' +
      '<button class="btn-pill" onclick="App.setTab(\'calendar\')">Full view ' + icon("arrowUpRight", 12) + '</button>' +
      '<button class="cal-nav-btn" onclick="App.miniCalNav(-1)">' + icon("chevLeft", 16) + '</button>' +
      '<button class="cal-nav-btn" onclick="App.miniCalNav(1)">' + icon("chevRight", 16) + '</button>' +
      '</div></div>' +
      '<div class="mini-cal-grid">' + dow + cells + '</div>' +
      '<div class="legend-row">' +
      '<span class="legend-dot"><span class="dot-class"></span> Class</span>' +
      '<span class="legend-dot"><span class="dot-event"></span> Event</span>' +
      '<span class="legend-dot"><span class="dot-personal"></span> Personal</span>' +
      '</div></div>';
  }

  function renderSingleCourseCard(course) {
    // Ensure color is a valid hex string or default to the first course color
    var color = (course.color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(course.color)) ? course.color : COURSE_COLORS[0];
    var contrastColor = getContrastTextColor(color);
    var contrastColorFaint = hexToRgba(contrastColor, 0.7);
    var contrastColorMuted = hexToRgba(contrastColor, 0.8);
    var borderColor = hexToRgba(color, 0.5);
    var professor = escapeHtml(course.professor || 'N/A');

    var metaDetails = (course.schedules || []).map(function(s) {
        var days = Array.isArray(s.days) ? s.days.map(function(d) { return DAY_NAMES[d]; }).join(", ") : 'N/A';
        var time = (s.startTime ? fmtTime12(s.startTime) : 'N/A') + ' - ' + (s.endTime ? fmtTime12(s.endTime) : 'N/A');
        var location = escapeHtml(s.modality || 'N/A') + (s.room ? ' &middot; ' + escapeHtml(s.room) : '');
        var iconName = s.modality === "Online" ? "video" : "mapPin";
        return '<div>' + icon("calendar", 13) + '<span>' + days + '</span></div>' +
               '<div>' + icon("clock", 13) + '<span>' + time + '</span></div>' +
               '<div>' + icon(iconName, 13) + '<span>' + location + '</span></div>';
    }).join('<div class="course-meta-divider"></div>');

    return '<div class="course-card" style="background: radial-gradient(140% 140% at 0% 0%, ' + hexToRgba(color, 0.9) + ' 0%, ' + hexToRgba(color, 0.1) + ' 100%); border-color: ' + borderColor + '; color: ' + contrastColor + ';">' +
        '<div class="course-card-head">' +
            '<div>' +
                '<p class="course-card-name">' + escapeHtml(course.name || 'Untitled Course') + '</p>' +
                '<p class="course-card-code" style="color: ' + contrastColorFaint + ';">' + escapeHtml(course.code || 'N/A') + '</p>' +
            '</div>' +
            '<button class="icon-btn" title="Edit course" onclick="App.openCourseModal(\'' + course.id + '\')" style="color: ' + hexToRgba(contrastColor, 0.9) + ';">' + icon("pencil", 14) + '</button>' +
        '</div>' +
        '<div class="course-meta" style="color: ' + contrastColorMuted + ';">' +
            '<div>' + icon("user", 13) + '<span>' + professor + '</span></div>' +
            metaDetails +
        '</div>' +
        '<div class="course-card-actions">' +
            '<button class="btn-edit-solid" onclick="App.openCourseModal(\'' + course.id + '\')">Edit</button>' +
            '<button class="btn-delete-solid" onclick="App.deleteCourseWithConfirmation(\'' + course.id + '\')">Delete</button>' +
        '</div>' +
    '</div>';
  }

  function renderCourseCards() {
    var html = '<div class="grid grid-3">';
    state.courses.forEach(function(course) {
        if (course && typeof course === 'object') { // Ensure course is a valid object before rendering
            html += renderSingleCourseCard(course);
        }
    });
    html += '</div>';
    return html;
  }

  function renderCourseTable() {
    var byDay = [[], [], [], [], [], [], []];
    state.courses.forEach(function(course) {
        (course.schedules || []).forEach(function(schedule) {
            schedule.days.forEach(function(dayIndex) {
                // Push an object containing both course and the specific schedule
                byDay[dayIndex].push({ course: course, schedule: schedule });
            });
        });
    });

    var hourRows = [];
    for (var hour = 7; hour <= 22; hour++) {
      var row = '<tr>' +
        '<td class="schedule-time">' + fmtTime12(pad2(hour) + ':00') + '</td>';
      for (var day = 0; day < 7; day++) {
        var matches = byDay[day].filter(function (item) {
          return minutesOf(item.schedule.startTime) < hour * 60 + 60 && minutesOf(item.schedule.endTime) > hour * 60;
        });
        var cellHtml = matches.length ? matches.map(function (item) {
          var course = item.course;
          var schedule = item.schedule;
          var color = course.color || COURSE_COLORS[0];
          return '<div class="schedule-chip" style="background:' + hexToRgba(color, 0.12) + '; border-left: 3px solid ' + color + '; color:' + color + ';" onclick="App.openCourseModal(\'' + course.id + '\')" title="' + escapeHtml(course.name) + '">' +
            '<strong>' + escapeHtml(course.code) + '</strong><span>' + escapeHtml(course.name) + '</span><small>' + fmtTime12(schedule.startTime) + '-' + fmtTime12(schedule.endTime) + '</small>' +
            '</div>';
        }).join("") : "";
        row += '<td class="schedule-cell">' + cellHtml + '</td>';
      }
      row += '</tr>';
      hourRows.push(row);
    }
    return '<div class="card schedule-table-card" style="padding:0;overflow:auto"><table class="schedule-table"><thead><tr><th>Time</th>' + DAY_NAMES.map(function (d) { return '<th>' + d + '</th>'; }).join("") + '</tr></thead><tbody>' + hourRows.join("") + '</tbody></table></div>';
  }

  /* ---------------- Schedule Manager ---------------- */
  function renderSchedule() {
    var html = renderSearchBar() + '<div class="toolbar">' +
      '<h2 style="margin:0;font-size:18px">Courses</h2>' +
      '<div class="toolbar-right">' +
        '<div class="view-switch">' +
          ['table', 'cards'].map(function (v) {
            var labels = { table: "Table", cards: "Cards" };
            return '<button class="' + (ui.scheduleView === v ? "active" : "") + '" onclick="App.setScheduleView(\'' + v + '\')">' + labels[v] + '</button>';
          }).join("") +
        '</div>' +
        '<button class="btn" onclick="App.openCourseModal()">' + icon("plus", 16) + ' Add course</button>' +
      '</div></div>';

    if (state.courses.length === 0) {
      return html + '<p class="empty-note">No courses yet. Add your first class.</p>';
    }

    if (ui.scheduleView === 'cards') {
        html += renderCourseCards();
    } else { // default to table
        html += renderCourseTable();
    }
    return html;
  }

  /* ---------------- Budget Tracker ---------------- */
  function renderBudget() {
    var view = ui.budgetView;
    var now = new Date();
    var year = ui.budgetYear, month = ui.budgetMonth;

    var monthTx = state.transactions.filter(function (t) {
      var d = new Date(t.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
    var yearTx = state.transactions.filter(function (t) { return new Date(t.date + "T00:00:00").getFullYear() === year; });

    // Apply search and date filters to the transaction list for the current month
    var displayedTx = monthTx;
    if (ui.budgetDateFilter) {
        displayedTx = displayedTx.filter(function(t) {
            return t.date === ui.budgetDateFilter;
        });
    }
    if (ui.budgetSearchQuery) {
        var query = ui.budgetSearchQuery.toLowerCase().trim();
        if (query) {
            displayedTx = displayedTx.filter(function(t) {
                return (t.item && t.item.toLowerCase().startsWith(query)) ||
                       (t.category && t.category.toLowerCase().startsWith(query));
            });
        }
    }

    var monthIncome = monthTx.filter(function (t) { return t.type === "Income"; }).reduce(function (s, t) { return s + Number(t.amount); }, 0);
    var monthExpense = monthTx.filter(function (t) { return t.type === "Expense"; }).reduce(function (s, t) { return s + Number(t.amount); }, 0);
    var yearIncome = yearTx.filter(function (t) { return t.type === "Income"; }).reduce(function (s, t) { return s + Number(t.amount); }, 0);
    var yearExpense = yearTx.filter(function (t) { return t.type === "Expense"; }).reduce(function (s, t) { return s + Number(t.amount); }, 0);

    var currentBalance = getCurrentBudget();
    var accountSnapshot = getAccountSnapshot();
    var currMonthCategories = {};
    monthTx.filter(function (t) { return t.type === "Expense"; }).forEach(function (t) { currMonthCategories[t.category] = (currMonthCategories[t.category] || 0) + Number(t.amount); });
    var prevMonthDate = new Date(year, month - 1, 1);
    var prevMonthTx = state.transactions.filter(function (t) {
      var d = new Date(t.date + "T00:00:00");
      return d.getFullYear() === prevMonthDate.getFullYear() && d.getMonth() === prevMonthDate.getMonth();
    });
    var prevMonthCategories = {};
    prevMonthTx.filter(function (t) { return t.type === "Expense"; }).forEach(function (t) { prevMonthCategories[t.category] = (prevMonthCategories[t.category] || 0) + Number(t.amount); });
    var catNames = Array.from(new Set(Object.keys(currMonthCategories).concat(Object.keys(prevMonthCategories))));
    var comparisonRows = catNames.map(function (name) {
      var prev = prevMonthCategories[name] || 0;
      var curr = currMonthCategories[name] || 0;
      return { name: name, prev: prev, curr: curr, delta: curr - prev };
    }).sort(function (a, b) { return b.curr - a.curr; });

    var yearCats = {};
    yearTx.filter(function (t) { return t.type === "Expense"; }).forEach(function (t) { yearCats[t.category] = (yearCats[t.category] || 0) + Number(t.amount); });
    var yearlyRows = Object.keys(yearCats).map(function (name) { return { name: name, value: yearCats[name] }; }).sort(function (a, b) { return b.value - a.value; });

    var pieData = Object.keys(currMonthCategories).map(function (name) { return { name: name, value: currMonthCategories[name] }; });
    var pieTotal = pieData.reduce(function (s, p) { return s + p.value; }, 0);
    var topCategory = pieData.slice().sort(function (a, b) { return b.value - a.value; })[0];

    var monthlyFlow = MONTH_NAMES.map(function (name, i) {
      var tx = yearTx.filter(function (t) { return new Date(t.date + "T00:00:00").getMonth() === i; });
      return {
        month: name.slice(0, 3),
        income: tx.filter(function (t) { return t.type === "Income"; }).reduce(function (s, t) { return s + Number(t.amount); }, 0),
        expense: tx.filter(function (t) { return t.type === "Expense"; }).reduce(function (s, t) { return s + Number(t.amount); }, 0)
      };
    });

    var yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
    if (yearOptions.indexOf(year) === -1) yearOptions.push(year);
    var budgetCategoryList = getBudgetCategories();
    var paymentList = getPaymentMethods();

    var viewSwitcher = '<div class="view-switch">' +
      ['overview', 'transactions'].map(function (v) {
        var labels = { overview: "Overview", transactions: "Transactions" };
        return '<button class="' + (view === v ? "active" : "") + '" onclick="App.setBudgetView(\'' + v + '\')">' + labels[v] + '</button>';
      }).join("") +
    '</div>';

    var filterControls = '';
    if (view === 'transactions') {
      filterControls = '<input id="budget-search-input" class="input" type="search" placeholder="Search items..." style="width:180px" oninput="App.setBudgetSearch(this.value)" value="' + escapeHtml(ui.budgetSearchQuery) + '">' +
      '<input class="input" type="date" onchange="App.setBudgetDateFilter(this.value)" value="' + escapeHtml(ui.budgetDateFilter) + '">' +
      (ui.budgetSearchQuery || ui.budgetDateFilter ? '<button class="icon-btn" title="Clear filters" onclick="App.clearBudgetFilters()">' + icon("x", 16) + '</button>' : '');
    }

    var html = '<div class="toolbar">' + // Toolbar without search/date filters
      '<h2 style="margin:0;font-size:18px">Budget tracker</h2>' +
      '<div class="toolbar-right">' +
      viewSwitcher +
      '<select class="input" style="width:140px" onchange="App.setBudgetMonth(this.value)">' + MONTH_NAMES.map(function (m, i) { return '<option value="' + i + '" ' + (i === month ? "selected" : "") + '>' + m + '</option>'; }).join("") + '</select>' +
      '<select class="input" style="width:100px" onchange="App.setBudgetYear(this.value)">' + yearOptions.map(function (y) { return '<option value="' + y + '" ' + (y === year ? "selected" : "") + '>' + y + '</option>'; }).join("") + '</select>' +
      '<button class="btn" onclick="App.openTransactionModal()">' + icon("plus", 16) + ' Add</button>' +
      '</div></div>';

    if (view === 'transactions') {
      html += '<div class="budget-search-bar">' +
        '<div class="budget-search-text-wrapper">' +
          icon("search", 18, "budget-search-icon") +
          '<input id="budget-search-input" class="input" type="search" placeholder="Search items or categories..." oninput="App.setBudgetSearch(this.value)" value="' + escapeHtml(ui.budgetSearchQuery) + '">' +
        '</div>' +
        '<input class="input" type="date" onchange="App.setBudgetDateFilter(this.value)" value="' + escapeHtml(ui.budgetDateFilter) + '">' +
        (ui.budgetSearchQuery || ui.budgetDateFilter ? '<button class="icon-btn" title="Clear filters" onclick="App.clearBudgetFilters()">' + icon("x", 16) + '</button>' : '') +
      '</div>';
    }

    if (view === 'transactions') {
      html += '<div class="card table-wrap" style="padding:0">' +
        '<h3 class="card-title" style="padding:16px 16px 0">Transactions</h3>' +
        '<table class="data-table"><thead><tr><th>Date</th><th>Category</th><th>Item</th><th>Type</th><th>Method</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>';
      var sortedTx = displayedTx.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
      if (sortedTx.length === 0) {
        var emptyMessage = (ui.budgetSearchQuery || ui.budgetDateFilter) ? "No transactions match your filters." : "No transactions this month.";
        html += '<tr><td colspan="7" class="table-empty">' + emptyMessage + '</td></tr>';
      } else {
        sortedTx.forEach(function (t) {
          html += '<tr><td style="font-family:monospace;font-size:12px;color:var(--text-faint)">' + t.date + '</td>' +
            '<td>' + escapeHtml(t.category) + '</td><td>' + escapeHtml(t.item) + '</td>' +
            '<td><span class="badge ' + (t.type === "Income" ? "badge-income" : "badge-expense") + '">' + t.type + '</span></td>' +
            '<td style="color:var(--text-muted)">' + escapeHtml(t.method) + '</td>' +
            '<td style="text-align:right" class="' + (t.type === "Income" ? "amount-pos" : "amount-neg") + '">' + (t.type === "Income" ? "+" : "-") + fmtMoney(t.amount) + '</td>' +
            '<td style="text-align:right"><button class="icon-trash" onclick="App.deleteTransaction(\'' + t.id + '\')">' + icon("trash", 14) + '</button></td></tr>';
        });
      }
      html += '</tbody></table></div>';
    } else { // Overview
      html += '<div class="grid grid-4">';
      html += '<div class="metric"><p class="metric-label">Monthly income</p><p class="metric-value">' + fmtMoney(monthIncome) + '</p></div>';
      html += '<div class="metric"><p class="metric-label">Monthly expenses</p><p class="metric-value danger">' + fmtMoney(monthExpense) + '</p></div>';
      html += '<div class="metric"><p class="metric-label">Monthly balance</p><p class="metric-value ' + (monthIncome - monthExpense < 0 ? "danger" : "") + '">' + fmtMoney(monthIncome - monthExpense) + '</p></div>';
      html += '<div class="metric"><p class="metric-label">Total available</p><p class="metric-value">' + fmtMoney(currentBalance) + '</p></div>';
      html += '</div>';

      html += '<div class="grid grid-2" style="margin-top:16px;align-items:start">';
      html += '<div class="card"><h3 class="card-title">Money monitor</h3>' +
        '<div class="metric" style="margin-bottom:12px;padding:16px"><p class="metric-label">On-hand</p><p class="metric-value">' + fmtMoney(accountSnapshot.onHand) + '</p></div>' +
        '<div class="metric" style="margin-bottom:12px;padding:16px"><p class="metric-label">Online</p><p class="metric-value" style="color:var(--sky)">' + fmtMoney(accountSnapshot.online) + '</p></div>' +
        '<div class="metric" style="padding:16px"><p class="metric-label">Total available</p><p class="metric-value">' + fmtMoney(currentBalance) + '</p></div>' +
        '</div>';

      html += '<div class="card"><h3 class="card-title">Expense breakdown (' + MONTH_NAMES[month] + ')</h3>';
      if (pieData.length === 0) {
        html += '<p class="empty-note">No expenses recorded this month.</p>';
      } else {
        var gradientParts = [];
        var acc = 0;
        pieData.forEach(function (p, i) {
          var pct = (p.value / pieTotal) * 100;
          var color = PIE_COLORS[i % PIE_COLORS.length];
          gradientParts.push(color + " " + acc + "% " + (acc + pct) + "%");
          acc += pct;
        });
        html += '<div class="pie-wrap">' +
          '<div class="pie-circle" style="background:conic-gradient(' + gradientParts.join(", ") + ')"></div>' +
          '<div class="pie-legend">' + pieData.map(function (p, i) {
            var pct = ((p.value / pieTotal) * 100).toFixed(0);
            return '<div class="pie-legend-item"><span class="pie-legend-swatch" style="background:' + PIE_COLORS[i % PIE_COLORS.length] + '"></span>' + p.name + ' — <b>' + fmtMoney(p.value) + '</b> (' + pct + '%)</div>';
          }).join("") + '</div></div>';
      }
      html += '</div>';
      html += '</div>';

      html += '<div class="grid grid-2" style="margin-top:16px;align-items:start">';
      html += '<div class="card"><h3 class="card-title">Monthly expenses comparison</h3>' +
        (comparisonRows.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Category</th><th>Last month</th><th>This month</th><th>Change</th></tr></thead><tbody>' + comparisonRows.map(function (row) {
          return '<tr><td>' + escapeHtml(row.name) + '</td><td>' + fmtMoney(row.prev) + '</td><td>' + fmtMoney(row.curr) + '</td><td class="' + (row.delta >= 0 ? "amount-neg" : "amount-pos") + '">' + (row.delta >= 0 ? "+" : "-") + fmtMoney(Math.abs(row.delta)) + '</td></tr>';
        }).join("") + '</tbody></table></div>' : '<p class="empty-note">No expense history to compare yet.</p>') +
        '</div>';

      html += '<div class="card"><h3 class="card-title">Annual cash flow (' + year + ')</h3>' + renderLineChart(monthlyFlow) + '</div>';
      html += '</div>';

      html += '<div class="grid grid-2" style="margin-top:16px;align-items:start">';
      html += '<div class="card"><h3 class="card-title">Yearly expenses by category</h3>' +
        (yearlyRows.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Category</th><th>Total</th></tr></thead><tbody>' + yearlyRows.map(function (row) {
          return '<tr><td>' + escapeHtml(row.name) + '</td><td class="amount-neg">' + fmtMoney(row.value) + '</td></tr>';
        }).join("") + '</tbody></table></div>' : '<p class="empty-note">No yearly expense data yet.</p>') +
        '</div>';
      html += '<div class="card"><h3 class="card-title">Quick summary</h3>' +
        '<div style="display:grid;gap:12px"><div class="metric" style="padding:16px"><p class="metric-label">Current balance</p><p class="metric-value">' + fmtMoney(currentBalance) + '</p></div>' +
        '<div class="metric" style="padding:16px"><p class="metric-label">Top expense category</p><p class="metric-value danger">' + (topCategory ? escapeHtml(topCategory.name) : "—") + '</p></div></div>' +
        '</div>';
      html += '</div>';
    }

    return html;
  }

  function createSvgPath(points) {
    var smoothing = 0.2;
    var line = function (pointA, pointB) {
      var lengthX = pointB[0] - pointA[0];
      var lengthY = pointB[1] - pointA[1];
      return {
        length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
        angle: Math.atan2(lengthY, lengthX)
      };
    };
    var controlPoint = function (current, previous, next, reverse) {
      var p = previous || current;
      var n = next || current;
      var o = line(p, n);
      var angle = o.angle + (reverse ? Math.PI : 0);
      var length = o.length * smoothing;
      var x = current[0] + Math.cos(angle) * length;
      var y = current[1] + Math.sin(angle) * length;
      return [x, y];
    };
    var bezierCommand = function (point, i, a) {
      var cps = controlPoint(a[i - 1], a[i - 2], point);
      var cpe = controlPoint(point, a[i - 1], a[i + 1], true);
      return "C " + cps[0] + "," + cps[1] + " " + cpe[0] + "," + cpe[1] + " " + point[0] + "," + point[1];
    };
    return points.reduce(function (acc, point, i, a) {
      return i === 0 ? "M " + point[0] + "," + point[1] : acc + " " + bezierCommand(point, i, a);
    }, "");
  }

  function renderLineChart(monthlyFlow) {
    var w = 560, h = 200, padL = 34, padR = 8, padT = 10, padB = 24;
    var maxVal = Math.max(1, Math.max.apply(null, monthlyFlow.map(function (m) { return Math.max(m.income, m.expense); })));
    var innerW = w - padL - padR, innerH = h - padT - padB;
    function pt(i, v) {
      var x = padL + (i / (monthlyFlow.length - 1)) * innerW;
      var y = padT + innerH - (v / maxVal) * innerH;
      return [x, y];
    }
    var incomePts = monthlyFlow.map(function (m, i) { return pt(i, m.income); });
    var expensePts = monthlyFlow.map(function (m, i) { return pt(i, m.expense); });
    var gridLines = "";
    for (var g = 0; g <= 3; g++) {
      var y = padT + (innerH / 3) * g;
      gridLines += '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"/>';
    }
    var labels = monthlyFlow.map(function (m, i) {
      var x = padL + (i / (monthlyFlow.length - 1)) * innerW;
      return '<text x="' + x + '" y="' + (h - 6) + '" font-size="9" text-anchor="middle" fill="var(--text-faint)">' + m.month + '</text>';
    }).join("");

    return '<svg class="linechart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      gridLines + labels +
      '<path d="' + createSvgPath(incomePts) + '" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="' + createSvgPath(expensePts) + '" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round"/>' +
      '</svg>' +
      '<div class="linechart-legend"><span><i style="background:#0284c7"></i> Income</span><span><i style="background:#e11d48"></i> Expense</span></div>';
  }

  /* ---------------- Tasks ---------------- */
  function taskCardHtml(task) {
    var daysLeft = daysBetween(task.dueDate);
    var sub = task.category === "Class" ? (escapeHtml(task.courseName) + " &middot; " + escapeHtml(task.taskType || "")) : (task.category === "Personal" ? "Personal" : escapeHtml(task.location || "Event"));
    var html = '<div class="task-card" draggable="true" ondragstart="App.handleDragStart(event, \'' + task.id + '\')" ondragend="App.handleDragEnd(event)"><div class="task-card-top"><div style="min-width:0">' +
      '<p class="task-card-title">' + escapeHtml(task.title) + '</p>' +
      '<p class="task-card-sub">' + sub + '</p></div>' +
      '<div style="display:flex;gap:8px;align-items:center"><button class="icon-btn" title="Edit task" onclick="App.openTaskModal(\'' + task.id + '\');event.stopPropagation();">' + icon("pencil", 13) + '</button><button class="icon-trash" onclick="App.deleteTaskWithConfirmation(\'' + task.id + '\');event.stopPropagation();">' + icon("trash", 13) + '</button></div></div>' +
      '<div class="task-card-badges">' +
      '<span class="badge ' + PRIORITY_BADGE[task.priority] + '">' + task.priority + '</span>' +
      '<span class="badge badge-slate">' + (daysLeft < 0 ? "Overdue" : daysLeft === 0 ? "Due today" : daysLeft + "d left") + '</span>' +
      '</div><p class="task-card-time">' + task.dueDate + ' ' + (task.dueTime || "") + '</p>';
    if (task.category === "Class") {
      html += '<select class="input" style="margin-top:8px;padding:5px 8px;font-size:11px" onchange="App.setTaskStatus(\'' + task.id + '\', this.value)">' +
        STATUSES.map(function (s) { return '<option ' + (task.status === s ? "selected" : "") + '>' + s + '</option>'; }).join("") + '</select>';
    }
    html += '</div>';
    return html;
  }

  function sortTasks(tasks, key) {
    var copied = tasks.slice();
    copied.sort(function (a, b) {
      if (key === "status") {
        var statusOrder = { "To Do": 0, "In Progress": 1, "Submitted": 2, "Completed": 3 };
        var statusDiff = (statusOrder[a.status || "To Do"] || 0) - (statusOrder[b.status || "To Do"] || 0);
        if (statusDiff !== 0) return statusDiff;
      } else if (key === "priority") {
        var diff = (PRIORITY_LEVEL[b.priority] || 0) - (PRIORITY_LEVEL[a.priority] || 0);
        if (diff !== 0) return diff;
      } else if (key === "course") {
        var courseDiff = (a.courseName || a.category || "").localeCompare(b.courseName || b.category || "");
        if (courseDiff !== 0) return courseDiff;
      } else if (key === "daysLeft") {
        var leftDiff = daysBetween(a.dueDate) - daysBetween(b.dueDate);
        if (leftDiff !== 0) return leftDiff;
      }
      return (a.dueDate || "").localeCompare(b.dueDate || "") || (a.title || "").localeCompare(b.title || "");
    });
    return copied;
  }

  function renderTasks() {
    var filter = ui.taskFilter;
    var filtered = state.tasks.filter(function (t) { return filter === "All" || t.category === filter; });
    var sorted = sortTasks(filtered, ui.taskSort);

    var html = renderSearchBar();
    html += '<div class="toolbar">' + '<h2 style="margin:0;font-size:18px">Tasks</h2>' +
      '<div class="toolbar-right">' +
      '<select class="input" style="width:150px" onchange="App.setTaskSort(this.value)">' +
      '<option value="daysLeft" ' + (ui.taskSort === "daysLeft" ? "selected" : "") + '>Sort: Days left</option>' +
      '<option value="status" ' + (ui.taskSort === "status" ? "selected" : "") + '>Sort: Status</option>' +
      '<option value="priority" ' + (ui.taskSort === "priority" ? "selected" : "") + '>Sort: Priority</option>' +
      '<option value="course" ' + (ui.taskSort === "course" ? "selected" : "") + '>Sort: Course</option>' +
      '</select>' +
      '<select class="input" style="width:130px" onchange="App.setTaskFilter(this.value)">' +
      ["All", "Class", "Event", "Personal"].map(function (f) { return '<option ' + (filter === f ? "selected" : "") + '>' + f + '</option>'; }).join("") +
      '</select>' +
      '<div class="view-switch">' +
      ["kanban", "table", "calendar", "cards"].map(function (v) {
        var labels = { kanban: "Kanban", table: "Table", calendar: "Calendar", cards: "Cards" };
        return '<button class="' + (ui.taskView === v ? "active" : "") + '" onclick="App.setTaskView(\'' + v + '\')">' + labels[v] + '</button>';
      }).join("") + '</div>' +
      '<button class="btn" onclick="App.openTaskModal()">' + icon("plus", 16) + ' Add</button>' +
      '</div></div>';

    if (ui.taskView === "kanban") {
      html += '<div class="grid grid-4">';
      STATUSES.forEach(function (col) {
        var items = sorted.filter(function (t) { return (t.status || "To Do") === col; });
        html += '<div class="kanban-col" data-status="' + col + '" ondragover="App.handleDragOver(event)" ondragleave="App.handleDragLeave(event)" ondrop="App.handleDrop(event)"><p class="kanban-col-title">' + col + '</p><div class="kanban-items">';
        if (items.length === 0) html += '<p class="kanban-empty">Empty</p>';
        else items.forEach(function (t) { html += taskCardHtml(t); });
        html += '</div></div>';
      });
      html += '</div>';
    } else if (ui.taskView === "table") {
      html += renderTaskTable(sorted);
    } else if (ui.taskView === "calendar") {
      html += renderTaskCalendar(sorted);
    } else {
      if (sorted.length === 0) html += '<p style="font-size:13px;color:var(--text-faint)">No tasks match this filter.</p>';
      else sorted.forEach(function (t) { html += taskCardHtml(t); });
    }

    return html;
  }

  function renderTaskTable(tasks) {
    var html = '<div class="card table-wrap" style="padding:0"><div class="table-scroll-min">' +
      '<table class="data-table"><thead><tr>' +
      '<th>Title</th><th>Category</th><th>Course / location</th><th>Type</th><th>Status</th><th>Priority</th><th>Due date</th><th>Time</th><th>Notes</th><th></th>' +
      '</tr></thead><tbody>';
    if (tasks.length === 0) {
      html += '<tr><td colspan="10" class="table-empty">No tasks match this filter.</td></tr>';
    } else {
      tasks.forEach(function (task) {
        var categories = getTaskCategories();
        var priorities = getTaskPriorities();
        var taskTypes = getTaskTypes();
        html += '<tr>' +
          '<td><input class="input" value="' + escapeHtml(task.title || "") + '" onchange="App.updateTaskField(\'' + task.id + '\',\'title\', this.value)"/></td>' +
          '<td><select class="input" onchange="App.updateTaskField(\'' + task.id + '\',\'category\', this.value)">' + categories.map(function (c) { return '<option ' + (task.category === c ? "selected" : "") + '>' + c + '</option>'; }).join("") + '</select></td>' +
          '<td><input class="input" value="' + escapeHtml(task.category === "Class" ? (task.courseName || "") : (task.location || "")) + '" onchange="App.updateTaskField(\'' + task.id + '\',\'' + (task.category === "Class" ? "courseName" : "location") + '\', this.value)"/></td>' +
          '<td><select class="input" onchange="App.updateTaskField(\'' + task.id + '\',\'taskType\', this.value)">' + taskTypes.map(function (t) { return '<option ' + (task.taskType === t ? "selected" : "") + '>' + t + '</option>'; }).join("") + '</select></td>' +
          '<td><select class="input" onchange="App.updateTaskField(\'' + task.id + '\',\'status\', this.value)">' + STATUSES.map(function (s) { return '<option ' + ((task.status || "To Do") === s ? "selected" : "") + '>' + s + '</option>'; }).join("") + '</select></td>' +
          '<td><select class="input" onchange="App.updateTaskField(\'' + task.id + '\',\'priority\', this.value)">' + priorities.map(function (p) { return '<option ' + (task.priority === p ? "selected" : "") + '>' + p + '</option>'; }).join("") + '</select></td>' +
          '<td><input class="input" type="date" value="' + (task.dueDate || "") + '" onchange="App.updateTaskField(\'' + task.id + '\',\'dueDate\', this.value)"/></td>' +
          '<td><input class="input" type="time" value="' + (task.dueTime || "") + '" onchange="App.updateTaskField(\'' + task.id + '\',\'dueTime\', this.value)"/></td>' +
          '<td><input class="input" value="' + escapeHtml(task.description || "") + '" onchange="App.updateTaskField(\'' + task.id + '\',\'description\', this.value)"/></td>' +
          '<td style="text-align:right"><button class="icon-trash" onclick="App.deleteTaskWithConfirmation(\'' + task.id + '\')">' + icon("trash", 14) + '</button></td>' +
          '</tr>';
      });
    }
    html += '</tbody></table></div></div>';
    return html;
  }

  function renderTaskCalendar(tasks) {
    var cur = ui.taskCalCursor;
    var firstDow = new Date(cur.y, cur.m, 1).getDay();
    var daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
    var now = new Date();

    function tasksForDay(d) {
      var key = dateKey(cur.y, cur.m, d);
      return tasks.filter(function (t) { return t.dueDate === key; }).sort(function (a, b) { return (a.dueTime || "").localeCompare(b.dueTime || ""); });
    }

    var cells = "";
    for (var i = 0; i < firstDow; i++) cells += '<div></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var isToday = now.getFullYear() === cur.y && now.getMonth() === cur.m && now.getDate() === d;
      var dayKey = dateKey(cur.y, cur.m, d);
      var dayTasks = tasksForDay(d);
      var pills = dayTasks.slice(0, 4).map(function (t) {
        var bgColor = getCategoryColor(t.category);
        var textColor = getContrastTextColor(bgColor);
        var done = t.status === "Completed";
        return '<button class="task-pill ' + (done ? "done" : "") + '" style="background:' + (done ? "" : bgColor) + '; color:' + (done ? "" : textColor) + '" title="Open task" onclick="App.openTaskModal(\'' + t.id + '\')">' + escapeHtml(t.title) + '<br/><span style="opacity:.8">' + (t.dueTime || "Any time") + '</span></button>';
      }).join("");
      var more = dayTasks.length > 4 ? '<p style="font-size:10px;color:var(--text-faint);margin:0">+' + (dayTasks.length - 4) + ' more</p>' : "";
      cells += '<div class="task-cal-day ' + (isToday ? "today" : "") + '" onclick="App.openDayDetail(\'' + dayKey + '\')" style="cursor:pointer"><p class="task-cal-num">' + d + '</p>' + pills + more + '</div>';
    }
    var dow = DAY_NAMES.map(function (d) { return '<div class="mini-cal-dow">' + d + '</div>'; }).join("");

    return '<div class="card">' +
      '<div class="cal-header"><h3 class="card-title" style="margin:0">Task calendar — ' + MONTH_NAMES[cur.m] + ' ' + cur.y + '</h3>' +
      '<div><button class="cal-nav-btn" onclick="App.taskCalNav(-1)">' + icon("chevLeft", 16) + '</button><button class="cal-nav-btn" onclick="App.taskCalNav(1)">' + icon("chevRight", 16) + '</button></div></div>' +
      '<div class="dow-row">' + dow + '</div>' +
      '<div class="cal-grid">' + cells + '</div></div>';
  }

  function renderMonthlyCalendar() {
    var cur = ui.genCalCursor;
    var firstDow = new Date(cur.y, cur.m, 1).getDay();
    var daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
    var now = new Date();

    function dayItems(d) {
      var key = dateKey(cur.y, cur.m, d);
      var dow = new Date(cur.y, cur.m, d).getDay();
      var items = [];
      if (state.settings.genCalShow.Class) {
        state.courses.forEach(function (c) {
          if ((c.schedules || []).some(function(s) { return s.days.indexOf(dow) !== -1; })) {
            items.push({
              type: "Class",
              label: (c.code || 'Course') + (c.professor ? ' (' + c.professor.split(' ').pop() + ')' : ''),
              color: c.color || COURSE_COLORS[0]
            });
          }
        });
      }
      state.tasks.forEach(function (t) {
        if (t.dueDate === key && state.settings.genCalShow[t.category]) {
          items.push({
            type: t.category,
            label: t.title,
            color: PRIORITY_HEX[t.priority] || CATEGORY_HEX[t.category] || '#64748b'
          });
        }
      });
      return items;
    }

    var cells = "";
    for (var i = 0; i < firstDow; i++) cells += '<div class="gen-cal-day empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var isToday = now.getFullYear() === cur.y && now.getMonth() === cur.m && now.getDate() === d;
      var dayKey = dateKey(cur.y, cur.m, d);
      var items = dayItems(d);
      var itemsHtml = items.slice(0, 3).map(function (it) { // Ensure text color is white for better contrast
        return '<div class="gen-item" style="background:' + it.color + '; color:' + getContrastTextColor(it.color) + '">' + escapeHtml(it.label) + '</div>';
      }).join("");
      var more = items.length > 3 ? '<p style="font-size:9px;color:var(--text-faint);margin:0">+' + (items.length - 3) + ' more</p>' : "";
      cells += '<div class="gen-cal-day ' + (isToday ? "today" : "") + '" onclick="App.openDayDetail(\'' + dayKey + '\')" style="cursor:pointer"><p class="gen-cal-num" style="' + (isToday ? "color:var(--primary-color-dark)" : "") + '">' + d + '</p>' + itemsHtml + more + '</div>';
    }
    var dow = DAY_NAMES.map(function (d) { return '<div class="mini-cal-dow">' + d + '</div>'; }).join("");
    return '<div class="dow-row">' + dow + '</div><div class="cal-grid">' + cells + '</div>';
  }

  function renderMiniMonth(year, month) {
    var dots = getMonthDots(year, month);
    var firstDow = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = new Date();

    var cells = "";
    for (var i = 0; i < firstDow; i++) cells += '<div></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
      var dayKey = dateKey(year, month, d);

      // Tooltip logic from renderMiniCalendar
      var dowForDay = new Date(year, month, d).getDay();
      var daySchedule = [];
      state.courses.forEach(function(c) {
        (c.schedules || []).forEach(function(s) {
          if (s.days.indexOf(dowForDay) !== -1) {
            daySchedule.push(c.name + " " + fmtTime12(s.startTime) + "-" + fmtTime12(s.endTime));
          }
        });
      });
      var taskSchedule = state.tasks.filter(function (t) { return t.dueDate === dayKey; }).map(function (t) {
          return (t.category || "Personal") + ": " + (t.title || "Task") + " " + (t.dueTime ? fmtTime12(t.dueTime) : "Any time");
      });
      var combinedSchedule = daySchedule.concat(taskSchedule);
      var tooltip = combinedSchedule.length ? combinedSchedule.join("\n") : "No classes or tasks";
      
      var timelineCats = [];
      if (dots[d]) timelineCats = timelineCats.concat(dots[d]);
      state.tasks.filter(function (t) { return t.dueDate === dayKey; }).forEach(function (t) {
        var cat = t.category || "Personal";
        if (timelineCats.indexOf(cat) === -1) timelineCats.push(cat);
      });

      var dotHtml = "";
      if (timelineCats.length) {
        dotHtml = '<span class="mini-cal-dots">' + timelineCats.slice(0, 2).map(function (cat) {
          return '<span style="background:' + getCategoryColor(cat) + '"></span>'; // Background for dots is handled by CSS for .today
        }).join("") + '</span>';
      } 
      cells += '<div class="mini-cal-day ' + (isToday ? "today" : "") + '" data-tooltip="' + escapeHtml(tooltip) + '" title="' + escapeHtml(tooltip) + '">' + d + dotHtml + '</div>';
    }

    var dow = DAY_NAMES.map(function (d) { return '<div class="mini-cal-dow">' + d.slice(0,2) + '</div>'; }).join("");

    return '<div class="mini-month-wrap" onclick="App.setGeneralCalendarView(\'month\', ' + year + ', ' + month + ')">' +
      '<h4 class="mini-month-title">' + MONTH_NAMES[month] + '</h4>' +
      '<div class="mini-cal-grid">' + dow + cells + '</div>' +
      '</div>';
  }

  function renderYearlyCalendar(year) {
    var html = '<div class="year-month-grid">';
    for (var m = 0; m < 12; m++) {
      html += renderMiniMonth(year, m);
    }
    html += '</div>';
    return html;
  }
  function renderWeeklyCalendar(date) {
    var startOfWeek = new Date(date);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(date.getDate() - date.getDay());
    var days = Array.from({ length: 7 }).map(function (_, i) {
      var d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
    var weekKeys = days.map(function (d) { return dateKey(d.getFullYear(), d.getMonth(), d.getDate()); });
    var byDay = Array.from({ length: 7 }, function () { return []; });

    state.courses.forEach(function(course) {
        (course.schedules || []).forEach(function(schedule) {
            schedule.days.forEach(function(dayIndex) {
                // Find the date object for this day of the week
                var dayDate = days.find(function(d) { return d.getDay() === dayIndex; });
                if (dayDate) byDay[dayIndex].push({ course: course, schedule: schedule });
            });
        });
    });
    state.tasks.filter(function (t) { return weekKeys.indexOf(t.dueDate) !== -1; }).forEach(function (task) {
      var taskDate = new Date(task.dueDate + 'T00:00:00');
      byDay[taskDate.getDay()].push(task);
    });
    var allDayRow = '<tr><td class="schedule-time">All-day</td>';
    for (var day = 0; day < 7; day++) {
      var allDayItems = byDay[day].filter(function (item) { return !item.startTime && (!item.dueTime || item.dueTime === "00:00"); });
      var cellHtml = allDayItems.map(function (task) {
        var color = getCategoryColor(task.category);
        return '<div class="schedule-chip" style="min-height:auto;padding:4px 6px;background:' + hexToRgba(color, 0.12) + '; border-left: 3px solid ' + color + '; color:' + color + ';" onclick="App.openTaskModal(\'' + task.id + '\')" title="' + escapeHtml(task.title) + '"><strong>' + escapeHtml(task.title) + '</strong></div>';
      }).join("");
      allDayRow += '<td class="schedule-cell">' + cellHtml + '</td>';
    }
    allDayRow += '</tr>';
    var hourRows = TIME_SLOTS.filter(function(slot) { return slot.endsWith(':00'); }).map(function (slot) {
      var hour = parseInt(slot.slice(0, 2));
      var row = '<tr><td class="schedule-time">' + fmtTime12(slot) + '</td>';
      for (var day = 0; day < 7; day++) {
        var matches = byDay[day].filter(function (item) {
          var itemTime = (item.schedule && item.schedule.startTime) || item.dueTime;
          if (!itemTime || itemTime === "00:00") return false;
          // Ensure itemTime is a string before passing to minutesOf to prevent errors
          var startTimeStr = typeof itemTime === 'string' ? itemTime : '00:00';
          var start = minutesOf(startTimeStr);
          var end = (item.schedule && item.schedule.endTime) ? minutesOf(item.schedule.endTime) : start + 60;
          return start < hour * 60 + 60 && end > hour * 60;
        });
        var cellHtml = matches.map(function (item) {
          var color, onclick, title, code, name, start, end;
          if (item.course && item.schedule) { // It's a course
            var course = item.course;
            var schedule = item.schedule;
            color = COURSE_COLORS[item.color % COURSE_COLORS.length];
            // Fix: item.color is a hex string, not an index. Use it directly and validate.
            var courseColor = (course.color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(course.color)) ? course.color : COURSE_COLORS[0];
            onclick = "App.openCourseModal('" + course.id + "')";
            var professor = escapeHtml(course.professor || '');
            title = escapeHtml(course.name) + (professor ? ' | ' + professor : ''); code = escapeHtml(course.code); name = escapeHtml(course.name); start = fmtTime12(schedule.startTime); end = fmtTime12(schedule.endTime);
            return '<div class="schedule-chip" style="background:' + hexToRgba(courseColor, 0.12) + '; border-left: 3px solid ' + courseColor + '; color:' + courseColor + ';" onclick="' + onclick + '" title="' + title + '"><strong>' + code + '</strong><span>' + name + '</span>' + (professor ? '<small style="opacity:0.8;font-weight:500;">' + professor + '</small>' : '') + '<small>' + start + '-' + end + '</small></div>';
          } else {
            color = getCategoryColor(item.category);
            onclick = "App.openTaskModal('" + item.id + "')";
            title = escapeHtml(item.title); name = escapeHtml(item.title); start = fmtTime12(item.dueTime);
            return '<div class="schedule-chip" style="min-height:auto;padding:4px 6px;background:' + hexToRgba(color, 0.12) + '; border-left: 3px solid ' + color + '; color:' + color + ';" onclick="' + onclick + '" title="' + title + '"><strong>' + name + '</strong><small>' + start + '</small></div>';
          }
        }).join("");
        row += '<td class="schedule-cell">' + cellHtml + '</td>';
      }
      row += '</tr>';
      return row;
    }).join("");
    var weekHeader = days.map(function (d) {
      var today = new Date();
      var isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      return '<th class="' + (isToday ? 'today' : '') + '">' + DAY_NAMES[d.getDay()] + ' <span class="day-num">' + d.getDate() + '</span></th>';
    }).join("");
    return '<div class="schedule-table-card" style="padding:0;overflow:auto"><table class="schedule-table"><thead><tr><th>Time</th>' + weekHeader + '</tr></thead><tbody>' + allDayRow + hourRows + '</tbody></table></div>';
  }
  function renderDailyCalendar(date) {
    var dateKey = date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
    return renderDayDetailList(dateKey);
  }

  /* ---------------- General Calendar ---------------- */
  function renderGeneralCalendar() {
    var cur = ui.genCalCursor;
    var toggles = ["Class", "Event", "Personal"].map(function (cat) {
      var color = getCategoryColor(cat); // This uses state.settings.accentColor for 'Class'
      return '<button class="cal-toggle ' + (state.settings.genCalShow[cat] ? "active" : "") + '" onclick="App.toggleGenCalShow(\'' + cat + '\')"><span style="background:' + color + '; border-color:' + getContrastTextColor(color) + '"></span>' + cat + '</button>';
    }).join("");

    var viewOptions = { year: "Year", month: "Month", week: "Week", day: "Day" };
    var viewSwitcher = '<div class="view-switch">' + Object.keys(viewOptions).map(function(v) {
        return '<button class="' + (ui.generalCalendarView === v ? "active" : "") + '" onclick="App.setGeneralCalendarView(\'' + v + '\')">' + viewOptions[v] + '</button>';
    }).join("") + '</div>';

    var headerTitle = "";
    var calendarBody = "";
    var currentDate = new Date(cur.y, cur.m, cur.d);

    switch (ui.generalCalendarView) {
      case 'year':
        headerTitle = cur.y;
        calendarBody = renderYearlyCalendar(cur.y);
        break;
      case 'week':
        var startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        var endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        headerTitle = 'Week of ' + MONTH_NAMES[startOfWeek.getMonth()] + ' ' + startOfWeek.getDate();
        if (startOfWeek.getMonth() !== endOfWeek.getMonth()) {
          headerTitle += ' - ' + MONTH_NAMES[endOfWeek.getMonth()] + ' ' + endOfWeek.getDate();
        }
        calendarBody = renderWeeklyCalendar(currentDate);
        break;
      case 'day':
        headerTitle = DAY_LABELS[currentDate.getDay()] + ', ' + MONTH_NAMES[cur.m] + ' ' + cur.d;
        calendarBody = renderDailyCalendar(currentDate);
        break;
      default:
        headerTitle = MONTH_NAMES[cur.m] + ' ' + cur.y; calendarBody = renderMonthlyCalendar(); break;
    }
    return '<div class="toolbar"><h2 style="margin:0;font-size:18px">General calendar</h2><div class="toolbar-right" style="gap:16px">' + viewSwitcher + '<div style="display:flex;gap:8px">' + toggles + '</div></div></div>' +
      '<div class="card">' +
      '<div class="cal-header"><h3 class="card-title" style="margin:0">' + headerTitle + '</h3>' +
      '<div><button class="cal-nav-btn" onclick="App.genCalNav(-1)">' + icon("chevLeft", 16) + '</button><button class="cal-nav-btn" onclick="App.genCalNav(1)">' + icon("chevRight", 16) + '</button></div></div>' +
      calendarBody + '</div>';
  }

  /* ---------------- FAB ---------------- */
  function renderFab() {
    var actions = [
      { id: "expense", label: "Log expense", ic: "wallet" },
      { id: "task", label: "Add task", ic: "listChecks" },
      { id: "course", label: "Add class", ic: "calendar" },
      { id: "today", label: "Today's schedule", ic: "clock" }
    ];
    var html = '<div class="fab-wrap">';
    if (ui.fabOpen) {
      html += '<div class="fab-actions">' + actions.map(function (a) {
        return '<button class="fab-action" onclick="App.fabAction(\'' + a.id + '\')"><span class="fi">' + icon(a.ic, 13) + '</span>' + a.label + '</button>';
      }).join("") + '</div>';
    }
    html += '<button class="fab-btn ' + (ui.fabOpen ? "open" : "") + '" onclick="App.toggleFab()">' + icon("plus", 26) + '</button>';
    html += '</div>';
    return html;
  }

  /* ---------------- Modals & Forms ---------------- */
  function renderModal() {
    var m = ui.modal;
    var title = "", body = "", wide = false;
    if (m.type === "course") { title = m.payload ? "Edit course" : "Add course"; body = renderCourseForm(); }
    else if (m.type === "transaction") { title = "Add transaction"; body = renderTransactionForm(); }
    else if (m.type === "task") { title = "Add item"; body = renderTaskForm(); }
    else if (m.type === "day-detail") { title = "Schedule for " + m.payload.label; body = renderDayDetailModal(m.payload.dateKey); }
    else if (m.type === "confirmation") { title = "Confirm Action"; body = renderConfirmationModal(); }

    return '<div class="modal-overlay" onclick="App.overlayClose(event)">' +
      '<div class="modal ' + (wide ? "wide" : "") + '" onclick="event.stopPropagation()">' +
      '<div class="modal-header"><h3>' + title + '</h3><button class="icon-btn" onclick="App.closeModal()">' + icon("x", 18) + '</button></div>' +
      '<div class="modal-body">' + body + '</div>' +
      '</div></div>';
  }

  function renderModalContent() {
    var modalBody = document.querySelector(".modal-body");
    if (!modalBody || !ui.modal) return;

    var body = "";
    switch (ui.modal.type) {
      case "course": body = renderCourseForm(); break;
      case "transaction": body = renderTransactionForm(); break;
      case "task": body = renderTaskForm(); break;
      case "day-detail": body = renderDayDetailModal(ui.modal.payload.dateKey); break;
      case "confirmation": body = renderConfirmationModal(); break;
    }
    modalBody.innerHTML = body;
  }

  function renderDayDetailList(dateKey) {
    var d = new Date(dateKey + "T00:00:00"), dow = d.getDay(), items = [];
    state.courses.forEach(function (course) {
        (course.schedules || []).forEach(function(schedule) {
            if (schedule.days.indexOf(dow) !== -1) {
                items.push({
                    kind: "course",
                    id: course.id,
                    title: course.name,
                    label: (course.code || 'N/A') + " • " + (course.professor || 'N/A'),
                    time: fmtTime12(schedule.startTime) + " - " + fmtTime12(schedule.endTime),
                    meta: schedule.modality + " • " + (schedule.modality === "Online" ? schedule.room : schedule.room || "Room TBD"),
                    color: course.color || COURSE_COLORS[0],
                    sortMinutes: minutesOf(schedule.startTime)
                });
            }
        });
    });
    state.tasks.filter(function (t) { return t.dueDate === dateKey; }).forEach(function (t) {
      items.push({
        kind: "task",
        id: t.id,
        title: t.title,
        label: (t.category || "Task") + " • " + (t.taskType || "Task"),
        time: t.dueTime ? fmtTime12(t.dueTime) : "Any time",
        meta: (t.courseName || t.location || "No location") + (t.priority ? " • " + t.priority : ""),
        color: PRIORITY_HEX[t.priority] || "#64748b",
        sortMinutes: t.dueTime ? minutesOf(t.dueTime) : 24 * 60
      });
    });
    items.sort(function (a, b) { return a.sortMinutes - b.sortMinutes; });
    if (!items.length) { return '<div class="day-detail-empty"><p class="empty-note" style="padding:0;margin:0">No items scheduled for this day.</p></div>'; }
    return '<div class="day-detail-list">' + items.map(function (item) {
      return '<div class="day-detail-item" style="border-left-color:' + escapeHtml(item.color) + ';background:' + hexToRgba(item.color, 0.08) + '">' +
        '<div class="day-detail-time">' + escapeHtml(item.time) + '</div>' +
        '<div class="day-detail-body">' + // Text content is now grouped here
        '<p class="day-detail-title">' + escapeHtml(item.title) + '</p>' +
        '<p class="day-detail-label">' + escapeHtml(item.label) + '</p>' +
        '<p class="day-detail-meta">' + escapeHtml(item.meta) + '</p>' +
        '</div>' +
        '<div class="day-detail-actions">' + // Button is now in its own container
        '<button class="btn btn-sm" onclick="App.' + (item.kind === "course" ? "openCourseModal('" + item.id + "')" : "openTaskModal('" + item.id + "')") + '">Edit</button>' +
        '</div></div>';
    }).join("") + '</div>';
  }
  function renderDayDetailModal(dateKey) {
    return renderDayDetailList(dateKey) + '<div class="modal-actions"><button class="btn" onclick="App.openTaskModal()">Add task</button><button class="btn-ghost" onclick="App.openCourseModal()">Add course</button></div>';
  }

  function renderConfirmationModal() {
    var message = ui.modal.payload.message || "Are you sure you want to proceed?";
    return '<div class="confirmation-modal-body">' +
        '<div class="confirmation-icon">' + icon("alert", 48) + '</div>' +
        '<p class="confirmation-message">' + escapeHtml(message) + '</p>' +
        '<div class="modal-actions" style="justify-content: center;">' +
            '<button type="button" class="btn-ghost" onclick="App.closeModal()">Cancel</button>' +
            '<button type="button" class="btn" style="background: var(--rose);" onclick="App.executeConfirmation()">Confirm</button>' +
        '</div>' +
    '</div>';
  }


  function renderCourseForm() {
    var d = ui.formDraft;

    // Determine the current color for the custom color picker button
    var currentColorForPicker = escapeHtml(d.color);
    var contrastColorForPicker = getContrastTextColor(d.color);
    var colorDotsHtml = COURSE_COLORS.map(function (c) {
      return '<button type="button" class="color-dot course-modal-color-dot ' + (d.color === c ? "active" : "") + '" style="background:' + c + ';" data-color="' + c + '" onclick="App.setCourseColor(\'' + c + '\')"></button>';
    }).join("");

    var schedulesHtml = (d.schedules || []).map(function(schedule, index) {
        var dayChips = DAY_NAMES.map(function (name, i) {
          return '<button type="button" class="chip ' + (schedule.days.indexOf(i) !== -1 ? "active" : "") + '" onclick="App.toggleScheduleDay(' + index + ', ' + i + ')">' + name + '</button>';
        }).join("");

        return '<div class="schedule-block">' +
            (d.schedules.length > 1 ? '<button type="button" class="btn-remove-schedule" onclick="App.removeCourseSchedule(' + index + ')">' + icon("trash", 14) + ' Remove Schedule</button>' : '') +
            '<div class="field"><span class="field-label">Days of the week</span><div class="chip-row">' + dayChips + '</div></div>' +
            '<div class="row-2">' +
            '<label class="field"><span class="field-label">Start time</span><input class="input" type="time" required value="' + schedule.startTime + '" oninput="App.updateScheduleDraft(' + index + ', \'startTime\', this.value)"/></label>' +
            '<label class="field"><span class="field-label">End time</span><input class="input" type="time" required value="' + schedule.endTime + '" oninput="App.updateScheduleDraft(' + index + ', \'endTime\', this.value)"/></label>' +
            '</div>' +
            '<div class="row-2">' +
            '<label class="field"><span class="field-label">Modality</span><select class="input" onchange="App.updateScheduleDraft(' + index + ', \'modality\', this.value, true)">' + MODALITIES.map(function (m) { return '<option value="' + m + '" ' + (schedule.modality === m ? "selected" : "") + '>' + m + '</option>'; }).join("") + '</select></label>' +
            '<label class="field"><span class="field-label">' + (schedule.modality === "Online" ? "Meeting link" : "Room number") + '</span><input class="input" value="' + escapeHtml(schedule.room) + '" oninput="App.updateScheduleDraft(' + index + ', \'room\', this.value)" placeholder="' + (schedule.modality === "Online" ? "meet.school.edu/..." : "Rm 214") + '"/></label>' +
            '</div>' +
        '</div>';
    }).join("");

    return '<form onsubmit="return App.submitCourseForm(event)" autocomplete="off">' +
      '<div class="row-2">' +
      '<label class="field"><span class="field-label">Course name</span><input class="input" required value="' + escapeHtml(d.name) + '" oninput="App.updateDraft(\'name\', this.value)" placeholder="Data Structures"/></label>' +
      '<label class="field"><span class="field-label">Course code</span><input class="input" required value="' + escapeHtml(d.code) + '" oninput="App.updateDraft(\'code\', this.value)" placeholder="CS 202"/></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">Professor</span><input class="input" value="' + escapeHtml(d.professor) + '" oninput="App.updateDraft(\'professor\', this.value)" placeholder="Dr. Smith"/></label>' +

      '<div class="schedules-container">' +
        '<p class="section-label" style="margin-top:16px; margin-bottom: 4px;">Schedules</p>' +
        schedulesHtml +
      '</div>' +
      '<button type="button" class="btn-add-schedule" onclick="App.addCourseSchedule()">' + icon("plus", 16) + ' Add another schedule</button>' +

      '<div class="row-2">' +
      '<label class="field"><span class="field-label">Start date</span><input class="input" type="date" value="' + d.startDate + '" oninput="App.updateDraft(\'startDate\', this.value)"/></label>' +
      '<label class="field"><span class="field-label">End date (optional)</span><input class="input" type="date" value="' + d.endDate + '" oninput="App.updateDraft(\'endDate\', this.value)"/></label>' +
      '</div>' +
      '<div class="field"><span class="field-label">Color</span><div class="chip-row" style="align-items:center;gap:12px;">' + colorDotsHtml +
        '<div class="custom-color-picker-wrap">' +
          '<button type="button" id="course-modal-color-picker-btn" class="custom-color-picker-btn" style="background-color:' + currentColorForPicker + '; color:' + contrastColorForPicker + ';" onclick="document.getElementById(\'course-color-input\').click()">' +
            icon("dropper", 18, "custom-color-picker-icon") +
          '</button>' +
          '<input type="color" id="course-color-input" class="custom-color-picker-input" value="' + currentColorForPicker + '" oninput="App.setCourseColor(this.value)" onchange="App.setCourseColor(this.value)" />' +
        '</div>' +
      '</div></div>' +

      '<div class="modal-actions" style="margin-top: 20px;">' +
      (ui.modal.payload ? '<button type="button" class="btn" style="margin-right: auto; background: var(--rose);" onclick="App.deleteCourseWithConfirmation(\'' + ui.modal.payload.id + '\')">' + icon("trash", 14) + ' Delete</button>' : '') +
      '<button type="button" class="btn-ghost" onclick="App.closeModal()">Cancel</button><button type="submit" class="btn">Save course</button></div>' +
      '</form>';
  }

  function renderTransactionForm() {
    var d = ui.formDraft;
    return '<form onsubmit="return App.submitTransactionForm(event)">' +
      '<div class="row-2">' +
      '<label class="field"><span class="field-label">Date</span><input class="input" type="date" value="' + d.date + '" oninput="App.updateDraft(\'date\', this.value)"/></label>' +
      '<label class="field"><span class="field-label">Type</span><select class="input" onchange="App.updateDraft(\'type\', this.value)"><option ' + (d.type === "Expense" ? "selected" : "") + '>Expense</option><option ' + (d.type === "Income" ? "selected" : "") + '>Income</option></select></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">Item name</span><input class="input" required value="' + escapeHtml(d.item) + '" oninput="App.updateDraft(\'item\', this.value)" placeholder="Lunch"/></label>' +
      '<div class="row-2">' +
      '<label class="field"><span class="field-label">Category</span><select class="input" onchange="App.updateDraft(\'category\', this.value)">' + getBudgetCategories().map(function (c) { return '<option ' + (d.category === c ? "selected" : "") + '>' + c + '</option>'; }).join("") + '</select></label>' +
      '<label class="field"><span class="field-label">Amount (₱)</span><input class="input" type="number" step="0.01" min="0" required value="' + d.amount + '" oninput="App.updateDraft(\'amount\', this.value)" placeholder="0.00"/></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">Payment method</span><select class="input" onchange="App.updateDraft(\'method\', this.value)">' + getPaymentMethods().map(function (m) { return '<option ' + (d.method === m ? "selected" : "") + '>' + m + '</option>'; }).join("") + '</select></label>' +
      '<div class="modal-actions"><button type="button" class="btn-ghost" onclick="App.closeModal()">Cancel</button><button type="submit" class="btn">Save transaction</button></div>' +
      '</form>';
  }

  function renderTaskForm() {
    var d = ui.formDraft;
    var categories = getTaskCategories();
    var priorities = getTaskPriorities();
    var taskTypes = getTaskTypes();
    var chips = categories.map(function (c) {
      return '<button type="button" class="chip ' + (d.category === c ? "active" : "") + '" onclick="App.setTaskFormCategory(\'' + c + '\')">' + c + '</button>';
    }).join("");

    var extra = "";
    if (d.category === "Class") {
      extra += '<label class="field"><span class="field-label">Course</span><select class="input" onchange="App.updateDraft(\'courseName\', this.value)">' +
        (state.courses.length === 0 ? '<option value="">No courses yet</option>' : state.courses.map(function (c) { return '<option ' + (d.courseName === c.name ? "selected" : "") + '>' + escapeHtml(c.name) + '</option>'; }).join("")) +
        '</select></label>';
      extra += '<div class="row-2">' +
        '<label class="field"><span class="field-label">Task type</span><select class="input" onchange="App.updateDraft(\'taskType\', this.value)">' + taskTypes.map(function (t) { return '<option ' + (d.taskType === t ? "selected" : "") + '>' + t + '</option>'; }).join("") + '</select></label>' +
        '<label class="field"><span class="field-label">Task code</span><input class="input" value="' + escapeHtml(d.taskCode) + '" oninput="App.updateDraft(\'taskCode\', this.value)" placeholder="CS202-PS4"/></label>' +
        '</div>';
      extra += '<label class="field"><span class="field-label">Status</span><select class="input" onchange="App.updateDraft(\'status\', this.value)">' + STATUSES.map(function (s) { return '<option ' + (d.status === s ? "selected" : "") + '>' + s + '</option>'; }).join("") + '</select></label>';
    } else {
      extra += '<label class="field"><span class="field-label">Location / platform</span><input class="input" value="' + escapeHtml(d.location) + '" oninput="App.updateDraft(\'location\', this.value)" placeholder="Library, Zoom, etc."/></label>';
    }

    // New recurrence options for tasks
    var repeatOptions = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
    var recurrenceRadios = repeatOptions.map(function(type) {
        return '<label class="radio-label-pill">' +
            '<input type="radio" name="taskRecurrence" value="' + type + '" onchange="App.setTaskRecurrence(\'' + type + '\')" ' + (d.taskRepeatType === type ? 'checked' : '') + '>' +
            '<span>' + type.charAt(0).toUpperCase() + type.slice(1) + '</span>' +
        '</label>';
    }).join('');

    var repeatUntilField = '';
    if (d.taskRepeatType !== 'none') {
      repeatUntilField = '<label class="field"><span class="field-label">Repeat until</span><input class="input" type="date" value="' + d.taskRepeatUntilDate + '" oninput="App.updateDraft(\'taskRepeatUntilDate\', this.value)"/></label>';
    }
    if (d.taskRepeatType === 'monthly' || d.taskRepeatType === 'yearly') {
      // Add a note about simple recurrence for monthly/yearly
    }

    return '<form onsubmit="return App.submitTaskForm(event)" autocomplete="off">' +
      '<div class="field"><span class="field-label">Category</span><div class="chip-row">' + chips + '</div></div>' +
      '<label class="field"><span class="field-label">' + (d.category === "Class" ? "Task title" : "Title") + '</span><input class="input" required value="' + escapeHtml(d.title) + '" oninput="App.updateDraft(\'title\', this.value)" placeholder="' + (d.category === "Class" ? "Problem Set 4" : "Study group meetup") + '"/></label>' +
      extra +
      '<div class="row-2">' +
      '<label class="field"><span class="field-label">Due date</span><input class="input" type="date" required value="' + d.dueDate + '" oninput="App.updateDraft(\'dueDate\', this.value)"/></label>' +
      '<label class="field"><span class="field-label">Due time</span><input class="input" type="time" value="' + d.dueTime + '" oninput="App.updateDraft(\'dueTime\', this.value)"/></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">Priority</span><select class="input" onchange="App.updateDraft(\'priority\', this.value)">' + priorities.map(function (p) { return '<option ' + (d.priority === p ? "selected" : "") + '>' + p + '</option>'; }).join("") + '</select></label>' +
      '<label class="field"><span class="field-label">Description</span><textarea class="input" rows="2" oninput="App.updateDraft(\'description\', this.value)">' + escapeHtml(d.description) + '</textarea></label>' + // Corrected textarea closing
      '<div class="field"><span class="field-label">Repeat</span><div class="radio-group-pills">' + recurrenceRadios + '</div></div>' +
      repeatUntilField +
      (d.taskRepeatType === 'monthly' || d.taskRepeatType === 'yearly' ? '<p class="empty-note" style="padding:0;margin-top:-10px;margin-bottom:10px;font-size:11px;">Monthly/yearly repeats will occur on the same day of the month/year as the due date.</p>' : '') +
      '<div class="modal-actions">' +
      (ui.modal.payload ? '<button type="button" class="btn" style="margin-right: auto; background: var(--rose);" onclick="App.deleteTaskWithConfirmation(\'' + ui.modal.payload.id + '\')">' + icon("trash", 14) + ' Delete</button>' : '') +
      '<button type="button" class="btn-ghost" onclick="App.closeModal()">Cancel</button><button type="submit" class="btn">Save item</button></div></form>';
   }

  /* ---------------- Public App API (bound to window.App) ---------------- */
  var App = {
    handleSearch: function (query) {
      // Find the input element and store its state before re-rendering
      var searchInput = document.querySelector('.global-search-input');
      var cursorPos = searchInput ? searchInput.selectionStart : 0;

      ui.searchQuery = query;
      renderMainContent();

      // After re-rendering, find the new input and restore its state.
      // Use a timeout to ensure the DOM has been updated by the browser.
      setTimeout(function() {
        var newSearchInput = document.querySelector('.global-search-input');
        if (newSearchInput) {
          newSearchInput.focus();
          newSearchInput.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    },
    previewAccentColor: function(color) {
      state.settings.accentColor = color;
      applySettingsToDom();
      // Note: This doesn't update the active state on swatches during drag for performance.
    },
    // New UI Customization functions
    setAccentColor: function (color) {
      state.settings.accentColor = color;
      commit().then(function() {
        showToast("Accent color updated.", "success");
        applySettingsToDom(); // Apply immediately
      });
    },
    setLayoutDensity: function (density) {
      state.settings.layoutDensity = density;
      commit().then(function() {
        showToast("Layout density updated.", "success");
        applySettingsToDom(); // Apply immediately
      });
    },
    setSidebarBehavior: function (behavior) {
      if (behavior === 'alwaysOpen') {
        state.settings.showSidebar = true;
        state.settings.sidebarExpandOnHover = false;
      } else if (behavior === 'expandOnHover') {
        state.settings.showSidebar = false; // Start closed
        state.settings.sidebarExpandOnHover = true;
      } else if (behavior === 'alwaysClosed') {
        state.settings.showSidebar = false;
        state.settings.sidebarExpandOnHover = false;
      }
      commit().then(function() {
        showToast("Sidebar behavior updated.", "success");
        applySettingsToDom(); // Apply immediately
      });
    },
    setAccessibilityMode: function (mode) {
      state.settings.accessibilityMode = mode;
      commit().then(function() {
        showToast("Accessibility mode updated.", "success");
        applySettingsToDom(); // Apply immediately
      });
    },
    setDefaultLandingTab: function (tab) {
      state.settings.defaultLandingTab = tab;
      commit().then(function() {
        showToast("Default landing tab updated.", "success");
      });
    },
    // Re-use toggleSetting for dashboard widgets and other boolean settings
    toggleSetting: function (key) {
      if (state.settings[key] !== undefined) {
        state.settings[key] = !state.settings[key];
        commit().then(function() {
          showToast("Setting updated.", "success");
          applySettingsToDom(); // Apply immediately for relevant settings
        });
      }
    },

    // Sidebar functions (modified to respect settings)
    openSidebarOnHover: function() {
      if (window.innerWidth <= 768) return;
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.remove('closed');
    },
    closeSidebarOnHover: function() {
      if (window.innerWidth <= 768) return;
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.add('closed');
    },
    setTab: function (id) { ui.tab = id; render(); },
    toggleTheme: function () {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      commit();
    },

    miniCalNav: function (dir) {
      var c = ui.miniCalCursor;
      var m = c.m + dir, y = c.y;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      ui.miniCalCursor = { y: y, m: m };
      render();
    },
    genCalNav: function (dir) {
      var c = ui.genCalCursor, date = new Date(c.y, c.m, c.d);
      switch (ui.generalCalendarView) {
        case 'year': date.setFullYear(date.getFullYear() + dir); break;
        case 'week': date.setDate(date.getDate() + (dir * 7)); break;
        case 'day': date.setDate(date.getDate() + dir); break;
        default: date.setMonth(date.getMonth() + dir); break;
      }
      ui.genCalCursor = { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
      render();
    },
    taskCalNav: function (dir) {
      var c = ui.taskCalCursor;
      var m = c.m + dir, y = c.y;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      ui.taskCalCursor = { y: y, m: m };
      render();
    },
    toggleGenCalShow: function (cat) {
      state.settings.genCalShow[cat] = !state.settings.genCalShow[cat];
      // This is a setting, so it should be persisted
      commit();
    },
    setGeneralCalendarView: function (view, year, month) { // Added year and month parameters
      ui.generalCalendarView = view;
      if (year !== undefined && month !== undefined) {
        ui.genCalCursor = { y: year, m: month, d: 1 };
      }
      render();
    },

    setScheduleView: function (v) { ui.scheduleView = v; render(); },

    /* Courses */
    openCourseModal: function (id) {
      var course = id ? state.courses.find(function (c) { return c.id === id; }) : null;
      var draft;
      if (course) {
          draft = JSON.parse(JSON.stringify(course)); // Deep copy to avoid modifying state directly
          // Backward compatibility: if editing an old course without 'schedules' array
          if (!draft.schedules || !Array.isArray(draft.schedules) || draft.schedules.length === 0) {
              draft.schedules = [{
                  days: draft.days || [],
                  startTime: draft.startTime || "09:00",
                  endTime: draft.endTime || "10:00",
                  modality: draft.modality || "On-Site",
                  room: draft.room || ""
              }];
          }
      } else {
          draft = {
              name: "", code: "", professor: "",
              schedules: [{ days: [], startTime: "09:00", endTime: "10:00", modality: "On-Site", room: "" }],
              startDate: todayStr(),
              endDate: "",
              color: COURSE_COLORS[0]
          };
      }
      ui.formDraft = draft;
      ui.modal = { type: "course", payload: course || null };
      render();
    },
    addCourseSchedule: function() {
        ui.formDraft.schedules.push({ days: [], startTime: "09:00", endTime: "10:00", modality: "On-Site", room: "" });
        renderModalContent();
    },
    removeCourseSchedule: function(index) {
        if (ui.formDraft.schedules.length > 1) {
            ui.formDraft.schedules.splice(index, 1);
            renderModalContent();
        } else {
            showToast("A course must have at least one schedule.", "error");
        }
    },
    updateScheduleDraft: function(index, field, value, rerender) {
        if (ui.formDraft.schedules[index]) {
            ui.formDraft.schedules[index][field] = value;
        }
        if (rerender) renderModalContent();
      },
    toggleScheduleDay: function (scheduleIndex, i) {
      var days = ui.formDraft.schedules[scheduleIndex].days.slice();
      var idx = days.indexOf(i);
      if (idx === -1) days.push(i); else days.splice(idx, 1);
      days.sort();
      ui.formDraft.schedules[scheduleIndex].days = days;
      renderModalContent();
    },
    setCourseColor: function (color) {
      ui.formDraft.color = color;
      var customPickerBtn = document.getElementById('course-modal-color-picker-btn');
      if (customPickerBtn) {
        customPickerBtn.style.backgroundColor = color;
        customPickerBtn.style.color = getContrastTextColor(color);
      }

      // Update the hidden input's value (important if the button was clicked, not the input directly)
      var customPickerInput = document.getElementById('course-color-input');
      if (customPickerInput) {
        customPickerInput.value = color;
      }

      // Update the active state of the predefined color dots
      var colorDots = document.querySelectorAll('.course-modal-color-dot');
      colorDots.forEach(function(dot) {
        if (dot.dataset.color === color) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    },
    submitCourseForm: function (e) {
      e.preventDefault();
      var d = ui.formDraft;
      if (!d.name || !d.code) {
          showToast("Please provide a course name and code.", "error");
          return false;
      }
      var hasAtLeastOneDay = d.schedules.some(function(s) { return s.days && s.days.length > 0; });
      if (!hasAtLeastOneDay) {
          showToast("Each course must have at least one schedule with a day selected.", "error");
          return false;
      }
  
      // Clean up old properties if they exist from backward compat conversion
      delete d.days;
      delete d.startTime;
      delete d.endTime;
      delete d.modality;
      delete d.room;

      var existingIndex = state.courses.findIndex(function (c) { return c.id === (ui.modal.payload && ui.modal.payload.id); });
      if (existingIndex !== -1) {
        state.courses[existingIndex] = Object.assign({}, state.courses[existingIndex], d);
        showToast("Course '" + d.name + "' updated.", "success");
      } else {
        var newCourse = Object.assign({}, d, { id: uid() }); state.courses.push(newCourse); showToast("Course '" + newCourse.name + "' added successfully!", "success");
      }
      ui.modal = null; commit(); return false; },
    // ... existing App functions ...

    deleteCourseWithConfirmation: function (id) {
      App.openConfirmationModal(
        "Are you sure you want to delete this course? This action cannot be undone.",
        function() { App.deleteCourse(id); }
      );
    },
    deleteCourse: function (id) {
      var courseName = state.courses.find(function(c) { return c.id === id; })?.name || "Course";
      state.courses = state.courses.filter(function (c) { return c.id !== id; });
      App.closeModal(); // Close modal after deletion
      commit().then(function() {
        showToast("Course '" + courseName + "' deleted successfully.", "success");
      });
    },
    setAppName: function (value) {
      state.settings.appName = (value || "Mavis").trim() || "Mavis";
      commit().then(function() {
        showToast("App name updated.", "success");
      });
    },
    addTaskCategory: function () {
      var input = document.getElementById("task-category-input");
      var value = input ? input.value.trim() : "";
      if (!value) return;
      var categories = Array.isArray(state.settings.taskCategories) ? state.settings.taskCategories.slice() : ["Class", "Event", "Personal"];
      if (categories.indexOf(value) === -1) {
        categories.push(value);
        state.settings.taskCategories = categories;
        commit().then(function() {
          showToast("Task category '" + value + "' added.", "success");
        });
      }
      if (input) input.value = "";
    },
    removeTaskCategory: function (name) {
      var categories = (state.settings.taskCategories || ["Class", "Event", "Personal"]).filter(function (c) { return c !== name; });
      if (categories.length === 0) return;
      state.settings.taskCategories = categories;
      commit().then(function() {
        showToast("Task category '" + name + "' removed.", "success");
      });
    },
    addTaskPriority: function () {
      var input = document.getElementById("task-priority-input");
      var value = input ? input.value.trim() : "";
      if (!value) return;
      var priorities = Array.isArray(state.settings.taskPriorities) ? state.settings.taskPriorities.slice() : DEFAULT_TASK_PRIORITIES.slice();
      if (priorities.indexOf(value) === -1) {
        priorities.push(value);
        state.settings.taskPriorities = priorities;
        commit().then(function() {
          showToast("Task priority '" + value + "' added.", "success");
        });
      }
      if (input) input.value = "";
    },
    removeTaskPriority: function (name) {
      var priorities = (state.settings.taskPriorities || DEFAULT_TASK_PRIORITIES.slice()).filter(function (p) { return p !== name; });
      if (priorities.length === 0) return;
      state.settings.taskPriorities = priorities;
      commit().then(function() {
        showToast("Task priority '" + name + "' removed.", "success");
      });
    },
    addTaskType: function () {
      var input = document.getElementById("task-type-input");
      var value = input ? input.value.trim() : "";
      if (!value) return;
      var types = Array.isArray(state.settings.taskTypes) ? state.settings.taskTypes.slice() : DEFAULT_TASK_TYPES.slice();
      if (types.indexOf(value) === -1) {
        types.push(value);
        state.settings.taskTypes = types;
        commit().then(function() {
          showToast("Task type '" + value + "' added.", "success");
        });
      }
      if (input) input.value = "";
    },
    removeTaskType: function (name) {
      var types = (state.settings.taskTypes || DEFAULT_TASK_TYPES.slice()).filter(function (t) { return t !== name; });
      if (types.length === 0) return;
      state.settings.taskTypes = types;
      commit().then(function() {
        showToast("Task type '" + name + "' removed.", "success");
      });
    },
    openTransactionModal: function () {
      ui.formDraft = { date: todayStr(), category: getBudgetCategories()[0] || "Food", item: "", type: "Expense", amount: "", method: getPaymentMethods()[0] || "Cash" };
      ui.modal = { type: "transaction", payload: null };
      render();
    },
    submitTransactionForm: function (e) {
      e.preventDefault();
      var d = ui.formDraft;
      if (!d.item || !d.amount) { alert("Please fill in the item name and amount."); return false; }
      state.transactions.push({ id: uid(), date: d.date, category: d.category, item: d.item, type: d.type, amount: Number(d.amount), method: d.method });
      showToast("Transaction for '" + d.item + "' saved successfully!", "success");
      ui.modal = null;
      commit();
      return false;
    },
    deleteTransaction: function (id) {
      var transactionItem = state.transactions.find(function(t) { return t.id === id; })?.item || "Transaction";
      state.transactions = state.transactions.filter(function (t) { return t.id !== id; });
      commit().then(function() {
        showToast("Transaction for '" + transactionItem + "' deleted.", "success");
      });
    },
    setSettingsTab: function (v) { ui.settingsTab = v; render(); },
    setBudgetView: function (v) { ui.budgetView = v; render(); },
    setBudgetMonth: function (v) { ui.budgetMonth = Number(v); render(); },
    setBudgetYear: function (v) { ui.budgetYear = Number(v); render(); },
    setBudgetSearch: function (query) {
      var searchInput = document.getElementById('budget-search-input');
      var cursorPos = searchInput ? searchInput.selectionStart : 0;
      ui.budgetSearchQuery = query;
      render();
      setTimeout(function() {
        var newSearchInput = document.getElementById('budget-search-input');
        if (newSearchInput) {
          newSearchInput.focus();
          newSearchInput.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    },
    setBudgetDateFilter: function (date) {
      ui.budgetDateFilter = date;
      render();
    },
    clearBudgetFilters: function () {
      ui.budgetSearchQuery = "";
      ui.budgetDateFilter = "";
      render();
    },
    removeBudgetCategory: function (name) {
      var categories = getBudgetCategories().filter(function (c) { return c !== name; });
      if (categories.length === 0) return;
      state.settings.budgetCategories = categories;
      commit().then(function() {
        showToast("Budget category '" + name + "' removed.", "success");
      });
    },
    addPaymentMethod: function () {
      var input = document.getElementById("payment-method-input");
      var value = input ? input.value.trim() : "";
      if (!value) return;
      var methods = getPaymentMethods();
      if (methods.indexOf(value) === -1) {
        methods.push(value);
        state.settings.paymentMethods = methods;
        commit().then(function() {
          showToast("Payment method '" + value + "' added.", "success");
        });
      }
      if (input) input.value = "";
    },
    removePaymentMethod: function (name) {
      var methods = getPaymentMethods().filter(function (m) { return m !== name; });
      if (methods.length === 0) return;
      state.settings.paymentMethods = methods;
      commit().then(function() {
        showToast("Payment method '" + name + "' removed.", "success");
      });
    },

    /* Transactions */
    openDayDetail: function (dateKey) {
      var d = new Date(dateKey + "T00:00:00");
      ui.modal = { type: "day-detail", payload: { dateKey: dateKey, label: DAY_LABELS[d.getDay()] + " • " + MONTH_NAMES[d.getMonth()] + " " + d.getDate() } };
      render();
    },
    /* Tasks */
    openTaskModal: function (id) {
      var task = id ? state.tasks.find(function (t) { return t.id === id; }) : null;
      ui.formDraft = task ? Object.assign({}, task, { taskRepeatType: 'none', taskRepeatUntilDate: '' }) : {
        category: "Class", title: "", courseName: state.courses[0] ? state.courses[0].name : "",
        taskType: "Assignment", taskCode: "", status: "To Do", priority: "Medium", dueDate: todayStr(),
        dueTime: "23:59", location: "", description: "", taskRepeatType: 'none', taskRepeatUntilDate: ''
      };
      ui.modal = { type: "task", payload: task || null };
      render();
    },
    setTaskFormCategory: function (cat) { ui.formDraft.category = cat; renderModalContent(); },
    setTaskRecurrence: function(type) {
      App.updateDraft('taskRepeatType', type);
      renderModalContent();
    },
    submitTaskForm: function (e) {
      e.preventDefault();
      var draft = ui.formDraft;
      if (!draft.title || !draft.dueDate) { alert("Please provide a title and due date."); return false; }

      var tasksToSave = [];
      var existingId = ui.modal.payload && ui.modal.payload.id;

      if (draft.taskRepeatType === 'none' || !draft.taskRepeatUntilDate) {
        // Single task or no repeat until date specified
        tasksToSave.push(Object.assign({}, draft, { id: existingId || uid(), taskRepeatType: 'none', taskRepeatUntilDate: '' }));
      } else {
        var startDate = new Date(draft.dueDate + 'T00:00:00');
        var repeatUntilDate = new Date(draft.taskRepeatUntilDate + 'T00:00:00');

        if (startDate > repeatUntilDate) {
          alert("Repeat until date cannot be before the due date.");
          return false;
        }

        var currentDate = new Date(startDate);
        while (currentDate <= repeatUntilDate) {
          var newTask = Object.assign({}, draft, {
            id: uid(), // Always new ID for recurring instances
            dueDate: toInputDateString(currentDate),
            taskRepeatType: 'none', // Each instance is a single task
            taskRepeatUntilDate: ''
          });
          tasksToSave.push(newTask);

          // Increment date based on repeatType
          switch (draft.taskRepeatType) {
            case 'daily':
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'monthly':
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
            case 'yearly':
              currentDate.setFullYear(currentDate.getFullYear() + 1);
              break;
          }
          currentDate.setHours(0, 0, 0, 0); // Reset time to avoid DST issues
        }
      }

      if (existingId && draft.taskRepeatType === 'none') { // Only update if it's an existing single task
        var existingIndex = state.tasks.findIndex(function (t) { return t.id === existingId; });
        if (existingIndex !== -1) {
          state.tasks[existingIndex] = tasksToSave[0];
        }
      } else {
        // Add all new tasks. If it was an existing recurring task, the old instances remain.
        // For simplicity, we're not deleting old instances of a recurring task if it's edited.
        state.tasks = state.tasks.concat(tasksToSave);
      }
      ui.modal = null;
      commit().then(function() {
        showToast("Task(s) saved successfully!", "success");
      });
      return false;
    },
    deleteTaskWithConfirmation: function (id) {
      App.openConfirmationModal(
        "Are you sure you want to delete this task? This action cannot be undone.",
        function() { App.deleteTask(id); }
      );
    },
    deleteTask: function (id) {
      var taskTitle = state.tasks.find(function(t) { return t.id === id; })?.title || "Task";
      state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
      App.closeModal(); // Close modal if open
      commit().then(function() {
        showToast("Task '" + taskTitle + "' deleted.", "success");
      });
    },
    setTaskStatus: function (id, status, noToast) {
      state.tasks = state.tasks.map(function (t) { return t.id === id ? Object.assign({}, t, { status: status }) : t; });
      commit().then(function() {
        if (!noToast) {
          showToast("Task status updated.", "success");
        }
      });
    },
    toggleTaskDone: function (id) {
      state.tasks = state.tasks.map(function (t) {
        if (t.id !== id) return t;
        return Object.assign({}, t, { status: t.status === "Completed" ? "To Do" : "Completed" });
      });
      commit().then(function() {
        showToast("Task status updated.", "success");
      });
    },
    updateTaskField: function (id, field, value) {
      state.tasks = state.tasks.map(function (t) { return t.id === id ? Object.assign({}, t, (function () { var o = {}; o[field] = value; return o; })()) : t; });
      commit().then(function() {
        showToast("Task updated.", "success");
      });
    },
    setTaskView: function (v) { ui.taskView = v; render(); },
    setTaskFilter: function (v) { ui.taskFilter = v; render(); },
    setTaskSort: function (v) { ui.taskSort = v; render(); },

    /* Kanban Drag and Drop */
    handleDragStart: function (e, taskId) {
      e.dataTransfer.setData("text/plain", taskId);
      e.dataTransfer.effectAllowed = "move";
      // Add a class to the dragged element for styling, after a short delay
      setTimeout(function() {
        e.target.classList.add('dragging');
      }, 0);
    },
    handleDragEnd: function (e) {
      // Clean up the styling class
      e.target.classList.remove('dragging');
    },
    handleDragOver: function (e) {
      e.preventDefault(); // This is necessary to allow a drop
      e.dataTransfer.dropEffect = "move";
      var col = e.currentTarget;
      if (col.classList.contains('kanban-col')) {
        col.classList.add('drag-over');
      }
    },
    handleDragLeave: function (e) {
      e.currentTarget.classList.remove('drag-over');
    },
    handleDrop: function (e) {
      e.preventDefault();
      var col = e.currentTarget;
      col.classList.remove('drag-over');
      var taskId = e.dataTransfer.getData("text/plain");
      var newStatus = col.dataset.status;
      var task = state.tasks.find(function(t) { return t.id === taskId; });
      var oldStatus = task ? (task.status || "To Do") : null;
      if (oldStatus && oldStatus !== newStatus) {
        App.setTaskStatus(taskId, newStatus, true); // The `true` here is for `noToast`
      }
    },

    openSidebar: function () {
      // This function is no longer used directly by onmouseenter/onmouseleave
      // The logic is now handled by openSidebarOnHover/closeSidebarOnHover
      // and the persistent state.settings.showSidebar
    },
    closeSidebar: function () {
      // See openSidebar
    },
    toggleSidebar: function () { // This button will toggle the persistent showSidebar setting
      if (window.innerWidth <= 768) return; // Mobile always closed by default
      state.settings.showSidebar = !state.settings.showSidebar;
      // If toggled to open, disable expandOnHover for explicit control
      if (state.settings.showSidebar) {
        state.settings.sidebarExpandOnHover = false;
      }
      commit().then(function() {
        showToast("Sidebar visibility updated.", "success");
        applySettingsToDom(); // Apply immediately
      });
    },
    /* Generic draft/modal helpers */
    updateDraft: function (field, value) { ui.formDraft[field] = value; },
    closeModal: function () { ui.modal = null; render(); },
    overlayClose: function (e) { if (e.target === e.currentTarget) App.closeModal(); },

    // New confirmation modal functions
    openConfirmationModal: function(message, onConfirmCallback) {
        ui.modal = {
            type: "confirmation",
            payload: {
                message: message,
                onConfirm: onConfirmCallback
            }
        };
        render();
    },
    executeConfirmation: function() {
        if (ui.modal && ui.modal.type === 'confirmation' && typeof ui.modal.payload.onConfirm === 'function') {
            ui.modal.payload.onConfirm();
        }
    },

    /* FAB */
    toggleFab: function () { ui.fabOpen = !ui.fabOpen; render(); },
    closeFab: function () { ui.fabOpen = false; render(); },
    fabAction: function (id) {
      ui.fabOpen = false;
      App.closeModal(); // Close any open modal before opening a new one via FAB
      if (id === "expense") App.openTransactionModal();
      else if (id === "task") App.openTaskModal();
      else if (id === "course") App.openCourseModal();
      else if (id === "today") App.setTab("dashboard");
    }
  };

  // Function to apply settings to DOM (CSS variables, body classes)
  function applySettingsToDom() {
    // Theme (already handled in renderShell, but good to have here for consistency)
    document.documentElement.setAttribute("data-theme", state.settings.theme);

    // Accent Color
    document.documentElement.style.setProperty("--accent", state.settings.accentColor);
    var rgb = hexToRgbComponents(state.settings.accentColor);
    document.documentElement.style.setProperty("--text-on-primary", getContrastTextColor(state.settings.accentColor)); // New: Set text color for primary backgrounds
    if (Array.isArray(rgb)) document.documentElement.style.setProperty("--accent-rgb", rgb.join(","));

    // Layout Density
    document.body.classList.toggle("layout-compact", state.settings.layoutDensity === "compact");

    // Accessibility Mode
    document.body.classList.toggle("high-contrast", state.settings.accessibilityMode === "highContrast");
    document.body.classList.toggle("reduced-motion", state.settings.accessibilityMode === "reducedMotion");

    // Sidebar behavior (update classes based on settings)
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('closed', !state.settings.showSidebar); // Persistent state
    }

    // Update custom color picker button's background and icon color in settings
    var customPickerBtn = document.querySelector('#settings .custom-color-picker-btn');
    if (customPickerBtn) {
      customPickerBtn.style.backgroundColor = state.settings.accentColor;
      customPickerBtn.style.color = getContrastTextColor(state.settings.accentColor);
    }
  }
  window.App = App;

  /* ---------------- Init ---------------- */
  window.onload = function () {
    document.body.classList.add('anim-initial-load');
    // Load data and then render the application
    loadState().then(function () {
      ui.lastSaveTime = new Date(); // Initialize lastSaveTime after data loads
      App.setTab(state.settings.defaultLandingTab || DEFAULT_LANDING_TAB); // Set initial tab based on settings
      setInterval(renderSaveStatus, 1000);
      // After a delay (longer than the longest animation), remove the class.
      // This ensures animations only run on the very first page load.
      setTimeout(function() {
        document.body.classList.remove('anim-initial-load');
      }, 1000);
    });
  };
})();

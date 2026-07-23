"use strict";

const db = window.nscSupabase || window.supabaseClient;
const $ = id => document.getElementById(id);

const state = {
  session: null,
  profile: null,
  properties: [],
  selectedProperty: null,
  turnovers: [],
  issues: [],
  inventoryItems: [],
  inventoryCounts: [],
  photos: [],
  reports: [],
  notifications: [],
  calendarDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  activeTab: "turnovers",
  search: ""
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function key(value) {
  return String(value || "other").trim().toLowerCase().replaceAll(" ", "_");
}

function label(value) {
  return key(value).replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value);
  const date = new Date(text.length === 10 ? `${text}T12:00:00` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value, options = {}) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat("en-CA", options).format(date) : "";
}

function formatTime(value) {
  return formatDate(value, { hour: "numeric", minute: "2-digit" });
}

function formatMoney(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD"
  }).format(Number.isFinite(number) ? number : 0);
}

function toast(message, type = "") {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${type}`.trim();
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.className = "toast", 3200);
}

function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("open");
  el.setAttribute("aria-hidden", "true");
}

async function requireOwner() {
  if (!db) throw new Error("Supabase client is unavailable.");

  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    location.href = "login.html";
    return;
  }

  state.session = sessionData.session;

  const { data: profile, error } = await db
    .from("users")
    .select("id,auth_user_id,full_name,email,role,active,company_id")
    .eq("auth_user_id", state.session.user.id)
    .single();

  if (error || !profile) throw new Error("Owner profile could not be loaded.");
  if (profile.active !== true) throw new Error("This owner account is inactive.");
  if (String(profile.role).toLowerCase() !== "owner") {
    location.href = String(profile.role).toLowerCase() === "cleaner"
      ? "cleaner-dashboard.html"
      : "manager-dashboard.html";
    return;
  }

  state.profile = profile;
  if ($("sidebarUserName")) $("sidebarUserName").textContent =
    profile.full_name || profile.email || state.session.user.email;
}

async function loadProperties() {
  const { data, error } = await db
    .from("property_members")
    .select(`
      property_id,
      member_role,
      active,
      properties (
        id,
        company_id,
        property_name,
        property_code,
        address,
        city,
        province,
        postal_code,
        active
      )
    `)
    .eq("user_id", state.profile.id)
    .eq("active", true);

  if (error) throw error;

  state.properties = (data || [])
    .map(row => row.properties)
    .filter(Boolean)
    .filter(property => property.active !== false);

  if (!state.properties.length) {
    throw new Error("No properties are assigned to this owner account.");
  }

  const select = $("propertySelect");
  if (select) {
    select.innerHTML = state.properties.map(property =>
      `<option value="${esc(property.id)}">${esc(property.property_name)}</option>`
    ).join("");
  }

  const requested = new URLSearchParams(location.search).get("property_id");
  const saved = localStorage.getItem("nsc_owner_property_id");
  state.selectedProperty =
    state.properties.find(p => p.id === requested) ||
    state.properties.find(p => p.id === saved) ||
    state.properties[0];

  if (select) select.value = state.selectedProperty.id;
  localStorage.setItem("nsc_owner_property_id", state.selectedProperty.id);
  renderPropertyHeader();
}

function renderPropertyHeader() {
  const p = state.selectedProperty;
  const address = [p.address, p.city, p.province, p.postal_code].filter(Boolean).join(", ");
  if ($("selectedPropertyAddress")) $("selectedPropertyAddress").textContent = address;
}

async function loadTurnovers() {
  const { data, error } = await db
    .from("turnovers")
    .select(`
      id,
      company_id,
      property_id,
      checklist_template_id,
      assigned_user_id,
      turnover_date,
      scheduled_start,
      scheduled_end,
      status,
      priority,
      same_day_turnover,
      guest_checkout_time,
      guest_checkin_time,
      check_in_time,
      check_out_time,
      final_notes,
      property_readiness_status,
      owner_approval_status,
      owner_approval_notes,
      completed_at,
      created_at,
      updated_at,
      attendance_status,
      attendance_note,
      needs_reassignment,
      users:assigned_user_id (
        id,
        full_name
      ),
      turnover_tasks (
        id,
        turnover_id,
        room_id,
        section_name,
        task_text,
        task_code,
        required_photo_count,
        task_status,
        cleaner_note,
        sort_order,
        is_required,
        photo_required,
        notes_required,
        task_type,
        category,
        cleaner_instructions,
        manager_status,
        manager_note,
        completed_at,
        rooms (
          id,
          room_name,
          room_code
        )
      )
    `)
    .eq("property_id", state.selectedProperty.id)
    .order("turnover_date", { ascending: false })
    .order("scheduled_start", { ascending: false });

  if (error) throw error;
  state.turnovers = data || [];
}

async function loadIssues() {
  const { data, error } = await db
    .from("issues")
    .select(`
      id,
      turnover_id,
      property_id,
      room_id,
      issue_type,
      title,
      description,
      urgency,
      issue_status,
      prevents_guest_ready,
      owner_review_required,
      owner_reviewed_at,
      resolution_notes,
      resolved_at,
      created_at,
      updated_at,
      rooms (
        id,
        room_name
      )
    `)
    .eq("property_id", state.selectedProperty.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.issues = data || [];
}

async function loadInventory() {
  const { data: items, error: itemError } = await db
    .from("inventory_items")
    .select(`
      id,
      property_id,
      item_name,
      item_code,
      category,
      unit_name,
      minimum_quantity,
      amber_quantity,
      target_quantity,
      count_method,
      location_note,
      emergency_stock,
      active,
      sort_order
    `)
    .eq("property_id", state.selectedProperty.id)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (itemError) throw itemError;
  state.inventoryItems = items || [];

  const ids = state.turnovers.map(t => t.id);
  if (!ids.length) {
    state.inventoryCounts = [];
    return;
  }

  const { data: counts, error: countError } = await db
    .from("inventory_counts")
    .select(`
      id,
      turnover_id,
      inventory_item_id,
      quantity_remaining,
      level_status,
      stock_status,
      emergency_stock_used,
      emergency_quantity_used,
      cleaner_note,
      counted_at
    `)
    .in("turnover_id", ids)
    .order("counted_at", { ascending: false });

  if (countError) throw countError;
  state.inventoryCounts = counts || [];
}

async function loadPhotos() {
  const ids = state.turnovers.map(t => t.id);
  if (!ids.length) {
    state.photos = [];
    return;
  }

  const { data, error } = await db
    .from("photos")
    .select(`
      id,
      turnover_id,
      turnover_task_id,
      room_id,
      issue_id,
      photo_type,
      storage_path,
      file_name,
      mime_type,
      caption,
      taken_at,
      created_at
    `)
    .in("turnover_id", ids)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.photos = data || [];

  await Promise.all(state.photos.map(async photo => {
    if (!photo.storage_path) return;
    const { data: signed } = await db.storage
      .from("turnover-photos")
      .createSignedUrl(photo.storage_path, 3600);
    photo.preview_url = signed?.signedUrl || null;
  }));
}

async function loadReports() {
  const ids = state.turnovers.map(t => t.id);
  if (!ids.length) {
    state.reports = [];
    return;
  }

  const { data, error } = await db
    .from("reports")
    .select(`
      id,
      turnover_id,
      report_type,
      report_number,
      storage_path,
      generated_at,
      sent_to_manager_at,
      sent_to_owner_at,
      created_at
    `)
    .in("turnover_id", ids)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.reports = data || [];

  await Promise.all(state.reports.map(async report => {
    if (!report.storage_path) return;
    const { data: signed } = await db.storage
      .from("turnover-reports")
      .createSignedUrl(report.storage_path, 3600);
    report.preview_url = signed?.signedUrl || null;
  }));
}

async function loadNotifications() {
  const { data, error } = await db
    .from("notifications")
    .select(`
      id,
      company_id,
      property_id,
      turnover_id,
      recipient_user_id,
      notification_type,
      severity,
      title,
      message,
      action_url,
      read_at,
      created_at
    `)
    .eq("recipient_user_id", state.profile.id)
    .or(`property_id.eq.${state.selectedProperty.id},property_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  state.notifications = data || [];
}

async function loadFinance() {
  const { data, error } = await db
    .from("finance_revenue")
    .select(`
      id,
      property_id,
      invoice_number,
      client_name,
      invoice_date,
      due_date,
      amount_before_hst,
      hst_collected,
      invoice_total,
      amount_paid,
      outstanding_balance,
      invoice_status,
      payment_method,
      payment_reference,
      payment_confirmed_at,
      notes,
      created_at
    `)
    .eq("property_id", state.selectedProperty.id)
    .order("invoice_date", { ascending: false });

  if (error) throw error;
  state.invoices = data || [];
}

function latestCounts() {
  const result = new Map();
  state.inventoryCounts.forEach(count => {
    if (!result.has(count.inventory_item_id)) result.set(count.inventory_item_id, count);
  });
  return result;
}

function taskComplete(task) {
  return ["completed", "done", "approved"].includes(key(task.task_status));
}

function progress(turnover) {
  const tasks = turnover.turnover_tasks || [];
  if (!tasks.length) return 0;
  return Math.round(tasks.filter(taskComplete).length / tasks.length * 100);
}

function renderCalendar() {
  if (!$("calendarGrid")) return;

  const month = state.calendarDate;
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  $("calendarMonth").textContent = formatDate(first, { month: "long", year: "numeric" });

  const grouped = new Map();
  state.turnovers.forEach(turnover => {
    const d = dateKey(turnover.turnover_date || turnover.scheduled_start);
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d).push(turnover);
  });

  const today = dateKey(new Date());
  const html = [];

  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const d = dateKey(day);
    const events = grouped.get(d) || [];

    html.push(`
      <div class="calendar-day ${day.getMonth() !== first.getMonth() ? "outside" : ""} ${d === today ? "today" : ""}">
        <div class="day-number">${day.getDate()}</div>
        <div class="day-events">
          ${events.slice(0, 3).map(turnover => `
            <button class="calendar-event status-${esc(key(turnover.status))}"
              data-turnover-id="${esc(turnover.id)}" type="button">
              ${esc(formatTime(turnover.scheduled_start) || label(turnover.status))}
            </button>
          `).join("")}
          ${events.length > 3 ? `<div class="calendar-more">+${events.length - 3} more</div>` : ""}
        </div>
      </div>
    `);
  }

  $("calendarGrid").innerHTML = html.join("");
  $("calendarGrid").querySelectorAll("[data-turnover-id]").forEach(button => {
    button.onclick = () => location.href =
      `owner-turnover.html?id=${encodeURIComponent(button.dataset.turnoverId)}`;
  });
}

function renderUpcoming() {
  if (!$("upcomingCleans")) return;
  const today = dateKey(new Date());

  const rows = state.turnovers
    .filter(t => dateKey(t.turnover_date || t.scheduled_start) >= today)
    .filter(t => key(t.status) !== "cancelled")
    .sort((a, b) => new Date(a.scheduled_start || a.turnover_date) - new Date(b.scheduled_start || b.turnover_date))
    .slice(0, 8);

  $("upcomingCleans").innerHTML = rows.length ? rows.map(t => `
    <button class="list-row row-button" type="button" data-turnover-id="${esc(t.id)}">
      <p class="row-title">${esc(formatDate(t.turnover_date, { weekday: "short", month: "short", day: "numeric" }))}</p>
      <p class="row-meta">${esc(formatTime(t.scheduled_start) || "Time not set")} · ${esc(t.users?.full_name || "Cleaner not assigned")}</p>
      <span class="status-pill status-${esc(key(t.status))}">${esc(label(t.status))}</span>
    </button>
  `).join("") : `<div class="empty-state"><strong>No upcoming cleans</strong></div>`;

  $("upcomingCleans").querySelectorAll("[data-turnover-id]").forEach(button => {
    button.onclick = () => location.href =
      `owner-turnover.html?id=${encodeURIComponent(button.dataset.turnoverId)}`;
  });
}

function currentTurnover() {
  const active = state.turnovers.find(t => key(t.status) === "in_progress");
  if (active) return active;

  return state.turnovers
    .filter(t => !["cancelled", "completed"].includes(key(t.status)))
    .sort((a, b) => new Date(a.scheduled_start || a.turnover_date) - new Date(b.scheduled_start || b.turnover_date))[0] || null;
}

function showChecklist(turnover) {
  const tasks = turnover.turnover_tasks || [];
  const grouped = new Map();

  tasks.forEach(task => {
    const room = task.rooms?.room_name || task.section_name || "General";
    if (!grouped.has(room)) grouped.set(room, []);
    grouped.get(room).push(task);
  });

  const photos = state.photos.filter(p => p.turnover_id === turnover.id && p.preview_url);

  $("checklistModalBody").innerHTML = `
    ${[...grouped.entries()].map(([room, roomTasks]) => `
      <section class="checklist-room">
        <div class="checklist-room-header">
          <span>${esc(room)}</span>
          <span>${roomTasks.filter(taskComplete).length}/${roomTasks.length}</span>
        </div>
        ${roomTasks.map(task => `
          <div class="checklist-task">
            <span class="task-check">${taskComplete(task) ? "✓" : ""}</span>
            <span>${esc(task.task_text)}</span>
            <span class="status-pill status-${esc(key(task.task_status))}">${esc(label(task.task_status))}</span>
          </div>
        `).join("")}
      </section>
    `).join("")}
    ${photos.length ? `
      <div class="photo-grid">
        ${photos.map(photo => `
          <a class="photo-card" href="${esc(photo.preview_url)}" target="_blank" rel="noopener">
            <div class="photo-preview"><img src="${esc(photo.preview_url)}" alt="${esc(photo.caption || "Cleaning photo")}"></div>
          </a>
        `).join("")}
      </div>
    ` : ""}
  `;
  openModal("checklistModal");
}

function renderLiveProgress() {
  if (!$("liveProgressContent")) return;
  const turnover = currentTurnover();

  if (!turnover) {
    $("liveTurnoverTitle").textContent = "";
    $("liveProgressContent").innerHTML = `<div class="empty-state"><strong>No active cleaning</strong></div>`;
    return;
  }

  const percent = progress(turnover);
  $("liveTurnoverTitle").textContent =
    formatDate(turnover.turnover_date, { weekday: "long", month: "long", day: "numeric" });

  $("liveProgressContent").innerHTML = `
    <div class="live-progress-grid">
      <div>
        <p class="row-title">${esc(turnover.users?.full_name || "Cleaner not assigned")}</p>
        <p class="row-meta">Status: ${esc(label(turnover.status))}</p>
        <p class="row-meta">Check-in: ${esc(formatTime(turnover.check_in_time) || "Not checked in")}</p>
      </div>
      <div>
        <p class="progress-value">${percent}%</p>
        <div class="progress-track"><span style="width:${percent}%"></span></div>
      </div>
      <button class="button button-secondary" id="viewChecklistButton" type="button">View Live Checklist</button>
    </div>
  `;

  $("viewChecklistButton").onclick = () => showChecklist(turnover);
}

function renderIssues() {
  if (!$("issuesList")) return;
  const rows = state.issues.filter(i => !["resolved", "closed"].includes(key(i.issue_status)));

  $("issuesList").innerHTML = rows.length ? rows.map(issue => `
    <div class="list-row">
      <p class="row-title">${esc(issue.title || issue.issue_type || "Reported issue")}</p>
      <p class="row-meta">${esc(issue.rooms?.room_name || "General")} · ${esc(label(issue.urgency))}</p>
      <p class="row-meta">${esc(issue.description || "")}</p>
      <span class="status-pill status-${esc(key(issue.issue_status))}">${esc(label(issue.issue_status))}</span>
    </div>
  `).join("") : `<div class="empty-state"><strong>No open issues</strong></div>`;
}

function renderInventory() {
  if (!$("inventoryList")) return;
  const latest = latestCounts();

  $("inventoryList").innerHTML = state.inventoryItems.length ? state.inventoryItems.map(item => {
    const count = latest.get(item.id);
    const quantity = count?.quantity_remaining;
    const status = count?.stock_status || count?.level_status || "not_counted";

    return `
      <div class="inventory-row">
        <div>
          <p class="row-title">${esc(item.item_name)}</p>
          <p class="row-meta">${quantity == null ? "Not counted" : `${esc(quantity)} ${esc(item.unit_name)}`}</p>
          <p class="row-meta">Target ${esc(item.target_quantity ?? "—")} · Amber ${esc(item.amber_quantity ?? "—")} · Minimum ${esc(item.minimum_quantity)}</p>
        </div>
        <span class="status-pill status-${esc(key(status))}">${esc(label(status))}</span>
      </div>
    `;
  }).join("") : `<div class="empty-state"><strong>No inventory items</strong></div>`;
}

function renderMessagesUnavailable() {
  if (!$("messageThread")) return;
  $("messageThread").innerHTML = `
    <div class="empty-state">
      <strong>Messaging is not configured yet</strong>
      <span>A proper property-messages table must be added before messages can be sent.</span>
    </div>
  `;
  if ($("messageInput")) {
    $("messageInput").disabled = true;
    $("messageInput").placeholder = "Messaging will be enabled after the messages table is created.";
  }
  const button = $("messageForm")?.querySelector("button[type='submit']");
  if (button) button.disabled = true;
}

function renderNotifications() {
  if (!$("notificationsList")) return;

  $("notificationsList").innerHTML = state.notifications.length ? state.notifications.map(n => `
    <div class="notification-item">
      <span class="notification-dot"></span>
      <div>
        <p class="row-title">${esc(n.title)}</p>
        <p class="row-meta">${esc(n.message)}</p>
        <p class="row-meta">${esc(formatDate(n.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</p>
      </div>
    </div>
  `).join("") : `<div class="empty-state"><strong>No owner notifications</strong></div>`;
}

async function submitCleaningRequest() {
  const date = $("requestDate")?.value;
  const time = $("requestTime")?.value;
  const notes = $("requestNotes")?.value.trim();

  if (!date || !notes) return;

  const scheduledStart = time ? new Date(`${date}T${time}:00`).toISOString() : null;

  const { error } = await db.from("turnovers").insert({
    company_id: state.selectedProperty.company_id,
    property_id: state.selectedProperty.id,
    turnover_date: date,
    scheduled_start: scheduledStart,
    status: "requested",
    priority: "normal",
    final_notes: notes,
    owner_approval_status: "pending",
    created_by: state.profile.id,
    attendance_status: "pending",
    needs_reassignment: false
  });

  if (error) {
    toast(error.message, "error");
    return;
  }

  closeModal("requestCleaningModal");
  $("requestCleaningForm").reset();
  toast("Cleaning request submitted.", "success");
  await loadDashboardData();
}

async function loadDashboardData() {
  await loadTurnovers();
  await Promise.all([
    loadIssues(),
    loadInventory(),
    loadPhotos(),
    loadNotifications()
  ]);

  renderCalendar();
  renderUpcoming();
  renderLiveProgress();
  renderIssues();
  renderInventory();
  renderMessagesUnavailable();
  renderNotifications();
}

function renderTurnoversTab() {
  const rows = state.turnovers.filter(t => key(t.status) === "completed");
  $("sectionContent").innerHTML = rows.length ? `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Cleaner</th><th>Status</th><th>Progress</th><th></th></tr></thead>
          <tbody>
            ${rows.map(t => `
              <tr>
                <td>${esc(formatDate(t.turnover_date, { month: "short", day: "numeric", year: "numeric" }))}</td>
                <td>${esc(t.users?.full_name || "—")}</td>
                <td><span class="status-pill status-${esc(key(t.status))}">${esc(label(t.status))}</span></td>
                <td>${progress(t)}%</td>
                <td><button class="button button-secondary button-small" data-turnover-id="${esc(t.id)}">Open</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  ` : `<div class="card"><div class="empty-state"><strong>No completed turnovers</strong></div></div>`;

  $("sectionContent").querySelectorAll("[data-turnover-id]").forEach(button => {
    button.onclick = () => location.href = `owner-turnover.html?id=${encodeURIComponent(button.dataset.turnoverId)}`;
  });
}

function renderReportsTab() {
  const search = state.search.toLowerCase();
  const rows = state.reports.filter(report =>
    !search || `${report.report_type} ${report.report_number}`.toLowerCase().includes(search)
  );

  $("sectionContent").innerHTML = rows.length ? `
    <div class="document-grid">
      ${rows.map(report => `
        <article class="document-card">
          <div class="document-card-top">
            <div>
              <p class="document-title">${esc(report.report_number || label(report.report_type))}</p>
              <p class="document-meta">${esc(formatDate(report.generated_at || report.created_at, { month: "short", day: "numeric", year: "numeric" }))}</p>
            </div>
          </div>
          <div class="document-actions">
            ${report.preview_url ? `<a class="button button-secondary button-small" href="${esc(report.preview_url)}" target="_blank" rel="noopener">Open</a>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  ` : `<div class="card"><div class="empty-state"><strong>No reports found</strong></div></div>`;
}

function renderPhotosTab() {
  const rows = state.photos.filter(photo => photo.preview_url);
  $("sectionContent").innerHTML = rows.length ? `
    <div class="photo-grid">
      ${rows.map(photo => `
        <a class="photo-card" href="${esc(photo.preview_url)}" target="_blank" rel="noopener">
          <div class="photo-preview"><img src="${esc(photo.preview_url)}" alt="${esc(photo.caption || "Cleaning photo")}"></div>
          <div class="photo-info">
            <p class="photo-title">${esc(photo.caption || photo.file_name || label(photo.photo_type))}</p>
            <p class="photo-meta">${esc(formatDate(photo.taken_at || photo.created_at, { month: "short", day: "numeric", year: "numeric" }))}</p>
          </div>
        </a>
      `).join("")}
    </div>
  ` : `<div class="card"><div class="empty-state"><strong>No photos found</strong></div></div>`;
}

function renderInvoicesTab() {
  const rows = state.invoices || [];
  $("sectionContent").innerHTML = rows.length ? `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map(invoice => `
              <tr>
                <td class="primary-cell">${esc(invoice.invoice_number)}</td>
                <td>${esc(formatDate(invoice.invoice_date, { month: "short", day: "numeric", year: "numeric" }))}</td>
                <td>${esc(formatMoney(invoice.invoice_total))}</td>
                <td>${esc(formatMoney(invoice.amount_paid))}</td>
                <td>${esc(formatMoney(invoice.outstanding_balance))}</td>
                <td><span class="status-pill status-${esc(key(invoice.invoice_status))}">${esc(label(invoice.invoice_status))}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  ` : `<div class="card"><div class="empty-state"><strong>No invoices found</strong></div></div>`;
}

async function renderDocumentsTab() {
  if (!$("sectionContent")) return;
  if (state.activeTab === "turnovers" || state.activeTab === "checklists") renderTurnoversTab();
  else if (state.activeTab === "photos") renderPhotosTab();
  else if (["reports", "documents", "agreements"].includes(state.activeTab)) renderReportsTab();
  else if (state.activeTab === "invoices") renderInvoicesTab();
}

function bindCommon() {
  $("signOutButton")?.addEventListener("click", async () => {
    await db.auth.signOut();
    location.href = "login.html";
  });

  $("mobileMenuButton")?.addEventListener("click", () => $("sidebar")?.classList.toggle("open"));

  document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });

  $("propertySelect")?.addEventListener("change", async event => {
    state.selectedProperty = state.properties.find(p => p.id === event.target.value);
    localStorage.setItem("nsc_owner_property_id", state.selectedProperty.id);
    renderPropertyHeader();

    if ($("calendarGrid")) await loadDashboardData();
    if ($("sectionContent")) {
      await loadDocumentsData();
      await renderDocumentsTab();
    }
  });
}

async function initDashboard() {
  bindCommon();
  await requireOwner();
  await loadProperties();

  $("previousMonthButton")?.addEventListener("click", () => {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });

  $("nextMonthButton")?.addEventListener("click", () => {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });

  $("requestCleaningButton")?.addEventListener("click", () => openModal("requestCleaningModal"));
  $("requestCleaningForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    await submitCleaningRequest();
  });

  $("addInventoryButton")?.remove();
  await loadDashboardData();
}

async function loadDocumentsData() {
  await loadTurnovers();
  await Promise.all([loadPhotos(), loadReports(), loadFinance()]);
}

async function initDocuments() {
  bindCommon();
  await requireOwner();
  await loadProperties();
  await loadDocumentsData();

  $("searchInput")?.addEventListener("input", event => {
    state.search = event.target.value;
    renderDocumentsTab();
  });

  $("tabs")?.addEventListener("click", event => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    state.activeTab = button.dataset.tab;
    $("tabs").querySelectorAll("[data-tab]").forEach(tab =>
      tab.classList.toggle("active", tab === button)
    );
    renderDocumentsTab();
  });

  await renderDocumentsTab();
}

(async () => {
  try {
    if ($("calendarGrid")) await initDashboard();
    else if ($("sectionContent")) await initDocuments();
  } catch (error) {
    console.error(error);
    const content = document.querySelector(".content");
    if (content) {
      content.innerHTML = `
        <div class="card">
          <div class="error-state">
            <strong>Owner portal could not load</strong>
            <span>${esc(error.message || error)}</span>
          </div>
        </div>
      `;
    }
  }
})();

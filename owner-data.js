<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>owner-data.js Code</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f4f7fb;
      color: #172033;
    }
    header {
      position: sticky;
      top: 0;
      background: white;
      border-bottom: 1px solid #d9e1ec;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      z-index: 10;
    }
    h1 {
      margin: 0;
      font-size: 20px;
    }
    button {
      border: 0;
      border-radius: 8px;
      padding: 10px 16px;
      background: #17324d;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
    main {
      padding: 20px;
    }
    pre {
      margin: 0;
      background: #0f172a;
      color: #e5e7eb;
      padding: 20px;
      border-radius: 12px;
      overflow: auto;
      white-space: pre;
      line-height: 1.5;
      font-family: Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
    }
    .note {
      margin: 0 0 14px;
      color: #536174;
    }
  </style>
</head>
<body>
  <header>
    <h1>owner-data.js</h1>
    <button id="copyButton" type="button">Copy All Code</button>
  </header>

  <main>
    <p class="note">Click “Copy All Code,” then paste it into your project file named owner-data.js.</p>
    <pre id="code">&quot;use strict&quot;;

const db = window.nscSupabase || window.supabaseClient;
const $ = id =&gt; document.getElementById(id);

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
  activeTab: &quot;turnovers&quot;,
  search: &quot;&quot;
};

function esc(value) {
  return String(value ?? &quot;&quot;)
    .replaceAll(&quot;&amp;&quot;, &quot;&amp;amp;&quot;)
    .replaceAll(&quot;&lt;&quot;, &quot;&amp;lt;&quot;)
    .replaceAll(&quot;&gt;&quot;, &quot;&amp;gt;&quot;)
    .replaceAll(&#x27;&quot;&#x27;, &quot;&amp;quot;&quot;)
    .replaceAll(&quot;&#x27;&quot;, &quot;&amp;#039;&quot;);
}

function key(value) {
  return String(value || &quot;other&quot;).trim().toLowerCase().replaceAll(&quot; &quot;, &quot;_&quot;);
}

function label(value) {
  return key(value).replaceAll(&quot;_&quot;, &quot; &quot;).replace(/\b\w/g, c =&gt; c.toUpperCase());
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value);
  const date = new Date(text.length === 10 ? `${text}T12:00:00` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return &quot;&quot;;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, &quot;0&quot;)}-${String(date.getDate()).padStart(2, &quot;0&quot;)}`;
}

function formatDate(value, options = {}) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat(&quot;en-CA&quot;, options).format(date) : &quot;&quot;;
}

function formatTime(value) {
  return formatDate(value, { hour: &quot;numeric&quot;, minute: &quot;2-digit&quot; });
}

function formatMoney(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat(&quot;en-CA&quot;, {
    style: &quot;currency&quot;,
    currency: &quot;CAD&quot;
  }).format(Number.isFinite(number) ? number : 0);
}

function toast(message, type = &quot;&quot;) {
  const el = $(&quot;toast&quot;);
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${type}`.trim();
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() =&gt; el.className = &quot;toast&quot;, 3200);
}

function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add(&quot;open&quot;);
  el.setAttribute(&quot;aria-hidden&quot;, &quot;false&quot;);
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove(&quot;open&quot;);
  el.setAttribute(&quot;aria-hidden&quot;, &quot;true&quot;);
}

async function requireOwner() {
  if (!db) throw new Error(&quot;Supabase client is unavailable.&quot;);

  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    location.href = &quot;login.html&quot;;
    return;
  }

  state.session = sessionData.session;

  const { data: profile, error } = await db
    .from(&quot;users&quot;)
    .select(&quot;id,auth_user_id,full_name,email,role,active,company_id&quot;)
    .eq(&quot;auth_user_id&quot;, state.session.user.id)
    .single();

  if (error || !profile) throw new Error(&quot;Owner profile could not be loaded.&quot;);
  if (profile.active !== true) throw new Error(&quot;This owner account is inactive.&quot;);
  if (String(profile.role).toLowerCase() !== &quot;owner&quot;) {
    location.href = String(profile.role).toLowerCase() === &quot;cleaner&quot;
      ? &quot;cleaner-dashboard.html&quot;
      : &quot;manager-dashboard.html&quot;;
    return;
  }

  state.profile = profile;
  if ($(&quot;sidebarUserName&quot;)) $(&quot;sidebarUserName&quot;).textContent =
    profile.full_name || profile.email || state.session.user.email;
}

async function loadProperties() {
  const { data, error } = await db
    .from(&quot;property_members&quot;)
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
    .eq(&quot;user_id&quot;, state.profile.id)
    .eq(&quot;active&quot;, true);

  if (error) throw error;

  state.properties = (data || [])
    .map(row =&gt; row.properties)
    .filter(Boolean)
    .filter(property =&gt; property.active !== false);

  if (!state.properties.length) {
    throw new Error(&quot;No properties are assigned to this owner account.&quot;);
  }

  const select = $(&quot;propertySelect&quot;);
  if (select) {
    select.innerHTML = state.properties.map(property =&gt;
      `&lt;option value=&quot;${esc(property.id)}&quot;&gt;${esc(property.property_name)}&lt;/option&gt;`
    ).join(&quot;&quot;);
  }

  const requested = new URLSearchParams(location.search).get(&quot;property_id&quot;);
  const saved = localStorage.getItem(&quot;nsc_owner_property_id&quot;);
  state.selectedProperty =
    state.properties.find(p =&gt; p.id === requested) ||
    state.properties.find(p =&gt; p.id === saved) ||
    state.properties[0];

  if (select) select.value = state.selectedProperty.id;
  localStorage.setItem(&quot;nsc_owner_property_id&quot;, state.selectedProperty.id);
  renderPropertyHeader();
}

function renderPropertyHeader() {
  const p = state.selectedProperty;
  const address = [p.address, p.city, p.province, p.postal_code].filter(Boolean).join(&quot;, &quot;);
  if ($(&quot;selectedPropertyAddress&quot;)) $(&quot;selectedPropertyAddress&quot;).textContent = address;
}

async function loadTurnovers() {
  const { data, error } = await db
    .from(&quot;turnovers&quot;)
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
    .eq(&quot;property_id&quot;, state.selectedProperty.id)
    .order(&quot;turnover_date&quot;, { ascending: false })
    .order(&quot;scheduled_start&quot;, { ascending: false });

  if (error) throw error;
  state.turnovers = data || [];
}

async function loadIssues() {
  const { data, error } = await db
    .from(&quot;issues&quot;)
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
    .eq(&quot;property_id&quot;, state.selectedProperty.id)
    .order(&quot;created_at&quot;, { ascending: false });

  if (error) throw error;
  state.issues = data || [];
}

async function loadInventory() {
  const { data: items, error: itemError } = await db
    .from(&quot;inventory_items&quot;)
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
    .eq(&quot;property_id&quot;, state.selectedProperty.id)
    .eq(&quot;active&quot;, true)
    .order(&quot;sort_order&quot;, { ascending: true });

  if (itemError) throw itemError;
  state.inventoryItems = items || [];

  const ids = state.turnovers.map(t =&gt; t.id);
  if (!ids.length) {
    state.inventoryCounts = [];
    return;
  }

  const { data: counts, error: countError } = await db
    .from(&quot;inventory_counts&quot;)
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
    .in(&quot;turnover_id&quot;, ids)
    .order(&quot;counted_at&quot;, { ascending: false });

  if (countError) throw countError;
  state.inventoryCounts = counts || [];
}

async function loadPhotos() {
  const ids = state.turnovers.map(t =&gt; t.id);
  if (!ids.length) {
    state.photos = [];
    return;
  }

  const { data, error } = await db
    .from(&quot;photos&quot;)
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
    .in(&quot;turnover_id&quot;, ids)
    .order(&quot;created_at&quot;, { ascending: false });

  if (error) throw error;
  state.photos = data || [];

  await Promise.all(state.photos.map(async photo =&gt; {
    if (!photo.storage_path) return;
    const { data: signed } = await db.storage
      .from(&quot;turnover-photos&quot;)
      .createSignedUrl(photo.storage_path, 3600);
    photo.preview_url = signed?.signedUrl || null;
  }));
}

async function loadReports() {
  const ids = state.turnovers.map(t =&gt; t.id);
  if (!ids.length) {
    state.reports = [];
    return;
  }

  const { data, error } = await db
    .from(&quot;reports&quot;)
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
    .in(&quot;turnover_id&quot;, ids)
    .order(&quot;created_at&quot;, { ascending: false });

  if (error) throw error;
  state.reports = data || [];

  await Promise.all(state.reports.map(async report =&gt; {
    if (!report.storage_path) return;
    const { data: signed } = await db.storage
      .from(&quot;turnover-reports&quot;)
      .createSignedUrl(report.storage_path, 3600);
    report.preview_url = signed?.signedUrl || null;
  }));
}

async function loadNotifications() {
  const { data, error } = await db
    .from(&quot;notifications&quot;)
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
    .eq(&quot;recipient_user_id&quot;, state.profile.id)
    .or(`property_id.eq.${state.selectedProperty.id},property_id.is.null`)
    .order(&quot;created_at&quot;, { ascending: false })
    .limit(100);

  if (error) throw error;
  state.notifications = data || [];
}

async function loadFinance() {
  const { data, error } = await db
    .from(&quot;finance_revenue&quot;)
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
    .eq(&quot;property_id&quot;, state.selectedProperty.id)
    .order(&quot;invoice_date&quot;, { ascending: false });

  if (error) throw error;
  state.invoices = data || [];
}

function latestCounts() {
  const result = new Map();
  state.inventoryCounts.forEach(count =&gt; {
    if (!result.has(count.inventory_item_id)) result.set(count.inventory_item_id, count);
  });
  return result;
}

function taskComplete(task) {
  return [&quot;completed&quot;, &quot;done&quot;, &quot;approved&quot;].includes(key(task.task_status));
}

function progress(turnover) {
  const tasks = turnover.turnover_tasks || [];
  if (!tasks.length) return 0;
  return Math.round(tasks.filter(taskComplete).length / tasks.length * 100);
}

function renderCalendar() {
  if (!$(&quot;calendarGrid&quot;)) return;

  const month = state.calendarDate;
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  $(&quot;calendarMonth&quot;).textContent = formatDate(first, { month: &quot;long&quot;, year: &quot;numeric&quot; });

  const grouped = new Map();
  state.turnovers.forEach(turnover =&gt; {
    const d = dateKey(turnover.turnover_date || turnover.scheduled_start);
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d).push(turnover);
  });

  const today = dateKey(new Date());
  const html = [];

  for (let i = 0; i &lt; 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const d = dateKey(day);
    const events = grouped.get(d) || [];

    html.push(`
      &lt;div class=&quot;calendar-day ${day.getMonth() !== first.getMonth() ? &quot;outside&quot; : &quot;&quot;} ${d === today ? &quot;today&quot; : &quot;&quot;}&quot;&gt;
        &lt;div class=&quot;day-number&quot;&gt;${day.getDate()}&lt;/div&gt;
        &lt;div class=&quot;day-events&quot;&gt;
          ${events.slice(0, 3).map(turnover =&gt; `
            &lt;button class=&quot;calendar-event status-${esc(key(turnover.status))}&quot;
              data-turnover-id=&quot;${esc(turnover.id)}&quot; type=&quot;button&quot;&gt;
              ${esc(formatTime(turnover.scheduled_start) || label(turnover.status))}
            &lt;/button&gt;
          `).join(&quot;&quot;)}
          ${events.length &gt; 3 ? `&lt;div class=&quot;calendar-more&quot;&gt;+${events.length - 3} more&lt;/div&gt;` : &quot;&quot;}
        &lt;/div&gt;
      &lt;/div&gt;
    `);
  }

  $(&quot;calendarGrid&quot;).innerHTML = html.join(&quot;&quot;);
  $(&quot;calendarGrid&quot;).querySelectorAll(&quot;[data-turnover-id]&quot;).forEach(button =&gt; {
    button.onclick = () =&gt; location.href =
      `owner-turnover.html?id=${encodeURIComponent(button.dataset.turnoverId)}`;
  });
}

function renderUpcoming() {
  if (!$(&quot;upcomingCleans&quot;)) return;
  const today = dateKey(new Date());

  const rows = state.turnovers
    .filter(t =&gt; dateKey(t.turnover_date || t.scheduled_start) &gt;= today)
    .filter(t =&gt; key(t.status) !== &quot;cancelled&quot;)
    .sort((a, b) =&gt; new Date(a.scheduled_start || a.turnover_date) - new Date(b.scheduled_start || b.turnover_date))
    .slice(0, 8);

  $(&quot;upcomingCleans&quot;).innerHTML = rows.length ? rows.map(t =&gt; `
    &lt;button class=&quot;list-row row-button&quot; type=&quot;button&quot; data-turnover-id=&quot;${esc(t.id)}&quot;&gt;
      &lt;p class=&quot;row-title&quot;&gt;${esc(formatDate(t.turnover_date, { weekday: &quot;short&quot;, month: &quot;short&quot;, day: &quot;numeric&quot; }))}&lt;/p&gt;
      &lt;p class=&quot;row-meta&quot;&gt;${esc(formatTime(t.scheduled_start) || &quot;Time not set&quot;)} · ${esc(t.users?.full_name || &quot;Cleaner not assigned&quot;)}&lt;/p&gt;
      &lt;span class=&quot;status-pill status-${esc(key(t.status))}&quot;&gt;${esc(label(t.status))}&lt;/span&gt;
    &lt;/button&gt;
  `).join(&quot;&quot;) : `&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No upcoming cleans&lt;/strong&gt;&lt;/div&gt;`;

  $(&quot;upcomingCleans&quot;).querySelectorAll(&quot;[data-turnover-id]&quot;).forEach(button =&gt; {
    button.onclick = () =&gt; location.href =
      `owner-turnover.html?id=${encodeURIComponent(button.dataset.turnoverId)}`;
  });
}

function currentTurnover() {
  const active = state.turnovers.find(t =&gt; key(t.status) === &quot;in_progress&quot;);
  if (active) return active;

  return state.turnovers
    .filter(t =&gt; ![&quot;cancelled&quot;, &quot;completed&quot;].includes(key(t.status)))
    .sort((a, b) =&gt; new Date(a.scheduled_start || a.turnover_date) - new Date(b.scheduled_start || b.turnover_date))[0] || null;
}

function showChecklist(turnover) {
  const tasks = turnover.turnover_tasks || [];
  const grouped = new Map();

  tasks.forEach(task =&gt; {
    const room = task.rooms?.room_name || task.section_name || &quot;General&quot;;
    if (!grouped.has(room)) grouped.set(room, []);
    grouped.get(room).push(task);
  });

  const photos = state.photos.filter(p =&gt; p.turnover_id === turnover.id &amp;&amp; p.preview_url);

  $(&quot;checklistModalBody&quot;).innerHTML = `
    ${[...grouped.entries()].map(([room, roomTasks]) =&gt; `
      &lt;section class=&quot;checklist-room&quot;&gt;
        &lt;div class=&quot;checklist-room-header&quot;&gt;
          &lt;span&gt;${esc(room)}&lt;/span&gt;
          &lt;span&gt;${roomTasks.filter(taskComplete).length}/${roomTasks.length}&lt;/span&gt;
        &lt;/div&gt;
        ${roomTasks.map(task =&gt; `
          &lt;div class=&quot;checklist-task&quot;&gt;
            &lt;span class=&quot;task-check&quot;&gt;${taskComplete(task) ? &quot;✓&quot; : &quot;&quot;}&lt;/span&gt;
            &lt;span&gt;${esc(task.task_text)}&lt;/span&gt;
            &lt;span class=&quot;status-pill status-${esc(key(task.task_status))}&quot;&gt;${esc(label(task.task_status))}&lt;/span&gt;
          &lt;/div&gt;
        `).join(&quot;&quot;)}
      &lt;/section&gt;
    `).join(&quot;&quot;)}
    ${photos.length ? `
      &lt;div class=&quot;photo-grid&quot;&gt;
        ${photos.map(photo =&gt; `
          &lt;a class=&quot;photo-card&quot; href=&quot;${esc(photo.preview_url)}&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;&gt;
            &lt;div class=&quot;photo-preview&quot;&gt;&lt;img src=&quot;${esc(photo.preview_url)}&quot; alt=&quot;${esc(photo.caption || &quot;Cleaning photo&quot;)}&quot;&gt;&lt;/div&gt;
          &lt;/a&gt;
        `).join(&quot;&quot;)}
      &lt;/div&gt;
    ` : &quot;&quot;}
  `;
  openModal(&quot;checklistModal&quot;);
}

function renderLiveProgress() {
  if (!$(&quot;liveProgressContent&quot;)) return;
  const turnover = currentTurnover();

  if (!turnover) {
    $(&quot;liveTurnoverTitle&quot;).textContent = &quot;&quot;;
    $(&quot;liveProgressContent&quot;).innerHTML = `&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No active cleaning&lt;/strong&gt;&lt;/div&gt;`;
    return;
  }

  const percent = progress(turnover);
  $(&quot;liveTurnoverTitle&quot;).textContent =
    formatDate(turnover.turnover_date, { weekday: &quot;long&quot;, month: &quot;long&quot;, day: &quot;numeric&quot; });

  $(&quot;liveProgressContent&quot;).innerHTML = `
    &lt;div class=&quot;live-progress-grid&quot;&gt;
      &lt;div&gt;
        &lt;p class=&quot;row-title&quot;&gt;${esc(turnover.users?.full_name || &quot;Cleaner not assigned&quot;)}&lt;/p&gt;
        &lt;p class=&quot;row-meta&quot;&gt;Status: ${esc(label(turnover.status))}&lt;/p&gt;
        &lt;p class=&quot;row-meta&quot;&gt;Check-in: ${esc(formatTime(turnover.check_in_time) || &quot;Not checked in&quot;)}&lt;/p&gt;
      &lt;/div&gt;
      &lt;div&gt;
        &lt;p class=&quot;progress-value&quot;&gt;${percent}%&lt;/p&gt;
        &lt;div class=&quot;progress-track&quot;&gt;&lt;span style=&quot;width:${percent}%&quot;&gt;&lt;/span&gt;&lt;/div&gt;
      &lt;/div&gt;
      &lt;button class=&quot;button button-secondary&quot; id=&quot;viewChecklistButton&quot; type=&quot;button&quot;&gt;View Live Checklist&lt;/button&gt;
    &lt;/div&gt;
  `;

  $(&quot;viewChecklistButton&quot;).onclick = () =&gt; showChecklist(turnover);
}

function renderIssues() {
  if (!$(&quot;issuesList&quot;)) return;
  const rows = state.issues.filter(i =&gt; ![&quot;resolved&quot;, &quot;closed&quot;].includes(key(i.issue_status)));

  $(&quot;issuesList&quot;).innerHTML = rows.length ? rows.map(issue =&gt; `
    &lt;div class=&quot;list-row&quot;&gt;
      &lt;p class=&quot;row-title&quot;&gt;${esc(issue.title || issue.issue_type || &quot;Reported issue&quot;)}&lt;/p&gt;
      &lt;p class=&quot;row-meta&quot;&gt;${esc(issue.rooms?.room_name || &quot;General&quot;)} · ${esc(label(issue.urgency))}&lt;/p&gt;
      &lt;p class=&quot;row-meta&quot;&gt;${esc(issue.description || &quot;&quot;)}&lt;/p&gt;
      &lt;span class=&quot;status-pill status-${esc(key(issue.issue_status))}&quot;&gt;${esc(label(issue.issue_status))}&lt;/span&gt;
    &lt;/div&gt;
  `).join(&quot;&quot;) : `&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No open issues&lt;/strong&gt;&lt;/div&gt;`;
}

function renderInventory() {
  if (!$(&quot;inventoryList&quot;)) return;
  const latest = latestCounts();

  $(&quot;inventoryList&quot;).innerHTML = state.inventoryItems.length ? state.inventoryItems.map(item =&gt; {
    const count = latest.get(item.id);
    const quantity = count?.quantity_remaining;
    const status = count?.stock_status || count?.level_status || &quot;not_counted&quot;;

    return `
      &lt;div class=&quot;inventory-row&quot;&gt;
        &lt;div&gt;
          &lt;p class=&quot;row-title&quot;&gt;${esc(item.item_name)}&lt;/p&gt;
          &lt;p class=&quot;row-meta&quot;&gt;${quantity == null ? &quot;Not counted&quot; : `${esc(quantity)} ${esc(item.unit_name)}`}&lt;/p&gt;
          &lt;p class=&quot;row-meta&quot;&gt;Target ${esc(item.target_quantity ?? &quot;—&quot;)} · Amber ${esc(item.amber_quantity ?? &quot;—&quot;)} · Minimum ${esc(item.minimum_quantity)}&lt;/p&gt;
        &lt;/div&gt;
        &lt;span class=&quot;status-pill status-${esc(key(status))}&quot;&gt;${esc(label(status))}&lt;/span&gt;
      &lt;/div&gt;
    `;
  }).join(&quot;&quot;) : `&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No inventory items&lt;/strong&gt;&lt;/div&gt;`;
}

function renderMessagesUnavailable() {
  if (!$(&quot;messageThread&quot;)) return;
  $(&quot;messageThread&quot;).innerHTML = `
    &lt;div class=&quot;empty-state&quot;&gt;
      &lt;strong&gt;Messaging is not configured yet&lt;/strong&gt;
      &lt;span&gt;A proper property-messages table must be added before messages can be sent.&lt;/span&gt;
    &lt;/div&gt;
  `;
  if ($(&quot;messageInput&quot;)) {
    $(&quot;messageInput&quot;).disabled = true;
    $(&quot;messageInput&quot;).placeholder = &quot;Messaging will be enabled after the messages table is created.&quot;;
  }
  const button = $(&quot;messageForm&quot;)?.querySelector(&quot;button[type=&#x27;submit&#x27;]&quot;);
  if (button) button.disabled = true;
}

function renderNotifications() {
  if (!$(&quot;notificationsList&quot;)) return;

  $(&quot;notificationsList&quot;).innerHTML = state.notifications.length ? state.notifications.map(n =&gt; `
    &lt;div class=&quot;notification-item&quot;&gt;
      &lt;span class=&quot;notification-dot&quot;&gt;&lt;/span&gt;
      &lt;div&gt;
        &lt;p class=&quot;row-title&quot;&gt;${esc(n.title)}&lt;/p&gt;
        &lt;p class=&quot;row-meta&quot;&gt;${esc(n.message)}&lt;/p&gt;
        &lt;p class=&quot;row-meta&quot;&gt;${esc(formatDate(n.created_at, { month: &quot;short&quot;, day: &quot;numeric&quot;, hour: &quot;numeric&quot;, minute: &quot;2-digit&quot; }))}&lt;/p&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  `).join(&quot;&quot;) : `&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No owner notifications&lt;/strong&gt;&lt;/div&gt;`;
}

async function submitCleaningRequest() {
  const date = $(&quot;requestDate&quot;)?.value;
  const time = $(&quot;requestTime&quot;)?.value;
  const notes = $(&quot;requestNotes&quot;)?.value.trim();

  if (!date || !notes) return;

  const scheduledStart = time ? new Date(`${date}T${time}:00`).toISOString() : null;

  const { error } = await db.from(&quot;turnovers&quot;).insert({
    company_id: state.selectedProperty.company_id,
    property_id: state.selectedProperty.id,
    turnover_date: date,
    scheduled_start: scheduledStart,
    status: &quot;requested&quot;,
    priority: &quot;normal&quot;,
    final_notes: notes,
    owner_approval_status: &quot;pending&quot;,
    created_by: state.profile.id,
    attendance_status: &quot;pending&quot;,
    needs_reassignment: false
  });

  if (error) {
    toast(error.message, &quot;error&quot;);
    return;
  }

  closeModal(&quot;requestCleaningModal&quot;);
  $(&quot;requestCleaningForm&quot;).reset();
  toast(&quot;Cleaning request submitted.&quot;, &quot;success&quot;);
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
  const rows = state.turnovers.filter(t =&gt; key(t.status) === &quot;completed&quot;);
  $(&quot;sectionContent&quot;).innerHTML = rows.length ? `
    &lt;div class=&quot;card&quot;&gt;
      &lt;div class=&quot;table-wrap&quot;&gt;
        &lt;table&gt;
          &lt;thead&gt;&lt;tr&gt;&lt;th&gt;Date&lt;/th&gt;&lt;th&gt;Cleaner&lt;/th&gt;&lt;th&gt;Status&lt;/th&gt;&lt;th&gt;Progress&lt;/th&gt;&lt;th&gt;&lt;/th&gt;&lt;/tr&gt;&lt;/thead&gt;
          &lt;tbody&gt;
            ${rows.map(t =&gt; `
              &lt;tr&gt;
                &lt;td&gt;${esc(formatDate(t.turnover_date, { month: &quot;short&quot;, day: &quot;numeric&quot;, year: &quot;numeric&quot; }))}&lt;/td&gt;
                &lt;td&gt;${esc(t.users?.full_name || &quot;—&quot;)}&lt;/td&gt;
                &lt;td&gt;&lt;span class=&quot;status-pill status-${esc(key(t.status))}&quot;&gt;${esc(label(t.status))}&lt;/span&gt;&lt;/td&gt;
                &lt;td&gt;${progress(t)}%&lt;/td&gt;
                &lt;td&gt;&lt;button class=&quot;button button-secondary button-small&quot; data-turnover-id=&quot;${esc(t.id)}&quot;&gt;Open&lt;/button&gt;&lt;/td&gt;
              &lt;/tr&gt;
            `).join(&quot;&quot;)}
          &lt;/tbody&gt;
        &lt;/table&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  ` : `&lt;div class=&quot;card&quot;&gt;&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No completed turnovers&lt;/strong&gt;&lt;/div&gt;&lt;/div&gt;`;

  $(&quot;sectionContent&quot;).querySelectorAll(&quot;[data-turnover-id]&quot;).forEach(button =&gt; {
    button.onclick = () =&gt; location.href = `owner-turnover.html?id=${encodeURIComponent(button.dataset.turnoverId)}`;
  });
}

function renderReportsTab() {
  const search = state.search.toLowerCase();
  const rows = state.reports.filter(report =&gt;
    !search || `${report.report_type} ${report.report_number}`.toLowerCase().includes(search)
  );

  $(&quot;sectionContent&quot;).innerHTML = rows.length ? `
    &lt;div class=&quot;document-grid&quot;&gt;
      ${rows.map(report =&gt; `
        &lt;article class=&quot;document-card&quot;&gt;
          &lt;div class=&quot;document-card-top&quot;&gt;
            &lt;div&gt;
              &lt;p class=&quot;document-title&quot;&gt;${esc(report.report_number || label(report.report_type))}&lt;/p&gt;
              &lt;p class=&quot;document-meta&quot;&gt;${esc(formatDate(report.generated_at || report.created_at, { month: &quot;short&quot;, day: &quot;numeric&quot;, year: &quot;numeric&quot; }))}&lt;/p&gt;
            &lt;/div&gt;
          &lt;/div&gt;
          &lt;div class=&quot;document-actions&quot;&gt;
            ${report.preview_url ? `&lt;a class=&quot;button button-secondary button-small&quot; href=&quot;${esc(report.preview_url)}&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;&gt;Open&lt;/a&gt;` : &quot;&quot;}
          &lt;/div&gt;
        &lt;/article&gt;
      `).join(&quot;&quot;)}
    &lt;/div&gt;
  ` : `&lt;div class=&quot;card&quot;&gt;&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No reports found&lt;/strong&gt;&lt;/div&gt;&lt;/div&gt;`;
}

function renderPhotosTab() {
  const rows = state.photos.filter(photo =&gt; photo.preview_url);
  $(&quot;sectionContent&quot;).innerHTML = rows.length ? `
    &lt;div class=&quot;photo-grid&quot;&gt;
      ${rows.map(photo =&gt; `
        &lt;a class=&quot;photo-card&quot; href=&quot;${esc(photo.preview_url)}&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;&gt;
          &lt;div class=&quot;photo-preview&quot;&gt;&lt;img src=&quot;${esc(photo.preview_url)}&quot; alt=&quot;${esc(photo.caption || &quot;Cleaning photo&quot;)}&quot;&gt;&lt;/div&gt;
          &lt;div class=&quot;photo-info&quot;&gt;
            &lt;p class=&quot;photo-title&quot;&gt;${esc(photo.caption || photo.file_name || label(photo.photo_type))}&lt;/p&gt;
            &lt;p class=&quot;photo-meta&quot;&gt;${esc(formatDate(photo.taken_at || photo.created_at, { month: &quot;short&quot;, day: &quot;numeric&quot;, year: &quot;numeric&quot; }))}&lt;/p&gt;
          &lt;/div&gt;
        &lt;/a&gt;
      `).join(&quot;&quot;)}
    &lt;/div&gt;
  ` : `&lt;div class=&quot;card&quot;&gt;&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No photos found&lt;/strong&gt;&lt;/div&gt;&lt;/div&gt;`;
}

function renderInvoicesTab() {
  const rows = state.invoices || [];
  $(&quot;sectionContent&quot;).innerHTML = rows.length ? `
    &lt;div class=&quot;card&quot;&gt;
      &lt;div class=&quot;table-wrap&quot;&gt;
        &lt;table&gt;
          &lt;thead&gt;&lt;tr&gt;&lt;th&gt;Invoice&lt;/th&gt;&lt;th&gt;Date&lt;/th&gt;&lt;th&gt;Total&lt;/th&gt;&lt;th&gt;Paid&lt;/th&gt;&lt;th&gt;Balance&lt;/th&gt;&lt;th&gt;Status&lt;/th&gt;&lt;/tr&gt;&lt;/thead&gt;
          &lt;tbody&gt;
            ${rows.map(invoice =&gt; `
              &lt;tr&gt;
                &lt;td class=&quot;primary-cell&quot;&gt;${esc(invoice.invoice_number)}&lt;/td&gt;
                &lt;td&gt;${esc(formatDate(invoice.invoice_date, { month: &quot;short&quot;, day: &quot;numeric&quot;, year: &quot;numeric&quot; }))}&lt;/td&gt;
                &lt;td&gt;${esc(formatMoney(invoice.invoice_total))}&lt;/td&gt;
                &lt;td&gt;${esc(formatMoney(invoice.amount_paid))}&lt;/td&gt;
                &lt;td&gt;${esc(formatMoney(invoice.outstanding_balance))}&lt;/td&gt;
                &lt;td&gt;&lt;span class=&quot;status-pill status-${esc(key(invoice.invoice_status))}&quot;&gt;${esc(label(invoice.invoice_status))}&lt;/span&gt;&lt;/td&gt;
              &lt;/tr&gt;
            `).join(&quot;&quot;)}
          &lt;/tbody&gt;
        &lt;/table&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  ` : `&lt;div class=&quot;card&quot;&gt;&lt;div class=&quot;empty-state&quot;&gt;&lt;strong&gt;No invoices found&lt;/strong&gt;&lt;/div&gt;&lt;/div&gt;`;
}

async function renderDocumentsTab() {
  if (!$(&quot;sectionContent&quot;)) return;
  if (state.activeTab === &quot;turnovers&quot; || state.activeTab === &quot;checklists&quot;) renderTurnoversTab();
  else if (state.activeTab === &quot;photos&quot;) renderPhotosTab();
  else if ([&quot;reports&quot;, &quot;documents&quot;, &quot;agreements&quot;].includes(state.activeTab)) renderReportsTab();
  else if (state.activeTab === &quot;invoices&quot;) renderInvoicesTab();
}

function bindCommon() {
  $(&quot;signOutButton&quot;)?.addEventListener(&quot;click&quot;, async () =&gt; {
    await db.auth.signOut();
    location.href = &quot;login.html&quot;;
  });

  $(&quot;mobileMenuButton&quot;)?.addEventListener(&quot;click&quot;, () =&gt; $(&quot;sidebar&quot;)?.classList.toggle(&quot;open&quot;));

  document.querySelectorAll(&quot;[data-close-modal]&quot;).forEach(button =&gt; {
    button.addEventListener(&quot;click&quot;, () =&gt; closeModal(button.dataset.closeModal));
  });

  $(&quot;propertySelect&quot;)?.addEventListener(&quot;change&quot;, async event =&gt; {
    state.selectedProperty = state.properties.find(p =&gt; p.id === event.target.value);
    localStorage.setItem(&quot;nsc_owner_property_id&quot;, state.selectedProperty.id);
    renderPropertyHeader();

    if ($(&quot;calendarGrid&quot;)) await loadDashboardData();
    if ($(&quot;sectionContent&quot;)) {
      await loadDocumentsData();
      await renderDocumentsTab();
    }
  });
}

async function initDashboard() {
  bindCommon();
  await requireOwner();
  await loadProperties();

  $(&quot;previousMonthButton&quot;)?.addEventListener(&quot;click&quot;, () =&gt; {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });

  $(&quot;nextMonthButton&quot;)?.addEventListener(&quot;click&quot;, () =&gt; {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });

  $(&quot;requestCleaningButton&quot;)?.addEventListener(&quot;click&quot;, () =&gt; openModal(&quot;requestCleaningModal&quot;));
  $(&quot;requestCleaningForm&quot;)?.addEventListener(&quot;submit&quot;, async event =&gt; {
    event.preventDefault();
    await submitCleaningRequest();
  });

  $(&quot;addInventoryButton&quot;)?.remove();
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

  $(&quot;searchInput&quot;)?.addEventListener(&quot;input&quot;, event =&gt; {
    state.search = event.target.value;
    renderDocumentsTab();
  });

  $(&quot;tabs&quot;)?.addEventListener(&quot;click&quot;, event =&gt; {
    const button = event.target.closest(&quot;[data-tab]&quot;);
    if (!button) return;
    state.activeTab = button.dataset.tab;
    $(&quot;tabs&quot;).querySelectorAll(&quot;[data-tab]&quot;).forEach(tab =&gt;
      tab.classList.toggle(&quot;active&quot;, tab === button)
    );
    renderDocumentsTab();
  });

  await renderDocumentsTab();
}

(async () =&gt; {
  try {
    if ($(&quot;calendarGrid&quot;)) await initDashboard();
    else if ($(&quot;sectionContent&quot;)) await initDocuments();
  } catch (error) {
    console.error(error);
    const content = document.querySelector(&quot;.content&quot;);
    if (content) {
      content.innerHTML = `
        &lt;div class=&quot;card&quot;&gt;
          &lt;div class=&quot;error-state&quot;&gt;
            &lt;strong&gt;Owner portal could not load&lt;/strong&gt;
            &lt;span&gt;${esc(error.message || error)}&lt;/span&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      `;
    }
  }
})();
</pre>
  </main>

  <script>
    document.getElementById("copyButton").addEventListener("click", async () => {
      const code = document.getElementById("code").textContent;
      await navigator.clipboard.writeText(code);
      const button = document.getElementById("copyButton");
      button.textContent = "Copied";
      setTimeout(() => button.textContent = "Copy All Code", 1800);
    });
  </script>
</body>
</html>
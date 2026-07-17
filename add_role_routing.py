from pathlib import Path

LOGIN = Path("login.html")
MANAGER = Path("manager-dashboard.html")
CLEANER = Path("cleaner-dashboard.html")
OWNER = Path("owner-dashboard.html")

# ---------------------------------------------------------
# 1. Patch login.html
# ---------------------------------------------------------

login = LOGIN.read_text()

old_login_redirect = '''  statusMessage.textContent = "Login successful. Opening dashboard...";

 setTimeout(function () {

  window.location.href = "manager-dashboard.html";

 }, 500);'''

new_login_redirect = '''  statusMessage.textContent = "Checking account access...";

  const { data: profile, error: profileError } = await window.nscSupabase
    .from("users")
    .select("full_name, role, active")
    .eq("auth_user_id", data.user.id)
    .single();

  if (profileError || !profile) {
    await window.nscSupabase.auth.signOut();
    statusMessage.textContent =
      "Your login exists, but no NSC CleanOps user profile was found.";
    return;
  }

  if (profile.active !== true) {
    await window.nscSupabase.auth.signOut();
    statusMessage.textContent = "This user account is inactive.";
    return;
  }

  const role = String(profile.role || "").toLowerCase();

  statusMessage.textContent = "Login successful. Opening dashboard...";

  setTimeout(function () {
    if (role === "cleaner") {
      window.location.href = "cleaner-dashboard.html";
      return;
    }

    if (role === "owner") {
      window.location.href = "owner-dashboard.html";
      return;
    }

    if (role === "admin") {
      window.location.href = "manager-dashboard.html";
      return;
    }

    window.nscSupabase.auth.signOut();
    statusMessage.textContent = "This account has an unsupported user role.";
  }, 400);'''

if old_login_redirect not in login:
    raise SystemExit("ERROR: Login redirect section was not found.")

login = login.replace(old_login_redirect, new_login_redirect, 1)
LOGIN.write_text(login)

# ---------------------------------------------------------
# 2. Patch manager-dashboard.html
# ---------------------------------------------------------

manager = MANAGER.read_text()

old_manager_select = '.select("full_name, company_id, active")'
new_manager_select = '.select("full_name, company_id, role, active")'

if old_manager_select not in manager:
    raise SystemExit("ERROR: Manager profile query was not found.")

manager = manager.replace(old_manager_select, new_manager_select, 1)

old_manager_active = '''  if (!profile.active) {

  throw new Error("This user account is inactive.");

  }

  const firstName'''

new_manager_active = '''  if (!profile.active) {

  throw new Error("This user account is inactive.");

  }

  const role = String(profile.role || "").toLowerCase();

  if (role === "cleaner") {
    window.location.href = "cleaner-dashboard.html";
    return;
  }

  if (role === "owner") {
    window.location.href = "owner-dashboard.html";
    return;
  }

  if (role !== "admin") {
    await db.auth.signOut();
    window.location.href = "login.html";
    return;
  }

  const firstName'''

if old_manager_active not in manager:
    raise SystemExit("ERROR: Manager active-account section was not found.")

manager = manager.replace(old_manager_active, new_manager_active, 1)
MANAGER.write_text(manager)

# ---------------------------------------------------------
# 3. Add role protection to cleaner-dashboard.html
# ---------------------------------------------------------

cleaner = CLEANER.read_text()

guard_script = '''
<script>
(async function protectCleanerDashboard() {
  const db = window.nscSupabase || window.supabaseClient;

  if (!db) {
    window.location.href = "login.html";
    return;
  }

  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();

  const session = sessionData?.session;

  if (sessionError || !session) {
    window.location.href = "login.html";
    return;
  }

  const { data: profile, error: profileError } = await db
    .from("users")
    .select("role, active")
    .eq("auth_user_id", session.user.id)
    .single();

  if (profileError || !profile || profile.active !== true) {
    await db.auth.signOut();
    window.location.href = "login.html";
    return;
  }

  const role = String(profile.role || "").toLowerCase();

  if (role === "admin") {
    window.location.href = "manager-dashboard.html";
    return;
  }

  if (role === "owner") {
    window.location.href = "owner-dashboard.html";
    return;
  }

  if (role !== "cleaner") {
    await db.auth.signOut();
    window.location.href = "login.html";
  }
})();
</script>
'''

marker = '<script src="supabase-client.js"></script>'

if guard_script.strip() not in cleaner:
    if marker not in cleaner:
        raise SystemExit("ERROR: Supabase script marker was not found in cleaner-dashboard.html.")

    cleaner = cleaner.replace(marker, marker + guard_script, 1)

CLEANER.write_text(cleaner)

# ---------------------------------------------------------
# 4. Create temporary owner dashboard
# ---------------------------------------------------------

OWNER.write_text('''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Client Dashboard | NSC CleanOps</title>

  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f4f8fb;
      color: #17324d;
    }

    header {
      background: #0b2f4f;
      color: white;
      padding: 20px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    main {
      max-width: 900px;
      margin: 60px auto;
      padding: 0 24px;
    }

    .card {
      background: white;
      border: 1px solid #dce6ee;
      border-radius: 14px;
      padding: 32px;
      box-shadow: 0 12px 30px rgba(11, 47, 79, 0.08);
    }

    button {
      background: #0b2f4f;
      color: white;
      border: 0;
      border-radius: 8px;
      padding: 12px 18px;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>

<body>
  <header>
    <strong>NSC CleanOps</strong>
    <button id="logoutButton" type="button">Sign Out</button>
  </header>

  <main>
    <section class="card">
      <h1>Client Dashboard</h1>
      <p id="message">Loading your account.</p>
      <p>
        The full client portal will be added later. This temporary page
        prevents client accounts from accessing internal management pages.
      </p>
    </section>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="supabase-client.js"></script>

  <script>
    const db = window.nscSupabase || window.supabaseClient;

    async function initializeOwnerDashboard() {
      const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

      const session = sessionData?.session;

      if (sessionError || !session) {
        window.location.href = "login.html";
        return;
      }

      const { data: profile, error: profileError } = await db
        .from("users")
        .select("full_name, role, active")
        .eq("auth_user_id", session.user.id)
        .single();

      if (profileError || !profile || profile.active !== true) {
        await db.auth.signOut();
        window.location.href = "login.html";
        return;
      }

      const role = String(profile.role || "").toLowerCase();

      if (role === "admin") {
        window.location.href = "manager-dashboard.html";
        return;
      }

      if (role === "cleaner") {
        window.location.href = "cleaner-dashboard.html";
        return;
      }

      if (role !== "owner") {
        await db.auth.signOut();
        window.location.href = "login.html";
        return;
      }

      document.getElementById("message").textContent =
        `Welcome, ${profile.full_name || "Client"}.`;
    }

    document
      .getElementById("logoutButton")
      .addEventListener("click", async () => {
        await db.auth.signOut();
        window.location.href = "login.html";
      });

    initializeOwnerDashboard().catch(async error => {
      console.error(error);
      await db.auth.signOut();
      window.location.href = "login.html";
    });
  </script>
</body>
</html>
''')

print("SUCCESS: Role-based routing was added.")
print("- Admin -> manager-dashboard.html")
print("- Cleaner -> cleaner-dashboard.html")
print("- Owner -> owner-dashboard.html")
print("- Manager dashboard protected")
print("- Cleaner dashboard protected")
print("- Temporary owner dashboard created")

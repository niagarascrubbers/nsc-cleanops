from pathlib import Path

file_path = Path("login.html")
content = file_path.read_text()

old = '''    statusMessage.textContent = "Login successful. Opening dashboard...";

setTimeout(function () {
  window.location.href = "manager-dashboard.html";
}, 500);'''

new = '''    statusMessage.textContent = "Checking account access...";

    const { data: profile, error: profileError } =
      await window.nscSupabase
        .from("users")
        .select("full_name, role, active")
        .eq("auth_user_id", data.user.id)
        .single();

    if (profileError || !profile) {
      await window.nscSupabase.auth.signOut();
      statusMessage.textContent =
        "Your login exists, but your NSC CleanOps profile was not found.";
      return;
    }

    if (profile.active !== true) {
      await window.nscSupabase.auth.signOut();
      statusMessage.textContent = "This account is inactive.";
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
      statusMessage.textContent = "This account has an unsupported role.";
    }, 500);'''

if old not in content:
    raise SystemExit("ERROR: Exact login redirect code was not found.")

content = content.replace(old, new, 1)
file_path.write_text(content)

print("SUCCESS: login.html now routes users by role.")
print("- admin -> manager-dashboard.html")
print("- cleaner -> cleaner-dashboard.html")
print("- owner -> owner-dashboard.html")

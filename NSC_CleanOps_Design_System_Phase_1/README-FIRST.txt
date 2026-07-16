NSC CLEANOPS — DESIGN SYSTEM PHASE 1

WHAT THIS PACKAGE DOES
- Adds reusable CSS design tokens and shared UI components.
- Adds reusable JavaScript for the mobile sidebar, slide-over panels, modals, and toast notifications.
- Includes design-system-preview.html so the design can be tested safely.
- Does not replace or alter login.html, manager-dashboard.html, index.html, or supabase-client.js.
- Does not change Supabase or authentication.

UPLOAD STRUCTURE
Place these items in the root of the nsc-cleanops GitHub repository:

assets/
design-system-preview.html

GitHub should show:

nsc-cleanops/
  assets/
    css/
      variables.css
      base.css
      layout.css
      components.css
      forms.css
      tables.css
      panels.css
    js/
      ui.js
  design-system-preview.html
  index.html
  login.html
  manager-dashboard.html
  supabase-client.js

TEST URL
After Netlify deploys, open:

https://YOUR-NETLIFY-SITE.netlify.app/design-system-preview.html

IMPORTANT
Do not rename or delete the existing working files.
This preview uses sample data and does not save to Supabase.
The next phase will connect the Properties module to the existing database.

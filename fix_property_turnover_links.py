from pathlib import Path
import sys

path = Path("property.html")

if not path.exists():
    print("ERROR: property.html was not found in the current folder.")
    print("Run this script from inside the nsc-cleanops folder.")
    sys.exit(1)

text = path.read_text(encoding="utf-8")
original = text

sidebar_old = '''<a class="nav-link" href="#">
          <span class="nav-icon">□</span>
          Turnovers
        </a>'''

sidebar_new = '''<a class="nav-link" href="turnovers.html">
          <span class="nav-icon">TO</span>
          Turnovers
        </a>'''

text = text.replace(sidebar_old, sidebar_new)

tab_old = '''<button class="tab-link" type="button" data-placeholder-tab="turnovers">Turnovers</button>'''

tab_new = '''<button class="tab-link" type="button" onclick="window.location.href='turnovers.html'">Turnovers</button>'''

text = text.replace(tab_old, tab_new)

build_tab_old = '${buildTabButton("turnovers", "Turnovers")}'
build_tab_new = '''<button class="tab-link" type="button" onclick="window.location.href='turnovers.html'">Turnovers</button>'''

text = text.replace(build_tab_old, build_tab_new)

if text == original:
    print("No changes were made.")
    print("The expected Turnovers placeholders were not found in property.html.")
    sys.exit(2)

path.write_text(text, encoding="utf-8")

print("SUCCESS: property.html was updated.")
print("- Sidebar Turnovers now opens turnovers.html")
print("- Property Turnovers tab now opens turnovers.html")

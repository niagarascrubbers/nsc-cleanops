from pathlib import Path
import re
import sys

path = Path("properties.html")

if not path.exists():
    print("ERROR: properties.html was not found in the current folder.")
    print("Run this script from inside the nsc-cleanops folder.")
    sys.exit(1)

text = path.read_text(encoding="utf-8")
original = text

patterns = [
    (
        r'<a class="nav-link" href="#">\s*<span class="nav-icon">[^<]*</span>\s*Turnovers\s*</a>',
        '<a class="nav-link" href="turnovers.html">\n          <span class="nav-icon">TO</span>\n          Turnovers\n        </a>'
    ),
    (
        r'<a href="#">Turnovers</a>',
        '<a href="turnovers.html">Turnovers</a>'
    )
]

for pattern, replacement in patterns:
    text = re.sub(pattern, replacement, text, count=1, flags=re.MULTILINE)

if text == original:
    print("No changes were made.")
    print("The Turnovers placeholder was not found in properties.html.")
    sys.exit(2)

path.write_text(text, encoding="utf-8")

print("SUCCESS: properties.html was updated.")
print("- Properties page Turnovers link now opens turnovers.html")

import re
import os

filepath = 'backend/scenarios/hasselt_xl/osm.net.xml.tmp'
if not os.path.exists(filepath):
    print(f"File {filepath} not found")
    exit(1)

print(f"Sanitizing {filepath}...")
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix vehicle classes by removing unsupported ones (just in case)
unsupported = ['container', 'cable_car', 'subway', 'aircraft', 'wheelchair', 'scooter', 'drone']
for uc in unsupported:
    content = content.replace(uc, ' ')

# Clean up spaces in allow/disallow attributes
def clean_spaces(match):
    attr = match.group(1)
    values = match.group(2)
    # Split by any whitespace and join with a single space
    cleaned_values = " ".join(values.split())
    return f' {attr}="{cleaned_values}"'

content = re.sub(r' (disallow|allow)="([^"]*)"', clean_spaces, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Sanitization complete.")

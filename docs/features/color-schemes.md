# Color Schemes

ACoord provides customizable color schemes for atom visualization.

## Built-in Color Schemes

ACoord includes preset color schemes:

- **Bright** — Modern, vibrant colors
- **Jmol** — Traditional Jmol colors

## Using Color Schemes

### Select Scheme

1. Open the **Colors** panel in the sidebar
2. Select a scheme from the dropdown (Bright, Jmol, or custom)
3. Colors update for the current brush

### Apply to Selected Atoms

1. Select atoms in the 3D view
2. Click **Apply** in the Brush panel (left toolbar)
3. Atom colors update permanently

> **Note:** Atoms must be selected before clicking Apply.

## Custom Color Schemes

### Save Current Colors as Scheme

1. Open the **Colors** panel
2. Click **Save As...** button
3. Enter a name for the scheme

### Import/Export Schemes

**Export:**
1. Open the **Colors** panel
2. Select scheme in dropdown
3. Click **Export** button

**Import:**
1. Open the **Colors** panel
2. Click **Import** button
3. Select `.json` file

### Delete Custom Scheme

1. Open the **Colors** panel
2. Select the custom scheme in dropdown
3. Click **Delete** button

## Color Scheme Format

```json
{
  "name": "My Scheme",
  "colors": {
    "H": "#FFFFFF",
    "C": "#909090",
    "N": "#3050F8",
    "O": "#FF0D0D"
  },
  "description": "Custom color scheme"
}
```

Use standard element symbols (`H`, `C`, `N`, `O`, `Fe`, etc.) and CSS hex colors (`#RRGGBB`).

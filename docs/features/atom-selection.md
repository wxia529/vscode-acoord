# Atom Selection

ACoord provides atom selection tools for analysis and editing.

## Selection Methods

### Single Selection

- Click on an atom to select it
- Selected atom highlights with glow effect
- Info appears in Properties panel

### Multi-Selection

- Hold **Ctrl/Cmd** + click to add/remove atoms from selection
- All selected atoms highlight
- Panel shows combined info

### Box Selection

1. Ensure **Select** tool is active (press `V` or click Select button in left toolbar)
2. Click and drag in empty space (not on an atom)
3. A selection box appears
4. Release to select all atoms inside
5. Hold **Ctrl/Cmd** while releasing to add to selection
6. Hold **Alt** while releasing to subtract from selection

### Deselect

- Click in empty space
- Or press **Esc**

## Selection Info

The Properties panel displays:

- **Element** — Atom type
- **Position** — Cartesian coordinates (x, y, z)
- **Distance** — Between 2 selected atoms
- **Angle** — Between 3 selected atoms

## Selection Actions

Once atoms are selected, you can:

- **Delete** — Press Delete key
- **Move** — Drag to new position
- **Copy** — Ctrl+C, then Ctrl+V to paste
- **Recolor** — Use color picker in Colors panel

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Click | Select single atom |
| Ctrl/Cmd+click | Add/remove from selection |
| Ctrl+A | Select all atoms |
| Ctrl+I | Invert selection |
| Esc | Deselect all |
| Delete/Backspace | Delete selected |
| Ctrl+C | Copy selected atoms |
| Ctrl+V | Paste atoms |
| `A` | Enter add atom mode |
| `D` | Delete mode |
| `V` | Select mode |

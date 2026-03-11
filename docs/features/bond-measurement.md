# Bond Measurement

ACoord provides automatic bond detection and interactive measurement tools.

## Automatic Bond Detection

Bonds are automatically calculated based on:

- **Interatomic distance** — Atoms within threshold distance
- **Element types** — Covalent radius consideration
- **Bonding criteria** — Element-specific bonding radii

## Bond Operations

### Create Bond

1. Select two atoms (Ctrl/Cmd+click)
2. Right-click → **Create Bond**
3. Bond appears immediately

### Delete Bond

1. Click on a bond to select it
2. Press **Delete** or **Backspace**
3. Or right-click → **Delete Bond**

### Recalculate Bonds

- Click **Calculate Bonds** in the toolbar
- Or right-click in canvas → **Calculate Bonds**
- Bonds are recalculated based on current atom positions

### Clear All Bonds

- Right-click in canvas → **Clear All Bonds**

## Distance Measurement

### Measure Distance

1. Select first atom (click)
2. Hold **Ctrl/Cmd**, select second atom
3. Distance displays in the Properties panel

### Measure Angle

1. Select three atoms (Ctrl/Cmd+click)
2. Angle displays in the Properties panel
3. Angle is measured at the middle atom

### Units

- **Distance:** Angstroms (Å)
- **Angle:** Degrees (°)

## Common Bond Lengths

Reference values (Å):

| Bond | Typical Length |
|------|----------------|
| C-C | 1.54 |
| C=C | 1.34 |
| C≡C | 1.20 |
| C-H | 1.09 |
| O-H | 0.96 |
| N-H | 1.01 |
| Si-O | 1.61 |

> **Note:** Actual values depend on chemical environment

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl/Cmd+click | Add/remove atom from selection |
| Ctrl+A | Select all atoms |
| Ctrl+I | Invert selection |
| Delete/Backspace | Delete selected atoms/bonds |

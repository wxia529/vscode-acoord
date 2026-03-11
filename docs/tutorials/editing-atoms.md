# Editing Atoms

This tutorial covers how to edit atomic structures in ACoord.

## Adding Atoms

### Method 1: Keyboard Shortcut

1. Press `A` to enter add atom mode
2. Type the element symbol (e.g., "C", "H", "O")
3. Click in the 3D canvas to place the atom
4. Press `Esc` to exit add mode

### Method 2: Right-Click Menu

1. Right-click in the 3D canvas
2. Navigate to **Add atom** submenu
3. Select the element
4. Atom is added at the click position

### Method 3: Quick Add Panel

1. Locate the **Quick Add** section in the Properties panel
2. Enter element symbol and coordinates (x, y, z)
3. Click **Add**

## Deleting Atoms

1. Select the atom(s) to delete
2. Press **Delete** or **Backspace**
3. Or right-click → **Delete atom**

## Moving Atoms

### Drag to Move

- **Left-click and drag** on an atom to move it in the viewing plane

### Precise Position

1. Select the atom
2. In the Properties panel, enter exact X, Y, Z coordinates
3. Click **Apply**

### Move Multiple Atoms

- Select atoms, then **right-click + Shift + Alt + drag**

### Rotate Selection

- Select atoms, then **right-click + Shift + drag** to rotate around center

## Copying Atoms

1. Select atom(s)
2. Press **Ctrl+C** (or right-click → Copy)
3. Press **Ctrl+V** to paste
4. New atoms appear at offset position

## Changing Atom Properties

### Change Element

1. Select the atom
2. Right-click → **Change element** → select new element
3. Color and radius update automatically

### Change Color

1. Select the atom(s)
2. Right-click → **Set color...**
3. Choose a new color

> **Note:** Custom colors are saved only in `.acoord` format

## Undo and Redo

- **Undo:** Ctrl+Z (or Cmd+Z on macOS)
- **Redo:** Ctrl+Y (or Cmd+Y on macOS)

## Saving Edits

- **Save:** Ctrl+S (or click Save button in toolbar)
- **Save As:** Click **Save As** button, choose format

For full fidelity (preserving colors, labels, etc.), save as `.acoord` format.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `A` | Enter add atom mode |
| `D` | Delete mode |
| `V` | Select mode |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save |
| `Ctrl+C` | Copy selected atoms |
| `Ctrl+V` | Paste atoms |
| `Delete/Backspace` | Delete selected |
| `Esc` | Cancel current operation |

# 3D Visualization

ACoord provides 3D visualization of atomic structures using Three.js (WebGL).

## Navigation

### Rotate View

- **Left-click and drag** in empty space
- Rotates the camera around the structure

### Pan View

- **Right-click and drag** in empty space
- Moves the camera horizontally/vertically

### Zoom

- **Scroll wheel** up/down
- Moves camera closer/farther

### Reset View

- Click the **Reset** button in the toolbar
- Centers and fits all atoms in view

## Moving and Rotating Atoms

### Move Single Atom

- **Left-click and drag** on an atom
- Moves the atom in the viewing plane

### Move Multiple Atoms

- Select atoms, then **right-click + Shift + Alt + drag**
- Moves all selected atoms together

### Rotate Selection

- Select atoms, then **right-click + Shift + drag**
- Rotates selected atoms around their center

## Atom Rendering

Atoms are rendered as spheres with:

- Element-specific colors (based on color scheme)
- Configurable radius
- Smooth shading

See [Color Schemes](/features/color-schemes) for details.

## Bond Rendering

### Automatic Detection

Bonds are automatically calculated based on interatomic distance and element types.

### Bond Operations

- **Create bond:** Select two atoms → Right-click → Create Bond
- **Delete bond:** Click on bond → Press Delete
- **Recalculate:** Click Calculate Bonds in toolbar
- **Clear all:** Right-click → Clear All Bonds
- **Adjust thickness:** Use bond thickness slider in **Size & Style** panel

See [Bond Measurement](/features/bond-measurement) for details.

## Lighting

ACoord supports multiple light types:

| Type | Description |
|------|-------------|
| Ambient | Uniform base illumination |
| Key | Main directional light |
| Fill | Secondary light to fill shadows |
| Rim | Edge highlighting from behind |

### Adjusting Lighting

1. Open the **Lighting** panel
2. Adjust individual light intensity and color
3. Click **Pick in Canvas** to set light direction by dragging in 3D view

## Background

Change background color in the **Colors** panel using the Background color picker.

## Export Images

1. Set up desired view
2. Click the **Export** button in the toolbar
3. High-resolution PNG (4x scale) is generated

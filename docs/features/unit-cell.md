# Unit Cell Editor

ACoord provides tools for editing crystal unit cells and generating supercells.

## Unit Cell Basics

A unit cell is defined by:

- **Lengths:** a, b, c (in Angstroms)
- **Angles:** α, β, γ (in degrees)

## Editing Lattice Parameters

1. Open **Lattice** panel in the sidebar
2. Enter values for a, b, c, α, β, γ
3. Check/uncheck **Scale atoms with lattice**
   - Checked: atoms move with cell (preserves fractional coordinates)
   - Unchecked: atoms stay fixed (preserves Cartesian coordinates)
4. Click **Apply Lattice**

Click **Remove Lattice** to remove the unit cell from the structure.

## Supercell Display

1. Open **Lattice** panel
2. Enter supercell dimensions (Nx, Ny, Nz)
3. Click **Apply Supercell**

The display shows periodic images of atoms. Use cases include defect calculations, surface models, and visualization of periodicity.

## Centering Atoms

1. Click **Center At Cell** button in the Lattice panel
2. Confirm the operation
3. All atoms are translated so the geometric center aligns with the cell center

This operation can be undone with Ctrl+Z.

## Unit Cell Style

Customize appearance in the **Size & Style** panel:

- **Color:** Change unit cell edge color
- **Thickness:** Adjust line thickness (0.5-6)
- **Line style:** Solid or dashed

## Crystal Systems

ACoord supports all 7 crystal systems:

| System | Parameters | Example |
|--------|------------|---------|
| Cubic | a=b=c, α=β=γ=90° | Si, NaCl |
| Tetragonal | a=b≠c, α=β=γ=90° | TiO₂ |
| Orthorhombic | a≠b≠c, α=β=γ=90° | FeB |
| Hexagonal | a=b≠c, α=β=90°, γ=120° | ZnO |
| Rhombohedral | a=b=c, α=β=γ≠90° | α-Al₂O₃ |
| Monoclinic | a≠b≠c, α=γ=90°≠β | SiO₂ |
| Triclinic | a≠b≠c, α≠β≠γ | K₂Cr₂O₇ |

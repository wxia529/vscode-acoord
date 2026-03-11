# Working with Trajectories

This tutorial shows how to visualize molecular dynamics trajectories.

## Opening Trajectory Files

### Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| VASP XDATCAR | `XDATCAR`, `.xdatcar` | VASP MD trajectory |
| Multi-frame XYZ | `.xyz` | XYZ with multiple frames |
| VASP OUTCAR | `OUTCAR`, `.outcar` | VASP output with ionic steps |

### Open a Trajectory

1. Open the trajectory file in VS Code
2. ACoord detects multiple frames
3. The **Trajectory** panel appears
4. First frame loads automatically

## Trajectory Panel

### Playback Controls

| Button | Action |
|--------|--------|
| \|< | Go to first frame |
| < | Previous frame |
| Play | Play animation |
| > | Next frame |
| >\| | Go to last frame |

### Frame Navigation

- Enter frame number in the input box and press Enter
- Or use Previous/Next buttons

### Playback Speed

- Use the **Speed** slider (1-30 fps)
- Higher = faster playback

## Analyzing Trajectories

### Track Atom Movement

1. Select an atom in the first frame
2. Play the trajectory
3. Selection persists across frames

### Measure Bond Evolution

1. Select two atoms
2. Play the trajectory
3. Distance updates each frame

## Exporting Frames

### Export Current Frame

1. Navigate to desired frame
2. Click **Save As** button in toolbar
3. Choose format (POSCAR, XYZ, etc.)

### Export HD Image

1. Navigate to desired frame
2. Click the **Export** button in toolbar

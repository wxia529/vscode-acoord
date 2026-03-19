import * as vscode from 'vscode';
import * as path from 'path';
import { Structure } from '../models/structure.js';
import { FileManager } from '../io/fileManager.js';

/**
 * Handles all file I/O for structure documents: loading, saving in-place, and
 * saving to a user-chosen destination.  The class is intentionally stateless —
 * it receives the data it needs as parameters so it can be unit-tested without
 * a running VS Code instance.
 */
export class StructureDocumentManager {

  /**
   * Read and parse a structure file.  Returns every frame found in the file.
   * Throws if the file cannot be read or parsed.
   */
  static async load(uri: vscode.Uri): Promise<Structure[]> {
    const raw = await vscode.workspace.fs.readFile(uri);
    const content = new TextDecoder().decode(raw);
    return FileManager.loadStructures(uri.fsPath, content);
  }

  /**
   * Write the current structure (or all frames for multi-frame formats) back
   * to its original file path.
   */
  static async save(
    fsPath: string,
    structure: Structure,
    frames: Structure[]
  ): Promise<void> {
    if (FileManager.isReadOnlyFormat(fsPath)) {
      const ext = path.extname(fsPath).slice(1).toLowerCase() || path.basename(fsPath);
      throw new Error(
        `Cannot save to read-only format (${ext}). Use "Save As..." to export to a different format.`
      );
    }
    const format = FileManager.resolveFormat(fsPath, 'xyz');
    if (format === 'xyz' && frames.length > 1) {
      for (const frame of frames) {
        FileManager.ensureStructureName(frame, fsPath);
      }
    } else {
      FileManager.ensureStructureName(structure, fsPath);
    }
    const content =
      format === 'xyz' && frames.length > 1
        ? FileManager.saveStructures(frames, format)
        : FileManager.saveStructure(structure, format);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(fsPath),
      new TextEncoder().encode(content)
    );
  }

/**
   * Write frames to a user-chosen destination URI.
   * For multi-frame formats (xyz, xdatcar) the caller should already have
   * resolved which frames to export.
   * @param destination - The target URI to save to
   * @param exportFrames - The frames to save
   * @param format - The explicit format to use (e.g., 'xyz', 'poscar', 'cif')
   */
  static async saveAs(
    destination: vscode.Uri,
    exportFrames: Structure[],
    format: string
  ): Promise<void> {
    if (FileManager.isReadOnlyFormat(destination.fsPath)) {
      const ext = path.extname(destination.fsPath).slice(1).toLowerCase() || path.basename(destination.fsPath);
      throw new Error(
        `Cannot save to read-only format (${ext}). Choose a different format.`
      );
    }
    const resolvedFormat = FileManager.resolveFormat(format, 'xyz');
    const isMultiFrame =
      (resolvedFormat === 'xyz' || resolvedFormat === 'xdatcar') && exportFrames.length > 1;

    if (isMultiFrame) {
      for (const frame of exportFrames) {
        FileManager.ensureStructureName(frame, destination.fsPath);
      }
    }
    FileManager.ensureStructureName(exportFrames[0], destination.fsPath);

    const content = isMultiFrame
      ? FileManager.saveStructures(exportFrames, resolvedFormat)
      : FileManager.saveStructure(exportFrames[0], resolvedFormat);

    await vscode.workspace.fs.writeFile(
      destination,
      new TextEncoder().encode(content)
    );
  }

  /**
   * Show a quick-pick asking the user whether to export the current frame or
   * the whole trajectory.  Returns `null` if the user cancelled.
   */
  static async pickTrajectoryExportFrames(
    frames: Structure[],
    currentStructure: Structure,
    currentIndex: number,
    formatLabel: string
  ): Promise<Structure[] | null> {
    if (frames.length <= 1) {
      return [currentStructure];
    }
    const selected = await vscode.window.showQuickPick(
      [
        {
          id: 'current',
          label: `Current Frame (${currentIndex + 1}/${frames.length})`,
        },
        {
          id: 'all',
          label: `Whole Trajectory (${frames.length} frames)`,
        },
      ],
      {
        placeHolder: `Select ${formatLabel} export scope`,
        ignoreFocusOut: true,
      }
    );
    if (!selected) {
      return null;
    }
    return selected.id === 'all' ? frames : [currentStructure];
  }

  /** Return the default file name (without directory) for "Save As". */
  static defaultSaveAsFileName(sourceFsPath: string, format: string): string {
    const baseName = path.basename(sourceFsPath, path.extname(sourceFsPath));
    const noExtensionFormats = ['poscar', 'vasp', 'stru'];
    const isNoExtensionFormat = noExtensionFormats.includes(format.toLowerCase());
    return isNoExtensionFormat
      ? baseName || 'structure'
      : `${baseName || 'structure'}.${format}`;
  }
}

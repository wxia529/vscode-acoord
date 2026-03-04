import * as vscode from 'vscode';
import * as path from 'path';
import { Structure } from '../models/structure';
import { FileManager } from '../io/fileManager';
import { StructureDocumentManager } from '../providers/structureDocumentManager';
import { TrajectoryManager } from '../providers/trajectoryManager';

export class DocumentService {
  async saveStructure(key: string, activeStructure: Structure, frames: Structure[]): Promise<void> {
    try {
      await StructureDocumentManager.save(key, activeStructure, frames);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async saveStructureAs(
    key: string,
    activeStructure: Structure,
    trajectoryFrames: Structure[],
    traj: TrajectoryManager
  ): Promise<void> {
    const formatOptions = [
      { id: 'cif', label: 'CIF (.cif)' },
      { id: 'xyz', label: 'XYZ (.xyz)' },
      { id: 'xdatcar', label: 'XDATCAR (.xdatcar)' },
      { id: 'poscar', label: 'POSCAR' },
      { id: 'vasp', label: 'VASP (.vasp)' },
      { id: 'pdb', label: 'PDB (.pdb)' },
      { id: 'gjf', label: 'Gaussian input (.gjf)' },
      { id: 'inp', label: 'ORCA input (.inp)' },
      { id: 'in', label: 'QE input (.in)' },
      { id: 'stru', label: 'ABACUS STRU (.stru)' },
    ];

    const selected = await vscode.window.showQuickPick(formatOptions, {
      placeHolder: 'Select export format',
      matchOnDescription: true,
      ignoreFocusOut: true,
    });

    if (!selected) {
      return;
    }

    const selectedFormat = selected.id;
    let exportFrames: Structure[] = [activeStructure];

    if ((selectedFormat === 'xyz' || selectedFormat === 'xdatcar') && trajectoryFrames.length > 1) {
      const chosen = await StructureDocumentManager.pickTrajectoryExportFrames(
        trajectoryFrames,
        activeStructure,
        traj.activeIndex,
        selectedFormat.toUpperCase()
      );
      if (!chosen) {
        return;
      }
      exportFrames = chosen;
    }

    const defaultFileName = StructureDocumentManager.defaultSaveAsFileName(key, selectedFormat);
    const isPoscarFormat = ['poscar', 'vasp'].includes(selectedFormat.toLowerCase());

    const saveOptions: vscode.SaveDialogOptions = {
      saveLabel: 'Save Structure As',
      defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(key)), defaultFileName),
    };

    if (!isPoscarFormat) {
      saveOptions.filters = {
        'Structure Files': [selectedFormat],
      };
    }

    const uri = await vscode.window.showSaveDialog(saveOptions);
    if (!uri) {
      return;
    }

    try {
      await StructureDocumentManager.saveAs(uri, exportFrames);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async saveRenderedImage(
    dataUrl: string,
    suggestedName: string,
    postMessage: (msg: unknown) => void,
    getTitle: () => string
  ): Promise<void> {
    const imageMatch = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!imageMatch || !imageMatch[1]) {
      const reason = 'Failed to export image: invalid PNG data.';
      vscode.window.showErrorMessage(reason);
      postMessage({ command: 'imageSaveFailed', data: { reason } });
      return;
    }

    const rawName =
      typeof suggestedName === 'string' && suggestedName.trim()
        ? suggestedName.trim()
        : `structure-hd-${Date.now()}.png`;
    const fileName = rawName.toLowerCase().endsWith('.png') ? rawName : `${rawName}.png`;

    const saveUri = await vscode.window.showSaveDialog({
      saveLabel: 'Save HD Image',
      defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(getTitle())), fileName),
      filters: {
        'PNG Image': ['png'],
      },
    });

    if (!saveUri) {
      return;
    }

    try {
      const bytes = Buffer.from(imageMatch[1], 'base64');
      await vscode.workspace.fs.writeFile(saveUri, bytes);
      const savedName = path.basename(saveUri.fsPath);
      vscode.window.showInformationMessage(`Image exported to ${savedName}`);
      postMessage({
        command: 'imageSaved',
        data: { fileName: savedName },
      });
    } catch (error) {
      const reason = `Failed to export image: ${error instanceof Error ? error.message : String(error)}`;
      vscode.window.showErrorMessage(reason);
      postMessage({ command: 'imageSaveFailed', data: { reason } });
    }
  }

  async openSource(key: string): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(key));
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open source: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async reloadStructure(
    key: string,
    traj: TrajectoryManager,
    undoManager: any,
    renderer: any
  ): Promise<void> {
    try {
      const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(key));
      const content = new TextDecoder().decode(fileContent);
      const updatedFrames = FileManager.loadStructures(key, content);
      
      if (!updatedFrames || updatedFrames.length === 0) {
        return;
      }

      const idx = TrajectoryManager.defaultFrameIndex(updatedFrames);
      traj.set(updatedFrames, idx);
      undoManager.clear();
      renderer.setStructure(updatedFrames[idx]);
      renderer.setTrajectoryFrameInfo(idx, updatedFrames.length);
      renderer.setShowUnitCell(!!updatedFrames[idx].unitCell);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

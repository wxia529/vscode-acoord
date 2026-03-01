import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Structure } from '../models/structure';
import { UnitCell } from '../models/unitCell';
import { FileManager } from '../io/fileManager';
import { ThreeJSRenderer } from '../renderers/threejsRenderer';
import { Atom } from '../models/atom';
import { parseElement } from '../utils/elementData';

/**
 * Custom editor provider for structure files
 */
export class StructureEditorProvider implements vscode.CustomEditorProvider {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<vscode.CustomDocument> |
      vscode.CustomDocumentContentChangeEvent<vscode.CustomDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  private webviewPanels = new Map<string, vscode.WebviewPanel>();
  private renderers = new Map<string, ThreeJSRenderer>();
  private structures = new Map<string, Structure>();
  private trajectories = new Map<string, Structure[]>();
  private trajectoryFrameIndices = new Map<string, number>();
  private undoStacks = new Map<string, Structure[]>();
  private readonly maxUndoDepth = 100;

  constructor(private context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<any> {
    return { uri };
  }

  async resolveCustomEditor(
    document: any,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri.fsPath;

    // Try to load structure from file
    let frames: Structure[];
    try {
      const fileContent = await vscode.workspace.fs.readFile(document.uri);
      const content = new TextDecoder().decode(fileContent);
      frames = FileManager.loadStructures(uri, content);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load structure: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    if (!frames || frames.length === 0) {
      vscode.window.showErrorMessage('Failed to load structure: no frame found.');
      return;
    }
    const initialFrameIndex = this.getDefaultTrajectoryFrameIndex(frames);
    const structure = frames[initialFrameIndex];

    // Store references
    const key = uri;
    this.setTrajectoryState(key, frames, initialFrameIndex);
    this.undoStacks.set(key, []);
    this.webviewPanels.set(key, webviewPanel);

    const renderer = new ThreeJSRenderer(structure);
    renderer.setTrajectoryFrameInfo(initialFrameIndex, frames.length);
    this.renderers.set(key, renderer);

    // Setup webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview);

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message, key, webviewPanel),
      undefined,
      this.context.subscriptions
    );

    const saveListener = vscode.workspace.onDidSaveTextDocument(
      async (savedDoc) => {
        if (savedDoc.uri.fsPath !== key) {
          return;
        }
        try {
          const content = savedDoc.getText();
          const updatedFrames = FileManager.loadStructures(key, content);
          if (!updatedFrames || updatedFrames.length === 0) {
            return;
          }
          const initialFrameIndex = this.getDefaultTrajectoryFrameIndex(updatedFrames);
          this.setTrajectoryState(key, updatedFrames, initialFrameIndex);
          this.undoStacks.set(key, []);
          renderer.setStructure(updatedFrames[initialFrameIndex]);
          renderer.setShowUnitCell(!!updatedFrames[initialFrameIndex].unitCell);
          renderer.setTrajectoryFrameInfo(initialFrameIndex, updatedFrames.length);
          renderer.deselectAtom();
          renderer.deselectBond();
          this.renderStructure(key, webviewPanel);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // Initial render
    this.renderStructure(key, webviewPanel);

    // Cleanup on close
    webviewPanel.onDidDispose(() => {
      this.webviewPanels.delete(key);
      this.renderers.delete(key);
      this.structures.delete(key);
      this.trajectories.delete(key);
      this.trajectoryFrameIndices.delete(key);
      this.undoStacks.delete(key);
      saveListener.dispose();
    });
  }

  private async handleWebviewMessage(
    message: any,
    key: string,
    webviewPanel: vscode.WebviewPanel
  ) {
    const renderer = this.renderers.get(key);
    const structure = this.structures.get(key);
    if (!renderer || !structure) {
      return;
    }

    switch (message.command) {
      case 'getState':
        this.renderStructure(key, webviewPanel);
        break;

      case 'setTrajectoryFrame': {
        const frames = this.trajectories.get(key) || [];
        if (frames.length <= 1) {
          break;
        }
        const requestedIndex = Number(message.frameIndex);
        if (!Number.isFinite(requestedIndex)) {
          break;
        }
        const nextIndex = Math.max(0, Math.min(frames.length - 1, Math.floor(requestedIndex)));
        this.trajectoryFrameIndices.set(key, nextIndex);
        const nextStructure = frames[nextIndex];
        this.structures.set(key, nextStructure);
        renderer.setStructure(nextStructure);
        renderer.setShowUnitCell(!!nextStructure.unitCell);
        renderer.setTrajectoryFrameInfo(nextIndex, frames.length);
        renderer.deselectAtom();
        renderer.deselectBond();
        this.undoStacks.set(key, []);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'beginDrag':
        if (message.atomId) {
          this.pushUndoSnapshot(key, structure);
        }
        break;

      case 'addAtom': {
        const element = parseElement(String(message.element || ''));
        if (!element) {
          vscode.window.showErrorMessage(`Unknown element: ${message.element}`);
          break;
        }
        const atom = new Atom(
          element,
          message.x || 0,
          message.y || 0,
          message.z || 0
        );
        this.pushUndoSnapshot(key, structure);
        structure.addAtom(atom);
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'deleteAtom': {
        if (message.atomId) {
          this.pushUndoSnapshot(key, structure);
          structure.removeAtom(message.atomId);
          renderer.setStructure(structure);
          renderer.deselectAtom();
          renderer.deselectBond();
          this.renderStructure(key, webviewPanel);
        }
        break;
      }

      case 'selectAtom': {
        if (message.atomId) {
          if (message.add) {
            const current = renderer.getState().selectedAtomIds || [];
            const exists = current.includes(message.atomId);
            const next = exists
              ? current.filter((id) => id !== message.atomId)
              : [...current, message.atomId];
            renderer.setSelection(next);
          } else {
            renderer.selectAtom(message.atomId);
          }
          renderer.deselectBond();
          this.renderStructure(key, webviewPanel);
        }
        break;
      }

      case 'setSelection': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        renderer.setSelection(ids);
        renderer.deselectBond();
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'selectBond': {
        const bondKey = typeof message.bondKey === 'string' && message.bondKey.trim()
          ? message.bondKey.trim()
          : undefined;
        if (message.add && bondKey) {
          const current = renderer.getState().selectedBondKeys || [];
          const next = current.includes(bondKey)
            ? current.filter((key) => key !== bondKey)
            : [...current, bondKey];
          renderer.setBondSelection(next);
        } else {
          renderer.selectBond(bondKey);
        }
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setBondSelection': {
        const keys: string[] = Array.isArray(message.bondKeys)
          ? message.bondKeys.filter((key: unknown) => typeof key === 'string')
          : [];
        renderer.setBondSelection(keys);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'toggleUnitCell': {
        renderer.setShowUnitCell(
          !renderer.getState().showUnitCell
        );
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setUnitCell': {
        const params = message.params || {};
        const a = Number(params.a);
        const b = Number(params.b);
        const c = Number(params.c);
        const alpha = Number(params.alpha);
        const beta = Number(params.beta);
        const gamma = Number(params.gamma);
        const isValid =
          [a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value)) &&
          a > 0 &&
          b > 0 &&
          c > 0 &&
          alpha > 0 &&
          beta > 0 &&
          gamma > 0 &&
          alpha < 180 &&
          beta < 180 &&
          gamma < 180;

        if (!isValid) {
          vscode.window.showErrorMessage('Invalid lattice parameters.');
          break;
        }

        this.pushUndoSnapshot(key, structure);
        const oldCell = structure.unitCell;
        const nextCell = new UnitCell(a, b, c, alpha, beta, gamma);
        if (message.scaleAtoms && oldCell) {
          for (const atom of structure.atoms) {
            const frac = oldCell.cartesianToFractional(atom.x, atom.y, atom.z);
            const cart = nextCell.fractionalToCartesian(frac[0], frac[1], frac[2]);
            atom.setPosition(cart[0], cart[1], cart[2]);
          }
        }
        structure.unitCell = nextCell;
        structure.isCrystal = true;
        if (!structure.supercell) {
          structure.supercell = [1, 1, 1];
        }
        renderer.setStructure(structure);
        renderer.setShowUnitCell(true);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'clearUnitCell': {
        this.pushUndoSnapshot(key, structure);
        structure.unitCell = undefined;
        structure.isCrystal = false;
        structure.supercell = [1, 1, 1];
        renderer.setStructure(structure);
        renderer.setShowUnitCell(false);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'centerToUnitCell': {
        if (!structure.unitCell) {
          vscode.window.showErrorMessage('Centering requires a unit cell.');
          break;
        }
        if (structure.atoms.length === 0) {
          break;
        }
        const confirm = await vscode.window.showWarningMessage(
          'Center all atoms in the unit cell? This will move every atom.',
          { modal: true },
          'Center'
        );
        if (confirm !== 'Center') {
          break;
        }
        this.pushUndoSnapshot(key, structure);
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (const atom of structure.atoms) {
          cx += atom.x;
          cy += atom.y;
          cz += atom.z;
        }
        const count = structure.atoms.length;
        const geomCenter: [number, number, number] = [cx / count, cy / count, cz / count];
        const vectors = structure.unitCell.getLatticeVectors();
        const cellCenter: [number, number, number] = [
          0.5 * (vectors[0][0] + vectors[1][0] + vectors[2][0]),
          0.5 * (vectors[0][1] + vectors[1][1] + vectors[2][1]),
          0.5 * (vectors[0][2] + vectors[1][2] + vectors[2][2]),
        ];
        const dx = cellCenter[0] - geomCenter[0];
        const dy = cellCenter[1] - geomCenter[1];
        const dz = cellCenter[2] - geomCenter[2];
        structure.translate(dx, dy, dz);
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setSupercell': {
        const sc = Array.isArray(message.supercell) ? message.supercell : [1, 1, 1];
        const nx = Math.max(1, Math.floor(Number(sc[0]) || 1));
        const ny = Math.max(1, Math.floor(Number(sc[1]) || 1));
        const nz = Math.max(1, Math.floor(Number(sc[2]) || 1));
        if (!structure.unitCell) {
          structure.supercell = [1, 1, 1];
        } else {
          structure.supercell = [nx, ny, nz];
        }
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'moveAtom': {
        if (message.atomId) {
          const atom = structure.getAtom(message.atomId);
          if (atom) {
            atom.setPosition(message.x, message.y, message.z);
            renderer.setStructure(structure);
            if (!message.preview) {
              this.renderStructure(key, webviewPanel);
            }
          }
        }
        break;
      }

      case 'moveGroup': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length > 0) {
          for (const id of ids) {
            const atom = structure.getAtom(id);
            if (atom) {
              atom.setPosition(atom.x + message.dx, atom.y + message.dy, atom.z + message.dz);
            }
          }
          renderer.setStructure(structure);
          if (!message.preview) {
            this.renderStructure(key, webviewPanel);
          }
        }
        break;
      }

      case 'setAtomsPositions': {
        const updates: Array<{ id: string; x: number; y: number; z: number }> =
          Array.isArray(message.atomPositions) ? message.atomPositions : [];
        if (updates.length === 0) {
          break;
        }
        for (const update of updates) {
          const atom = structure.getAtom(update.id);
          if (atom) {
            atom.setPosition(update.x, update.y, update.z);
          }
        }
        renderer.setStructure(structure);
        if (!message.preview) {
          this.renderStructure(key, webviewPanel);
        }
        break;
      }

      case 'endDrag': {
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setBondLength': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length >= 2 && typeof message.length === 'number') {
          const atomA = structure.getAtom(ids[0]);
          const atomB = structure.getAtom(ids[1]);
          if (atomA && atomB) {
            this.pushUndoSnapshot(key, structure);
            const dx = atomB.x - atomA.x;
            const dy = atomB.y - atomA.y;
            const dz = atomB.z - atomA.z;
            const current = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (current > 1e-6) {
              const scale = message.length / current;
              atomB.setPosition(
                atomA.x + dx * scale,
                atomA.y + dy * scale,
                atomA.z + dz * scale
              );
              renderer.setStructure(structure);
              this.renderStructure(key, webviewPanel);
            }
          }
        }
        break;
      }

      case 'copyAtoms': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length === 0) {
          break;
        }
        const offset = message.offset || { x: 0.5, y: 0.5, z: 0.5 };
        this.pushUndoSnapshot(key, structure);
        for (const id of ids) {
          const atom = structure.getAtom(id);
          if (!atom) {
            continue;
          }
          const copy = new Atom(
            atom.element,
            atom.x + (offset.x || 0),
            atom.y + (offset.y || 0),
            atom.z + (offset.z || 0)
          );
          structure.addAtom(copy);
        }
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'changeAtoms': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length === 0 || !message.element) {
          break;
        }
        this.pushUndoSnapshot(key, structure);
        const element = parseElement(String(message.element));
        if (!element) {
          vscode.window.showErrorMessage(`Unknown element: ${message.element}`);
          break;
        }
        for (const id of ids) {
          const atom = structure.getAtom(id);
          if (atom) {
            atom.element = element;
          }
        }
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setAtomColor': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        const color = typeof message.color === 'string' ? message.color.trim() : '';
        if (ids.length === 0 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
          break;
        }
        this.pushUndoSnapshot(key, structure);
        for (const id of ids) {
          const atom = structure.getAtom(id);
          if (atom) {
            atom.color = color;
          }
        }
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'createBond': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length < 2) {
          break;
        }
        const atomId1 = ids[0];
        const atomId2 = ids[1];
        if (!structure.getAtom(atomId1) || !structure.getAtom(atomId2) || atomId1 === atomId2) {
          break;
        }
        this.pushUndoSnapshot(key, structure);
        structure.addManualBond(atomId1, atomId2);
        renderer.setStructure(structure);
        renderer.selectBond(Structure.bondKey(atomId1, atomId2));
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'deleteBond': {
        const selectedPairs: Array<[string, string]> = [];
        if (Array.isArray(message.bondKeys)) {
          for (const key of message.bondKeys) {
            if (typeof key !== 'string') {
              continue;
            }
            const pair = Structure.bondKeyToPair(key);
            if (pair) {
              selectedPairs.push(pair);
            }
          }
        }

        if (selectedPairs.length === 0) {
          let pair: [string, string] | null = null;
          if (typeof message.bondKey === 'string') {
            pair = Structure.bondKeyToPair(message.bondKey);
          }
          if (!pair) {
            const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
            if (ids.length >= 2) {
              pair = Structure.normalizeBondPair(ids[0], ids[1]);
            }
          }
          if (pair) {
            selectedPairs.push(pair);
          }
        }

        if (selectedPairs.length === 0) {
          break;
        }
        this.pushUndoSnapshot(key, structure);
        for (const pair of selectedPairs) {
          structure.removeBond(pair[0], pair[1]);
        }
        renderer.setStructure(structure);
        renderer.deselectBond();
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'recalculateBonds': {
        this.pushUndoSnapshot(key, structure);
        structure.manualBonds = [];
        structure.suppressedAutoBonds = [];
        renderer.setStructure(structure);
        renderer.deselectBond();
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'updateAtom': {
        if (message.atomId) {
          const atom = structure.getAtom(message.atomId);
          if (atom) {
            this.pushUndoSnapshot(key, structure);
            if (message.element) {
              const element = parseElement(String(message.element));
              if (!element) {
                vscode.window.showErrorMessage(`Unknown element: ${message.element}`);
              } else {
                atom.element = element;
              }
            }
            if (
              typeof message.x === 'number' &&
              typeof message.y === 'number' &&
              typeof message.z === 'number'
            ) {
              atom.setPosition(message.x, message.y, message.z);
            }
            renderer.setStructure(structure);
            this.renderStructure(key, webviewPanel);
          }
        }
        break;
      }

      case 'undo': {
        this.undoLastEdit(key, webviewPanel);
        break;
      }

      case 'saveStructure': {
        await this.saveStructure(key);
        break;
      }

      case 'saveStructureAs': {
        const structureToSave = this.structures.get(key);
        const trajectoryFrames = this.trajectories.get(key) || (structureToSave ? [structureToSave] : []);
        if (!structureToSave) {
          break;
        }
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
          break;
        }
        const selectedFormat = selected.id;
        let exportFrames: Structure[] = [structureToSave];
        if ((selectedFormat === 'xyz' || selectedFormat === 'xdatcar') && trajectoryFrames.length > 1) {
          const chosen = await this.pickTrajectoryExportFrames(
            key,
            trajectoryFrames,
            structureToSave,
            selectedFormat.toUpperCase()
          );
          if (!chosen) {
            break;
          }
          exportFrames = chosen;
        }

        const baseName = path.basename(key, path.extname(key));
        const isPoscarFormat = ['poscar', 'vasp'].includes(selectedFormat.toLowerCase());
        const defaultFileName = isPoscarFormat
          ? baseName || 'structure'
          : `${baseName || 'structure'}.${selectedFormat}`;
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
          break;
        }
        try {
          if (selectedFormat === 'xyz' && exportFrames.length > 1) {
            for (const frame of exportFrames) {
              FileManager.ensureStructureName(frame, uri.fsPath);
            }
          }
          FileManager.ensureStructureName(exportFrames[0], uri.fsPath);
          const content =
            selectedFormat === 'xyz' && exportFrames.length > 1
              ? FileManager.saveStructures(exportFrames, selectedFormat)
              : FileManager.saveStructure(exportFrames[0], selectedFormat);
          await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to export structure: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        break;
      }

      case 'saveRenderedImage': {
        const dataUrl = typeof message.dataUrl === 'string' ? message.dataUrl : '';
        const imageMatch = dataUrl.match(/^data:image\/png;base64,(.+)$/);
        if (!imageMatch || !imageMatch[1]) {
          const reason = 'Failed to export image: invalid PNG data.';
          vscode.window.showErrorMessage(reason);
          webviewPanel.webview.postMessage({ command: 'imageSaveFailed', data: { reason } });
          break;
        }

        const rawName =
          typeof message.suggestedName === 'string' && message.suggestedName.trim()
            ? message.suggestedName.trim()
            : `structure-hd-${Date.now()}.png`;
        const fileName = rawName.toLowerCase().endsWith('.png') ? rawName : `${rawName}.png`;
        const saveUri = await vscode.window.showSaveDialog({
          saveLabel: 'Save HD Image',
          defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(key)), fileName),
          filters: {
            'PNG Image': ['png'],
          },
        });

        if (!saveUri) {
          break;
        }

        try {
          const bytes = Buffer.from(imageMatch[1], 'base64');
          await vscode.workspace.fs.writeFile(saveUri, bytes);
          const savedName = path.basename(saveUri.fsPath);
          vscode.window.showInformationMessage(`Image exported to ${savedName}`);
          webviewPanel.webview.postMessage({
            command: 'imageSaved',
            data: { fileName: savedName },
          });
        } catch (error) {
          const reason = `Failed to export image: ${error instanceof Error ? error.message : String(error)}`;
          vscode.window.showErrorMessage(reason);
          webviewPanel.webview.postMessage({ command: 'imageSaveFailed', data: { reason } });
        }
        break;
      }

      case 'openSource': {
        try {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(key));
          await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open source: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        break;
      }

      case 'reloadStructure': {
        try {
          const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(key));
          const content = new TextDecoder().decode(fileContent);
          const updatedFrames = FileManager.loadStructures(key, content);
          if (!updatedFrames || updatedFrames.length === 0) {
            break;
          }
          const initialFrameIndex = this.getDefaultTrajectoryFrameIndex(updatedFrames);
          this.setTrajectoryState(key, updatedFrames, initialFrameIndex);
          this.undoStacks.set(key, []);
          renderer.setStructure(updatedFrames[initialFrameIndex]);
          renderer.setTrajectoryFrameInfo(initialFrameIndex, updatedFrames.length);
          renderer.setShowUnitCell(!!updatedFrames[initialFrameIndex].unitCell);
          renderer.deselectAtom();
          renderer.deselectBond();
          this.renderStructure(key, webviewPanel);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        break;
      }
    }
  }

  private setTrajectoryState(key: string, frames: Structure[], activeIndex: number) {
    const normalizedFrames = frames.length > 0 ? frames : [new Structure('')];
    const index = Math.max(0, Math.min(normalizedFrames.length - 1, Math.floor(activeIndex || 0)));
    this.trajectories.set(key, normalizedFrames);
    this.trajectoryFrameIndices.set(key, index);
    this.structures.set(key, normalizedFrames[index]);
  }

  private getDefaultTrajectoryFrameIndex(frames: Structure[]): number {
    if (!frames || frames.length === 0) {
      return 0;
    }
    return Math.max(0, frames.length - 1);
  }

  private async pickTrajectoryExportFrames(
    key: string,
    trajectoryFrames: Structure[],
    currentStructure: Structure,
    formatLabel: string
  ): Promise<Structure[] | null> {
    if (trajectoryFrames.length <= 1) {
      return [currentStructure];
    }
    const currentIndex = this.trajectoryFrameIndices.get(key) ?? 0;
    const selected = await vscode.window.showQuickPick(
      [
        {
          id: 'current',
          label: `Current Frame (${currentIndex + 1}/${trajectoryFrames.length})`,
        },
        {
          id: 'all',
          label: `Whole Trajectory (${trajectoryFrames.length} frames)`,
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
    if (selected.id === 'all') {
      return trajectoryFrames;
    }
    return [currentStructure];
  }

  private updateCurrentFrame(key: string, structure: Structure) {
    this.structures.set(key, structure);
    const frames = this.trajectories.get(key);
    if (!frames || frames.length === 0) {
      return;
    }
    const index = this.trajectoryFrameIndices.get(key) ?? 0;
    if (index >= 0 && index < frames.length) {
      frames[index] = structure;
    }
  }

  private pushUndoSnapshot(key: string, structure: Structure) {
    const stack = this.undoStacks.get(key);
    if (!stack) {
      return;
    }
    stack.push(structure.clone());
    if (stack.length > this.maxUndoDepth) {
      stack.shift();
    }
  }

  private undoLastEdit(key: string, webviewPanel: vscode.WebviewPanel) {
    const stack = this.undoStacks.get(key);
    const renderer = this.renderers.get(key);
    if (!stack || stack.length === 0 || !renderer) {
      return;
    }
    const previous = stack.pop();
    if (!previous) {
      return;
    }
    this.updateCurrentFrame(key, previous);
    renderer.setStructure(previous);
    renderer.setShowUnitCell(!!previous.unitCell);
    renderer.deselectAtom();
    renderer.deselectBond();
    this.renderStructure(key, webviewPanel);
  }

  private renderStructure(
    key: string,
    webviewPanel: vscode.WebviewPanel
  ) {
    const renderer = this.renderers.get(key);
    if (renderer) {
      const frames = this.trajectories.get(key);
      const frameCount = frames && frames.length > 0 ? frames.length : 1;
      const frameIndex = this.trajectoryFrameIndices.get(key) ?? 0;
      renderer.setTrajectoryFrameInfo(frameIndex, frameCount);
      const message = renderer.getRenderMessage();
      webviewPanel.webview.postMessage(message);
    }
  }

  private async saveStructure(key: string) {
    const structure = this.structures.get(key);
    if (!structure) {
      return;
    }

    try {
      const format = FileManager.resolveFormat(key, 'xyz');
      const frames = this.trajectories.get(key) || [structure];
      if (format === 'xyz' && frames.length > 1) {
        for (const frame of frames) {
          FileManager.ensureStructureName(frame, key);
        }
      } else {
        FileManager.ensureStructureName(structure, key);
      }
      const content =
        format === 'xyz' && frames.length > 1
          ? FileManager.saveStructures(frames, format)
          : FileManager.saveStructure(structure, format);
      const uri = vscode.Uri.file(key);
      await vscode.workspace.fs.writeFile(
        uri,
        new TextEncoder().encode(content)
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const csp = `default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src ${webview.cspSource}`;
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'styles.css')
    );
    const threeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        'media',
        'three',
        'three.min.js'
      )
    );
    const orbitControlsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        'media',
        'three',
        'OrbitControls.js'
      )
    );
    const stateUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'state.js')
    );
    const rendererUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'renderer.js')
    );
    const interactionUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'interaction.js')
    );
    const appUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'app.js')
    );

    const templatePath = path.join(this.context.extensionPath, 'media', 'webview', 'index.html');
    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace(/\{\{csp\}\}/g, csp);
    html = html.replace(/\{\{stylesUri\}\}/g, styleUri.toString());
    html = html.replace(/\{\{threeUri\}\}/g, threeUri.toString());
    html = html.replace(/\{\{orbitControlsUri\}\}/g, orbitControlsUri.toString());
    html = html.replace(/\{\{stateUri\}\}/g, stateUri.toString());
    html = html.replace(/\{\{rendererUri\}\}/g, rendererUri.toString());
    html = html.replace(/\{\{interactionUri\}\}/g, interactionUri.toString());
    html = html.replace(/\{\{appUri\}\}/g, appUri.toString());
    return html;
  }

  saveCustomDocument(
    document: any,
    _cancellationToken: vscode.CancellationToken
  ): Thenable<void> {
    return this.saveStructure(document.uri.fsPath);
  }

  async saveCustomDocumentAs(
    document: any,
    destination: vscode.Uri,
    _cancellationToken: vscode.CancellationToken
  ): Promise<void> {
    const structure = this.structures.get(document.uri.fsPath);
    if (!structure) {
      return;
    }
    const format = FileManager.resolveFormat(destination.fsPath, 'xyz');
    try {
      const frames = this.trajectories.get(document.uri.fsPath) || [structure];
      let exportFrames: Structure[] = [structure];
      if ((format === 'xyz' || format === 'xdatcar') && frames.length > 1) {
        const chosen = await this.pickTrajectoryExportFrames(
          document.uri.fsPath,
          frames,
          structure,
          format.toUpperCase()
        );
        if (!chosen) {
          return;
        }
        exportFrames = chosen;
      }
      if ((format === 'xyz' || format === 'xdatcar') && exportFrames.length > 1) {
        for (const frame of exportFrames) {
          FileManager.ensureStructureName(frame, destination.fsPath);
        }
      }
      FileManager.ensureStructureName(exportFrames[0], destination.fsPath);
      const content =
        (format === 'xyz' || format === 'xdatcar') && exportFrames.length > 1
          ? FileManager.saveStructures(exportFrames, format)
          : FileManager.saveStructure(exportFrames[0], format);
      await vscode.workspace.fs.writeFile(destination, new TextEncoder().encode(content));
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  revertCustomDocument(
    document: any,
    _cancellationToken: vscode.CancellationToken
  ): Thenable<void> {
    return Promise.resolve();
  }

  backupCustomDocument(
    document: vscode.CustomDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellationToken: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    const backupUri = context.destination;
    return Promise.resolve({
      id: backupUri.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(backupUri, { useTrash: false });
        } catch {
          // Ignore delete errors for missing or already-removed backups.
        }
      },
    });
  }
}

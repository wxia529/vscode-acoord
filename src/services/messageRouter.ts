import * as vscode from 'vscode';
import { RenderMessageBuilder } from '../renderers/renderMessageBuilder';
import { UndoManager } from '../providers/undoManager';
import { TrajectoryManager } from '../providers/trajectoryManager';
import { SelectionService } from './selectionService';
import { BondService } from './bondService';
import { AtomEditService } from './atomEditService';
import { UnitCellService } from './unitCellService';
import { DocumentService } from './documentService';
import { DisplayConfigService } from './displayConfigService';
import type { WebviewToExtensionMessage, MessageByCommand } from '../shared/protocol';

type AnyHandler = (message: unknown) => Promise<boolean> | boolean;

export class MessageRouter {
  private handlers = new Map<string, AnyHandler>();

  registerTyped<C extends WebviewToExtensionMessage['command']>(
    command: C,
    handler: (message: MessageByCommand<C>) => Promise<boolean> | boolean
  ): void {
    this.handlers.set(command, handler as unknown as AnyHandler);
  }

  constructor(
    private renderer: RenderMessageBuilder,
    private trajectoryManager: TrajectoryManager,
    private undoManager: UndoManager,
    private selectionService: SelectionService,
    private bondService: BondService,
    private atomEditService: AtomEditService,
    private unitCellService: UnitCellService,
    private documentService: DocumentService,
    private displayConfigService: DisplayConfigService,
    private sessionKey: string,
    private webviewPanel: vscode.WebviewPanel,
    private onRenderRequired: () => void,
    private onSelectionClearRequired: () => void,
  ) {
    this.registerCoreCommands();
    this.registerSelectionCommands();
    this.registerAtomEditCommands();
    this.registerBondCommands();
    this.registerUnitCellCommands();
    this.registerDocumentCommands();
    this.registerDisplayConfigCommands();
  }

  register<C extends WebviewToExtensionMessage['command']>(
    command: C,
    handler: (message: MessageByCommand<C>) => Promise<boolean> | boolean
  ): void {
    this.registerTyped(command, handler);
  }

  async route(message: WebviewToExtensionMessage): Promise<boolean> {
    const handler = this.handlers.get(message.command);
    if (!handler) {
      return false;
    }
    try {
      return await handler(message);
    } catch (error) {
      console.error(`[ACoord] Handler for '${message.command}' threw:`, error);
      vscode.window.showErrorMessage(
        `ACoord: Command '${message.command}' failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return true; // Claim handled to prevent further dispatch
    }
  }

  hasHandler(command: string): boolean {
    return this.handlers.has(command);
  }

  private registerCoreCommands(): void {
    this.registerTyped('getState', () => {
      return true;
    });

    this.registerTyped('setTrajectoryFrame', (message) => {
      if (this.trajectoryManager.frameCount <= 1) {
        return true;
      }
      const requestedIndex = Number(message.frameIndex);
      if (!Number.isFinite(requestedIndex)) {
        return true;
      }
      const nextIndex = Math.max(0, Math.min(this.trajectoryManager.frameCount - 1, Math.floor(requestedIndex)));
      this.trajectoryManager.setActiveIndex(nextIndex);
      const nextStructure = this.trajectoryManager.activeStructure;
      this.renderer.setStructure(nextStructure);
      this.renderer.setShowUnitCell(!!nextStructure.unitCell);
      this.renderer.setTrajectoryFrameInfo(nextIndex, this.trajectoryManager.frameCount);
      this.selectionService.clearSelection();
      this.undoManager.clear();
      return true;
    });

    this.registerTyped('beginDrag', (message) => {
      if (message.atomId && !this.trajectoryManager.isEditing) {
        const editStructure = this.trajectoryManager.beginEdit();
        this.undoManager.push(editStructure);
      }
      return true;
    });

    this.registerTyped('endDrag', () => {
      if (this.trajectoryManager.isEditing) {
        this.trajectoryManager.commitEdit();
      }
      return true;
    });

    this.registerTyped('undo', () => {
      return false;
    });
  }

  private registerSelectionCommands(): void {
    this.registerTyped('selectAtom', (message) => {
      if (message.atomId) {
        if (message.add) {
          this.selectionService.toggleAtomSelection(message.atomId);
        } else {
          this.selectionService.selectAtom(message.atomId);
        }
        this.selectionService.deselectBond();
      }
      return true;
    });

    this.registerTyped('setSelection', (message) => {
      this.selectionService.setSelection(message.atomIds);
      this.selectionService.deselectBond();
      return true;
    });

    this.registerTyped('selectBond', (message) => {
      const bondKey = typeof message.bondKey === 'string' && message.bondKey.trim()
        ? message.bondKey.trim()
        : undefined;
      if (message.add && bondKey) {
        this.selectionService.toggleBondSelection(bondKey);
      } else {
        this.selectionService.selectBond(bondKey);
      }
      return true;
    });

    this.registerTyped('setBondSelection', (message) => {
      this.selectionService.setBondSelection(message.bondKeys);
      return true;
    });
  }

  private registerAtomEditCommands(): void {
    this.registerTyped('addAtom', (message) => {
      return this.atomEditService.addAtom(message.element, message.x, message.y, message.z);
    });

    this.registerTyped('deleteAtom', (message) => {
      if (message.atomId) {
        this.atomEditService.deleteAtom(message.atomId);
      }
      return true;
    });

    this.registerTyped('deleteAtoms', (message) => {
      this.atomEditService.deleteAtoms(message.atomIds);
      return true;
    });

    this.registerTyped('moveAtom', (message) => {
      if (message.atomId) {
        this.atomEditService.moveAtom(
          message.atomId,
          message.x,
          message.y,
          message.z,
          message.preview
        );
      }
      return true;
    });

    this.registerTyped('moveGroup', (message) => {
      this.atomEditService.moveGroup(message.atomIds, message.dx, message.dy, message.dz, message.preview);
      return true;
    });

    this.registerTyped('setAtomsPositions', (message) => {
      this.atomEditService.setAtomPositions(message.atomPositions, message.preview);
      return true;
    });

    this.registerTyped('copyAtoms', (message) => {
      this.atomEditService.copyAtoms(message.atomIds, message.offset);
      return true;
    });

    this.registerTyped('changeAtoms', (message) => {
      this.atomEditService.changeAtoms(message.atomIds, message.element);
      return true;
    });

    this.registerTyped('setAtomColor', (message) => {
      this.atomEditService.setAtomColor(message.atomIds, message.color);
      return true;
    });

    this.registerTyped('updateAtom', (message) => {
      if (message.atomId) {
        this.atomEditService.updateAtom(message.atomId, {
          element: message.element,
          x: message.x,
          y: message.y,
          z: message.z,
        });
      }
      return true;
    });

    this.registerTyped('setBondLength', (message) => {
      this.bondService.setBondLength(message.atomIds, message.length);
      return true;
    });
  }

  private registerBondCommands(): void {
    this.registerTyped('createBond', (message) => {
      if (message.atomIds.length >= 2) {
        this.bondService.createBond(message.atomIds[0], message.atomIds[1]);
      }
      return true;
    });

    this.registerTyped('deleteBond', (message) => {
      const atomIds: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      const bondKeys: string[] = Array.isArray(message.bondKeys) ? message.bondKeys : [];
      this.bondService.deleteBond(message.bondKey, atomIds, bondKeys);
      return true;
    });

    this.registerTyped('recalculateBonds', () => {
      this.bondService.recalculateBonds();
      return true;
    });
  }

  private registerUnitCellCommands(): void {
    this.registerTyped('toggleUnitCell', () => {
      this.unitCellService.toggleUnitCell();
      return true;
    });

    this.registerTyped('setUnitCell', (message) => {
      const isValid = this.unitCellService.setUnitCell(
        {
          a: message.params.a,
          b: message.params.b,
          c: message.params.c,
          alpha: message.params.alpha,
          beta: message.params.beta,
          gamma: message.params.gamma,
        },
        message.scaleAtoms
      );
      if (!isValid) {
        vscode.window.showErrorMessage('Invalid lattice parameters.');
      }
      return true;
    });

    this.registerTyped('clearUnitCell', () => {
      this.unitCellService.clearUnitCell();
      return true;
    });

    this.registerTyped('centerToUnitCell', async () => {
      return await this.unitCellService.centerToUnitCell();
    });

    this.registerTyped('setSupercell', (message) => {
      const [s0, s1, s2] = message.supercell;
      const nx = Math.max(1, Math.floor(Number(s0) || 1));
      const ny = Math.max(1, Math.floor(Number(s1) || 1));
      const nz = Math.max(1, Math.floor(Number(s2) || 1));
      this.unitCellService.setSupercell([nx, ny, nz]);
      return true;
    });
  }

  private registerDocumentCommands(): void {
    this.registerTyped('saveStructure', async () => {
      await this.documentService.saveStructure(
        this.sessionKey,
        this.trajectoryManager.activeStructure,
        this.trajectoryManager.frames
      );
      return true;
    });

    this.registerTyped('saveStructureAs', async () => {
      await this.documentService.saveStructureAs(
        this.sessionKey,
        this.trajectoryManager.activeStructure,
        this.trajectoryManager.frames,
        this.trajectoryManager
      );
      return true;
    });

    this.registerTyped('saveRenderedImage', async (message) => {
      await this.documentService.saveRenderedImage(
        message.dataUrl,
        message.suggestedName ?? '',
        (msg) => this.webviewPanel.webview.postMessage(msg),
        () => this.webviewPanel.title
      );
      return true;
    });

    this.registerTyped('openSource', async () => {
      await this.documentService.openSource(this.sessionKey);
      return true;
    });

    this.registerTyped('reloadStructure', async () => {
      await this.documentService.reloadStructure(
        this.sessionKey,
        this.trajectoryManager,
        this.undoManager,
        this.renderer
      );
      this.onSelectionClearRequired();
      this.onRenderRequired();
      return true;
    });
  }

  private registerDisplayConfigCommands(): void {
    this.registerTyped('getDisplayConfigs', async () => {
      return await this.displayConfigService.handleGetDisplayConfigs();
    });

    this.registerTyped('loadDisplayConfig', async (message) => {
      return await this.displayConfigService.handleLoadDisplayConfig(message.configId);
    });

    this.registerTyped('promptSaveDisplayConfig', async (message) => {
      return await this.displayConfigService.handlePromptSaveDisplayConfig(message.settings);
    });

    this.registerTyped('saveDisplayConfig', async (message) => {
      return await this.displayConfigService.handleSaveDisplayConfig(
        message.name,
        message.settings,
        message.description,
        message.existingId
      );
    });

    this.registerTyped('getCurrentDisplaySettings', async () => {
      return await this.displayConfigService.handleGetCurrentDisplaySettings();
    });

    this.registerTyped('updateDisplaySettings', (message) => {
      this.displayConfigService.updateDisplaySettings(message.settings);
      return true;
    });

    this.registerTyped('exportDisplayConfigs', async () => {
      return await this.displayConfigService.handleExportDisplayConfigs();
    });

    this.registerTyped('importDisplayConfigs', async () => {
      return await this.displayConfigService.handleImportDisplayConfigs();
    });

    this.registerTyped('confirmDeleteDisplayConfig', async (message) => {
      return await this.displayConfigService.handleConfirmDeleteDisplayConfig(message.configId);
    });

    this.registerTyped('deleteDisplayConfig', async (message) => {
      return await this.displayConfigService.handleDeleteDisplayConfig(message.configId);
    });
  }
}

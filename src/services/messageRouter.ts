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
import type { WebviewToExtensionMessage } from '../types/messages';
import type { DisplaySettings } from '../config/types';

export interface MessageHandler {
  command: string;
  handler: (message: any) => Promise<boolean> | boolean;
}

export class MessageRouter {
  private handlers = new Map<string, (message: any) => Promise<boolean> | boolean>();

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
    private sessionDisplaySettings?: DisplaySettings
  ) {
    this.registerCoreCommands();
    this.registerSelectionCommands();
    this.registerAtomEditCommands();
    this.registerBondCommands();
    this.registerUnitCellCommands();
    this.registerDocumentCommands();
    this.registerDisplayConfigCommands();
  }

  register(handler: MessageHandler): void {
    this.handlers.set(handler.command, handler.handler);
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
    this.handlers.set('getState', () => {
      return true;
    });

    this.handlers.set('setTrajectoryFrame', (message) => {
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

    this.handlers.set('beginDrag', (message) => {
      if (message.atomId && !this.trajectoryManager.isEditing) {
        const editStructure = this.trajectoryManager.beginEdit();
        this.undoManager.push(editStructure);
      }
      return true;
    });

    this.handlers.set('endDrag', () => {
      if (this.trajectoryManager.isEditing) {
        this.trajectoryManager.commitEdit();
      }
      return true;
    });

    this.handlers.set('undo', () => {
      return false;
    });
  }

  private registerSelectionCommands(): void {
    this.handlers.set('selectAtom', (message) => {
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

    this.handlers.set('setSelection', (message) => {
      const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      this.selectionService.setSelection(ids);
      this.selectionService.deselectBond();
      return true;
    });

    this.handlers.set('selectBond', (message) => {
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

    this.handlers.set('setBondSelection', (message) => {
      const keys: string[] = Array.isArray(message.bondKeys)
        ? message.bondKeys.filter((k: unknown) => typeof k === 'string')
        : [];
      this.selectionService.setBondSelection(keys);
      return true;
    });
  }

  private registerAtomEditCommands(): void {
    this.handlers.set('addAtom', (message) => {
      const element = String(message.element || '');
      const x = message.x || 0;
      const y = message.y || 0;
      const z = message.z || 0;
      return this.atomEditService.addAtom(element, x, y, z);
    });

    this.handlers.set('deleteAtom', (message) => {
      if (message.atomId) {
        this.atomEditService.deleteAtom(message.atomId);
      }
      return true;
    });

    this.handlers.set('deleteAtoms', (message) => {
      const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      this.atomEditService.deleteAtoms(ids);
      return true;
    });

    this.handlers.set('moveAtom', (message) => {
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

    this.handlers.set('moveGroup', (message) => {
      const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      this.atomEditService.moveGroup(ids, message.dx, message.dy, message.dz, message.preview);
      return true;
    });

    this.handlers.set('setAtomsPositions', (message) => {
      const updates = Array.isArray(message.atomPositions) ? message.atomPositions : [];
      this.atomEditService.setAtomPositions(updates, message.preview);
      return true;
    });

    this.handlers.set('copyAtoms', (message) => {
      const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      const offset = message.offset || { x: 0.5, y: 0.5, z: 0.5 };
      this.atomEditService.copyAtoms(ids, offset);
      return true;
    });

    this.handlers.set('changeAtoms', (message) => {
      const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      this.atomEditService.changeAtoms(ids, message.element);
      return true;
    });

    this.handlers.set('setAtomColor', (message) => {
      const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      const color = typeof message.color === 'string' ? message.color.trim() : '';
      this.atomEditService.setAtomColor(ids, color);
      return true;
    });

    this.handlers.set('updateAtom', (message) => {
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

    this.handlers.set('setBondLength', (message) => {
      const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      this.bondService.setBondLength(ids, message.length);
      return true;
    });
  }

  private registerBondCommands(): void {
    this.handlers.set('createBond', (message) => {
      const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      if (ids.length >= 2) {
        this.bondService.createBond(ids[0], ids[1]);
      }
      return true;
    });

    this.handlers.set('deleteBond', (message) => {
      const bondKey = message.bondKey;
      const atomIds: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
      const bondKeys: string[] = Array.isArray(message.bondKeys) ? message.bondKeys : [];
      this.bondService.deleteBond(bondKey, atomIds, bondKeys);
      return true;
    });

    this.handlers.set('recalculateBonds', () => {
      this.bondService.recalculateBonds();
      return true;
    });
  }

  private registerUnitCellCommands(): void {
    this.handlers.set('toggleUnitCell', () => {
      this.unitCellService.toggleUnitCell();
      return true;
    });

    this.handlers.set('setUnitCell', (message) => {
      const params = message.params || {};
      const isValid = this.unitCellService.setUnitCell(
        {
          a: Number(params.a),
          b: Number(params.b),
          c: Number(params.c),
          alpha: Number(params.alpha),
          beta: Number(params.beta),
          gamma: Number(params.gamma),
        },
        message.scaleAtoms
      );
      if (!isValid) {
        vscode.window.showErrorMessage('Invalid lattice parameters.');
      }
      return true;
    });

    this.handlers.set('clearUnitCell', () => {
      this.unitCellService.clearUnitCell();
      return true;
    });

    this.handlers.set('centerToUnitCell', async () => {
      return await this.unitCellService.centerToUnitCell();
    });

    this.handlers.set('setSupercell', (message) => {
      const sc = Array.isArray(message.supercell) ? message.supercell : [1, 1, 1];
      const nx = Math.max(1, Math.floor(Number(sc[0]) || 1));
      const ny = Math.max(1, Math.floor(Number(sc[1]) || 1));
      const nz = Math.max(1, Math.floor(Number(sc[2]) || 1));
      this.unitCellService.setSupercell([nx, ny, nz]);
      return true;
    });
  }

  private registerDocumentCommands(): void {
    this.handlers.set('saveStructure', async () => {
      await this.documentService.saveStructure(
        this.sessionKey,
        this.trajectoryManager.activeStructure,
        this.trajectoryManager.frames
      );
      return true;
    });

    this.handlers.set('saveStructureAs', async () => {
      await this.documentService.saveStructureAs(
        this.sessionKey,
        this.trajectoryManager.activeStructure,
        this.trajectoryManager.frames,
        this.trajectoryManager
      );
      return true;
    });

    this.handlers.set('saveRenderedImage', async (message) => {
      const dataUrl = typeof message.dataUrl === 'string' ? message.dataUrl : '';
      const suggestedName = message.suggestedName || '';
      await this.documentService.saveRenderedImage(dataUrl, suggestedName, this.webviewPanel);
      return true;
    });

    this.handlers.set('openSource', async () => {
      await this.documentService.openSource(this.sessionKey);
      return true;
    });

    this.handlers.set('reloadStructure', async () => {
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
    this.handlers.set('getDisplayConfigs', async () => {
      return await this.displayConfigService.handleGetDisplayConfigs();
    });

    this.handlers.set('loadDisplayConfig', async (message) => {
      return await this.displayConfigService.handleLoadDisplayConfig(message.configId);
    });

    this.handlers.set('promptSaveDisplayConfig', async (message) => {
      return await this.displayConfigService.handlePromptSaveDisplayConfig(message.settings);
    });

    this.handlers.set('saveDisplayConfig', async (message) => {
      return await this.displayConfigService.handleSaveDisplayConfig(
        message.name,
        message.settings,
        message.description,
        message.existingId
      );
    });

    this.handlers.set('getCurrentDisplaySettings', async () => {
      return await this.displayConfigService.handleGetCurrentDisplaySettings();
    });

    this.handlers.set('updateDisplaySettings', (message) => {
      this.displayConfigService.updateDisplaySettings(message.settings);
      return true;
    });

    this.handlers.set('exportDisplayConfigs', async () => {
      return await this.displayConfigService.handleExportDisplayConfigs();
    });

    this.handlers.set('importDisplayConfigs', async () => {
      return await this.displayConfigService.handleImportDisplayConfigs();
    });

    this.handlers.set('confirmDeleteDisplayConfig', async (message) => {
      return await this.displayConfigService.handleConfirmDeleteDisplayConfig(message.configId);
    });

    this.handlers.set('deleteDisplayConfig', async (message) => {
      return await this.displayConfigService.handleDeleteDisplayConfig(message.configId);
    });
  }
}

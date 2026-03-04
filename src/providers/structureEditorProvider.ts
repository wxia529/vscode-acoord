import * as vscode from 'vscode';
import * as path from 'path';
import { Structure } from '../models/structure';
import { RenderMessageBuilder } from '../renderers/renderMessageBuilder';
import { ConfigManager } from '../config/configManager';
import { DisplaySettings, DisplayConfig } from '../config/types';
import { FileManager } from '../io/fileManager';
import { UndoManager } from './undoManager';
import { TrajectoryManager } from './trajectoryManager';
import { StructureDocumentManager } from './structureDocumentManager';
import { SelectionService } from '../services/selectionService';
import { BondService } from '../services/bondService';
import { AtomEditService } from '../services/atomEditService';
import { UnitCellService } from '../services/unitCellService';
import { MessageRouter } from '../services/messageRouter';
import { DisplayConfigService } from '../services/displayConfigService';
import { DocumentService } from '../services/documentService';
import type { WebviewToExtensionMessage, ImageSavedMessage, ImageSaveFailedMessage } from '../types/messages';

export class StructureDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}

  dispose(): void {
    // No additional resources to release beyond what the provider tracks
  }
}

class EditorSession {
  constructor(
    readonly key: string,
    readonly webviewPanel: vscode.WebviewPanel,
    readonly renderer: RenderMessageBuilder,
    readonly trajectoryManager: TrajectoryManager,
    readonly undoManager: UndoManager,
    readonly selectionService: SelectionService,
    readonly bondService: BondService,
    readonly atomEditService: AtomEditService,
    readonly unitCellService: UnitCellService,
    readonly messageRouter: MessageRouter,
    displaySettings?: DisplaySettings
  ) {
    this.displaySettings = displaySettings;
  }

  displaySettings?: DisplaySettings;
}

export class StructureEditorProvider implements vscode.CustomEditorProvider<StructureDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<StructureDocument> |
      vscode.CustomDocumentContentChangeEvent<StructureDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  private sessions = new Map<string, EditorSession>();

  constructor(
    private context: vscode.ExtensionContext,
    private configManager: ConfigManager
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<StructureDocument> {
    return new StructureDocument(uri);
  }

  async resolveCustomEditor(
    document: StructureDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri.fsPath;

    await this.configManager.initialize();

    let frames: Structure[];
    try {
      frames = await StructureDocumentManager.load(document.uri);
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
    const initialFrameIndex = TrajectoryManager.defaultFrameIndex(frames);

    const key = uri;
    const traj = new TrajectoryManager(frames, initialFrameIndex);
    const renderer = new RenderMessageBuilder(traj.activeStructure);
    renderer.setTrajectoryFrameInfo(traj.activeIndex, traj.frameCount);

    const undoManager = new UndoManager();
    const selectionService = new SelectionService(renderer);
    const bondService = new BondService(renderer, traj, undoManager, selectionService);
    const atomEditService = new AtomEditService(renderer, traj, undoManager);
    const unitCellService = new UnitCellService(renderer, traj, undoManager);
    const messageRouter = new MessageRouter(
      renderer,
      traj,
      undoManager,
      selectionService,
      bondService,
      atomEditService,
      unitCellService
    );

    const defaultConfig = this.configManager.getCurrentConfig();
    const session = new EditorSession(
      key,
      webviewPanel,
      renderer,
      traj,
      undoManager,
      selectionService,
      bondService,
      atomEditService,
      unitCellService,
      messageRouter,
      defaultConfig?.settings
    );
    this.sessions.set(key, session);

    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = await this.getWebviewContent(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message, session),
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
          const idx = TrajectoryManager.defaultFrameIndex(updatedFrames);
          session.trajectoryManager.set(updatedFrames, idx);
          session.undoManager.clear();
          renderer.setStructure(updatedFrames[idx]);
          renderer.setShowUnitCell(!!updatedFrames[idx].unitCell);
          renderer.setTrajectoryFrameInfo(idx, updatedFrames.length);
          selectionService.clearSelection();
          this.renderStructure(session);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    this.renderStructure(session);

    webviewPanel.onDidDispose(() => {
      this.sessions.delete(key);
      saveListener.dispose();
    });
  }

  private async handleWebviewMessage(
    message: WebviewToExtensionMessage,
    session: EditorSession
  ) {
    const { renderer, trajectoryManager: traj, undoManager: undo, messageRouter } = session;

    if (message.command === 'undo') {
      this.undoLastEdit(session);
      return;
    }

    if (message.command === 'redo') {
      this.redoLastEdit(session);
      return;
    }

    const handled = await messageRouter.route(message);

    if (handled) {
      if (message.command !== 'beginDrag' && message.command !== 'endDrag') {
        this.renderStructure(session);
      }
      return;
    }

    if (await this.handleDocumentCommands(message, session)) {
      return;
    }
    await this.handleDisplayConfigCommands(message, session);
  }

  private async handleDocumentCommands(message: WebviewToExtensionMessage, session: EditorSession): Promise<boolean> {
    const { renderer, trajectoryManager: traj, undoManager: undo, webviewPanel } = session;
    const documentService = new DocumentService();

    switch (message.command) {
      case 'saveStructure':
        await documentService.saveStructure(session.key, traj.activeStructure, traj.frames);
        return true;

      case 'saveStructureAs':
        await documentService.saveStructureAs(session.key, traj.activeStructure, traj.frames, traj);
        return true;

      case 'saveRenderedImage': {
        const dataUrl = typeof message.dataUrl === 'string' ? message.dataUrl : '';
        const suggestedName = message.suggestedName || '';
        await documentService.saveRenderedImage(dataUrl, suggestedName, webviewPanel);
        return true;
      }

      case 'openSource':
        await documentService.openSource(session.key);
        return true;

      case 'reloadStructure': {
        await documentService.reloadStructure(session.key, traj, undo, renderer);
        session.selectionService.clearSelection();
        this.renderStructure(session);
        return true;
      }

      default:
        return false;
    }
  }

  private async handleDisplayConfigCommands(message: WebviewToExtensionMessage, session: EditorSession): Promise<boolean> {
    const displayConfigService = new DisplayConfigService(this.configManager);

    switch (message.command) {
      case 'getDisplayConfigs':
        await this.handleGetDisplayConfigs(session.webviewPanel);
        return true;

      case 'loadDisplayConfig':
        await this.handleLoadDisplayConfig(message.configId, session);
        return true;

      case 'promptSaveDisplayConfig':
        await this.handlePromptSaveDisplayConfig(message, session);
        return true;

      case 'saveDisplayConfig':
        await this.handleSaveDisplayConfig(message, session.webviewPanel, session.key);
        return true;

      case 'getCurrentDisplaySettings':
        await this.handleGetCurrentDisplaySettings(session.webviewPanel, session.key);
        return true;

      case 'updateDisplaySettings':
        displayConfigService.updateDisplaySettings(message.settings, session);
        return true;

      case 'exportDisplayConfigs':
        await this.handleExportDisplayConfigs(session.webviewPanel);
        return true;

      case 'importDisplayConfigs':
        await this.handleImportDisplayConfigs(session.webviewPanel);
        return true;

      case 'confirmDeleteDisplayConfig':
        await this.handleConfirmDeleteDisplayConfig(message.configId as string, session.webviewPanel);
        return true;

      case 'deleteDisplayConfig':
        await this.handleDeleteDisplayConfig(message.configId as string, session.webviewPanel);
        return true;

      default:
        return false;
    }
  }

  private undoLastEdit(session: EditorSession) {
    const { renderer, trajectoryManager: traj, undoManager: undo, selectionService } = session;
    if (undo.isEmpty) {
      return;
    }
    const current = traj.activeStructure;
    const previous = undo.pop();
    if (!previous) {
      return;
    }
    undo.pushToRedo(current);
    traj.updateActiveFrame(previous);
    renderer.setStructure(previous);
    renderer.setShowUnitCell(!!previous.unitCell);
    selectionService.clearSelection();
    this.renderStructure(session);
  }

  private redoLastEdit(session: EditorSession) {
    const { renderer, trajectoryManager: traj, undoManager: undo, selectionService } = session;
    if (!undo.canRedo) {
      return;
    }
    const current = traj.activeStructure;
    const next = undo.redo();
    if (!next) {
      return;
    }
    undo.push(current);
    traj.updateActiveFrame(next);
    renderer.setStructure(next);
    renderer.setShowUnitCell(!!next.unitCell);
    selectionService.clearSelection();
    this.renderStructure(session);
  }

  private renderStructure(session: EditorSession) {
    const { renderer, trajectoryManager: traj, webviewPanel } = session;
    renderer.setTrajectoryFrameInfo(traj.activeIndex, traj.frameCount);
    const message = renderer.getRenderMessage();

    if (session.displaySettings) {
      message.displaySettings = session.displaySettings;
    }

    webviewPanel.webview.postMessage(message);
  }

  private async getWebviewContent(webview: vscode.Webview): Promise<string> {
    const csp = `default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-eval'; connect-src 'none'; worker-src 'none'; font-src 'none'; object-src 'none';`;
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'styles.css')
    );
    const webviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'webview.js')
    );

    const templateUri = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'index.html');
    const templateBytes = await vscode.workspace.fs.readFile(templateUri);
    let html = Buffer.from(templateBytes).toString('utf8');
    html = html.replace(/\{\{csp\}\}/g, csp);
    html = html.replace(/\{\{stylesUri\}\}/g, styleUri.toString());
    html = html.replace(/\{\{webviewUri\}\}/g, webviewUri.toString());
    return html;
  }

  saveCustomDocument(
    document: StructureDocument,
    _cancellationToken: vscode.CancellationToken
  ): Thenable<void> {
    const session = this.sessions.get(document.uri.fsPath);
    if (session) {
      const documentService = new DocumentService();
      return documentService.saveStructure(session.key, session.trajectoryManager.activeStructure, session.trajectoryManager.frames);
    }
    return Promise.resolve();
  }

  async saveCustomDocumentAs(
    document: StructureDocument,
    destination: vscode.Uri,
    _cancellationToken: vscode.CancellationToken
  ): Promise<void> {
    const session = this.sessions.get(document.uri.fsPath);
    if (!session) {
      return;
    }
    const traj = session.trajectoryManager;
    const format = FileManager.resolveFormat(destination.fsPath, 'xyz');
    try {
      let exportFrames: Structure[] = [traj.activeStructure];
      if ((format === 'xyz' || format === 'xdatcar') && traj.frameCount > 1) {
        const chosen = await StructureDocumentManager.pickTrajectoryExportFrames(
          traj.frames,
          traj.activeStructure,
          traj.activeIndex,
          format.toUpperCase()
        );
        if (!chosen) {
          return;
        }
        exportFrames = chosen;
      }
      await StructureDocumentManager.saveAs(destination, exportFrames);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  revertCustomDocument(
    document: StructureDocument,
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

  async notifyConfigChange(config: DisplayConfig): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.webviewPanel.active) {
        session.displaySettings = config.settings;
        session.webviewPanel.webview.postMessage({
          command: 'displayConfigChanged',
          config: config
        });
        return;
      }
    }
    const sessions = Array.from(this.sessions.values());
    if (sessions.length > 0) {
      const session = sessions[sessions.length - 1];
      session.displaySettings = config.settings;
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigChanged',
        config: config
      });
    }
  }

  async getCurrentDisplaySettings(): Promise<DisplaySettings | null> {
    for (const session of this.sessions.values()) {
      if (session.displaySettings) {
        return session.displaySettings;
      }
    }
    return null;
  }

  private async handleGetDisplayConfigs(webviewPanel: vscode.WebviewPanel): Promise<void> {
    try {
      const configs = await this.configManager.listConfigs();
      webviewPanel.webview.postMessage({
        command: 'displayConfigsLoaded',
        presets: configs.presets,
        user: configs.user
      });
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleLoadDisplayConfig(configId: string, session: EditorSession): Promise<void> {
    try {
      const config = await this.configManager.loadConfig(configId);
      session.displaySettings = config.settings;
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigLoaded',
        config: config
      });
    } catch (error) {
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleSaveDisplayConfig(
    message: any,
    webviewPanel: vscode.WebviewPanel,
    _key: string
  ): Promise<void> {
    try {
      const config = await this.configManager.saveUserConfig(
        message.name,
        message.settings,
        message.description,
        message.existingId
      );
      webviewPanel.webview.postMessage({
        command: 'displayConfigSaved',
        config: config
      });
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handlePromptSaveDisplayConfig(
    message: any,
    session: EditorSession
  ): Promise<void> {
    const messageSettings = message.settings as DisplaySettings | undefined;
    const settings = messageSettings || session.displaySettings;
    if (!settings) {
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: 'No display settings available to save'
      });
      return;
    }

    const name = await vscode.window.showInputBox({
      prompt: 'Enter configuration name',
      placeHolder: 'My Display Config'
    });
    if (!name) { return; }

    const description = await vscode.window.showInputBox({
      prompt: 'Enter description (optional)',
      placeHolder: 'Description of this configuration'
    });

    try {
      const config = await this.configManager.saveUserConfig(
        name,
        settings,
        description || undefined
      );
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigSaved',
        config: config
      });
      await this.handleGetDisplayConfigs(session.webviewPanel);
    } catch (error) {
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleGetCurrentDisplaySettings(
    webviewPanel: vscode.WebviewPanel,
    key: string
  ): Promise<void> {
    const session = this.sessions.get(key);
    if (session && session.displaySettings) {
      webviewPanel.webview.postMessage({
        command: 'currentDisplaySettings',
        settings: session.displaySettings
      });
    }
  }

  private async handleExportDisplayConfigs(webviewPanel: vscode.WebviewPanel): Promise<void> {
    try {
      const configs = await this.configManager.listConfigs();
      const allConfigs = [...configs.presets, ...configs.user];
      const items = allConfigs.map(c => ({
        label: c.name,
        description: c.isPreset ? 'Preset' : 'User Config',
        picked: false,
        id: c.id
      }));

      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select configurations to export'
      });

      if (!selected || selected.length === 0) { return; }
      await this.configManager.exportConfigs(selected.map(s => s.id!));
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleImportDisplayConfigs(webviewPanel: vscode.WebviewPanel): Promise<void> {
    try {
      await this.configManager.importConfigs();
      await this.handleGetDisplayConfigs(webviewPanel);
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleConfirmDeleteDisplayConfig(configId: string, webviewPanel: vscode.WebviewPanel): Promise<void> {
    if (!configId) { return; }
    try {
      const configs = await this.configManager.listConfigs();
      const target = configs.user.find((c) => c.id === configId);
      if (!target) {
        vscode.window.showErrorMessage('Only user configurations can be deleted');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete "${target.name}"?`,
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') { return; }

      await this.handleDeleteDisplayConfig(configId, webviewPanel);
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleDeleteDisplayConfig(configId: string, webviewPanel: vscode.WebviewPanel): Promise<void> {
    if (!configId) { return; }
    try {
      await this.configManager.deleteConfig(configId);
      await this.handleGetDisplayConfigs(webviewPanel);
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }
}

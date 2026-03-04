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
import type { WebviewToExtensionMessage, ImageSavedMessage, ImageSaveFailedMessage, WireDisplaySettings } from '../shared/protocol';

export class StructureDocument implements vscode.CustomDocument {
  /** Frames restored from a hot-exit backup, if one was present at open time. */
  backupFrames?: Structure[];

  constructor(readonly uri: vscode.Uri) {}

  dispose(): void {
    // No additional resources to release beyond what the provider tracks
  }
}

class EditorSession {
  messageRouter!: MessageRouter;
  
  constructor(
    readonly key: string,
    readonly document: StructureDocument,
    readonly webviewPanel: vscode.WebviewPanel,
    readonly renderer: RenderMessageBuilder,
    readonly trajectoryManager: TrajectoryManager,
    readonly undoManager: UndoManager,
    readonly selectionService: SelectionService,
    readonly bondService: BondService,
    readonly atomEditService: AtomEditService,
    readonly unitCellService: UnitCellService,
    readonly documentService: DocumentService,
    readonly displayConfigService: DisplayConfigService,
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
  private nextSessionId = 0;

  constructor(
    private context: vscode.ExtensionContext,
    private configManager: ConfigManager
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<StructureDocument> {
    const document = new StructureDocument(uri);
    if (openContext.backupId) {
      try {
        const backupUri = vscode.Uri.parse(openContext.backupId);
        const raw = await vscode.workspace.fs.readFile(backupUri);
        const jsonData = JSON.parse(new TextDecoder().decode(raw)) as ReturnType<Structure['toJSON']>[];
        document.backupFrames = jsonData.map(f => Structure.fromJSON(f));
      } catch {
        // If backup cannot be read, fall through to normal file load.
      }
    }
    return document;
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
      frames = document.backupFrames ?? await StructureDocumentManager.load(document.uri);
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

    const key = `session_${++this.nextSessionId}`;
    const traj = new TrajectoryManager(frames, initialFrameIndex);
    const renderer = new RenderMessageBuilder(traj.activeStructure);
    renderer.setTrajectoryFrameInfo(traj.activeIndex, traj.frameCount);

    const undoManager = new UndoManager();
    const selectionService = new SelectionService(renderer);
    const bondService = new BondService(renderer, traj, undoManager, selectionService);
    const atomEditService = new AtomEditService(renderer, traj, undoManager);
    const unitCellService = new UnitCellService(renderer, traj, undoManager);
    const documentService = new DocumentService();
    const displayConfigService = new DisplayConfigService(this.configManager);
    const defaultConfig = this.configManager.getCurrentConfig();
    const displaySettings = defaultConfig?.settings;

    // Create session without messageRouter first to avoid circular dependency
    const session = new EditorSession(
      key,
      document,
      webviewPanel,
      renderer,
      traj,
      undoManager,
      selectionService,
      bondService,
      atomEditService,
      unitCellService,
      documentService,
      displayConfigService,
      displaySettings
    );

    // Set up displayConfigService callbacks
    displayConfigService.setCallbacks(
      (message) => webviewPanel.webview.postMessage(message),
      session
    );

    // Create messageRouter with all required dependencies
    const messageRouter = new MessageRouter(
      renderer,
      traj,
      undoManager,
      selectionService,
      bondService,
      atomEditService,
      unitCellService,
      documentService,
      displayConfigService,
      key,
      webviewPanel,
      () => this.renderStructure(session),
      () => selectionService.clearSelection(),
      displaySettings
    );

    // Set messageRouter in session (hacky but necessary)
    (session as any).messageRouter = messageRouter;

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
        if (savedDoc.uri.fsPath !== session.document.uri.fsPath) {
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
    const { messageRouter } = session;

    if (message.command === 'undo') {
      const hadContent = !session.undoManager.isEmpty;
      this.undoLastEdit(session);
      if (hadContent) {
        this.notifyDocumentChanged(session, 'Undo');
      }
      return;
    }

    if (message.command === 'redo') {
      const hadContent = session.undoManager.canRedo;
      this.redoLastEdit(session);
      if (hadContent) {
        this.notifyDocumentChanged(session, 'Redo');
      }
      return;
    }

    const undoDepthBefore = session.undoManager.depth;
    const handled = await messageRouter.route(message);

    if (handled) {
      if (message.command === 'endDrag') {
        // A drag sequence is complete: re-render and notify dirty if an undo
        // entry was pushed during beginDrag.
        this.renderStructure(session);
        if (session.undoManager.depth > undoDepthBefore) {
          this.notifyDocumentChanged(session, 'Drag');
        }
      } else if (message.command !== 'beginDrag') {
        // Check if a structural change occurred by comparing undo stack depth
        if (session.undoManager.depth > undoDepthBefore) {
          this.notifyDocumentChanged(session, `Command: ${message.command}`);
        }
        this.renderStructure(session);
      }
      return;
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
      // TODO: Phase 8 - properly consolidate DisplaySettings and WireDisplaySettings types
      message.displaySettings = session.displaySettings as unknown as WireDisplaySettings;
    }

    webviewPanel.webview.postMessage(message);
  }

  private notifyDocumentChanged(session: EditorSession, label: string = 'Structure modified'): void {
    this._onDidChangeCustomDocument.fire({
      document: session.document,
      undo: async () => {
        this.undoLastEdit(session);
      },
      redo: async () => {
        this.redoLastEdit(session);
      },
      label,
    });
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
    const session = this.findSessionByDocument(document);
    if (session) {
      return session.documentService.saveStructure(session.key, session.trajectoryManager.activeStructure, session.trajectoryManager.frames);
    }
    return Promise.resolve();
  }

  private findSessionByDocument(document: StructureDocument): EditorSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.document === document) {
        return session;
      }
    }
    return undefined;
  }

  async saveCustomDocumentAs(
    document: StructureDocument,
    destination: vscode.Uri,
    _cancellationToken: vscode.CancellationToken
  ): Promise<void> {
    const session = this.findSessionByDocument(document);
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

  async revertCustomDocument(
    document: StructureDocument,
    _cancellationToken: vscode.CancellationToken
  ): Promise<void> {
    const session = this.findSessionByDocument(document);
    if (!session) {
      return;
    }

    try {
      const updatedFrames = await StructureDocumentManager.load(document.uri);
      if (!updatedFrames || updatedFrames.length === 0) {
        vscode.window.showErrorMessage('Failed to reload structure: no frame found.');
        return;
      }
      const idx = TrajectoryManager.defaultFrameIndex(updatedFrames);
      session.trajectoryManager.set(updatedFrames, idx);
      session.undoManager.clear();
      session.renderer.setStructure(updatedFrames[idx]);
      session.renderer.setShowUnitCell(!!updatedFrames[idx].unitCell);
      session.renderer.setTrajectoryFrameInfo(idx, updatedFrames.length);
      session.selectionService.clearSelection();
      this.renderStructure(session);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to revert document: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async backupCustomDocument(
    document: vscode.CustomDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellationToken: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    const backupUri = context.destination;
    const session = this.findSessionByDocument(document as StructureDocument);
    if (session) {
      const data = JSON.stringify(session.trajectoryManager.frames.map(f => f.toJSON()));
      await vscode.workspace.fs.writeFile(backupUri, Buffer.from(data));
    }
    return {
      id: backupUri.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(backupUri, { useTrash: false });
        } catch {
          // Ignore delete errors for missing or already-removed backups.
        }
      },
    };
  }

  async notifyConfigChange(config: DisplayConfig): Promise<void> {
    // Notify ALL sessions, not just the first active one
    for (const session of this.sessions.values()) {
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
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructureEditorProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fileManager_1 = require("../io/fileManager");
const threejsRenderer_1 = require("../renderers/threejsRenderer");
const atom_1 = require("../models/atom");
/**
 * Custom editor provider for structure files
 */
class StructureEditorProvider {
    context;
    _onDidChangeCustomDocument = new vscode.EventEmitter();
    onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
    webviewPanels = new Map();
    renderers = new Map();
    structures = new Map();
    undoStacks = new Map();
    maxUndoDepth = 100;
    constructor(context) {
        this.context = context;
    }
    async openCustomDocument(uri, openContext, _token) {
        return { uri };
    }
    async resolveCustomEditor(document, webviewPanel, _token) {
        const uri = document.uri.fsPath;
        // Try to load structure from file
        let structure;
        try {
            const fileContent = await vscode.workspace.fs.readFile(document.uri);
            const content = new TextDecoder().decode(fileContent);
            structure = fileManager_1.FileManager.loadStructure(uri, content);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load structure: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        // Store references
        const key = uri;
        this.structures.set(key, structure);
        this.undoStacks.set(key, []);
        this.webviewPanels.set(key, webviewPanel);
        const renderer = new threejsRenderer_1.ThreeJSRenderer(structure);
        this.renderers.set(key, renderer);
        // Setup webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview);
        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message, key, webviewPanel), undefined, this.context.subscriptions);
        const saveListener = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
            if (savedDoc.uri.fsPath !== key) {
                return;
            }
            try {
                const content = savedDoc.getText();
                const updated = fileManager_1.FileManager.loadStructure(key, content);
                this.structures.set(key, updated);
                this.undoStacks.set(key, []);
                renderer.setStructure(updated);
                renderer.deselectAtom();
                this.renderStructure(key, webviewPanel);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Initial render
        this.renderStructure(key, webviewPanel);
        // Cleanup on close
        webviewPanel.onDidDispose(() => {
            this.webviewPanels.delete(key);
            this.renderers.delete(key);
            this.structures.delete(key);
            this.undoStacks.delete(key);
            saveListener.dispose();
        });
    }
    async handleWebviewMessage(message, key, webviewPanel) {
        const renderer = this.renderers.get(key);
        const structure = this.structures.get(key);
        if (!renderer || !structure) {
            return;
        }
        switch (message.command) {
            case 'getState':
                this.renderStructure(key, webviewPanel);
                break;
            case 'beginDrag':
                if (message.atomId) {
                    this.pushUndoSnapshot(key, structure);
                }
                break;
            case 'addAtom': {
                const atom = new atom_1.Atom(message.element.toUpperCase(), message.x || 0, message.y || 0, message.z || 0);
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
                    }
                    else {
                        renderer.selectAtom(message.atomId);
                    }
                    this.renderStructure(key, webviewPanel);
                }
                break;
            }
            case 'toggleVisualization': {
                renderer.toggleVisualization();
                this.renderStructure(key, webviewPanel);
                break;
            }
            case 'toggleUnitCell': {
                renderer.setShowUnitCell(!renderer.getState().showUnitCell);
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
                const ids = Array.isArray(message.atomIds) ? message.atomIds : [];
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
                const updates = Array.isArray(message.atomPositions) ? message.atomPositions : [];
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
                const ids = Array.isArray(message.atomIds) ? message.atomIds : [];
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
                            atomB.setPosition(atomA.x + dx * scale, atomA.y + dy * scale, atomA.z + dz * scale);
                            renderer.setStructure(structure);
                            this.renderStructure(key, webviewPanel);
                        }
                    }
                }
                break;
            }
            case 'copyAtoms': {
                const ids = Array.isArray(message.atomIds) ? message.atomIds : [];
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
                    const copy = new atom_1.Atom(atom.element, atom.x + (offset.x || 0), atom.y + (offset.y || 0), atom.z + (offset.z || 0));
                    structure.addAtom(copy);
                }
                renderer.setStructure(structure);
                this.renderStructure(key, webviewPanel);
                break;
            }
            case 'changeAtoms': {
                const ids = Array.isArray(message.atomIds) ? message.atomIds : [];
                if (ids.length === 0 || !message.element) {
                    break;
                }
                this.pushUndoSnapshot(key, structure);
                const element = String(message.element).toUpperCase();
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
            case 'updateAtom': {
                if (message.atomId) {
                    const atom = structure.getAtom(message.atomId);
                    if (atom) {
                        this.pushUndoSnapshot(key, structure);
                        if (message.element) {
                            atom.element = message.element;
                        }
                        if (typeof message.x === 'number' &&
                            typeof message.y === 'number' &&
                            typeof message.z === 'number') {
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
                if (!structureToSave) {
                    break;
                }
                const formatOptions = [
                    { id: 'cif', label: 'CIF (.cif)' },
                    { id: 'xyz', label: 'XYZ (.xyz)' },
                    { id: 'poscar', label: 'POSCAR' },
                    { id: 'vasp', label: 'VASP (.vasp)' },
                    { id: 'pdb', label: 'PDB (.pdb)' },
                    { id: 'gjf', label: 'Gaussian input (.gjf)' },
                    { id: 'inp', label: 'ORCA input (.inp)' },
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
                const baseName = path.basename(key, path.extname(key));
                const isPoscarFormat = ['poscar', 'vasp'].includes(selectedFormat.toLowerCase());
                const defaultFileName = isPoscarFormat
                    ? baseName || 'structure'
                    : `${baseName || 'structure'}.${selectedFormat}`;
                const saveOptions = {
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
                const content = fileManager_1.FileManager.saveStructure(structureToSave, selectedFormat);
                await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
                break;
            }
            case 'openSource': {
                try {
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(key));
                    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to open source: ${error instanceof Error ? error.message : String(error)}`);
                }
                break;
            }
            case 'reloadStructure': {
                try {
                    const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(key));
                    const content = new TextDecoder().decode(fileContent);
                    const updated = fileManager_1.FileManager.loadStructure(key, content);
                    this.structures.set(key, updated);
                    this.undoStacks.set(key, []);
                    renderer.setStructure(updated);
                    renderer.deselectAtom();
                    this.renderStructure(key, webviewPanel);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`);
                }
                break;
            }
        }
    }
    pushUndoSnapshot(key, structure) {
        const stack = this.undoStacks.get(key);
        if (!stack) {
            return;
        }
        stack.push(structure.clone());
        if (stack.length > this.maxUndoDepth) {
            stack.shift();
        }
    }
    undoLastEdit(key, webviewPanel) {
        const stack = this.undoStacks.get(key);
        const renderer = this.renderers.get(key);
        if (!stack || stack.length === 0 || !renderer) {
            return;
        }
        const previous = stack.pop();
        if (!previous) {
            return;
        }
        this.structures.set(key, previous);
        renderer.setStructure(previous);
        renderer.deselectAtom();
        this.renderStructure(key, webviewPanel);
    }
    renderStructure(key, webviewPanel) {
        const renderer = this.renderers.get(key);
        if (renderer) {
            const message = renderer.getRenderMessage();
            webviewPanel.webview.postMessage(message);
        }
    }
    async saveStructure(key) {
        const structure = this.structures.get(key);
        if (!structure) {
            return;
        }
        try {
            const format = fileManager_1.FileManager.resolveFormat(key, 'xyz');
            const content = fileManager_1.FileManager.saveStructure(structure, format);
            const uri = vscode.Uri.file(key);
            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to save structure: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getWebviewContent(webview) {
        const csp = `default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src ${webview.cspSource}`;
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'styles.css'));
        const threeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'three', 'build', 'three.min.js'));
        const orbitControlsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'three', 'examples', 'js', 'controls', 'OrbitControls.js'));
        const stateUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'state.js'));
        const rendererUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'renderer.js'));
        const interactionUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'interaction.js'));
        const appUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'app.js'));
        const templatePath = path.join(this.context.extensionPath, 'src', 'webview', 'index.html');
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
    saveCustomDocument(document, _cancellationToken) {
        return this.saveStructure(document.uri.fsPath);
    }
    saveCustomDocumentAs(document, destination, _cancellationToken) {
        const structure = this.structures.get(document.uri.fsPath);
        if (!structure) {
            return Promise.resolve();
        }
        const format = fileManager_1.FileManager.resolveFormat(destination.fsPath, 'xyz');
        const content = fileManager_1.FileManager.saveStructure(structure, format);
        return vscode.workspace.fs.writeFile(destination, new TextEncoder().encode(content));
    }
    revertCustomDocument(document, _cancellationToken) {
        return Promise.resolve();
    }
    backupCustomDocument(document, context, _cancellationToken) {
        const backupUri = context.destination;
        return Promise.resolve({
            id: backupUri.toString(),
            delete: async () => {
                try {
                    await vscode.workspace.fs.delete(backupUri, { useTrash: false });
                }
                catch {
                    // Ignore delete errors for missing or already-removed backups.
                }
            },
        });
    }
}
exports.StructureEditorProvider = StructureEditorProvider;
//# sourceMappingURL=structureEditorProvider.js.map
"use strict";
/**
 * ACoord - Atomic Coordinates
 * Main extension activation and command registration
 */
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const structureEditorProvider_1 = require("./providers/structureEditorProvider");
const structure_1 = require("./models/structure");
const atom_1 = require("./models/atom");
const unitCell_1 = require("./models/unitCell");
const fileManager_1 = require("./io/fileManager");
/**
 * Extension activation
 */
function activate(context) {
    console.log('ACoord extension is now active!');
    // Register custom editor provider
    const editorProvider = new structureEditorProvider_1.StructureEditorProvider(context);
    context.subscriptions.push(vscode.window.registerCustomEditorProvider('acoord.structureEditor', editorProvider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: true,
    }));
    // Command: Create new molecule
    context.subscriptions.push(vscode.commands.registerCommand('acoord.createNewMolecule', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter molecule name',
            value: 'molecule',
        });
        if (!name)
            return;
        const structure = new structure_1.Structure(name, false);
        const content = fileManager_1.FileManager.saveStructure(structure, 'xyz');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        const fileName = `${name}.xyz`;
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
        });
    }));
    // Command: Create new crystal
    context.subscriptions.push(vscode.commands.registerCommand('acoord.createNewCrystal', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter crystal name',
            value: 'crystal',
        });
        if (!name)
            return;
        const structure = new structure_1.Structure(name, true);
        structure.unitCell = new unitCell_1.UnitCell(5.0, 5.0, 5.0, 90, 90, 90);
        // Add some example atoms
        structure.addAtom(new atom_1.Atom('C', 0.0, 0.0, 0.0));
        structure.addAtom(new atom_1.Atom('C', 0.5, 0.5, 0.0));
        structure.addAtom(new atom_1.Atom('C', 0.5, 0.0, 0.5));
        structure.addAtom(new atom_1.Atom('C', 0.0, 0.5, 0.5));
        const content = fileManager_1.FileManager.saveStructure(structure, 'cif');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        const fileName = `${name}.cif`;
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
        });
    }));
    // Command: Export structure
    context.subscriptions.push(vscode.commands.registerCommand('acoord.exportStructure', async (fileUri) => {
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }
        if (!fileUri) {
            vscode.window.showErrorMessage('No file open to export');
            return;
        }
        const formats = fileManager_1.FileManager.getSupportedFormats();
        const selectedFormat = await vscode.window.showQuickPick(formats, {
            placeHolder: 'Select export format',
        });
        if (!selectedFormat)
            return;
        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        const content = new TextDecoder().decode(fileContent);
        try {
            const structure = fileManager_1.FileManager.loadStructure(fileUri.fsPath, content);
            const exportContent = fileManager_1.FileManager.saveStructure(structure, selectedFormat);
            const originalName = fileUri.fsPath.split(/[\\/]/).pop()?.split('.')[0] || 'structure';
            const isPoscarFormat = ['poscar', 'vasp'].includes(selectedFormat.toLowerCase());
            const defaultFileName = isPoscarFormat
                ? `${originalName}_export`
                : `${originalName}_export.${selectedFormat}`;
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }
            const saveOptions = {
                saveLabel: 'Export Structure As',
                defaultUri: vscode.Uri.joinPath(workspaceFolder.uri, defaultFileName),
            };
            if (!isPoscarFormat) {
                saveOptions.filters = {
                    'Structure Files': ['cif', 'xyz', 'poscar', 'vasp', 'pdb'],
                };
            }
            const exportUri = await vscode.window.showSaveDialog(saveOptions);
            if (!exportUri) {
                return;
            }
            await vscode.workspace.fs.writeFile(exportUri, new TextEncoder().encode(exportContent));
            vscode.window.showInformationMessage(`Structure exported to ${exportUri.fsPath.split(/[\\/]/).pop()}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // Command: Open structure editor preview
    context.subscriptions.push(vscode.commands.registerCommand('acoord.openStructureEditor', async (fileUri) => {
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }
        if (!fileUri) {
            vscode.window.showErrorMessage('No structure file open');
            return;
        }
        await vscode.commands.executeCommand('vscode.openWith', fileUri, 'acoord.structureEditor', vscode.ViewColumn.Beside);
    }));
    // Command: Add atom (placeholder for future enhancement)
    context.subscriptions.push(vscode.commands.registerCommand('acoord.addAtom', () => {
        vscode.window.showInformationMessage('Use the ACoord editor to add atoms');
    }));
    // Command: Delete atom (placeholder)
    context.subscriptions.push(vscode.commands.registerCommand('acoord.deleteAtom', () => {
        vscode.window.showInformationMessage('Use the ACoord editor to delete atoms');
    }));
    // Command: Toggle visualization
    context.subscriptions.push(vscode.commands.registerCommand('acoord.toggleVisualization', () => {
        vscode.window.showInformationMessage('Use the ACoord editor to toggle visualization');
    }));
    console.log('ACoord commands registered successfully');
}
/**
 * Extension deactivation
 */
function deactivate() {
    console.log('ACoord extension deactivated');
}
//# sourceMappingURL=extension.js.map
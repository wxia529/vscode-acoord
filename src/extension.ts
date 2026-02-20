/**
 * ACoord - Atomic Coordinates
 * Main extension activation and command registration
 */

import * as vscode from 'vscode';
import { StructureEditorProvider } from './providers/structureEditorProvider';
import { Structure } from './models/structure';
import { Atom } from './models/atom';
import { UnitCell } from './models/unitCell';
import { FileManager } from './io/fileManager';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('ACoord extension is now active!');

  // Register custom editor provider
  const editorProvider = new StructureEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'acoord.structureEditor',
      editorProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: true,
      }
    )
  );

  // Command: Create new molecule
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'acoord.createNewMolecule',
      async () => {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter molecule name',
          value: 'molecule',
        });

        if (!name) return;

        const structure = new Structure(name, false);
        const content = FileManager.saveStructure(structure, 'xyz');

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }

        const fileName = `${name}.xyz`;
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);

        await vscode.workspace.fs.writeFile(
          fileUri,
          new TextEncoder().encode(content)
        );

        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
        });
      }
    )
  );

  // Command: Create new crystal
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'acoord.createNewCrystal',
      async () => {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter crystal name',
          value: 'crystal',
        });

        if (!name) return;

        const structure = new Structure(name, true);
        structure.unitCell = new UnitCell(5.0, 5.0, 5.0, 90, 90, 90);

        // Add some example atoms
        structure.addAtom(new Atom('C', 0.0, 0.0, 0.0));
        structure.addAtom(new Atom('C', 0.5, 0.5, 0.0));
        structure.addAtom(new Atom('C', 0.5, 0.0, 0.5));
        structure.addAtom(new Atom('C', 0.0, 0.5, 0.5));

        const content = FileManager.saveStructure(structure, 'cif');

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }

        const fileName = `${name}.cif`;
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);

        await vscode.workspace.fs.writeFile(
          fileUri,
          new TextEncoder().encode(content)
        );

        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
        });
      }
    )
  );

  // Command: Export structure
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'acoord.exportStructure',
      async (fileUri?: vscode.Uri) => {
        if (!fileUri && vscode.window.activeTextEditor) {
          fileUri = vscode.window.activeTextEditor.document.uri;
        }

        if (!fileUri) {
          vscode.window.showErrorMessage('No file open to export');
          return;
        }

        const formats = FileManager.getSupportedFormats();
        const selectedFormat = await vscode.window.showQuickPick(formats, {
          placeHolder: 'Select export format',
        });

        if (!selectedFormat) return;

        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        const content = new TextDecoder().decode(fileContent);

        try {
          const structure = FileManager.loadStructure(
            fileUri.fsPath,
            content
          );
          const exportContent = FileManager.saveStructure(structure, selectedFormat);

          const originalName =
            fileUri.fsPath.split(/[\\/]/).pop()?.split('.')[0] || 'structure';
          const isPoscarFormat = ['poscar', 'vasp'].includes(selectedFormat.toLowerCase());
          const defaultFileName = isPoscarFormat
            ? `${originalName}_export`
            : `${originalName}_export.${selectedFormat}`;

          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
          }

          const saveOptions: vscode.SaveDialogOptions = {
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

          await vscode.workspace.fs.writeFile(
            exportUri,
            new TextEncoder().encode(exportContent)
          );

          vscode.window.showInformationMessage(
            `Structure exported to ${exportUri.fsPath.split(/[\\/]/).pop()}`
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Export failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    )
  );

  // Command: Open structure editor preview
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'acoord.openStructureEditor',
      async (fileUri?: vscode.Uri) => {
        if (!fileUri && vscode.window.activeTextEditor) {
          fileUri = vscode.window.activeTextEditor.document.uri;
        }

        if (!fileUri) {
          vscode.window.showErrorMessage('No structure file open');
          return;
        }

        await vscode.commands.executeCommand(
          'vscode.openWith',
          fileUri,
          'acoord.structureEditor',
          vscode.ViewColumn.Beside
        );
      }
    )
  );

  // Command: Add atom (placeholder for future enhancement)
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.addAtom', () => {
      vscode.window.showInformationMessage(
        'Use the ACoord editor to add atoms'
      );
    })
  );

  // Command: Delete atom (placeholder)
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.deleteAtom', () => {
      vscode.window.showInformationMessage(
        'Use the ACoord editor to delete atoms'
      );
    })
  );

  // Command: Toggle visualization
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'acoord.toggleVisualization',
      () => {
        vscode.window.showInformationMessage(
          'Use the ACoord editor to toggle visualization'
        );
      }
    )
  );

  console.log('ACoord commands registered successfully');
}

/**
 * Extension deactivation
 */
export function deactivate() {
  console.log('ACoord extension deactivated');
}

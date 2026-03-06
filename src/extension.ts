/**
 * ACoord - Atomic Coordinates
 * Main extension activation and command registration
 */

import * as vscode from 'vscode';
import { StructureEditorProvider } from './providers/structureEditorProvider.js';
import { Structure } from './models/structure.js';
import { Atom } from './models/atom.js';
import { UnitCell } from './models/unitCell.js';
import { FileManager } from './io/fileManager.js';
import { ConfigManager } from './config/configManager.js';
import { ColorSchemeManager } from './config/colorSchemeManager.js';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('ACoord extension is now active!');

  // Initialize config manager
  const configManager = new ConfigManager(context);
  const colorSchemeManager = new ColorSchemeManager(context);
  
  // Register custom editor provider
  const editorProvider = new StructureEditorProvider(context, configManager);
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
  
  // Initialize managers
  configManager.initialize().catch(console.error);
  colorSchemeManager.initialize().catch(console.error);
  
  // Dispose color scheme manager on extension deactivate
  context.subscriptions.push({
    dispose: () => colorSchemeManager.dispose()
  });

  // Command: Create new molecule
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'acoord.createNewMolecule',
      async () => {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter molecule name',
          value: 'molecule',
        });

        if (!name) {return;}

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

        if (!name) {return;}

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

        if (!selectedFormat) {return;}

        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        const content = new TextDecoder().decode(fileContent);

        try {
          const structures = FileManager.loadStructures(
            fileUri.fsPath,
            content
          );
          const primaryStructure = structures[structures.length - 1];
          let exportStructures: Structure[] = [primaryStructure];
          if ((selectedFormat === 'xyz' || selectedFormat === 'xdatcar') && structures.length > 1) {
            const scope = await vscode.window.showQuickPick(
              [
                { id: 'current', label: 'Current Frame (last frame)' },
                { id: 'all', label: `Whole Trajectory (${structures.length} frames)` },
              ],
              {
                placeHolder: `Select ${selectedFormat.toUpperCase()} export scope`,
                ignoreFocusOut: true,
              }
            );
            if (!scope) {
              return;
            }
            exportStructures = scope.id === 'all' ? structures : [primaryStructure];
          }
          const exportContent =
            (selectedFormat === 'xyz' || selectedFormat === 'xdatcar') && exportStructures.length > 1
              ? FileManager.saveStructures(exportStructures, selectedFormat)
              : FileManager.saveStructure(exportStructures[0], selectedFormat);

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
                'Structure Files': ['cif', 'xyz', 'poscar', 'vasp', 'xdatcar', 'pdb', 'gjf', 'inp', 'in', 'pwi', 'stru'],
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
        // Initialize config manager on first use
        await configManager.initialize();
        
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

  // === Display Configuration Commands ===
  
  // Command: Select display configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.selectDisplayConfig', async () => {
      await configManager.initialize();
      const configs = await configManager.listConfigs();
      
      interface ConfigItem extends vscode.QuickPickItem {
        id?: string;
      }
      
      const items: ConfigItem[] = [
        { label: '$(star) Presets', kind: vscode.QuickPickItemKind.Separator },
        ...configs.presets.map((preset: { id: string; name: string; description?: string }) => ({
          label: preset.name,
          description: 'Preset',
          detail: preset.description,
          id: preset.id
        })),
        { label: '$(folder) Your Configs', kind: vscode.QuickPickItemKind.Separator },
        ...configs.user.map((c: { id: string; name: string; description?: string }) => ({
          label: c.name,
          description: 'User Config',
          id: c.id
        }))
      ];
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a display configuration'
      });
      
      if (selected && selected.id) {
        try {
          const config = await configManager.loadConfig(selected.id);
          vscode.window.showInformationMessage(`Loaded configuration: ${config.name}`);
          
          // Notify all webviews about the config change
          editorProvider.notifyConfigChange(config);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to load config: ${error}`);
        }
      }
    })
  );

  // Command: Save current display settings as new config
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.saveDisplayConfig', async () => {
      await configManager.initialize();
      
      const name = await vscode.window.showInputBox({
        prompt: 'Enter configuration name',
        placeHolder: 'My Display Config'
      });
      
      if (!name) { return; }
      
      const description = await vscode.window.showInputBox({
        prompt: 'Enter description (optional)',
        placeHolder: 'Description of this configuration'
      });
      
      // Get current settings from the active webview
      const settings = await editorProvider.getCurrentDisplaySettings();
      if (!settings) {
        vscode.window.showErrorMessage('No active editor to save settings from');
        return;
      }
      
      try {
        const config = await configManager.saveUserConfig(name, settings, description || undefined);
        vscode.window.showInformationMessage(`Saved configuration: ${config.name}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to save config: ${error}`);
      }
    })
  );

  // Command: Export display configurations
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.exportDisplayConfigs', async () => {
      await configManager.initialize();
      const configs = await configManager.listConfigs();
      
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
      
      await configManager.exportConfigs(selected.map(s => s.id!));
    })
  );

  // Command: Import display configurations
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.importDisplayConfigs', async () => {
      await configManager.initialize();
      await configManager.importConfigs();
    })
  );

  // Command: Delete display configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.deleteDisplayConfig', async () => {
      await configManager.initialize();
      const configs = await configManager.listConfigs();
      
      interface ConfigItem extends vscode.QuickPickItem {
        id?: string;
      }
      
      const items: ConfigItem[] = configs.user.map((c: { id: string; name: string }) => ({
        label: c.name,
        description: 'User Config',
        id: c.id
      }));
      
      if (items.length === 0) {
        vscode.window.showInformationMessage('No user configurations to delete');
        return;
      }
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a configuration to delete'
      });
      
      if (selected && selected.id) {
        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you delete "${selected.label}"?`,
          { modal: true },
          'Delete'
        );
        
        if (confirm === 'Delete') {
          try {
            await configManager.deleteConfig(selected.id);
            vscode.window.showInformationMessage(`Deleted configuration: ${selected.label}`);
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete: ${error}`);
          }
        }
      }
    })
  );

  // Command: Export color scheme
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.exportColorScheme', async () => {
      await colorSchemeManager.initialize();
      const schemes = await colorSchemeManager.listSchemes();
      
      const userSchemes = schemes.filter(s => !s.isPreset);
      if (userSchemes.length === 0) {
        vscode.window.showInformationMessage('No user color schemes to export');
        return;
      }
      
      const items = userSchemes.map(s => ({
        label: s.name,
        description: s.id,
        picked: true
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select color schemes to export',
        canPickMany: true
      });
      
      if (!selected || selected.length === 0) {
        return;
      }
      
      const schemeIds = selected.map(s => s.description!);
      const packageData = await colorSchemeManager.exportSchemes(schemeIds);
      
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`acoord-color-schemes-${new Date().toISOString().split('T')[0]}.json`),
        filters: {
          'ACoord Color Schemes': ['json']
        }
      });
      
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(packageData, null, 2)));
        vscode.window.showInformationMessage(`Exported ${schemeIds.length} color scheme(s)`);
      }
    })
  );

  // Command: Import color scheme
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.importColorScheme', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'ACoord Color Schemes': ['json']
        }
      });
      
      if (!uris || uris.length === 0) {
        return;
      }
      
      const content = await vscode.workspace.fs.readFile(uris[0]);
      const packageData = JSON.parse(content.toString());
      
      if (!packageData.colorSchemes || !Array.isArray(packageData.colorSchemes)) {
        vscode.window.showErrorMessage('Invalid color scheme file');
        return;
      }
      
      await colorSchemeManager.importSchemes({
        version: packageData.version,
        exportedAt: packageData.exportedAt,
        exportedFrom: packageData.exportedFrom,
        colorSchemes: packageData.colorSchemes
      });
      
      vscode.window.showInformationMessage(`Imported ${packageData.colorSchemes.length} color scheme(s)`);
    })
  );

  // Command: Manage color schemes
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.manageColorSchemes', async () => {
      await colorSchemeManager.initialize();
      const schemes = await colorSchemeManager.listSchemes();
      
      interface SchemeItem extends vscode.QuickPickItem {
        id: string;
        isPreset: boolean;
      }
      
      const items: SchemeItem[] = schemes.map(s => ({
        label: s.name,
        description: s.isPreset ? 'Preset' : 'User',
        id: s.id,
        isPreset: s.isPreset
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a color scheme to manage'
      });
      
      if (!selected) {
        return;
      }
      
      if (selected.isPreset) {
        vscode.window.showInformationMessage(`"${selected.label}" is a read-only preset`);
        return;
      }
      
      const action = await vscode.window.showQuickPick([
        { label: 'Delete', description: 'Delete this color scheme' },
        { label: 'Export', description: 'Export this color scheme' }
      ], {
        placeHolder: 'Select action'
      });
      
      if (action?.label === 'Delete') {
        const confirm = await vscode.window.showWarningMessage(
          `Delete "${selected.label}"?`,
          { modal: true },
          'Delete'
        );
        
        if (confirm === 'Delete') {
          try {
            await colorSchemeManager.deleteScheme(selected.id);
            vscode.window.showInformationMessage(`Deleted: ${selected.label}`);
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete: ${error}`);
          }
        }
      } else if (action?.label === 'Export') {
        const packageData = await colorSchemeManager.exportSchemes([selected.id]);
        
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`${selected.label.replace(/\s+/g, '_')}.json`),
          filters: {
            'ACoord Color Schemes': ['json']
          }
        });
        
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(packageData, null, 2)));
          vscode.window.showInformationMessage(`Exported: ${selected.label}`);
        }
      }
    })
  );

  console.log('ACoord commands registered successfully');
}

/**
 * Extension deactivation
 */
export function deactivate() {
  console.log('ACoord extension deactivated');
}

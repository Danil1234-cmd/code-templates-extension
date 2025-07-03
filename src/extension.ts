import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class TemplateItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = this.filePath;
        this.contextValue = 'template-item';
        this.command = {
            command: 'codeTemplates.createFileFromTemplate',
            title: 'Create File from Template',
            arguments: [this]
        };
    }

    iconPath = new vscode.ThemeIcon('file');
}

class TemplateTreeDataProvider implements vscode.TreeDataProvider<TemplateItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TemplateItem | undefined | null | void> = new vscode.EventEmitter<TemplateItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TemplateItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private templatesDir: string) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TemplateItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TemplateItem): Thenable<TemplateItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            return this.getTemplates();
        }
    }

    private async getTemplates(): Promise<TemplateItem[]> {
        if (!fs.existsSync(this.templatesDir)) {
            return [];
        }
        const files = fs.readdirSync(this.templatesDir);
        const templates = files
            .filter(file => fs.statSync(path.join(this.templatesDir, file)).isFile())
            .map(file => new TemplateItem(file, path.join(this.templatesDir, file), vscode.TreeItemCollapsibleState.None));
        return templates;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const templatesDir = path.join(context.globalStorageUri.fsPath, 'templates');
    
    // Ensure templates directory exists
    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
        // Create example templates
        fs.writeFileSync(path.join(templatesDir, 'example.js'), 'console.log("Hello from template!");');
        fs.writeFileSync(path.join(templatesDir, 'snippet.html'), '<div class="container">\n  <!-- Your content -->\n</div>');
    }

    // Helper function to get template files
    function getTemplateFiles(): string[] {
        return fs.readdirSync(templatesDir).filter(file => 
            fs.statSync(path.join(templatesDir, file)).isFile()
        );
    }

    // Tree View
    const treeDataProvider = new TemplateTreeDataProvider(templatesDir);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('codeTemplatesView', treeDataProvider));
    const treeView = vscode.window.createTreeView('codeTemplatesView', { 
        treeDataProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(treeView);

    // Refresh tree view
    function refreshTreeView() {
        treeDataProvider.refresh();
    }

    // Insert template command
    const insertTemplate = vscode.commands.registerCommand('codeTemplates.insertTemplate', async () => {
        const templateFiles = getTemplateFiles();
        if (templateFiles.length === 0) {
            vscode.window.showInformationMessage('No templates found. Create one first!');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            templateFiles.map(f => ({
                label: f,
                description: `Template: ${f}`
            })),
            { placeHolder: 'Select template to insert' }
        );

        if (selected) {
            const filePath = path.join(templatesDir, selected.label);
            const content = fs.readFileSync(filePath, 'utf8');
            const editor = vscode.window.activeTextEditor;
            
            if (editor) {
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, content);
                });
            }
        }
    });

    // Create template command
    const createTemplate = vscode.commands.registerCommand('codeTemplates.createTemplate', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter template name (with extension, e.g.: mytemplate.js)',
            validateInput: text => {
                if (!text) return "Name can't be empty";
                if (fs.existsSync(path.join(templatesDir, text))) return "Template already exists!";
                return null;
            }
        });

        if (name) {
            const filePath = path.join(templatesDir, name);
            fs.writeFileSync(filePath, '');
            vscode.window.showInformationMessage(`Template '${name}' created!`);
            refreshTreeView();
            
            // Open file for editing
            const doc = await vscode.workspace.openTextDocument(filePath);
            vscode.window.showTextDocument(doc);
        }
    });

    // Create template from selection
    const createTemplateFromSelection = vscode.commands.registerCommand('codeTemplates.createTemplateFromSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor');
            return;
        }
        const selection = editor.document.getText(editor.selection);
        if (!selection) {
            vscode.window.showInformationMessage('No text selected');
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Enter template name (with extension, e.g.: mytemplate.js)',
            validateInput: text => {
                if (!text) return "Name can't be empty";
                if (fs.existsSync(path.join(templatesDir, text))) return "Template already exists!";
                return null;
            }
        });

        if (name) {
            const filePath = path.join(templatesDir, name);
            fs.writeFileSync(filePath, selection);
            vscode.window.showInformationMessage(`Template '${name}' created from selection!`);
            refreshTreeView();
        }
    });

    // Delete template command
    const deleteTemplate = vscode.commands.registerCommand('codeTemplates.deleteTemplate', async (templateItem?: TemplateItem) => {
        let templateName: string | undefined;
        if (templateItem) {
            templateName = templateItem.label;
        } else {
            const templateFiles = getTemplateFiles();
            if (templateFiles.length === 0) {
                vscode.window.showInformationMessage('No templates found to delete.');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                templateFiles.map(f => ({
                    label: f,
                    description: `Delete template: ${f}`
                })),
                { placeHolder: 'Select template to delete' }
            );
            if (selected) {
                templateName = selected.label;
            }
        }

        if (templateName) {
            const filePath = path.join(templatesDir, templateName);
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage(`Template "${templateName}" not found!`);
                return;
            }

            const confirm = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: `Are you sure you want to delete "${templateName}"?`
            });
            
            if (confirm === 'Yes') {
                fs.unlinkSync(filePath);
                vscode.window.showInformationMessage(`Template '${templateName}' deleted!`);
                refreshTreeView();
            }
        }
    });

    // Copy template content to clipboard
    const copyTemplateContent = vscode.commands.registerCommand('codeTemplates.copyTemplateContent', async (templateItem: TemplateItem) => {
        if (!templateItem) {
            return;
        }
        const content = fs.readFileSync(templateItem.filePath, 'utf8');
        vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage(`Template "${templateItem.label}" copied to clipboard!`);
    });

    // Create file from template
    const createFileFromTemplate = vscode.commands.registerCommand('codeTemplates.createFileFromTemplate', async (templateItem: TemplateItem) => {
        if (!templateItem) {
            return;
        }
        const content = fs.readFileSync(templateItem.filePath, 'utf8');
        
        // Ask for file name and location
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter file name (with extension)',
            value: templateItem.label
        });
        
        if (!fileName) {
            return;
        }
        
        // Ask for file location
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName),
            saveLabel: 'Create File'
        });
        
        if (uri) {
            fs.writeFileSync(uri.fsPath, content);
            const doc = await vscode.workspace.openTextDocument(uri);
            vscode.window.showTextDocument(doc);
            vscode.window.showInformationMessage(`File created from template "${templateItem.label}"`);
        }
    });

    // Edit template command
    const editTemplate = vscode.commands.registerCommand('codeTemplates.editTemplate', async (templateItem: TemplateItem) => {
        if (!templateItem) {
            return;
        }
        // Open the template file for editing
        const doc = await vscode.workspace.openTextDocument(templateItem.filePath);
        vscode.window.showTextDocument(doc);
    });

    // Open templates folder command
    const openTemplatesFolder = vscode.commands.registerCommand('codeTemplates.openFolder', async () => {
        const uri = vscode.Uri.file(templatesDir);
        vscode.commands.executeCommand('revealFileInOS', uri);
    });

    context.subscriptions.push(
        insertTemplate, 
        createTemplate, 
        createTemplateFromSelection,
        deleteTemplate,
        copyTemplateContent,
        createFileFromTemplate,
        editTemplate,
        openTemplatesFolder
    );
}

export function deactivate() {}
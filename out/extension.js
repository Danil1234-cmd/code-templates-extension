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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class TemplateItem extends vscode.TreeItem {
    constructor(label, filePath, collapsibleState) {
        super(label, collapsibleState);
        this.label = label;
        this.filePath = filePath;
        this.collapsibleState = collapsibleState;
        this.iconPath = new vscode.ThemeIcon('file');
        this.tooltip = `${this.label}`;
        this.description = this.filePath;
        this.contextValue = 'template-item';
        this.command = {
            command: 'codeTemplates.createFileFromTemplate',
            title: 'Create File from Template',
            arguments: [this]
        };
    }
}
class TemplateTreeDataProvider {
    constructor(templatesDir) {
        this.templatesDir = templatesDir;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        else {
            return this.getTemplates();
        }
    }
    async getTemplates() {
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
function activate(context) {
    const templatesDir = path.join(context.globalStorageUri.fsPath, 'templates');
    // Ensure templates directory exists
    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
        // Create example templates
        fs.writeFileSync(path.join(templatesDir, 'example.js'), 'console.log("Hello from template!");');
        fs.writeFileSync(path.join(templatesDir, 'snippet.html'), '<div class="container">\n  <!-- Your content -->\n</div>');
    }
    // Helper function to get template files
    function getTemplateFiles() {
        return fs.readdirSync(templatesDir).filter(file => fs.statSync(path.join(templatesDir, file)).isFile());
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
        const selected = await vscode.window.showQuickPick(templateFiles.map(f => ({
            label: f,
            description: `Template: ${f}`
        })), { placeHolder: 'Select template to insert' });
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
                if (!text)
                    return "Name can't be empty";
                if (fs.existsSync(path.join(templatesDir, text)))
                    return "Template already exists!";
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
                if (!text)
                    return "Name can't be empty";
                if (fs.existsSync(path.join(templatesDir, text)))
                    return "Template already exists!";
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
    const deleteTemplate = vscode.commands.registerCommand('codeTemplates.deleteTemplate', async (templateItem) => {
        let templateName;
        if (templateItem) {
            templateName = templateItem.label;
        }
        else {
            const templateFiles = getTemplateFiles();
            if (templateFiles.length === 0) {
                vscode.window.showInformationMessage('No templates found to delete.');
                return;
            }
            const selected = await vscode.window.showQuickPick(templateFiles.map(f => ({
                label: f,
                description: `Delete template: ${f}`
            })), { placeHolder: 'Select template to delete' });
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
    const copyTemplateContent = vscode.commands.registerCommand('codeTemplates.copyTemplateContent', async (templateItem) => {
        if (!templateItem) {
            return;
        }
        const content = fs.readFileSync(templateItem.filePath, 'utf8');
        vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage(`Template "${templateItem.label}" copied to clipboard!`);
    });
    // Create file from template
    const createFileFromTemplate = vscode.commands.registerCommand('codeTemplates.createFileFromTemplate', async (templateItem) => {
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
    const editTemplate = vscode.commands.registerCommand('codeTemplates.editTemplate', async (templateItem) => {
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
    context.subscriptions.push(insertTemplate, createTemplate, createTemplateFromSelection, deleteTemplate, copyTemplateContent, createFileFromTemplate, editTemplate, openTemplatesFolder);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map
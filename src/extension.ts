import * as vscode from 'vscode';
import { StateService } from './services/stateService';
import { TemplateService } from './services/templateService';
import { RubricService } from './services/rubricService';
import { StatusViewProvider } from './views/statusViewProvider';
import { registerAllCommands } from './commands/registerCommands';
import { LATEST_SCHEMA_VERSION } from './shared-references/stateManagement';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('✅ AI chat buddy 扩展已激活');

    const stateService = new StateService();
    const templateService = new TemplateService(context);
    const rubricService = new RubricService();

    // 注册状态看板视图
    const statusViewProvider = new StatusViewProvider(stateService);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'ai-chat-buddy.statusView',
            statusViewProvider
        )
    );

    // 注册所有命令
    registerAllCommands(context, stateService, templateService, statusViewProvider);

    // 状态栏项
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'ai-chat-buddy.status';
    statusBarItem.text = '$(graph-scatter) Cheat';
    statusBarItem.tooltip = 'AI chat buddy for self-media creators - 查看状态看板';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 检查当前工作区是否是 cheat 项目
    checkProjectState(stateService, statusBarItem);
}

async function checkProjectState(
    stateService: StateService,
    statusBarItem: vscode.StatusBarItem
) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        statusBarItem.text = '$(graph-scatter) Cheat (无工作区)';
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    try {
        const state = await stateService.readState(rootPath);
        if (state) {
            const calibrationSamples = state.calibration_samples || 0;
            const buffer = state.buffer || 0;
            statusBarItem.text = `$(graph-scatter) Cheat (${calibrationSamples}样本, buffer:${buffer})`;
        } else {
            statusBarItem.text = '$(graph-scatter) Cheat (未初始化)';
        }
    } catch {
        statusBarItem.text = '$(graph-scatter) Cheat';
    }
}

export function deactivate() {}

import * as vscode from 'vscode';
import { StateService } from '../services/stateService';
import { TemplateService } from '../services/templateService';
import { PredictionService } from '../services/predictionService';
import { RubricService } from '../services/rubricService';
import { StatusViewProvider } from '../views/statusViewProvider';
import { cheatInit } from './cheatInit';
import { cheatStatus } from './cheatStatus';
import { cheatScore } from './cheatScore';
import { cheatPredict } from './cheatPredict';
import { cheatShoot } from './cheatShoot';
import { cheatPublish } from './cheatPublish';
import { cheatRetro } from './cheatRetro';
import { cheatLearnFrom } from './cheatLearnFrom';
import { cheatSeed } from './cheatSeed';
import { cheatTrends } from './cheatTrends';
import { cheatRecommend } from './cheatRecommend';
import { cheatPersona } from './cheatPersona';
import { cheatBump } from './cheatBump';
import { cheatMigrate } from './cheatMigrate';

export function registerAllCommands(
    context: vscode.ExtensionContext,
    stateService: StateService,
    templateService: TemplateService,
    statusViewProvider: StatusViewProvider
): void {
    const predictionService = new PredictionService();
    const rubricService = new RubricService();

    const register = (command: string, callback: (...args: any[]) => any) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, callback)
        );
    };

    register('ai-chat-buddy.init', () => cheatInit(stateService, templateService, rubricService));
    register('ai-chat-buddy.status', () => cheatStatus(stateService));
    register('ai-chat-buddy.score', (uri?: vscode.Uri) => {
        const scriptPath = uri?.fsPath;
        cheatScore(stateService, rubricService, scriptPath);
    });
    register('ai-chat-buddy.predict', (uri?: vscode.Uri) => {
        const scriptPath = uri?.fsPath;
        cheatPredict(stateService, predictionService, rubricService, scriptPath);
    });
    register('ai-chat-buddy.shoot', () => cheatShoot(stateService));
    register('ai-chat-buddy.publish', () => cheatPublish(stateService));
    register('ai-chat-buddy.retro', () => cheatRetro(stateService));
    register('ai-chat-buddy.learnFrom', () => cheatLearnFrom(stateService));
    register('ai-chat-buddy.seed', () => cheatSeed(stateService));
    register('ai-chat-buddy.trends', () => cheatTrends(stateService));
    register('ai-chat-buddy.recommend', () => cheatRecommend(stateService));
    register('ai-chat-buddy.persona', () => cheatPersona(stateService));
    register('ai-chat-buddy.bump', () => cheatBump(stateService));
    register('ai-chat-buddy.migrate', () => cheatMigrate(stateService));

    // 快速打分（当前编辑器内容）
    register('ai-chat-buddy.quickScore', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath.endsWith('.md')) {
            cheatScore(stateService, rubricService, editor.document.uri.fsPath);
        } else {
            vscode.window.showInformationMessage('请先打开一个 Markdown 脚本文件。');
        }
    });

    // 打开工作流速查
    register('ai-chat-buddy.openWorkflow', async () => {
        const root = stateService.getWorkspaceRoot();
        if (!root) {
            vscode.window.showErrorMessage('请先打开工作区');
            return;
        }
        const workflowPath = vscode.Uri.joinPath(
            vscode.Uri.file(root), 'WORKFLOW.md'
        );
        try {
            const doc = await vscode.workspace.openTextDocument(workflowPath);
            await vscode.window.showTextDocument(doc);
        } catch {
            vscode.window.showErrorMessage('WORKFLOW.md 不存在，请先初始化项目。');
        }
    });
}

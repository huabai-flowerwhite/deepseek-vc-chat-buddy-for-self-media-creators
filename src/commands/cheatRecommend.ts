/**
 * /cheat-recommend — 候选池排序推荐（按 buffer 颜色 + 1 稳 + 1 实验）
 * 
 * 对应 cheat-on-content: skills/cheat-recommend/SKILL.md
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';

export async function cheatRecommend(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    const candidatesPath = path.join(root, 'candidates.md');
    if (!fs.existsSync(candidatesPath)) {
        vscode.window.showInformationMessage(
            '还没有候选池。先运行"抓取热点"或手动添加候选到 candidates.md。',
            '抓取热点'
        ).then(choice => {
            if (choice === '抓取热点') {
                vscode.commands.executeCommand('ai-chat-buddy.trends');
            }
        });
        return;
    }

    const doc = await vscode.workspace.openTextDocument(candidatesPath);
    await vscode.window.showTextDocument(doc);

    const query = [
        `从 candidates.md 中按当前 rubric 排序推荐选题。`,
        ``,
        `要求：`,
        `1. 按 composite 排序 top 5`,
        `2. 每条带 composite + 一句 rationale`,
        `3. 标注 buffer 状态（当前 buffer: ${state.buffer || 0}）`,
        `4. 推荐 1 稳 + 1 实验`,
    ].join('\n');

    await vscode.commands.executeCommand('workbench.action.chat.open', { query });
}

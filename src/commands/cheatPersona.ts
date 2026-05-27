/**
 * /cheat-persona — 受众画像派生（从复盘评论聚类）
 * 
 * 对应 cheat-on-content: skills/cheat-persona/SKILL.md
 * 
 * ⚠️ audience.md 是 blind sub-agent 的 hard refusal 文件。
 * 主 Claude 可以读写，但 Channel B 绝对不能碰。
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';

export async function cheatPersona(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    const audiencePath = path.join(root, 'audience.md');
    if (fs.existsSync(audiencePath)) {
        const doc = await vscode.workspace.openTextDocument(audiencePath);
        await vscode.window.showTextDocument(doc);
    }

    const query = [
        `帮我派生/刷新受众画像。`,
        ``,
        `基于已复盘的评论和互动数据：`,
        `1. 分析核心受众特征（年龄、兴趣、痛點）`,
        `2. 总结内容偏好（什么话题/风格更受欢迎）`,
        `3. 推断活跃时段`,
        `4. 识别未满足的需求（受众想要但你没做的内容）`,
        ``,
        `更新 audience.md。`,
        `校准样本数: ${state.calibration_samples}`,
    ].join('\n');

    await vscode.commands.executeCommand('workbench.action.chat.open', { query });
}

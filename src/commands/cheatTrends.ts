/**
 * /cheat-trends — 热点抓取（日常补充候选池，多 adapter）
 * 
 * 对应 cheat-on-content: skills/cheat-trends/SKILL.md
 */

import * as vscode from 'vscode';
import { StateService } from '../services/stateService';

export async function cheatTrends(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    const sources = state.enabled_trend_sources || ['manual-paste'];

    const query = [
        `帮我抓今天的热点话题。`,
        ``,
        `内容形态: ${state.content_form}`,
        `启用的热点源: ${sources.join(', ')}`,
        ``,
        `要求：`,
        `1. 去重后列出 top 10 热点`,
        `2. 按当前 rubric 粗打分`,
        `3. 写入 candidates.md`,
    ].join('\n');

    await vscode.commands.executeCommand('workbench.action.chat.open', { query });
}

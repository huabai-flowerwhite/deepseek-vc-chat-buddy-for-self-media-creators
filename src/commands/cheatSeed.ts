/**
 * /cheat-seed — Cold-start 选题启动器（brainstorm + 可选 draft）
 * 
 * 对应 cheat-on-content: skills/cheat-seed/SKILL.md
 * 
 * Overview:
 * ```
 * [Phase 0: 输入话题（可选）]
 *   ↓
 * [Phase 1: 通过 Copilot Chat brainstorm 选题角度]
 *   ↓
 * [Phase 2: （可选）生成 draft 写入 scripts/]
 * ```
 */

import * as vscode from 'vscode';
import { StateService } from '../services/stateService';

export async function cheatSeed(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    // ── Phase 0: 输入话题 ──
    const topic = await vscode.window.showInputBox({
        prompt: '想做什么话题？（留空让 AI 给你建议）',
        placeHolder: '如: AI 时代的教育变革'
    });

    // ── Phase 1-2: 通过 Copilot Chat ──
    const query = topic
        ? [
            `帮我围绕「${topic}」做选题分析。`,
            ``,
            `参考 rubric_notes.md 的评分维度：`,
            `1. 深挖 3-5 个不同角度`,
            `2. 评估每个角度的潜力（composite 预估）`,
            `3. 选最优角度写一份 draft 到 scripts/ 目录`,
            ``,
            `内容形态: ${state.content_form}`,
            `典型时长: ${state.typical_duration_seconds || 240}s`,
        ].join('\n')
        : [
            `帮我 brainstorm 3-5 个选题方向。`,
            ``,
            `基于当前 rubric_notes.md 和 candidates.md：`,
            `1. 每个方向附带角度分析`,
            `2. 评估潜力（预估 composite）`,
            `3. 推荐优先级`,
            ``,
            `内容形态: ${state.content_form}`,
        ].join('\n');

    await vscode.commands.executeCommand('workbench.action.chat.open', { query });
}

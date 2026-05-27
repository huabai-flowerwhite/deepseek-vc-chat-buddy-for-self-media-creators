/**
 * /cheat-learn-from — 对标账号导入（拆 pattern + 派生 base rubric 信号）
 * 
 * 对应 cheat-on-content: skills/cheat-learn-from/SKILL.md
 * 
 * Overview:
 * ```
 * [Phase 0: 输入对标账号名]
 *   ↓
 * [Phase 1: 打开 Copilot Chat 进行分析]
 *   ↓
 * [Phase 2: 更新 benchmark.md + script_patterns.md + rubric_notes.md]
 * ```
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';

export async function cheatLearnFrom(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    // ── Phase 0: 输入对标账号名 ──
    const accountName = await vscode.window.showInputBox({
        prompt: '平台，对标账号名称',
        placeHolder: '如: 小红书，张三的科普频道'
    });
    if (!accountName) { return; }

    // ── Phase 1-2: 通过 Copilot Chat 分析 ──
    const query = [
        `帮我分析对标平台账号「${accountName}」的内容模式。`,
        ``,
        `请执行以下步骤：`,
        `1. 拆解该账号的写作 pattern（结构、hook 方式、论证风格）`,
        `2. 分析其成功因素的规律`,
        `3. 更新 benchmark.md（记录对标账号信息）`,
        `4. 更新 script_patterns.md（沉淀可复用的写作结构）`,
        `5. 评估是否需要更新 rubric_notes.md 的评分维度`,
        ``,
        `我会粘贴 5-10 条该账号的脚本或数据供你分析。`,
    ].join('\n');

    await vscode.commands.executeCommand('workbench.action.chat.open', { query });

    // 打开 benchmark.md
    const benchmarkPath = path.join(root, 'benchmark.md');
    if (fs.existsSync(benchmarkPath)) {
        const doc = await vscode.workspace.openTextDocument(benchmarkPath);
        await vscode.window.showTextDocument(doc);
    }
}

/**
 * /cheat-retro — 数据回收与复盘
 * 
 * 对应 cheat-on-content: skills/cheat-retro/SKILL.md
 * 
 * Overview:
 * ```
 * [Phase 0: 校验 immutability + 校验时间窗口]
 *   ↓
 * [Phase 1: 抓数据（manual paste）]
 *   ↓
 * [Phase 2: 写实绩段 + top 评论关键词]
 *   ↓
 * [Phase 3: 验证/推翻预测的各假设]
 *   ↓
 * [Phase 4: 提炼新观察]
 *   ↓
 * [Phase 5: 落盘（追加到预测文件 ## 复盘 段）]
 *   ↓
 * [Phase 6: 提示写入 rubric_notes.md 的观察段]
 * ```
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';

// ─── Constants ───────────────────────────────────────────
const RETRO_WINDOW_DAYS = 3; // T+N 天后回收数据

export async function cheatRetro(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    // ── Phase 0: 列出待复盘 ──
    const videosDir = path.join(root, 'videos');
    if (!fs.existsSync(videosDir)) {
        vscode.window.showInformationMessage('还没有拍摄记录。');
        return;
    }

    const entries = await fs.promises.readdir(videosDir, { withFileTypes: true });
    const pendingRetros: string[] = [];
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const reportPath = path.join(videosDir, entry.name, 'report.md');
            if (!fs.existsSync(reportPath)) {
                pendingRetros.push(entry.name);
            }
        }
    }

    if (pendingRetros.length === 0) {
        vscode.window.showInformationMessage('✅ 所有视频都已复盘！');
        return;
    }

    const picked = await vscode.window.showQuickPick(pendingRetros, {
        placeHolder: '选择要复盘的视频'
    });
    if (!picked) { return; }

    // ── Phase 1: 抓数据（manual paste） ──
    const plays = await vscode.window.showInputBox({
        prompt: `"${picked}" 的实际播放量`,
        placeHolder: '输入数字，如 125000'
    });
    if (!plays) { return; }

    const likes = await vscode.window.showInputBox({
        prompt: '点赞数（可选，回车跳过）',
        placeHolder: '如 3500'
    });

    const comments = await vscode.window.showInputBox({
        prompt: '评论数（可选）',
        placeHolder: '如 280'
    });

    const shares = await vscode.window.showInputBox({
        prompt: '转发/分享数（可选）',
        placeHolder: '如 150'
    });

    const topComments = await vscode.window.showInputBox({
        prompt: 'Top 评论关键词（可选，用逗号分隔）',
        placeHolder: '如: 太真实了, 我也是, 学到了'
    });

    // ── Phase 2-3: 生成复盘报告 ──
    const now = new Date().toISOString();
    const playsNum = parseInt(plays, 10);

    const retroContent = `# 复盘报告: ${picked}

**复盘时间**: ${now}
**数据窗口**: T+${RETRO_WINDOW_DAYS}d

## 实际数据

| 指标 | 数值 |
|------|------|
| 播放量 | ${plays} |
| 点赞 | ${likes || '-'} |
| 评论 | ${comments || '-'} |
| 分享 | ${shares || '-'} |
${topComments ? `| Top 评论关键词 | ${topComments} |` : ''}

## 与预测对比

（请在 Copilot 对话中进行对比分析：
1. 找到 predictions/ 中对应的预测文件
2. 将预测 bucket 与实际播放量对比
3. 分析偏差原因
4. 将观察写入 rubric_notes.md）

## 新观察

（待 AI 分析——基于本次数据的新发现...）

---
*本报告由 cheat-retro 生成。请通过 Copilot 对话完成详细偏差分析和 rubric 更新。*
`;

    // ── Phase 5: 落盘 ──
    const reportPath = path.join(videosDir, picked, 'report.md');
    await fs.promises.writeFile(reportPath, retroContent, 'utf-8');

    // 更新 state
    await stateService.updateField(root, 'last_retro_at', now);

    // 匹配并更新 prediction 文件
    const predictionsDir = path.join(root, 'predictions');
    if (fs.existsSync(predictionsDir)) {
        const preds = await fs.promises.readdir(predictionsDir);
        const matchingPred = preds.find(p => p.startsWith(picked.substring(0, 10)));
        if (matchingPred) {
            const predPath = path.join(predictionsDir, matchingPred);
            let predContent = await fs.promises.readFile(predPath, 'utf-8');

            const retroSection = `
## 复盘

**复盘时间**: ${now}
**实际播放量**: ${plays}
**点赞**: ${likes || '-'}
**评论**: ${comments || '-'}
**分享**: ${shares || '-'}
${topComments ? `**Top 评论关键词**: ${topComments}` : ''}

### 偏差分析

（待 AI 分析...）

### 结论与 rubric 更新

（待 AI 分析后填写...）
`;

            // 仅追加，不修改已有内容（immutability）
            const retroMarker = '## 复盘';
            const idx = predContent.indexOf(retroMarker);
            if (idx !== -1) {
                predContent = predContent.substring(0, idx) + retroSection;
            } else {
                predContent += '\n' + retroSection;
            }
            await fs.promises.writeFile(predPath, predContent, 'utf-8');

            // 加入校准池
            await stateService.addCalibrationSample(root, {
                prediction_file: matchingPred,
                predicted_bucket: '见预测文件',
                actual_plays: playsNum,
                in_bucket: false, // 待 AI 分析后更新
                deviation_pct: 0,
                retro_at: now,
                observations: [],
            });
        }
    }

    // ── Phase 6: 打开文件 + 提示 ──
    const doc = await vscode.workspace.openTextDocument(reportPath);
    await vscode.window.showTextDocument(doc);

    await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: `帮我复盘 videos/${picked}/ 的数据。播放量: ${plays}，点赞: ${likes || 'N/A'}，评论: ${comments || 'N/A'}。对比预测 bucket 与实际表现，分析偏差原因，提炼新观察并更新 rubric_notes.md。`
    });
}

/**
 * /cheat-publish — 登记已发布 + 更新 prediction 文件 + buffer -1
 * 
 * 对应 cheat-on-content: skills/cheat-publish/SKILL.md
 * 
 * Overview:
 * ```
 * [Phase 0: 收集发布信息（url, platform）]
 *   ↓
 * [Phase 1: 匹配 prediction 文件]
 *   ↓
 * [Phase 2: 添加发布元数据到 prediction 文件]
 *   ↓
 * [Phase 3: buffer -1]
 * ```
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';

export async function cheatPublish(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    // ── Phase 0: 收集发布信息 ──
    const url = await vscode.window.showInputBox({
        prompt: '发布链接',
        placeHolder: 'https://...',
        validateInput: v => v?.trim() ? undefined : '请输入发布链接'
    });
    if (!url) { return; }

    const platform = await vscode.window.showQuickPick(
        ['douyin', 'bilibili', 'youtube', 'xiaohongshu', 'weibo', 'other'],
        { placeHolder: '选择发布平台' }
    );
    if (!platform) { return; }

    // ── Phase 1: 匹配 prediction 文件 ──
    const predictionsDir = path.join(root, 'predictions');
    let matchedPrediction: string | null = null;

    if (fs.existsSync(predictionsDir)) {
        const preds = await fs.promises.readdir(predictionsDir);
        if (preds.length > 0) {
            const picked = await vscode.window.showQuickPick(
                preds.filter(p => p.endsWith('.md')),
                { placeHolder: '选择对应的预测文件（可选）' }
            );
            matchedPrediction = picked || null;
        }
    }

    // ── Phase 2: 添加发布元数据 ──
    if (matchedPrediction) {
        const predPath = path.join(predictionsDir, matchedPrediction);
        let content = await fs.promises.readFile(predPath, 'utf-8');
        const now = new Date().toISOString();

        // 更新状态标记
        content = content.replace(
            '**状态**: predicted',
            `**状态**: published`
        );

        // 追加发布信息段（仅追加，不修改预测段）
        if (!content.includes('## 发布信息')) {
            const publishSection = `\n---\n\n## 发布信息\n\n| 字段 | 值 |\n|------|----|\n| url | ${url} |\n| platform | ${platform} |\n| published_at | ${now} |\n`;
            content += publishSection;
        }

        await fs.promises.writeFile(predPath, content, 'utf-8');
    }

    // ── Phase 3: buffer -1 ──
    const newBuffer = await stateService.decrementBuffer(root);
    await stateService.updateField(root, 'last_published_at', new Date().toISOString());

    vscode.window.showInformationMessage(
        `✅ 已登记发布 (${platform})\nBuffer: ${newBuffer}\n${matchedPrediction ? '已更新预测文件' : '⚠️ 未匹配到预测文件'}`
    );
}

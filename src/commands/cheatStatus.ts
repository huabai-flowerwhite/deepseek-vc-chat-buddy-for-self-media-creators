import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';

export async function cheatStatus(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);

    if (!state) {
        vscode.window.showInformationMessage(
            '项目未初始化。运行 "初始化 ai-chat-buddy" 开始。',
            '初始化'
        ).then(choice => {
            if (choice === '初始化') {
                vscode.commands.executeCommand('ai-chat-buddy.init');
            }
        });
        return;
    }

    // 检查待复盘
    const pendingRetros = await getPendingRetros(root);
    const predictions = await listPredictionFiles(root);

    const statusDoc = [
        '# 📊 AI chat buddy for self-media creators — 状态看板',
        '',
        `**更新时间**: ${new Date().toLocaleString('zh-CN')}`,
        '',
        '## 当前配置',
        '',
        `| 字段 | 值 |`,
        `|------|----|`,
        `| 内容形态 | ${state.content_form} |`,
        `| Rubric 版本 | ${state.rubric_version} |`,
        `| Schema 版本 | ${state.schema_version} |`,
        `| 校准样本 | ${state.calibration_samples} |`,
        `| Buffer | ${state.buffer || 0} |`,
        `| 数据层 | ${state.data_layer || 'markdown'} |`,
        `| 盲打分 | ${state.last_prediction_self_scored === true ? '⚠️ 上次自评' : '✅ 正常'} |`,
        '',
        '## 待复盘',
        '',
        pendingRetros.length === 0
            ? '（无——所有已拍视频都已复盘 ✅）'
            : pendingRetros.map(r => `- 📹 \`${r.name}\` — ${r.daysAgo}`).join('\n'),
        '',
        '## 预测文件',
        '',
        predictions.length === 0
            ? '（暂无预测）'
            : predictions.map(p => `- 📝 \`${p}\``).join('\n'),
        '',
        '## 建议操作',
        '',
    ];

    if (pendingRetros.length > 0) {
        statusDoc.push(`⚠️ 有 ${pendingRetros.length} 篇待复盘——运行 "数据复盘"`);
    }
    if ((state.buffer || 0) >= 3) {
        statusDoc.push('⚡ Buffer 积压 ≥3，建议尽快发布');
    }
    if (state.calibration_samples < 5) {
        statusDoc.push('🔴 校准样本 <5，预测精度约 ±50%——多跑闭环');
    }
    if (state.calibration_samples >= 10 && state.rubric_version === 'v0') {
        statusDoc.push('🟡 样本够了，考虑运行 "升级评分公式"');
    }
    statusDoc.push('');

    // 创建/更新 STATUS.md
    const statusPath = path.join(root, 'STATUS.md');
    await fs.promises.writeFile(statusPath, statusDoc.join('\n'), 'utf-8');

    // 在编辑器中打开
    const doc = await vscode.workspace.openTextDocument(statusPath);
    await vscode.window.showTextDocument(doc, { preview: false });
}

async function getPendingRetros(root: string): Promise<{ name: string; daysAgo: string }[]> {
    const videosDir = path.join(root, 'videos');
    if (!fs.existsSync(videosDir)) { return []; }

    const retros: { name: string; daysAgo: string }[] = [];
    const entries = await fs.promises.readdir(videosDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const reportPath = path.join(videosDir, entry.name, 'report.md');
            if (!fs.existsSync(reportPath)) {
                const stat = fs.statSync(path.join(videosDir, entry.name));
                const days = Math.floor((Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24));
                retros.push({ name: entry.name, daysAgo: `${days} 天前` });
            }
        }
    }
    return retros;
}

async function listPredictionFiles(root: string): Promise<string[]> {
    const predDir = path.join(root, 'predictions');
    if (!fs.existsSync(predDir)) { return []; }
    const entries = await fs.promises.readdir(predDir);
    return entries.filter(f => f.endsWith('.md'));
}

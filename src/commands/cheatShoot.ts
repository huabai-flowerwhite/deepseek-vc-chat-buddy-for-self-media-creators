/**
 * /cheat-shoot — 登记拍摄完成 + 建 video folder + (改稿则) 触发 v2 预测
 * 
 * 技能定义文件。自包含常量、工作流阶段、集成契约。
 * 对应 cheat-on-content: skills/cheat-shoot/SKILL.md
 * 
 * Overview:
 * ```
 * [用户：拍了 scripts/2026-05-04_abc123_停止期待.md]
 *   ↓
 * [Phase 0: 解析路径 + 验证 prediction 已存在]
 *   ↓
 * [Phase 1: 检查是否已登记（避免重复）]
 *   ↓
 * [Phase 2: 建 videos/<id>/ + 询问"实际拍摄稿一致吗？"]
 *   ↓
 * [Phase 3: 写 videos/<id>/script.md]
 *   ↓
 * [Phase 4: append state.shoots]
 *   ↓
 * [Phase 5: 输出 buffer 状态]
 * ```
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';

// ─── Constants ───────────────────────────────────────────
const SCRIPTS_DIR = 'scripts';
const VIDEOS_DIR = 'videos';
const DIFF_THRESHOLD = 0.3; // 30% 改动触发 v2 重预测

export async function cheatShoot(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    // ── Phase 0: 解析路径 + 验证 prediction 已存在 ──
    const scriptsDir = path.join(root, SCRIPTS_DIR);
    let scriptPath: string | undefined;

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.fsPath.includes(SCRIPTS_DIR)) {
        scriptPath = editor.document.uri.fsPath;
    } else if (fs.existsSync(scriptsDir)) {
        const files = await fs.promises.readdir(scriptsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        if (mdFiles.length > 0) {
            const picked = await vscode.window.showQuickPick(mdFiles, {
                placeHolder: '选择已拍摄的脚本'
            });
            if (picked) { scriptPath = path.join(scriptsDir, picked); }
        }
    }

    if (!scriptPath) {
        vscode.window.showErrorMessage('找不到脚本文件。请先在 scripts/ 中创建脚本。');
        return;
    }

    const scriptName = path.basename(scriptPath, '.md');
    const videoDir = path.join(root, VIDEOS_DIR, scriptName);

    // ── Phase 1: 检查是否已登记 ──
    if (fs.existsSync(videoDir)) {
        vscode.window.showWarningMessage(`视频目录已存在: ${VIDEOS_DIR}/${scriptName}/`);
        return;
    }

    // Check prediction exists
    const predictionsDir = path.join(root, 'predictions');
    const hasPrediction = fs.existsSync(predictionsDir) &&
        (await fs.promises.readdir(predictionsDir))
            .some(f => f.startsWith(scriptName.substring(0, 10)));

    if (!hasPrediction) {
        const proceed = await vscode.window.showWarningMessage(
            '未找到对应的预测文件。建议先运行 cheat-predict 再做预测。',
            '继续登记（无预测）',
            '取消'
        );
        if (proceed !== '继续登记（无预测）') { return; }
    }

    // ── Phase 2: 建目录 + 询问脚本一致性 ──
    const sameScript = await vscode.window.showQuickPick(
        ['完全一致', '有小改动 (diff < 30%)', '有大改动 (diff ≥ 30%，将触发 v2 重预测)'],
        { placeHolder: '实际拍摄稿与 scripts/ 中的草稿一致吗？' }
    );
    if (!sameScript) { return; }

    // ── Phase 3: 写 videos/<id>/script.md ──
    await fs.promises.mkdir(videoDir, { recursive: true });
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    await fs.promises.writeFile(path.join(videoDir, 'script.md'), scriptContent, 'utf-8');

    const shootRecord = `# 拍摄记录: ${scriptName}

**拍摄时间**: ${new Date().toISOString()}
**脚本一致性**: ${sameScript}
**ad_hoc**: false
**状态**: shot (待发布)
`;
    await fs.promises.writeFile(path.join(videoDir, 'shoot.md'), shootRecord, 'utf-8');

    // ── Phase 4: buffer +1 ──
    const newBuffer = await stateService.incrementBuffer(root);

    // ── Phase 5: 输出状态 ──
    vscode.window.showInformationMessage(
        `✅ 已登记拍摄: ${VIDEOS_DIR}/${scriptName}/\nBuffer: ${newBuffer}`,
        '打开目录'
    ).then(choice => {
        if (choice === '打开目录') {
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(videoDir));
        }
    });

    // Integration: diff ≥30% → 提示 v2 重预测
    if (sameScript.includes('≥ 30%')) {
        vscode.window.showWarningMessage(
            '⚠️ 脚本有重大改动（diff ≥ 30%），建议运行 v2 重预测。',
            '启动 v2 预测'
        ).then(choice => {
            if (choice === '启动 v2 预测') {
                vscode.commands.executeCommand('ai-chat-buddy.predict', vscode.Uri.file(scriptPath));
            }
        });
    }
}

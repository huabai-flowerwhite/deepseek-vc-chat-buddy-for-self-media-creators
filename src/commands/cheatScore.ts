import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';
import { RubricService } from '../services/rubricService';
import { BLIND_SCORING, DISAGREEMENT_THRESHOLD } from '../shared-references/blindPredictionProtocol';

/**
 * /cheat-score — 单稿打分（只输出，不写文件）
 * 
 * 对应 cheat-on-content: skills/cheat-score/SKILL.md
 * 
 * Overview:
 * ```
 * [Phase 0: 确定脚本路径 + 读 rubric]
 *   ↓
 * [Phase 1: 显示打分面板（webview）]
 *   ↓
 * [Phase 2: 用户/主 Claude 逐维打分]
 *   ↓
 * [Phase 3: 算 composite + 输出]
 * ```
 * 
 * Integration:
 * - 可通过 BLIND_SCORING=off 跳过 blind sub-agent 调用
 * - 默认 BLIND_SCORING=on → 建议通过 Copilot Chat 完成盲打分
 */

// ─── Constants ───────────────────────────────────────────
const OUTPUT_DETAIL = 'full' as const; // full: 含每维度理由；compact: 仅分数表

export async function cheatScore(
    stateService: StateService,
    rubricService: RubricService,
    scriptPath?: string
): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) {
        vscode.window.showErrorMessage('项目未初始化，请先运行初始化');
        return;
    }

    // 确定脚本路径
    if (!scriptPath) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath.endsWith('.md')) {
            scriptPath = editor.document.uri.fsPath;
        } else {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'Markdown': ['md'] },
                defaultUri: vscode.Uri.file(path.join(root, 'scripts')),
                title: '选择要打分的脚本'
            });
            if (!files || files.length === 0) { return; }
            scriptPath = files[0].fsPath;
        }
    }

    if (!fs.existsSync(scriptPath!)) {
        vscode.window.showErrorMessage(`脚本不存在: ${scriptPath}`);
        return;
    }

    // 读取脚本和 rubric
    const scriptContent = await fs.promises.readFile(scriptPath!, 'utf-8');
    const rubricPath = path.join(root, 'rubric_notes.md');
    let rubricContent = '';
    if (fs.existsSync(rubricPath)) {
        rubricContent = await fs.promises.readFile(rubricPath, 'utf-8');
    }

    // 显示打分面板
    const panel = vscode.window.createWebviewPanel(
        'cheatScore',
        `打分: ${path.basename(scriptPath!)}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = getScoreWebviewHtml(
        path.basename(scriptPath!),
        scriptContent,
        rubricContent,
        state
    );

    // 处理来自 webview 的消息
    panel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
            case 'copyToChat':
                // 复制打分结果到 Copilot Chat
                await vscode.commands.executeCommand(
                    'workbench.action.chat.open',
                    { query: message.text }
                );
                break;
            case 'savePrediction':
                // 跳转到预测命令
                vscode.commands.executeCommand('ai-chat-buddy.predict', scriptPath);
                break;
        }
    });
}

function getScoreWebviewHtml(
    filename: string,
    scriptContent: string,
    rubricContent: string,
    state: Record<string, unknown>
): string {
    const scriptPreview = scriptContent.substring(0, 2000);
    const contentForm = state.content_form || 'opinion-video';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>打分: ${filename}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
        padding: 20px;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-size: 14px;
    }
    h2 { margin-bottom: 12px; color: var(--vscode-textLink-foreground); }
    .section {
        margin-bottom: 24px; padding: 16px;
        background: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: 8px;
    }
    .script-preview {
        max-height: 300px; overflow-y: auto;
        white-space: pre-wrap; font-family: monospace;
        border: 1px solid var(--vscode-panel-border);
        padding: 12px; border-radius: 4px;
    }
    .dimensions { display: flex; flex-direction: column; gap: 12px; }
    .dim-row {
        display: flex; align-items: center; gap: 12px;
    }
    .dim-row label { width: 160px; font-weight: 600; }
    .dim-row input[type="range"] { flex: 1; }
    .dim-row .score { width: 40px; text-align: center; font-weight: bold; }
    button {
        padding: 8px 16px; border: none; border-radius: 4px;
        cursor: pointer; font-size: 14px; margin-right: 8px;
    }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    #composite { font-size: 24px; font-weight: bold; text-align: center; padding: 12px; }
    #bucket { font-size: 18px; text-align: center; color: var(--vscode-textLink-foreground); }
</style>
</head>
<body>

<h2>📝 脚本打分: ${filename}</h2>

<div class="section">
    <h3>脚本预览</h3>
    <div class="script-preview">${scriptPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <p style="margin-top:8px;color:var(--vscode-descriptionForeground);">内容形态: ${contentForm} | 仅显示前2000字符</p>
</div>

<div class="section">
    <h3>维度打分 (1-5)</h3>
    <div class="dimensions">
        <div class="dim-row">
            <label>情感共鸣 (ER)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('er', this.value)">
            <span class="score" id="er-score">3.0</span>
        </div>
        <div class="dim-row">
            <label>开头抓人力 (HP)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('hp', this.value)">
            <span class="score" id="hp-score">3.0</span>
        </div>
        <div class="dim-row">
            <label>逻辑质量 (QL)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('ql', this.value)">
            <span class="score" id="ql-score">3.0</span>
        </div>
        <div class="dim-row">
            <label>新颖度 (NA)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('na', this.value)">
            <span class="score" id="na-score">3.0</span>
        </div>
        <div class="dim-row">
            <label>受众广度 (AB)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('ab', this.value)">
            <span class="score" id="ab-score">3.0</span>
        </div>
        <div class="dim-row">
            <label>转发意愿 (SR)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('sr', this.value)">
            <span class="score" id="sr-score">3.0</span>
        </div>
        <div class="dim-row">
            <label>完播满足感 (SAT)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('sat', this.value)">
            <span class="score" id="sat-score">3.0</span>
        </div>
    </div>
    <div id="composite">综合: 3.00 / 5</div>
    <div id="bucket">预测桶: 10-30w</div>
</div>

<div class="section">
    <button class="btn-primary" onclick="copyToChat()">📋 复制到 Copilot Chat</button>
    <button class="btn-secondary" onclick="saveAsPrediction()">🔮 保存为预测</button>
</div>

<script>
    const vscode = acquireVsCodeApi();
    const scores = { er: 3, hp: 3, ql: 3, na: 3, ab: 3, sr: 3, sat: 3 };

    function updateScore(dim, val) {
        scores[dim] = parseFloat(val);
        document.getElementById(dim + '-score').textContent = val;
        updateComposite();
    }

    function updateComposite() {
        const vals = Object.values(scores);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        document.getElementById('composite').textContent = '综合: ' + avg.toFixed(2) + ' / 5';
        let bucket = '<1w';
        if (avg >= 4.5) bucket = '100w+';
        else if (avg >= 4.0) bucket = '50-100w';
        else if (avg >= 3.5) bucket = '30-50w';
        else if (avg >= 3.0) bucket = '10-30w';
        else if (avg >= 2.5) bucket = '5-10w';
        else if (avg >= 2.0) bucket = '1-5w';
        document.getElementById('bucket').textContent = '预测桶: ' + bucket;
    }

    function copyToChat() {
        const vals = Object.values(scores);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        let bucket = '<1w';
        if (avg >= 4.5) bucket = '100w+';
        else if (avg >= 4.0) bucket = '50-100w';
        else if (avg >= 3.5) bucket = '30-50w';
        else if (avg >= 3.0) bucket = '10-30w';
        else if (avg >= 2.5) bucket = '5-10w';
        else if (avg >= 2.0) bucket = '1-5w';

        const text = '按照 rubric_notes.md 的7维公式给这篇脚本独立打分（盲预测协议），输出格式：每维(0-5) + 置信度 + 一句话理由：\\n' +
            'ER=' + scores.er + ' HP=' + scores.hp + ' QL=' + scores.ql +
            ' NA=' + scores.na + ' AB=' + scores.ab + ' SR=' + scores.sr +
            ' SAT=' + scores.sat + ' | Composite=' + avg.toFixed(2) +
            ' | Bucket=' + bucket;
        vscode.postMessage({ command: 'copyToChat', text: text });
    }

    function saveAsPrediction() {
        vscode.postMessage({ command: 'savePrediction' });
    }

    updateComposite();
</script>
</body>
</html>`;
}

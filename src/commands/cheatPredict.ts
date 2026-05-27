import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';
import { PredictionService } from '../services/predictionService';
import { RubricService } from '../services/rubricService';
import {
    BLIND_CHECK,
    BLIND_SCORING,
    DISAGREEMENT_THRESHOLD,
    IMMUTABLE_SECTION_MARKER,
} from '../shared-references/blindPredictionProtocol';
import {
    deriveConfidence,
    PredictionComponent,
} from '../shared-references/predictionAnatomy';

/**
 * /cheat-predict — AI 主导的盲预测 + 用户 review
 * 
 * 对应 cheat-on-content: skills/cheat-predict/SKILL.md
 * 
 * 严格遵守 blind-prediction-protocol——见过任何后续数据就不能写预测，只能记 reconstructed。
 * 完整组件清单见 prediction-anatomy（7 个必备组件）。
 * Confidence 派生表见 state-management。
 * 
 * Overview:
 * ```
 * [Phase 0: 前置检查（项目已初始化？脚本存在？）]
 *   ↓
 * [Phase 0.5: 入参解析（video-folder 或 script-path）]
 *   ↓
 * [Phase 1: 盲检查（BLIND_CHECK）——确认主 Claude 没见过后续数据]
 *   ↓
 * [Phase 2: 算分——主 Claude 自评 + 可选 blind sub-agent]
 *   ↓
 * [Phase 2.5: 用户裁定（|Δ| ≥ DISAGREEMENT_THRESHOLD 时弹出）]
 *   ↓
 * [Phase 3: 写 prediction 文件——7 组件完整结构]
 *   ↓
 * [Phase 4: 输出 summary]
 * ```
 */

// ─── Constants ───────────────────────────────────────────
const PREDICTIONS_DIR = 'predictions';

export async function cheatPredict(
    stateService: StateService,
    predictionService: PredictionService,
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
                title: '选择要预测的脚本'
            });
            if (!files || files.length === 0) { return; }
            scriptPath = files[0].fsPath;
        }
    }

    if (!fs.existsSync(scriptPath!)) {
        vscode.window.showErrorMessage(`脚本不存在: ${scriptPath}`);
        return;
    }

    const scriptContent = await fs.promises.readFile(scriptPath!, 'utf-8');
    const scriptHash = predictionService.computeScriptHash(scriptContent);

    // 检查是否已有预测
    const predictions = await predictionService.listPredictions(root);
    const existingPred = predictions.find(p => p.includes(scriptHash));
    if (existingPred) {
        const v2 = await vscode.window.showWarningMessage(
            '该脚本已有预测日志。',
            '追加 v2 预测',
            '打开已有预测',
            '取消'
        );
        if (v2 === '追加 v2 预测') {
            // v2 模式
            await appendV2Prediction(root, predictionService, stateService, existingPred, scriptContent, state);
            return;
        } else if (v2 === '打开已有预测') {
            const predPath = path.join(root, 'predictions', existingPred);
            const doc = await vscode.workspace.openTextDocument(predPath);
            await vscode.window.showTextDocument(doc);
            return;
        }
        return;
    }

    // 标题输入
    const title = await vscode.window.showInputBox({
        prompt: '作品标题',
        placeHolder: '输入这期内容的标题',
        validateInput: (value) => value.trim() ? undefined : '标题不能为空'
    });
    if (!title) { return; }

    // 打开打分/预测面板
    const panel = vscode.window.createWebviewPanel(
        'cheatPredict',
        `预测: ${title}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    const rubricPath = path.join(root, 'rubric_notes.md');
    let rubricContent = '';
    if (fs.existsSync(rubricPath)) {
        rubricContent = await fs.promises.readFile(rubricPath, 'utf-8');
    }

    panel.webview.html = getPredictWebviewHtml(
        title, scriptContent, rubricContent, state, scriptHash
    );

    panel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
            case 'savePrediction': {
                const scores = message.scores;
                const bucket = message.bucket;
                const predContent = predictionService.generatePredictionFile(
                    title, scriptContent,
                    state.rubric_version, state.content_form,
                    state.calibration_samples, scores, bucket
                );
                const filename = predictionService.generatePredictionFilename(scriptContent, title);
                const savedPath = await predictionService.writePrediction(root, filename, predContent);

                // 更新状态
                await stateService.updateField(root, 'calibration_samples', state.calibration_samples + 1);

                vscode.window.showInformationMessage(
                    `✅ 预测日志已保存: predictions/${filename}`,
                    '打开文件'
                ).then(choice => {
                    if (choice === '打开文件') {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(savedPath));
                    }
                });
                panel.dispose();
                break;
            }
            case 'sendToCopilot': {
                await vscode.commands.executeCommand(
                    'workbench.action.chat.open',
                    { query: message.text }
                );
                break;
            }
        }
    });
}

async function appendV2Prediction(
    root: string,
    predictionService: PredictionService,
    stateService: StateService,
    existingPred: string,
    scriptContent: string,
    state: Record<string, unknown>
): Promise<void> {
    const predPath = path.join(root, 'predictions', existingPred);
    let content = await fs.promises.readFile(predPath, 'utf-8');

    const v2Section = `
---

## 预测 v2

> ⚠️ 拍摄稿与 scripts/ 草稿有显著差异（diff ≥30%），触发 v2 重预测。
> v1 段保持不变，校准以最新 vN 为准。

### 维度打分

（请通过 Copilot 对话完成打分，格式同 v1）

### 综合

- **Composite**: 待打分
- **预测桶**: 待打分
- **Confidence**: ${predictionService.deriveConfidence(state.calibration_samples as number || 0)}

`;
    content += v2Section;
    await fs.promises.writeFile(predPath, content, 'utf-8');

    const doc = await vscode.workspace.openTextDocument(predPath);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage('v2 预测段已追加到文件末尾，请通过 Copilot 完成打分。');
}

function getPredictWebviewHtml(
    title: string,
    scriptContent: string,
    rubricContent: string,
    state: Record<string, unknown>,
    scriptHash: string
): string {
    const confidence = (state.calibration_samples as number || 0) >= 25 ? 'high'
        : (state.calibration_samples as number || 0) >= 10 ? 'medium' : 'low';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>预测: ${title}</title>
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
        max-height: 250px; overflow-y: auto;
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
    .dim-row .reason { flex: 1; }
    .dim-row input[type="text"] {
        flex: 1; padding: 4px 8px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
    }
    button {
        padding: 8px 16px; border: none; border-radius: 4px;
        cursor: pointer; font-size: 14px; margin-right: 8px;
    }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    #composite { font-size: 24px; font-weight: bold; text-align: center; padding: 12px; }
    #bucket { font-size: 18px; text-align: center; color: var(--vscode-textLink-foreground); }
    .meta { color: var(--vscode-descriptionForeground); font-size: 12px; }
</style>
</head>
<body>

<h2>🔮 盲预测: ${title}</h2>
<p class="meta">Hash: ${scriptHash} | 校准样本: ${state.calibration_samples || 0} | Confidence: ${confidence}</p>

<div class="section">
    <h3>脚本预览</h3>
    <div class="script-preview">${scriptContent.substring(0, 2000).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
</div>

<div class="section">
    <h3>维度打分 (1-5) + 理由</h3>
    <div class="dimensions">
        <div class="dim-row">
            <label>情感共鸣 (ER)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('er', this.value)">
            <span class="score" id="er-score">3.0</span>
            <input type="text" class="reason" id="er-reason" placeholder="理由（必填）">
        </div>
        <div class="dim-row">
            <label>开头抓人力 (HP)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('hp', this.value)">
            <span class="score" id="hp-score">3.0</span>
            <input type="text" class="reason" id="hp-reason" placeholder="理由（必填）">
        </div>
        <div class="dim-row">
            <label>逻辑质量 (QL)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('ql', this.value)">
            <span class="score" id="ql-score">3.0</span>
            <input type="text" class="reason" id="ql-reason" placeholder="理由（必填）">
        </div>
        <div class="dim-row">
            <label>新颖度 (NA)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('na', this.value)">
            <span class="score" id="na-score">3.0</span>
            <input type="text" class="reason" id="na-reason" placeholder="理由（必填）">
        </div>
        <div class="dim-row">
            <label>受众广度 (AB)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('ab', this.value)">
            <span class="score" id="ab-score">3.0</span>
            <input type="text" class="reason" id="ab-reason" placeholder="理由（必填）">
        </div>
        <div class="dim-row">
            <label>转发意愿 (SR)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('sr', this.value)">
            <span class="score" id="sr-score">3.0</span>
            <input type="text" class="reason" id="sr-reason" placeholder="理由（必填）">
        </div>
        <div class="dim-row">
            <label>完播满足感 (SAT)</label>
            <input type="range" min="1" max="5" step="0.5" value="3" oninput="updateScore('sat', this.value)">
            <span class="score" id="sat-score">3.0</span>
            <input type="text" class="reason" id="sat-reason" placeholder="理由（必填）">
        </div>
    </div>
    <div id="composite">综合: 3.00 / 5</div>
    <div id="bucket">预测桶: 10-30w</div>
</div>

<div class="section">
    <button class="btn-primary" onclick="saveBlind()">🔮 保存盲预测</button>
    <button class="btn-secondary" onclick="sendToCopilot()">💬 发给 Copilot 分析</button>
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

    function getBucket(avg) {
        if (avg >= 4.5) return '100w+';
        if (avg >= 4.0) return '50-100w';
        if (avg >= 3.5) return '30-50w';
        if (avg >= 3.0) return '10-30w';
        if (avg >= 2.5) return '5-10w';
        if (avg >= 2.0) return '1-5w';
        return '<1w';
    }

    function saveBlind() {
        const dims = ['er','hp','ql','na','ab','sr','sat'];
        const scoreData = {};
        let allFilled = true;
        for (const d of dims) {
            const reason = document.getElementById(d + '-reason').value.trim();
            if (!reason) { allFilled = false; break; }
            scoreData[d] = { score: scores[d], confidence: 'medium', reason: reason };
        }
        if (!allFilled) {
            alert('请为每个维度填写理由');
            return;
        }
        const vals = Object.values(scores);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        vscode.postMessage({
            command: 'savePrediction',
            scores: scoreData,
            bucket: getBucket(avg)
        });
    }

    function sendToCopilot() {
        const vals = Object.values(scores);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        vscode.postMessage({
            command: 'sendToCopilot',
            text: '按照 rubric_notes.md 的7维公式给这篇脚本独立打分（盲预测协议），输出格式：每维(0-5) + 置信度 + 一句话理由：' +
                ' ER=' + scores.er + ' HP=' + scores.hp +
                ' QL=' + scores.ql + ' NA=' + scores.na +
                ' AB=' + scores.ab + ' SR=' + scores.sr +
                ' SAT=' + scores.sat + ' | Composite=' + avg.toFixed(2) +
                ' | Bucket=' + getBucket(avg)
        });
    }

    updateComposite();
</script>
</body>
</html>`;
}

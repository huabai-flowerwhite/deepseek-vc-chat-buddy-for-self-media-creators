import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
    deriveConfidence,
    DimensionScore,
} from '../shared-references/predictionAnatomy';

/**
 * 预测文件服务 — 管理 predictions/ 目录下的预测日志
 * 
 * 预测文件遵循 prediction-anatomy.ts 中定义的 7 组件结构。
 */
export interface PredictionHeader {
    title: string;
    script_id: string;
    script_hash: string;
    rubric_version: string;
    content_form: string;
    confidence: 'low' | 'medium' | 'high';
    predicted_bucket: string;
    predicted_at: string;
    published_url?: string;
    published_at?: string;
    platform?: string;
}

export class PredictionService {
    /**
     * 计算脚本 hash（前 12 位）
     */
    computeScriptHash(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 12);
    }

    /**
     * 生成 prediction 文件内容（7 组件完整结构）
     * 
     * 组件 1: File header
     * 组件 2: 输入快照
     * 组件 3: 预测 v1 ⭐ IMMUTABLE 起点
     * 组件 4: 推理因素
     * 组件 5: 锚点对比
     * 组件 6: 反事实场景
     * 组件 7: 关键校准假设
     */
    generatePredictionFile(
        title: string,
        scriptContent: string,
        rubricVersion: string,
        contentForm: string,
        calibrationSamples: number,
        scores: Record<string, { score: number; confidence: string; reason: string }>,
        bucket: string
    ): string {
        const scriptHash = this.computeScriptHash(scriptContent);
        const now = new Date().toISOString();
        const confidence = deriveConfidence(calibrationSamples);
        const dateStr = now.split('T')[0];
        const wordCount = scriptContent.length;

        // 计算 composite
        const dims = Object.values(scores);
        const composite = dims.length > 0
            ? dims.reduce((sum, d) => sum + d.score, 0) / dims.length
            : 0;

        let md = `# ${title} — 预测日志

> **Article ID**: \`${scriptHash}\`
> **Confidence**: ${confidence}
> **状态**: predicted
> **Prediction Basis**: pre-shoot script (\`scripts/${dateStr}_${scriptHash}_${this.sanitizeFilename(title)}.md\`)

---

## 元数据（组件 1: File Header）

| 字段 | 值 |
|------|----|
| Article ID | \`${scriptHash}\` |
| Title | ${title} |
| Rubric Version | **${rubricVersion}** |
| 预测时间 | ${dateStr}（基于最终稿） |
| Script Path | \`scripts/${dateStr}_${scriptHash}_${this.sanitizeFilename(title)}.md\` |
| Script Hash | \`sha256:${scriptHash}\` |
| Actual Script Length | ${wordCount} 字 |
| Calibration Samples (at predict time) | ${calibrationSamples} |
| Confidence | **${confidence}** |
| 预测时数据状态 | 仅看过 pre-shoot 脚本，未接触任何发布后数据 |

---

## 输入快照（组件 2）

（脚本打分时的状态——以下为初始打分，用户改写要点见下方 diff）

### 维度打分

| 维度 | 分数 (0-5) | 置信度 | 理由 |
|------|------------|--------|------|
`;

        for (const [dim, info] of Object.entries(scores)) {
            md += `| ${dim} | ${info.score} | ${info.confidence} | ${info.reason} |\n`;
        }

        md += `
---

## 预测 v1（组件 3） ⭐ IMMUTABLE 起点

> 基于 pre-shoot 草稿的盲预测。本段写完后不可编辑，不可删除。

- **Composite Score**: ${composite.toFixed(2)} / 5
- **预测桶**: ${bucket}
- **概率**: 待 AI 评估
- **中枢估计**: 待 AI 评估
- **一句话理由**: （待 AI 填写）

---

## 推理因素（组件 4）

| 因素 | 方向 | 置信度 |
|------|------|--------|
| 话题时效性 | neutral | medium |
| 受众广度 | neutral | medium |
| 竞争密度 | neutral | low |
| 平台算法适配 | neutral | low |

---

## 锚点对比（组件 5）

${calibrationSamples === 0 ? '> ⚠️ **N/A 段**：尚无校准样本，无可比锚点。前 5 篇预测精度约 ±50%。' : '（待 AI 从校准池中选择最相似的 1-3 个样本进行对比）'}

---

## 反事实场景（组件 6）

| 如果... | 意味着... |
|---------|-----------|
| 实际播放 < 预测桶下限 | 某关键假设失效，需复盘定位 |
| 实际播放 ∈ 预测桶 | 当前 rubric 对该类内容校准良好 |
| 实际播放 > 预测桶上限 | 可能遗漏了关键加分因素 |

---

## 关键校准假设（组件 7）

（这次预测作为实验的明确赌注——待 AI 填写）

> 核心赌注：[待填写]
> 如果赌错了：[待填写的影响]
> 观察重点：[复盘时重点验证什么]

---

## 复盘

（待发布后 T+3d 运行 /cheat-retro）

`;
        return md;
    }

    /**
     * 生成 prediction 文件名
     */
    generatePredictionFilename(scriptContent: string, title: string): string {
        const hash = this.computeScriptHash(scriptContent);
        const dateStr = new Date().toISOString().split('T')[0];
        const safeTitle = this.sanitizeFilename(title);
        return `${dateStr}_${hash}_${safeTitle}.md`;
    }

    /**
     * 根据校准样本数派生置信度（使用共享定义）
     */
    deriveConfidence(samples: number): 'low' | 'medium' | 'high' {
        return deriveConfidence(samples);
    }

    /**
     * 预测桶映射
     */
    getBucketForScore(composite: number): string {
        if (composite >= 4.5) { return '100w+'; }
        if (composite >= 4.0) { return '50-100w'; }
        if (composite >= 3.5) { return '30-50w'; }
        if (composite >= 3.0) { return '10-30w'; }
        if (composite >= 2.5) { return '5-10w'; }
        if (composite >= 2.0) { return '1-5w'; }
        return '<1w';
    }

    /**
     * 检查 prediction 文件是否已存在
     */
    predictionExists(projectRoot: string, filename: string): boolean {
        const filePath = path.join(projectRoot, 'predictions', filename);
        return fs.existsSync(filePath);
    }

    /**
     * 读取 prediction 文件
     */
    async readPrediction(projectRoot: string, filename: string): Promise<string | null> {
        const filePath = path.join(projectRoot, 'predictions', filename);
        if (!fs.existsSync(filePath)) { return null; }
        return fs.promises.readFile(filePath, 'utf-8');
    }

    /**
     * 写入 prediction 文件
     */
    async writePrediction(projectRoot: string, filename: string, content: string): Promise<string> {
        const predDir = path.join(projectRoot, 'predictions');
        if (!fs.existsSync(predDir)) {
            await fs.promises.mkdir(predDir, { recursive: true });
        }
        const filePath = path.join(predDir, filename);
        await fs.promises.writeFile(filePath, content, 'utf-8');
        return filePath;
    }

    /**
     * 追加复盘段到 prediction 文件
     */
    async appendRetro(
        projectRoot: string,
        predFilename: string,
        retroContent: string
    ): Promise<void> {
        const filePath = path.join(projectRoot, 'predictions', predFilename);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Prediction 文件不存在: ${predFilename}`);
        }
        let content = await fs.promises.readFile(filePath, 'utf-8');

        // 替换 "## 复盘" 下的占位内容
        const retroMarker = '## 复盘';
        const retroIndex = content.indexOf(retroMarker);
        if (retroIndex !== -1) {
            content = content.substring(0, retroIndex) + retroContent;
        } else {
            content += '\n' + retroContent;
        }

        await fs.promises.writeFile(filePath, content, 'utf-8');
    }

    /**
     * 列出所有 prediction 文件
     */
    async listPredictions(projectRoot: string): Promise<string[]> {
        const predDir = path.join(projectRoot, 'predictions');
        if (!fs.existsSync(predDir)) { return []; }
        const entries = await fs.promises.readdir(predDir);
        return entries.filter(f => f.endsWith('.md') && f !== '.gitkeep');
    }

    private sanitizeFilename(name: string): string {
        return name.replace(/[<>:"/\\\\|?*]/g, '_').substring(0, 50);
    }
}

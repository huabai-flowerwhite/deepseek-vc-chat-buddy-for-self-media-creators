/**
 * Prediction Anatomy（预测日志解剖）
 * 
 * 定义一份合格预测文件的 7 个必备组件。
 * 被 cheat-predict / cheat-retro / cheat-bump 引用。
 * 
 * 对应 cheat-on-content: shared-references/prediction-anatomy.md
 */

// ─── 7 组件清单 ──────────────────────────────────────────

export enum PredictionComponent {
    /** 组件 1：文件头（含 Article ID, rubric version, confidence, script hash 等） */
    FILE_HEADER = 1,
    /** 组件 2：输入快照（scores + 用户改写要点 vs AI 草稿） */
    INPUT_SNAPSHOT = 2,
    /** 组件 3：预测 v1（IMMUTABLE 起点 — bucket + 概率 + 中枢 + 理由） */
    PREDICTION_V1 = 3,
    /** 组件 4：推理因素（带方向 + 置信度的因素表） */
    REASONING_FACTORS = 4,
    /** 组件 5：锚点对比（校准池样本对比，不够时写 N/A 段） */
    ANCHOR_COMPARISON = 5,
    /** 组件 6：反事实场景（每 bucket 一段"意味着什么"） */
    COUNTERFACTUAL_SCENARIOS = 6,
    /** 组件 7：关键校准假设（这次预测作为实验的明确赌注） */
    CALIBRATION_ASSUMPTIONS = 7,
}

// ─── File Header 必填字段 ────────────────────────────────

export interface PredictionHeader {
    /** Article ID：scripts/<id>.md 首次落盘内容的 sha256 前 12 位 */
    articleId: string;
    /** 作品完整标题 */
    title: string;
    /** Rubric 版本（v0/v1/v2/...），必填——将来回看时没有版本号无法公平对比 */
    rubricVersion: string;
    /** 预测时间（基于最终稿），格式 YYYY-MM-DD */
    predictedAt: string;
    /** Script 路径，scripts/<date>_<id>_<short>.md */
    scriptPath: string;
    /** Script Hash：predict 时 hash script 内容 */
    scriptHash: string;
    /** 目标时长（秒），从 state.typical_duration_seconds 派生 */
    targetDurationSec: number;
    /** 实际脚本字数，从 Script Path 文件读取 */
    actualScriptLength: number;
    /** 校准样本数（预测时），从 state.calibration_samples 读取 */
    calibrationSamples: number;
    /** 置信度，自动派生自 calibration_samples */
    confidence: 'low' | 'medium' | 'high';
    /** 数据状态声明 */
    dataStatus: string;
}

// ─── 维度打分结构 ────────────────────────────────────────

export interface DimensionScore {
    /** 维度缩写（ER, HP, QL, NA, AB, SR, SAT, MS, TS） */
    dim: string;
    /** blind sub-agent 给的分 */
    blind: number;
    /** 主 Claude 自估分 */
    self: number;
    /** |blind - self| */
    delta: number;
    /** 进入 composite 计算的最终值 */
    decidedAs: number;
    /** Phase 2.5 用户裁定选项（仅 delta ≥ DISAGREEMENT_THRESHOLD 时出现） */
    userDecision?: string;
}

// ─── 预测桶映射 ──────────────────────────────────────────

export interface PredictionBucket {
    /** 桶名称，如 "5-30w" */
    label: string;
    /** 桶的播放量下界 */
    minPlays: number;
    /** 桶的播放量上界（Infinity 表示无上限） */
    maxPlays: number;
    /** 中枢值 */
    center: number;
}

/**
 * 默认预测桶（v0，观点视频）。
 * 随着校准样本累积，由 cheat-bump 重校。
 */
export const DEFAULT_BUCKETS: PredictionBucket[] = [
    { label: '>150w',   minPlays: 1_500_000, maxPlays: Infinity, center: 2_500_000 },
    { label: '100-150w', minPlays: 1_000_000, maxPlays: 1_500_000, center: 1_250_000 },
    { label: '50-100w',  minPlays: 500_000,   maxPlays: 1_000_000, center: 750_000 },
    { label: '30-50w',   minPlays: 300_000,   maxPlays: 500_000,   center: 400_000 },
    { label: '10-30w',   minPlays: 100_000,   maxPlays: 300_000,   center: 200_000 },
    { label: '5-10w',    minPlays: 50_000,    maxPlays: 100_000,   center: 75_000 },
    { label: '1-5w',     minPlays: 10_000,    maxPlays: 50_000,    center: 30_000 },
    { label: '<1w',      minPlays: 0,         maxPlays: 10_000,    center: 5_000 },
];

// ─── 预测文件完整结构 ────────────────────────────────────

/**
 * 完整预测文件结构（所有 7 组件）。
 * 
 * ```
 * file: predictions/YYYY-MM-DD_<id>_<short>.md
 * 
 * # 标题 — 预测日志              ← 组件 1: header
 * （metadata block）
 * 
 * ## 输入快照                     ← 组件 2
 * （scores + 用户改写要点 vs AI 草稿）
 * 
 * ## 预测 v1                      ← 组件 3 ⭐ IMMUTABLE 起点
 * （bucket + 概率 + 中枢 + 一句话 reason）
 * 
 * ## 推理因素                     ← 组件 4
 * （带方向 + 置信度的表）
 * 
 * ## 锚点对比                     ← 组件 5
 * （校准池不够时仍写"N/A 段"）
 * 
 * ## 反事实场景                   ← 组件 6
 * （每 bucket 一段"意味着什么"）
 * 
 * ## 关键校准假设                 ← 组件 7
 * （这次预测作为实验的明确赌注）
 * 
 * ## 预测 v2 (replaces v1)        ← 可选
 * 
 * ## 复盘                         ← 仅追加，IMMUTABLE 边界
 * ```
 */
export interface PredictionFile {
    header: PredictionHeader;
    inputSnapshot: string;
    predictionV1: {
        bucket: string;
        probability: number;
        centerEstimate: number;
        reason: string;
    };
    reasoningFactors: Array<{
        factor: string;
        direction: '+' | '-' | 'neutral';
        confidence: 'low' | 'medium' | 'high';
    }>;
    anchorComparison: string;
    counterfactualScenarios: string;
    calibrationAssumptions: string;
    /** v2 预测段（仅当拍摄稿与 scripts/ 草稿 diff ≥ 30%） */
    predictionV2?: string;
    /** 复盘段（cheat-retro 写，仅追加） */
    retro?: string;
}

// ─── 置信度派生（单一真值表） ────────────────────────────

/**
 * Confidence 自动派生自 calibration_samples。
 * 这是唯一真值——所有 prediction 文件 + status 显示都用同一张表。
 */
export function deriveConfidence(samples: number): 'low' | 'medium' | 'high' {
    if (samples >= 25) { return 'high'; }
    if (samples >= 10) { return 'medium'; }
    return 'low';
}

/** Confidence 的语义说明 */
export const CONFIDENCE_DESCRIPTIONS: Record<string, string> = {
    low: '校准样本 <10，预测精度约 ±50%。建议多跑闭环积累样本。',
    medium: '校准样本 10-24，预测精度约 ±30%。有参考价值但仍有波动。',
    high: '校准样本 ≥25，预测精度约 ±15%。可作为发布策略的可靠输入。',
};

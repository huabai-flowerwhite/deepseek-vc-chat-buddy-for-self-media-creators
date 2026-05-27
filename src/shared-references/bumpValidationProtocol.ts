/**
 * Bump Validation Protocol（升级验证协议）
 * 
 * 每当 cheat-bump 提议改动 rubric（维度/权重/公式），
 * 必须满足的验证标准。
 * 
 * 对应 cheat-on-content: shared-references/bump-validation-protocol.md
 */

// ─── 验证标准 ────────────────────────────────────────────

/**
 * Rubric 升级的前置条件。
 * 不满足任一条件 → cheat-bump 应拒绝或降级为 bucket-only。
 */
export const BUMP_PREREQUISITES = {
    /** 全量升级至少需要的校准样本数 */
    MIN_CALIBRATION_SAMPLES_FOR_FULL_BUMP: 5,
    /** 仅重校 bucket 至少需要的样本数 */
    MIN_CALIBRATION_SAMPLES_FOR_BUCKET_ONLY: 1,
} as const;

// ─── 跨模型审核（Channel C） ──────────────────────────────

/**
 * 完整 rubric bump 必须通过跨模型审核。
 * Channel C 使用不同于 Channel A/B 的模型。
 * 审核模型的回答判定为 PASS / FAIL / NEEDS_REVISION。
 */
export interface CrossModelAudit {
    /** 审核模型标识 */
    model: string;
    /** 审核判定 */
    verdict: 'PASS' | 'FAIL' | 'NEEDS_REVISION';
    /** 审核理由摘录 */
    reasonExcerpt: string;
    /** 关键风险 */
    keyRisk: string;
}

// ─── 验证步骤 ────────────────────────────────────────────

export enum BumpPhase {
    /** Phase 0：前置条件检查 */
    PREREQUISITE_CHECK = 0,
    /** Phase 1：偏差回顾（全量重打校准池） */
    DEVIATION_REVIEW = 1,
    /** Phase 2：诊断（哪些维度需要改） */
    DIAGNOSIS = 2,
    /** Phase 3：提议新公式 */
    PROPOSE = 3,
    /** Phase 4：全量重打（新公式跑校准池） */
    RESCORE_POOL = 4,
    /** Phase 5：落地（写 rubric_notes.md + rubric-memo.md） */
    COMMIT = 5,
    /** Phase 6：跨模型审核 */
    CROSS_MODEL_AUDIT = 6,
}

// ─── Memo 段格式 ─────────────────────────────────────────

/**
 * cheat-bump Phase 5 落地时写升级 Memo。
 * 写入 rubric-memo.md，不写入 rubric_notes.md（后者是 blind 白名单）。
 */
export interface BumpMemo {
    /** 触发日期 */
    date: string;
    /** 升级前版本号 */
    fromVersion: string;
    /** 升级后版本号 */
    toVersion: string;
    /** 校准样本数（升级时） */
    calibrationSamples: number;
    /** 旧公式 */
    oldFormula: string;
    /** 新公式 */
    newFormula: string;
    /** 变化摘要 */
    changes: string[];
    /** 跨模型审核结果 */
    crossModelAudit: CrossModelAudit | null;
    /** 已知局限 */
    knownLimitations: string[];
}

// ─── Bucket 重校常量 ─────────────────────────────────────

/**
 * 轻量 bucket 重校时不改动公式，
 * 只根据 calibration_pool 中预测 vs 实际的系统性偏差调整桶边界。
 */
export const BUCKET_ONLY_MODE = 'bucket-only' as const;
export const FULL_BUMP_MODE = 'full' as const;
export type BumpMode = typeof BUCKET_ONLY_MODE | typeof FULL_BUMP_MODE;

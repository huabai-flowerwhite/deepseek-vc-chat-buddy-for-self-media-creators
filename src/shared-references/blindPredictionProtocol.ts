/**
 * Blind Prediction Protocol（盲预测协议）
 * 
 * 被 cheat-predict / cheat-score / cheat-score-blind 引用。
 * 这是 cheat-on-content 原则 #1：预测必须在看到后续数据之前完成。
 * 
 * 对应 cheat-on-content: shared-references/blind-prediction-protocol.md
 */

// ─── 常量 ────────────────────────────────────────────────

/** 盲打分检查模式 */
export const BLIND_CHECK = 'strict' as const;
export type BlindCheckMode = 'strict' | 'lenient';

/** 盲打分开关 */
export const BLIND_SCORING = 'on' as const;
export type BlindScoringMode = 'on' | 'off';

/**
 * 主 Claude 自评与 blind sub-agent 的差异阈值。
 * |Δ| ≥ 此值时触发用户裁定（Phase 2.5）。
 */
export const DISAGREEMENT_THRESHOLD = 2;

// ─── 白名单：blind sub-agent 可读文件 ────────────────────

/**
 * Channel B（blind scorer sub-agent）只能读白名单中的文件。
 * 
 * 白名单：
 * - rubric_notes.md（通用规则，不含实绩）
 * - script_patterns.md（写作 pattern）
 * - scripts/<id>.md（当前脚本）
 * - starter-rubrics/（先验规则）
 * 
 * 硬禁读（hard refusal list）：
 * - rubric-memo.md（含实绩 + 视频名）
 * - audience.md（受众画像，隐含实绩）
 * - predictions/{asterisk}.md（历史预测含复盘段）
 * - videos/{asterisk}/report.md（实绩数据）
 * - benchmark.md（对标账号含播放量）
 */
export const BLIND_WHITELIST = [
    'rubric_notes.md',
    'script_patterns.md',
    'scripts/',
    'starter-rubrics/',
] as const;

export const BLIND_HARD_REFUSAL = [
    'rubric-memo.md',
    'audience.md',
    'predictions/',
    'videos/',
    'benchmark.md',
] as const;

// ─── 污染检测 ────────────────────────────────────────────

/**
 * 污染信号检测。
 * blind sub-agent 在 Phase 0 边界自检时扫描文件内容。
 * 命中任意模式 → 拒绝打分，返回 non_blind_warning。
 */
export const CONTAMINATION_PATTERNS: RegExp[] = [
    /播放\s*\d+[w万]/,
    /实绩\s*\d+[w万]/,
    /实际\s*\d+[w万]/,
    /点赞\s*\d+/,
    /评论\s*\d+/,
    /转发\s*\d+/,
    /\d+\.?\d*w\s*(播放|展现|曝光)/,
];

// ─── Immutability（不可变性） ────────────────────────────

/**
 * 预测段 IMMUTABLE 边界。
 * 一旦写完 predictions/<id>.md 的 "## 预测 v1" 段：
 * - 不可编辑
 * - 不可删除
 * - 只能追加 "## 预测 v2"（新段）
 * - 只能追加 "## 复盘"（复盘段）
 * 
 * 保护机制：prediction-immutability hook（.cheat-hooks/）
 */
export const IMMUTABLE_SECTION_MARKER = '## 预测 v1';

/**
 * 允许追加的段标记（白名单）。
 * 其它任何对 prediction 文件内容的修改都被 hook 拦截。
 */
export const APPEND_ONLY_SECTIONS = [
    '## 预测 v2',
    '## 预测 v3',
    '## 发布信息',
    '## 复盘',
] as const;

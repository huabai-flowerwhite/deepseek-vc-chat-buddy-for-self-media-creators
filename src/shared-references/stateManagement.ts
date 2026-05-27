/**
 * State Management — 状态文件读写约定
 * 
 * 定义 .cheat-state.json 的完整 schema、字段语义、读写协议。
 * 被所有子命令引用——任何运行时状态、累计指标、模式标记都从这里读写。
 * 
 * 对应 cheat-on-content: shared-references/state-management.md
 */

// ─── Schema 版本 ─────────────────────────────────────────

/** 当前最新 schema 版本 */
export const LATEST_SCHEMA_VERSION = '1.4';

/** 当前 skill 版本 */
export const SKILL_VERSION = '1.0.0';

// ─── 状态文件位置 ────────────────────────────────────────

export const STATE_FILENAME = '.cheat-state.json';

// ─── 完整 Schema 接口 ────────────────────────────────────

export interface CheatState {
    // ── 版本 ──
    schema_version: string;
    skill_version: string;

    // ── 模式与配置（cheat-init 写） ──
    rubric_version: string;
    content_form: ContentForm;
    typical_duration_seconds: number;
    target_publish_cadence_days: number;
    rubric_form_mismatch: boolean;

    // ── 对标（cheat-learn-from 触发，cheat-init 初始化） ──
    benchmark_status: 'none' | 'partial' | 'done';
    benchmark_name: string | null;
    benchmark_sample_count: number;

    // ── 校准（cheat-predict / cheat-retro / cheat-bump 读写） ──
    calibration_samples: number;
    calibration_samples_at_last_bump: number;
    baseline_plays: number | null;

    // ── 数据层（cheat-init 确定，后续不改） ──
    data_collection: 'manual' | 'semi-auto' | 'auto';
    pool_status: 'none' | 'small' | 'medium' | 'large';
    data_layer: 'markdown' | 'sqlite';

    // ── Buffer（cheat-shoot +1, cheat-publish -1） ──
    buffer: number;

    // ── Hooks ──
    hooks_installed: boolean;

    // ── 适配器配置 ──
    enabled_trend_sources: string[];
    enabled_perf_adapters: string[];

    // ── 时间戳 ──
    last_bump_at: string | null;
    last_bump_self_audited: boolean;
    last_published_at: string | null;
    last_retro_at: string | null;

    // ── 盲打分状态（cheat-predict 读写） ──
    last_prediction_self_scored: boolean;

    // ── 会话状态（cheat-predict / cheat-bump 读写） ──
    in_progress_session: InProgressSession | null;

    // ── 校准池（cheat-retro 维护） ──
    calibration_pool: CalibrationEntry[];

    // ── 扩展字段 ──
    [key: string]: unknown;
}

export type ContentForm = 
    | 'opinion-video'
    | 'long-essay'
    | 'short-text'
    | 'podcast'
    | 'other'
    | 'mixed';

export interface InProgressSession {
    type: 'prediction' | 'bump';
    file: string;
    started_at: string;
    rubric_version: string;
}

export interface CalibrationEntry {
    prediction_file: string;
    predicted_bucket: string;
    actual_plays: number;
    in_bucket: boolean;
    deviation_pct: number;
    retro_at: string;
    observations: string[];
}

// ─── 默认状态 ────────────────────────────────────────────

export function createDefaultState(contentForm: ContentForm): CheatState {
    return {
        schema_version: LATEST_SCHEMA_VERSION,
        skill_version: SKILL_VERSION,
        rubric_version: 'v0',
        content_form: contentForm,
        typical_duration_seconds: 240,
        target_publish_cadence_days: 2,
        rubric_form_mismatch: false,
        benchmark_status: 'none',
        benchmark_name: null,
        benchmark_sample_count: 0,
        calibration_samples: 0,
        calibration_samples_at_last_bump: 0,
        baseline_plays: null,
        data_collection: 'manual',
        pool_status: 'none',
        data_layer: 'markdown',
        buffer: 0,
        hooks_installed: true,
        enabled_trend_sources: ['manual-paste'],
        enabled_perf_adapters: [],
        last_bump_at: null,
        last_bump_self_audited: false,
        last_published_at: null,
        last_retro_at: null,
        last_prediction_self_scored: false,
        in_progress_session: null,
        calibration_pool: [],
    };
}

// ─── 字段责任表 ──────────────────────────────────────────

/**
 * 每个字段的写入者 + 读取者。
 * 防止"谁该写这个字段"的歧义。
 */
export const FIELD_OWNERSHIP: Record<string, { writers: string[]; readers: string[] }> = {
    schema_version:      { writers: ['cheat-init', 'cheat-migrate'], readers: ['所有'] },
    rubric_version:      { writers: ['cheat-init', 'cheat-bump'],    readers: ['cheat-score', 'cheat-predict', 'cheat-retro'] },
    content_form:        { writers: ['cheat-init'],                  readers: ['cheat-predict', 'cheat-recommend'] },
    calibration_samples: { writers: ['cheat-predict', 'cheat-retro'], readers: ['cheat-predict', 'cheat-bump', 'cheat-status'] },
    buffer:              { writers: ['cheat-shoot', 'cheat-publish'], readers: ['cheat-status', 'cheat-recommend'] },
    calibration_pool:    { writers: ['cheat-retro'],                 readers: ['cheat-bump', 'cheat-score-curve'] },
    last_prediction_self_scored: { writers: ['cheat-predict'],       readers: ['cheat-status'] },
    in_progress_session: { writers: ['cheat-predict', 'cheat-bump'], readers: ['cheat-status'] },
};

// ─── 缓存文件 ────────────────────────────────────────────

export const CACHE_DIR = '.cheat-cache';
export const CACHE_FILES = [
    'usage.jsonl',
    'trends-history.jsonl',
] as const;

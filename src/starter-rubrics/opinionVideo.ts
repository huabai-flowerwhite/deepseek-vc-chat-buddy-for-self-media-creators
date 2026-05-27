/**
 * Starter Rubric: 观点视频 v1（已校准 25+ 样本）
 * 
 * 对应 cheat-on-content: starter-rubrics/opinion-video.md
 * 这是经过实际数据校准后的评分规则。
 * 冷启动用户先走 opinion-video-zero（等权占位），
 * 积累 ≥5 个校准样本后可升级到此版本。
 */

import type { ContentForm } from '../shared-references/stateManagement';

export interface RubricDefinition {
    /** 内容形态 */
    contentForm: ContentForm;
    /** 版本号 */
    version: string;
    /** 公式（自然语言 + 数学表达式） */
    formula: string;
    /** 公式表达式（用于 composite 计算） */
    formulaExpression: string;
    /** 维度定义 */
    dimensions: RubricDimension[];
    /** 最小校准样本数 */
    minCalibrationSamples: number;
    /** 预测桶 */
    buckets: RubricBucket[];
}

export interface RubricDimension {
    /** 维度全名 */
    fullName: string;
    /** 维度缩写（2-3 大写字母） */
    abbr: string;
    /** 权重（公式中的系数） */
    weight: number;
    /** 定义说明 */
    definition: string;
    /** 打分指引（0-5 分的锚点描述） */
    scoringAnchors: Record<number, string>;
}

export interface RubricBucket {
    label: string;
    minPlays: number;
    maxPlays: number;
    center: number;
}

// ─── v1: 观点视频（已校准） ──────────────────────────────

export const OPINION_VIDEO_V1: RubricDefinition = {
    contentForm: 'opinion-video',
    version: 'v1',
    formula: '(ER×1.5 + HP×1.5 + QL + NA + AB + SR + SAT) / 7.0 × 2.0',
    formulaExpression: '(ER*1.5 + HP*1.5 + QL + NA + AB + SR + SAT) / 7.0 * 2.0',
    minCalibrationSamples: 5,
    dimensions: [
        {
            fullName: 'Emotional Resonance',
            abbr: 'ER',
            weight: 1.5,
            definition: '情感共鸣力——观众"被击中"的程度。具象化生活经验 → 高 ER。',
            scoringAnchors: {
                0: '毫无情感元素，纯信息罗列',
                1: '有情感词汇但空洞（如"太震撼了"）',
                2: '尝试具象但未击中（如"你也有这种感觉吧"）',
                3: '有一个具体场景能引发共鸣',
                4: '多个场景叠加，形成情感累积',
                5: '极端具象——"半夜三点翻聊天记录"级别',
            },
        },
        {
            fullName: 'Hook Power',
            abbr: 'HP',
            weight: 1.5,
            definition: '开头抓人力——前 3 秒是否让人停下滑动。IS 句（Immediate Specific）一句锁定受众。',
            scoringAnchors: {
                0: '无 hook，直接开始正文',
                1: '有 hook 意图但泛（如"今天聊个话题"）',
                2: 'hook 有信息量但不够冲突',
                3: 'hook 制造了明确悬念或冲突',
                4: 'hook 一句锁定目标受众 + 暗示 payoff',
                5: 'hook 极端高效——一句话让人"必须看完"',
            },
        },
        {
            fullName: 'Quality of Logic',
            abbr: 'QL',
            weight: 1.0,
            definition: '逻辑质量——论证是否自洽、有说服力。',
            scoringAnchors: {
                0: '逻辑断裂，前后矛盾',
                1: '有逻辑链但多处跳跃',
                2: '基本通顺但缺乏层次',
                3: '逻辑清晰，有递进',
                4: '论证严密，多角度支撑',
                5: '无懈可击——反方观点也被提前化解',
            },
        },
        {
            fullName: 'Novelty Angle',
            abbr: 'NA',
            weight: 1.0,
            definition: '新颖度——角度是否独特、反常识。',
            scoringAnchors: {
                0: '完全重复常见观点',
                1: '换个说法讲老话题',
                2: '有新的例子但角度不变',
                3: '角度有新鲜感',
                4: '反常识但能自洽',
                5: '颠覆认知——"原来如此！"级别',
            },
        },
        {
            fullName: 'Audience Breadth',
            abbr: 'AB',
            weight: 1.0,
            definition: '受众广度——多少人会关心这个话题。',
            scoringAnchors: {
                0: '极度小众',
                1: '圈层内话题',
                2: '有一定泛化潜力',
                3: '跨圈层有共鸣',
                4: '大多数人会点开看看',
                5: '全民话题——"你妈也会转发"',
            },
        },
        {
            fullName: 'Shareability',
            abbr: 'SR',
            weight: 1.0,
            definition: '转发意愿——观众会不会转发/艾特别人。',
            scoringAnchors: {
                0: '没有转发动机',
                1: '有信息价值但无社交属性',
                2: '有人会保存但不会转发',
                3: '部分人会转发到相关群',
                4: '提供了社交货币——转发显得自己懂',
                5: '病毒级——"必须让你也看看"',
            },
        },
        {
            fullName: 'Satisfaction',
            abbr: 'SAT',
            weight: 1.0,
            definition: '完播满足感——看完有没有"值了"的感觉。',
            scoringAnchors: {
                0: '看完后悔浪费时间',
                1: '看完无感',
                2: '有一点收获但不深',
                3: '有明确收获，会点赞',
                4: '收获很大 + 情绪满足',
                5: '改变行为——"我要试试/我要反思"',
            },
        },
    ],
    buckets: [
        { label: '>150w',   minPlays: 1_500_000, maxPlays: Infinity, center: 2_500_000 },
        { label: '100-150w', minPlays: 1_000_000, maxPlays: 1_500_000, center: 1_250_000 },
        { label: '50-100w',  minPlays: 500_000,   maxPlays: 1_000_000, center: 750_000 },
        { label: '30-50w',   minPlays: 300_000,   maxPlays: 500_000,   center: 400_000 },
        { label: '10-30w',   minPlays: 100_000,   maxPlays: 300_000,   center: 200_000 },
        { label: '5-10w',    minPlays: 50_000,    maxPlays: 100_000,   center: 75_000 },
        { label: '1-5w',     minPlays: 10_000,    maxPlays: 50_000,    center: 30_000 },
        { label: '<1w',      minPlays: 0,         maxPlays: 10_000,    center: 5_000 },
    ],
};

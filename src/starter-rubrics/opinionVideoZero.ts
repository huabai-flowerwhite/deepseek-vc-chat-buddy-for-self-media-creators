/**
 * Starter Rubric: 观点视频 v0（cold-start 等权占位）
 * 
 * 对应 cheat-on-content: starter-rubrics/opinion-video-zero.md
 * 冷启动用户的初始评分规则——所有维度等权。
 * 跑完 ≥5 次闭环复盘后可升级到 v1。
 */

import type { RubricDefinition } from './opinionVideo';

/** v0: Cold-start 等权占位 rubric */
export const OPINION_VIDEO_V0: RubricDefinition = {
    contentForm: 'opinion-video',
    version: 'v0',
    formula: '(ER + HP + QL + NA + AB + SR + SAT) / 7',
    formulaExpression: '(ER + HP + QL + NA + AB + SR + SAT) / 7',
    minCalibrationSamples: 0,
    dimensions: [
        {
            fullName: 'Emotional Resonance',
            abbr: 'ER',
            weight: 1.0,
            definition: '情感共鸣力——观众"被击中"的程度',
            scoringAnchors: {
                0: '无情感元素', 1: '有情感词汇但空洞', 2: '尝试具象但未击中',
                3: '有一个具体场景能引发共鸣', 4: '多个场景叠加', 5: '极端具象',
            },
        },
        {
            fullName: 'Hook Power',
            abbr: 'HP',
            weight: 1.0,
            definition: '开头抓人力——前 3 秒是否让人停下滑动',
            scoringAnchors: {
                0: '无 hook', 1: '有 hook 意图但泛', 2: '有信息量但不够冲突',
                3: '制造了明确悬念', 4: '一句锁定目标受众', 5: '极端高效',
            },
        },
        {
            fullName: 'Quality of Logic',
            abbr: 'QL',
            weight: 1.0,
            definition: '逻辑质量——论证是否自洽、有说服力',
            scoringAnchors: {
                0: '逻辑断裂', 1: '多处跳跃', 2: '基本通顺但缺层次',
                3: '逻辑清晰有递进', 4: '论证严密', 5: '无懈可击',
            },
        },
        {
            fullName: 'Novelty Angle',
            abbr: 'NA',
            weight: 1.0,
            definition: '新颖度——角度是否独特、反常识',
            scoringAnchors: {
                0: '完全重复', 1: '换个说法', 2: '新例子旧角度',
                3: '角度有新鲜感', 4: '反常识', 5: '颠覆认知',
            },
        },
        {
            fullName: 'Audience Breadth',
            abbr: 'AB',
            weight: 1.0,
            definition: '受众广度——多少人会关心这个话题',
            scoringAnchors: {
                0: '极度小众', 1: '圈层内', 2: '有一定泛化',
                3: '跨圈层', 4: '大多数人', 5: '全民话题',
            },
        },
        {
            fullName: 'Shareability',
            abbr: 'SR',
            weight: 1.0,
            definition: '转发意愿——观众会不会转发/艾特别人',
            scoringAnchors: {
                0: '无动机', 1: '有信息但无社交属性', 2: '会保存不转发',
                3: '会转发到群', 4: '社交货币', 5: '病毒级',
            },
        },
        {
            fullName: 'Satisfaction',
            abbr: 'SAT',
            weight: 1.0,
            definition: '完播满足感——看完有没有"值了"的感觉',
            scoringAnchors: {
                0: '后悔浪费时间', 1: '无感', 2: '有点收获不深',
                3: '有明确收获', 4: '收获大+情绪满足', 5: '改变行为',
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

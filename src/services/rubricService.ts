/**
 * RubricService — 评分规则加载与版本管理
 * 
 * 负责根据 state 中的 rubric_version 和 content_form
 * 加载正确的评分规则定义。
 * 
 * 对应 cheat-on-content: starter-rubrics/ + skills/cheat-score/SKILL.md
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CheatState } from '../shared-references/stateManagement';
import { RubricDefinition, OPINION_VIDEO_V1 } from '../starter-rubrics/opinionVideo';
import { OPINION_VIDEO_V0 } from '../starter-rubrics/opinionVideoZero';

/** 所有内置 starter rubrics（按 content_form → version 索引） */
const BUILTIN_RUBRICS: Record<string, Record<string, RubricDefinition>> = {
    'opinion-video': {
        'v0': OPINION_VIDEO_V0,
        'v1': OPINION_VIDEO_V1,
    },
};

export class RubricService {
    /**
     * 获取当前项目的 rubric 定义。
     * 优先级：rubric_notes.md（用户自定义） > starter-rubrics（内置）
     */
    async getRubric(
        projectRoot: string,
        state: CheatState
    ): Promise<RubricDefinition | null> {
        // 1. 尝试从 rubric_notes.md 解析
        const rubricPath = path.join(projectRoot, 'rubric_notes.md');
        if (fs.existsSync(rubricPath)) {
            const content = await fs.promises.readFile(rubricPath, 'utf-8');
            const parsed = this.parseRubricNotes(content, state);
            if (parsed) { return parsed; }
        }

        // 2. 回退到内置 starter rubric
        return this.getBuiltinRubric(state.content_form, state.rubric_version);
    }

    /**
     * 获取内置 starter rubric
     */
    getBuiltinRubric(contentForm: string, version: string): RubricDefinition | null {
        const formRubrics = BUILTIN_RUBRICS[contentForm];
        if (!formRubrics) { return null; }
        return formRubrics[version] || formRubrics['v0'] || null;
    }

    /**
     * 解析 rubric_notes.md 中的公式和维度定义。
     * 这是一个轻量解析器——完整解析由 Copilot 对话完成。
     */
    private parseRubricNotes(content: string, state: CheatState): RubricDefinition | null {
        // 提取版本号
        const versionMatch = content.match(/版本[：:]\s*(v\d+)/i);
        const version = versionMatch?.[1] || state.rubric_version;

        // 提取公式
        const formulaMatch = content.match(/公式[：:]\s*(.+)/i);
        if (!formulaMatch) { return null; }

        // 尝试解析维度权重
        const dimRegex = /\|\s*(\w{2,4})\s*\|[^|]*\|\s*(\d+\.?\d*)\s*\|/g;
        const dimensions: RubricDefinition['dimensions'] = [];
        let match;
        while ((match = dimRegex.exec(content)) !== null) {
            const abbr = match[1].trim();
            const weight = parseFloat(match[2]);
            if (!isNaN(weight) && abbr.length >= 2) {
                dimensions.push({
                    fullName: abbr,
                    abbr,
                    weight,
                    definition: '',
                    scoringAnchors: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '' },
                });
            }
        }

        if (dimensions.length === 0) { return null; }

        return {
            contentForm: state.content_form as RubricDefinition['contentForm'],
            version,
            formula: formulaMatch[1].trim(),
            formulaExpression: formulaMatch[1].trim(),
            minCalibrationSamples: 0,
            dimensions,
            buckets: OPINION_VIDEO_V0.buckets, // 默认桶
        };
    }

    /**
     * 根据 composite 分数确定预测桶
     */
    getBucketForScore(composite: number, rubric: RubricDefinition): string {
        // 简化的桶映射逻辑
        if (composite >= 4.5) { return rubric.buckets[0]?.label || '>150w'; }
        if (composite >= 4.0) { return rubric.buckets[1]?.label || '100-150w'; }
        if (composite >= 3.5) { return rubric.buckets[2]?.label || '50-100w'; }
        if (composite >= 3.0) { return rubric.buckets[3]?.label || '30-50w'; }
        if (composite >= 2.5) { return rubric.buckets[4]?.label || '10-30w'; }
        if (composite >= 2.0) { return rubric.buckets[5]?.label || '5-10w'; }
        if (composite >= 1.5) { return rubric.buckets[6]?.label || '1-5w'; }
        return rubric.buckets[7]?.label || '<1w';
    }

    /**
     * 计算公式 composite 值
     */
    computeComposite(
        scores: Record<string, number>,
        rubric: RubricDefinition
    ): number {
        let numerator = 0;
        let denominator = 0;

        for (const dim of rubric.dimensions) {
            const score = scores[dim.abbr];
            if (score !== undefined) {
                numerator += score * dim.weight;
                denominator += dim.weight;
            }
        }

        if (denominator === 0) { return 0; }
        return numerator / denominator;
    }

    /**
     * 列出所有可用的内置 rubric
     */
    listBuiltinRubrics(): Array<{ contentForm: string; version: string }> {
        const result: Array<{ contentForm: string; version: string }> = [];
        for (const [form, versions] of Object.entries(BUILTIN_RUBRICS)) {
            for (const version of Object.keys(versions)) {
                result.push({ contentForm: form, version });
            }
        }
        return result;
    }
}

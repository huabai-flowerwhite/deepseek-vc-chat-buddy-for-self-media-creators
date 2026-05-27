/**
 * /cheat-bump — Rubric / Bucket 升级
 * 
 * 对应 cheat-on-content: skills/cheat-bump/SKILL.md
 * 
 * Overview:
 * ```
 * 入口：用户触发 /cheat-bump
 *   ↓
 * [Phase A0: 检测调用模式]
 *   ↓
 *   ├─ --bucket-only  →  [Phase B: 轻量 bucket 重校]
 *   └─ --propose      →  [Phase 0~6: 完整 rubric bump]
 *       ├─ Phase 0: 前置条件检查
 *       ├─ Phase 1: 偏差回顾
 *       ├─ Phase 2: 诊断
 *       ├─ Phase 3: 提议新公式
 *       ├─ Phase 4: 全量重打
 *       ├─ Phase 5: 落地
 *       └─ Phase 6: 跨模型审核（Channel C）
 * ```
 */

import * as vscode from 'vscode';
import { StateService } from '../services/stateService';
import { BUMP_PREREQUISITES } from '../shared-references/bumpValidationProtocol';

export async function cheatBump(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    // ── Phase A0: 检测调用模式 ──
    const mode = await vscode.window.showQuickPick(
        [
            {
                label: '完整 Rubric 升级',
                description: `改动维度/权重/公式（需 ≥${BUMP_PREREQUISITES.MIN_CALIBRATION_SAMPLES_FOR_FULL_BUMP} 个校准样本 + 跨模型审核）`,
                value: 'full'
            },
            {
                label: '仅重校 Bucket',
                description: `只调整预测桶边界，不动公式（需 ≥${BUMP_PREREQUISITES.MIN_CALIBRATION_SAMPLES_FOR_BUCKET_ONLY} 个样本）`,
                value: 'bucket-only'
            }
        ],
        { placeHolder: '选择升级模式' }
    );
    if (!mode) { return; }

    // 前置条件检查
    const samples = state.calibration_samples;
    if (mode.value === 'full' && samples < BUMP_PREREQUISITES.MIN_CALIBRATION_SAMPLES_FOR_FULL_BUMP) {
        const downgrade = await vscode.window.showWarningMessage(
            `完整升级至少需要 ${BUMP_PREREQUISITES.MIN_CALIBRATION_SAMPLES_FOR_FULL_BUMP} 个校准样本（当前: ${samples}）。`,
            '降级为 bucket-only',
            '仍要尝试',
            '取消'
        );
        if (downgrade === '取消') { return; }
        if (downgrade === '降级为 bucket-only') {
            await runBucketOnly(state);
            return;
        }
    }

    if (mode.value === 'bucket-only') {
        await runBucketOnly(state);
    } else {
        await runFullBump(state);
    }
}

async function runBucketOnly(state: Record<string, unknown>): Promise<void> {
    const query = [
        `帮我重校预测桶边界（bucket-only 模式）。`,
        ``,
        `前置条件：`,
        `- 只调整各桶的播放量区间`,
        `- 不动 rubric 公式和维度权重`,
        ``,
        `步骤：`,
        `1. 回顾 calibration_pool 中预测 vs 实际偏差`,
        `2. 识别系统性偏高/偏低的桶`,
        `3. 调整桶边界`,
        `4. 更新 rubric_notes.md 的 Bucket 段`,
        ``,
        `当前版本: ${state.rubric_version}`,
        `校准样本: ${state.calibration_samples}`,
    ].join('\n');
    await vscode.commands.executeCommand('workbench.action.chat.open', { query });
}

async function runFullBump(state: Record<string, unknown>): Promise<void> {
    const query = [
        `帮我启动完整 rubric 升级流程。`,
        ``,
        `Phase 1: 偏差回顾——全量重打校准池中所有预测 vs 实际`,
        `Phase 2: 诊断——识别哪些维度权重需要调整`,
        `Phase 3: 提议新公式`,
        `Phase 4: 全量重打——新公式跑校准池`,
        `Phase 5: 落地——写 rubric_notes.md + rubric-memo.md`,
        `Phase 6: 跨模型审核——用不同模型验证升级合理性`,
        ``,
        `当前版本: ${state.rubric_version}`,
        `校准样本: ${state.calibration_samples}`,
        `样本数 at last bump: ${state.calibration_samples_at_last_bump || 0}`,
    ].join('\n');
    await vscode.commands.executeCommand('workbench.action.chat.open', { query });
}

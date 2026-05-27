/**
 * MigrationService — Schema 版本迁移
 * 
 * 管理 .cheat-state.json 的版本升级。
 * 每个迁移步骤对应 migrations/ 中一个迁移文件。
 * 
 * 对应 cheat-on-content: migrations/ + skills/cheat-migrate/SKILL.md
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CheatState, LATEST_SCHEMA_VERSION } from '../shared-references/stateManagement';

// ─── 迁移步骤定义 ────────────────────────────────────────

interface MigrationStep {
    /** 迁移步骤编号 */
    seq: number;
    /** 起始版本 */
    from: string;
    /** 目标版本 */
    to: string;
    /** 类型 */
    type: 'MINOR' | 'PATCH';
    /** 新增字段 */
    addedFields?: string[];
    /** 删除字段 */
    removedFields?: string[];
    /** 重命名字段 */
    renamedFields?: Record<string, string>;
    /** 迁移函数 */
    migrate: (state: Record<string, unknown>) => Record<string, unknown>;
}

// ─── 迁移注册表 ──────────────────────────────────────────

const MIGRATION_REGISTRY: MigrationStep[] = [
    // 1.0 → 1.1: 添加 calibration_pool, in_progress_session 等字段
    {
        seq: 1,
        from: '1.0',
        to: '1.1',
        type: 'MINOR',
        addedFields: [
            'skill_version',
            'typical_duration_seconds',
            'target_publish_cadence_days',
            'rubric_form_mismatch',
            'benchmark_status',
            'benchmark_name',
            'benchmark_sample_count',
            'baseline_plays',
            'data_collection',
            'pool_status',
            'last_bump_self_audited',
            'in_progress_session',
            'calibration_pool',
            'calibration_samples_at_last_bump',
        ],
        removedFields: [],
        renamedFields: {},
        migrate: (state: Record<string, unknown>) => {
            const s = { ...state };
            s.schema_version = '1.1';
            s.skill_version = '1.0.0';
            s.typical_duration_seconds = (s.typical_duration_seconds as number) || 240;
            s.target_publish_cadence_days = (s.target_publish_cadence_days as number) || 2;
            s.rubric_form_mismatch = false;
            s.benchmark_status = 'none';
            s.benchmark_name = null;
            s.benchmark_sample_count = 0;
            s.baseline_plays = s.baseline_plays || null;
            s.data_collection = 'manual';
            s.pool_status = 'none';
            s.last_bump_self_audited = false;
            s.in_progress_session = null;
            s.calibration_pool = [];
            s.calibration_samples_at_last_bump = 0;
            return s;
        },
    },
    // 1.1 → 1.2: 添加 hooks_installed + enabled adapters
    {
        seq: 2,
        from: '1.1',
        to: '1.2',
        type: 'MINOR',
        addedFields: [
            'hooks_installed',
            'enabled_trend_sources',
            'enabled_perf_adapters',
        ],
        removedFields: [],
        renamedFields: {},
        migrate: (state: Record<string, unknown>) => {
            const s = { ...state };
            s.schema_version = '1.2';
            s.hooks_installed = true;
            s.enabled_trend_sources = (s.enabled_trend_sources as string[]) || ['manual-paste'];
            s.enabled_perf_adapters = (s.enabled_perf_adapters as string[]) || [];
            return s;
        },
    },
    // 1.2 → 1.3: 添加 last_prediction_self_scored
    {
        seq: 3,
        from: '1.2',
        to: '1.3',
        type: 'MINOR',
        addedFields: ['last_prediction_self_scored'],
        removedFields: [],
        renamedFields: {},
        migrate: (state: Record<string, unknown>) => {
            const s = { ...state };
            s.schema_version = '1.3';
            s.last_prediction_self_scored = false;
            return s;
        },
    },
    // 1.3 → 1.4: 添加 last_published_at, last_retro_at
    {
        seq: 4,
        from: '1.3',
        to: '1.4',
        type: 'MINOR',
        addedFields: ['last_published_at', 'last_retro_at'],
        removedFields: [],
        renamedFields: {},
        migrate: (state: Record<string, unknown>) => {
            const s = { ...state };
            s.schema_version = '1.4';
            s.last_published_at = s.last_published_at || null;
            s.last_retro_at = s.last_retro_at || null;
            return s;
        },
    },
];

// ─── MigrationService ────────────────────────────────────

export class MigrationService {
    /**
     * 获取当前 schema 到最新版本之间的迁移路径
     */
    getMigrationPath(currentVersion: string): MigrationStep[] {
        const path: MigrationStep[] = [];
        let cursor = currentVersion;

        while (cursor !== LATEST_SCHEMA_VERSION) {
            const step = MIGRATION_REGISTRY.find(s => s.from === cursor);
            if (!step) {
                throw new Error(
                    `无法找到从 ${cursor} 到 ${LATEST_SCHEMA_VERSION} 的迁移路径。` +
                    `请检查 schema 版本是否正确。`
                );
            }
            path.push(step);
            cursor = step.to;
        }

        return path;
    }

    /**
     * 执行 dry-run：输出迁移计划但不实际修改
     */
    dryRun(currentVersion: string): string[] {
        const lines: string[] = [];
        const migrationPath = this.getMigrationPath(currentVersion);

        lines.push('📋 迁移计划');
        lines.push('');
        lines.push(`当前版本: ${currentVersion}`);
        lines.push(`目标版本: ${LATEST_SCHEMA_VERSION}`);
        lines.push(`将按顺序跑 ${migrationPath.length} 步：`);
        lines.push('');

        for (const step of migrationPath) {
            lines.push(`  [${step.seq}/${migrationPath.length}] ${step.from} → ${step.to}（${step.type}）`);
            if (step.addedFields && step.addedFields.length > 0) {
                lines.push(`       新增字段：${step.addedFields.join(', ')}（共 ${step.addedFields.length} 字段）`);
            }
            if (step.removedFields && step.removedFields.length > 0) {
                lines.push(`       删除字段：${step.removedFields.join(', ')}`);
            }
            if (step.renamedFields && Object.keys(step.renamedFields).length > 0) {
                lines.push(`       重命名字段：${JSON.stringify(step.renamedFields)}`);
            }
        }

        return lines;
    }

    /**
     * 执行迁移：将 state 从当前版本升级到最新版
     */
    async migrate(state: CheatState, projectRoot: string): Promise<CheatState> {
        const currentVersion = state.schema_version;
        const migrationPath = this.getMigrationPath(currentVersion);

        // 备份
        await this.backupState(projectRoot);

        // 逐步迁移
        let current = { ...state } as Record<string, unknown>;
        for (const step of migrationPath) {
            current = step.migrate(current);
        }

        return current as unknown as CheatState;
    }

    /**
     * 检查状态是否需要迁移
     */
    needsMigration(state: CheatState): boolean {
        return state.schema_version !== LATEST_SCHEMA_VERSION;
    }

    /**
     * 备份当前 .cheat-state.json
     */
    private async backupState(projectRoot: string): Promise<void> {
        const statePath = path.join(projectRoot, '.cheat-state.json');
        if (!fs.existsSync(statePath)) { return; }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(projectRoot, `.cheat-state.json.backup-${timestamp}`);

        await fs.promises.copyFile(statePath, backupPath);
    }
}

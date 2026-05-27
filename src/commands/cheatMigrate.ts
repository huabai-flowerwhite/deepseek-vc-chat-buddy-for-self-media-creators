/**
 * /cheat-migrate — Schema 版本迁移
 * 
 * 对应 cheat-on-content: skills/cheat-migrate/SKILL.md + migrations/
 * 
 * Overview:
 * ```
 * [Phase 0: 检查当前版本 vs 最新版本]
 *   ↓
 * [Phase 1: dry-run 输出迁移计划]
 *   ↓
 * [Phase 2: 用户确认]
 *   ↓
 * [Phase 3: 执行迁移（逐步）]
 *   ↓
 * [Phase 4: 验证 + 输出结果]
 * ```
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';
import { MigrationService } from '../services/migrationService';
import { LATEST_SCHEMA_VERSION } from '../shared-references/stateManagement';

export async function cheatMigrate(stateService: StateService): Promise<void> {
    const root = stateService.requireWorkspaceRoot();
    const state = await stateService.readState(root);
    if (!state) { vscode.window.showErrorMessage('项目未初始化'); return; }

    const migrationService = new MigrationService();

    // ── Phase 0: 检查版本 ──
    if (!migrationService.needsMigration(state)) {
        vscode.window.showInformationMessage(
            `✅ Schema 已是最新版本 (${LATEST_SCHEMA_VERSION})，无需迁移。`
        );
        return;
    }

    // ── Phase 1: dry-run ──
    const plan = migrationService.dryRun(state.schema_version);
    const planText = plan.join('\n') + '\n\n⚠️ 备份位置: .cheat-state.json.backup-<timestamp>\n\n是否继续？';

    const confirm = await vscode.window.showInformationMessage(
        planText,
        { modal: true },
        '确认迁移',
        '取消'
    );
    if (confirm !== '确认迁移') { return; }

    // ── Phase 3: 执行迁移 ──
    try {
        const migrated = await migrationService.migrate(state, root);
        await stateService.writeState(root, migrated);

        // ── Phase 4: 验证 ──
        vscode.window.showInformationMessage(
            `✅ 迁移完成！\n${state.schema_version} → ${LATEST_SCHEMA_VERSION}\n新增字段: 检查 .cheat-state.json`,
            '打开状态文件'
        ).then(choice => {
            if (choice === '打开状态文件') {
                const statePath = path.join(root, '.cheat-state.json');
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(statePath));
            }
        });
    } catch (e) {
        vscode.window.showErrorMessage(`迁移失败: ${e}`);
    }
}

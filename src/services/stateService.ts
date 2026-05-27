import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    CheatState,
    createDefaultState,
    LATEST_SCHEMA_VERSION,
    STATE_FILENAME,
    CACHE_DIR,
    CACHE_FILES,
} from '../shared-references/stateManagement';
import { MigrationService } from './migrationService';

// Re-export for backward compatibility
export type { CheatState } from '../shared-references/stateManagement';

export class StateService {
    private migrationService = new MigrationService();

    /**
     * 读取项目状态（自动迁移到最新 schema）
     */
    async readState(projectRoot: string): Promise<CheatState | null> {
        const statePath = path.join(projectRoot, STATE_FILENAME);
        if (!fs.existsSync(statePath)) {
            return null;
        }
        try {
            const content = await fs.promises.readFile(statePath, 'utf-8');
            let state = JSON.parse(content) as CheatState;

            // 自动迁移
            if (this.migrationService.needsMigration(state)) {
                const migrated = await this.migrationService.migrate(state, projectRoot);
                await this.writeState(projectRoot, migrated);
                state = migrated;
            }

            return state;
        } catch (e) {
            vscode.window.showErrorMessage(`读取 ${STATE_FILENAME} 失败: ${e}`);
            return null;
        }
    }

    /**
     * 写入项目状态（原子写）
     */
    async writeState(projectRoot: string, state: CheatState): Promise<void> {
        const statePath = path.join(projectRoot, STATE_FILENAME);
        const tmpPath = statePath + '.tmp';
        try {
            const content = JSON.stringify(state, null, 2);
            await fs.promises.writeFile(tmpPath, content, 'utf-8');
            await fs.promises.rename(tmpPath, statePath);
        } catch (e) {
            vscode.window.showErrorMessage(`写入 ${STATE_FILENAME} 失败: ${e}`);
            throw e;
        }
    }

    /**
     * 创建默认状态（使用共享的 createDefaultState）
     */
    createDefaultState(contentForm: string): CheatState {
        return createDefaultState(contentForm as CheatState['content_form']);
    }

    /**
     * 检查项目是否已初始化
     */
    async isInitialized(projectRoot: string): Promise<boolean> {
        const statePath = path.join(projectRoot, STATE_FILENAME);
        return fs.existsSync(statePath);
    }

    /**
     * 更新单个字段
     */
    async updateField(
        projectRoot: string,
        field: keyof CheatState,
        value: unknown
    ): Promise<void> {
        const state = await this.readState(projectRoot);
        if (!state) {
            throw new Error('项目未初始化，请先运行初始化');
        }
        (state as Record<string, unknown>)[field] = value;
        await this.writeState(projectRoot, state);
    }

    /**
     * Buffer +1（cheat-shoot 调用）
     */
    async incrementBuffer(projectRoot: string): Promise<number> {
        const state = await this.readState(projectRoot);
        if (!state) {
            throw new Error('项目未初始化');
        }
        state.buffer = (state.buffer || 0) + 1;
        await this.writeState(projectRoot, state);
        return state.buffer;
    }

    /**
     * Buffer -1（cheat-publish 调用）
     */
    async decrementBuffer(projectRoot: string): Promise<number> {
        const state = await this.readState(projectRoot);
        if (!state) {
            throw new Error('项目未初始化');
        }
        state.buffer = Math.max(0, (state.buffer || 0) - 1);
        await this.writeState(projectRoot, state);
        return state.buffer;
    }

    /**
     * 将预测样本加入校准池
     */
    async addCalibrationSample(
        projectRoot: string,
        entry: CheatState['calibration_pool'][number]
    ): Promise<void> {
        const state = await this.readState(projectRoot);
        if (!state) { throw new Error('项目未初始化'); }
        state.calibration_pool.push(entry);
        state.calibration_samples = state.calibration_pool.length;
        await this.writeState(projectRoot, state);
    }

    /**
     * 获取当前工作区根目录
     */
    getWorkspaceRoot(): string | null {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) { return null; }
        return folders[0].uri.fsPath;
    }

    /**
     * 确保工作区存在
     */
    requireWorkspaceRoot(): string {
        const root = this.getWorkspaceRoot();
        if (!root) {
            throw new Error('请先打开一个工作区文件夹');
        }
        return root;
    }
}

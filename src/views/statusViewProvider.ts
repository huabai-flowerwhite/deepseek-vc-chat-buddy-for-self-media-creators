import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService, CheatState } from '../services/stateService';

type TreeNode = StatusItem | StatusAction;

class StatusItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly description?: string,
        public readonly icon?: vscode.ThemeIcon,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        if (description) { this.description = description; }
        if (icon) { this.iconPath = icon; }
    }
}

class StatusAction extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly commandId: string,
        public readonly icon?: vscode.ThemeIcon,
        public readonly tooltip?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: commandId,
            title: label
        };
        if (icon) { this.iconPath = icon; }
        if (tooltip) { this.tooltip = tooltip; }
    }
}

export class StatusViewProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private stateService: StateService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        if (element) { return []; }

        const root = this.stateService.getWorkspaceRoot();
        if (!root) {
            return [
                new StatusItem(
                    '未打开工作区',
                    vscode.TreeItemCollapsibleState.None,
                    '请打开一个文件夹',
                    new vscode.ThemeIcon('folder-opened')
                )
            ];
        }

        const state = await this.stateService.readState(root);
        if (!state) {
            return [
                new StatusItem(
                    '项目未初始化',
                    vscode.TreeItemCollapsibleState.None,
                    '运行初始化开始',
                    new vscode.ThemeIcon('warning')
                ),
                new StatusAction(
                    '🚀 初始化 ai-chat-buddy',
                    'ai-chat-buddy.init',
                    new vscode.ThemeIcon('play'),
                    '开始 onboarding'
                )
            ];
        }

        const items: TreeNode[] = [];

        // 项目状态
        items.push(new StatusItem(
            '项目状态',
            vscode.TreeItemCollapsibleState.Expanded,
            undefined,
            new vscode.ThemeIcon('dashboard')
        ));
        items.push(new StatusItem(
            `内容形态: ${state.content_form}`,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            new vscode.ThemeIcon('symbol-class')
        ));
        items.push(new StatusItem(
            `Rubric 版本: ${state.rubric_version}`,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            new vscode.ThemeIcon('versions')
        ));
        items.push(new StatusItem(
            `校准样本: ${state.calibration_samples}`,
            vscode.TreeItemCollapsibleState.None,
            this.getCalibrationColor(state.calibration_samples),
            new vscode.ThemeIcon('beaker')
        ));
        items.push(new StatusItem(
            `Buffer: ${state.buffer || 0}`,
            vscode.TreeItemCollapsibleState.None,
            this.getBufferColor(state.buffer || 0),
            new vscode.ThemeIcon('stack')
        ));

        // 快捷操作
        items.push(new StatusItem(
            '快捷操作',
            vscode.TreeItemCollapsibleState.Expanded,
            undefined,
            new vscode.ThemeIcon('zap')
        ));
        items.push(new StatusAction(
            '📊 查看完整状态',
            'ai-chat-buddy.status',
            new vscode.ThemeIcon('list-tree'),
            '显示详细状态看板'
        ));
        items.push(new StatusAction(
            '📝 给当前脚本打分',
            'ai-chat-buddy.quickScore',
            new vscode.ThemeIcon('edit'),
            '快速打分（不写文件）'
        ));
        items.push(new StatusAction(
            '🔮 启动盲预测',
            'ai-chat-buddy.predict',
            new vscode.ThemeIcon('graph'),
            '对当前脚本写预测日志'
        ));
        items.push(new StatusAction(
            '📋 打开工作流速查',
            'ai-chat-buddy.openWorkflow',
            new vscode.ThemeIcon('book'),
            '查看完整工作流文档'
        ));

        // 工作流
        items.push(new StatusItem(
            '工作流',
            vscode.TreeItemCollapsibleState.Expanded,
            undefined,
            new vscode.ThemeIcon('sync')
        ));
        const workflowActions = [
            ['💡 选题对话', 'ai-chat-buddy.seed'],
            ['🔥 抓取热点', 'ai-chat-buddy.trends'],
            ['🎯 推荐选题', 'ai-chat-buddy.recommend'],
            ['✍️ 打分脚本', 'ai-chat-buddy.score'],
            ['🎬 登记拍摄', 'ai-chat-buddy.shoot'],
            ['📤 登记发布', 'ai-chat-buddy.publish'],
            ['📈 数据复盘', 'ai-chat-buddy.retro'],
            ['👤 受众画像', 'ai-chat-buddy.persona'],
            ['📐 升级公式', 'ai-chat-buddy.bump'],
        ];
        for (const [label, cmd] of workflowActions) {
            items.push(new StatusAction(label, cmd));
        }

        // 待复盘列表
        const pendingRetros = await this.getPendingRetros(root, state);
        if (pendingRetros.length > 0) {
            items.push(new StatusItem(
                '待复盘',
                vscode.TreeItemCollapsibleState.Expanded,
                `${pendingRetros.length} 篇`,
                new vscode.ThemeIcon('clock')
            ));
            for (const retro of pendingRetros.slice(0, 5)) {
                items.push(new StatusItem(
                    retro.name,
                    vscode.TreeItemCollapsibleState.None,
                    retro.daysAgo,
                    new vscode.ThemeIcon('file')
                ));
            }
        }

        return items;
    }

    private getCalibrationColor(samples: number): string {
        if (samples >= 25) { return '🟢 已校准'; }
        if (samples >= 10) { return '🟡 校准中'; }
        if (samples >= 5) { return '🟠 早期'; }
        return '🔴 冷启动';
    }

    private getBufferColor(buffer: number): string {
        if (buffer >= 5) { return '⚠️ 积压较多'; }
        if (buffer >= 3) { return '⚡ 建议发布'; }
        return '✅ 正常';
    }

    private async getPendingRetros(
        root: string,
        state: CheatState
    ): Promise<{ name: string; daysAgo: string }[]> {
        const videosDir = path.join(root, 'videos');
        if (!fs.existsSync(videosDir)) { return []; }

        const retros: { name: string; daysAgo: string }[] = [];
        try {
            const entries = await fs.promises.readdir(videosDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const reportPath = path.join(videosDir, entry.name, 'report.md');
                    if (!fs.existsSync(reportPath)) {
                        // 检查是否已发布但未复盘
                        const predictionFile = path.join(root, 'predictions', `${entry.name}.md`);
                        let daysAgo = '?';
                        if (fs.existsSync(predictionFile)) {
                            const stat = fs.statSync(predictionFile);
                            const days = Math.floor(
                                (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24)
                            );
                            daysAgo = `${days} 天前`;
                        }
                        retros.push({ name: entry.name, daysAgo });
                    }
                }
            }
        } catch { /* ignore */ }
        return retros;
    }
}

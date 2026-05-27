import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateService } from '../services/stateService';
import { TemplateService } from '../services/templateService';
import { RubricService } from '../services/rubricService';

/**
 * /cheat-init — 首次 onboarding
 * 
 * 对应 cheat-on-content: skills/cheat-init/SKILL.md
 * 
 * Overview:
 * ```
 * [Phase 0: 检测当前状态]
 *   ↓
 * [Phase 1: 首屏文案 — 适用性 + 期望管理]
 *   ↓
 * [Phase 2: 选择内容形态]
 *   ↓
 * [Phase 3: 创建脚手架]
 * ```
 */

// ─── Constants ───────────────────────────────────────────
const CONTENT_FORM_OPTIONS = [
    { label: '观点视频', description: '2-5分钟，观点/概念讲解', value: 'opinion-video' },
    { label: '长文/公众号', description: '深度文章、Newsletter', value: 'long-essay' },
    { label: '短文/图文', description: '小红书、朋友圈式短内容', value: 'short-text' },
    { label: '播客', description: '音频为主的内容', value: 'podcast' },
] as const;

export async function cheatInit(
    stateService: StateService,
    templateService: TemplateService,
    rubricService: RubricService
): Promise<void> {
    const root = stateService.requireWorkspaceRoot();

    // 检查是否已初始化
    const isInit = await stateService.isInitialized(root);
    if (isInit) {
        const overwrite = await vscode.window.showWarningMessage(
            '项目似乎已初始化（.cheat-state.json 存在）。',
            '重新初始化',
            '取消'
        );
        if (overwrite !== '重新初始化') { return; }
    }

    // 选择内容形态
    const contentForm = await vscode.window.showQuickPick(
        [
            { label: '观点视频', description: '2-5分钟，观点/概念讲解', value: 'opinion-video' },
            { label: '长文/公众号', description: '深度文章、Newsletter', value: 'long-essay' },
            { label: '短文/图文', description: '小红书、朋友圈式短内容', value: 'short-text' },
            { label: '播客', description: '音频为主的内容', value: 'podcast' }
        ],
        {
            placeHolder: '你的主要内容形态是什么？',
            title: 'AI chat buddy for self-media creators — 初始化'
        }
    );
    if (!contentForm) { return; }

    // 确认
    const confirm = await vscode.window.showInformationMessage(
        `即将创建 ai-chat-buddy 项目结构（内容形态: ${contentForm.label}）。\n\n将创建：rubric_notes.md, script_patterns.md, WORKFLOW.md, STATUS.md 等核心文件，以及 scripts/, predictions/, videos/, samples/ 目录。`,
        { modal: true },
        '确认创建'
    );
    if (confirm !== '确认创建') { return; }

    // 创建脚手架
    const created = await templateService.scaffoldProject(root, contentForm.value);

    // 创建 state file
    const state = stateService.createDefaultState(contentForm.value);
    await stateService.writeState(root, state);

    // 输出结果
    const message = created.length > 0
        ? `✅ 初始化完成！已创建 ${created.length} 个文件/目录：\n${created.map(f => `  • ${f}`).join('\n')}\n\n下一步建议：\n1. 查看 WORKFLOW.md 了解完整工作流\n2. （强烈建议）运行"对标账号学习"导入 5-10 条对标样本\n3. 运行"选题对话"开始你的第一条内容`
        : '✅ 项目已初始化（所有文件已存在，未覆盖）';

    vscode.window.showInformationMessage(message, { modal: true }, '打开 WORKFLOW').then(choice => {
        if (choice === '打开 WORKFLOW') {
            const workflowPath = path.join(root, 'WORKFLOW.md');
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(workflowPath));
        }
    });
}

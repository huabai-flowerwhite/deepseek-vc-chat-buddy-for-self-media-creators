import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 模板服务 — 负责项目脚手架文件的创建
 */
export class TemplateService {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * 创建项目脚手架
     */
    async scaffoldProject(
        projectRoot: string,
        contentForm: string
    ): Promise<string[]> {
        const created: string[] = [];

        // 创建核心文件
        const files: Record<string, string> = {
            'rubric_notes.md': this.getRubricNotesTemplate(contentForm),
            'rubric-memo.md': this.getRubricMemoTemplate(),
            'script_patterns.md': this.getScriptPatternsTemplate(),
            'WORKFLOW.md': this.getWorkflowTemplate(),
            'STATUS.md': this.getStatusTemplate(),
            'candidates.md': this.getCandidatesTemplate(),
            'audience.md': this.getAudienceTemplate(),
            'benchmark.md': this.getBenchmarkTemplate(),
        };

        for (const [filename, content] of Object.entries(files)) {
            const filePath = path.join(projectRoot, filename);
            if (!fs.existsSync(filePath)) {
                await fs.promises.writeFile(filePath, content, 'utf-8');
                created.push(filename);
            }
        }

        // 创建目录
        const dirs = ['scripts', 'predictions', 'videos', 'samples', '.cheat-cache'];
        for (const dir of dirs) {
            const dirPath = path.join(projectRoot, dir);
            if (!fs.existsSync(dirPath)) {
                await fs.promises.mkdir(dirPath, { recursive: true });
                // 添加 .gitkeep
                await fs.promises.writeFile(
                    path.join(dirPath, '.gitkeep'),
                    '',
                    'utf-8'
                );
                created.push(`${dir}/`);
            }
        }

        // 创建 .cheat-cache 目录下的文件
        const cacheDir = path.join(projectRoot, '.cheat-cache');
        const cacheFiles = ['usage.jsonl', 'trends-history.jsonl'];
        for (const f of cacheFiles) {
            const fp = path.join(cacheDir, f);
            if (!fs.existsSync(fp)) {
                await fs.promises.writeFile(fp, '', 'utf-8');
            }
        }

        // 创建 .vscode/settings.json 如果不冲突
        const vscodeDir = path.join(projectRoot, '.vscode');
        if (!fs.existsSync(vscodeDir)) {
            await fs.promises.mkdir(vscodeDir, { recursive: true });
        }
        const settingsPath = path.join(vscodeDir, 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            const settings = {
                'ai-chat-buddy.dataLayer': 'markdown',
                'ai-chat-buddy.defaultContentForm': contentForm,
                'ai-chat-buddy.enabledTrendSources': ['manual-paste'],
                'ai-chat-buddy.blindScoring': true,
                'ai-chat-buddy.retroWindowDays': 3
            };
            await fs.promises.writeFile(
                settingsPath,
                JSON.stringify(settings, null, 2),
                'utf-8'
            );
        }

        return created;
    }

    private getRubricNotesTemplate(contentForm: string): string {
        if (contentForm === 'opinion-video') {
            return `# 评分校准笔记

> **本文件是 ai-chat-buddy 评分规则进化的载体**。
> 每次复盘实际播放数据 vs 预测分数后，把判断依据和规律显式写在这里。
>
> **核心原则**：规律必须可追溯到具体样本。

---
## 当前公式 (v0 — cold-start 占位)

**内容形态**: 观点视频 (opinion-video)
**评分维度**: 7 维（等权）
**公式**: composite = (ER + HP + QL + NA + AB + SR + SAT) / 7

### 维度定义

| 维度 | 简称 | 权重 | 定义 |
|------|------|------|------|
| Emotional Resonance | ER | 1/7 | 情感共鸣力——观众"被击中"的程度 |
| Hook Power | HP | 1/7 | 开头抓人力——前 3 秒是否让人停下滑动 |
| Quality of Logic | QL | 1/7 | 逻辑质量——论证是否自洽、有说服力 |
| Novelty Angle | NA | 1/7 | 新颖度——角度是否独特、反常识 |
| Audience Breadth | AB | 1/7 | 受众广度——多少人会关心这个话题 |
| Shareability | SR | 1/7 | 转发意愿——观众会不会转发/艾特别人 |
| Satisfaction | SAT | 1/7 | 完播满足感——看完有没有"值了"的感觉 |

### 观察（无——cold start）

> ⚠️ 这是 v0 等权占位 rubric。前 5 篇预测精度约 ±50%。
> 跑完 5 篇闭环后可以提议第一次升级。
`;
        }
        return `# 评分校准笔记\n\n> 内容形态: ${contentForm}\n> 版本: v0 (cold-start)\n\n待通过复盘积累观察...\n`;
    }

    private getScriptPatternsTemplate(): string {
        const codeBlock = '\`\`\`';
        return '# 写作 Pattern 沉淀\n' +
'\n' +
'> **本文件教 DeepSeek 怎么写**（rubric_notes.md 教怎么打分）。\n' +
'> 从两个来源累积 pattern：作弊种子写稿后觉得"这个结构好用"；复盘后发现"这种写法跟高分强相关"。\n' +
'\n' +
'---\n' +
'## 暂无沉淀的 pattern\n' +
'\n' +
'跑完 `/cheat-learn-from`（对标账号学习）和几次 `/cheat-retro` 后，\n' +
'这里会自动积累可复用的写作结构。\n' +
'\n' +
'### Pattern 格式\n' +
codeBlock + '\n' +
'### [Pattern 名称]\n' +
'- **来源**: [样本 ID / 对标账号]\n' +
'- **适用场景**: [什么话题适合用这个结构]\n' +
'- **结构**: [具体怎么写]\n' +
'- **效果证据**: [在哪篇验证过]\n' +
codeBlock + '\n';
    }

    private getWorkflowTemplate(): string {
        return `# 工作流速查（ai-chat-buddy）


> 本文件给"忘了下次该说什么"的时候用。

---
## 5 核心工作流：
下载后命令Copilot编译。
cheatInit:初始化。选择内容形态，创建核心 md、ts文件 + 目录。
cheatLearnFrom:对标学习。引导 Copilot 对话分析对标账号 pattern。
cheatTrends:抓取热点。引导 Copilot 抓取热点并写入 candidates.md。
cheatRecommend:候选话题推荐排序。
cheatSeed:选题讨论。引导 Copilot Chat 进行 brainstorm,并将稿件写入script.md。
cheatScore:给脚本打分。7 维度滑块打分流量预测,Copilot Chat独立分析并比较。
cheatPredict:盲预测。打分流量预测,Copilot Chat分析比较,生成预测文件到 predictions/,支持重预测(diff≥30%)。
cheatShoot:登记已拍摄。复制脚本到 videos/,询问一致性,Buffer+1。
cheatPublish:登记已发布。输入发布链接+平台,匹配 prediction 文件,Buffer-1。
cheatRetro:数据回收+复盘。输入实际播放量/点赞/评论/分享，生成 report.md,更新 prediction 复盘段。
cheatpersona:受众画像。基于评论和数据派生。
cheatBump:升级评分公式。完整 Rubric 升级 / 仅重校 Bucket。

## 6 详细操作：
🔧 第一步：启动扩展
命令Copilot根据网址下载项目、下载后命令Copilot编译。
在当前 VS Code 窗口按 F5 运行调试，会弹出一个新的 VS Code 窗口。
📋 第二步：完整测试流程（按顺序跑）
在扩展开发窗口中，打开一个空文件夹作为测试项目，然后按以下顺序操作：
🏗️ 阶段 1:初始化
#	|命令|	|操作|	|验证|
1	|初始化|	|Ctrl+Shift+P → 初始化 ai-chat-buddy → 选「xx」→ 确认|	|项目根生成 rubric_notes.md, WORKFLOW.md, scripts/, predictions/ 等|
📚 阶段 2:对标学习
#	|命令|	|操作|	|验证|
2	|对标账号学习|	|Ctrl+Shift+P → 对标账号学习 → 输入对标平台与账号名|	|打开 Copilot Chat + benchmark.md|
💡 阶段 3:选题
#	|命令|	|操作|	|验证|
3	|抓取热点|	|Ctrl+Shift+P → 抓取热点|	|Copilot 写入 candidates.md|
4	|推荐选题|	|Ctrl+Shift+P → 推荐选题|	|Copilot 排序候选池|
5	|选题对话|	|Ctrl+Shift+P → 选题对话 → 输入话题或留空|	|Copilot 开始 brainstorm|
📝 阶段 4:打分预测
#	|命令|	|操作|	|验证|
6	|单稿打分|	|在 scripts/ 目录新建 test.md,写一段观点脚本并保存 → 右键文件 → 给脚本打分|	|打开打分面板|
7	|启动盲预测|	|在 scripts/test.md 上右键 → 启动盲预测 → 输入标题 → 逐维打分 → 保存|	|predictions/ 生成预测日志|
🎬 阶段 5:拍摄发布
#	|命令|	|操作|	|验证|
8	|登记已拍摄|	|打开 scripts/test.md → Ctrl+Shift+P → 登记已拍摄 → 选「完全一致」|	|videos/ 生成目录 + Buffer+1|
9	|登记已发布|	|Ctrl+Shift+P → 登记已发布 → 输入链接 → 选平台|	|Buffer-1,预测文件更新|
📊 阶段 6:复盘升级
#	|命令|	|操作|	|验证|
10	|数据复盘|	|Ctrl+Shift+P → 数据复盘 → 选视频 → 输入播放/点赞/评论|	|videos/<id>/report.md 生成 + 校准池+1|
11	|受众画像|	|Ctrl+Shift+P → 受众画像|	|Copilot 分析评论聚类|
⚙️ 阶段 7:系统维护
#	|命令|	|操作|	|验证|
13	|状态看板|	|点击活动栏 📊 图标 / Ctrl+Shift+P → 查看状态看板|	|STATUS.md 刷新|
14	|升级评分公式|	|Ctrl+Shift+P → 升级评分公式 → 选模式|	|Copilot 分析校准池|
15	|打开工作流|	|Ctrl+Shift+P → 打开工作流速查|	|打开 WORKFLOW.md|
`;
    }

    private getStatusTemplate(): string {
        const now = new Date().toISOString();
        return `# 状态

> 本文件由 cheat-status 维护——每次跑 status 都会更新。

---

**最近更新**: ${now}

## 当前模式

- **内容形态**: 待初始化
- **Rubric 版本**: -
- **校准样本**: 0
- **Buffer**: 0

## 待复盘

（无——还没有发布过内容）

## 候选池 top 3

（无——还没有抓过热点或建立候选池）

## 待办

- [ ] 运行 cheat-init 初始化项目
- [ ] 可选：运行 cheat-learn-from 导入对标账号
`;
    }

    private getCandidatesTemplate(): string {
        return `# 候选选题池

> cheat-trends 写入热点抓取结果，cheat-recommend 读取排序。
> 也可手动编辑——把候选标题贴到 H3 entry 即可。

---
## 使用说明

### 字段含义速查
- **id**: 12 位 hash，用于跨文件去重
- **source**: 来源标识
- **snapshot_at**: 抓取时间（ISO 8601）
- **tier**: tier1 / tier2 / tier3 / skip / risky / done
- **read_status**: unread / skimmed / deep_read / done
- **composite**: 当前 rubric 下的综合分（粗打分）

---
## 候选列表

（暂无——运行 /cheat-trends 抓取热点或手动添加）
`;
    }

    private getAudienceTemplate(): string {
        return `# 受众画像

**Persona 版本**: v0
**Last rebuilt**: 未生成
**数据基础**: 0 篇复盘 / 0 条评论
**Confidence**: 🔴 无数据（占位骨架）

---
## 画像

（暂无——通过评论数据和复盘派生，运行 /cheat-persona）
`;
    }

    private getBenchmarkTemplate(): string {
        return `# 对标账号

> 通过 cheat-learn-from 命令导入和分析。

---
## 对标账号列表

（暂无——运行 "对标账号学习" 开始导入）
`;
    }

    /**
     * Rubric Memo — Bump 升级档案
     * 
     * ⚠️ 本文件是 Channel A 内部参考。Channel B（cheat-score-blind sub-agent）永远不读本文件。
     * 
     * 这里累积每次 rubric bump 的完整 Memo：
     * 触发观察、证据数据表（含真实样本名 + 实绩）、诊断、跨模型审核结论、已知局限。
     */
    private getRubricMemoTemplate(): string {
        return `# Rubric Memo — Bump 升级档案

> ⚠️ **本文件是 Channel A 内部参考。Channel B（cheat-score-blind sub-agent）永远不读本文件**
> ——blind sub-agent 的 hard refusal list 显式包含本文件路径。
>
> 这里累积每次 rubric bump 的完整 Memo：
> 触发观察、证据数据表（含真实样本名 + 实绩）、诊断、跨模型审核结论、已知局限。

---

## 这文件是干嘛的

cheat-bump Phase 5 落地时把升级 Memo 写**这里**，**不写**进 \`rubric_notes.md\`。

| 文件 | 内容 | blind 白名单 |
|------|------|-------------|
| \`rubric_notes.md\` | 公式 / 维度定义（通用语言，不含视频名 / 实绩）/ Bucket 段 / 顶部 metadata | ✅ YES |
| \`rubric-memo.md\`（本文件） | 升级 Memo 全文（含真实视频名 + 真实播放数 + 派生证据） | ❌ NO（硬禁读） |

---

## 写入规则（cheat-bump Phase 5）

每次完整 bump 完成后，在文件末尾 append 一条 Memo 段（格式见下）。
不覆盖已有 Memo——累积历史。

---

## Memo 段格式

\`\`\`markdown
### [日期] v<N-1> → v<N>

**触发条件**：校准样本 N 个 / 偏差模式 XXX

**旧公式**：(ER×... + ...) / N
**新公式**：(ER×... + ...) / N

**变化**：...

**跨模型审核（channel C）**
- 审核模型：XXX
- 判定：PASS / FAIL / NEEDS_REVISION
- 理由摘录：「...」
- 关键风险：「...」

**已知局限**
（这次 bump 没解决的事；下次 bump 时仍待观察的方向）
\`\`\`

---

## 升级历史

（暂无——升级评分公式后此文件会累积 bump 记录）

`;
    }
}

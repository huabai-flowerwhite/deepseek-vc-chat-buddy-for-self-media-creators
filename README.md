<h1 align="center">
  <img src="docs/logo.svg" alt="deepseek-vc-chat-buddy-for-self-media-creators" width="720">
</h1>

<h2 align="center">自媒体创作者的 deepseek-vscode 聊天搭子</h2>

<p align="center">
这是适合多数自媒体创作者的AI搭子，基于 vs code 扩展中的 deepseek v4 for copilot chat，低成本低门槛辅助创作，让每一次内容创作从选题、质量评分、数据预测复盘的过程变为可以量化预测的实验。
</p>

<p align="center">
<a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-v1.0.0-orange" alt="Version"></a>
&nbsp;
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

---

# 🤖项目能做什么？
多数内容创作者都有创作困境：找不到选题、不能第一时间抓住热点、做不出好内容、内容不满足流量算法、缺乏复盘手段。

本项目解决这些痛点！并且每一次操作闭环，会让AI更懂你，为你专属迭代！

本项目也附带了在vs code中集成deepseek-v4-pro api的官方推荐方式，可见vc api.png图片。

本项目核心能力：AI选题 → AI评分预测 → 个性数据复盘 → 升级评分公式。

你将拥有只属于你自己的热门内容创作搭子！

---

# 🎨灵感
致敬“cheat-on-content”项目的创作者！

其项目服务于MAC、LIUNX系统的claude用户。本项目考虑多数创作者的实际需求与现状，针对Windows用户，基于 vs code 扩展中的 “deepseek v4 for copilot chat”（deepseek官方推荐扩展），低成本低门槛辅助创作。

AI会让技术平权，我想让应用平权。

——创作者

---

# ✨本项目的优势
内容创作：免去选题、写稿过程，让创作者更多时间提升内容展示能力（视频图片展示）。

低成本：在48M deepseek-v4 pro tokens的测试中，输入缓存命中率约97.5%，能够满足内容创作低成本大量制作的需求。

低门槛：仅通过vs code、deepseek-v4-pro api、deepseek v4 for copilot chat 扩展即可，Windows系统可用。

---

# 🎬核心工作流：

下载后编译运行。

cheatInit：初始化。选择内容形态，创建核心 md、ts文件 + 目录。

cheatLearnFrom：对标学习。引导 Copilot 对话分析对标账号 pattern。

cheatTrends：抓取热点。引导 Copilot 抓取热点并写入 candidates.md。

cheatRecommend：候选话题推荐排序。

cheatSeed：选题讨论。引导 Copilot Chat 进行 brainstorm，并将稿件写入script.md。

cheatScore：给脚本打分。7 维度滑块打分流量预测，Copilot Chat独立分析并比较。

cheatPredict：盲预测。打分流量预测，Copilot Chat分析比较，生成预测文件到 predictions/，支持重预测（diff≥30%）。

cheatShoot：登记已拍摄。复制脚本到 videos/，询问一致性，Buffer+1。

cheatPublish：登记已发布。输入发布链接+平台，匹配 prediction 文件，Buffer-1。

cheatRetro：数据回收+复盘。输入实际播放量/点赞/评论/分享，生成 report.md，更新 prediction 复盘段。

cheatpersona：受众画像。基于评论和数据派生。

cheatBump：升级评分公式。完整 Rubric 升级 / 仅重校 Bucket。

---

# 📦 安装

方法一：

1. 克隆项目到本地:

git clone https://github.com/huabai-flowerwhite/deepseek-vc-chat-buddy-for-self-media-creators.git

2. 进入项目目录:

cd deepseek-vc-chat-buddy-for-self-media-creators

3. 使用 VS Code 打开:

code .

4. 编译、F5 启动扩展:

弹出新窗口即安装成功！

……

方法二：

命令Copilot根据网址下载项目、下载后命令Copilot编译，F5 启动扩展。

# 🎯详细操作：

🔧 第一步：启动扩展

在当前 VS Code 窗口按 F5 运行调试，会弹出一个新的 VS Code 窗口。

……

📋 第二步：完整测试流程（按顺序跑）
在扩展开发窗口中，打开一个空文件夹作为测试项目，然后按以下顺序操作。

……

🏗️ 阶段 1：初始化

命令	操作	验证

1	  |初始化|	|Ctrl+Shift+P → 初始化 ai-chat-buddy → 选「xx」→ 确认|	|项目根生成 rubric_notes.md, WORKFLOW.md, scripts/, predictions/ 等|


📚 阶段 2：对标学习

2	  |对标账号学习|	|Ctrl+Shift+P → 对标账号学习 → 输入对标平台与账号名|	|打开 Copilot Chat + benchmark.md|


💡 阶段 3：选题

3 	|抓取热点|	|Ctrl+Shift+P → 抓取热点|	|Copilot 写入 candidates.md|

4	  |推荐选题|	|Ctrl+Shift+P → 推荐选题|	|Copilot 排序候选池|

5	  |选题对话|	|Ctrl+Shift+P → 选题对话 → 输入话题或留空|	|Copilot 开始 brainstorm|


📝 阶段 4：打分预测

6	  |单稿打分|	|在 scripts/ 目录新建 test.md,写一段观点脚本并保存 → 右键文件 → 给脚本打分|	|打开打分面板|

7	  |启动盲预测|	|在 scripts/test.md 上右键 → 启动盲预测 → 输入标题 → 逐维打分 → 保存|	|predictions/ 生成预测日志|


🎬 阶段 5：拍摄发布

8	  |登记已拍摄|	|打开 scripts/test.md → Ctrl+Shift+P → 登记已拍摄 → 选「完全一致」|	|videos/ 生成目录 + Buffer+1|

9   |登记已发布|	|Ctrl+Shift+P → 登记已发布 → 输入链接 → 选平台|	|Buffer-1,预测文件更新|

📊 阶段 6：复盘升级

10  |数据复盘|	|Ctrl+Shift+P → 数据复盘 → 选视频 → 输入播放/点赞/评论|	|videos/<id>/report.md 生成 + 校准池+1|

11	|受众画像|	|Ctrl+Shift+P → 受众画像|	|Copilot 分析评论聚类|

⚙️ 阶段 7：系统维护

12	|状态看板|	|点击活动栏 📊 图标 / Ctrl+Shift+P → 查看状态看板|	|STATUS.md 刷新|

13	|升级评分公式|	|Ctrl+Shift+P → 升级评分公式 → 选模式|	|Copilot 分析校准池|

14	|打开工作流|	|Ctrl+Shift+P → 打开工作流速查|	|打开 WORKFLOW.md|

---

## 📜 License

MIT. Commercial use, modification, closed-source integration — all fine.

---

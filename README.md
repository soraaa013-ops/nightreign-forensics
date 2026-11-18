# 遗物警察局

《艾尔登法环：黑夜君临》非官方玩家工具。目前提供遗物三词条合法性检测、精确出货概率和基础地图布局反查原型。

遗物规则包由社区公开解包快照自动生成，会检查模板隐藏槽位、词条池、权重、互斥 family 和显示顺序。当前快照标记为 `1.0.3 + DLC`，仍需用用户自己的 Windows 最新导出做最终版本复核。深夜诅咒配对尚未开放。

地图档案使用 MIT 授权项目发布的 320 个基础游戏 Pattern，仅用于验证筛选交互和算法；它不是当前 520 条基础游戏 + DLC 数据集。

## 本地运行

```bash
npm test
npm run validate:data
npm run serve
```

打开 <http://localhost:4173>。

## 数据导入

准备 `EquipParamAntique.csv`、`AttachEffectTableParam.csv`、`AttachEffectParam.csv` 以及繁中/英文 FMG XML 后运行：

```bash
node tools/import-game-data.mjs \
  --source /path/to/export \
  --output data/game-data.json \
  --commit <source-commit-or-version>
```

生成文件包含来源、Commit 和所有输入文件的 SHA-256。`tools/version-diff.mjs` 可以比较两个规则包。

详细实施边界与 Windows 侧交付格式见 [PLAN.md](PLAN.md)，第三方来源见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 部署

项目是无构建步骤的静态站，可直接部署到 GitHub Pages、Cloudflare Pages 等平台。

## 体验与中文化

遗物词条使用可浏览的词条库，支持角色、效果分类、多关键词及“回血”“回蓝”“大招”等别名。默认显示当前模板可用词条，也可显式开启模板外词条。选齐三条自动检测，支持替换、移除、移动顺序和一键纠正顺序。

地图可直接搜索敌人或据点，不知道位置也能添加线索。筛选项显示候选数量，线索数量不限，可逐条撤销，并预览候选地图。手机端默认收起可选位置条件。

`data/zh-CN.json` 是简体中文展示词库，使用“血量”“专注值”“绝招”。原始快照、标识、词条池和概率权重不变。更新数据后运行 `npm test` 与 `npm run test:chinese`；前者检查中文覆盖，后者检查繁体字与残留字母缩写。

测试范围、译名来源与复现命令见 [体验验证记录](docs/EXPERIENCE_QA.md)。

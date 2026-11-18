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

界面提供简体中文词条搜索、键盘选择、报告链接还原、复制失败的手动复制入口、加载失败重试，以及地图线索推荐和条件清空。手机端会展开已选词条全文。

`data/zh-CN.json` 是独立的中文展示词库；原始游戏快照、地图标识、词条池和概率权重不变。更新数据后运行 `npm test`，缺少译名会使覆盖检查失败。译名来源、测试范围与复现命令见 [体验验证记录](docs/EXPERIENCE_QA.md)。

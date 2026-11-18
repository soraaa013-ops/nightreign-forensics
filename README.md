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

两页都从首屏搜索开始。遗物可连续添加三条词条，保留角色、效果分类和检索条件；支持“回血”“追踪者大招”等自然写法。选齐自动检测，并保留替换、移除、调序、模板外词条和报告分享。

地图以可缩放、拖动的整张地图为入口，默认显示据点，可切换出生、敌人、监牢或全部。相邻点击区域自动合并，点击数字点展开，避免小屏点位重叠。常用建筑类型直接点选，成功后自动收起面板并保留视角；出生模式点一下即标记。支持补充详情、冲突纠错和撤销，出生与据点独立记录。五种地形使用各自底图，候选推测与用户确认分开显示，已推断出的地形会自动切换底图。文字搜索保留为折叠的辅助入口，地图详情仍可完整查看。

两页均支持撤销与当前标签页内的草稿恢复；地图筛选还可通过链接分享。桌面并排显示输入和结果，手机提供固定结果入口。浏览器禁用存储时仍能正常使用，但不保留草稿。

`data/zh-CN.json` 是简体中文展示词库，使用“血量”“专注值”“绝招”。原始快照、标识、词条池和概率权重不变。更新数据后运行 `npm test` 与 `npm run test:chinese`；前者检查中文覆盖，后者检查繁体字与残留字母缩写。

测试范围、译名来源与复现命令见 [体验验证记录](docs/EXPERIENCE_QA.md)。

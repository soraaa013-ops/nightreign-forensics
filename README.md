# 遗物警察局

《艾尔登法环：黑夜君临》非官方玩家工具。目前提供遗物三词条合法性检测、精确出货概率、本体与扩展地图布局反查，以及商人货物组合检索。

遗物规则包由社区公开解包快照自动生成，会检查模板隐藏槽位、词条池、权重、互斥 family 和显示顺序。当前快照标记为 `1.0.3 + DLC`，仍需用用户自己的 Windows 最新导出做最终版本复核。深夜诅咒配对尚未开放。

地图档案收录 520 份布局：保留原有 320 份本体档案，新增“见弃空洞者”200 份布局，其中大空洞 80 份。支持安定者们、废弃物之王与新增据点、敌人和出生点。参数来源、固定版本与限制见 THIRD_PARTY.md。

待办见 [TODO.md](TODO.md)。

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

地图直接显示独立点位，不聚合成数字。点位独立避让，细线指向真实位置；精确点中图标直接打开，密集区域的邻近点击才自动放大，可返回原视野。地图始终使用游戏图标，放大后增大点击区域；确定具体首领后在图标旁显示名字，完整内容在点击详情后显示，支持配置自动放大。可按需切换出生、据点、敌人或监牢。选择出生点后其余出生点消失；不可能的候选项隐藏；已确定点位点击查看描述，需要更改时再进入编辑。选定地点类型后直接继续选择首领，也可关闭跳过；确认首领后收起面板。支持撤销、草稿恢复和分享。

手机首屏以地图为主。筛选面板直接展示夜王、特殊地形、出生点和搜索，底部固定撤销、清空、分享与结果入口；显示配置单独切换。六种地形使用各自底图，大空洞支持地表／地下切换。遗物页原有检测、词条选择与报告分享功能保留。

扩展参数原始 CSV 保存在 `data/sources/nightreign-dlc/`，运行 `python3 tools/import-map-dlc.py` 可重建扩展档案和点位。第一夜缩圈随机，无法用布局编号推断；大空洞水晶不纳入固定布局筛选。未识别的内部组件不显示为可选内容，部分关联首领仅记录属性并明确标注种类未记录。方位点位名是说明性名称。

`data/zh-CN.json` 是简体中文展示词库，使用“血量”“专注值”“绝招”。原始快照、标识、词条池和概率权重不变。更新数据后运行 `npm test` 与 `npm run test:chinese`；前者检查中文覆盖，后者检查繁体字与残留字母缩写。

测试范围、译名来源与复现命令见 [体验验证记录](docs/EXPERIENCE_QA.md)。

缩放规则、调研取舍与验证范围见 [地图交互设计](docs/MAP_INTERACTION.md)。

底图在档案数据完成前预加载，先显示轻量总览，再整体替换为高清切片。空闲时预载其他地形总览，省流量／2G 模式不预载其他地图；缓存最近两张高清地图。运行 `python3 tools/build-map-previews.py` 重建总览，`npm run test:preload` 验证慢网、切换竞态和缓存。

## 地图资源优化

原始档案、图标和地图切片保留。更新来源数据后重新生成浏览器资源：

```bash
python3 tools/build-map-runtime.py
python3 tools/build-map-icon-webp.py
python3 tools/build-map-hd.py
```

图片生成需要 Pillow。性能对比与复测方法见 [性能记录](docs/PERFORMANCE.md)。

搜索支持中文片段及拼音首字母，如 `lsz` 搜索“老狮子”、`黑刺客` 搜索“黑刀刺客”；多个关键词以空格分隔。地图、点位详情与遗物搜索共用匹配规则。更新中文内容后，用 `pypinyin==0.55.0` 运行 `python3 tools/build-search-initials.py` 更新字典。

## 商人检索

在 `map.html` 点击“商人种子”或地图商店，选择已看到商品的商店类型，搜索名称、战技、附加效果或拼音首字母，再添加商品。货物详情可继续确认战技或效果。多条观察取交集；候选未唯一时可预览某一组合，不会把预览当作确认。支持撤销、移除、普通出击／深夜切换、本地恢复和分享。

收录 21 组可变商品，包括武器、盾牌、法杖、圣印记、香药与露滴，显示对应价格及附加效果。固定补给与护符不在目录内。商人组合独立于地图种子。切换模式保留商品与战技，移除需重新确认的效果条件。

地图大商店使用金色边框，传奇商店使用金色双边框与游戏星标图标；布局优先保留它们的位置，仍参与点位避让。点击已确定商店可直接打开对应商店的页内检索面板。持秤商人不套用大商店样式。

`data/sources/merchants/catalog.json` 保存公开商品事实快照，来源、版本与校验和见同目录 `provenance.json`。运行 `python3 tools/import-merchants.py` 重建中文浏览器数据（需要 OpenCC），再运行 `python3 tools/build-search-initials.py`。验证命令：`npm test`、`npm run test:merchant`、`npm run test:chinese`。

地图与商人共用 `map.html`，电脑侧边显示商人面板，手机从底部展开。地图线索与商人线索分别保存，分享链接包含两者；开关面板保留地图缩放和当前输入。商品界面与数据首次打开时加载，后续开关复用。旧 `merchant.html` 分享链接自动迁移到同页面板。运行 `npm run test:map-merchant` 验证状态隔离、分享恢复、懒加载、失败重试和视野保留。

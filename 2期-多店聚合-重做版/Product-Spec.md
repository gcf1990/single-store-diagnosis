# 产品需求规范：2期多店聚合销售诊断工作台与大应用嵌入兼容

> **v1.94 MG 07 小订战报独立模块（需求已确认，待开发，2026-07-27）**：承接已确认设计 `docs/superpowers/specs/2026-07-27-mg07-small-order-dashboard-design.md`（commit `bd3856f`，两轮 QA 通过），新增 `SCOPE-028 / TASK-020 / FLOW-004 / REQ-014 / AC-326～AC-352` 与 Phase 3AF～3AI。PC 顶部新增独立模块 `MG 07小订战报`，采用摘要常驻、`小订达成表现`按需展开方案；固定小订期为 `2026-07-29` 至 `2026-08-22`，不跟随销售日期、车系筛选或现有销售/过程/打铁下钻。摘要固定展示 `小订目标`、`累计小订`、`目标达成`、`时间进度`，第五动态位按层级显示 `落后大区/落后小区/落后门店/自身进度状态`。目标源来自 `/Users/chengfengguo/Downloads/100家快闪店展车试驾车信息收集0727.xlsx` 的 `经销商目标` Sheet；目标数据集已创建，名称 `MG07小订目标_20260727`，`dsId=h8ae7b66fd5d141ec95bd246`，`parentDirId=r0d6927b9b1d640d7ac3eabb`，状态 `FINISHED`，404 行 / 8 列；其中 403 行为经销商配置，另 1 行总计为空代码，运行时必须排除。运行时配置键 `mg07SmallOrderTargetDsId` 必须填真实 `dsId=h8ae7b66fd5d141ec95bd246`，源码和文档不得写假 ID。目标验收为 403 家唯一一级经销商、总目标 30001、零目标 17 家、403 个唯一代码、7 大区，并显式保留补码 `MQ856G`、`MQ877K`。目标清洗必须对接权威经销商维表 `a310ff90fddff4b6283841c6`（新双品牌经销商主数据维度表）：代码优先匹配全量 MG 权威维表，不局限“开业有效店”；当前按应用 valid primary（MG+开业+非二网+官网名称）只命中 395 家，未命中的 8 家目标合计 287 为 `MQ207J=104`、`MQ257T=45`、`MQ576H=0`、`MQ576K=78`、`MQ877K=44`、`MQ9331=0`、`SQ2547=0`、`SQ2881=16`。其中除 `MQ257T` 外 7 家在全量 MG 维表存在但状态为预留/异常/退网等非 valid primary；`MQ257T` 是 Excel 代码笔误，目标行名称 `溧阳名锐`、目标 45，必须在清洗上传时规范化为权威一级经销商代码 `MQ256T`（溧阳名锐汽车销售服务有限公司，`4苏皖区 / SQR700 / 罗恩 SMG503`，开业非二网），原 Excel 不改，清洗目标数据保留 `原一级经销商代码=MQ257T` 与 `代码修正说明=权威维表按经销商简称唯一命中`。实际源固定为销售事实源 `k4c14c31c595540a0a771f50`，过滤 `品牌名称=MG`、`汇报车系名称=MG 07`、日期字段 `日yyyy-mm-dd`，聚合 `当日首触小订数`、`当日首触留存小订数`、`当日首触小订退订数`；转大定隐藏。战报组织归属必须以权威经销商维表和现有系统组织范围为准：目标代码先映射到 canonical code，再按权威维表的大区/小区/门店代码和当前用户权限裁剪；代码 0 命中时才允许用 `经销商简称 + 区域全称 + MAC姓名` 在权威维表唯一反查 canonical code，目标表文本本身不直接成为权限字段。0 命中或多命中进入 `organization_unmapped` 并 fail-closed，目标和实际均不得进入页面、目标汇总、达成分母或下钻。QA 必须证明 404 行中总计空代码行被排除、403 家 / 30001 目标全部可映射、8 家异常状态映射可追溯、`MQ257T -> MQ256T` 唯一名称映射、角色权限未扩张。异常审计必须覆盖 `zero_target_actual`、`unconfigured_actual`、`organization_unmapped`。模块五态独立，配置缺失、无权限、字段缺失或审计失败只降级战报，不阻断销售/过程/打铁主链路。非目标：不改销售总览、过程分析、打铁指标、负向问题率、门店详情跳转、销售导出、截图协议、移动端、父应用筛选器、转大定展示、依赖或发布配置；本次仅更新文档，未改源码、未发布、未 commit/push。

> **v1.93 销售车系筛选联动多店所有未覆盖部分（需求已确认，待开发，2026-07-27）**：新增 `REQ-010 / REQ-012 / AC-309～AC-325` 与 Phase 3AE，替代旧“过程分析不联动车系、只展示边界说明”的当前合同。PC 车系多选集合必须同时联动顶部过程指标 4 卡、过程分析 9 项、过程导出、查看所有经销商过程表现、动态诊断中的过程数据，以及打铁 11 项；不得继续用固定说明冒充联动。顶部过程指标 4 卡必须使用已选车系后的销售事实 `state.data` 当前/上月同期/上周同期三阶段值，不再使用清空车系的 `processBaselineData`。过程分析 9 项中，线索到店率与试驾订单率来自已选车系销售事实，4 项 IP 邀约问题率与 3 项试驾问题率通过真实物理车系字段过滤，三阶段同构；过程导出、全部经销商过程表现和动态诊断过程数据全部继承同一选择。打铁 11 项全部联动，并修复高意向低水平 source 字段为 `周期最近意向闭环车系`，消除 source/dist 漂移和错误测试期望。2026-07-27 只读字段审计锁定：IP 历史 `n418e47dacdb94291993d3d9` 与 IP 实时 `ta1978fc86ae745009d0eff4` 使用 `周期首次意向闭环车系名称`；试驾历史 `g9da02067b8a6432486f58f9` 使用 `车系名称`；试驾实时 `ie2f283f63154402282c4968` 使用 `闭环车系`，不得混用实时表同时存在的 `车系名称`。销售闭集仍为 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07`；映射必须来源级静态、可审计，`未知车系` 只映射原值“未知”，空值不算未知，无样本显示 `--`，`其他车系` 在有精确规范值的来源精确过滤，在 raw source 没有精确值的来源只能在 MG 范围内按排除所有已映射闭集后的补集，`MG4 EV` 不得并入 `全新MG4`。字段不存在、查询失败、映射不可证、完整性不可证均 fail-closed 为数据不完整，绝不能回退全部车系。非目标：不改其他 UI、公式、目标、组织权限、日期、销售目标、排名占比、导出入口、移动端、依赖。发布目标固定多店生产 App `re37c3447cb0443a68a36a40`，单店跳转生产 URL 固定 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/`，最终 `settings.environment=production`；不得发布 `q084`、`x944` 或其他 App。本次仅更新文档，未改源码、未发布、未 commit/push。

> **v1.92 销售车系筛选真实联动打铁 11 项（需求已确认，待开发，2026-07-24）**：新增 `REQ-012 / AC-298～AC-308` 与 Phase 3AD。用户确认销售筛选器中的所有真实车系选项必须联动“打铁指标”7 项邀约 + 4 项试驾，不能继续只有销售链路联动，也不能用全部车系数据冒充筛选结果。打铁 11 项必须在当前、上月同期、上周同期三阶段均按 6 个真实来源查询：邀约提及 `q00.周期首次意向闭环车系名称`、高意向低水平 `w8.周期最近意向闭环车系`、优质试驾 `lbfb.车系`、试驾录音 `c82.车系名称`、试驾话术 `hd284.车系名称`、DCC `fa1.CRM闭环车系名称`；DCC 必须优先且只用 `CRM闭环车系名称`，`原始车系名称`不可作为可用字段。销售闭集锁定为 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07`；来源映射只能输出该闭集或 `unmapped`。`未知车系`只映射原始值“未知”；来源中无“未知”样本时返回真实空样本 `--`，不是 `数据不完整`。`其他车系`按已完成的来源级 distinct 审计固定：`q00/w8/lbfb/fa1` 已有精确原始值“其他车系”，永远精确过滤；`c82/hd284` 已确认无精确值，永远只在 MG 范围内按排除全部已映射销售闭集车系后的剩余车型补集计算；非 MG 不进入补集。严禁因当前日期、组织或查询结果是否有行而在精确值和补集之间动态切换。`全新MG4` 与 `MG4 EV` 不得默认合并，必须经映射确认后才允许进入同一筛选结果。fail-closed 只保留给字段不存在、字段不可查询、映射不可证、SQL/业务码/完整性不可证等情形。非目标：不改 11 项公式/目标/展示、销售链路既有 `汇报车系名称` 枚举与过滤、过程分析其他区域、UI、导出入口、移动端、发布配置或依赖。本次仅更新文档，未改源码、未发布、未 commit/push。

> **v1.91 PC 销售总览目标摘要左侧标题组（本地实现、Review、QA 通过并已发布测试 App，未推送 GitHub，2026-07-24）**：`REQ-013 / AC-292～AC-297` 与 Phase 3AC 已完成本地实现、独立 Review 和 QA。用户确认将 PC“销售总览”标题行中 v1.82 原本位于中间的目标摘要移动到左侧标题组，当前目标结构为左侧同一组 `销售总览 + 订单目标/订单达成/零售目标/零售达成/时间进度`，右侧维持车系筛选器；摘要必须紧跟标题、非居中，不再形成 `销售总览｜目标摘要｜车系筛选` 的三段居中布局。loading/success/error 状态下摘要或错误文案均紧接标题；hidden 状态只显示 `销售总览` 标题且不留空槽；loading skeleton 为 `172×12` 五段单行。1280/1366/1440px 浅色和深色主题下左侧组完整单行、不换行、不截断、无页面级横向滚动，车系筛选保持最右且可点击、可聚焦、可展开。门禁：定向 Node `2/2`、PC `12/12`、lint/build PASS；完整 suite 仅 `2` 个 Node + `1` 个 PC 因 `settings=test` 与历史 `production` 期望冲突失败，确认为范围外既有配置冲突。测试 App 发布已成功：App `q0844640cf6734877a3193d6`，发布源 `/tmp/retail-v191-app-test-rK5Xyi/multi-store-super-app`，命令 exit `0`、`operation=update`、`version=0.1.0`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a/`；settings 为 `environment=test`，单店 URL=`r8ce093b6d93143d8aa6852f`；zip SHA-256=`1f58981613e3ce1c346a743406179c0ba2f90fc1fd61d3cda38c6309587b504a`、`31 files`，`unzip` 与隐私扫描通过。v1.91 不改任何指标卡、数据口径、目标数据源、目标自然键、异步加载、筛选、表格目标槽、导出、移动端或发布配置；v1.82 的已发布测试 App 和 AC-243～AC-250 验收记录保留为历史事实。GitHub 生产配置提交 `6f125ce` 已形成，但 push 因 SSH publickey 被拒，未推送 GitHub。

> **v1.90 q084 生产配置已发布（production，2026-07-24）**：用户已确认既有多店 App `q0844640cf6734877a3193d6` 改按生产配置发布，当前运行环境从 `test` 调整为 `production`，门店详情跳转从测试单店 `r8ce093b6d93143d8aa6852f` 切换到生产单店 `aca59d2e2e60f4be4b8b93ac`。历史测试 App 发布记录保留为历史事实，不改写成生产发布；本次未更新旧多店 App `x944c089c3c4249ea925fde6`、未创建新 App、未 commit/push、按用户要求未执行发布后独立 QA。干净 staging `/tmp/q084-prod-staging-KHOClv/multi-store-super-app` 已完成 source-only 同步与门禁：source manifest 67 files，manifest SHA-256=`98e6f480903c2d80534fe004230f08c3a85ebdf35c314c9a6bb76f33fb9f3202`；`npm ci --ignore-scripts` 31 packages / 0 vulnerabilities，`npm test` 156/156，lint 45 files，build PASS（既有 classic script warning），PC Playwright 105/105，critical audit 0，dist 31 files / 621880 bytes，隐私扫描 0，29 个复制型运行时文件 source/dist 一致，dist `settings.json=production` 且门店详情构建产物指向 `aca...`，Material `expand_more` path 存在且未命中 `⌄/⌃`。Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/0`。北京时间 `2026-07-24 18:02 CST` 从 staging 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path . --raw`，exit `0`，回执 `operation=update`、`appId=q0844640cf6734877a3193d6`、`version=0.1.0`、artifact=`/private/tmp/q084-prod-staging-KHOClv/multi-store-super-app/dist.0.1.0.zip`，标准输出未返回 `fileKey`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。最终 zip SHA-256=`5c91405087924da6a482163307405eb33ce0c8e9744fa3b4369ca68155f4204a`、`147855` bytes，`unzip -t` PASS，解包 `31 files / 621880 bytes`；zip 内 `settings.json=production` 且 production URL=`aca...`，`app.js`、`visual-sync.css`、`settings.json`、`runtime-config.js` source/dist/zip 三方 hash 一致，zip 解包隐私扫描 0。匿名 HEAD=`401`，匿名 GET=`302 -> 200` 平台壳，仅记录认证边界；未做登录态线上 UI 或真实业务数据验收。

> **v1.88 PC 订单目标切换为打铁最终目标输出（需求已确认，开发中/待复审，2026-07-24）**：`REQ-011 / AC-283～AC-290` 与 Phase 3AB 已新增为未完成合同。PC 订单目标必须从 `r05b1e3995b0b4480991a4b8` 的 `总订单目标` 拆出，改读打铁 ETL `va7f9d6b8616a421c852b04c` 最终输出 `u32cb7e789f7443ff84160b4` / `打铁运营机制看板目标`；零售目标继续读取 `r05b1e3995b0b4480991a4b8`，零售链路、字段和口径不改。`h9828e20e9026475091ae6ca` / `打铁-目标上传` 只是上游输入，不得作为 App 最终订单目标源。`u32` 订单字段为 `日期、品牌、大区、小区、经销商、车系、订单目标、大区代码、小区代码、经销商代码`；订单目标以 `u32` 输出行为唯一事实源按行 SUM `订单目标`，`日期/品牌/车系/订单目标` 为必需字段，组织代码可空，优先代码定位，代码为空时按 `u32` 大区/小区/经销商名称归属汇总，不因 `invalidKey` 或 `validDealerMap` 排除。`2026-07 / MG / 全部车系` 对账必须为 `1576` 行、7 区 `1995/5597/1950/2850/2615/5179/2638`、合计 `22824`；其中 `12` 行大区/小区/经销商代码为空但组织名称存在，订单目标 `115`，必须计入全国和对应大区守恒；`h982` 直汇总 `22614` 不得作为对账值。`u32-h982=210` 是现有打铁看板口径的一部分，来自上海安吉 `+138`、荆州有为 `+72`，其中荆州有为同一 `dealerCode+车系` 两行必须累加；本次不修打铁 ETL、不在 App 另行去重、不别名补码、不硬编码补差。非目标：不改订单目标实际 SQL、零售目标实际 SQL、零售目标源、销售/过程指标、UI、导出字段集合、筛选和发布配置；只更新目标数据源拆分、订单组织守恒与失败隔离。订单实际达成分子仍按现有有效经销商代码，无法映射到实际分子的订单目标行分子为 `0` 并计审计，不得伪造达成。订单源失败仅订单目标不可用，零售仍可展示；反之亦然。

> **v1.87 PC 过程表现 CSV 三列数值化导出（已完成本地实现、Code Review 和独立 QA 门禁，未发布，2026-07-24）**：`REQ-002 / AC-282` 与 Phase 3AA 已在 `multi-store-super-app/app.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js` 实现，`npm run build` 生成 `dist/app.js`。现有 `PROCESS_TABLE_METRIC_LABELS` 9 个过程指标不再拼成“当前值 / 月环比 / 周环比”文本，每项固定拆为相邻三列：`<指标>(%)`、`<指标>月环比(百分点)`、`<指标>周环比(百分点)`；数据单元格只输出与页面百分比同一数值尺度的可统计数值，例如 `10.3`、`-4.5`、`0.1`，不可比、加载失败、数据不完整或无值输出空单元格，合法 0 保留。门禁通过：定向 `2/2`、Node `147/147`、PC `101/101`、lint Syntax check `45 files`、build PASS、audit `0`；source/dist `app.js` `cmp=0`，SHA-256 均为 `be44429dc33c3f63f7d8a0cf540867cf3135a4b9097690d9a1be4f679dff3665`。Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/1`，唯一 P2 为既有超长文件债、不阻断；独立 QA 首次复核唯一 P2 为文档状态未回写，待本次回写后复核，不提前标记最终 QA PASS。组织首列、车系边界说明行、导出入口/范围、CSV 格式、查询、页面 UI、移动端和发布配置不变。未发布测试 App或生产，未 commit、push，未做登录态线上验收。

> **v1.86 DCC 打铁四项门店范围合同（已发布测试 App，2026-07-24）**：打铁 DCC 来源 4 项（首跟通话60s占比、30分钟跟进率、24小时跟进率、2天3呼率）已本地实现：日期严格使用用户筛选的 `startDate~endDate` 闭区间；DCC 门店范围为官方打铁看板 8 条业务过滤后的全部 DCC 门店，不与 Super App 有效经销商维表 `validDealers` 求交；DCC 聚合按 DCC 事实自身大区/小区/经销商代码名称归属；DCC 与非 DCC 门店骨架取安全并集，DCC-only 门店的非 DCC 指标显示 `--`、DCC 指标可显示；父级按各来源自身分子分母重聚合，不平均门店率。已修复名称 fallback、比较期缺行、DCC 名称、`fieldGapReason` 当前/月/周/CSV 证据链；缓存 query 升级为 `20260724-dcc-scope2`。修改源码：`iron-metrics-api.js`、`iron-metrics-model.js`、`iron-metrics-view.js`、`app.js`、`index.html`；测试：`iron-metrics-query.test.mjs`、`iron-metrics-contract.test.mjs`、`iron-metrics-app-integration.spec.js`，既有 drill/export 测试仅作回归。门禁：专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`；Code Review 首轮 `0/4/1`，修复后 Stage 1/2 PASS，最终 `0/0/2`（P2 仅大文件拆分、浏览器集成偏 API 直调）；独立 QA PASS `0/0/0`。AC-272 真实证据：前置认证态直接 SQL 聚合 7 区与官方截图逐行一致且误差 `<=0.05pp`：南 `2021/2198`、华中 `5301/5750`、西 `1651/1785`、苏皖 `2688/2973`、北 `2812/3132`、东南 `4223/4638`、中南 `2275/2404`。当前刷新边界：后续 `guancli auth status` 60s 无输出，direct SQL 60s/90s `ETIMEDOUT` 且无 stdout/stderr；该刷新失败不否定前置证据。北京时间 `2026-07-24 12:54:09 CST` 已发布测试 App `q0844640cf6734877a3193d6`：`operation=update`、`version=0.1.0`、标准回执未返回 `fileKey`、URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；发布包 `dist.0.1.0.zip` SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes，`unzip -t` PASS；`dist` 为 `31 files / 600836 bytes`。发布门禁：Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`、隐私扫描 `0`、source/dist `29` 个复制型运行时文件一致。匿名 HTTP `401` 仅证明认证边界；未做登录态线上 UI 验收，未发布生产、未 commit/push。

> **v1.82～v1.85 共享隔离组合包已发布测试 App，发布后独立 QA PASS（2026-07-24）**：北京时间 `2026-07-24 12:03:44 +0800`，从稳定隔离目录 `/tmp/multistore-release-20260724-RzqeFk/multi-store-super-app` 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，回执 exit `0`、`operation=update`、`version=0.1.0`，标准回执未返回 `fileKey`；测试 App URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。发布源是 v1.82 QA 冻结副本叠加提交 `ab55c19` 的 v1.85 三文件，包含 v1.82 / Phase 3V、v1.83 / Phase 3W、v1.84 / Phase 3X、v1.85 / Phase 3Y，明确排除 v1.86 / Phase 3Z，不等同当前共享工作树。产物 `dist.0.1.0.zip` SHA-256=`cd3e69e3f2f8755c865142026b40bee52f6ea5f229701c060a1b6bfa92c77360`、`141400` bytes、`31 files / 590940 bytes`，`zip -T` 通过；`npm ci` 31 packages / 0 vulnerabilities、Node `137/137`、lint `45 files`、build exit `0`、audit `0`、完整 PC `99/99`、隐私扫描 `0`。source/dist/zip 三方关键文件一致：`app.js` SHA-256=`3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17`，`visual-sync.css` 前缀=`53109529...`，`organization-view.js` SHA-256=`4980a43ba0309680e40bb2788308e5025acef659dcea3e1d4490f7ac89bd6b9c`。发布后独立 QA PASS，P0/P1/P2=`0/0/1`；唯一 P2 是 Vite 正常重写 `dist/index.html` CSS bundle，导致 source `index.html` 与 dist `index.html` 哈希不同，不影响业务功能或关键文件同源，不建议回滚。匿名 HEAD=`401`、GET=`302` 跳转至平台壳，只证明认证边界；未完成登录态业务 UI/真实数据终验。未发布生产，未 commit、未 push。

> **v1.85 PC 订单/零售稳定唯一排名（已随共享隔离组合包发布测试 App，发布后独立 QA PASS，2026-07-24）**：承接已确认设计 `docs/superpowers/specs/2026-07-24-unique-ranking-tiebreak-design.md`，新增 `REQ-002 / AC-259～AC-271` 与 Phase 3Y。PC 销售概览中的订单排名、零售排名在大区、小区、经销商三级统一从竞争排名改为稳定唯一排名：主指标降序，同值按组织代码升序拆分，连续输出 `1/n ... n/n`，末位必须可落到 `n/n`，不展示或导出并列名次。比较集合、分母、占比、全国完整性门禁、车系/权限/组织/日期筛选、动态诊断、目标、过程、打铁、移动端和发布配置不变。已以原子提交 `ab55c19` 完成本地实现（仅 3 文件），门禁通过：Node 定向 `23/23`、`npm test` `141/141`、lint `45 files`、build exit `0`、audit `0`、完整 PC `99/99`、最终 QA 收尾 `23/23` 和新增 53 行 PC `1/1`；独立 Review 最终 P0/P1/P2=`0/0/1`（P2 为既有超长文件债，不阻断），最终 QA PASS P0/P1/P2=`0/0/0`，source/dist `organization-view` SHA-256 均为 `4980a43ba0309680e40bb2788308e5025acef659dcea3e1d4490f7ac89bd6b9c`。最新测试发布证据与边界见上方共享组合包记录；未发布生产、未 push，未做登录态业务 UI 终验。

> **v1.84 PC 销售表现排名 CSV Excel 文本保护（已发布测试 App，发布后独立 QA PASS，2026-07-24）**：`REQ-013 / AC-258` 与 Phase 3X 已完成，只修 PC 销售表现导出 CSV 中 `订单排名`、`零售排名` 被 Excel 直接打开时误识别为日期的问题。两列保持可见 `x/y` 文本，CSV 解析语义仍可还原 `x/y`；不改排名计算、其他列、导出范围、文件类型/依赖、公式注入防护、页面 UI、数据查询、移动端或发布配置。发布前 Code Review Stage 1/2 PASS、P0/P1/P2=`0/0/0`，独立 QA PASS、P0/P1/P2=`0/0/0`；门禁为 AC-258 定向 `1/1`、AC-258 + 公式注入/RFC4180 `2/2`、`npm test` `134/134`、lint Syntax check `45 files`、完整 PC `98/98`、build PASS、audit `0`。从发布源 `/private/tmp/ac258-build-kTHdjn` 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，最终成功回执为 exit `0`、`operation=update`、`appId=q0844640cf6734877a3193d6`、`version=0.1.0`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；标准回执未返回 `fileKey`。最终 zip SHA-256=`b58a77a0da195968c801d96ee4a057eed6865f62a437a845f73aafe50b113706`，`141411` bytes、`31 files / 591132` 解包字节，`unzip -t` 通过；zip 内 `app.js` SHA-256=`3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17` 且包含 `excelTextRank`，zip 内 `organization-view.js` SHA-256=`36257c5f1ed3613b41260c34092a84b642c4ecd462464c7cac3a19d1ad9d5ee9`，保留 `previousValue/previousRank` 的 v1.84 竞争排名，明确未带入 v1.85。`settings=test`，测试单店为 `r8ce...`、生产回退为 `aca...`，隐私扫描 `0`。发布后独立 QA PASS，P0/P1/P2=`0/0/2`，两个 P2 仅要求文档同步/边界澄清并随本次同步关闭。匿名 HEAD 关键资源为 `401`、GET 为 `302` 跳转，追随后为 `200 text/html`，仅证明登录保护；未做登录态 UI 或线上资源哈希验收。无用户截图对应 Windows Excel 实机，验收覆盖代码机制、实际 CSV 字节/解析与自动化，不冒充 Windows Excel 直开实机验收。当前工作区源码已进入后续并行版本，不等同发布源；发布同源只限该临时快照的 source/dist/zip。未发布生产，未 commit、push。

> **v1.83 PC 过程标签两波加载与渲染预算修复（已随共享隔离组合包发布测试 App，发布后独立 QA PASS，2026-07-24）**：本次锁定 `REQ-013 / AC-251～AC-257` 与 Phase 3W，只修 `loadNegativeProcess` 的加载编排和行为测试。第一波仅并发加载 current 的 ip/drive，结算后一次性合并成功/错误、重建工作台与打铁行集各 1 次，`processStage=current`，只刷新过程分析表 1 次，不刷新漏斗、不刷新动态诊断；token 有效后第二波并发加载 previous/week × ip/drive 共 4 个高层任务，全部结算后原子合并成功/错误、重建工作台与打铁行集各 1 次，`processLoading=false`、`processStage=week`、`processError` 更新，只刷新过程分析表 1 次、动态诊断 1 次，不刷新漏斗。旧筛选 token 失效后不得启动第二波或回写任何状态。实际同步了 `validation/pc-role-drilldown.spec.js` 中旧三波回归用例，将其适配为 current 2 请求 + comparison 4 请求的显式断言，并保留 A→B token 失效导航切换场景。保留 kind × stage 独立错误、evidence、5000 fail-closed、SQL/fallback、`0.0%/--/数据不完整` 语义；不改 data-api、metrics、公式、日期范围、车系、组织权限、顶部四项、打铁、导出、移动端、依赖、发布配置。门禁通过：定向 `node --test validation/process-tags-kind-state.test.mjs` 8/8、`npm test` 134/134、`npm run lint` Syntax check 45 files、`npm run build` PASS、`npm run test:pc` 95/95、`npm audit --omit=dev --audit-level=critical` 0 漏洞；QA 快照时 `app.js` 与 `dist/app.js` 整文件 SHA-256 一致，随后并行 v1.82 销售目标摘要 DOM 修改导致当前整文件不同，但 `loadNegativeProcess` 至 `loadIronMetrics` 修复切片 source/dist 仍逐字一致（SHA-256=`1330d39d6e952faa520ddb758656d668bf66a24e1c7713980624a7655123f123`，cmp=0）。最终独立 QA PASS，P0/P1/P2=`0/0/0`；并行变化后当前源码重新复跑定向 Node 8/8、相关 Playwright 3/3 通过；QA 独立复跑记录保留相关 Playwright 3/3 与 4/4。两个非阻断 LOW（生产测试全局开关硬化债、比较期 pending 暂显示 `--`）作为后续项，不扩展本次修复。最新测试发布证据与边界见上方共享组合包记录；未发布生产、未 commit、未 push，未做登录态业务 UI 或观远真实环境验收。

> **v1.82 PC 目标摘要迁入销售总览标题行（已随共享隔离组合包发布测试 App，发布后独立 QA PASS，2026-07-24）**：`REQ-013 / AC-243～AC-250` 与 Phase 3V 已完成实现，目标摘要已迁入“销售总览”标题行中间，形成固定三段 `销售总览｜目标摘要｜车系筛选`；五项按 `订单目标 → 订单达成 → 零售目标 → 零售达成 → 时间进度` 纯文字行内展示，目标蓝、达成绿、时间灰蓝。Phase 3V 可交付结论以隔离 Review/QA 为主：Code Review PASS，P0/P1/P2=`0/0/0`，隔离 Node `134/134`、PC `97/97`、lint/build/audit 通过。2026-07-24 最终 QA 冻结快照（包含当时并行 `excelTextRank` / `AC-258`，尚未包含后续 Phase 3Y）通过定向四态 PC `6/6`、Node `137/137`、PC `98/98`、lint Syntax check `45 files`、build exit `0`、audit `0`；该快照同时验证 24 张 loading/success/hidden/error × 1280/1366/1440 × light/dark 截图及 source/dist 的 `app.js`、`visual-sync.css` 一致。上述全局计数仅为当时冻结快照证据，不承诺后续共享工作树计数不变；AC-258、后续 Phase 3Y 及其他并行改动均不纳入 v1.82 独立背书，必须由各自任务独立 Review/QA。v1.82 只覆盖 v1.79 的独立经营进度条布局，不改变 v1.79/v1.81 的业务口径、状态口径、目标数据源、异步加载、表格目标、导出、筛选或移动端边界。最新测试发布证据与边界见上方共享组合包记录；未发布生产、未 commit、未 push。

> **v1.81 PC 首屏销售渲染与目标异步解耦（已完成并发布测试 App，2026-07-23）**：`REQ-013 / AC-236～AC-242` 已完成。根因已确认：目标请求硬阻塞首屏，`loadSalesRaw` 在 `Promise.all` 中同时等待 `salesBundle`、`vehicleSeriesOptions`、`loadMonthlyTargetRaw`，导致销售指标、过程指标和销售概览表跟随月目标一起停留占位。v1.81 已实现销售事实、车系枚举和有效组织范围完成后立即解除主 loading 并渲染真实销售/过程主数据；月目标后台加载，经营进度条和表格目标槽独立显示加载态，完成后局部回填。目标失败不得阻断销售/过程主链路；旧目标响应不得跨筛选回写。目标 preview 在已确认 `rfs_code/mac_code/dealer_code` 与 `areaCode/districtCode/dealerCode` 对应时下推组织条件瘦身，但不改变目标自然键、目标数据源、目标实际 SQL、有效经销商维表归属、车系集合、自然月窗口或导出字段。门禁证据：Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/2`；最终 QA 功能门禁通过，`npm test` 130/130、PC 95/95、lint Syntax check 45 files、build PASS、audit 0、1280/1440 浅深色通过。发布命令重新构建并重打包后，`guancli app publish --app-id q0844640cf6734877a3193d6 --path .` 成功发布测试 App：`operation=update`、版本 `0.1.0`、`artifact=dist.0.1.0.zip`、`fileKey=1d9e70c3-938c-409d-b4e0-e1be26035edc`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。最终 zip SHA-256=`3125ba0859ff122ba05aa2029eab924d2a7dbe2ab689f4a079b5104aa1810359`，zip 完整性通过，关键四文件 source/dist/zip 三方哈希一致。未发布生产、未 commit、未 push。

> **v1.80 PC 打铁指标优质试驾看板链接已随测试 App 发布（2026-07-23）**：本次承接 `REQ-012 / SCOPE-025 / TASK-018 / AC-235` 的轻量外链增量，已在 Phase 3R “打铁运营看板”按钮右侧新增第二个固定外链按钮“优质试驾看板”，完整 URL 固定为 `https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa`，已验证原样保留 `pgId` 和 `id` 查询参数。两个外链共存，同一工具栏、同一轻量外链样式，顺序固定为 `打铁运营看板 → 优质试驾看板`；点击均使用 `<a target="_blank" rel="noopener noreferrer">` 新窗口安全打开，不让当前 Super App iframe 导航离开。实现文件为 `index.html`、`iron-metrics-view.js`、`iron-metrics.css`、`validation/iron-metrics-pc-tabs.spec.js`、`validation/iron-metrics-a11y-visual.spec.js`、`validation/iron-metrics-query.test.mjs`。门禁通过：`npm test` 126/126、`npm run test:pc` 87/87、定向 pc-tabs 10/10、lint Syntax check 45 files、build PASS、audit 0、敏感扫描 0、`git diff --check` PASS；8 张现有 iron-metrics 邀约/试驾 1280/1440 浅深截图已刷新。Code Review 初审 PASS P0/P1/P2=`0/0/2`，两项 P2 均为测试强度；补测后复审最终 PASS P0/P1/P2=`0/0/0`。本增量只限 PC 打铁指标工具栏，未修改任何指标口径、SQL、数据集、状态、权限、导出、筛选、下钻、分页、车系或销售经营进度条；v1.79 `REQ-013 / AC-227～AC-234` 的当前状态见下条。已随北京时间 `2026-07-23 16:49:52` 的同一测试 App 包发布至 `q0844640cf6734877a3193d6`（`operation=update`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`）；发布包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`。未发布生产、未 commit、未 push；既有 Vite classic script 与 `NO_COLOR` warning 非阻断。

> **v1.79 PC 销售经营进度条与时间进度已开发、Review/QA 通过并发布测试 App（2026-07-23）**：Phase 3T / `REQ-013 / AC-227～AC-234` 已全部完成。PC 顶部订单目标、订单达成、零售目标、零售达成和“时间进度”已从“销售指标”标题行迁移为销售指标与过程指标上方的独立“销售经营进度”条；时间进度按页面运行时今天的日期序号 / 当月天数显示 1 位小数，使用中性灰蓝且不读取筛选 `endDate`。销售指标和过程指标保持同起点、同高、同水平基线，月环比/周环比仍上下两行；无目标、跨月、未来、非 MG 或目标隐藏时整条隐藏，目标失败时保留既有暂不可用类文案。Code Review Stage 1/2 PASS，最终 QA PASS，P0/P1=`0/0`；门禁为 Node 126/126、PC 89/89、lint Syntax check 45 files、build PASS、audit 0、隐私扫描通过，source/dist 的 `app.js` 与 `visual-sync.css` SHA-256 一致。1280/1440 浅色、深色四张截图通过；对比度为浅色 target/achievement/time=`6.83/5.48/5.10`，深色=`8.43/10.13/8.69`。已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；发布包 `dist.0.1.0.zip` SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`、`139940` bytes、`31 files / 583411 bytes`。匿名入口 HTTP 401 只证明登录保护；Chrome 父应用刷新后自动 DOM/截图持续超时，未完成登录态线上 UI 验收。未发布生产、未 commit、未 push。

> **v1.78 打铁指标固定运营看板链接已发布测试 App（2026-07-23）**：Phase 3R 已在 PC “打铁指标”模块二级 Tab `邀约指标 7 / 试驾指标 4` 右侧新增固定可点击链接“打铁运营看板”，目标 URL 为 `https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845`，使用 `target="_blank"` 与 `rel="noopener noreferrer"` 新窗口安全打开。链接继承现有页面样式，未移动二级 Tab、表格、导出入口或一级 Tab，未改变打铁 11 项指标口径、取数、筛选、分页、下钻、扁平查看或导出范围。Code Review PASS，P0/P1/P2=`0/0/2`，P2 均非阻断；其中既有 `validation/iron-metrics-query.test.mjs` 424 行拆分债本轮不拆。门禁通过：`npm test` 126/126、`npm run test:pc` 86/86、lint Syntax check 45 files、build、audit critical=0、隐私扫描通过，1280/1440 浅色与深色截图通过；发布后独立 QA PASS，P0/P1/P2=`0/0/0`。已发布测试 Super App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；发布包 `dist.0.1.0.zip` SHA-256=`6f59891701ed953f8cd95173d1639cb99c90b318137cb3035a14ae06cfb7fd22`、`139391` bytes、`31 files`。匿名入口 302/401 只表示登录保护，未做登录态线上业务 UI 验收；未发布生产、未 commit、未 push。

> **v1.77 打铁指标当前范围全部经销商扁平查看最终本地 QA PASS，已发布测试 App（2026-07-23）**：承接用户对 v1.73 范围的纠正，“当前范围全部经销商”不是只给销售概览/过程分析的特例，打铁指标也必须同构支持。PC 表现区三张一级 Tab `销售概览 / 过程分析 / 打铁指标` 共用同一个 `allDealerMode` 与进入前快照；入口仍位于表现区 header 工具区、导出按钮左侧，当前激活为打铁时同样显示“查看所有经销商 / 返回分层查看”。打铁扁平态以当前上游 URL 筛选、罗盘行权限、有效经销商白名单和当前 `drillPath` 为范围，基于既有 `ironStores` / 无车系 `processBaselineData` 组织骨架派生 `effectiveLevel=store`，不新增数据集、不扩大权限、不改变顶部指标、不改 11 项公式/目标/SQL-only/车系 fail-closed 规则。切换打铁二级组 `邀约指标 7 / 试驾指标 4` 保留扁平状态、当前范围和打铁页码；打铁扁平态下组织下钻/返回禁用，门店详情保留；导出当前激活二级组在当前扁平范围内全部经销商行，非仅当前 15 行分页。独立 Review Stage 1/2 PASS，最终本地 QA 0 阻断；门禁为 `npm test` 126/126、`npm run test:pc` 85/85、lint Syntax check 45 files、build exit 0、audit critical=0。已发布测试 Super App `q0844640cf6734877a3193d6`（`environment=test`、平台命令 exit 0、`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；发布包 SHA-256=`e5c138b0549a6eb2b91b89964efb417b0d63ae476e447c3dd8c189bc73518807`、`138887` bytes、`31 files / 578408 bytes` 解包。平台发布成功且包信息正确；发布后独立 QA 仅有限 PASS：Chrome 登录态非白屏且三张 Tab 可见，但 standalone 缺人员画像，未完成“查看所有经销商”登录态业务 UI 终验，不建议回滚。未发布生产、未 commit、未 push。

> **v1.76 PC 销售概览行内四率双层漏斗已完成本地实现、Code Review 与 QA 功能门禁（2026-07-23）**：承接 `docs/superpowers/specs/2026-07-23-sales-row-conversion-rates-design.md` 的 B 方案，在 REQ-002 的“销售概览”表第二列 `销售结果（指标：月环比）` 内采用上下双层结构：上层保留 `线索 → 到店 → 试驾 → 订单 → 零售` 五段数量及数量月环比，下层新增 `线索到店率 → 到店试驾率 → 试驾订单率 → 交付率` 四个等宽转化率及百分点月环比。四率均从当前行 `row.current` 与 `row.previous` 的原始分子/分母计算，适用于大区、小区、门店、全部经销商扁平查看、投资人门店集合和车系筛选后的销售事实；不得平均门店率。表内第四率为 `交付率=零售/订单`，与顶部过程卡第四项 `线索订单率=订单/线索` 明确不同。首次 Code Review 发现 1280px 视口右侧裁切 `41.6px`、上月同期可比率为 `0.0%` 时被误判为 `--`，均已修复；复跑 Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/0`。最终 QA 在临时副本完成 Node `126/126`、PC `82/82`、lint Syntax check `45 files`、build exit `0`、audit critical=`0`，功能与视觉门禁均通过；首次 QA 唯一 P2 为文档状态不一致，本次已闭环修正。未发布、未 commit、未 push。

> **v1.75 打铁指标月环比/周环比、DCC SQL-only 已发布测试 Super App（2026-07-23）**：打铁 Tab 的 `邀约指标 7` 与 `试驾指标 4` 两个二级模块，所有 11 项指标均已新增与“过程分析”一致的当前值、`月环比`、`周环比` 三行展示；DCC 182 四项已切换到新表 ``双品牌DCC话务指标182`` 的服务端 SQL 聚合，不再使用 preview/fallback。当前期、上月同期、上周同期使用同一指标公式、分子/分母、去重、日期/区域/车系/权限/白名单上下文，比较周期复用 `previousMonthRange(range)` / `previousWeekRange(range)`；比率环比按百分点差展示，真实无分母为 `--`，比较期失败只影响对应环比。发布门禁为 Node 119/119、PC 74/74、lint/build/audit/隐私扫描通过；已更新测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256=`293a24705b23f9c3354e91cf196f6236b8b4f7563da0d86d05e80aefc26fe520`、`136515` bytes、31 files），入口重定向后 HTTP 200。未发布生产、未 commit、未 push；未执行登录态线上业务数据 UI 验收。
> **v1.74 打铁 `qualityTrial` 品牌语义已验证更正（仅规格与计划更新，2026-07-23）**：本次只更新 `Product-Spec.md` 和 `DEV-PLAN.md`，不修改源码、测试、构建产物，不发布、commit 或 push。`qualityTrial` 数据集 `lbfb702c771cd496d85896f7` 已验证为 MG 专属，且尚未审计到可用于 SQL 的品牌字段：上游 `brand=MG` 或 `brand=全部` 时可按组织、日期和车系执行该来源 SQL，不得虚构品牌 SQL 条件；任一非 MG 品牌时必须在发起该来源 SQL 前以 `fieldGapReason` 标记 `数据不完整` 并零 SQL，不得使用 preview/fallback，也不得向非 MG 品牌返回 MG 数据。该例外不改变其他打铁来源的品牌语义要求。
> **v1.73 当前范围全部经销商扁平查看已通过独立 Review 与最终 QA，本地实现完成（2026-07-23）**：AC-186～AC-198 已全部完成。入口仅在 PC“销售概览/过程分析”、真实 `organization.viewLevel !== 'store'`、当前有效经销商集合大于 1、无全局加载/空/错误/无权限且对应过程数据无局部错误时显示；真实 `store` 层本身已是经销商清单，入口隐藏。激活扁平模式时保存进入前 `organization.viewLevel/drillPath`、销售/过程页码和 `selectedStoreCode` 快照；销售/过程扁平态冻结真实组织状态，隐藏面包屑返回按钮且返回事件不生效；关闭后恢复快照。切到“打铁指标”仍显示真实层级；若用户在打铁中合法下钻或返回，销售/过程扁平快照同步到最新真实层级和页码，返回销售/过程后继续扁平当前新范围，退出时恢复该最新真实层级。最终门禁为 `npm test` 117/117、`npm run test:pc` 72/72、lint Syntax check 42 files、build 通过、audit critical=0；已生成精确 `1440x900` viewport 浅色截图 `multi-store-super-app/validation/pc-all-dealers-sales-flat-1440x900-light.png` 与 `multi-store-super-app/validation/pc-all-dealers-process-flat-1440x900-light.png`。本目标未发布、未 commit、未 push。Review 继承债不属于 Phase 3N 功能回归：暗色过程表 `metric-value` 对比度另开后续，不阻断本次浅色展示；P2 的文件过长、过滤逻辑重复、AC-188 旧 DOM 断言、未挂载 `filter-ui` 转义仍保留为技术债，不冒充已修。
> **v1.72 打铁指标上游筛选继承与 SQL-only 查询合同（仅规格更新，2026-07-23）**：本次只更新 `Product-Spec.md` 和 `Product-Spec-CHANGELOG.md`，不修改 `DEV-PLAN.md`、`multi-store-super-app/` 源码、测试、构建产物，不发布、commit 或 push。打铁模块 11 项取数范围必须严格继承上游应用筛选器的日期、区域和车系：日期使用 `startDate/endDate` 闭区间，即 `startDate <= 各来源已审计真实日期字段 <= endDate`；区域使用上游 `regionCode/districtCode/dealerCode`，并与罗盘行权限、有效经销商白名单取交；车系必须使用每个打铁真实来源已审计的物理车系字段，不得把销售漏斗 `汇报车系名称` 代理到试驾、邀约、DCC 或话术来源。任一来源缺车系字段或映射未审计时，具体车系筛选必须 fail-closed 为 `数据不完整` 并报告字段缺口，禁止返回“全部车系数据”或伪联动。前端加载打铁 11 项只能使用服务端 SQL 聚合结果；SQL 失败、业务码失败、字段缺失、截断或完整性不可证时显示 `数据不完整`，不得再走 preview 明细、分页 fallback 或前端明细聚合。本次不改变 11 项指标公式、目标、展示顺序、二级切换、组织/下钻状态或导出范围；`DEV-PLAN.md` 需要后续按本合同重规划。
> **v1.70 打铁指标 PC 展示与下钻已发布测试 Super App（2026-07-22）**：`v1.69` 已被打铁指标应用采用口径占用，本次按下一个未占用版本 `v1.70` 完成展示、下钻、导出和本地验证，不覆盖历史。打铁指标仍是 PC 表现区第三 Tab，顺序为 `销售概览 → 过程分析 → 打铁指标`，默认仍激活“销售概览”。“打铁指标”Tab 内采用已批准 C 方案二级切换：`邀约指标 7` 默认激活，`试驾指标 4` 作为同级切换；同一时间只展示一组指标。每个指标表头必须先显示指标名称、再显示 `目标 xx%`；`首跟通话60s占比` 无目标，指标名下方不显示“无目标”或任何占位文案。目标只作为口径提示，不生成红绿底色、圆点、达标标签或识别状态。两个二级指标组共享无车系过程基线组织骨架、范围文案、`viewLevel/drillPath`、返回上一级、页面分页状态和行序；具体车系筛选后，不要求销售概览与打铁指标行数或成员完全一致；切换邀约/试驾不重置下钻。导出复用当前 PC 导出入口，仅导出当前激活的邀约/试驾组和当前 `viewLevel/drillPath` 范围内全部组织行，非仅当前页面分页，不新增第二个导出按钮。最终本地基线：`npm test` 106/106、`npm run test:pc` 58/58、真实静态语法 `npm run lint`、`npm run build`、`npm audit --omit=dev --audit-level=critical` 0 vulnerabilities 通过；R5 Code Review PASS，发布后独立 QA PASS，P0/P1/P2=0/0/0。已发布到测试 Super App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；发布包 `dist.0.1.0.zip`，SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`，大小 `126818` bytes，解包 `30 files / 521802 bytes`。匿名 HEAD `401`、匿名关键资源 GET/HEAD `401/302` 仅记录为认证边界，未做登录态线上 UI 或资源哈希验收；未做观远认证态真实查询仍成立；未发布生产、未 commit、未 push。正式设计文档为 `docs/superpowers/specs/2026-07-22-打铁指标PC展示与下钻设计.md`；`.superpowers` 下 HTML 原型只作已批准概念证据，不作为长期依赖。
> **v1.69 打铁指标正式需求文档已修订、待开发（2026-07-22）**：本次实际更新 SCOPE-013、SCOPE-025、TASK-016、REQ-012、数据模型、DEP-015、可靠性、完成定义、ASM-012、AC-143～AC-150 及详细口径文档，不修改 `multi-store-super-app/` 源码、测试、构建产物、`DEV-PLAN.md`、AGENTS，不发布、commit 或 push。打铁 7 项邀约 + 4 项试驾新增为表现区右上 tablist 的第三个 Tab“打铁指标”，顺序固定为 `销售概览 → 过程分析 → 打铁指标`；默认激活仍为“销售概览”。11 项只按上游应用传入或当前有效 `startDate/endDate` 计算一个当前区间值，不复制官方打铁看板周/月列、T+1、自然周、自然月、today/yesterday、24h 周、2天3呼月或手机互联月 `>` 等日期规则；不展示识别状态、红黄绿点或综合得分。手车互联开口率、离车泊入开口率按一期单店口径先限定对应 `试驾体验点`，再以该体验点内 distinct `试驾清单ID` 为分母，分子为其中 `是否提及='是'` 的 distinct ID；试驾第 2 项展示名统一为“试驾录音回收率”。历史 v1.66 官方看板复原保留为证据，凡与本条冲突，以 v1.69 应用采用口径为准。
> **当前实施状态（2026-07-21）**：`multi-store-super-app/` 先恢复为远端 `feature/260717-1@3a3c95e9354cb0b820b32496efcbe9b65205167d` 的原始源码，再完成 AC-080～AC-087 的销售漏斗最小改造：销售事实按 `一级经销商代码` 筛选和聚合，按 `父经销商简称` 展示，通过既有字段别名保持前端消费结构不变。该改造已完成实现、Code Review 和最终 QA，并与运行时门店详情环境跳转修复一起于北京时间 2026-07-16 18:01:40 发布到测试 App `q0844640cf6734877a3193d6`（版本 `0.1.0`）；本次仍未 commit 或 push。本轮 v1.54 的 PC 顶部过程指标已统一为线索到店率、到店试驾率、试驾订单率、线索订单率，已完成 QA，并与 v1.53 的组织表现清单排序一起于北京时间 2026-07-16 18:45:50 发布到测试 App `q0844640cf6734877a3193d6`（版本 `0.1.0`）；移动端尚未开发，仅同步后续规格与验收，本次仍未 commit 或 push。最新测试包已包含 v1.57 车系筛选器迁移到销售区“销售总览”整体标题行右侧（非销售指标单框内）的修复，以及此前 v1.55 PC 应用级车系筛选（销售唯一字段为 `汇报车系名称`，过程事实保留显式同口径边界）和 v1.56 “销售概览 / 过程分析”Tab 文案；已发布到同一测试 App（`operation:update`、版本 `0.1.0`、包 SHA-256 `b49f7e47ea742a705c79b381e71cbe4689bf88d35e043b2c3839d85b52b712ca`）。v1.59 仅补充“多店门店过程分析的三项试驾问题率必须与一期单店口径完全一致”的可验收规格，未修改业务源码、测试、AGENTS、未发布、未 commit、未 push。v1.60 针对默认 `2026-07-01~2026-07-20 / MG / 全域` 历史 IP 聚合 5118 行、历史试驾聚合 6141 行触达平台 `limit=5000` 且 IP/试驾同一 `Promise.all` 失败导致过程分析整段丢弃的问题，已完成过程标签定向聚合、按 kind 独立加载、独立完整性证据和 UI 状态实现，并通过 Code Review、QA 与测试 App 发布。默认真实查询 IP=`1896`、drive=`1371`、`isTruncated=false`；门禁为 `npm test` 70/70、lint/build 通过、PC 26/26、audit critical=0、Review P0/P1=`0/0`、QA PASS P0/P1/P2=`0/0/0`。已发布到测试 App `q0844640cf6734877a3193d6`（`operation:update`、版本 `0.1.0`、`fileKey=4afc645a-70e5-42c0-8956-a4eacd62ef44`、包 SHA-256 `adaa813455b94444523f5a1e28f6ccfa5a5fbf91c4cbec0864a5b73557859084`，访问地址 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；匿名 HEAD 为 HTTP 401，仅确认登录态保护，未执行登录后线上 UI/功能验收；未发布生产、未 commit、未 push。此前 AC-068～AC-079 所描述的完整父子关系建图、全事实成员展开、关系预检和过程指标父店聚合方案已撤回，不再代表当前代码实现；下文相关条目仅保留为历史记录。凡历史描述与本说明冲突，以本说明为准。
> **v1.61 已实现、验收并发布测试 App（2026-07-21）**：`multi-store-super-app/` 已只读接入 MG 月目标数据集并完成“月目标、目标达成”展示、组织聚合和销售导出；`npm test` 79/79、`npm run lint`、`npm run build`、`npm run test:pc` 33/33、`npm audit --omit=dev --audit-level=critical` 均通过，已保存 1280/1440px 明暗四张截图。独立 Code Review 双阶段和独立 QA 均通过，P0/P1=0。已发布至测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256 `143301505ff3524d078de8e80268923684cbcac5c2136b9cd3ecf28339b49038`）；匿名访问 HTTP 401，仅确认登录态保护，未做登录后线上 UI 验收。本次未写目标数据、未授权、未 commit、未 push。
> **v1.62 已实现、验收并发布测试 App（2026-07-21）**：PC 顶部指标卡元信息已调整为“月环比、周环比固定第一行；订单卡有有效目标时月目标、目标达成固定第二行；无目标指标第二行为真实 `aria-hidden` 空槽”，订单/零售表现 2×2 已调整为订单“月目标｜目标达成 / 排名｜占比”、零售“空槽｜空槽 / 排名｜占比”。`npm test` 79/79、`npm run lint`、`npm run build`、`npm run test:pc` 33/33 均通过，1280/1440px 浅深截图已刷新并加入目标、排名和结果断点无截断断言。独立 Code Review 双阶段与独立 QA 均通过（P0/P1=0）；已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256 `3d265f537db879a1d557715c3c1725d8a9f30331bd55a17056b87b804ba631da`）。匿名入口 HTTP 401，仅确认登录态保护，未做登录后线上 UI 验收；不新增“覆盖达成/覆盖不足/部分车系/部分门店”提示，不改变数据口径、导出、组织下钻或失败降级，未 commit、未 push。
> **v1.63 已实现、本地验证、QA PASS 并发布测试 App（2026-07-21）**：Phase 3F.2 已在 `multi-store-super-app/data-api.js`、`validation/monthly-target.test.mjs`、`validation/pc-role-drilldown.spec.js` 实现。单月任意日期读取完整自然月目标及月初至 `min(今天, 月末)` 的目标口径实际订单；跨月或未来月返回 `invalid_range` 空槽并发起零目标请求，主销售链路不变，销售导出目标数值为空，且未新增文案。目标专项测试 `11/11`、`npm test` `81/81`、`npm run lint` 与 `npm run build` 均退出 `0`、`npm run test:pc` `34/34`；独立 Code Review P0/P1=`0/0`。独立 QA 在临时副本复核 PASS，P0/P1/P2=`0/0/0`，同样通过 `npm test` `81/81`、PC `34/34`、lint/build `0` 与 `npm audit --omit=dev --audit-level=critical`（0 vulnerabilities）。发布前 current tree 为 `environment=test`，隐私扫描无命中；已在项目根执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 且命令无报错完成，发布包 `multi-store-super-app/dist.0.1.0.zip` 于 17:49 生成，SHA-256=`c1dc8399807cbca9d3f06c1f933d928aa76d46c51446513467c0564d43619d3e`。CLI 未输出平台 `operation`、版本或 `fileKey`，不作推断；匿名入口 HTTP 401 仅确认登录保护，未做登录后 UI 验收。
> **v1.64 已开发、代码审查与独立 QA 通过并发布测试 App（2026-07-21）**：PC 顶部销售指标区已按最终布局实现：所有顶部指标卡只展示“指标值 + 月环比 + 周环比”，月环比、周环比上下两行展示；月目标/达成已从订单卡第二行迁移到“销售指标”标题行右侧的次级摘要。表格订单表现中的“月目标｜目标达成 / 排名｜占比”、目标数据口径、筛选联动、导出字段、过程卡数据、排名和下钻保持不变。用户线上截图曾显示旧卡内目标布局，根因是 `index.html` 对 `visual-sync.css` 与 `app.js` 的缓存 query 仍为 `target1`；两处均已升级为 `target2`。更新后构建、独立代码审查与独立 QA 均通过，`npm test` 81/81、PC 35/35、lint/build/audit 均通过。更正：此前 17:49 发布因 `guancli` 1.0.34 与过期 profile token 未返回平台回执，线上仍为 `target1`，不得认定成功；已按用户授权通过官方 POST `/public-api/user/loginId/sign-in` 刷新本机 `guancli` profile（文档不记录密钥、账号或 token），并升级 `guancli` 至 1.0.42。北京时间 2026-07-21 20:49 从 `multi-store-super-app/` 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，平台真实回执为 `操作:update`、版本 `0.1.0` 且 appId 对应；新 `dist.0.1.0.zip` 时间为 20:49:00，SHA-256=`1c917cd1feec3231f0b8bdc6cb44c7f26493253de0c8cf6f41d3d79872651b4a`。匿名线上 URL 仍返回 HTTP 401，仅说明登录保护；已用新 UID token 认证读取线上资源，`index.html` Last-Modified 为 Tue, 21 Jul 2026 12:49:01 GMT（北京时间 20:49:01），引用 `app.js?v=20260721-target2`，不再引用 `target1`；线上 `target2` 的 `app.js` HTTP 200，包含 `sales-target-summary` / `订单目标`，且无 `target-meta`。
> **v1.65 已完成并通过 Review 与最终 QA，本目标不发布（2026-07-22）**：PC 应用级车系筛选从历史单选升级为不限数量多选。默认/无具体选择仍表示“全部车系”；菜单改为复选且单项点击不关闭；URL 规范化为重复 `vehicleSeries` 参数并兼容历史单值 `vehicleSeries/carSeries/series`；选中集合必须进入当前/月同期/周同期销售事实、顶部指标、销售概览/导出、月目标/达成、动态排名/占比、刷新、埋点和缓存。过程异名字段不伪联动；当前多店 `orderRank/retailRank/orderShare/retailShare` 基于已过滤 `peerRows` 动态计算，必须继续展示并随多选集合重算；只有独立官方排名/分位/诊断结果表缺车系维度时才隐藏或降级。验证证据：npm test 90/90、test:pc 43/43、lint/build/audit exit 0、source/dist、1440x900 多选展开态截图、安全和未发布边界通过；两阶段 Review Stage 1/2 PASS，最终 QA PASS，P0/P1/P2=0/0/2，2 项 P2 为非阻断（大文件职责集中、无车系 baseline 完整 loader 性能冗余）；未发布、未 commit、未 push。
> **v1.66 打铁官方看板复原历史记录（2026-07-22）**：已按观远页面 `c678fa8f2906744faaba8516` 的真实卡片、公式、数据集和导出值，复原“打铁运营指标”7 项邀约 + 4 项试驾，完整证据见 `docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md`。该版本只作为官方页面事实和历史证据保留；凡与 v1.69 应用采用口径冲突，以 v1.69 为准。
> **v1.67 已开发、Code Review PASS 并最终 QA PASS（2026-07-22）**：PC 目标链路从旧订单目标单表升级为 MG 新“订单目标 + 零售目标”双链路；旧订单目标源 `u32cb7e789f7443ff84160b4` 已从当前业务源码、目标测试和 `dist/` 搜索清零，当前只读消费新 DS `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标`，字段限定为 `目标日期、dealer_code、车系、总订单目标、总零售目标`，MG 品牌由常量补齐，组织归属只取现有有效经销商维表。顶部“销售指标”标题摘要同时显示 `订单目标/订单达成` 与 `零售目标/零售达成`；订单表现与零售表现均为“月目标｜目标达成 / 排名｜占比”2x2；导出新增零售目标、零售目标口径实际、零售目标达成率和对应审计字段。订单目标达成分子保持目标口径实际订单 `当日订单数（首触）`，零售目标达成分子为目标口径实际零售 `当日零售数`；跨月、未来月、无目标和请求失败与现有目标降级同构，非 MG 品牌隐藏两类目标。当前门禁为 Node 90/90、PC 43/43、lint/build/audit critical=0，新 DS 真实审计为 1542 行、订单目标 22578、零售目标 18580、5 条有效经销商缺口；最终 QA PASS，P0/P1/P2=0/0/0；未发布、未 commit、未 push。
> **v1.68 已实现、本地验证并 Code Review PASS（2026-07-22）**：投资人 `marketing_userType=6` 进入门店层时，订单排名、零售排名和对应占比的 portfolio 比较集合为当前有效门店集合；保留 5 家有效门店则显示 `x/5`，上游具体 `dealerCode/store` 只保留 1 家时必须显示 `1/1`。其他角色排名口径不变，主问题/结果断点动态诊断口径不在本次范围；未发布，完整 PC 测试漂移不在本次处理范围。

## 0. AI 使用说明

- 本文档是 2 期多店聚合销售诊断工作台与大应用嵌入兼容的产品功能、范围、行为和验收标准事实来源。
- AI MUST 优先实现 P0。
- AI MUST NOT 实现“不在本版本范围”中明确排除的内容。
- AI MUST 根据“验收标准”判断功能是否完成。
- 指标分子、分母、过滤条件、日期字段、去重规则、环比和空值处理 MUST 严格复用一期单店工作台口径；2 期不得另起指标定义。
- 多店聚合指标 MUST 在当前父应用筛选范围内基于原始分子/分母重新汇总计算，不得对门店级百分比做简单平均。
- 过程表现邀约四项与试驾三项 MUST 分别使用定向一级标签聚合，只查询页面需要展示的问题，不返回无用 `problem_child` 组合；SQL 聚合结果仍以 `5000` 行为完整性门禁，触达上限时必须失败关闭，不得静默截断。
- IP 电话邀约与试驾接待标签 MUST 按 `kind` 独立加载、独立记录完整性证据和独立进入错误状态；一类失败不得清空另一类已成功结果。
- 打铁 11 项 MUST 只消费服务端 SQL 聚合结果，并严格继承上游 `startDate/endDate`、`regionCode/districtCode/dealerCode` 与车系多选集合；不得使用 preview 明细、分页 fallback 或销售 `汇报车系名称` 代理任一打铁过程来源车系字段。
- v1.92 起销售车系筛选 MUST 真实联动打铁 11 项当前、上月同期、上周同期三阶段；6 个来源必须使用已确认物理字段和销售闭集映射查询，不得用全部车系数据、旧缓存、无车系 `processBaselineData` 或边界说明冒充具体车系结果。
- DCC 打铁 4 项 MUST 使用官方打铁看板业务过滤后的 DCC 自身门店范围与 DCC 自身组织字段，不得与 `validDealers` 求交；观远 DCC 行级权限仍是安全边界，无 DCC 授权、查询失败或范围不可证必须 fail-closed。非 DCC 打铁来源、销售和过程分析继续当前 `validDealers` / 权限合同。
- 打铁 11 项 MUST 与过程分析一致展示当前值、月环比和周环比；当前、上月同期、上周同期均按同一 SQL-only 口径和同一筛选上下文计算，比较期失败不得影响当前值。
- PC 订单/零售目标 MUST 拆源只读消费：订单目标读 `u32cb7e789f7443ff84160b4` / `打铁运营机制看板目标` 并按输出行 SUM `订单目标`，零售目标读 `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标` 的 `总零售目标`；`r05.总订单目标` 和 `h9828e20e9026475091ae6ca` 不得作为当前订单目标，本需求不授权写回、授权或生产配置变更。
- 订单目标达成 MUST 使用独立目标口径实际订单查询，按自然月 + `品牌名称=MG` + `一级经销商代码` + `汇报车系名称` 聚合 `当日订单数（首触）`；零售目标达成 MUST 使用同键独立聚合 `当日零售数`。MUST NOT 复用已丢失车系维度的 `salesAggregateSql` 计算任一目标口径实际。
- PC 目标摘要 MUST 位于“销售总览”标题行左侧标题组内，紧跟 `销售总览` 标题展示；标题行右侧保留最右车系筛选。目标摘要仅在目标有效可展示时按顺序展示订单目标、订单达成、零售目标、零售达成和时间进度。v1.91 覆盖 v1.82 的标题行中间布局，但不改变其业务口径和状态口径。时间进度公式为今天日期序号 / 当月月末日期序号，展示 1 位小数，使用中性灰蓝，不表达达标。
- 【已撤回，非当前实现】页面展示单位仅为父经销商（一网），并将销售和过程事实全部按父子成员关系聚合的完整方案。当前源码以 `feature/260717-1` 为回退基线；AC-080～AC-087 已在销售漏斗范围内完成 `一级经销商代码` 与 `父经销商简称` 的最小改造，不扩展到过程事实，已发布到测试 App `q0844640cf6734877a3193d6`。
- 2 期如补充数据契约，只能说明一期口径在区域/小区/多门店范围下的筛选、聚合和字段映射，不得改写一期口径。
- 2 期发布 MUST 新建独立 Super App，不得修改、覆盖或重新发布已有一期单店工作台 Super App。
- 本产品继承一期单店诊断工作台的核心边界：前端可基于当前有效数据范围计算清单展示所需的动态排名、占比和规则诊断，但不得把这些结果标为官方排名、官方分位或官方诊断；官方口径仍由数据层预计算并持久化。
- 本产品必须作为“零售智能驾驶仓”大平台中的「零售过程」Tab 内嵌子应用交付；筛选初始值和白天/黑夜模式由父应用发起。长图导出协作只适用于 PC 入口；移动端入口不提供导出按钮，也不响应移动端截图协作。子应用筛选选项复用一期单店平台的经销商主数据维度表并负责消费参数。
- 移动端 MUST 作为同项目内的独立页面入口交付，不得用响应式规则替换现有 PC 页面；移动端入口路径在开发阶段确定，父应用负责识别设备、选择入口并通过 URL Query 传入上下文。
- 2 期前端 demo 的整体视觉效果 MUST 以一期单店诊断 Super App 线上版本 `https://rdata-pv.rauto.com/open-apps/ad986efe9bfc14f898475538/` 为唯一视觉基线；使用本地 demo、历史截图或本地文件前，必须先确认其与线上版本一致。多店对齐规则和业务例外以 `VISUAL-PARITY-MATRIX.md`、发布前验收以 `VISUAL-PARITY-VERIFY.md` 为准；不得退回旧版普通白卡 demo 风格。

## 1. 产品上下文

### 1.1 产品摘要

2 期多店聚合销售诊断工作台 PC 端面向总部、大区、小区、销售总监和投资人角色，用于帮助不同管理层级先看清上游筛选范围内的整体指标，再按大区、小区、门店逐级识别销售/过程表现、排名、主问题和结果断点。

本期同时必须作为零售智能驾驶仓大平台中的「零售过程」Tab 被 iframe 嵌入。页面不自建大平台顶部导航、全局筛选、白天/黑夜切换和保存长图菜单，而是读取父应用通过 URL Query 传入的筛选和主题参数；仅 PC 入口通过 `postMessage` 配合父应用完成长图导出，移动端入口不参与导出。

本期不是全国大屏，也不是把一期单店页复制成多店长列表；当前重做版 PC 核心是“上游有效范围整体指标如何、当前管理层级下哪些组织或门店表现异常、主问题和结果断点是什么”，并且能以新建 Super APP 无缝嵌入部门整体应用。本次角色分层和组织下钻只调整 PC 入口，移动端保持既有需求与计划，不纳入本轮实现和验收。

### 1.2 用户问题

总部、大区和小区管理者分管不同层级的组织与门店。如果所有人进入后都直接看到门店长列表，总部和大区无法先比较同级组织，也无法沿管理层级下钻。用户需要在顶部保持上游筛选范围整体指标不变，同时在下方按自身角色从大区、小区或门店层进入，并沿“大区 → 小区 → 门店”逐级查看销售/过程表现、排名、主问题和结果断点。

同时，门店诊断工作台不再是孤立应用。它是零售智能驾驶仓中的一个业务 Tab，父应用已经承担用户入口、顶部筛选、主题切换和长图导出。如果子应用重复做一套筛选和主题控制，会造成口径冲突和体验割裂。

### 1.3 目标用户

| 用户类型 | 描述 | 核心需求 |
|---|---|---|
| 总部用户 | `marketing_userType` 为 `null`、`undefined`、空字符串或纯空白，或 `marketing_userType=4` 且 `marketing_orgType` 非空、非 `MAC/RFS` 的全国管理角色 | 在上游有效范围内比较大区，并下钻到小区和门店 |
| 大区用户 | `marketing_userType=4` 且 `marketing_orgType=RFS` | 比较本大区的小区，并下钻到门店 |
| 小区用户 | `marketing_userType=4` 且 `marketing_orgType=MAC` | 直接比较当前有效范围内的门店 |
| 销售总监 | `marketing_userType=2` | 直接查看其权限与上游筛选交集内的门店，不扩大范围 |
| 投资人 | `marketing_userType=6` | 直接查看其权限与上游筛选交集内的门店 |
| 门店经理 | 一期单店诊断页使用者 | 被区域经理定位后，进入单店页查看本店证据和复盘材料 |
| 大平台使用者 | 从零售智能驾驶仓进入「零售过程」Tab | 在统一筛选、统一主题和统一导出能力下查看本页面 |
| 后续开发/数据/测试人员 | 负责 Super APP、数据口径、写表联调和验收 | 理解 2 期页面范围、数据边界、排序规则和验收标准 |

### 1.4 核心价值

让总部、大区和小区管理者从“直接面对门店长列表”变成“顶部掌握上游筛选范围整体指标，下面从本人管理层级逐级比较和下钻”，减少无效排查，把管理动作落到最需关注的同级组织或门店。

同时让该工作台成为部门整体 Super APP 的标准子应用：筛选跟随父应用、主题跟随父应用、长图导出纳入父应用最终图片。

### 1.5 成功标准

| 判断标准 | 目标 / 信号 |
|---|---|
| 区域整体上下文清楚 | 用户进入页面后能先看到当前区域销售结果指标和线索到店率、到店试驾率、试驾订单率、线索订单率，并同时看到月环比、周环比变化 |
| 门店销售表现清楚 | 用户能看到每家门店的经销商名称、销售指标月环比、主问题名称和结果断点 |
| 范围边界清楚 | 页面不再展示旧过程指标面板、趋势浮层、深度分析、问题分布、AI 总结或电话邀约/试驾接待切换模块 |
| 发布边界清楚 | 2 期重做版新建独立 Super APP 发布，不更新旧多店 App 和一期单店 App |
| 大平台嵌入可用 | 父应用通过 iframe 打开后，子应用能读取筛选参数、同步主题，并参与长图导出 |
| 访问行为可追踪 | 零售智能驾驶仓「零售过程」页面访问能按 GIO 事件清单记录访问人和组织上下文 |
| 角色入口正确 | PC 能从 `retail-cockpit:personnel-profile` 稳定识别总部/大区/小区/销售总监/投资人；未知或非法组合不误判为总部 |
| 三级清单可用 | 总部按大区→小区→门店、大区按小区→门店、小区/销售总监/投资人直接按门店查看，且上游具体筛选自动跳过单行层级 |
| 口径不串层 | 顶部指标卡只随上游筛选变化，清单下钻不改变顶部；组织聚合先汇总原始分子分母再计算比例 |
| 过程问题可用性清楚 | 过程分析能分别展示邀约四项和试驾三项；某类标签失败时只标记该类数据不完整，不抹掉另一类成功值 |
| 订单/零售目标达成可判 | 用户在 PC 顶部“销售总览”左侧标题组内紧接标题看到订单目标/订单达成、零售目标/零售达成和时间进度；订单表现和零售表现均展示月目标、目标达成、排名、占比；无目标范围不保留摘要空槽，目标链路失败降级但不阻断销售结果 |

## 2. 范围

### 2.1 本版本范围

| 编号 | 内容 | 优先级 | 备注 |
|---|---|---|---|
| SCOPE-001 | 区域销售指标总览 | P0 | 销售漏斗模块分为“销售总览”标题行 + 两个视觉框：标题行左侧标题组紧接标题展示订单目标、订单达成、零售目标、零售达成、时间进度，右侧保留最右车系筛选；销售指标框展示订单、交付率、零售；过程指标框按线索到店率、到店试驾率、试驾订单率、线索订单率展示；每个指标卡展示当前值、月环比和周环比 |
| SCOPE-002 | PC 分级组织销售表现表 | P0 | 按角色及上游筛选自动进入大区、小区或门店清单；三层均展示销售漏斗、订单/零售排名与占比、主问题和结果断点，销售结果单元格采用上层五段数量漏斗、下层四率漏斗的双层结构，门店层保留既有字段与门店详情 |
| SCOPE-013 | PC 分级组织表现 Tab | P0 | 销售漏斗下方只展示一个表现区，内含“销售概览”“过程分析”“打铁指标”三个展示 tab，顺序固定为 `销售概览 → 过程分析 → 打铁指标`；分别承载销售表现表、过程表现表、打铁运营指标表，三个 tab 共用真实 `viewLevel / drillPath`，总部支持大区→小区→门店，大区支持小区→门店，其他已定义角色直接展示门店；默认激活仍为“销售概览”；三张 tab 共用 `allDealerMode` 扁平查看状态，扁平态冻结表现区真实组织返回事件并通过快照恢复，打铁指标同构支持当前范围全部经销商查看 |
| SCOPE-003 | 顶部筛选与查询状态 | P0 | 保留品牌、大区、小区、经销商、日期、查询按钮、数据更新时间和刷新入口 |
| SCOPE-004 | 新建 Super APP 发布 | P0 | 发布时新建独立 2 期应用，不更新旧多店 App `x944c089c3c4249ea925fde6`，不修改一期单店 App |
| SCOPE-006 | 单店页跳转 | P0 | 每家门店行末展示“门店详情”按钮，点击进入一期单店诊断页，并携带当前门店、日期区间、品牌、大区、小区、主题和来源上下文 |
| SCOPE-007 | 大平台 iframe 嵌入参数适配 | P0 | 读取 `startDate / endDate / brand / brandCode / region / regionCode / district / districtCode / dealer / dealerCode / dealerShortName / theme / previewMode`，作为初始化筛选和主题上下文 |
| SCOPE-008 | 白天/黑夜主题兼容 | P0 | 子应用按父应用 `theme / previewMode` 展示 light / dark，不自建独立主题入口 |
| SCOPE-009 | PC 长图导出协作 | P0 | 仅 PC 入口响应父应用 `RETAIL_CAPTURE_REQUEST`，返回 PC 子应用完整页面 PNG 截图或明确错误；移动端入口不适用 |
| SCOPE-010 | GIO 访问埋点 | P0 | 按 `智能驾驶仓-零售过程` 事件清单上报 `smartmind_sale_View`，并复用一期用户识别链路补全当前登录人基础信息 |
| SCOPE-011 | 区域整体趋势大屏 | P1 | 后续用于展示更长时间趋势，不进入首版 |
| SCOPE-012 | 整改任务流和动作追踪 | P1 | 后续做闭环管理，首版不做写回 |
| SCOPE-014 | 移动端独立页面入口 | P0 | 在同一项目新增移动端独立入口，具体 URL 路径标记为“待开发阶段确定”；PC 页面、PC URL 和既有 PC 需求保持不变，由上游移动端应用识别设备并选择移动端入口 |
| SCOPE-015 | 移动端核心指标 | P0 | 首屏直接展示两列核心指标卡，默认显示订单、交付率、零售、线索到店率；展开后追加到店试驾率、试驾订单率、线索订单率 |
| SCOPE-016 | 移动端门店卡片流 | P0 | 保留销售表现/过程表现切换，以门店卡片替代横向表格；每页 15 家，首张卡默认展开、其余默认收起，支持展开/收起、分页和门店详情跳转 |
| SCOPE-017 | AI 建议话术或区域经理点评 | P1 | 后续可基于沉淀事实生成，首版不做 |
| SCOPE-018 | PC 访问角色识别 | P0 | 从 `sessionStorage['retail-cockpit:personnel-profile']` 解析 `marketing_userType / marketing_orgType`；仅当 `marketing_userType` 为 `null`、`undefined`、空字符串或纯空白时默认总部；其他未知类型、非法 JSON、非对象画像、`marketing_userType` 非法类型及 `marketing_userType=4` 的缺失/非法组织类型均进入角色识别异常状态 |
| SCOPE-019 | PC 自动跳层与清单下钻 | P0 | 角色决定最高可见入口，上游具体大区/小区/门店筛选自动跳过无意义单行层；手动下钻只收窄下面清单，筛选变化时清空 `drillPath` 并重新判定入口 |
| SCOPE-020 | PC 三级聚合排名与动态诊断 | P0 | 大区在同品牌同日期全国大区内、小区在所属大区内、门店默认在所属小区内动态排名并计算占比；投资人 `marketing_userType=6` 门店层例外，按其名下当前有效门店集合统一排名和计算占比，不按小区拆分；订单/零售排名采用稳定唯一排名，主指标降序、同值按组织代码升序拆分为连续名次；主问题/结果断点继续使用既有动态诊断规则，本次不改诊断口径 |
| SCOPE-021 | PC 应用级车系筛选 | P0 | 默认/无具体选择为“全部车系”，支持不限数量多选；筛选器位于销售区“销售总览”应用级标题行右侧、两组指标框上方且不属于任何单框；严格复用一期单店的品牌全量枚举和排序，URL 使用重复 `vehicleSeries` 稳定序列化并兼容历史单值别名。v1.93 起，选中集合必须联动销售漏斗、顶部过程指标 4 卡、销售表现、过程分析 9 项、销售/过程导出、查看所有经销商过程表现、动态诊断过程数据、订单/零售目标与达成、排名/占比、打铁 11 项、刷新、埋点和缓存；销售链路使用 `汇报车系名称`，过程与打铁链路使用各来源已审计物理车系字段和销售闭集映射 |
| SCOPE-022 | 三项试驾问题率单店同口径锁定 | P0 | PC 过程分析和移动端过程展开态中的 `版本未推荐率`、`顾虑跳过率`、`竞品回避及贬低率` 必须以一期单店为唯一口径源，按同一试驾标签字段、实时直连字段、去重规则、SQL/降级路径和错误状态计算 |
| SCOPE-023 | 过程标签定向聚合与独立错误状态 | P0 | 过程分析的邀约四项和试驾三项分别按 kind 定向聚合、独立完整性门禁和独立错误展示；默认全域日期下不得因一类标签触达 `5000` 或失败导致另一类成功结果被清空 |
| SCOPE-024 | PC 订单/零售目标与达成 | P0 | 在不改变既有订单、零售、排名、占比主口径的前提下，订单目标与零售目标拆源只读接入；v1.88 起订单目标读取 `u32cb7e789f7443ff84160b4` 打铁最终目标输出并按 `u32` 自带组织代码/名称守恒汇总，零售目标仍读取 `r05b1e3995b0b4480991a4b8` 且继续按 validDealerMap 旧规则展示，PC 标题行目标摘要同时展示订单目标/订单达成与零售目标/零售达成，订单表现和零售表现均展示月目标、目标达成，目标口径实际分别按自然月+MG+一级经销商代码+汇报车系独立聚合订单和零售，并随车系多选集合精确联动 |
| SCOPE-025 | 打铁看板邀约/试驾运营指标 | P0 | 在现有表现区 tablist 中于“过程分析”右侧新增第三个 Tab“打铁指标”，Tab 内采用二级切换 `邀约指标 7 / 试驾指标 4`，默认激活邀约组且同一时间只展示一组；二级 Tab 右侧提供固定外部链接“打铁运营看板”，目标为 `https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845`；v1.80 起在其右侧新增同级固定外链“优质试驾看板”，目标为 `https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa`，两个外链共存且顺序固定为 `打铁运营看板 → 优质试驾看板`；当前期、上月同期、上周同期均严格继承上游 `startDate/endDate`、`regionCode/districtCode/dealerCode`、车系多选集合和罗盘行权限；DCC 4 项使用官方打铁看板业务过滤后的全部 DCC 门店范围和 DCC 自身组织字段，不与 `validDealers` 求交；非 DCC 打铁来源继续当前有效经销商白名单合同；前端只消费服务端 SQL 聚合结果，禁止 preview 明细/分页 fallback；每个指标单元格按“当前值 + 月环比 + 周环比”展示，DOM 与样式语义必须与“过程分析”表格一致；目标值只在表头按“指标名称在上、目标 xx% 在下”提示口径，不生成状态颜色、圆点、达标标签或识别状态；不替换现有邀约四项/试驾三项问题率 |
| SCOPE-026 | PC 当前范围全部经销商扁平查看 | P0 | 在表现区 header 工具区、导出按钮左侧新增“查看所有经销商 / 返回分层查看”可逆入口；作用于销售概览、过程分析和打铁指标，且仅在真实非 `store` 层、当前有效经销商集合大于 1、无全局加载/空/错误/无权限、对应 Tab 无局部错误时显示；激活后以当前上游筛选和当前 `drillPath` 为范围，把下方清单派生为经销商层；进入时保存组织、销售/过程/打铁页码和选中门店快照，扁平态隐藏并冻结面包屑返回，退出时恢复快照；不改变顶部指标、不扩大权限、不新增数据集、不改变打铁 11 项口径 |
| SCOPE-027 | PC 销售总览标题行目标摘要与时间进度 | P0 | 目标摘要位于“销售总览”标题行左侧标题组，紧接标题展示；右侧车系筛选保持最右。摘要按订单目标、订单达成、零售目标、零售达成、时间进度固定顺序纯文字展示，目标蓝、达成绿、时间灰蓝；v1.91 覆盖 v1.82 标题行中间布局，但不改变其显示/隐藏/失败降级和时间进度口径 |
| SCOPE-028 | PC MG 07 小订战报独立模块 | P0 | 在 `multi-store-super-app/` PC 顶部新增独立 `MG 07小订战报`；固定小订期 `2026-07-29`～`2026-08-22`，摘要常驻，`小订达成表现`按需展开；目标源通过 `mg07SmallOrderTargetDsId=h8ae7b66fd5d141ec95bd246` 运行时配置读取新观远目标数据集 `MG07小订目标_20260727`，404 行中仅 403 行经销商配置入数、1 行总计空代码运行时排除；实际源固定销售事实 `k4c14c31c595540a0a771f50` 的 MG 07 小订字段；战报继承观远用户组织权限但拥有独立下钻状态，不跟随销售日期、车系筛选、销售/过程/打铁下钻或导出 |

### 2.2 不在本版本范围

| 编号 | 内容 | 原因 |
|---|---|---|
| OUT-002 | 实时重新诊断 | 沿用一期边界，前端不实时触发官方诊断 |
| OUT-003 | 整改任务写回 | 会引入任务流、责任人、状态流转，超过 P0 |
| OUT-004 | 区域经理点评/AI 话术 | 首版先把区域漏斗、过程追踪和问题门店排准，解释增强后置 |
| OUT-005 | 到店试驾环节追踪和到店接待证据下钻 | 当前没有到店接待过程数据去追踪门店、顾问表现；到店试驾率仅作为销售漏斗转化率展示，不进入追踪方向或证据下钻 |
| OUT-006 | 在区域页内展开完整单店详情 | 单店证据继续复用一期单店诊断页，避免区域页变成混杂长页面 |
| OUT-007 | 子应用自建大平台顶部导航和全局筛选区 | 父应用已有统一导航和筛选，子应用重复实现会造成体验和口径冲突 |
| OUT-008 | 子应用自建“切换黑夜模式”和“保存长图”菜单 | 主题由父应用参数控制；PC 入口只响应父应用截图请求，移动端入口不提供也不响应导出 |
| OUT-009 | 子应用内嵌 Aily 智能体入口 | 智能体属于父应用全局能力，首版子应用不重复挂载右下角助手 |
| OUT-010 | 区域级“重点追踪方向/负向问题波动最大门店”独立模块 | 当前页面先不放该模块，避免在区域总览和门店列表之间增加额外判断层 |
| OUT-011 | 页面内旧过程指标、趋势浮层、深度分析、问题分布、AI 总结、电话邀约/试驾接待切换 | 最新重做版只保留销售漏斗模块和门店销售表现；线索到店率、到店试驾率、试驾订单率、线索订单率只作为销售漏斗模块内的过程指标卡片展示，不恢复旧过程分析模块 |
| OUT-012 | 更新旧多店 App `x944c089c3c4249ea925fde6` | 本次必须新建 Super APP 发布，旧应用只作为历史版本保留 |
| OUT-013 | 用移动端布局替换或改造现有 PC 页面 | 移动端是独立入口，现有 PC 页面和 URL 必须保持不变 |
| OUT-014 | 移动端子应用内的标题栏、返回按钮、上游导航、筛选器或筛选摘要 | 这些区域由上游移动端应用负责；子应用只消费 URL 参数并展示业务内容 |
| OUT-015 | 移动端导出、无限滚动和设备判断 | 移动端首版不提供导出，不做无限滚动；设备识别和入口选择由上游应用负责 |
| OUT-016 | 本轮移动端角色分层与组织下钻改造 | 本轮只完成 PC 调整和验收，既有移动端需求及后续计划保持不变 |
| OUT-017 | 目标数据集写回、补授权或目标配置维护 | 本轮仅只读消费已给定目标数据集；无权限或业务码失败按页面降级处理，不在子应用内补授权或维护目标 |
| OUT-018 | 把历史单店试驾 9 项整体并入打铁运营指标 | 当前打铁指标应用范围只有优质试驾率、试驾录音回收率、手车互联开口率、离车泊入开口率；NPS、有效录音数、质检完成数/率等不属于本轮 11 项 |
| OUT-019 | 将“查看所有经销商”放入 sticky 操作列表头 | 操作列宽度仅约 6%-8% 且语义是行级操作，完整模式按钮会挤压表格、破坏 sticky 表头稳定性并混淆列操作语义；入口固定放在表现区 header 工具区 |
| OUT-020 | 借 DCC 范围改造同步改 UI、目标、环比周期、导出入口、车系 fail-closed、销售/过程/IP/意向/试驾来源范围或其他公式 | 本轮只修 DCC 来源 4 项的门店范围和组织归属合同；其他来源继续当前已验收合同，避免同源指标集合外的回归 |
| OUT-021 | 将 MG 07 小订战报并入销售总览目标摘要、销售概览表、过程分析、打铁指标、销售导出、截图协议或移动端 | 小订期是独立经营窗口，必须保持独立筛选、独立下钻和独立状态，避免污染既有销售/过程/打铁模块 |
| OUT-022 | 在子应用内维护 MG 07 小订目标数据集、补授权、写入目标、伪造目标 `dsId` 或用 Excel `区域/MAC` 反向扩权 | 目标上传、真实 `dsId`、权限配置属于外部前置；页面只读消费配置，配置或权限不可证时降级，不补权、不扩权、不写假 ID |
| OUT-023 | 展示 MG 07 小订转大定、开放小订日期筛选、复用销售车系筛选或新增父应用筛选器 | 本轮只展示小订目标与累计小订达成；转大定隐藏，固定期不可被用户改写 |

## 3. 用户任务

| 编号 | 用户任务 | 用户类型 | 优先级 |
|---|---|---|---|
| TASK-001 | 用户查看当前区域销售结果指标与过程指标 | 区域/小区经理 | P0 |
| TASK-002 | 用户查看门店销售表现、主问题和结果断点 | 区域/小区经理 | P0 |
| TASK-003 | 用户在大平台统一筛选和主题下查看零售过程页面 | 大平台使用者 | P0 |
| TASK-004 | 用户通过大平台菜单保存包含零售过程页面的长图 | 大平台使用者 | P0 |
| TASK-007 | 用户在手机上先查看当前核心业务指标，再查看旗下门店销售表现和问题环节 | 区域/小区经理 | P0 |
| TASK-008 | 用户在手机上切换销售/过程表现、翻页、展开门店指标并进入门店详情 | 区域/小区经理 | P0 |
| TASK-009 | 总部用户比较全国大区并逐级下钻到小区和门店 | 总部用户 | P0 |
| TASK-010 | 大区用户比较所属大区内小区并下钻到门店 | 大区用户 | P0 |
| TASK-011 | 小区、销售总监或投资人直接比较当前有效范围内门店 | 小区用户、销售总监、投资人 | P0 |
| TASK-012 | 用户从品牌全量车系中不限数量多选，筛选销售漏斗、顶部过程指标、销售概览、过程分析、销售/过程导出、动态诊断过程数据、打铁指标、订单/零售目标与达成、排名/占比，并能区分真实无样本 `--` 与字段/查询不可证的数据不完整 | 总部、大区、小区、销售总监、投资人 | P0 |
| TASK-013 | 用户在多店过程分析中查看与单店完全一致的三项试驾接待问题率，并能区分 0、无标签样本和数据错误 | 总部、大区、小区、销售总监、投资人 | P0 |
| TASK-014 | 用户在过程分析中分别查看邀约四项和试驾三项，即使其中一类标签数据失败也能保留另一类成功结果 | 总部、大区、小区、销售总监、投资人 | P0 |
| TASK-015 | 用户查看当前筛选范围内订单月目标、零售月目标、对应目标口径实际和目标达成率，并能导出同口径字段 | 总部、大区、小区、销售总监、投资人 | P0 |
| TASK-016 | 用户在“打铁指标”Tab 中按上游日期、区域、车系筛选、权限白名单和组织层级查看 7 项邀约、4 项试驾运营指标的服务端 SQL 聚合当前值、月环比和周环比 | 总部、大区、小区、销售总监、投资人 | P0 |
| TASK-017 | 用户在销售概览、过程分析或打铁指标中，按当前上游范围或当前下钻路径一键查看全部可见经销商，并可返回原分层清单 | 总部、大区、小区、销售总监、投资人 | P0 |
| TASK-018 | 用户在“打铁指标”Tab 查看邀约/试驾指标时，可从二级 Tab 右侧一键打开固定“打铁运营看板”和固定“优质试驾看板”，且当前 Super App 状态保持不变 | 总部、大区、小区、销售总监、投资人 | P0 |
| TASK-019 | 用户在 PC 顶部“销售总览”左侧标题组内同时判断订单/零售目标达成与当月时间进度，并且不影响右侧车系筛选和下方销售/过程指标卡对齐 | 总部、大区、小区、销售总监、投资人 | P0 |
| TASK-020 | 用户在固定小订期内查看 MG 07 小订目标、累计小订、目标达成、时间进度和当前层级落后对象，并可独立下钻定位落后大区、小区或门店 | 总部、大区、小区、销售总监、投资人、单门店用户 | P0 |

## 4. 用户流程

### FLOW-001: 区域销售指标与门店销售表现查看

**关联任务：** TASK-001, TASK-002, TASK-003, TASK-004  
**优先级：** P0  
**目标：** 帮区域经理先判断区域整体销售表现，再查看门店销售表现、主问题名称和结果断点。

**入口：**  
用户在零售智能驾驶仓点击「零售过程」Tab，父应用通过 iframe 打开子应用，并通过 URL Query 传入 `startDate / endDate / brand / brandCode / region / regionCode / district / districtCode / dealer / dealerCode / dealerShortName / theme / previewMode`。

独立打开或父应用参数缺失时，子应用使用容错默认值；日期默认规则沿用一期：昨天所在月份的 1 号至昨天，每月 1 号打开时取上月 1 号至上月最后一天。

**主路径：**
1. 用户在父应用顶部选择日期范围、品牌、大区、小区、门店和主题。
2. 父应用通过 iframe URL Query 把筛选和主题传给子应用。
3. 子应用读取参数，转换为查询上下文和视觉主题。
4. 子应用识别当前登录用户，并按 `smartmind_sale_View` 上报页面访问事件。
5. 页面展示当前筛选范围下的销售漏斗总览：标题行左侧为 `销售总览 + 目标摘要` 同组，右侧为最右车系筛选；下方销售指标框展示订单、交付率、零售，过程指标框展示线索到店率、到店试驾率、试驾订单率、线索订单率。
6. 如果订单/零售目标数据可用且当前有效范围存在有效目标，左侧标题组紧接标题展示订单目标/订单达成、零售目标/零售达成和时间进度；任一目标链路不可用时按同构规则在标题后显示失败文案，不阻断订单、交付率、零售和过程指标。
7. 页面展示区域或当前筛选范围漏斗指标的当前值、月环比和周环比变化。
8. 页面展示门店销售表现表：经销商名称、`销售结果（指标：月环比）`、订单表现、零售表现、主问题名称、结果断点和操作，不展示月份和经销商代码；其中销售结果单元格上层展示 `线索 → 到店 → 试驾 → 订单 → 零售` 五段数量及数量月环比，下层展示 `线索到店率 → 到店试驾率 → 试驾订单率 → 交付率` 四个等宽转化率及百分点月环比。
9. 用户按门店销售表现判断需要辅导的门店。

**分支路径：**
- 到店试驾率在当前销售漏斗模块展示，但不作为问题门店追踪方向或证据下钻入口。
- 如果父应用传入父店 `dealerCode`，销售事实直接用该代码匹配 `一级经销商代码`；本次不识别或归一二网 URL 代码。`dealerCode=全部` 或为空时，销售事实按 `一级经销商代码` 聚合并用 `父经销商简称` 展示。
- 如果父应用切换 `theme=dark` 或 `previewMode=dark`，子应用立即进入黑夜模式。
- 如果父应用发起长图导出，子应用等待数据、图表、字体和图片渲染完成后返回 PNG 截图。

**边界情况：**
- 权限校验明确失败时展示无权限提示；权限校验通过但可见门店数或业务结果为 0 时展示空状态，禁止根据 0 行结果反推无权限。
- 当前日期区间无销售漏斗数据时，区域漏斗和门店列表展示空态。
- 订单/零售目标查询成功但当前有效范围无目标时，页面隐藏“销售经营进度”条，不得单独显示时间进度，不得用 `--`、0 或额外提示解释无目标；表格订单表现和零售表现仍保留同高空槽。
- 订单/零售目标查询失败、无权限或业务码失败时，仅在目标展示位置显示目标数据暂不可用类文案，销售结果主链路继续可用。
- 上月同期无可比数据时，不展示下滑排序依据，提示缺少对比数据。
- 某门店样本过小导致线索订单率波动异常时，订单数下滑用于影响规模校验，避免小样本门店误占最高优先级。
- URL 参数缺失或异常时，子应用使用默认值或空态，不白屏。
- `brand / area / district / store` 值为 `全部` 时，不按该维度过滤。
- 长图截图失败或超时时，子应用向父应用返回明确 `error`，由父应用兜底展示。

**完成状态：**  
用户能在零售智能驾驶仓中看到零售过程页面，页面跟随父应用筛选和主题；用户能看到区域销售指标、过程指标和门店表现 tab；门店销售表现与门店过程表现不同时铺开，而是通过 tab 切换；页面不展示旧过程指标面板、趋势浮层、深度分析、问题分布、AI 总结或电话邀约/试驾接待切换模块；父应用保存长图时能拿到子应用完整页面截图。

### FLOW-003: PC 按角色进入分级清单并下钻

**关联任务：** TASK-009, TASK-010, TASK-011  
**优先级：** P0  
**目标：** 在不改变顶部指标卡范围的前提下，让不同管理角色从正确组织层级进入销售、过程和打铁清单并逐级下钻，或切换为当前范围全部经销商扁平查看。

**入口：**  
PC 子应用读取父应用 URL Query 和 `sessionStorage['retail-cockpit:personnel-profile']`，取当前用户权限与有效经销商白名单交集后确定有效数据范围。

**主路径：**
1. 系统规范化 `marketing_userType` 和 `marketing_orgType`，识别总部、大区、小区、销售总监或投资人；仅 `marketing_userType` 为 `null`、`undefined`、空字符串或纯空白时按总部兜底。
2. 系统继续用当前经销商维表的一网记录确定组织、权限和有效门店白名单；仅销售漏斗事实用 `一级经销商代码` 作为门店筛选/聚合键、用 `父经销商简称` 作为展示名。邀约、试驾、订单明细和标签等过程查询维持现有字段与范围逻辑。
3. 总部默认看大区、大区默认看小区，小区/销售总监/投资人默认看门店；具体大区、小区或门店筛选自动跳过无意义单行层。
4. 用户在销售表现或过程表现点击大区/小区，系统只更新共享 `drillPath` 和下方清单；顶部指标卡仍使用步骤 2 的范围快照。
5. 用户切换 `销售概览 / 过程分析 / 打铁指标` 三个一级 tab 时保持真实 `viewLevel / drillPath`；非扁平态点击面包屑或返回时只回到上一个合法层级，不得越过上游筛选锁定的入口。
6. 当当前真实层级不是门店层、当前有效经销商集合大于 1 且无加载/空/错误/无权限/当前 Tab 局部错误时，用户可在表现区 header 工具区点击“查看所有经销商”；系统保存进入前 `organization.viewLevel / drillPath`、销售/过程/打铁页码、打铁二级组和 `selectedStoreCode` 快照，只派生 `allDealerMode=true` 和 `effectiveLevel=store`，把销售概览/过程分析/打铁指标的当前路径范围扁平为全部可见经销商。
7. 扁平模式激活后，用户切换销售概览/过程分析/打铁指标均不丢失扁平状态；三张 tab 扁平态隐藏面包屑返回按钮且返回事件不生效，真实 `organization.viewLevel / drillPath` 不被扁平态交互改写；点击“返回分层查看”恢复快照中的真实层级、路径、销售/过程/打铁页码和 `selectedStoreCode`。打铁扁平态仍只展示当前激活的 `邀约指标 7 / 试驾指标 4` 二级组，二级组切换不得清空扁平模式、页码或当前范围。
8. 用户在门店层点击“门店详情”，继续使用 REQ-005 的既有跳转。
9. 用户在“打铁指标”Tab 内切换 `邀约指标 7 / 试驾指标 4` 时，只切换当前指标组；非扁平态不改变一级 tab、真实组织层级、下钻路径、分页、行序或范围文案，扁平态不改变 `allDealerMode`、扁平范围、打铁页码或入口文案。

**分支路径：**
- 总部 + 全部大区：大区清单；总部 + 具体大区：小区清单；总部 + 具体小区：门店清单。
- 大区 + 全部小区：小区清单；大区 + 具体小区：门店清单。
- 小区、销售总监、投资人：门店清单；任意已识别角色 + 具体门店：单门店清单。
- 上游筛选变化或 iframe 以新 Query 重载：清空手动 `drillPath`，按新有效范围重新自动跳层。
- 总部 + 全部大区 + 扁平查看：展示全国当前可见经销商；总部从大区层手动下钻进入某大区的小区层（真实 `viewLevel=district`，`drillPath` 仅含该大区）+ 扁平查看：展示该大区当前可见经销商；大区 + 全部小区 + 扁平查看：展示该大区当前可见经销商；真实 `store` 层已是经销商清单，入口隐藏，不再从门店层触发扁平查看。

**边界情况：**
- 人员画像缺失、JSON 非法、非对象画像、`marketing_userType` 的非空未知/非法类型，或 `marketing_userType=4` 的组织类型缺失/非法时显示“角色识别异常”；仅 `marketing_userType` 为 `null`、`undefined`、空字符串或纯空白时默认总部，且不得扩大查询范围。
- 明确无权限、业务 0 行、角色识别异常和请求错误使用不同状态文案。
- 总部数据无法证明覆盖同品牌、同日期的全国完整大区集合时，大区全国排名显示“--/排名不可用”，不得以部分可见大区冒充全国。
- 扁平模式只改变下方清单展示粒度，不触发新的全量数据查询，不扩大罗盘行权限或有效经销商白名单，不改变顶部指标、车系筛选、日期筛选和上游组织筛选。

**完成状态：**  
PC 顶部指标卡不随清单下钻或扁平查看改变；下方三个 tab 在同一层级展示对应大区、小区或门店行，并可沿合法层级下钻、返回或进入门店详情；销售概览、过程分析和打铁指标均可一键查看当前范围全部经销商并返回分层清单；“打铁指标”Tab 内的邀约/试驾二级切换不改变共享下钻状态或扁平查看状态。

### FLOW-002: 移动端零售过程查看

**关联任务：** TASK-007, TASK-008  
**优先级：** P0  
**目标：** 让大区/小区经理在上游移动端应用中先掌握核心业务指标，再逐店查看销售表现和问题环节。

**入口：**  
上游移动端应用判断设备后，以 iframe 打开新的移动端独立入口，并传入与 PC 端一致的 URL Query 参数。移动端入口具体路径待开发阶段确定，子应用不自行识别设备，也不负责在 PC/移动入口之间跳转。

**主路径：**
1. 移动端页面解析上游 URL 参数并加载当前权限范围数据。
2. 首屏直接展示订单、交付率、零售、线索到店率四项核心指标，不展示子应用标题、返回按钮、导航或筛选摘要。
3. 用户点击“展开全部”查看到店试驾率、试驾订单率、线索订单率，再次操作可收起补充指标。
4. 用户进入默认“销售表现”，以门店卡片流查看每家门店的五步漏斗、订单/零售排名与占比、主问题徽标和诊断结论。
5. 当前页首张门店卡默认展开，其余卡片默认收起；用户可展开任一卡片查看完整信息，或收起已展开卡片。
6. 用户可切换到“过程表现”，以门店卡片查看线索到店率、到店试驾率、试驾订单率、线索订单率；展开后仍查看邀约与试驾接待的 9 项问题标签及月环比、周环比。
7. 用户通过上一页、下一页或跳至指定页浏览门店，每页 15 家；点击“门店详情”进入既有单店诊断页。

**边界情况：**
- URL 参数缺失、格式非法或层级冲突时，不得静默查询错误范围；页面展示明确参数错误或采用 PC 端已定义且可追溯的默认规则，不得白屏。
- 权限校验明确失败时展示无权限状态；权限校验通过但可见门店数或业务结果为 0 时展示空状态。禁止用 0 行数据反推无权限，两者文案和后续动作必须不同。
- 第 1 页禁用“上一页”，末页禁用“下一页”；跳页仅接受 `1..总页数` 的整数，非法输入不发起查询并提示有效范围。
- 翻页或切换表现类型时展示局部加载态，不用旧页数据冒充新结果；失败后保留当前上下文并提供重试。

**完成状态：**  
用户不离开上游移动端业务链路即可完成“看核心指标—看门店卡片—看问题环节—进入门店详情”；页面无横向业务表格、无子应用筛选器、无导出入口，且不影响 PC 页面。

### FLOW-004: PC MG 07 小订战报查看与独立下钻

**关联任务：** TASK-020  
**优先级：** P0  
**目标：** 让总部、大区、小区、销售总监、投资人和单门店用户在固定小订期内判断 MG 07 小订进度，并独立定位落后组织或门店。

**入口：**  
PC 子应用完成父应用 URL Query、观远用户身份和组织权限解析后，在销售总览上方或同等首屏业务位置加载 `MG 07小订战报`。该模块读取同一登录身份与组织权限，但不消费父应用销售日期筛选、车系筛选或销售/过程/打铁下钻状态。

**主路径：**
1. 系统读取运行时配置 `mg07SmallOrderTargetDsId=h8ae7b66fd5d141ec95bd246`；配置为空、数据集无权限、字段缺失或目标审计失败时，战报进入目标不可用降级，销售/过程/打铁主链路继续加载。
2. 系统按固定小订期 `2026-07-29` 至 `2026-08-22` 判断 `小订即将开始 / 小订进行中 / 小订已结束`，累计统计截止日为 `min(运行日, 2026-08-22)`。
3. 系统读取目标表 `MG07小订目标_20260727`，数据集为 404 行 / 8 列；运行时排除 1 行总计空代码，只保留 403 行经销商配置，并校验 403 家唯一一级经销商、目标总计 30001、零目标 17 家、403 个唯一代码、7 大区、补码 `MQ856G/MQ877K`。
4. 系统读取销售事实源 `k4c14c31c595540a0a771f50`，固定过滤 `品牌名称=MG`、`汇报车系名称=MG 07`、`日yyyy-mm-dd` 闭区间，按 `一级经销商代码` 汇总 `当日首触小订数`、`当日首触留存小订数`、`当日首触小订退订数` 和最大 `调度时间`。
5. 系统通过现有组织接口或字段审计锁定的权威组织范围，将目标 `一级经销商` 和实际 `一级经销商代码` 映射到当前用户可见大区、小区、门店；目标表 `区域/MAC` 只进入展示或审计，不参与权限、汇总或下钻。
6. 页面摘要固定显示 `小订目标`、`累计小订`、`目标达成`、`时间进度`，第五动态位按当前战报层级显示 `落后大区`、`落后小区`、`落后门店` 或单门店 `自身进度状态`。
7. 用户点击展开入口后显示 `小订达成表现`，仅展示当前层级对象，按 `gap_to_expected` 降序、同值按组织代码升序；展开状态只保存在当前浏览会话，重新进入页面默认收起。
8. 用户在战报内按大区 -> 小区 -> 门店独立下钻或返回；该操作不改变销售概览、过程分析、打铁指标、当前范围全部经销商、分页、导出或门店详情跳转。

**边界情况：**
- 运行日早于 `2026-07-29` 时累计小订按 0 展示，时间进度为 `0.0%`；运行日晚于 `2026-08-22` 时保留最终战报，时间进度为 `100.0%`，不得自动隐藏。
- 目标配置缺失、目标源失败、实际源失败、权限失败、字段缺失、完整性不可证、当前范围空数据必须使用不同状态文案；不得用 0、旧缓存、订单数、留资数或其他 MG 07 指标冒充小订。
- `zero_target_actual`、`unconfigured_actual`、`organization_unmapped` 必须进入审计；`organization_unmapped` 对应目标和实际均不得进入页面、目标汇总、达成分母或下钻。
- 单门店用户只显示自身进度状态，不展示跨门店下钻按钮。

**完成状态：**  
用户可以在不改变其他模块筛选和下钻的情况下，查看当前权限范围内 MG 07 小订目标、累计、达成、时间进度、落后对象数量和展开后的当前层级达成列表；配置或数据不可用时战报安全降级，主链路不受影响。

## 5. 功能需求

### REQ-001: 区域销售漏斗总览

**优先级：** P0  
**关联任务：** TASK-001  
**关联流程：** FLOW-001  

**用途：**  
让区域经理先看到自己分管区域的整体销售盘子，而不是直接进入门店列表。

**行为：**  
系统按当前区域/小区和日期区间聚合展示销售漏斗指标，并展示与上月同期、上周同期的变化。

**规则：**
- MUST 将销售漏斗模块拆成两个视觉框，且两个框样式保持当前应用的玻璃态卡片视觉。
- MUST 销售指标框展示 `订单`、`交付率`、`零售`。
- MUST 销售指标框和过程指标框在桌面端保持同一行展示，左右框宽度按 3:4 分配，使 3 张销售指标卡与 4 张过程指标卡视觉宽度一致。
- MUST 两个视觉框内的所有指标卡保持同一行、等宽、等高；窄屏空间不足时才允许响应式换行。
- MUST 页面指标卡的尺寸、圆角、字号、字重、间距和阴影配置对齐一期单店前端指标卡最终覆盖：紧凑白底卡片、约 118px 高、18px 圆角、12px 标签、29px 主数值、12px 环比文字。
- MUST `订单` 来自销售漏斗数据集字段 `当日订单数（首触）/today_fst_touch_order_cnt` 聚合。
- MUST `零售` 来自同一销售漏斗数据集字段 `当日零售数/today_sale_cnt` 聚合。
- MUST `交付率 = 零售 / 订单`，按当前筛选范围原始分子分母重算。
- MUST 过程指标框按顺序展示 `线索到店率`、`到店试驾率`、`试驾订单率`、`线索订单率`。
- MUST 线索到店率按到店 / 下发线索、到店试驾率按试驾 / 到店、试驾订单率按订单 / 试驾、线索订单率按订单 / 下发线索计算，均展示当前值、月环比、周环比。
- MUST v1.93 起顶部过程指标 4 卡必须从已选车系后的销售事实 `state.data` 读取当前、上月同期、上周同期三阶段分子分母并重算；不得再用清空车系或无车系组织骨架的 `processBaselineData` 计算这些卡片。
- MUST 每个指标展示当前值、月环比、周环比。
- MUST 周环比按当前日期区间整体前移 7 天取同期数据计算。
- MUST 优先使用父应用传入的 `period` 推导日期范围；参数缺失时才使用一期日期默认规则。
- MUST 继承观远行权限，只聚合当前用户有权限的门店。
- MUST 保留经销商维表现有一网白名单、组织归属和权限交集逻辑，不为本次销售改造新增父子关系建图、成员集合或关系预检。
- MUST 在销售漏斗数据集 `k4c14c31c595540a0a771f50` 中以 `一级经销商代码/fst_dealer_code` 作为门店非空判断、具体门店筛选和聚合键，以 `父经销商简称/parent_dealer_shortname` 作为门店展示名。
- MUST 将销售聚合结果继续输出为下游现有 `经销商代码`、`经销商名称` 字段：前者承载一级经销商代码，后者承载父经销商简称；`app.js`、`metrics.js` 和页面组件不得为本次需求增加第二套字段协议。
- MUST 当前、上月同期、上周同期使用相同的销售字段映射；销售 SQL 路径与明细分页降级路径必须输出相同的下游字段结构和聚合结果。
- MUST 保持销售事实的品牌、大区、小区和日期过滤规则为回退基线现状；本次只替换销售事实的门店筛选键、分组键和门店展示字段。
- MUST 将销售事实按 `一级经销商代码` 聚合后的结果与当前有效一网白名单取交集作为最终统计范围；不满足现有有效一网白名单条件的一级代码不展示、不参与顶部指标或销售行合计，也不阻断实施。
- MUST 保证进入有效一网白名单的每个销售 `一级经销商代码` 只匹配一条维表一网记录、同码不存在多个非空 `父经销商简称`，且销售 `父经销商简称` 与维表一网 `经销商简称` 完全一致；白名单内出现多匹配、多父简称或名称不一致时停止实施并输出差异清单，不得临时扩展为父子关系层。
- MUST 保证顶部销售数量指标等于当前页面销售清单行的合计；交付率、线索到店率、到店试驾率、试驾订单率、线索订单率继续使用聚合后的原始分子分母重算。
- MUST NOT 修改 DCC、试驾/订单明细、邀约、IP/试驾标签的查询字段、SQL/预览筛选及负向过程指标；销售派生的 `线索到店率`、`到店试驾率`、`试驾订单率`、`线索订单率` 必须随新的一级经销商销售聚合口径重算。
- MUST 顶部指标卡的数据范围固定为当前上游 URL 筛选、罗盘数据权限和有效经销商白名单的交集；大区/小区清单下钻不得修改该范围或触发顶部按 `drillPath` 重算。
- MUST 上游筛选变化时按新的有效范围重算顶部指标卡；销售/过程/打铁 tab 切换、清单下钻、返回和分页不得改变顶部指标卡值。
- MUST NOT 用区域页前端结果代表跨组织官方排名。
- MUST NOT 在多店漏斗指标卡展示小区排名、全国排名或任何排名占位文案；多店漏斗只展示当前值、月环比、周环比。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| 大区 | string | No | 来自当前用户权限范围 |
| 小区 | string | No | 来自当前用户权限范围 |
| 品牌 | string | No | 来自父应用 `brand`，`全部` 表示不过滤 |
| 门店 | string | No | 来自父应用 `store`，`全部` 表示不过滤 |
| 日期范围枚举 | string | No | 来自父应用 `period` |
| 日期开始 | date | Yes | 不晚于日期结束 |
| 日期结束 | date | Yes | 不早于日期开始；是否包含今天由 `period` 映射口径决定 |

**输出 / 结果：**
- 区域销售漏斗指标卡：销售指标框 3 张卡、过程指标框 4 张卡；桌面端 7 张指标卡处于同一视觉行，卡片尺寸一致。
- 区域漏斗各指标的月环比、周环比变化。

**状态：**
- 默认：展示当前用户默认权限范围和默认日期区间。
- 加载：漏斗区域显示加载占位。
- 空状态：提示当前区域/日期区间暂无销售漏斗数据。
- 错误：提示销售漏斗数据读取失败，可重试。
- 成功：展示完整区域销售漏斗，两个视觉框均可见。

**验收标准：**
- [ ] AC-001: Given 用户有区域数据权限, when 进入页面, then 能看到销售指标框中的订单、交付率、零售，以及过程指标框按线索到店率、到店试驾率、试驾订单率、线索订单率顺序展示的四张卡；四张均使用 `%` 图标和正向率语义。
- [ ] AC-002: Given 当前区间、上月同期和上周同期均有数据, when 漏斗加载完成, then 每个指标能展示当前值、月环比和周环比。
- [ ] AC-003: Given 当前区域无销售数据, when 页面加载完成, then 漏斗区域展示空态而不是 0 值误导。
- [ ] AC-041: Given 桌面端页面加载完成, when 用户查看顶部销售漏斗模块, then 销售指标 3 张卡和过程指标 4 张卡均在一行内展示，且所有指标卡尺寸一致。
- [ ] AC-026: Given 多店漏斗加载完成, when 用户查看漏斗指标卡, then 卡片中不出现小区排名、全国排名或“当前范围汇总”等排名位占位文案。
- [ ] AC-030: Given 销售数据加载完成, when 页面计算交付率, then 使用同一销售漏斗数据集中的零售/订单原始聚合值计算。
- [ ] AC-031: Given 销售数据加载完成, when 页面展示过程指标, then 使用销售原始分子分母展示线索到店率、到店试驾率、试驾订单率、线索订单率；过程标签加载、电话邀约/试驾接待过程分析面板均不得影响顶部四张转化率卡。
- [ ] AC-055: Given 顶部指标卡已按上游筛选范围加载, when 用户从大区下钻到小区再下钻到门店或在两个 tab 间切换, then 7 张指标卡的值、月环比和周环比均保持不变。
- [ ] AC-056: Given 父应用以新的品牌/大区/小区/门店/日期 Query 重载子应用, when 新数据加载完成, then 顶部指标卡和下方清单均使用新有效范围，旧 `drillPath` 不再生效。

#### 销售漏斗父经销商字段最小改造（已实施并发布到测试 App）

本组 AC-080～AC-087 取代已撤回的 AC-068～AC-079，且只约束销售漏斗事实。实现仅调整 `multi-store-super-app/data-api.js` 的销售字段映射与降级归一；页面仍消费既有 `经销商代码/经销商名称` 结构，不新增关系模块、UI 或过程数据改造。2026-07-16 已通过独立 Code Review 和最终 QA，P0/P1/P2 均为 `0`；北京时间 18:01:40 已发布到测试 App `q0844640cf6734877a3193d6`，版本 `0.1.0`，未 commit 或 push。

- [x] AC-080: Given 同一父店下销售事实分别为父店 `10/8`、二网 `3/2` 和 `2/1`，且三者 `一级经销商代码` 相同, when 销售聚合完成, then 只输出一条以该一级经销商代码为 `经销商代码`、以 `父经销商简称` 为 `经销商名称` 的销售行，订单/零售为 `15/11`。
- [x] AC-081: Given 父应用传入具体父店 `dealerCode`, when 构造销售 SQL 和销售明细降级筛选, then 两条路径均过滤 `一级经销商代码`，不得过滤销售事实原始 `经销商代码`。
- [x] AC-082: Given 用户选择品牌、大区、小区或日期且该范围同时存在白名单内、白名单外销售一级代码, when 页面加载, then 既有组织和日期条件保持生效，白名单外代码由既有 `metrics.js` 过滤且不阻断，顶部销售数量等于过滤后的页面销售行合计。
- [x] AC-083: Given 当前、上月同期和上周同期均有销售事实, when 合并查询完成, then 三个阶段全部按 `一级经销商代码` 聚合、按 `父经销商简称` 命名，环比比较对象一致。
- [x] AC-084: Given 销售聚合 SQL 失败并进入明细分页降级, when 明细返回, then 降级结果先归一为既有 `经销商代码/经销商名称` 结构后再进入 `metrics.js`，最终值与 SQL 聚合路径一致。
- [x] AC-085: Given 销售一级经销商代码不满足现有有效一网白名单条件, when `buildWorkbench` 执行, then 该代码被排除、不展示且不参与顶部或销售行合计，不阻断实施；Given 代码进入有效一网白名单, then 必须唯一匹配一条维表一网记录、同码只有一个非空父简称，且销售 `父经销商简称` 与该维表行 `经销商简称` 完全一致，否则停止实施并输出差异清单，不新增临时映射或父子关系层。
- [x] AC-086: Given 最小改造完成, when 审查代码差异, then 业务源码仅需修改 `data-api.js`，`filter-api.js`、`metrics.js`、`app.js`、页面结构和交互保持不变；如必须修改任一非销售链路文件则停止并重新确认范围。
- [x] AC-087: Given 最小改造完成, when 执行过程指标回归, then DCC、试驾/订单明细、邀约、IP/试驾标签的查询字段、SQL/预览筛选及其负向过程指标保持回退基线；`线索到店率`、`到店试驾率`、`试驾订单率`、`线索订单率` 因分子分母来自销售聚合，必须按新的一级经销商口径重算并允许结果变化。

### REQ-002: PC 分级组织表现表

**优先级：** P0  
**关联任务：** TASK-002  
**关联流程：** FLOW-001  

**用途：**  
让总部、大区、小区及安全降级角色在销售指标之后，从正确层级查看同级组织或门店的销售/过程表现、主问题名称和结果断点。

**行为：**  
系统在销售漏斗下方展示一个组织表现区，区内提供“销售概览”“过程分析”“打铁指标”三个 tab，顺序固定为 `销售概览 → 过程分析 → 打铁指标`，分别承载销售表现表、过程表现表和打铁运营指标表。当前行对象可为大区、小区或门店；三张表共用真实 `viewLevel / drillPath`、组织范围文案和行序。销售概览字段保持“组织名称、销售结果（指标：月环比）、订单表现、零售表现、主问题名称、结果断点、操作”，首列和操作文案随层级变化；门店层不展示月份和经销商代码。`销售结果（指标：月环比）` 单元格上层展示 `线索 → 到店 → 试驾 → 订单 → 零售` 五段数量及数量月环比，下层展示 `线索到店率 → 到店试驾率 → 试驾订单率 → 交付率` 四个等宽转化率及百分点月环比。打铁指标字段保持 7 项邀约与 4 项试驾，每个指标单元格展示当前值、月环比和周环比，趋势行 DOM / 样式与过程分析一致。销售概览、过程分析和打铁指标共享一个 `allDealerMode` 扁平查看模式：用户可在当前真实非门店层、有效经销商集合大于 1 且当前 Tab 无阻断错误态时一键查看当前范围全部可见经销商；激活时保存组织、销售/过程/打铁页码和选中门店快照，冻结表现区面包屑返回并可恢复快照；打铁指标扁平态继续使用既有 `ironStores` / 无车系 `processBaselineData` 组织骨架派生经销商行，不改变 11 项取数口径。

**规则：**
- MUST 位于销售漏斗模块下方。
- MUST 展示当前有效数据范围内、符合当前 `viewLevel / drillPath` 的大区、小区或门店。
- MUST 当前清单展示大区时，提取大区名称开头的连续数字并按数值升序排列；无数字前缀的大区排在有数字前缀的大区之后，同类按大区代码稳定升序。
- MUST 当前清单展示小区或经销商时，按当前日期筛选范围聚合后的 `current.orders` 降序排列；订单数相同时分别按小区代码、经销商代码稳定升序。
- MUST “销售概览”“过程分析”“打铁指标”三个 tab 在相同 `viewLevel / drillPath` 和筛选范围下使用同一组织排序结果，切换 tab 不得改变行序，不得触发上游品牌/大区/小区/门店/日期筛选变化。
- MUST 在表现区 header 工具区新增“查看所有经销商 / 返回分层查看”可逆入口，位置固定在当前 tab 对应工具区的导出按钮左侧；不得放入 sticky 操作列表头。原因是操作列只服务行级动作且宽度约 6%-8%，完整文字按钮会造成列头拥挤、横向挤压、sticky 表头不稳定和语义混乱。
- MUST 该入口在 PC 的“销售概览”“过程分析”“打铁指标”Tab 中按当前激活 Tab 显示；显示条件为当前真实 `organization.viewLevel !== 'store'`、当前有效经销商集合 `> 1`、无全局加载/空/错误/无权限且当前 Tab 无局部错误。当前真实层级已为 `store`、单门店范围、当前有效集合 `<= 1`、过程局部错误、打铁局部错误、全局加载/空/错误/无权限时隐藏。若 `allDealerMode=true`，即使真实范围后续收窄到单门店，也必须保留“返回分层查看”入口用于退出。
- MUST 销售概览、过程分析和打铁指标共用同一个 `allDealerMode` 状态；用户在任一 Tab 激活后切到另一个 Tab 时继续展示当前范围全部经销商，切回时状态不丢失。
- MUST `allDealerMode` 不直接改写 `organization.viewLevel` 或 `organization.drillPath`；激活时保存进入前 `organization.viewLevel/drillPath`、销售/过程/打铁页码和 `selectedStoreCode` 快照，派生 `effectiveLevel=store`，并继续使用当前 `drillPath` 过滤数据。三张 Tab 扁平态必须冻结真实组织状态，隐藏面包屑返回按钮且返回事件不生效；关闭时恢复快照中的 `viewLevel / drillPath`、范围文案、返回按钮、销售/过程/打铁页码和 `selectedStoreCode`。
- MUST 扁平查看范围等于“当前上游 URL 筛选 ∩ 罗盘行权限 ∩ 有效经销商白名单 ∩ 当前手动 `drillPath`”。总部全域激活时展示全国全部可见经销商；总部从大区层手动下钻进入某大区的小区层（真实 `viewLevel=district`，`drillPath` 仅含该大区）时展示该大区当前可见经销商；大区范围激活时展示该大区全部可见经销商；真实 `store` 层隐藏入口，不从门店层触发扁平查看。
- MUST 扁平模式只改变下方清单展示粒度，不改变顶部指标卡、品牌、车系、日期、大区、小区、门店筛选，不扩大权限，不绕过有效经销商白名单，不触发新的全量数据查询。打铁扁平态不得改变 11 项公式、目标、SQL-only、来源状态、车系字段 fail-closed 或 DCC 新表口径。
- MUST 扁平模式下销售概览标题为“全部经销商销售表现”，过程分析标题为“全部经销商过程表现”，打铁指标标题为“全部经销商打铁表现”；组织范围文案继续展示当前真实范围，不追加门店名称或角色文案。
- MUST 扁平模式下首列为“经销商名称”，操作列仅保留“门店详情”；不得再出现“查看小区”或“查看门店”。
- MUST 扁平模式下订单排名、零售排名、订单占比、零售占比在当前扁平经销商集合内统一比较和计算，不按经销商所属小区拆分；排名采用稳定唯一排名，主指标降序、同值按经销商代码升序拆分为连续名次。本条为当前范围全部经销商需求的销售排名口径合同，打铁指标不新增排名/占比。
- MUST 扁平模式继续沿用每页 15 家分页；进入扁平模式时销售/过程/打铁当前页从第 1 页开始，分页总数按当前扁平经销商总数计算；进入前销售/过程/打铁页码必须写入快照，退出时恢复；切换一级 Tab 不改变 `allDealerMode`，但各 Tab 可沿用现有各自页码状态。
- MUST 扁平模式下销售导出、过程导出和打铁导出均导出当前扁平范围内全部经销商行，而不是仅当前 15 家页面分页；导出字段沿用对应 Tab 现有字段。打铁导出只包含当前激活的邀约或试驾二级组及其当前值、月环比、周环比和来源完整性字段，不新增第二个导出入口。
- MUST 上游品牌、日期、大区、小区、经销商、车系或 iframe Query 变化时清空 `allDealerMode`，回到角色/上游筛选决定的默认分层入口；仅一级 Tab 切换或打铁二级组切换不得清空该模式。
- MUST “打铁指标”Tab 读取 `allDealerMode` 派生层级；扁平态使用真实 `viewLevel/drillPath` 的范围约束和既有 `ironStores` / 无车系 `processBaselineData` 组织骨架构建经销商行。打铁扁平态禁止大区/小区组织下钻和面包屑返回，只保留门店行“门店详情”；关闭扁平模式后恢复真实层级、打铁页码、二级组和范围文案。
- MUST 只输出父经销商门店行；二网不得成为独立门店行、筛选项、排名对象、详情入口、导出记录或埋点对象，页面也不得展示“含 N 家二网”等提示。
- MUST 月环比使用当前日期区间 vs 上月同期计算。
- MUST 订单排名按当前对象层级动态计算：大区在同品牌、同日期全国完整大区集合内排名；小区在所属大区内排名；非投资人门店层在所属小区内排名；投资人 `marketing_userType=6` 门店层按该投资人名下经过当前品牌、日期、车系、上游组织筛选、罗盘行权限和有效经销商白名单过滤后的当前有效门店集合统一排名，不按 `districtCode` 或所属小区拆分；上游具体 `dealerCode/store` 只保留 1 家时显示 `1/1`，不得由诊断结果或补数扩大到小区；不读取官方月度排名作为本清单展示排名。
- MUST 订单占比分母随层级变化：大区/全国同品牌订单总量、小区/所属大区订单总量、非投资人门店/所属小区订单总量；投资人门店层分母为上述当前有效门店集合的订单合计。百分比保留整数。
- MUST 零售展示销售漏斗数据集中的当前零售和月环比。
- MUST 零售排名和占比使用与订单相同的层级比较范围，分别以聚合后的零售数降序排名并除以对应层级零售总量；投资人门店层零售占比分母为上述当前有效门店集合的零售合计。
- MUST 排名采用稳定唯一排名：先按主指标降序，再按当前层级组织代码升序拆分同值行，连续输出 `1/n ... n/n`；不得展示并列名次、同值说明、组织代码或末位人数。无有效比较集合或全国完整性不可证明时显示“--”。
- MUST 大区、小区行先汇总其下属门店的原始线索、到店、试驾、订单、零售和过程指标分子分母，再重算转化率、负向占比与环比，不得平均门店百分比。
- MUST 销售概览表第二列标题为 `销售结果（指标：月环比）`，单元格必须使用双层结构；上层为主信息，保留五段数量漏斗 `线索 → 到店 → 试驾 → 订单 → 零售` 及各自数量月环比，不删除、不改名、不移动到其他列。
- MUST 销售概览销售结果单元格下层为辅助信息，按顺序展示四个等宽转化率：`线索到店率=到店/线索`、`到店试驾率=试驾/到店`、`试驾订单率=订单/试驾`、`交付率=零售/订单`；表内第四率必须是交付率，不得替换为顶部过程卡使用的 `线索订单率=订单/线索`。
- MUST 四个行内转化率的月环比按百分点差计算，即 `当前行当前期率 - 当前行上月同期率`；展示沿用既有正负趋势符号、文字和颜色语义，不得按同期值作分母计算相对涨跌率。
- MUST 行内四率只使用当前销售概览行的 `row.current` 与 `row.previous` 原始分子/分母计算；大区、小区、全部经销商扁平视图和投资人门店集合均先按当前行粒度聚合原始 `线索/到店/试驾/订单/零售`，再计算四率和百分点月环比，不得平均门店率或复用顶部卡已格式化值。
- MUST 行内四率严格继承当前销售概览行粒度、`viewLevel / drillPath`、`allDealerMode`、投资人有效门店集合、罗盘行权限、有效经销商白名单、日期范围、品牌和车系多选筛选；销售概览行内四率使用销售事实字段 `汇报车系名称` 后的原始分子/分母。过程分析与打铁指标另按各自来源已审计物理车系字段过滤，不得借用本条回退为全部车系。
- MUST 行内四率空值和错误语义与现有销售指标一致：分母有效且分子为 0 时显示 `0.0%`；分母为 0 或上月同期分母为 0 时对应当前值或月环比显示 `--`；当前销售主链路加载、错误、无权限、完整性不可证或业务码失败时复用整张销售概览表既有状态，不在单元格内伪造 0、`--` 或旧值。
- MUST 行内四率均为越高越好的正向率；颜色语义沿用现有销售结果月环比规则，正向改善使用正向色、负向变化使用负向色，并且不得只靠颜色表达涨跌。
- MUST 行内四率不新增交互、悬浮层、展开态、筛选器、表格列、导出字段或第二个导出入口；不得改变顶部销售/过程指标卡、过程分析表、打铁指标、订单表现、零售表现、主问题、结果断点、操作列、数据查询或销售导出字段。
- MUST PC 1280px 与 1440px 浅色/深色主题下，销售结果单元格行高控制在约 108px～120px；下层四率等宽排列，窄宽度可使用短标签但必须提供完整可访问名称；不得造成页面级新增横向溢出，也不得压缩主问题、结果断点或操作列至不可读。
- MUST 三层销售表现表头均将两个排名列展示为 `订单排名`、`零售排名`。
- MUST 首列随层级展示为大区、小区或经销商名称；门店层不展示月份和经销商代码字段。
- MUST 门店销售表现表和门店过程表现表的经销商名称列固定在左侧，横向滚动时仍可见。
- MUST 门店销售表现表和门店过程表现表字体样式保持一致，并参考一期单店顾问表现表：表头 12px、正文 13px，避免使用放大加粗表格字体。
- MUST 门店销售表现表和门店过程表现表的表头高度、正文行高、边框色和选中态对齐一期单店顾问表现表：42px 表头、46px 正文行、#f3f6fb 表头底、#edf2f8 行分割。
- MUST 门店销售表现表的排名和占比单元格只展示数值，不在单元格内重复展示“小区排名”或“小区占比”辅助文字。
- MUST 主问题和结果断点支持大区、小区、门店三级对象，基于当前层级同级对象的低分位、环比和过程指标生成；证据文案分别使用“全国/大区/小区第 X/Y”，不得写死“小区排名”。这些结果属于动态展示诊断，不得标为官方诊断。本次投资人 portfolio 变更只影响订单/零售排名及对应占比，不改变主问题/结果断点动态诊断口径。
- MUST 门店销售表现表不提供展开/收起按钮，不提供全部展开/全部收起按钮，不在门店行下方展示过程指标。
- MUST 门店销售表现和门店过程表现模块标题右侧不展示“X 家门店”计数徽标。
- MUST 顶部和移动过程表现收起态的线索到店率、到店试驾率、试驾订单率、线索订单率来自销售漏斗事实聚合；展开后的邀约和试驾问题率来自现有 IP 电话邀约、试驾接待标签聚合，按问题名匹配。
- MUST 邀约四项按 IP 电话标签一级问题定向聚合，仅输出页面需要的 `零钩子`、`未锁定时间`、`报价承接不足`、`竞品比较转化不足` 四项；试驾三项按试驾接待标签一级问题定向聚合，仅输出 `版本推荐`、`顾虑承接`、`竞品攻防` 三项。两类查询不得返回无用 `problem_child` 组合，不得先拉全量标签组合再在前端过滤。
- MUST 邀约四项和试驾三项都保留一期分子/分母、日期字段、品牌/经销商过滤、去重键和环比口径；多店只把统计范围从单门店扩展为当前有效门店集合，不新增展示口径。
- MUST IP 电话邀约标签和试驾接待标签按 `kind=ip`、`kind=drive` 独立查询、独立缓存、独立完整性证据和独立错误状态；当前、上月同期、上周同期三阶段也必须分别记录 `rowCount / hitLimit / complete / error`。任一 kind 或任一阶段失败，只影响对应 kind 的过程指标，不得清空另一 kind 的成功结果。
- MUST 定向 SQL 聚合结果继续以平台 `limit=5000` 为完整性门禁：只有明确 `rowCount < 5000` 或平台返回可证明完整的聚合结果时才可标记 `complete=true`；`rowCount >= 5000`、分页失败、SQL 失败且 fallback 不完整、历史/实时任一路截断时必须标记数据不完整，不得使用截断结果。
- MUST 邀约四项和试驾三项共用显示状态规则：有有效分母且分子为 0 显示 `0.0%`；真实无有效样本显示 `--`；加载中、截断、完整性不可证或失败显示 `数据不完整`。不得把失败或截断伪装为 `--`，不得把有样本 0 分子伪装为空样本。
- MUST 过程表现 CSV 对 `PROCESS_TABLE_METRIC_LABELS` 现有 9 个指标逐项生成三列，列名固定为 `<指标>(%)`、`<指标>月环比(百分点)`、`<指标>周环比(百分点)`；顺序严格按现有 9 个指标排列，每个指标内部固定为 current→month→week，三列必须紧邻，不得先输出全部当前值再输出全部环比。
- MUST 过程表现 CSV 的 27 个指标数据单元格只输出可统计数值，数值尺度与页面百分比展示一致但不带格式字符：当前值 `10.3%` 输出 `10.3`，月环比 `-4.5%` 输出 `-4.5`，周环比 `+0.1%` 输出 `0.1`；不得输出 `%`、正号 `+`、`月`、`周`、斜杠、空格拼接或其他说明文案。
- MUST 过程表现 CSV 中任一当前值、月环比或周环比不可比、加载失败、数据不完整、范围不可证或无值时，对应单元格输出空字符串；不得输出 `--`、`加载失败`、`数据不完整`、`null`、`undefined` 或 0 作为替代。合法数值 0 必须输出 `0`，不得误清空。
- MUST 过程表现 CSV 不读取页面月环比/周环比开关决定列集合；无论页面开关处于何种状态，导出始终固定包含 9 × 3 个指标列。组织名称仍为首列；v1.93 起具体车系下过程导出必须输出已按同一车系集合过滤后的过程指标，不得再插入“车系筛选仅覆盖销售漏斗及销售表现”类边界说明行。现有导出入口、当前分层/扁平范围全部行、CSV 文件格式与转义/公式注入防护、页面 UI、移动端和发布配置均不变化。
- MUST 多店门店过程分析中的三项试驾问题率只包括 `版本未推荐率`、`顾虑跳过率`、`竞品回避及贬低率`，其口径以一期单店为唯一事实源；多店不得在 `metrics.js`、`data-api.js` 或展示层另起分子、分母、标签映射、正负向判断或空值规则。
- MUST 三项试驾问题率的分母为同一统计单元内满足“同经销商、同品牌、同日期区间、同一级标签，且一级标签和二级标签均非空”的去重 `试驾清单ID` 数；统计单元为门店行时按该门店计算，为大区/小区行时先在其有效门店集合内按相同规则汇总去重，再计算比例，不得平均门店百分比。
- MUST 三项试驾问题率的分子为上述分母集合中“有效判向且 `标签正负向` 为负向”的去重 `试驾清单ID` 数；有效判向和负向枚举以一期单店当前实现为准，当前接受 `是否判定正负向` 为空或明确已判向，排除包含“未判”或“无法”的记录，负向接受 `负向/負向/反向`。
- MUST 同一 `试驾清单ID` 在同一指标内命中多个二级标签时只计一次分母和一次分子；同一试驾如同时命中多个一级标签，则按其实际命中的各一级标签分别进入对应指标，不得互相去重吞掉另一个指标。
- MUST 三项映射固定为：`版本未推荐率` 对应一级标签 `版本推荐`；`顾虑跳过率` 对应一级标签 `顾虑承接`；`竞品回避及贬低率` 对应一级标签 `竞品攻防`。展示文案可使用业务问题名，但计算匹配必须回到一期单店的一级/二级标签字段，不得用展示别名反向匹配。
- MUST 当某项存在分母且负向分子为 0 时展示 `0.0%`；只有该项在当前统计单元无任何一级/二级非空的标签样本时才展示 `--`。加载中、字段映射缺失、SQL 聚合失败且明细降级失败、明细触达行数上限、历史/实时任一路截断或聚合证据不完整时必须展示明确错误或“数据不完整”，不得伪装为 `--`。
- MUST 试驾标签 SQL 聚合路径和明细分页降级路径输出相同的分母、分子、标签层级和门店聚合结果；SQL 失败后 fallback 只能在完整读取且未触达上限时使用，结果必须与 SQL 路径一致。
- MUST 试驾标签历史数据集和 2026-07-17 当天实时直连数据集使用与一期单店相同字段映射：`试驾清单ID`、`品牌名称`、`经销商代码`、`经销商简称`、`试驾接待时间`、`一级标签`、`二级标签`、`标签正负向`、`是否判定正负向`。实时直连字段不得因多店而改名、降级或混用销售车系字段。
- MUST 销售漏斗下方只保留一个组织表现区，通过“销售概览”“过程分析”“打铁指标”三个 tab 切换，不得让销售表现表、过程表现表和打铁指标表上下同时铺开。
- MUST 三个 tab 共用 `viewLevel / drillPath`；切换 tab 不回到入口层，点击大区/小区后的下钻状态在其他 tab 中保持一致。
- MUST 大区层操作文案为“查看小区”，小区层为“查看门店”，门店层为“门店详情”；存在手动 `drillPath` 时必须保留返回按钮，返回只回到上一个合法清单层级，不得越过上游筛选锁定的入口。
- MUST PC 组织表现区在动态模块标题右侧只展示“当前清单实际组织范围”，不得展示“总部”“销售总监”“投资人”等角色文案，也不得展示“大区”“小区”“门店”等通用层级占位文案或任何门店名称。
- MUST 当当前清单范围只能确定唯一大区但不能确定唯一小区时，范围文案展示该真实大区名；同时能确定唯一大区和唯一小区时，展示“真实大区名 - 真实小区名”；当前清单跨多个大区且无法确定唯一大区时，必须隐藏范围文案。
- MUST 范围文案必须合并两类来源后重算：上游 URL Query 传入的大区/小区/门店筛选，以及表格大区→小区的手动下钻/返回路径。Query 同时有名称和代码时以名称为优先；只有代码时，必须从当前有效清单数据反查真实大区/小区名称，无法唯一反查时不得编造或回退为通用层级文案。
- MUST 上游品牌/大区/小区/门店筛选变化时，先清空旧 `drillPath`，再立即按新的有效清单范围重算标题右侧范围文案；手动下钻或返回后也必须同步重算，不得残留上一范围文案。
- MUST 范围文案与动态模块标题位于同一行，标题下方不得为范围文案保留独立占行；销售概览、过程分析、打铁指标共用同一范围文案和下钻/返回状态，同一行右侧导出入口及 `销售概览 → 过程分析 → 打铁指标` tablist 的位置与行为不得受影响。本规则仅适用于 PC，移动端保持不变。
- MUST 门店表现区默认激活“销售概览”tab；用户点击“过程分析”tab 后展示独立“门店过程表现”表；用户点击“打铁指标”tab 后展示独立“打铁运营指标”表。
- MUST 门店过程表现表一家门店只展示一行，不得因邀约/试驾拆成多行。
- MUST 门店过程表现表不展示月份和经销商代码字段，首列为经销商名称，其余列为过程指标。
- MUST 门店过程表现表用双层表头展示：首层用合并单元格区分“邀约”“试驾接待”，两组之间有清晰分隔；第二层只展示指标名称，不在指标名前重复写“邀约·”或“试驾接待·”。
- MUST 门店过程表现表每个指标单元格在同一行内展示当前值、月环比、周环比，样式严格参考一期单店顾问表现表，不展示单元格框线。
- MUST 门店表现 tab 样式对齐一期单店深度分析 tab：32px 高胶囊按钮、10px 圆角、默认 #f3f7fe、激活 #eaf1ff。
- MUST 点击门店销售表现表中的某家门店时，记录联动目标；用户切换到“过程分析”tab 后，高亮并定位到门店过程表现表中的对应门店行。
- MUST NOT 恢复旧过程指标独立面板、趋势浮层、深度分析、问题分布、AI 总结、电话邀约/试驾接待切换。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| 门店当前销售指标 | object | Yes | 包含线索、到店、试驾、订单、零售 |
| 门店上月同期销售指标 | object | Yes | 与当前门店同口径 |
| 门店上周同期销售指标 | object | Yes | 用于展开行销售转化率周环比 |
| 动态排名结果 | object | No | 订单/零售排名由当前筛选日期范围内的同级比较集合动态计算；投资人门店层使用其当前有效门店集合 |
| 全部经销商扁平查看状态 | object | No | `allDealerMode` 仅为页面状态；激活时派生 `effectiveLevel=store` 并保留当前 `drillPath`，适用于销售概览、过程分析和打铁指标 |
| 门店邀约标签聚合 | object | No | 按 IP 电话邀约四项输出分母、负向分子、当前值、月环比、周环比和完整性证据 |
| 门店试驾标签聚合 | object | No | 按一期单店口径输出 `版本未推荐率`、`顾虑跳过率`、`竞品回避及贬低率` 的分母、负向分子、当前值、月环比、周环比和完整性证据 |
| 门店诊断结果 | object | No | 包含主问题名称和结果断点 |

**输出 / 结果：**
- 门店表现 Tab：销售概览、过程分析、打铁指标。
- 销售概览 Tab：门店销售表现表；第二列 `销售结果（指标：月环比）` 为上下双层单元格，上层展示五段数量漏斗及数量月环比，下层展示 `线索到店率 / 到店试驾率 / 试驾订单率 / 交付率` 四率及百分点月环比。
- 过程分析 Tab：门店过程表现表，一家门店一行，首列为经销商名称，按邀约、试驾接待指标列展示过程指标。
- 打铁指标 Tab：打铁运营指标表，按无车系过程基线组织骨架展示 7 项邀约 + 4 项试驾当前值、月环比和周环比；扁平态按当前范围全部可见经销商展示当前激活二级组。
- 当前范围全部经销商扁平视图：销售概览、过程分析和打铁指标以当前范围内全部可见经销商为行粒度展示，并提供返回分层查看入口。

**状态：**
- 默认：随区域漏斗加载。
- 加载：跟随区域漏斗占位。
- 空状态：无门店数据时提示当前暂无门店销售表现。
- 错误：计算依赖缺失时提示数据不完整。
- 成功：默认展示门店表现区的销售概览 tab。
- 联动：点击门店销售表现行后，切换到过程分析 tab 时门店过程表现表高亮并定位对应门店行。
- 扁平查看：当前层级非门店且销售概览/过程分析/打铁指标激活时，可切换到当前范围全部经销商清单；加载、空、错误、无权限和当前 Tab 局部错误复用现有对应状态。

**验收标准：**
- [ ] AC-004: Given 销售数据加载完成, when 用户查看销售指标下方, then 能看到门店销售表现表。
- [ ] AC-005: Given 页面加载完成, when 用户查看销售指标和门店销售表现之间, then 不出现旧版独立过程指标面板、趋势浮层、深度分析、问题分布、AI 总结、电话邀约/试驾接待模块。
- [ ] AC-006: Given 门店上月同期无销售漏斗记录, when 门店销售表现展示月环比, then 不强算百分比，展示明确空态。
- [ ] AC-038: Given 门店销售表现加载完成, when 用户查看订单后续列, then 能看到订单排名、订单占比、零售、零售排名、零售占比。
- [ ] AC-039: Given 用户切换日期范围, when 门店销售表现渲染, then 订单排名和零售排名按新日期范围内的当前同级比较集合订单/零售结果重新计算；投资人门店层使用其当前有效门店集合。
- [ ] AC-040: Given 当前小区存在多家门店且当前角色不是投资人, when 门店销售表现渲染, then 订单占比和零售占比按该门店在小区总量中的占比展示为整数百分比；Given 当前角色是投资人, then 占比分母改为其当前有效门店集合订单/零售合计。
- [ ] AC-032: Given 门店销售表现加载完成, when 用户查看表头和操作列, then 不出现展开、收起、全部展开或全部收起入口。
- [ ] AC-035: Given 门店销售表现加载完成, when 用户查看门店表现区, then 默认只展示销售概览 tab，不同时展示过程表现表。
- [ ] AC-036: Given 用户点击 A 门店销售表现行, when 用户切换到过程分析 tab, then A 门店过程指标行被高亮并滚动定位。
- [ ] AC-037: Given 用户查看过程分析 tab, when 表格渲染完成, then 不展示月份和经销商代码，表头用“邀约”“试驾接待”合并单元格区分指标组，两组之间有分隔线，指标名不带模块名前缀，且每个指标单元格在一行内包含当前值、月环比、周环比。
- [ ] AC-057: Given 总部用户且上游未选择具体大区, when 销售表现加载完成, then 首列为大区、操作为“查看小区”，订单/零售排名在同品牌同日期全国完整大区集合内计算。
- [ ] AC-058: Given 大区用户或总部已锁定具体大区, when 清单加载完成, then 首列为小区、操作为“查看门店”，订单/零售排名和占比以所属大区为比较分母。
- [ ] AC-059: Given 当前层级为门店且当前角色不是投资人, when 清单加载完成, then 既有门店字段、门店在所属小区内排名占比和“门店详情”行为保持不变；Given 当前角色是投资人, then 门店字段和“门店详情”行为保持不变，但订单/零售排名占比按其当前有效门店集合统一计算。
- [ ] AC-060: Given 两个对象订单值相同且第三个对象更低, when 动态排名完成, then 同值对象按组织代码升序拆分为连续唯一名次，第三个对象显示第 3 名，不输出并列名次。
- [ ] AC-061: Given 小区下属门店到店分别为 8/2、线索分别为 40/10, when 小区线索到店率计算完成, then 结果为 `(8+2)/(40+10)=20%`，不得显示门店到店率简单平均值。
- [ ] AC-062: Given 用户在销售表现下钻到某小区, when 切换到过程表现, then 仍展示该小区下门店；when 返回上一级, then 两个 tab 的共享层级均同步回退。
- [ ] AC-063: Given 当前有效清单范围只能确定唯一真实大区“4苏皖区”且包含多个小区, when PC 组织表现区渲染完成, then 动态模块标题右侧只展示“4苏皖区”，不展示角色、通用层级或门店名称，标题下方不再独立占行。
- [ ] AC-064: Given 当前有效清单范围同时只能确定唯一真实大区“4苏皖区”和唯一真实小区“苏南小区”, when 销售表现或过程表现渲染完成, then 标题右侧展示“4苏皖区 - 苏南小区”，不得追加具体门店名称，两个 tab 展示一致。
- [ ] AC-065: Given 当前有效清单跨多个大区且无法确定唯一大区, when PC 组织表现区渲染完成, then 标题右侧不展示任何范围文案，不使用“总部 / 大区”等占位。
- [ ] AC-066: Given 上游 Query 选中具体大区、小区或门店且只传入组织代码, when 有效清单数据加载完成, then 系统从有效清单唯一反查真实大区/小区名称并按 AC-063/064 展示；when 上游筛选变化, then 旧 `drillPath` 先清空且范围文案立即按新清单范围重算。
- [ ] AC-067: Given 用户在表格中手动下钻且 `drillPath` 非空, when 清单进入下一级或用户返回上一级, then 标题右侧范围文案同步重算，返回按钮在存在手动下钻路径时保留，右侧导出入口和“销售表现 / 过程表现”tab 的位置、切换及共享层级行为不受影响，移动端页面不发生变化。
- [x] AC-088: Given 大区清单以乱序输入 `6东南区、2华中区、7中南区、4苏皖区、1南部区、3西部区` 且另有无数字前缀大区, when 销售表现或过程表现渲染完成, then 有数字前缀的大区严格按 `1、2、3、4、6、7` 的数值升序展示，无数字前缀大区位于其后并按大区代码稳定升序，两个 tab 行序一致。
- [x] AC-089: Given 小区或经销商清单在当前日期筛选范围聚合后的订单数为 `100、60、20` 且存在订单数相同的对象, when 销售表现或过程表现渲染完成, then 清单按 `100、60、20` 降序展示，同订单对象分别按小区代码或经销商代码稳定升序，两个 tab 行序一致。
- [x] AC-165: Given 投资人 `marketing_userType=6` 名下有效门店为 5 家且分布在 2 个小区，并且当前品牌、日期、车系、上游组织筛选、罗盘行权限和有效经销商白名单过滤后仍保留这 5 家, when PC 门店层销售概览渲染, then 每家门店的订单排名和零售排名均在同一 5 店集合内计算并显示为 `x/5`，订单占比=`该店订单/5 店订单合计`、零售占比=`该店零售/5 店零售合计`；Given 上游具体 `dealerCode/store` 只保留 1 家有效门店, when PC 门店层销售概览渲染, then 订单排名和零售排名均显示 `1/1`，订单占比和零售占比均以该 1 店自身合计为分母，不得由诊断结果或补数扩大到小区；UI 仍只显示“排名”，不得新增“投资人排名”或小区文案；主问题/结果断点动态诊断口径不因本 AC 改变。
- [x] AC-186: Given 总部用户在 PC 端、上游未选择具体大区且当前层级为大区, when 用户在表现区 header 工具区点击“查看所有经销商”, then 销售概览展示全国当前可见经销商行，标题为“全部经销商销售表现”，首列为“经销商名称”，操作列均为“门店详情”，顶部指标值不变化。
- [x] AC-187: Given 大区用户或总部用户已由上游锁定某大区且当前层级为小区, when 用户点击“查看所有经销商”, then 销售概览展示该大区内全部当前可见经销商，不再只展示小区行；范围文案保留该真实大区名，顶部指标仍为上游大区范围整体值。
- [x] AC-188: Given 总部用户从大区层手动下钻进入某大区的“小区层”，且真实 `organization.viewLevel=district`、`drillPath` 仅包含该大区, when 用户点击“查看所有经销商”, then 销售概览和过程分析只展示该大区当前可见经销商，不展示其他大区或全国门店；Given 真实 `organization.viewLevel=store`, then 当前层级已经是经销商清单，入口隐藏且不响应点击。
- [x] AC-189: Given 用户在“销售概览”激活 `allDealerMode`, when 切换到“过程分析”, then 过程分析继续以相同当前范围全部经销商为行粒度展示，标题为“全部经销商过程表现”；when 再切回“销售概览”, then 仍保持扁平查看状态。
- [x] AC-190: Given `allDealerMode=true`, when 用户点击“返回分层查看”, then 恢复进入扁平查看前快照中的 `organization.viewLevel / drillPath`、销售/过程页码、`selectedStoreCode`、首列、操作文案、范围文案和返回按钮；销售概览/过程分析不再展示全部经销商扁平清单。Given 扁平态销售/过程渲染, then 面包屑返回按钮隐藏且返回事件不生效，不能改写真实 `organization.viewLevel / drillPath`。
- [x] AC-191: Given `allDealerMode=true`, when 用户切换到“打铁指标”, then 不显示“查看所有经销商 / 返回分层查看”入口，打铁仍按真实 `organization.viewLevel / drillPath` 展示原层级组织行和既有分页/导出范围；when 用户在打铁中合法下钻或返回, then 销售/过程扁平快照同步到最新真实层级、`drillPath` 和页码；when 切回销售概览或过程分析, then 继续扁平当前新范围，退出扁平时恢复该最新真实层级。
- [x] AC-192: Given `allDealerMode=true`, when 父应用通过新 Query 改变品牌、日期、大区、小区、经销商或车系上下文, then 页面清空 `allDealerMode`，重新按角色和上游筛选决定默认分层入口；不得残留旧范围全部经销商清单。
- [x] AC-193: Given 当前扁平范围共有 34 家可见经销商, when 用户进入全部经销商销售概览或过程分析, then 每页仍展示 15 家，总页数为 3，第 1 页上一页禁用，第 3 页下一页禁用，分页文案按 34 条和当前页展示条数计算。
- [x] AC-194: Given 当前扁平范围超过 15 家经销商且用户点击销售或过程导出, when 导出文件生成, then 导出包含当前扁平范围内全部经销商行而非仅当前页 15 家；销售导出字段沿用销售概览，过程导出字段沿用过程分析。
- [x] AC-195: Given 当前扁平范围内经销商分属多个小区, when 计算订单排名、零售排名、订单占比和零售占比, then 所有排名和占比均在当前扁平经销商集合内统一比较和计算，不按所属小区拆分。历史 v1.73 完成时同值排名采用竞赛排名；v1.85 起由 AC-259～AC-271 覆盖为稳定唯一排名。
- [x] AC-259: Given 大区层全国完整性证据成立且多个大区订单数相同, when PC 销售概览计算订单排名, then 按订单数降序、同值按大区代码升序拆分，名次连续且末行显示 `n/n`。
- [x] AC-260: Given 大区层全国完整性证据成立且多个大区零售数相同, when PC 销售概览计算零售排名, then 按零售数降序、同值按大区代码升序拆分，名次连续且末行显示 `n/n`。
- [x] AC-261: Given 同一大区内多个小区主指标同值, when PC 销售概览计算小区层订单排名和零售排名, then 两个指标分别独立计算，并按小区代码升序拆分同值行。
- [x] AC-262: Given 同一比较集合内多个经销商主指标同值, when PC 销售概览计算经销商层订单排名和零售排名, then 按经销商代码升序拆分同值行，不按名称、输入顺序、随机数或时间戳拆分。
- [x] AC-263: Given 当前比较集合有 53 个对象且末尾多行主指标同值, when 页面展示订单排名或零售排名, then 排名可从 `46/53` 连续展示到 `53/53`，不得停留在同一个名次或输出并列。
- [x] AC-264: Given 投资人 `marketing_userType=6` 进入门店层且当前有效 portfolio 集合跨小区, when 订单/零售主指标同值, then 排名仍在当前有效 portfolio 集合内唯一计算，同值按经销商代码拆分，不回退所属小区比较集合。
- [x] AC-265: Given 用户启用当前范围全部经销商扁平模式, when 全国、大区或当前 `drillPath` 扁平后展示经销商行, then 订单/零售排名在当前扁平集合内稳定唯一排名，订单/零售占比分母保持当前扁平集合合计不变。
- [x] AC-266: Given 上游具体门店筛选或当前有效比较集合只剩 1 家, when PC 销售概览渲染订单表现和零售表现, then 订单排名和零售排名均显示 `1/1`，占比继续沿用当前集合语义。
- [x] AC-267: Given 总部大区层全国完整性不可证、权威大区清单过期或当前同品牌全国大区集合不完整, when PC 销售概览渲染大区订单排名和零售排名, then 继续显示 `--`，不得因唯一排名改造绕过全国完整性门禁。
- [x] AC-268: Given 合法且唯一的组织代码、相同指标值和相同筛选上下文, when 多次计算、浏览器刷新或输入数组顺序变化, then 订单排名和零售排名结果一致。
- [x] AC-269: Given 当前比较集合订单数或零售数全为 0, when PC 销售概览计算对应排名, then 仍按组织代码升序输出稳定 `1/n ... n/n`，不展示并列名次或错误文案。
- [x] AC-270: Given 用户从 PC 销售概览导出当前行集, when 查看导出文件中的 `订单排名`、`零售排名`, then 字段名、列顺序、文件格式和 Excel 文本保护保持不变，排名值与页面稳定唯一排名一致。
- [x] AC-271: Given 执行 v1.85 非目标回归, when 对照车系、权限、组织筛选、日期、数据查询、动态诊断、占比、分页、行序、目标字段、过程分析、打铁指标、移动端和发布配置, then 除订单/零售同值名次拆分及其导出同步外均不变化。
- [x] AC-282: Given 用户从 PC 过程分析导出任一合法分层或全部经销商扁平范围, when 生成 CSV, then 组织名称为首列，现有 9 个 `PROCESS_TABLE_METRIC_LABELS` 指标依次各输出相邻的 `<指标>(%)`、`<指标>月环比(百分点)`、`<指标>周环比(百分点)` 三列，共 27 个指标列，且每组固定 current→month→week；当前 `10.3%`、月环比 `-4.5%`、周环比 `+0.1%` 分别输出数值 `10.3`、`-4.5`、`0.1`，不带 `%`、`+`、`月`、`周`、斜杠或其他文案；不可比、加载失败、数据不完整或无值输出空单元格，合法 0 输出 `0`；无论页面月/周开关状态，三列始终存在。历史完成时曾保留具体车系边界说明行；v1.93 起该说明被 AC-312～AC-313 取代，导出必须继承真实车系过滤。导出入口、导出范围、CSV 文件格式、页面 UI、移动端及其他模块均不变化。（本地实现、Code Review 和工程门禁完成；独立 QA 待文档回写后复核）
- [x] AC-196: Given 当前用户只拥有部分经销商行权限或有效经销商白名单只保留部分门店, when 用户激活全部经销商查看, then 清单、分页、排名、占比和导出均只包含“上游筛选 ∩ 罗盘行权限 ∩ 有效经销商白名单 ∩ 当前 `drillPath`”内经销商，不出现无权限或白名单外门店。
- [x] AC-197: Given 页面处于全局加载、空、错误、无权限状态，或真实 `organization.viewLevel=store`，或当前有效经销商集合 `<=1`，或过程分析处于局部错误态, when 销售概览或过程分析渲染 header 工具区, then 不显示可点击的“查看所有经销商”入口，且状态文案继续复用现有加载、空、错误、无权限或 `数据不完整` 语义，不因扁平模式新增第二套状态。
- [x] AC-198: Given PC 1280px 和 1440px 视口、浅色和深色主题, when header 工具区显示“查看所有经销商”或“返回分层查看”, then 按钮位于导出按钮左侧且不进入 sticky 操作列表头、不挤压表格列宽、不造成新增横向页面溢出；按钮可通过键盘聚焦和触发，并具备清晰可读的无障碍名称；1440px 视觉证据文件必须是精确 `1440x900` viewport 截图，非 fullPage 长图。
- [x] AC-206: Given PC 销售概览表加载完成, when 用户查看第二列 `销售结果（指标：月环比）`, then 单元格上层展示 `线索 → 到店 → 试驾 → 订单 → 零售` 五段数量及数量月环比，下层展示四个等宽转化率，不新增表格列、不新增交互、不移动订单表现、零售表现、主问题、结果断点和操作列。
- [x] AC-207: Given 当前行 `row.current` 为线索 100、到店 40、试驾 20、订单 8、零售 6 且 `row.previous` 为线索 80、到店 32、试驾 16、订单 4、零售 2, when 计算行内四率, then 依次展示 `线索到店率=40.0%`、`到店试驾率=50.0%`、`试驾订单率=40.0%`、`交付率=75.0%`，月环比分别为当前率减上月同期率的百分点差；不得展示相对涨跌率。
- [x] AC-208: Given 当前清单为大区、小区、门店、全部经销商扁平视图或投资人门店集合, when 渲染销售概览行内四率, then 每行先按该行粒度聚合原始线索、到店、试驾、订单、零售，再计算四率和月环比；不得平均下属门店转化率，投资人门店层必须使用其当前有效门店集合。
- [x] AC-209: Given 用户选择一个或多个具体车系, when 销售概览行内四率渲染, then 四率与五段数量均基于销售事实字段 `汇报车系名称` 筛选后的 `row.current` / `row.previous` 原始分子分母计算。历史完成时过程分析、打铁指标和过程导出仍保持既有车系边界；v1.93 起该边界被 AC-309～AC-325 取代，过程和打铁必须按来源级物理字段真实联动。
- [x] AC-210: Given 顶部过程卡第四项仍展示 `线索订单率=订单/线索`, when 用户查看销售概览表内第四个行内转化率, then 表内第四率展示 `交付率=零售/订单`；本变更不得修改顶部销售/过程指标卡、过程分析表、打铁指标、订单表现、零售表现、销售导出字段或导出入口。
- [x] AC-211: Given 行内四率分母有效且分子为 0, when 单元格渲染, then 当前值显示 `0.0%`；Given 分母为 0, then 当前值显示 `--`；Given 当前分母有效但上月同期分母为 0, then 当前值正常显示且月环比显示 `--`；Given 销售主链路加载、错误、无权限、完整性不可证或业务码失败, then 复用销售概览表既有状态，不在单元格内伪造 0、`--` 或旧值。
- [x] AC-212: Given 任一行内四率月环比为正、负或无可比值, when PC 浅色和深色主题渲染, then 正向改善使用既有正向色、负向变化使用既有负向色、无可比值使用中性色且有文本符号；涨跌含义不得只靠颜色传递，短标签必须提供完整可访问名称。
- [x] AC-213: Given PC 1280px 和 1440px 视口、浅色和深色主题, when 销售概览表展示行内四率双层单元格, then 行高保持约 108px～120px，下层四率等宽且可读，不造成页面级新增横向溢出，不挤压主问题、结果断点或操作列至不可读。
- [x] AC-214: Given 用户在 PC “打铁指标”Tab、真实 `organization.viewLevel !== 'store'`、当前有效经销商集合 `>1` 且无全局/打铁局部阻断状态, when 表现区 header 工具区渲染, then “查看所有经销商”入口显示在导出按钮左侧；Given `allDealerMode=true`, then 文案切换为“返回分层查看”，且一级 Tab 切换后仍保持同一状态。
- [x] AC-215: Given 总部用户在全国大区层进入“打铁指标”, when 点击“查看所有经销商”, then 打铁指标展示全国当前可见经销商行，标题为“全部经销商打铁表现”，首列为“经销商名称”，操作列均为“门店详情”，顶部指标值不变化，且不触发新的打铁数据集查询或权限扩大。
- [x] AC-216: Given 大区用户或总部用户已由上游锁定某大区，或总部从大区层手动下钻进入某大区的小区层且 `drillPath` 仅含该大区, when 在“打铁指标”点击“查看所有经销商”, then 打铁指标只展示该当前范围内全部可见经销商，不展示其他大区门店；范围文案保留真实大区/小区范围。
- [x] AC-217: Given 用户在“销售概览”“过程分析”或“打铁指标”任一 Tab 激活 `allDealerMode`, when 切换到其他一级 Tab 再切回, then 三张 Tab 均继续展示相同当前范围的全部经销商，入口文案、快照和分页状态不丢失。
- [x] AC-218: Given `allDealerMode=true` 且一级 Tab 为“打铁指标”, when 用户切换 `邀约指标 7 / 试驾指标 4`, then 只切换当前指标组，不清空扁平模式、不恢复分层、不改变当前扁平范围、打铁页码、组织行序或范围文案。
- [x] AC-219: Given `allDealerMode=true`, when 用户点击“返回分层查看”, then 恢复进入扁平查看前快照中的 `organization.viewLevel / drillPath`、销售页码、过程页码、打铁页码、打铁二级组、`selectedStoreCode`、范围文案和返回按钮；Given 上游品牌、日期、大区、小区、经销商、车系或 iframe Query 变化, then 清空 `allDealerMode` 并按新范围重新判定入口。
- [x] AC-220: Given 打铁指标处于扁平态, when 用户查看操作列或触发返回上一级, then 不出现“查看小区”“查看门店”，面包屑返回按钮隐藏且返回事件不生效；门店行“门店详情”仍按既有单店跳转协议工作。
- [x] AC-221: Given 打铁指标真实 `organization.viewLevel='store'`、当前有效经销商集合 `<=1`、全局加载/空/错误/无权限或打铁局部加载失败/数据不完整阻断展示, when header 工具区渲染, then 不显示可点击的“查看所有经销商”入口；Given 已在扁平态后范围收窄为单门店, then 仍保留“返回分层查看”入口以允许退出。
- [x] AC-222: Given 打铁扁平范围超过 15 家经销商且用户点击现有导出入口, when 当前二级组为邀约或试驾, then 导出包含当前扁平范围内全部经销商行和当前组指标字段，而不是仅当前页 15 家；页面不得新增第二个导出按钮。
- [x] AC-223: Given 打铁扁平态构建经销商行, when 对照数据来源和权限边界, then 只能使用既有 `ironStores` / 无车系 `processBaselineData` 组织骨架、上游 URL 筛选、罗盘行权限和有效经销商白名单，不使用销售 `汇报车系名称` 过滤后的销售行集，不新增全量查询，不绕过车系字段 fail-closed、SQL-only 或来源完整性门禁。
- [x] AC-224: Given PC 1280px 和 1440px 视口、浅色和深色主题, when header 工具区显示“查看所有经销商”或“返回分层查看”且一级 Tab 为打铁指标, then 按钮位于导出按钮左侧、不进入 sticky 操作列表头、不挤压二级组切换、表格组织列或操作列、不造成新增页面级横向溢出；1440px 视觉证据文件必须是精确 `1440x900` viewport 截图，非 fullPage 长图。
- [x] AC-225: Given 用户使用键盘或屏幕阅读器操作打铁扁平查看, when 焦点进入入口、一级 Tab、二级切换、分页、导出和门店详情, then 可按视觉顺序访问，入口具备清晰无障碍名称，`aria-selected/expanded/controls` 或等价语义与可见状态一致，当前扁平态不得只靠颜色表达。
- [ ] AC-100: Given 上游筛选为 `dealerCode=MQ8530`、品牌 `MG`、日期 `2026-07-01` 至 `2026-07-16`, when PC 过程分析加载三项试驾问题率, then `版本未推荐率=16.7%`、`顾虑跳过率=7.7%`、`竞品回避及贬低率=10.0%`，且与一期单店同范围、同字段、同去重 SQL 的结果完全一致。
- [ ] AC-101: Given 多店清单只包含 `MQ8530` 一个有效门店, when 与一期单店同日期、同品牌对比, then 三项试驾问题率完全一致；Given 大区/小区清单包含多家门店, when 聚合三项试驾问题率, then 先按有效门店集合内去重 `试驾清单ID` 汇总分子分母后计算，不得平均各门店百分比。
- [ ] AC-102: Given 同一 `试驾清单ID` 在 `版本推荐` 一级标签下命中多个二级标签且其中至少一条为有效负向, when 计算 `版本未推荐率`, then 该试驾在分母只算 1 次、分子只算 1 次；`顾虑承接` 和 `竞品攻防` 同理。
- [ ] AC-103: Given 某项试驾问题率存在分母且负向分子为 0, when 渲染过程分析, then 显示 `0.0%`；Given 该项没有任何一级/二级标签均非空的样本, then 显示 `--`。
- [ ] AC-104: Given 试驾标签处于加载中、字段映射缺失、SQL 聚合失败且明细 fallback 失败、明细触达上限、历史或 2026-07-17 当天实时任一路截断, when 渲染三项试驾问题率, then 展示加载态或明确错误/数据不完整状态，不得显示 `--` 或沿用旧值。
- [ ] AC-105: Given 日期范围包含 2026-07-17 当天, when 读取试驾实时直连表, then 使用与一期单店相同的 `试驾清单ID/品牌名称/经销商代码/经销商简称/试驾接待时间/一级标签/二级标签/标签正负向/是否判定正负向` 字段映射，并与历史表合并后按同一去重口径输出。
- [ ] AC-106: Given 强制试驾标签 SQL 聚合失败但明细分页完整且未触达上限, when 进入 fallback, then 三项试驾问题率与 SQL 路径结果一致；Given fallback 分页失败或证据不完整, then 阻断该项结果并提示错误，不得以 `--` 表示。
**源表标签到页面展示映射：** `到店理由构建` → `零钩子`；`到店时间锁定` → `未锁定时间`；`报价到店承接` → `报价承接不足`；`竞品比较转化` → `竞品比较转化不足`。
- [x] AC-107: Given IP 电话邀约标签加载失败、触达 `5000` 上限或完整性不可证，但试驾接待标签三阶段完整, when 用户查看过程分析, then 邀约四项显示 `数据不完整`，试驾三项继续展示正确当前值、月环比和周环比，不被置为 `--` 或清空。
- [x] AC-108: Given 试驾接待标签加载失败、触达 `5000` 上限或完整性不可证，但 IP 电话邀约标签三阶段完整, when 用户查看过程分析, then 试驾三项显示 `数据不完整`，邀约四项继续展示正确当前值、月环比和周环比，不被置为 `--` 或清空。
- [x] AC-109: Given IP 电话邀约和试驾接待两类标签三阶段均完整, when 用户查看过程分析, then 邀约四项与试驾三项均按各自一期口径输出，且有样本分子为 0 的指标显示 `0.0%`、真无样本显示 `--`。
- [x] AC-110: Given IP 电话邀约和试驾接待两类标签均失败、截断或完整性不可证, when 用户查看过程分析, then 七项过程问题均显示 `数据不完整`，页面仍保留销售概览、顶部销售指标和顶部四项销售转化率。
- [x] AC-111: Given 默认全域查询 `2026-07-01` 至 `2026-07-20`、品牌 `MG`、组织为全域, when 执行定向一级标签聚合 SQL, then IP 电话邀约四项与试驾接待三项各自结果行数均不触达 `5000` 上限，输出值与同范围一期口径复算一致；不得回退为全量 `problem_child` 组合导致历史 IP 5118 行或历史试驾 6141 行截断。
- [x] AC-112: Given 当前、上月同期、上周同期任一阶段的 IP 或试驾完整性状态不同, when 计算过程问题率和环比, then 每个 kind、每个阶段独立判断；缺失阶段只影响该项环比或该 kind 状态，不影响另一 kind 或销售转化率。
- [x] AC-113: Given IP/试驾标签任意成功、失败、截断或重试, when 用户查看顶部过程指标框, then 线索到店率、到店试驾率、试驾订单率、线索订单率仍只由销售漏斗原始分子分母计算，值、月环比和周环比不受标签状态影响。
- [x] AC-114: Given 审查过程标签请求、SQL 和返回结构, when 对照本需求, then IP 查询只包含邀约四项所需一级标签，试驾查询只包含三项所需一级标签，返回结构按 `kind` 分离并携带独立完整性证据，不存在无用 `problem_child` 组合或共用 `Promise.all` 失败后整段丢弃。
> AC-068～AC-079 为已撤回方案的历史验收记录，2026-07-16 回退后均不属于当前源码验收范围，也不能作为已实现能力引用。

- [ ] AC-068（已撤回）: Given 父店订单/零售为 `10/8`、两个可见二网分别为 `3/2` 和 `2/1`, when 父店经营单元和区域汇总完成, then 父店唯一门店行与区域合计均为 `15/11`，页面任何位置不出现二网独立行、名称、代码或数量。
- [ ] AC-069（已撤回）: Given 二网自身组织与父店不同, when 按父店大区/小区查看, then 二网事实仍归入父店组织；同一父级代码存在多品牌行时只按同品牌父店归并。
- [ ] AC-070（已撤回）: Given URL 传入二网代码, when 应用解析范围, then UI 参数归一为父店且事实查询集合为该父店及其当前可见二网，不串入其他父店成员。
- [ ] AC-071（已撤回）: Given 二网父级缺失、同品牌同经销商存在多个父级、父级仍为二网、重复关系冲突或关系成环, when 构建有效范围, then 先按二网自身组织收敛为当前候选异常；URL 直接指定无效二网时立即阻断，不得静默独立展示。
- [ ] AC-072（已撤回）: Given 经销商维表超过单页 10000 行, when 构建父子关系, then 系统按 offset 读取到末页并输出真实 `rowCount/pageCount/complete`；达到硬上限或任一页失败时阻断加载。
- [ ] AC-073（已撤回）: Given 标签成员需拆为多个查询分片, when 当前/上月/上周聚合完成, then 三阶段使用相同成员集合且顶部和父店行由全部分片原始分子分母合并；任一分片命中 5000 行上限时不得展示局部比例。
- [ ] AC-074（已撤回）: Given 过程查询完整且某成员零样本, when 页面渲染, then 相应指标显示 `--` 且不出现“数据覆盖不足”；Given 任一过程阶段截断或失败, then 所有已加载局部负向过程值清空为 `--`、销售指标保留，并显示“数据覆盖不足”。
- [ ] AC-075（已撤回）: Given 当前候选异常二网, when 使用相同异常代码集合预检当前、上月和上周销售事实, then 任一线索、到店、试驾、订单或零售非零时以 `DEALER_RELATION_INVALID` 阻断；三段均可证明完整且为零时允许其余合法父店展示。
- [ ] AC-076（已撤回）: Given 异常销售事实聚合查询失败, when 三段明细分页均读到短末页且未触硬上限, then 可以“完整零事实”放行；任一分页失败、触上限或完整性不可证时以 `DEALER_RELATION_PREFLIGHT_FAILED` 失败关闭。
- [ ] AC-077（已撤回）: Given 开业二网的同品牌父店状态为非开业或退网中且父级类型为一网, when 构建父经销商经营单元, then 仍使用父店名称和组织承接该二网，并且页面只展示父店。
- [ ] AC-078（已撤回）: Given 上游组织编码正确但大区或小区名称已过期, when 构建合法父店和候选异常范围, then 只按编码命中，合法父店不得漏出、异常二网不得绕过销售事实预检。
- [ ] AC-079（已撤回）: Given `brand=全部` 且 MG、荣威存在相同经销商代码, when 查询并聚合销售与过程事实, then SQL 不强制 MG，两品牌按复合成员范围隔离，页面父店行不串品牌且顶部指标等于两品牌父店行合计。

### REQ-003: 问题门店列表

**优先级：** P0  
**关联任务：** TASK-003  
**关联流程：** FLOW-001  

**用途：**  
让区域经理知道哪些门店最该优先辅导。

**行为：**  
系统按当前区域/小区下属门店生成问题门店列表，默认按线索订单率下滑幅度排序，并展示订单数下滑作为影响规模校验。

**规则：**
- MUST 默认按线索订单率下滑幅度降序排序。
- MUST 同时展示订单数下滑量，避免只看比例忽略业务规模。
- MUST 在销售漏斗模块下方展示门店销售表现，字段按“经销商名称、下发线索（月环比）、到店（月环比）、试驾（月环比）、订单（月环比）、订单排名、订单占比、零售（月环比）、零售排名、零售占比、主问题名称、结果断点”排列，不展示月份和经销商代码。
- MUST 诊断清单中的月份、经销商、主问题名称、结果断点来自销售结果规则；下发线索、到店、试驾、订单、零售及月环比来自销售漏斗源按同一门店和上月同期计算；订单/零售排名来自当前日期范围的动态同级比较集合，投资人门店层使用其当前有效门店集合，不得把诊断结果表当作销售漏斗事实源或排名源。
- MUST 当上月同期无该门店销售漏斗记录或分母为 0 时，月环比展示为“上月无同期”或等价空态，不强算涨跌。
- MUST 在追踪方向判定逻辑正式确认前不展示临时方向判断，不得用临时 heuristic 输出线索到店或试驾订单结论。
- SHOULD 对样本过小或订单影响极小的门店做弱化提示。
- MUST 展示每家门店销售指标月环比、主问题名称和结果断点。
- MUST 结果断点先展示命中主问题的证据指标、当前值和小区位置，再展示断点提炼，避免只给“订单转化不足”这类抽象结论。
- MUST 只展示当前用户有权限的门店。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| 门店漏斗指标列表 | array | Yes | 每条包含门店代码、门店名称、当前漏斗、上月同期漏斗 |
| 门店诊断结果列表 | array | Yes | 每条包含统计月份、经销商代码、经销商名称、主问题名称、结果断点 |
| 区域筛选 | object | Yes | 当前大区/小区权限范围 |

**输出 / 结果：**
- 问题门店排序列表。
- 每家门店的销售指标月环比、主问题名称和结果断点。
- 销售指标下方的门店销售表现。

**状态：**
- 默认：按线索订单率下滑降序。
- 加载：列表显示骨架。
- 空状态：无问题门店时提示当前区域暂无明显下滑门店。
- 错误：列表数据读取失败时提示重试。
- 成功：展示问题门店列表。

**验收标准：**
- [ ] AC-007: Given A 店线索订单率下滑最大且订单下滑有规模, when 列表加载完成, then A 店排在优先辅导列表前列。
- [ ] AC-008: Given B 店负向问题波动最大但结果下滑较轻, when 列表排序, then B 店不应抢占结果下滑更严重门店之前。
- [ ] AC-027: Given 当前小区存在当月门店诊断结果, when 用户查看销售漏斗下方, then 能看到该小区所有门店的销售表现，且字段顺序符合要求。
- [ ] AC-028: Given 某门店上月同期无销售漏斗记录, when 诊断清单展示月环比, then 不强算百分比，展示明确空态。

### REQ-004: 页面删减范围

**优先级：** P0  
**关联任务：** TASK-003  
**关联流程：** FLOW-001  

**用途：**  
确保当前重做版只保留销售指标和门店销售表现，不继续加载旧版过程分析模块。

**行为：**  
系统不渲染、不隐藏保留、不后台执行旧版过程指标、趋势浮层、深度分析、问题分布、AI 总结、电话邀约/试驾接待切换逻辑。

**规则：**
- MUST HTML 中不保留旧模块容器。
- MUST 主渲染脚本只将邀约与试驾接待标签统计用于过程表现和动态诊断，不调用旧版趋势/问题分布渲染函数，也不得以标签统计替代顶部四张转化率卡。
- MUST 所有月环比变化值统一使用箭头展示，正向变化用 `▲`，负向变化用 `▼`。
- MUST 到店试驾率在当前销售漏斗模块展示，但不进入门店追踪方向或证据下钻。
- MUST NOT 展示临时方向判断或“逻辑未确认”占位文案。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| 页面结构 | HTML | Yes | 只包含筛选、销售漏斗模块、门店销售表现 |
| 主脚本 | JavaScript | Yes | 只执行筛选、销售漏斗模块、门店销售表现渲染 |

**输出 / 结果：**
- 简版页面结构。
- 无旧模块运行入口。

**状态：**
- 默认：随门店列表展示。
- 加载：跟随门店列表。
- 空状态：门店销售表现表展示空态。
- 错误：销售指标读取失败时提示失败原因。
- 成功：页面只展示销售漏斗模块和门店销售表现。

**验收标准：**
- [ ] AC-009: Given 页面加载完成, when 用户查看首屏和后续内容, then 只存在销售漏斗模块和门店销售表现两个业务区块。
- [ ] AC-010: Given 查看 HTML 和主脚本, when 搜索旧模块容器与渲染调用, then 不存在可运行的过程指标、趋势浮层、问题分布、AI 总结入口。
- [ ] AC-011: Given 到店试驾率下滑, when 页面加载完成, then 页面展示到店试驾率卡片及环比，但不触发证据下钻入口。

### REQ-005: 单店页跳转

**优先级：** P0  
**关联任务：** TASK-004  
**关联流程：** FLOW-001  

**用途：**  
复用一期单店诊断页承接证据；当前重做版不在区域页内展开单店详情，只提供行末“门店详情”按钮跳转。

**行为：**  
当前重做版门店销售表现表每行末尾展示“门店详情”按钮。用户点击后进入一期单店诊断页，并携带当前点击门店的筛选上下文。
一期单店承接地址由 `multi-store-super-app/settings.json` 运行时配置中的 `environment` 与 `singleStoreAppUrls` 管理；开发、测试环境未配置地址时回退生产地址，配置读取失败或环境值非法时也必须回退生产地址。

当前环境配置要求：
- 测试环境单店 App 固定为 `https://rdata-pv.rauto.com/open-apps/r8ce093b6d93143d8aa6852f/`。
- 生产环境单店 App 固定为 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/`。
- 多店 App `q0844640cf6734877a3193d6` 的当前生产发布配置 MUST 使用 `environment=production`，门店详情必须跳转生产单店 App `aca59d2e2e60f4be4b8b93ac`；`singleStoreAppUrls.test` 保留测试单店 `r8ce093b6d93143d8aa6852f` 作为历史/测试映射，但当前发布不得选用它。

**规则：**
- MUST 每个门店销售表现行末尾展示“门店详情”跳转按钮。
- MUST 点击按钮进入当前运行环境配置的一期单店诊断地址；不得在业务链接构造代码中硬编码环境地址。
- MUST `settings.json` 至少支持 `development`、`test`、`production` 三个环境；开发、测试地址可为空，空值时回退生产地址。
- MUST 生产安全兜底地址与 `singleStoreAppUrls.production` 一致，均指向生产单店 App `aca59d2e2e60f4be4b8b93ac`。
- MUST 传递大区/小区。
- MUST 传递经销商代码和经销商名称；跳转参数使用一期页面识别的 `dealerCode / dealer`，并兼容父应用语义的 `storeCode / store`。
- MUST 传递日期开始和日期结束。
- MUST 传递来源为区域门店销售表现表。
- MUST 不把整行点击作为跳转，避免误触；只允许点击按钮跳转。
- MUST 在追踪方向规则正式确认前不传临时 `focus` 方向。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| 经销商代码 | string | Yes | 非空 |
| 经销商名称 | string | Yes | 非空 |
| 大区 | string | No | 当前上下文 |
| 小区 | string | No | 当前上下文 |
| 日期开始 | date | Yes | 与区域页一致 |
| 日期结束 | date | Yes | 与区域页一致 |
| 来源上下文 | string | Yes | 标识来自多店门店销售表现 |

**输出 / 结果：**
- 打开一期单店诊断页。
- 单店页按跳转参数自动筛选到被点击门店。

**状态：**
- 默认：门店行末尾展示“门店详情”按钮。
- 加载：跳转时显示加载反馈。
- 空状态：无。
- 错误：参数不完整时不跳转并提示。
- 成功：进入一期单店诊断页并带入门店筛选。

**验收标准：**
- [ ] AC-012: Given 当前重做版页面加载完成, when 用户查看门店销售表现表, then 每家门店行末尾出现“门店详情”按钮。
- [ ] AC-013: Given 用户点击 A 店“门店详情”, when 跳转到单店页, then 链接携带 A 店经销商代码、经销商名称、日期区间、品牌、大区、小区和来源上下文，但不携带临时方向结论。
- [ ] AC-014: Given 后续确认追踪方向规则, when 再迭代单店跳转, then 才携带线索到店或试驾订单聚焦参数。
- [ ] AC-055: Given 当前环境配置了单店承接地址, when 用户点击“门店详情”, then 使用当前环境地址；Given 开发/测试地址为空、配置读取失败或环境值非法, then 回退生产地址，且 AC-013 的参数协议不变。
- [x] AC-291: Given 当前准备发布既有多店 App `q0844640cf6734877a3193d6`, when 审查 `settings.json`、运行时解析和门店详情链接, then 当前 `environment` 必须为 `production`，`singleStoreAppUrl` 必须解析为 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/`，门店详情最终 URL host/path 必须为生产单店 App 且继续携带经销商、日期、品牌、大区、小区、车系和来源参数；不得通过测试伪覆盖掩盖 `settings.json` 当前值。完成证据：runtime Node 合同、PC Playwright 合同和 dist 构建产物 URL 构造均通过。

### REQ-006: 大平台嵌入参数适配

**优先级：** P0  
**关联任务：** TASK-005  
**关联流程：** FLOW-001  

**用途：**  
让 2 期页面作为零售智能驾驶仓「零售过程」Tab 的 iframe 子应用运行，并跟随父应用统一筛选上下文。

**行为：**  
父应用打开子应用时，通过 URL Query 传入筛选和主题参数。子应用首次加载时读取参数，并用于初始化数据查询和页面状态；父应用筛选变化时通过 iframe 重新打开子应用 URL，子应用按新 URL 重新加载。

**规则：**
- MUST 读取 `startDate / endDate / brand / brandCode / region / regionCode / district / districtCode / dealer / dealerCode / dealerShortName / theme / previewMode`；父应用仍传 `period` 时兼容读取其日期范围语义，不得覆盖有效的明确 `startDate / endDate`。
- MUST 将 `全部` 视为不过滤，不得把 `全部` 当作真实业务值查询。
- MUST 品牌筛选使用 `brand` 品牌名称；大区、小区、经销商筛选分别使用 `regionCode / districtCode / dealerCode`。
- MUST `dealerShortName` 仅作为经销商简称展示和无编码兼容上下文，不作为主筛选字段。
- MUST 父应用切换上级筛选且下级代码为空或 `全部` 时，不残留旧下级过滤。
- MUST 参数缺失时使用默认值，不阻塞页面渲染。
- MUST 参数异常时展示默认值或空态，不白屏。
- MUST 子应用不重复展示大平台顶部导航、全局筛选区、白天/黑夜切换和保存长图菜单；Super App 头部筛选器在嵌入态隐藏且不挂载交互筛选逻辑。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| startDate | date | Yes | `YYYY-MM-DD`，缺失时默认昨天所在月份 1 号 |
| endDate | date | Yes | `YYYY-MM-DD`，缺失时默认昨天 |
| period | string | No | 兼容现行日期范围语义；与明确 `startDate / endDate` 同时存在时，以明确起止日期为准 |
| brand | string | Yes | 具体品牌名称或 `全部`，作为品牌筛选字段 |
| brandCode | string | No | 品牌编码，仅保留为上下文，不作为统一筛选主字段 |
| region | string | No | 大区名称或简称，用于展示上下文 |
| regionCode | string | No | 大区编码，作为大区筛选字段 |
| district | string | No | 小区名称或简称，用于展示上下文 |
| districtCode | string | No | 小区编码，作为小区筛选字段 |
| dealer | string | No | 经销商名称，用于展示上下文 |
| dealerCode | string | No | 经销商代码，作为经销商筛选字段 |
| dealerShortName | string | No | 经销商简称，用于展示和兼容上下文 |
| theme | enum | Yes | `light` / `dark`；未知值按 `light` |
| previewMode | enum | Yes | `light` / `dark`；优先级高于 `theme` |

**输出 / 结果：**
- 子应用筛选上下文。
- 子应用查询条件。
- 子应用主题模式。

**状态：**
- 默认：按 URL Query 初始化。
- 加载：参数解析后进入数据加载。
- 空状态：参数有效但无数据时展示空态。
- 错误：参数异常时使用默认值或展示明确错误，不白屏。
- 成功：筛选和主题与父应用一致。

**验收标准：**
- [ ] AC-015: Given 父应用首次打开子应用, when URL 包含 7 个约定参数, then 子应用能全部读取并用于初始化。
- [ ] AC-016: Given `brand=全部`, when 子应用构造查询条件, then 不增加品牌过滤条件。
- [ ] AC-017: Given 父应用切换大区且 `district=全部&store=全部`, when 子应用刷新, then 不保留旧小区和旧门店过滤。
- [ ] AC-018: Given URL 参数缺失或异常, when 子应用加载, then 页面不白屏并使用默认值或空态。

### REQ-007: 白天/黑夜主题兼容

**优先级：** P0  
**关联任务：** TASK-005  
**关联流程：** FLOW-001  

**用途：**  
让 iframe 内外视觉模式一致，避免父应用是黑夜模式而子应用仍是白底页面。

**行为：**  
子应用根据 `previewMode || theme || light` 初始化主题，并在父应用参数变化时同步更新页面背景、文字、卡片、边框、图表和状态色。

**规则：**
- MUST `previewMode` 优先于 `theme`。
- MUST `theme=dark` 或 `previewMode=dark` 时展示黑夜模式。
- MUST `theme=light` 或 `previewMode=light` 时展示白天模式。
- MUST 图表、SVG、Canvas 或第三方图表主题同步切换。
- MUST 截图导出时使用当前主题，不得强制改回白天模式。
- SHOULD 不在子应用内提供独立主题切换入口；主题动作由父应用右上角菜单触发。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| theme | enum | Yes | `light` / `dark` |
| previewMode | enum | Yes | `light` / `dark` |

**输出 / 结果：**
- 与父应用一致的页面视觉模式。
- 与主题一致的图表和导出图片。

**状态：**
- 默认：按 `previewMode || theme || light` 初始化。
- 加载：主题先于数据生效，避免闪白。
- 空状态：空态样式跟随主题。
- 错误：异常提示样式跟随主题。
- 成功：全页视觉与父应用一致。

**验收标准：**
- [ ] AC-019: Given URL 为 `theme=dark&previewMode=dark`, when 子应用打开, then 页面背景、文字、卡片和图表均为黑夜模式。
- [ ] AC-020: Given 父应用切换为白天模式, when iframe URL 更新, then 子应用切换为白天模式。
- [ ] AC-021: Given 子应用处于黑夜模式, when 父应用导出长图, then 子应用返回的截图保持黑夜样式。

### REQ-008: 长图导出截图协作

**优先级：** P0  
**关联任务：** TASK-006  
**关联流程：** FLOW-001  

**用途：**  
父应用保存当前页面为长图时，能把跨域 iframe 内的零售过程页面真实画面纳入最终长图。

**适用范围：**  
本需求及 AC-022 至 AC-025 仅适用于 PC 入口。移动端入口不提供导出按钮，不监听或响应移动端 `RETAIL_CAPTURE_REQUEST`。

**行为：**  
父应用通过 `window.postMessage` 向子应用发送 `RETAIL_CAPTURE_REQUEST`。子应用校验来源和请求参数，等待页面数据、图表、字体、图片和页面高度稳定后，生成完整可滚动内容的 PNG 长图，并返回 `RETAIL_CAPTURE_RESPONSE`。失败时返回明确 `error`。

**规则：**
- MUST 监听父应用 `RETAIL_CAPTURE_REQUEST`。
- MUST 校验 `event.origin`，只接受可信父应用来源；本地联调可允许 `http://localhost:8000`，线上必须替换为真实 Super APP 域名。
- MUST 请求中 `requestId` 原样返回，便于父应用匹配响应。
- MUST 截图前等待数据接口、图表、图片、字体和页面高度稳定。
- MUST 返回 PNG `dataUrl`、`width`、`height`。
- MUST 失败或超时时返回 `{ type: 'RETAIL_CAPTURE_RESPONSE', requestId, error }`。
- MUST 子应用截图只包含子应用完整内容，不包含父应用头部导航和筛选区。
- MUST 截图时隐藏子应用内部非业务浮层、调试入口、临时提示。
- SHOULD 子应用内部截图超时不超过 10 秒。
- SHOULD 控制返回图片体积；极长页面后续可升级 Blob URL 或分片传输。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| type | string | Yes | 必须为 `RETAIL_CAPTURE_REQUEST` |
| requestId | string | Yes | 非空，响应必须原样返回 |
| theme | enum | Yes | `light` / `dark` |
| filters.period | string | Yes | 与父应用当前筛选一致 |
| filters.brand | string | Yes | 具体品牌或 `全部` |
| filters.area | string | Yes | 具体大区或 `全部` |
| filters.district | string | Yes | 具体小区或 `全部` |
| filters.store | string | Yes | 具体门店或 `全部` |

**输出 / 结果：**
- 成功：`RETAIL_CAPTURE_RESPONSE` + PNG `dataUrl` + `width` + `height`。
- 失败：`RETAIL_CAPTURE_RESPONSE` + `requestId` + 明确 `error`。

**状态：**
- 默认：等待父应用截图请求。
- 加载：收到请求后等待页面稳定并生成图片。
- 空状态：页面无数据时仍返回包含空态的截图。
- 错误：截图失败时返回错误响应。
- 成功：父应用可用子应用截图替换 iframe 区域并合成长图。

**验收标准：**
- [ ] AC-022: Given 父应用发送 `RETAIL_CAPTURE_REQUEST`, when 子应用页面已渲染完成, then 子应用返回同一 `requestId` 的 PNG `dataUrl`、`width`、`height`。
- [ ] AC-023: Given 消息来自非可信 origin, when 子应用收到截图请求, then 子应用忽略请求且不返回业务数据。
- [ ] AC-024: Given 页面图表仍在加载且超过截图超时, when 子应用无法生成图片, then 返回明确 `error`。
- [ ] AC-025: Given 页面为长页面, when 父应用导出长图, then 子应用返回完整可滚动内容截图而不只截首屏。

### REQ-009: 移动端独立页面与卡片流

**优先级：** P0  
**关联任务：** TASK-007, TASK-008  
**关联流程：** FLOW-002

**用途：**  
在不改变 PC 端页面的前提下，为上游移动端应用提供适合手机查看的零售过程子应用。

**行为：**  
系统通过同项目内独立移动端入口复用 PC 端的数据查询、URL 参数解析、指标计算和门店详情跳转能力，只重做移动端信息结构、交互和样式。页面沿用企业数据产品风格，以两列指标卡和纵向门店卡片流承载内容，并按上游 `previewMode / theme` 跟随 light/dark 主题。

**规则：**
- MUST 新增独立移动端页面入口；具体路径在开发阶段确定，不得复用 PC URL 后仅靠屏幕宽度切换布局。
- MUST 保持 PC 页面、PC URL、PC 表格、PC 导出能力和全部既有 PC 验收标准有效。
- MUST 只接受上游 URL 参数，不渲染品牌、大区、小区、门店、日期筛选器或筛选摘要；参数名、代码筛选字段、`全部` 语义、日期默认规则和主题优先级与 REQ-006/REQ-007 一致。
- MUST 按 `previewMode || theme || light` 跟随上游 light/dark 主题，不得把移动端限定为亮色，也不得提供自建主题入口。
- MUST 不渲染子应用标题栏、返回按钮、上游导航和设备切换入口；首个业务区块直接为核心指标。
- MUST 核心指标使用两列卡片布局，默认展示 `订单`、`交付率`、`零售`、`线索到店率`；点击“展开全部”后按顺序追加 `到店试驾率`、`试驾订单率`、`线索订单率`，并支持收起。
- MUST 指标当前值、月环比、周环比及空值规则复用 REQ-001，不得形成移动端独立口径。
- MUST 保留“销售表现”“过程表现”切换，默认激活销售表现；两个视图均采用纵向门店卡片流，不使用 PC 横向表格或横向滚动查看字段。
- MUST 销售表现卡片收起态展示经销商名称、所属大区/小区上下文、主问题徽标和五步漏斗（线索、到店、试驾、订单、零售），让用户无需展开即可完成门店快速扫描。
- MUST 销售表现卡片展开态在收起态信息基础上追加订单排名/占比、零售排名/占比、完整诊断结论、“展开指标/收起指标”控制和“门店详情”操作；排名、占比和诊断文案口径复用 PC 端。
- MUST 当前页首张销售表现卡片初次渲染时默认展开，其余卡片默认收起。用户手动展开/收起后，以当前页本次操作状态为准。
- MUST 过程表现卡片收起态展示经销商名称、线索到店率、到店试驾率、试驾订单率、线索订单率；展开态保留 PC 过程表现已有的邀约与试驾接待 9 项问题标签，以及每项当前值、月环比、周环比。
- MUST 每张销售表现卡片提供“门店详情”，按 REQ-005 构造跳转上下文；过程表现卡片可复用同一入口，不得生成另一套门店详情参数协议。
- MUST 销售表现和过程表现分别分页，每页固定 15 家；分页只展示“上一页、当前页/总页数、下一页”和“跳至第 X 页”。
- MUST 第 1 页禁用上一页，末页禁用下一页；总页数按 `ceil(可见门店总数 / 15)` 计算；跳页输入只接受有效范围内整数，空值、小数、非数字、0、负数或超过总页数均不得翻页并提示有效范围。
- MUST 切换销售/过程表现后展示目标 tab 的有效当前页；若目标 tab 当前页超过其总页数，则归到第 1 页。除这一边界外，不新增独立保存页码或恢复已访问页展开状态策略。
- MUST 移动端不提供任何导出按钮、截图协作入口或无限滚动；父应用如需移动端导出属于后续需求。
- MUST 可点击控件提供可见按压/焦点状态和可读的无障碍名称，页面业务内容不得出现横向溢出。

**输入：**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---:|---|
| 上游 URL Query | object | Conditional | 字段及校验与 REQ-006 一致；缺失/非法按该需求的容错和错误规则处理 |
| 表现类型 | enum | Yes | `sales` / `process`，默认 `sales` |
| 页码 | integer | Yes | 默认 1，范围 `1..总页数` |
| 卡片展开状态 | set | No | 页面会话内状态，不写回数据源 |

**输出 / 结果：**
- 两列核心指标卡及展开/收起后的完整七项指标。
- 销售表现或过程表现门店卡片流。
- 简化分页、跳页校验和门店详情跳转。

**状态（五态）：**
- 默认/成功：参数有效且有数据时，展示四项核心指标、默认销售表现、当前页 15 家以内门店卡片，首张展开、其余收起。
- 加载：指标区和门店卡片分别显示与最终结构一致的骨架；翻页、切 tab 时只替换对应区域，不允许重复提交翻页。
- 空状态：参数有效且当前范围无业务数据时，指标区展示“--”，门店区提示“当前筛选范围暂无门店表现数据”，保留可用的重试动作，不伪造 0 值。
- 错误：参数解析或数据请求失败时显示错误原因类别和“重试”；参数非法时指出无效参数，不发起错误范围查询；已成功数据不得被错误态静默覆盖。
- 无权限：仅当权限校验明确失败时提示“暂无该范围数据权限”，不展示门店数据、不自动扩大到其他范围。权限校验通过但可见门店数或业务结果为 0 时必须进入空状态，禁止用 0 行结果反推无权限。

**验收标准：**
- [ ] AC-042: Given 上游移动端应用以 iframe 打开移动端独立入口, when URL 参数有效, then 首屏直接展示订单、交付率、零售、线索到店率四项指标，不出现标题栏、返回按钮、导航、筛选器或筛选摘要。
- [ ] AC-043: Given 四项核心指标已展示, when 用户点击“展开全部”, then 按到店试驾率、试驾订单率、线索订单率顺序追加三项转化率，且值与 PC 由相同原始分子分母计算的结果一致；when 用户收起, then 恢复四项指标。
- [ ] AC-044: Given 销售表现第 1 页加载完成, when 用户查看门店区, then 以卡片流展示不超过 15 家门店，首张卡展开、其余收起，且不存在横向业务表格。
- [ ] AC-045: Given 一张销售表现卡片处于收起态, when 用户查看卡片, then 只展示经销商名称、所属大区/小区、主问题徽标和线索/到店/试驾/订单/零售五步漏斗，不展示排名占比、完整诊断结论和门店详情操作。
- [ ] AC-054: Given 一张销售表现卡片处于收起态, when 用户点击展开, then 卡片追加订单排名与占比、零售排名与占比、完整诊断结论、“收起指标”控制和“门店详情”操作；when 用户点击收起, then 恢复 AC-045 的收起态信息层级。
- [ ] AC-046: Given 用户切换到过程表现, when 卡片加载完成, then 收起态按线索到店率、到店试驾率、试驾订单率、线索订单率显示四项转化率；when 展开卡片, then 仍显示邀约与试驾接待 9 项问题标签及对应当前值、月环比、周环比。
- [ ] AC-047: Given 门店总数 340 且每页 15 家, when 分页渲染, then 总页数为 23；第 1 页上一页禁用，第 23 页下一页禁用。
- [ ] AC-048: Given 总页数为 23, when 用户输入空值、小数、非数字、0、负数或大于 23 的页码, then 页面不翻页并提示请输入 1 至 23 的整数。
- [ ] AC-049: Given 用户点击某门店“门店详情”, when 新页面打开, then 跳转参数与 PC 端 REQ-005 一致并包含当前 URL 上下文。
- [ ] AC-050: Given 移动端页面加载完成, when 用户检查全部操作区域或父应用发送移动端截图请求, then 不存在导出、无限滚动、设备判断或 PC/移动入口切换能力，且移动端不监听、不响应截图协议。
- [ ] AC-051: Given 权限校验明确失败, when 页面完成状态判定, then 展示无权限状态且不扩大查询范围；Given 权限校验通过但可见门店数或业务结果为 0, when 页面完成状态判定, then 展示空状态且不得反推为无权限；URL 参数缺失/非法或请求失败时分别展示容错/错误状态，不白屏。
- [ ] AC-052: Given PC 页面在移动端开发前可正常访问, when 移动端入口发布, then PC URL、页面结构和既有 PC 验收结果不发生变化。
- [ ] AC-053: Given 移动端入口首次加载, when GIO SDK 和身份补全链路初始化, then 复用 `smartmind_sale_View` 且只初始化一次、上报一次，`pageName` 沿用现有页面标题/事件清单口径，事件不包含 token、身份证、完整密钥等敏感信息；如需区分端来源，必须另行确认且不得自行新增事件名。

### AI 能力规格

| AI 功能 | 能力类型 | 质量条 | 触发方式 | 不确定时 | 服务降级 |
|---|---|---|---|---|---|
| 无 P0 AI 功能 | - | - | - | - | - |

**AI 护栏：**
- P0 不启用前端实时 AI 诊断。
- P0 不由 AI 生成官方重点追踪方向、排名或跨组织对标。
- 后续如启用 AI 解释，只能基于已沉淀事实包生成解释，不得改写漏斗数值和重点追踪方向。

### REQ-010: PC 应用级车系筛选

**优先级：** P0  
**关联任务：** TASK-001、TASK-002、TASK-012  
**适用范围：** 仅 `multi-store-super-app/` 的 PC 根入口；不修改一期 `../super-app/`，不开发移动端。

**用途：**  
在不改变品牌、大区、小区、经销商、日期、权限白名单、组织下钻、排序和移动端边界的前提下，让用户从品牌级真实车系枚举中不限数量多选，并以同一选中集合收窄整个多店销售视图；同时清楚知道过程事实不具备销售 `汇报车系名称` 同口径过滤能力。

**枚举、排序与筛选口径：**
- MUST 以销售漏斗数据集 `k4c14c31c595540a0a771f50` 的真实字段 `汇报车系名称` 同时作为车系枚举来源和销售事实过滤字段；不得使用 DCC、试驾、订单或标签表的 `车系名称`、`闭环车系名称` 等字段替代，也不得写死任何车系列表。
- MUST 按当前品牌单独读取全量车系枚举，枚举查询只受品牌影响，不受当前门店、大区、小区、经销商、日期或本次销售结果行数影响；品牌为“全部”时沿用一期单店对该品牌状态的真实查询/容错行为，不拼接静态枚举。
- MUST 与一期 `../super-app/src/services/storeDiagnosis.ts` 的 `compareVehicleSeriesOptions` 使用完全同构的排序：置顶 `全新MG4`、`MG 4X`、`MG 07`（仅当真实枚举存在）；其余有效值使用 `zh-CN` 比较；置底 `其他车系`、`未知车系`、`位置车系`（仅当真实枚举存在）。本项目不得维护第二套比较器。
- MUST 默认值、无具体选择和取消最后一个具体选项后的“不过滤”语义均为 `全部车系`；该值不是销售字段值，不得作为 SQL 条件传入。
- MUST 选中集合以相同 `汇报车系名称 IN (...)` 语义同时作用于当前、上月同期、上周同期销售事实；销售漏斗卡、四项顶部转化率、销售表现行、销售导出、订单/零售目标与达成、订单/零售排名及占比均根据筛选后的销售原始分子分母重新计算；全部车系不附加车系条件。
- MUST 选中集合只保存真实枚举值，按枚举排序后的稳定顺序参与 URL、缓存键、埋点和请求参数；不得按用户点击顺序、字符串字典序或接口返回抖动顺序生成不稳定状态。
- MUST 保持 v1.53 排序：筛选后当前清单为大区时仍按名称数字前缀升序；为小区或经销商时仍按筛选后 `current.orders` 降序、同订单按代码升序；销售表现与过程表现保持同一组织行序。车系筛选不得改写权限白名单、日期筛选、下钻路径、订单/零售排名公式或占比公式。

**URL、刷新与缓存：**
- MUST URL 规范参数为重复 `vehicleSeries`，例如 `vehicleSeries=全新MG4&vehicleSeries=MG%2007`；序列化顺序必须按当前品牌枚举排序稳定输出。历史 `vehicleSeries` 单值、`carSeries` 单值和 `series` 单值均可兼容读取；发生任何本地筛选变更或 URL 归一后，只保留规范化后的重复 `vehicleSeries`，清除 `carSeries/series` 别名。
- MUST URL 重载时将重复 `vehicleSeries` 与历史单值别名归一为选中集合；非法、空白或不在当前品牌真实枚举中的值剔除，剔除后无具体选项则回到 `全部车系`。
- MUST 车系选中集合成为页面刷新上下文、GIO/页面埋点上下文和所有销售/目标查询缓存键的一部分；同一品牌、日期、组织范围下不同集合不能读取或回填彼此缓存。URL 重载必须恢复同一集合选择并按该集合重新查询。
- MUST 用户切换品牌时先将车系重置为 `全部车系`，再按新品牌加载枚举和销售结果；不得把旧品牌车系带入新品牌查询。刷新、重试和父应用 URL 变化必须保持该顺序。

**视觉与交互对标：**
- MUST 将唯一的 `#vehicleSeriesFilter` 放在多店销售区的应用级“销售总览”标题行右侧；该标题行位于销售指标框和过程指标框整体上方，筛选器不得作为任何 `.metric-panel`（含销售指标单框）子元素，不得复制第二个筛选器。
- MUST 标签为“车系”；触发器 0 项显示“全部车系”，1 项显示车系名称，2 项及以上显示“已选 N 个车系”。下拉指示箭头在展开/收起时上下切换；不得只按截图另造样式。
- MUST 下拉容器宽度为 `176px–280px`、高度 `36px`、白底、`1px solid rgba(49, 107, 255, 0.18)` 边框、`8px` 圆角、阴影 `0 6px 14px rgba(17,35,70,.06)`；标签为 `12px` 粗体，选中值为 `13px/800`。
- MUST 菜单相对触发器向下 `6px`，使用 `1px solid rgba(49, 107, 255, 0.18)` 边框、`8px` 圆角、阴影 `0 12px 28px rgba(17,35,70,.14)`、内边距 `6px`、最大高 `260px` 和 `overflow:auto`；选项高 `32px`，已选背景 `#eef5ff`，悬停背景 `#f3f7ff`。超出高度时只滚动菜单本身。
- MUST 菜单内使用复选项：点击具体车系切换勾选且菜单保持展开，可连续切换；点击“全部车系”清空全部具体选择；取消最后一个具体选项后自动回到“全部车系”。
- MUST 支持点击触发器展开/收起、点击外部关闭、`Escape` 关闭并把焦点归还触发器、展开态上下箭头和 `aria-expanded` / 可读标签；列表必须声明 `aria-multiselectable`，每个选项必须有 `aria-selected`，且有可见勾选态。键盘焦点、选中态与滚动行为必须与一期可观察行为一致。

**数据源覆盖与显式边界：**

| 链路 | 真实车系字段审计 | 本轮行为 |
|---|---|---|
| 销售漏斗、四项转化率、销售表现、销售导出、订单/零售目标与达成、刷新、埋点、缓存 | `k4c14c31c595540a0a771f50.汇报车系名称` | 与枚举同字段按选中集合过滤；当前/上月/上周、排名、占比、组织排序、订单目标口径实际和零售目标口径实际按筛选后的销售事实重算；全部车系不加条件 |
| 顶部过程 4 卡 | 选中车系后的销售事实 `state.data` 三阶段值 | v1.93 起必须按同一车系集合重算；不得继续读取无车系 `processBaselineData` |
| IP 电话邀约问题率（历史/实时） | `ip.history`：数据流 `mf0b3f3f6a49f476eab32076`、DS `n418e47dacdb94291993d3d9`、字段 `周期首次意向闭环车系名称`；`ip.realtime`：DS `ta1978fc86ae745009d0eff4`、同字段 | 历史源用规范值精确过滤且 `其他车系`精确；实时源用 raw 映射过滤，`其他车系`为 MG 品牌内补集；空值/null 不算未知或其他 |
| 试驾问题率（历史/实时） | `drive.history`：数据流 `i81d40fe25d0042ecae6e59b`、DS `g9da02067b8a6432486f58f9`、字段 `车系名称`；`drive.realtime`：DS `ie2f283f63154402282c4968`、过滤字段 `闭环车系` | 历史源用 raw 映射过滤，`其他车系`为 MG 品牌内补集；实时源用规范 `闭环车系` 精确过滤，`车系名称`只作审计对照；`MG4 EV` 不并入 `全新MG4` |

- MUST v1.93 起，选中任一具体车系或车系集合时，过程表现 Tab、过程导出、查看全部经销商过程表现和动态诊断过程数据必须继承同一车系选择；不得再用旧边界说明包装未过滤的过程值。
- MUST 销售导出只导出已按 `汇报车系名称` 选中集合过滤后的销售结果；过程导出必须导出已按同一车系集合过滤后的过程指标，并保留既有 CSV 文件格式、转义/公式注入防护和导出入口。
- MUST 本节车系边界不再排除“过程分析”Tab；“打铁指标”Tab 自 v1.92 起按 REQ-012 独立执行来源级物理车系字段审计和 SQL-only 过滤，v1.93 起修复打铁 11 项遗留缺口及高意向低水平 `周期最近意向闭环车系` source/dist 漂移。
- MUST 自 v1.93 起，销售车系多选集合同时驱动“过程分析”Tab 和“打铁指标”Tab 的当前、上月同期、上周同期查询；不得读取销售 `汇报车系名称` 代理到异名来源，也不得返回全部车系结果冒充具体车系结果。
- MUST 明确区分动态组织排名/占比与独立官方排名结果：当前多店 `organization-view` 基于已过滤 `peerRows` 动态计算的 `orderRank/retailRank/orderShare/retailShare` 必须继续展示，并随车系多选集合重算；只有独立官方排名、官方分位或官方诊断结果表缺少车系维度时，才继续隐藏或保持既有不可用降级，不得展示全盘官方结果冒充车系集合结果。

**验收标准：**
- [x] AC-090（历史记录，v1.65 已升级为多选）: Given 用户进入 PC 页面且未传车系参数, when 筛选器和销售数据加载完成, then 显示“车系 / 全部车系”，且销售结果等价于未附加 `汇报车系名称` 条件的当前品牌、组织、日期范围。当前多选默认与无选择仍沿用该“全部车系”语义，但实现验收以 AC-135 起为准。
- [x] AC-091: Given 当前品牌有全量真实车系枚举, when 下拉展开, then 选项只由销售漏斗 `汇报车系名称` 的品牌级全量查询生成；当前门店、日期无数据的真实车系仍可见，项目源码不存在硬编码业务枚举或独立排序实现。
- [x] AC-092: Given 枚举同时含置顶、中间和置底真实车系, when 下拉渲染, then 行序与一期 `compareVehicleSeriesOptions` 一致：`全新MG4/MG 4X/MG 07` 在前，其他值按 `zh-CN`，`其他车系/未知车系/位置车系` 在后；不存在的值不虚构。
- [x] AC-093（历史记录，v1.65 已升级为多选菜单）: v1.55/v1.57 单选展开态曾验证触发器/菜单尺寸、滚动、外点、`Escape` 和 ARIA；当前菜单复选、连续切换、`aria-multiselectable` 与 1440×900 证据必须以 AC-136、AC-142 为准。
- [x] AC-094（历史记录，v1.65 已升级为选中集合）: v1.55 单车系联动曾验证通过；当前销售事实、顶部指标、销售表现、导出、排名、占比和目标必须以多选集合联动，验收以 AC-138、AC-141 为准。
- [x] AC-095（历史记录，v1.65 已升级为重复参数）: v1.55 单值 `vehicleSeries/carSeries/series` 兼容曾验证通过；当前 URL 必须规范为重复 `vehicleSeries` 并清除别名，验收以 AC-137 为准。
- [x] AC-096: Given 用户先选中 MG 的真实车系再切换品牌, when 新品牌枚举加载, then 选择自动回到“全部车系”，不存在旧车系 SQL 条件、旧选中值或旧缓存结果。
- [x] AC-097: Given 选中具体车系且用户切换到过程表现或导出过程数据, when 页面/导出渲染, then 显示固定边界说明；DCC、试驾、订单及 IP/试驾标签不因销售车系筛选被伪过滤或标为已联动。
- [x] AC-098: Given 车系筛选前后分别展示大区、小区或经销商清单, when 组织行重算, then AC-088/AC-089 的大区数字前缀升序及小区/经销商订单降序仍成立，两个 Tab 行序一致，权限白名单、日期和下钻行为不回归。
- [x] AC-099: Given 用户在 1440px PC 页面查看或展开车系菜单, when 对照销售区整体布局, then 唯一 `#vehicleSeriesFilter` 位于“销售总览”标题行右侧、两组指标框上方且不在任一 `.metric-panel` 内；筛选器宽度、间距和展开态不挤压销售指标或过程指标。
- [x] AC-135: Given 用户进入 PC 页面且未传任何车系参数, when 筛选器、枚举和销售数据加载完成, then 触发器显示“车系 / 全部车系”，选中集合为空，当前/月同期/周同期销售事实、顶部指标、销售概览、销售导出、排名/占比和订单/零售目标与达成均不附加 `汇报车系名称` 条件。
- [x] AC-136: Given 车系菜单已展开, when 用户连续点击多个具体车系复选项, then 每次只切换该项勾选状态且菜单不关闭；点击外部或按 `Escape` 才关闭并把焦点归还触发器；列表声明 `aria-multiselectable`，每个 option 的 `aria-selected` 与可见勾选一致。
- [x] AC-137: Given URL 含重复 `vehicleSeries` 或历史单值 `vehicleSeries/carSeries/series`, when 页面归一化完成, then 选中集合只保留当前品牌真实枚举值并按枚举顺序稳定写回重复 `vehicleSeries`，同时清除 `carSeries/series`；空值、非法值或取消最后一项均回到“全部车系”。
- [x] AC-138: Given 用户选择 2 个及以上真实车系, when 当前、上月、上周销售查询完成, then 顶部订单/交付率/零售、四项顶部转化率、销售概览、销售导出、订单/零售排名与占比均基于 `汇报车系名称 IN (选中集合)` 的同一销售事实重算；触发器显示“已选 N 个车系”。
- [x] AC-139: Given 用户点击“全部车系”或逐项取消到 0 个具体车系, when 数据刷新完成, then URL 移除全部具体车系参数，缓存键回到全部车系语义，销售与目标结果等价于未附加车系条件。
- [x] AC-140: Given 用户先选中多个 MG 真实车系再切换品牌, when 新品牌枚举加载, then 选中集合先清空并显示“全部车系”，不得保留旧品牌 URL 参数、SQL 条件、缓存、埋点上下文或旧请求回填。
- [x] AC-141: Given 车系多选集合在单一自然月内变化, when 订单/零售目标口径加载, then 订单目标、零售目标、两类目标口径实际、两类目标达成率、目标状态和销售导出目标字段均使用同一车系集合；全部车系汇总全部有效目标车系，任一具体集合只汇总命中集合的目标自然键。
- [x] AC-142: Given 用户在 1440×900 PC 页面展开多选车系菜单并完成至少 3 次勾选/取消, when 保存自动化截图和断言, then 唯一 `#vehicleSeriesFilter` 仍位于“销售总览”标题行右侧、两组指标框上方且不在任一 `.metric-panel` 内，菜单 260px 内部滚动、触发器 0/1/N 项文案、复选勾选、外点/Escape、无横向溢出、权限/日期/组织下钻/排序不回归均有证据。

验证证据：npm test 90/90、test:pc 43/43、lint/build/audit exit 0；source/dist、1440x900 多选展开态截图、安全和未发布边界已通过；两阶段 Review Stage 1/2 PASS，最终 QA PASS，P0/P1/P2=0/0/2，2 项 P2 为非阻断（大文件职责集中、无车系 baseline 完整 loader 性能冗余）；本目标不发布，未 commit、未 push。

v1.93 待开发补充验收：
- [ ] AC-309: Given PC 车系选中集合为任一具体车系或多选集合, when 顶部过程 4 卡渲染当前值、月环比和周环比, then 线索到店率、到店试驾率、试驾订单率、线索订单率全部只读取已选车系后的销售事实 `state.data` 当前/上月同期/上周同期三阶段原始分子分母；不得读取清空车系后的 `processBaselineData`、全部车系缓存或旧无车系过程基线。
- [ ] AC-310: Given 用户切换到“过程分析”Tab, when 当前/月/周三阶段过程 9 项完成加载, then `线索到店率` 与 `试驾订单率` 来自同一车系集合过滤后的销售事实，4 项 IP 电话邀约问题率和 3 项试驾问题率来自各自过程来源 SQL 过滤；9 项的日期、组织、权限、车系集合、请求 identity、缓存键和错误状态三阶段同构，仅日期范围不同。
- [ ] AC-311: Given 过程分析 7 项标签问题率构造 SQL, when 审查四类来源字段, then `ip.history` 必须使用数据流 `mf0b3f3f6a49f476eab32076` / DS `n418e47dacdb94291993d3d9` 的 `周期首次意向闭环车系名称`，`ip.realtime` 必须使用 DS `ta1978fc86ae745009d0eff4` 的 `周期首次意向闭环车系名称`，`drive.history` 必须使用数据流 `i81d40fe25d0042ecae6e59b` / DS `g9da02067b8a6432486f58f9` 的 `车系名称`，`drive.realtime` 必须使用 DS `ie2f283f63154402282c4968` 的过滤字段 `闭环车系`；实时试驾表同时存在的 `车系名称` 只能作审计对照，不能作为过滤字段。
- [ ] AC-312: Given 过程来源返回原始车系值, when 映射到销售闭集, then `ip.history` 与 `drive.realtime` 对规范值精确过滤，`ip.realtime` 与 `drive.history` 使用静态 raw mapper；普通车系只能映射为销售闭集值，`MG07 EV/MG07 DMH -> MG 07`、`MG Cyberster -> Cyberster`、`新一代MG5/2023款MG5/全新MG5天蝎座 -> MG5` 按来源审计表执行，`MG4 EV` 不得并入 `全新MG4`，空值/null 不算 `未知车系` 或 `其他车系`。
- [ ] AC-313: Given 用户选择 `其他车系` 或 `未知车系` 查看过程分析, when 四类过程来源聚合, then `未知车系` 只匹配原始值“未知”，无“未知”样本展示 `--`；`其他车系` 在有精确规范值的来源精确过滤，在 raw source 没有精确值的来源只按 MG 范围内排除全部已映射销售闭集后的补集计算，非 MG、空值和 null 不进入补集；不得因当前日期、组织或查询结果动态切换策略。
- [ ] AC-314: Given 用户选择普通单车系、多选集合、`其他车系`、`未知车系` 或包含 `MG4 EV` 原始样本的范围, when 过程 SQL 字段缺失、字段不可查询、映射不可证、SQL/业务码失败、触达上限或完整性不可证, then 对应过程来源和阶段 fail-closed 为 `数据不完整` 并保留字段缺口说明；真实无样本展示 `--`，合法 0 分子展示 `0.0%`；只有 `全部车系` 语义下可保留既有无车系 legacy fallback。
- [ ] AC-315: Given 车系选中集合非空且用户执行过程导出、进入“查看所有经销商”扁平态或触发动态诊断刷新, when 导出/扁平行/诊断过程数据生成, then 三者必须继承同一车系集合和同一来源级过滤结果；CSV 不再输出“过程未联动车系”的静态说明，动态诊断不得使用全部车系过程值生成主问题、结果断点或证据。
- [ ] AC-316: Given v1.93 完成后执行非目标回归, when 对比 v1.92 之前已验收能力, then 销售链路 `汇报车系名称` 枚举/排序/URL、多选交互、销售漏斗、订单/零售目标与达成、排名/占比、组织权限、日期默认、下钻、分页、主题、导出入口、移动端入口、GIO 访问事件和依赖均不因过程联动改造变化。
- [ ] AC-317: Given 准备发布 v1.93, when 审查 `settings.json`、运行时配置、构建产物和门店详情 URL, then 最终 `settings.environment` 必须为 `production`，多店发布目标只允许 `re37c3447cb0443a68a36a40`，单店跳转 URL 必须固定为 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/` 且继续携带经销商、日期、品牌、大区、小区、车系集合和来源参数；不得发布 `q0844640cf6734877a3193d6`、`x944` 或其他 App。
- [ ] AC-318: Given v1.93 进入发布门禁, when 从干净 staging 构建并完成发布后验证, then staging 只能包含本阶段源码和必要配置，source/dist/zip 关键文件 hash 一致，`npm test`、`npm run lint`、`npm run build`、`npm run test:pc`、critical audit、隐私扫描和 zip 完整性均通过；发布后必须在认证态线上矩阵抽验普通车系、多选、`其他车系`、`未知车系`、过程 9 项、过程导出、查看所有经销商、动态诊断和单店跳转参数，未完成认证态矩阵前不得宣称生产验收通过。

### REQ-011: PC 订单/零售目标与目标达成

**优先级：** P0  
**关联任务：** TASK-001、TASK-002、TASK-015  
**适用范围：** 仅 `multi-store-super-app/` PC 根入口；不写目标数据集、不授权、不发布、不改一期或移动端入口。

**当前实施状态（2026-07-24）：** v1.67 / AC-151～AC-164 已完成本地开发并通过最终 QA，历史结论为订单/零售双目标均读 `r05b1e3995b0b4480991a4b8`。v1.88 已确认新增开发中/待复审合同：订单目标必须改读打铁 ETL 最终输出 `u32cb7e789f7443ff84160b4`，零售目标仍读 `r05b1e3995b0b4480991a4b8`；AC-151～AC-164 保留为历史完成事实，不回写，当前实现验收以 AC-283 起为准。真实只读查询已证 `u32 / 2026-07 / MG / 全部车系` 为 `1576` 行、七区 `1995/5597/1950/2850/2615/5179/2638`、合计 `22824`，其中 `12` 行组织代码为空但组织名称存在，订单目标 `115`，不得因空代码、`invalidKey` 或 `validDealerMap` 被排除。本次仅更新规格和计划，未改源码、未发布、未 commit、未 push。

**用途：**
在保留当前销售订单、零售、漏斗、排名、占比和组织下钻口径的前提下，让业务在默认“全部车系”及一个或多个具体车系范围内同时查看完整自然月的订单目标、零售目标及各自达成率。v1.88 起业务目标是让 Super App 订单目标与打铁运营机制看板一致，零售目标继续沿用销售转化漏斗目标表。v1.67 已实现的 PC 顶部目标信息展示位置为“销售指标”标题摘要；v1.79 曾由 REQ-013 覆盖为独立“销售经营进度”条；v1.82 曾由 REQ-013 覆盖为“销售总览”标题行中间目标摘要；v1.91 起当前已实现布局修订为“销售总览”左侧标题组内紧跟标题展示。AC-151～AC-164 保留为历史完成事实，不回写。

**数据与计算规则：**
- MUST v1.88 起订单目标与零售目标拆源：订单目标只读打铁 ETL `va7f9d6b8616a421c852b04c` 最终输出 `u32cb7e789f7443ff84160b4` / `打铁运营机制看板目标`；零售目标仍只读 `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标`。`r05` 的 `总订单目标` 不得继续参与订单目标；`h9828e20e9026475091ae6ca` / `打铁-目标上传` 只是上游输入，不得作为 App 最终订单目标源。
- MUST 订单目标字段限定为 `u32.日期、品牌、大区、小区、经销商、车系、订单目标、大区代码、小区代码、经销商代码`；订单目标以 `u32` 输出行为最小事实粒度和唯一事实源，按行 SUM `订单目标`，不按 `日期月份+品牌+经销商代码+车系` 或任一展示键二次去重、冲突作废、纠正重复行或用 `r05` 补齐。`日期、品牌、车系、订单目标` 为订单目标必需字段；`大区代码、小区代码、经销商代码` 可为空，不得把空组织代码行直接判为 invalidKey。零售目标字段仍限定为 `r05.目标日期、dealer_code、车系、总零售目标`，零售目标自然键仍为 `目标月份+MG+dealer_code+车系` 并继续执行 r05 既有去重/冲突规则。
- MUST 订单目标与零售目标组织规则拆分。订单目标展示和汇总只以 `u32` 自带组织字段为准：优先用 `大区代码/小区代码/经销商代码` 定位，代码为空但对应 `大区/小区/经销商` 名称存在时，按名称归入对应大区/小区/经销商汇总；不得因未命中 `validDealerMap`、组织代码为空或与有效经销商维表不一致而排除 `u32` 订单目标行。零售目标组织归属、权限和有效门店白名单继续只使用有效经销商维表 `a310ff90fddff4b6283841c6` 与当前 `validDealerMap`；零售目标记录若不在有效经销商白名单中，不展示、不并入顶部或清单目标，但必须计入 QA 缺口。
- MUST 新增双目标口径实际查询：订单目标实际按“自然月+品牌名称=MG+一级经销商代码+汇报车系名称”聚合 `当日订单数（首触）`；零售目标实际按同键聚合 `当日零售数`。不得从已丢失车系维度的 `salesAggregateSql` 结果计算任一目标达成。
- MUST 保持经过当前车系选中集合筛选后的顶部订单、顶部零售、销售漏斗、动态订单/零售排名和动态订单/零售占比既有销售事实口径不被目标链路改写。订单目标达成率=`目标口径实际订单/u32输出行订单目标SUM`；零售目标达成率=`目标口径实际零售/r05总零售目标`。订单目标实际分子仍只按现有有效一级经销商代码与车系匹配，无法映射到实际分子的 `u32` 订单目标行保留目标分母、分子记 `0` 并进入审计，不得通过别名补码、硬编码补差、名称反查代码或复用零售源伪造达成；实际有但无订单目标的记录仍进入既有主订单但不进入订单目标分子。
- MUST 默认“全部车系”直接汇总当前 MG、组织、日期范围内全部 `u32` 订单目标车系和 `r05 + validDealerMap` 交集内全部零售目标车系；选中一个或多个具体车系时订单目标按 `u32.车系`、零售目标按 `r05.车系` 与销售 `汇报车系名称` 的同一选中集合精确联动。不得把“全部车系”当作空目标或等用户筛选后才显示目标。
- MUST 将订单目标和零售目标分别并入展示 universe。订单目标有、订单实际无的 `u32` 组织行必须保留并展示对应订单实际 `0`；零售目标有、零售实际无的有效经销商必须生成一店一行，对应零售实际为 `0`。订单目标组织属性取 `u32` 输出组织字段，零售目标门店组织属性取现有 `validDealerMap`。全国/大区/小区/门店各层订单目标与零售目标必须分别逐层可对账。
- MUST 订单目标和零售目标只在筛选开始、结束日期属于同一自然月、非未来月且品牌为 MG 时展示；目标分母始终读取该月 1 日至月末完整自然月目标，目标口径实际订单/零售始终统计该月 1 日至今天与该月月末中的较早者。跨月或未来月筛选必须进入 `invalid_range` 空槽并发起零目标请求，隐藏两类目标和达成，不得合并多个自然月，也不得改变既有主订单、主零售、漏斗、排名、占比和过程指标的用户筛选日期口径。
- MUST 新目标 DS 仅适用于 MG。非 MG 品牌、品牌为“全部”且未明确按 MG 查询时，隐藏订单/零售两类目标和达成，不复用 MG 目标，不新增跨品牌目标提示，不影响销售主链路。

**页面与状态规则：**
- MUST PC 顶部目标信息仅在当前有效范围存在任一有效订单目标或零售目标时显示。v1.67 基线为“销售指标”标题行右侧摘要，摘要文案为 `订单目标：{订单目标}　订单达成：{订单达成率}　零售目标：{零售目标}　零售达成：{零售达成率}`；v1.79 曾由 REQ-013 迁移为独立“销售经营进度”条；v1.82 曾由 REQ-013 迁移为“销售总览”标题行中间目标摘要；v1.91 起当前已实现布局为左侧标题组内紧跟 `销售总览` 标题展示，目标数据、计算、状态和导出规则不变。
- MUST PC 顶部所有销售指标卡和过程指标卡恢复为仅展示“指标值 + 月环比 + 周环比”。月环比、周环比必须在卡内上下两行展示，禁止同一行横向并排，禁止因空间不足截断；订单卡、交付率卡、零售卡和四张过程卡内均不得再展示目标文本、目标空槽、目标提示或目标骨架。
- MUST 表格订单表现列保持“月目标｜目标达成 / 排名｜占比”2x2 骨架，含义为订单月目标与订单目标达成；零售表现也采用“月目标｜目标达成 / 排名｜占比”2x2 骨架，含义为零售月目标与零售目标达成。排名文案统一使用“排名”，保留名次/分母，不显示“全国排名/大区排名/小区排名”。
- MUST 当目标请求成功但当前有效范围没有有效订单/零售目标时，隐藏顶部目标展示区，不新增提示文案，不在顶部指标卡内保留目标空槽；表格订单表现和零售表现均保留同高空槽。订单目标源与零售目标源必须独立加载、独立失败、独立审计：订单源失败仅订单目标、订单达成和订单表格目标位不可用，零售目标仍可展示；零售源失败仅零售目标、零售达成和零售表格目标位不可用，订单目标仍可展示；既有销售主链路继续展示。
- MUST 目标大于 0 且实际为 0 显示 `0.0%`；目标为 0 时对应目标达成留空；超过 100%不封顶。目标数据加载中显示与最终区域同尺寸的骨架。订单链路与零售链路的加载、成功、无目标、失败状态必须同构但互相隔离，任何一侧不得用另一侧旧缓存或 fallback 值伪装成功。

**导出与验收：**
- MUST 销售导出字段集合保持不变：`订单月目标、订单目标口径实际、订单目标达成率、订单目标状态、未配置订单目标实际、订单目标冲突键数、零售月目标、零售目标口径实际、零售目标达成率、零售目标状态、未配置零售目标实际、零售目标冲突键数、目标有效门店缺口数`，与页面同一组织行数值一致；状态至少区分已配置、目标未产出、目标数据暂不可用、目标冲突、非 MG 隐藏、invalid_range。v1.88 起订单目标冲突字段仅作兼容审计槽，不得用于把 `u32` 同展示键多行作废；订单审计必须能区分空代码但已按名称归属、无法映射实际分子、缺必需字段、输出行 SUM 不守恒；零售目标冲突字段继续执行 r05 既有语义。
- [x] AC-115～AC-134（历史记录）: v1.61～v1.64 的旧订单目标单链路、顶部标题摘要和卡内两行环比已实现并发布测试 App；本轮 v1.67 已将目标源与目标语义替换为订单/零售双链路，当前实现验收必须以 AC-151 起为准。旧 DS `u32cb7e789f7443ff84160b4` 只作为历史记录存在，不得作为当前代码依赖。
- [x] AC-151: Given 代码进入 v1.67 目标改造, when 审查 `multi-store-super-app/data-api.js`, then 目标 DS 只使用 `r05b1e3995b0b4480991a4b8`，旧 DS `u32cb7e789f7443ff84160b4` 不再出现在当前业务代码、目标测试或构建产物引用中。
- [x] AC-152: Given 新目标表返回 `目标日期、dealer_code、车系、总订单目标、总零售目标`, when 目标归一完成, then 系统以目标月份+MG+dealer_code+车系去重；同键一致去重，订单/零售任一冲突分别作废并计数，空键、负目标、非数字目标剔除，0 目标保留且达成留空。
- [x] AC-153: Given 新目标表中存在 `area/city_name/rfs_name/mac_name` 等组织字段或缺失组织字段, when 页面聚合目标, then 组织归属只取现有有效经销商维表；不在 `validDealerMap` 的目标记录不展示、不参与顶部或清单目标，但计入目标有效门店缺口数。
- [x] AC-154: Given 2026-07 新目标表 1542 行、订单目标合计 22578、零售目标合计 18580 且无重复冲突, when 执行默认 MG 全域目标归一, then 有效白名单内目标合计可对账，5 条非命中目标记录被排除并进入 QA 缺口审计。
- [x] AC-155: Given 单一自然月 MG 筛选且目标查询成功, when 页面加载完成, then “销售指标”标题摘要同时展示订单目标/订单达成与零售目标/零售达成；顶部七张指标卡仍只展示指标值、月环比、周环比，不出现目标文本、空槽或目标骨架。
- [x] AC-156: Given 用户查看销售概览表, when 行数据加载完成, then 订单表现为订单“月目标｜目标达成 / 排名｜占比”，零售表现为零售“月目标｜目标达成 / 排名｜占比”；两列同高，排名/占比继续使用当前动态组织口径。
- [x] AC-157: Given 目标有实际无或实际有目标无, when 组织行聚合, then 目标有实际无生成实际为 0 的门店行并参与目标守恒；实际有目标无只进入主订单/主零售和对应未配置目标实际审计，不进入目标达成分子。
- [x] AC-158: Given 用户选择全部车系或多个具体车系, when 订单/零售目标口径加载, then 订单目标、零售目标、两类目标口径实际、两类达成率、目标状态和导出目标字段均使用同一车系集合；全部车系汇总全部有效目标车系，任一具体集合只汇总命中集合的目标自然键。
- [x] AC-159: Given 用户选择跨月、未来月或非 MG 品牌, when 页面和销售导出加载, then 订单/零售目标、目标达成及目标口径实际不展示或不导出为有效值，不新增跨品牌复用提示，主销售、主零售、漏斗、排名、占比和过程链路仍按原筛选范围正常展示。
- [x] AC-160: Given 目标请求失败、无权限或业务码失败, when 页面渲染, then 仅在目标摘要和对应表格目标位置显示目标数据暂不可用类状态，销售主链路、过程卡、排名、下钻和导出主字段继续可用。
- [x] AC-161: Given 销售导出, when 用户导出当前组织层级, then 订单目标与零售目标相关字段齐全，数值与页面同一组织行一致，并包含冲突键、未配置实际和有效门店缺口审计字段。
- [x] AC-162: Given 全国、大区、小区、门店任一层级, when 用户下钻, then 顶部订单/零售目标不随下钻改变，当前列表行订单目标与零售目标之和分别等于当前父范围目标。
- [x] AC-163: Given 订单目标实际和零售目标实际 SQL 聚合, when 审查 SQL 或契约测试, then 两者均保留自然月、MG、一级经销商代码、汇报车系名称维度；订单分子只用 `当日订单数（首触）`，零售分子只用 `当日零售数`。
- [x] AC-164: Given 1280px 与 1440px PC 视口的浅色、深色主题, when 查看标题摘要、订单表现和零售表现, then 页面无新增横向溢出；摘要可换行且层级弱于标题，两列表格 2x2 目标/排名/占比文字不截断。
- [ ] AC-283: Given 代码进入 v1.88 目标拆源改造, when 审查 `multi-store-super-app/data-api.js`、目标测试和构建产物, then 订单目标源只使用 `u32cb7e789f7443ff84160b4` / `打铁运营机制看板目标`，零售目标源只使用 `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标`；`r05.总订单目标` 不再参与订单目标，`h9828e20e9026475091ae6ca` 不作为 App 最终订单目标源。
- [ ] AC-284: Given `u32` 返回 `日期、品牌、大区、小区、经销商、车系、订单目标、大区代码、小区代码、经销商代码`, when 订单目标归一完成, then 系统以 `u32` 输出行为唯一事实源按行 SUM `订单目标`；`日期、品牌、车系、订单目标` 为空、目标非数字或负目标才进入无效必需字段审计，组织代码为空不得直接判 invalidKey；同展示键多行不得按冲突作废、去重、纠正或合并为单行值，不得用 `r05` 订单字段补齐。
- [ ] AC-285: Given 当前范围为 `2026-07 / MG / 全部车系`, when 按 `u32` 汇总订单目标, then 订单源输入为 `1576` 行，7 个大区订单目标分别为 `1995/5597/1950/2850/2615/5179/2638`，合计 `22824`；其中 `12` 行大区/小区/经销商代码为空但大区/小区/经销商名称存在、订单目标 `115`，必须按名称归入对应组织汇总并计入全国/大区守恒，不得因 `validDealerMap`、空代码或 invalidKey 排除；Given 直接汇总上传原表 `h982` 得到 `22614`, then QA 只记录差异，不把 `22614` 作为 App 订单目标验收值。
- [ ] AC-286: Given `u32` 与 `h982` 存在 `210` 差额且荆州有为同一 `dealerCode+车系` 存在两行输出, when 审查目标归一和对账报告, then 差额明确保留为当前打铁看板口径的一部分，上海安吉 `+138`、荆州有为 `+72` 按 `u32` 输出行累加，不在 App 另行去重、修正、抵消、别名补码或硬编码补差。
- [ ] AC-287: Given 订单目标源失败、无权限、业务码失败、字段缺失、输出行 SUM 不可证或超时, when 页面和导出渲染, then 仅订单目标、订单达成、订单表格目标位和订单目标状态显示不可用；零售目标、零售达成、零售表格目标位和销售主链路仍按 `r05` 与销售事实正常展示。
- [ ] AC-288: Given 零售目标源失败、无权限、业务码失败、字段缺失、冲突不可证或超时, when 页面和导出渲染, then 仅零售目标、零售达成、零售表格目标位和零售目标状态显示不可用；订单目标、订单达成、订单表格目标位和销售主链路仍按 `u32` 与销售事实正常展示。
- [ ] AC-289: Given 用户选择跨月、未来月、非 MG 或一个/多个具体车系, when 目标链路加载, then 订单目标和零售目标均延续既有单月整月目标规则、非 MG/未来月/跨月隐藏规则和车系集合联动；订单目标按 `u32.车系` 与 `u32` 组织代码/名称汇总，零售目标按 `r05.车系 + validDealerMap` 汇总，不改变订单目标实际 SQL、零售目标实际 SQL、销售/过程指标、排名、占比或筛选。
- [ ] AC-290: Given v1.88 实现完成, when 执行回归和导出检查, then UI、导出字段集合、销售/过程指标、打铁指标、移动端、发布配置和依赖均不因本次改变；只允许目标数据源拆分、目标状态隔离、目标审计和必要测试更新。

### REQ-013: PC 销售总览标题行目标摘要与时间进度

**优先级：** P0  
**关联任务：** TASK-001、TASK-015、TASK-019  
**适用范围：** 仅 `multi-store-super-app/` PC 顶部销售总览；不改表格订单/零售表现、过程指标数据口径、筛选、导出、移动端入口、目标数据源或发布配置。

**v1.82 实施状态（2026-07-24）：** 已完成本地开发、独立 Code Review 与最终 QA 功能门禁，并随 v1.82～v1.85 共享隔离组合包发布测试 App。Phase 3V 可交付结论以隔离 Review/QA 为主：P0/P1/P2=`0/0/0`，隔离 Node `134/134`、PC `97/97`、lint/build/audit 通过。2026-07-24 最终 QA 冻结快照（包含当时并行 `excelTextRank` / `AC-258`，尚未包含后续 Phase 3Y）通过定向四态 PC `6/6`、Node `137/137`、PC `98/98`、lint Syntax check `45 files`、build exit `0`、audit `0`，并验证 24 张四态 × 三宽 × 双主题截图及 source/dist `app.js`、`visual-sync.css` 一致；这些全局计数仅描述冻结快照，不承诺后续共享工作树计数不变。AC-258、后续 Phase 3Y 及其他并行改动不属于 v1.82 的独立背书，必须由各自任务独立 Review/QA。v1.82 明确 supersede v1.79 中“销售指标和过程指标上方独立销售经营进度条 / 单独占一行”的布局条款；v1.79 的五项业务口径、显示/隐藏/失败状态和 v1.81 异步加载口径继续有效。共享发布证据见文档顶部记录；未发布生产、未 commit、未 push。

**v1.91 修订状态（2026-07-24）：** 用户确认按参考图 2 将 v1.82 标题行中原本居中的目标摘要移动到左侧标题组，AC-292～AC-297 已完成本地实现、独立 Review 和 QA，并已发布测试 App。v1.91 只修订 PC 标题行布局位置：左侧同一组 `销售总览 + 订单目标/订单达成/零售目标/零售达成/时间进度`，右侧继续为车系筛选器；不改任何指标卡、数据口径、目标数据源、目标自然键、异步加载、筛选、表格目标槽、导出或移动端。验收证据为 loading skeleton `172×12` 五段单行、定向 Node `2/2`、PC `12/12`、lint/build PASS；完整 suite 仅 `2` 个 Node + `1` 个 PC 因 `settings=test` 与历史 `production` 期望冲突失败，确认为范围外既有配置冲突。测试 App 发布证据：App `q0844640cf6734877a3193d6`，发布源 `/tmp/retail-v191-app-test-rK5Xyi/multi-store-super-app`，命令 exit `0`、`operation=update`、`version=0.1.0`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a/`；settings 为 `environment=test`，单店 URL=`r8ce093b6d93143d8aa6852f`；zip SHA-256=`1f58981613e3ce1c346a743406179c0ba2f90fc1fd61d3cda38c6309587b504a`、`31 files`，`unzip` 与隐私扫描通过。v1.82 的已发布测试 App、AC-243～AC-250 和对应 QA 证据保留为历史事实，不回写为当前发布。GitHub 生产配置提交 `6f125ce` 已形成，但 push 因 SSH publickey 被拒，未推送 GitHub。

**v1.83 修复状态（2026-07-24）：** 本地修复、独立 Code Review 与最终 QA PASS，并随 v1.82～v1.85 共享隔离组合包发布测试 App。本次只修 PC 过程标签 `loadNegativeProcess` 加载编排：current 阶段先行、比较期 previous/week 同波并发、阶段结算后按 token 原子合并和限定渲染预算；同步更新 `validation/pc-role-drilldown.spec.js` 的相关 PC 回归用例，将旧 current/previous/week 三波等待适配为 current 2 请求 + comparison 4 请求显式断言，并保留 A→B token 失效导航切换场景；不改过程指标公式、数据 API、组织/车系/日期/权限口径、打铁指标、顶部漏斗、导出、移动端或发布配置。门禁通过：定向 `node --test validation/process-tags-kind-state.test.mjs` 8/8、`npm test` 134/134、`npm run lint` Syntax check 45 files、`npm run build` PASS、`npm run test:pc` 95/95、`npm audit --omit=dev --audit-level=critical` 0 漏洞；QA 快照时 `app.js` 与 `dist/app.js` 整文件 SHA-256 一致，随后并行 v1.82 销售目标摘要 DOM 修改导致当前整文件不同，但 `loadNegativeProcess` 至 `loadIronMetrics` 修复切片 source/dist 仍逐字一致（SHA-256=`1330d39d6e952faa520ddb758656d668bf66a24e1c7713980624a7655123f123`，cmp=0）。最终独立 QA PASS，P0/P1/P2=`0/0/0`；并行变化后当前源码重新复跑定向 Node 8/8、相关 Playwright 3/3 通过；QA 独立复跑记录保留相关 Playwright 3/3 与 4/4。独立 Code Review Stage 1/2 功能 PASS，无 HIGH；两个非阻断 LOW（生产测试全局开关硬化债、比较期 pending 暂显示 `--`）作为后续项，不扩展本次修复。共享发布证据见文档顶部记录；未发布生产、未 commit、未 push，未做登录态业务 UI 或观远真实环境验收。

**当前实施状态（2026-07-23）：** Phase 3T 已完成开发、Code Review Stage 1/2 与最终 QA，并发布测试 App `q0844640cf6734877a3193d6`；AC-227～AC-234 全部关闭。匿名入口 HTTP 401 只证明登录保护；Chrome 父应用刷新后自动 DOM/截图持续超时，未完成登录态线上 UI 验收。未发布生产、未 commit、未 push。

**v1.81 性能修复状态（2026-07-23）：** 已完成本地开发、Code Review Stage 1/2、最终 QA 功能门禁与测试 App 发布。只修“目标异步解耦 + 组织过滤瘦身”，不改目标口径、销售/过程主指标口径、导出字段、移动端或发布配置。门禁证据为 `npm test` 130/130、PC 95/95、lint Syntax check 45 files、build PASS、audit 0、1280/1440 浅深色通过；Review P0/P1/P2=`0/0/2`。发布命令重新构建并重打包后成功更新测试 App `q0844640cf6734877a3193d6`：`operation=update`、版本 `0.1.0`、`artifact=dist.0.1.0.zip`、`fileKey=1d9e70c3-938c-409d-b4e0-e1be26035edc`；最终 zip SHA-256=`3125ba0859ff122ba05aa2029eab924d2a7dbe2ab689f4a079b5104aa1810359`，zip 完整性与关键四文件 source/dist/zip 三方哈希一致性均通过。未发布生产、未 commit、未 push。

**用途：**
在不增加销售/过程指标上方独立通栏、不让销售模块单独加高、不破坏销售/过程指标卡基线的前提下，让业务在 PC“销售总览”标题右侧紧接查看订单目标、订单达成、零售目标、零售达成和当月时间进度；车系筛选器继续位于标题行最右侧。

**数据与日期规则：**
- MUST 复用 REQ-011 已有订单目标、订单达成、零售目标、零售达成数据和降级状态，不新增目标数据集、不改目标自然键、不改订单/零售目标口径实际 SQL、不改导出字段。
- MUST 新增“时间进度”展示值，公式为 `今天日期序号 / 当月月末日期序号 * 100%`，按 1 位小数展示。例如今天为 7 月 23 日、当月末日为 31 日时，时间进度为 `23 / 31 = 74.2%`。
- MUST 时间进度使用页面运行时的当前自然日计算，不使用父应用筛选 `endDate`、不使用目标实际统计窗口、不按工作日或已过完整天数修正。每月 1 日为 `1 / 当月月末日`，月末为 `100.0%`。

**页面与状态规则：**
- MUST v1.91 起将目标摘要从 v1.82 标题行中间移动到左侧标题组：标题行整体为左右两段，左侧同一组 `h2 销售总览 + 订单目标/订单达成/零售目标/零售达成/时间进度`，右侧为最右侧 `#vehicleSeriesFilter`；目标摘要必须紧跟标题、非居中，不得再形成 `销售总览｜目标摘要｜车系筛选` 的三段居中布局，也不得在销售指标和过程指标上方单独新增通栏。
- MUST 标题行目标摘要展示顺序固定为 `订单目标`、`订单达成`、`零售目标`、`零售达成`、`时间进度`。
- MUST 目标摘要采用纯文字行内展示，不使用胶囊、独立卡片、边框、背景、阴影、进度条填充或额外容器标题；视觉层级为辅助字号，弱于“销售总览”标题。
- MUST 销售指标和过程指标模块内部恢复为仅标题 + 指标卡，不再在任一 `.metric-panel .panel-head` 内展示目标摘要、时间进度、目标空槽或失败文案。
- MUST 销售指标 3 张卡和过程指标 4 张卡保持同高、同起点、同水平基线；月环比、周环比继续在每张指标卡内上下两行展示，不改变卡片内容。
- MUST 时间进度使用中性灰蓝文字和数值，不使用绿色、红色、上涨/下跌箭头、达标标签、进度条填充或状态圆点，不表达目标是否应该达到该水平。订单目标与零售目标沿用现有蓝色目标语义，订单达成与零售达成沿用现有绿色达成语义。
- MUST 目标摘要整体遵循 REQ-011 目标摘要降级：跨月、未来月、非 MG、无目标或目标被隐藏时，左侧标题组只显示 `销售总览` 标题且不得保留摘要空槽；目标请求失败、无权限或业务码失败时，`月目标数据暂不可用` 必须紧接标题显示；不得在这些场景下单独显示时间进度。
- MUST loading 时五段行内骨架必须紧接 `销售总览` 标题显示，销售指标、过程指标、销售概览表和可用组织行按 v1.81 先行展示；loading 骨架不得撑高标题行或影响下方卡片基线。
- MUST PC 1280px、1366px、1440px 视口中，左侧标题组始终单行完整展示；可以通过辅助字号、紧凑间距、弹性列宽或车系筛选固定宽度约束实现，但不得隐藏、换行、截断任一项，不得新增页面级横向滚动。
- MUST PC 1280px、1366px、1440px 视口的浅色和深色主题下，标题行左右两段布局保持稳定：左侧组 `销售总览 + 五项摘要` 完整单行，右侧车系筛选保持最右且可点击、可聚焦、可展开；下方直接进入销售/过程指标模块，两个模块同起点、同高、同水平基线。
- MUST v1.81 起首屏销售真实数据不得等待月目标请求完成。销售事实、车系枚举和有效组织范围完成后，必须立即渲染销售指标、过程指标、销售概览表和可用组织行；月目标后台加载并只更新标题行目标摘要、表格目标槽和导出目标字段。
- MUST v1.81 起月目标后台请求使用与当前加载一致的 `loadToken` / generation；旧筛选目标响应不得覆盖新筛选上下文。目标失败、无权限、业务码失败或超时不得触发全局 loading，也不得清空已渲染销售/过程结果。
- MUST v1.81 起目标 preview 可在映射已确认时追加组织条件：`areaCode -> rfs_code`、`districtCode -> mac_code`、`dealerCode -> dealer_code`。该过滤只用于减少读取量，不替代有效经销商维表归属，不改变目标自然键、目标实际 SQL、车系集合、自然月窗口或导出字段。

**验收标准：**
- AC-227～AC-234 与 AC-236～AC-242 保留为 v1.79/v1.81 历史已完成验收；其中涉及独立经营进度条位置的描述已被 v1.82 AC-243～AC-250 覆盖，业务口径和状态口径不变。
- [x] AC-227: Given 单一自然月 MG 筛选且目标查询成功、当前有效范围存在任一有效订单或零售目标, when PC 顶部销售总览渲染完成, then 销售指标和过程指标上方显示独立“销售经营进度”条，且条内按顺序展示订单目标、订单达成、零售目标、零售达成、时间进度。
- [x] AC-228: Given 页面运行日为任一自然月第 N 日且当月月末为 M 日, when 渲染时间进度, then 显示 `N / M * 100%` 后的 1 位小数；例如 7 月 23 日显示 `74.2%`。
- [x] AC-229: Given 用户查看时间进度, when 对照颜色和文案, then 时间进度只使用中性灰蓝且无绿色/红色、无箭头、无达标标签、无状态圆点；订单/零售目标和达成继续沿用现有蓝/绿语义。
- [x] AC-230: Given 目标查询成功但跨月、未来月、非 MG、无目标或目标按 REQ-011 隐藏, when PC 顶部销售总览渲染, then “销售经营进度”条整体隐藏，且不得单独显示时间进度。
- [x] AC-231: Given 目标请求失败、无权限或业务码失败, when PC 顶部销售总览渲染, then “销售经营进度”条位置显示既有目标暂不可用类文案，销售指标卡、过程指标卡和销售主链路继续展示，不单独显示时间进度。
- [x] AC-232: Given PC 顶部指标卡渲染完成, when 检查销售指标与过程指标两个模块, then 模块内部仅有标题和指标卡；七张指标卡均只包含当前值、月环比、周环比，月环比和周环比仍为上下两行。
- [x] AC-233: Given PC 1280px 与 1440px 视口的浅色、深色主题, when 经营进度条内容较宽或自然换行, then 只有经营进度条内部换行，下方销售指标和过程指标模块同高、同起点、同水平基线，页面无新增横向溢出。
- [x] AC-234: Given 用户查看表格订单表现、零售表现、过程分析、导出或移动端入口, when v1.79 顶部布局上线, then 这些范围的数据口径、字段、排序、筛选、导出和移动端展示不发生变更。
- [x] AC-236: Given 月目标请求仍在 pending, when 销售事实、车系枚举和有效组织范围已返回, then PC 顶部销售指标、过程指标、销售概览表和可用组织行立即展示真实数据，不继续停留全局骨架。
- [x] AC-237: Given 月目标后台加载中, when 用户查看经营进度条和表格订单/零售表现, then 只有目标相关区域显示同尺寸加载态；订单、交付率、零售、四项过程指标、销售概览主字段、排名、占比、下钻和分页均可用。
- [x] AC-238: Given 月目标请求成功且 `loadToken` 匹配当前筛选, when 目标结果返回, then 只局部回填订单目标、订单达成、零售目标、零售达成、表格目标槽和导出目标字段，不重置 Tab、分页、扁平态、下钻路径或选中门店。
- [x] AC-239: Given 月目标请求失败、无权限、业务码失败或超时, when 销售主链路已渲染, then 经营进度条和表格目标槽显示目标暂不可用类状态；销售/过程主数据不回退全局 loading。
- [x] AC-240: Given 用户快速切换日期、品牌、组织或车系导致多个目标请求并发, when 旧请求晚于新请求返回, then 旧目标结果被 `loadToken` / generation 丢弃，不得覆盖新筛选上下文。
- [x] AC-241: Given 当前参数包含 `areaCode`、`districtCode` 或 `dealerCode` 且目标 DS 已确认存在 `rfs_code/mac_code/dealer_code`, when 发起目标 preview, then 可下推对应组织条件减少无关目标行；下推后目标自然键、有效经销商维表归属、车系集合、自然月窗口和目标实际 SQL 不变。
- [x] AC-242: Given 执行 Phase 3U 回归门禁, when 覆盖默认全域和 SMG310 类组织筛选场景, then 首屏销售真实数据出现不等待月目标完成，且目标 pending/success/error、旧响应丢弃、组织过滤下推和无下推 fallback 均有自动化证据。
- [x] AC-243: Given PC 顶部销售总览在 1280px 及以上视口渲染, when 目标有效且车系筛选可见, then 标题行固定为三段 `销售总览｜目标摘要｜车系筛选`，目标摘要位于标题与最右车系筛选之间，且页面不再存在销售/过程指标上方独立经营进度通栏。
- [x] AC-244: Given 单一自然月 MG 筛选且目标查询成功、当前有效范围存在任一有效订单或零售目标, when 标题行目标摘要渲染, then 按 `订单目标 → 订单达成 → 零售目标 → 零售达成 → 时间进度` 固定顺序显示五项，目标数值为蓝色、达成数值为绿色、时间进度为灰蓝色。
- [x] AC-245: Given 用户查看标题行目标摘要, when 对照视觉样式, then 五项均为纯文字行内辅助信息，不出现胶囊、独立边框、背景、阴影、状态圆点、箭头、达标标签或进度条填充。
- [x] AC-246: Given 1280px、1366px、1440px PC 视口的浅色和深色主题, when 目标摘要五项、`销售总览` 标题和车系筛选同时展示, then 五项均单行完整可读，不隐藏、不换行、不截断，不新增页面级横向滚动，车系筛选仍可点击使用。
- [x] AC-247: Given 标题行目标摘要展示或隐藏, when 下方销售指标和过程指标模块渲染, then 下方直接进入销售/过程指标，两个模块保持同起点、同高、卡片同水平基线；不得通过增加空白占位、单独加高销售模块或改变卡片内容来对齐。
- [x] AC-248: Given 月目标后台请求 pending, when 销售事实、车系枚举和有效组织范围已返回, then 标题行中间显示五段行内骨架，销售指标、过程指标、销售概览表和可用组织行按 v1.81 先行展示真实数据，骨架不撑高标题行或阻塞主销售/过程链路。
- [x] AC-249: Given 目标查询成功但无目标、跨月、未来月、非 MG 或目标按 REQ-011 隐藏, when PC 顶部销售总览渲染, then 标题行中间目标摘要整体隐藏，不保留空槽，不单独显示时间进度，车系筛选位置与下方指标基线不变。
- [x] AC-250: Given 目标请求失败、无权限、业务码失败或超时, when PC 顶部销售总览渲染, then 标题行中间仅显示 `月目标数据暂不可用`，销售指标卡、过程指标卡、销售概览表、表格目标槽、导出、筛选和移动端边界均按既有口径处理，不因本布局变更改变数据源、异步加载、目标自然键或目标实际 SQL。

**AC-243～AC-250 验收证据：** Phase 3V 隔离 Review/QA P0/P1/P2=`0/0/0`，Node `134/134`、PC `97/97`；2026-07-24 最终 QA 冻结快照（含当时并行 AC-258、尚未含后续 Phase 3Y）通过定向四态 PC `6/6`、Node `137/137`、PC `98/98`、lint `45 files`、build/audit、24 张四态 × 三宽 × 双主题截图与 source/dist 同源检查。冻结快照全局计数不代表后续共享工作树永久计数。
- [x] AC-292: Given PC 顶部销售总览在 1280px 及以上视口渲染且目标有效、车系筛选可见, when 检查标题行 DOM 和视觉位置, then 标题行必须为左右两段：左侧同一组 `销售总览 + 订单目标/订单达成/零售目标/零售达成/时间进度`，右侧为最右车系筛选；目标摘要必须紧跟标题、非居中，不得保留 v1.82 的 `销售总览｜目标摘要｜车系筛选` 三段居中结构，也不得恢复销售/过程指标上方独立经营进度通栏。（本地实现、独立 Review 与 QA 通过）
- [x] AC-293: Given 单一自然月 MG 筛选且目标查询成功、当前有效范围存在任一有效订单或零售目标, when 左侧标题组渲染, then 五项按 `订单目标 → 订单达成 → 零售目标 → 零售达成 → 时间进度` 固定顺序紧接标题展示，目标数值为蓝色、达成数值为绿色、时间进度为灰蓝色，并继续保持纯文字行内辅助信息。（本地实现、独立 Review 与 QA 通过）
- [x] AC-294: Given 1280px、1366px、1440px PC 视口的浅色和深色主题, when `销售总览`、五项目标摘要和车系筛选同时展示, then 左侧标题组必须完整单行展示，不隐藏、不换行、不截断、不产生页面级横向滚动；车系筛选必须保持最右侧可点击、可聚焦、可展开。（本地实现、独立 Review 与 QA 通过）
- [x] AC-295: Given 月目标后台请求 pending, when 销售事实、车系枚举和有效组织范围已返回, then loading 五段行内骨架必须紧接 `销售总览` 标题显示，销售指标、过程指标、销售概览表和可用组织行按 v1.81 先行展示真实数据，骨架不撑高标题行或阻塞主销售/过程链路；当前 skeleton 为 `172×12` 五段单行。（本地实现、独立 Review 与 QA 通过）
- [x] AC-296: Given 目标查询成功但无目标、跨月、未来月、非 MG 或目标按 REQ-011 隐藏, when PC 顶部销售总览渲染, then 左侧标题组只显示 `销售总览` 标题，不保留摘要空槽，不单独显示时间进度；车系筛选位置、可用性和下方指标基线不变。（本地实现、独立 Review 与 QA 通过）
- [x] AC-297: Given 目标请求失败、无权限、业务码失败或超时, when PC 顶部销售总览渲染, then `月目标数据暂不可用` 必须紧接 `销售总览` 标题显示，销售指标卡、过程指标卡、销售概览表、表格目标槽、导出、筛选和移动端边界均按既有口径处理，不因本布局变更改变数据源、异步加载、目标自然键、目标实际 SQL 或任何交互。（本地实现、独立 Review 与 QA 通过）

**AC-292～AC-297 验收证据：** loading skeleton `172×12` 五段单行；定向 Node `2/2`、PC `12/12`、lint/build PASS；完整 suite 仅 `2` 个 Node + `1` 个 PC 因 `settings=test` 与历史 `production` 期望冲突失败，确认为范围外既有配置冲突。测试 App 已发布成功：App `q0844640cf6734877a3193d6`，发布源 `/tmp/retail-v191-app-test-rK5Xyi/multi-store-super-app`，命令 exit `0`、`operation=update`、`version=0.1.0`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a/`；settings 为 `environment=test`，单店 URL=`r8ce093b6d93143d8aa6852f`；zip SHA-256=`1f58981613e3ce1c346a743406179c0ba2f90fc1fd61d3cda38c6309587b504a`、`31 files`，`unzip` 与隐私扫描通过。GitHub 生产配置提交 `6f125ce` 已形成，但 push 因 SSH publickey 被拒，未推送 GitHub。
- [x] AC-251: Given PC 过程标签开始加载, when `loadNegativeProcess` 收到当前筛选 token, then 第一波只启动 current × ip/drive 两个高层任务并使用 `Promise.allSettled`；在两项结算前不得启动 previous 或 week 任何高层任务，也不得提交比较期过程数据。（本地实现、独立 Code Review 与最终 QA 通过）
- [x] AC-252: Given current × ip/drive 两项已全部结算且 token 仍有效, when 合并第一波结果, then 按 `state.processErrors[kind].current` 保留失败、按 kind 合并成功 raw，`buildWorkbench` 与 `rebuildIronStores` 各执行 1 次，`state.processStage=current`，仅 `renderProcessComparisonList` 执行 1 次；不得调用 `renderFunnel` 或 `refreshDynamicDiagnoses`。（本地实现、独立 Code Review 与最终 QA 通过）
- [x] AC-253: Given 第一波结算后 token 仍有效, when 启动第二波, then previous/week × ip/drive 四个高层任务同波启动并使用 `Promise.allSettled`，最大高层并发为 4，不再按 previous 后 week 串行加载。（本地实现、独立 Code Review 与最终 QA 通过）
- [x] AC-254: Given 第二波四项全部结算且 token 仍有效, when 合并比较期结果, then 原子合并成功 raw 与 `state.processErrors[kind][previous|week]`，`buildWorkbench` 与 `rebuildIronStores` 各再执行 1 次，`state.processLoading=false`、`state.processStage=week`、`state.processError=processErrorMessage()`，仅 `renderProcessComparisonList` 执行 1 次、`refreshDynamicDiagnoses` 执行 1 次；不得调用 `renderFunnel` 或循环尾重复渲染。（本地实现、独立 Code Review 与最终 QA 通过）
- [x] AC-255: Given previous 失败/week 成功或 previous 成功/week 失败, when 过程分析表渲染, then 成功阶段的另一 kind 或另一 stage 数据必须保留，失败只落到对应 kind × stage 错误格；保留 evidence、5000 fail-closed、SQL/fallback、`0.0%/--/数据不完整` 语义。（本地实现、独立 Code Review 与最终 QA 通过）
- [x] AC-256: Given 用户在第一波期间切换筛选导致 token 失效, when current 结算, then 不启动第二波、不回写任何过程状态；Given token 在第二波期间失效, when 第二波结算, then 不回写最终状态、不刷新过程表或动态诊断。（本地实现、独立 Code Review 与最终 QA 通过）
- [x] AC-257: Given 执行 Phase 3W 行为测试, when 使用受控 deferred Promise 驱动 `loadNegativeProcess`, then 自动化覆盖 current 两项并发、比较期四项同波启动、渲染预算、阶段失败隔离、两类 token 失效和 current 未完成不提交比较期；测试不得仅依赖源码正则，并继续保留既有 SQL/fallback/evidence 断言；PC 回归同步覆盖旧三波用例适配为 current 2 请求 + comparison 4 请求显式断言，并保留 A→B token 失效场景。（本地实现、独立 Code Review 与最终 QA 通过）
- [x] AC-258: Given 用户在 PC 销售概览点击现有导出入口并用 Excel 直接打开导出的 CSV, when 查看 `订单排名`、`零售排名` 两列, then `1/7`、`7/7` 等排名必须保持可见 `x/y` 文本，不被 Excel 自动解析为日期；标准 CSV 解析或导入后仍可从这两列还原原始 `x/y` 排名语义。不得改变排名计算、其他导出列、导出范围、文件类型/依赖、公式注入防护、页面 UI、数据查询、移动端或发布配置。（已发布测试 App；发布后独立 QA PASS，P0/P1/P2=`0/0/2`，两个 P2 为文档同步/边界澄清并已关闭；验收覆盖代码机制、实际 CSV 字节/解析与自动化，无 Windows Excel 直开实机截图）

### REQ-012: 打铁看板邀约/试驾运营指标

**优先级：** P0  
**关联任务：** TASK-002、TASK-016  
**状态：** v1.70 展示、下钻与导出已发布测试 Super App；R5 Code Review PASS，发布后独立 QA PASS，P0/P1/P2=0/0/0；未发布生产、未 commit/push。v1.71 打铁指标永久骨架屏修复已发布测试 Super App（`operation=update`、版本 `0.1.0`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`），最终 Code Review Stage 1/2 PASS（P0/P1=0/0），发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断）。v1.75 已完成 11 项当前值/月环比/周环比、过程分析同款 DOM/样式语义、比较期失败隔离、DCC 新表 SQL-only 和导出字段，并发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256=`293a24705b23f9c3354e91cf196f6236b8b4f7563da0d86d05e80aefc26fe520`）。v1.86 已完成 DCC 打铁四项门店范围合同本地实现、Code Review 和独立 QA，并于北京时间 `2026-07-24 12:54:09 CST` 发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、`version=0.1.0`、标准回执未返回 `fileKey`、URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、zip SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes、`dist 31 files / 600836 bytes`）；门禁为专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`、隐私 `0`、source/dist `29` 个复制型运行时文件一致、`unzip -t` PASS。v1.92 已确认新增待开发合同：销售车系筛选必须真实联动打铁 11 项，当前/上月同期/上周同期三阶段均按 6 来源物理车系字段和销售闭集映射查询，不得用全部车系数据冒充筛选结果；本次仅文档更新，未改源码、未发布、未 commit/push。匿名 HTTP `401` 仅认证边界；未做登录态线上业务数据 UI 验收，未发布生产，未 commit/push。  
**适用范围：** `multi-store-super-app/` PC 表现区新增第三个 Tab“打铁指标”；现有“销售概览”“过程分析”内容、负向问题率和切换行为继续保留，不覆盖旧指标。

**唯一口径源：**

- 官方页面：`https://rdata-pv.rauto.com/page/c678fa8f2906744faaba8516`，pageId=`c678fa8f2906744faaba8516`。
- 开发级数据合同：`docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md`。该文件以“应用采用口径(v1.69)”为公式与来源事实基础，锁定每项指标的数据集、物理字段、分子、分母、去重键、过滤条件、日期字段、聚合、目标和状态语义；实现不得另起本地口径。v1.72 新增的上游筛选继承、SQL-only 和车系字段 fail-closed 合同、v1.86 新增的 DCC 四项范围合同、v1.92 新增的销售闭集来源映射合同如与历史实现路径冲突，以本 REQ-012 为准。
- PC 展示与下钻设计合同：`docs/superpowers/specs/2026-07-22-打铁指标PC展示与下钻设计.md`。该文件以 v1.70 为准，锁定 C 方案二级切换、目标表头层级、共享下钻状态机、导出策略、响应式、可访问性和验收映射。
- 当前合同仅包含官方页面真实存在的 11 项。历史会话中的有效录音数、质检完成录音数/率、试驾 NPS 等不进入本需求。
- v1.66 中官方打铁页面的周/月列、识别状态、红黄绿点、综合得分和日期例外仅作为“原看板事实/不采用”证据保留；应用最终口径不输出、不展示、不验收这些字段或公式。

**指标顺序与目标：**

| 分组 | 顺序 | metric_code | 展示名 | 目标 |
|---|---:|---|---|---:|
| 邀约 | 1 | `invite_trial_mention_rate` | 邀约进店试驾提及率 | 53% |
| 邀约 | 2 | `wechat_apply_mention_rate` | 加微申请提及率 | 56% |
| 邀约 | 3 | `high_intent_low_level_rate` | 高意向低水平 | 5% |
| 邀约 | 4 | `first_follow_call_60s_rate` | 首跟通话60s占比 | 无目标，表头下方不显示文案 |
| 邀约 | 5 | `follow_30min_rate` | 30分钟跟进率 | 85% |
| 邀约 | 6 | `follow_24h_rate` | 24小时跟进率 | 90% |
| 邀约 | 7 | `two_day_three_call_rate` | 2天3呼率 | 80% |
| 试驾 | 1 | `quality_trial_rate` | 优质试驾率 | 45% |
| 试驾 | 2 | `trial_record_upload_rate` | 试驾录音回收率 | 65% |
| 试驾 | 3 | `phone_car_interconnect_mention_rate` | 手车互联开口率 | 50% |
| 试驾 | 4 | `remote_parking_mention_rate` | 离车泊入开口率 | 50% |

**布局与交互：**

- MUST 在现有表现区右上 tablist 中，于“过程分析”右侧新增第三个 Tab“打铁指标”，顺序固定为 `销售概览 → 过程分析 → 打铁指标`；用户截图所示右上 tablist 与导出按钮相邻的结构不得改变。
- MUST 默认激活仍为“销售概览”；进入页面、刷新或上游筛选变化后不得默认跳到“打铁指标”。
- MUST 三个 Tab 共用同一 `viewLevel / drillPath`、面包屑/返回状态和组织范围文案；“打铁指标”的共享行序沿用 `OrganizationView` 同层级排序规则。非 DCC 打铁来源的 SQL 聚合范围继续由上游 `regionCode/districtCode/dealerCode`、罗盘行权限和有效经销商白名单取交确定；DCC 四项例外，必须以官方打铁看板业务过滤后的全部 DCC 门店范围和 DCC 自身组织字段构建，不得与 `validDealers` 求交。具体车系筛选后，打铁指标不得改用销售 `汇报车系名称` 过滤后的销售行集作为行集，也不得因某来源车系字段缺口回退到全部车系行集。
- MUST “打铁指标”Tab 内采用 C 方案二级切换：左侧或表格上方展示 `邀约指标 7`、`试驾指标 4` 两个分段按钮；默认激活 `邀约指标 7`，同一时间只展示当前激活的一组指标。
- MUST 在 `邀约指标 7 / 试驾指标 4` 二级切换右侧同一工具栏保留可点击链接“打铁运营看板”，文案固定，目标 URL 固定为 `https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845`；该链接继承现有页面轻量工具/链接样式，不得改变二级 Tab 顺序、选中态、键盘语义、表格起始位置、现有导出入口或一级 Tab 位置。
- MUST 自 v1.80 起在“打铁运营看板”右侧新增同级可点击链接“优质试驾看板”，文案固定，完整 URL 固定为 `https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa`，必须原样保留 `pgId=s9dade39bd42b474c9476216` 和 `id=LBiJMLcuHa` 查询参数；两个外链必须共存，顺序固定为 `打铁运营看板 → 优质试驾看板`，视觉直接复用 Phase 3R 轻量外链先例，不生成新设计文件。
- MUST 两个外链实现为 `<a target="_blank" rel="noopener noreferrer">`，点击后新窗口安全打开，不得把当前 Super App iframe 直接导航离开；键盘焦点顺序必须先经过二级 Tab，再经过“打铁运营看板”和“优质试驾看板”。
- MUST 切换邀约/试驾、点击任一外链均不得改变当前 `activeMetricGroup`、一级 Tab、组织层级、`drillPath`、`allDealerMode`、分页、车系筛选、数据查询、导出或缓存上下文；本增量不修改任何指标口径、SQL、数据集、状态、权限或移动端入口。
- MUST “打铁指标”Tab 同构支持表现区 `allDealerMode`：入口显示在导出按钮左侧，扁平态下非 DCC 来源按当前上游筛选、罗盘行权限、有效经销商白名单和当前 `drillPath` 展示全部可见经销商；DCC 四项按 DCC 自身组织字段和同一显式筛选展示官方业务过滤后的全部 DCC 门店；DCC 与非 DCC 门店骨架取安全并集，DCC-only 门店的非 DCC 指标显示 `--`、DCC 指标可显示；二级切换只改当前指标组，不清空扁平态；扁平态禁用组织下钻/返回，只保留门店详情；导出当前激活组在当前扁平范围内全部经销商行。
- MUST 两个二级指标组共享同一打铁组织骨架、范围文案、`viewLevel / drillPath`、返回上一级、页面分页状态和行序；切换 `邀约指标 7 / 试驾指标 4` 不得重置下钻，不得改变一级 tab，不得触发上游筛选变化。
- MUST 当前层级为大区时操作列为“查看小区”，当前层级为小区时为“查看门店”，当前层级为门店时为“门店详情”；操作列文案、位置和行为沿用销售概览/过程分析。
- MUST 邀约组表头按顺序展示 7 项邀约，试驾组表头按顺序展示 4 项试驾；每个指标列头为两层结构：第一层指标名称，第二层 `目标 xx%`。第二层只作口径提示，字号和层级弱于指标名称。
- MUST `首跟通话60s占比` 的表头第二层为空且不占可读文案；不得显示“无目标”、`--`、空破折号或其他占位。
- MUST 打铁指标单元格展示结构与“过程分析”表格一致：第一行当前值，第二行 `月环比`，第三行 `周环比`；必须复用同类 `process-table` / `metric-cell` / `metric-value` / `metric-trend[data-kind="month|week"]` / `trend-prefix` / `trend-change` 语义、浅深主题 token、错误态和紧凑行高，不新增一套打铁专属趋势 DOM 或视觉体系。`iron-*` class 可继续作为打铁局部命名空间，但不能破坏过程表格的趋势行结构、字号层级、间距和状态语义。
- MUST 目标提示不得生成红绿底色、圆点、达标/未达标标签、识别状态、官方 L5 状态、试驾状态、综合得分或排序权重；单元格颜色只表达加载/错误/空值等数据状态，不表达是否达标。
- MUST “打铁指标”只展示 7 项邀约 + 4 项试驾，不展示识别状态列、红黄绿点、综合得分、状态解释或官方看板周/月双列。
- MUST 复用当前表现区导出入口；当一级 tab 为“打铁指标”时，仅导出当前激活的邀约或试驾二级组，以及当前 `viewLevel / drillPath` 范围内的全部组织行，非仅当前 15 行分页；导出行序与页面同一打铁组织骨架排序一致，不新增第二个导出按钮。
- MUST PC 1280px 与 1440px 浅色/深色主题下继承现有紧凑表格、tab、按钮、边框、字体和 token；允许表格区域使用既有横向滚动容器，但不得改变销售概览、过程分析、负向问题率和现有导出按钮位置。
- MUST 二级切换具备 `role=tablist/tab/tabpanel` 或等价可访问语义，`aria-selected`、`aria-controls`、键盘左右方向键切换、焦点可见和屏幕阅读顺序均与视觉顺序一致。

**数据与计算规则：**

- MUST 使用统一长表合同输出 `section_code / page_order / organization_level / organization_code / organization_name / metric_code / display_name / metric_value / numerator / denominator / previous_metric_value / previous_numerator / previous_denominator / week_metric_value / week_numerator / week_denominator / month_delta_pp / week_delta_pp / target_value / target_label / unit / precision / dataset_name / dataset_id / source_status / previous_source_status / week_source_status / complete / previous_complete / week_complete`。百分比底值按 `0~1` 数值存储，页面保留 1 位小数；`month_delta_pp` 和 `week_delta_pp` 为百分点差，显示时按 `+2.2%` / `-2.2%` 这类过程分析同款文本呈现；枚举状态直接使用中文原文。
- MUST 前端加载打铁 11 项时只消费服务端 SQL 聚合结果；SQL 必须直接产出各组织层级的原始分子、分母、比例、来源状态和完整性证据。前端不得拉取 preview 明细、不得分页扫描明细、不得在 SQL 失败后 fallback 到明细聚合，也不得用已缓存明细补算当前上下文。
- MUST `target_label` 仅用于表头第二层展示，格式为 `目标 53%` 这类中文原文；无目标指标为 `null`，不得输出“无目标”供前端展示。
- MUST NOT 输出或依赖 `status_value / status_label`；这两个字段属于 v1.66 官方看板识别状态证据，不是 v1.69 应用合同字段。
- MUST 对当前组织行先聚合原始分子/分母或源表计数后再计算比例；大区、小区、门店或多门店结果不得平均下级百分比。官方“合计”仅作为历史页面事实；应用中的大区/小区/门店行按同一物理字段和当前权限/筛选范围重算。
- MUST 使用六个已确认数据集：邀约提及 `q00c55c3745c34650badf4f8`、高意向低水平 `w8f3c4f1af6c54f7d91f4dc5`、DCC `fa1bfbd7736f34d1d8633883`、试驾录音 `c82d917a45e37437bac8ade4`、优质试驾 `lbfb702c771cd496d85896f7`、试驾话术 `hd284d093e54c4b29bc32ccc`；目标来自 `k7cd977aec6874e6ead56ce9`。
- MUST 每个打铁来源 SQL 都继承同一日期上下文：日期为 `startDate <= 已审计真实日期字段 <= endDate` 的闭区间；不得引入 `current_date`、`now()`、`yesterday`、T+1、自然周或自然月例外。非 DCC 来源的区域为上游 `regionCode/districtCode/dealerCode` 与罗盘行权限、有效经销商白名单的交集；DCC 四项的区域为上游 `regionCode/districtCode/dealerCode` 下推到 DCC 自身大区/小区/经销商代码名称字段后的范围，叠加观远 DCC 数据集行级权限与官方打铁业务过滤，不与 `validDealers` 求交。车系为 PC 车系多选集合；品牌按来源已审计语义处理。例外是 `qualityTrial`：其 DS `lbfb702c771cd496d85896f7` 已验证为 MG 专属且无已审计可 SQL 品牌字段，`brand=MG` 或 `brand=全部` 时允许执行不带虚构品牌条件的 SQL，任一非 MG 品牌必须在调用前以 `fieldGapReason` fail-closed 为 `数据不完整` 且零 SQL，不得向非 MG 返回 MG 数据、不得使用 preview 或任何 fallback。
- MUST 非 DCC 区域过滤只使用上游代码字段和有效经销商白名单交集，不得用大区/小区展示名模糊匹配扩大范围；当上游传入具体 `dealerCode` 时，非 DCC 打铁来源只允许在该代码进入当前权限和白名单交集后查询，否则按空范围处理。DCC 四项的显式大区/小区/经销商筛选必须下推 DCC 自身组织字段；无 DCC 授权、DCC 查询失败、DCC 范围不可证或空授权必须 fail-closed 为 `数据不完整`，不得回退到非 DCC 白名单或销售/过程骨架补范围。
- MUST 车系过滤必须按“来源级字段审计”执行：每个打铁真实来源只能使用该来源已审计的物理车系字段和已确认映射进行 SQL 条件过滤；销售漏斗 `汇报车系名称` 只属于销售链路，不得代理到试驾录音、优质试驾、试驾话术、邀约提及、高意向或 DCC 来源。
- MUST v1.92 起来源字段固定为：`q00.周期首次意向闭环车系名称`、`w8.周期最近意向闭环车系`、`lbfb.车系`、`c82.车系名称`、`hd284.车系名称`、`fa1.CRM闭环车系名称`。DCC `fa1` 必须优先且只使用 `CRM闭环车系名称`，`原始车系名称`不可用；如果 `CRM闭环车系名称` 字段不可查询或业务码不可证，DCC 来源 fail-closed，不得退回原始车系或全部车系。
- MUST 销售闭集固定为 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07`；各来源 mapper 只能输出该闭集或 `unmapped`，不能生成本地新展示值。`全新MG4` 与 `MG4 EV` 不得默认合并，只有映射表明确确认后才允许进入同一销售闭集值。
- MUST `未知车系` 只映射来源原始值“未知”。当某来源在当前筛选范围内没有原始值“未知”样本时，该来源对 `未知车系` 返回真实空样本并展示 `--`；这不是字段缺失、映射不可证或数据不完整。
- MUST `其他车系` 使用已完成来源级 distinct 审计锁定的静态策略：`q00/w8/lbfb/fa1` 已审计存在精确原始值“其他车系”，对这四个来源永远只使用该精确值过滤；`c82/hd284` 已审计不存在精确原始值，对这两个来源永远只在 MG 范围内计算补集，即排除全部已映射到销售闭集的车系后，剩余 MG 车型计入 `其他车系`，非 MG 原始车型不进入补集。是否有精确值只能由该已完成来源级审计决定，不得因当前日期、组织、当前查询是否返回精确值或补集是否为空而动态切换；补集为空时展示 `--`，不得 fail-closed。
- MUST 任一打铁来源在具体车系筛选下缺少已审计物理车系字段、映射未确认、枚举值无法对齐或字段不可查询时，该来源绑定指标必须 fail-closed 为 `数据不完整` 并携带字段缺口说明；不得将该来源实现为“全部车系数据”、不得静默忽略车系条件、不得展示边界说明后继续返回未过滤结果。
- MUST 完整复用口径文档中的卡片过滤。DCC 尤其保留 `大区简称 NI ['', '其它', null, 'MG总部']`、`CRM线索状态名称 NI ['无需处理']`、`data_type_ch NI ['来电咨询']`、`需跟进 NI ['无需跟进']` 等条件，不得把 `NI` 误写成等于。高意向低水平保留排除 `新疆维吾尔自治区` 的官方条件。
- MUST 以去重 `呼叫编码`计算邀约进店试驾/加微申请提及率，以数据集行数计算高意向低水平，以去重 `线索编码`计算四项 DCC 指标，以去重 `试驾接待编码(PK)`计算试驾录音回收率，以源表 `SUM(优质试驾数)/SUM(常规试驾数)`计算优质试驾率，以去重 `试驾清单ID`计算两项试驾开口率。
- MUST DCC 四项共享同一 DCC 门店范围和组织归属合同：使用 `【双品牌】DCC话务指标_182` / ``双品牌DCC话务指标182`` 中被官方打铁业务过滤保留的全部 DCC 门店，按 DCC 事实自身大区/小区/经销商代码名称归属构建组织行；不得先用 `processBaselineData`、销售行集或 `validDealers` 丢弃 DCC-only 门店后再二次映射。
- MUST DCC 与非 DCC 来源合并为页面行集时采用安全并集。DCC-only 门店在 DCC 四项可显示真实值、`--` 或 `数据不完整`；该门店的非 DCC 打铁指标、销售指标和过程分析指标不因 DCC 范围扩大而补数，显示 `--` 或沿用既有无样本语义。上层大区/小区/合计必须按各来源分子分母重新汇总，不得平均门店百分比，也不得用非 DCC 骨架删除 DCC 分子分母。
- MUST 将手车互联开口率先限定 `试驾体验点='手机互联'`，再以该体验点内 distinct `试驾清单ID` 为分母，分子为其中 `是否提及='是'` 的 distinct `试驾清单ID`。
- MUST 将离车泊入开口率先限定 `试驾体验点='全场景自动泊车-离车泊入'`，再以该体验点内 distinct `试驾清单ID` 为分母，分子为其中 `是否提及='是'` 的 distinct `试驾清单ID`。
- MUST 11 项全部跟随上游应用传入或当前有效 `startDate/endDate` 日期范围计算当前值，并额外按与过程分析一致的比较周期计算上月同期和上周同期：当前期为 `range = resolveDateRange(params)`；上月同期为现有 `previousMonthRange(range)`；上周同期为现有 `previousWeekRange(range)`。三阶段都必须使用同一来源字段、同一公式、同一分子/分母、同一去重键、同一组织/区域/车系/权限/白名单上下文，仅日期范围不同。不得复制官方打铁看板自然周、月初、today/yesterday、24h 周、2天3呼月、手机互联月 `>` 等日期规则；不得生成官方周/月绝对值列。
- MUST 打铁月环比、周环比按比率百分点差展示：`month_delta_pp = 当前 metric_value - 上月同期 metric_value`，`week_delta_pp = 当前 metric_value - 上周同期 metric_value`。例如当前 53.2%、上月同期 51.0% 时展示 `+2.2%`，含义为 +2.2 个百分点；不得按 `(当前-同期)/同期` 相对涨跌率展示。
- MUST 车系继承 SCOPE-021 / REQ-010 的“枚举和前端选中集合”语义，但不得继承销售链路字段：过程来源字段不等同于销售 `汇报车系名称`，打铁车系过滤必须使用各来源已审计物理字段。未审计来源不得伪造联动，也不得在具体车系筛选下回退为无车系 `processBaselineData` 或全部车系数据。
- MUST 所有具体车系选项在打铁 11 项当前、上月同期、上周同期三阶段都触发同一 6 来源真实查询和同一来源映射；比较期不得因为映射成本或无样本而回退到全部车系。三阶段除日期范围外，来源字段、销售闭集映射、由来源级 distinct 审计固定的 `其他车系` 精确过滤/补集策略、`未知车系`空样本语义和 fail-closed 条件必须一致。
- MUST 分母为 0 或 null 且可证明当前范围真无样本时 `metric_value=null`、展示 `--`；分母有效且分子为空或 0 时按 0 计算并展示 `0.0%`。目标为空时 `target_value=null`。
- MUST 上月同期或上周同期分母为 0 或 null 且可证明真无样本时，对应环比展示 `--`；比较期分母有效且分子为 0 时按 0.0% 进入百分点差计算。任一比较期 SQL 失败、业务码失败、超时、截断、字段缺失、字段映射未审计或完整性不可证时，只让对应 `月环比` 或 `周环比` 显示 `加载失败`，不得把当前值降级为 `数据不完整`，不得清空其他比较期或其他来源指标。当前期失败时当前值显示 `数据不完整`，月环比和周环比均显示 `加载失败`。
- MUST 加载、来源请求失败、平台截断、完整性不可证或字段映射缺失时展示 `数据不完整`；六类数据源独立记录状态，任一来源失败不得清空其他来源已成功指标。
- MUST 打铁 6 类来源按来源独立结算并驱动局部呈现；任一来源成功后，对应指标应立即从骨架进入成功/空值状态，不得等待全部来源 all-complete 后整表统一落盘或统一渲染。
- MUST 单来源 SQL 超时、慢请求、悬挂请求、业务失败、字段缺失、字段映射未审计或完整性不可证按 fail-closed 处理为 `数据不完整`，只影响该来源绑定指标；不得阻塞其他已完成来源，也不得让无关指标永久停留骨架屏。
- MUST SQL 聚合失败时不允许使用 preview 明细、分页 fallback、旧缓存或前端聚合替代；错误状态必须保留当前查询上下文，便于 QA 核对日期、区域、车系、来源和字段缺口。
- SHOULD 后续补齐超时缓存失效策略与观远认证态真实集成测试；在该两项未补齐前，v1.71 不得宣称线上完全验收。

**验收标准：**

- [x] AC-143: Given 页面加载完成, when 用户查看表现区右上 tablist, then 顺序固定为 `销售概览 → 过程分析 → 打铁指标`，默认激活为“销售概览”；“打铁指标”位于“过程分析”右侧且不影响导出按钮、范围文案、返回/下钻控件。
- [x] AC-144: Given 任一组织层包含多家门店, when 用户切换到“打铁指标”, then 表格使用与销售概览/过程分析相同的 `viewLevel / drillPath` 和组织范围文案，组织骨架复用无车系 `processBaselineData` / 过程基线的有效组织集合，并沿用 `OrganizationView` 同层级排序规则；切换 tab 不触发上游筛选变化，不清空下钻路径。Given 车系多选为具体集合, when 对比销售概览与打铁指标, then 不要求二者行数或成员完全一致。
- [x] AC-145: Given “打铁指标”加载完成, when 查看分组和表头, then 邀约严格为 7 项、试驾严格为 4 项，名称、顺序、目标与 REQ-012 表格一致，试驾第 2 项为“试驾录音回收率”，首跟目标为空且历史单店 NPS/有效录音数/质检完成数不出现。
- [x] AC-146: Given 当前有效日期范围为任意 `startDate/endDate`, when 计算 11 项指标, then 所有指标只按该同一区间输出一个当前值；不得生成官方周/月列，不得套用 T+1、自然周、自然月、today/yesterday、24h 周、2天3呼月或手机互联月 `>` 日期规则。
- [x] AC-147: Given 计算手车互联开口率和离车泊入开口率, when 审查分母, then 分母分别先限定 `试驾体验点='手机互联'`、`试驾体验点='全场景自动泊车-离车泊入'` 后取 distinct `试驾清单ID`；分子为对应体验点内 `是否提及='是'` 的 distinct `试驾清单ID`，不得使用全部体验点试驾清单分母。
- [x] AC-148: Given “打铁指标”渲染完成, when 查看任一组织行, then 不展示识别状态、红黄绿点、综合得分、官方邀约 L5 状态或试驾状态；统一输出合同不包含 `status_value/status_label`。
- [x] AC-149: Given 车系多选处于任意具体集合, when “打铁指标”查询, then 不使用销售 `汇报车系名称` 伪过滤过程来源字段；品牌/大区/小区/门店/日期、权限和当前 `viewLevel/drillPath` 继续按现有组织范围联动。
- [x] AC-150: Given 某指标加载中、成功、真无样本、分母有效但分子为 0、来源失败/截断/不可证, when 页面渲染, then 分别展示加载骨架、百分比值、`--`、`0.0%`、`数据不完整`；各数据源独立失败时只影响对应指标，不清空其他来源已成功指标。
- [x] AC-166: Given 用户首次进入 PC 页面, when 表现区渲染完成, then 一级 tab 顺序为 `销售概览 → 过程分析 → 打铁指标` 且默认激活“销售概览”；“打铁指标”不会抢占默认入口。
- [x] AC-167: Given 用户切到“打铁指标”, when 二级切换渲染完成, then `邀约指标 7` 默认激活，`试驾指标 4` 未激活，同一时间页面只展示一组指标表，不同时铺开展示两组。
- [x] AC-168: Given 用户在“打铁指标”内查看表头, when 当前激活邀约或试驾组, then 每个指标表头均为“指标名称在上、目标 xx% 在下”；`首跟通话60s占比` 指标名下方不显示“无目标”、`--` 或任何占位文案。
- [x] AC-169: Given 任一指标有目标值, when 用户查看单元格或表头, then 目标只作为口径提示；页面不出现红绿底色、圆点、达标/未达标标签、官方识别状态、综合得分或按目标生成的颜色语义。
- [x] AC-170: Given 总部用户在大区层进入“打铁指标”, when 点击某大区“查看小区”后切换邀约/试驾二级组, then `viewLevel/drillPath`、组织范围文案、返回上一级、页面分页状态和同一打铁组织骨架行序保持当前小区层，不回到大区层。
- [x] AC-171: Given 大区角色、小区角色、销售总监或投资人进入页面, when 打开“打铁指标”, then 入口层级分别沿用当前组织状态：大区角色为小区→门店，小区角色直接门店，销售总监/投资人直接授权门店；上游具体大区/小区/门店筛选继续自动跳层。
- [x] AC-172: Given 用户在“打铁指标”任一层级点击操作列, when 当前层级为大区/小区/门店, then 操作分别为“查看小区”“查看门店”“门店详情”，行为与销售概览/过程分析同层级一致。
- [x] AC-173: Given 用户点击现有导出入口且一级 tab 为“打铁指标”, when 当前二级组为邀约或试驾, then 导出文件只包含当前激活二级组、当前 `viewLevel/drillPath` 范围内全部组织行，非仅当前 15 行分页；导出行序与页面同一打铁组织骨架排序一致，页面不新增第二个导出按钮。
- [x] AC-174: Given 用户在 1280px 或 1440px PC 视口、浅色或深色主题查看“打铁指标”, when 表格渲染完成, then 视觉继承现有紧凑表格、tab、按钮、边框和 token；不改变销售概览、过程分析、负向问题率、现有导出按钮位置，且无新增页面级横向溢出。
- [x] AC-175: Given 用户使用键盘或屏幕阅读器操作“打铁指标”, when 焦点进入一级 tab、二级切换、返回、分页和操作列, then 可按视觉顺序访问，左右方向键可切换 tab，`aria-selected/controls` 与可见面板一致，焦点环不被裁切。
- [x] AC-176: Given 11 项指标的六类数据源分别处于加载、成功、真无样本、0 分子、失败/截断或不可证状态, when 用户在邀约/试驾二级组间切换, then 每个指标保持独立五态，不使用旧缓存覆盖新组，不因任一来源失败清空其他来源成功指标。
- [ ] AC-177: Given 打铁指标 6 类来源中任一来源先完成, when 其他来源仍慢请求、悬挂或加载中, then 已完成来源对应指标立即局部呈现为百分比、`--` 或 `0.0%`，不等待 all-complete，不让整张打铁表继续显示骨架。
- [ ] AC-178: Given DCC 或意向类来源超时、业务码失败、字段缺失或完整性不可证, when 邀约/试驾其他来源已成功, then 失败来源绑定指标显示 `数据不完整`，其他来源指标保持已成功展示，不被清空、不被回退成骨架、不被旧缓存覆盖。
- [ ] AC-179: Given 用户在“打铁指标”内快速切换邀约/试驾、分页、返回或改变上游筛选, when 旧请求晚于新请求返回, then 页面只采纳最后一次有效上下文结果；旧请求不得把新上下文覆盖成骨架、旧值或错误。
- [ ] AC-180: Given v1.71 修复准备验收, when 执行本地门禁并发布测试 App, then 以 `npm test` 108/108、`npm run test:pc` 61/61、lint Syntax check 42 files、build 通过、audit critical=0，以及测试 App `q0844640cf6734877a3193d6` `operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`、包 SHA-256=`9ef29b84237fb8419492aead99f90a2c82ef7d785bc2e335fbfb75b33ce6cbc0`、`30 files / 527758 bytes` 解包证据，以及最终 Code Review Stage 1/2 PASS（P0/P1=0/0）、发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断）作为本次修复的测试发布与发布 QA 证据；但匿名 HTTP 只证明重定向/登录保护平台边界，未完成登录态线上 UI 冒烟和真实观远指标数据集成验收前，不标记为最终用户验收或线上修复验收通过。
- [ ] AC-181: Given 父应用传入 `startDate=2026-07-01&endDate=2026-07-22`, when 打铁 11 项任一来源构造 SQL, then 该来源使用已审计真实日期字段执行 `field >= '2026-07-01' AND field <= '2026-07-22'` 闭区间过滤；不得改写为官方自然周、自然月、T+1、today/yesterday 或其他日期规则。
- [ ] AC-182: Given 父应用传入 `regionCode/districtCode/dealerCode` 任一组织筛选, when 打铁 11 项查询, then 每个来源的 SQL 范围为上游组织代码、罗盘行权限和有效经销商白名单交集；白名单外或无权限经销商不得进入分子、分母、组织行、导出或缓存。
- [ ] AC-183: Given 车系多选为一个或多个具体车系, when 打铁 11 项来源具备已审计物理车系字段和映射, then 该来源 SQL 必须使用该来源字段按选中集合过滤并返回同上下文聚合值；不得使用销售漏斗 `汇报车系名称` 代理该来源字段，也不得用销售过滤后的行集冒充打铁行集。
- [ ] AC-184: Given 任一打铁来源缺少已审计物理车系字段、字段映射未确认、字段不可查询或枚举无法对齐, when 用户选择具体车系, then 该来源绑定指标显示 `数据不完整` 并输出字段缺口说明；其他已具备字段的来源可继续按各自 SQL 结果展示；不得返回该来源全部车系数据、不得静默忽略车系、不得只展示说明后继续给数。
- [ ] AC-185: Given 任一打铁 SQL 聚合失败、业务码失败、超时、截断或完整性不可证, when 前端加载打铁表, then 该来源绑定指标显示 `数据不完整`，前端不得发起 preview 明细、分页 fallback、前端明细聚合或旧缓存补算；导出同样不得包含 fallback 得出的打铁数值。
- [x] AC-199: Given 用户打开“打铁指标”并分别查看 `邀约指标 7` 与 `试驾指标 4`, when 任一组织行渲染完成, then 11 项指标单元格均展示当前值、`月环比`、`周环比` 三行；表头仍为指标名称在上、`目标 xx%` 在下，`首跟通话60s占比` 不显示目标占位；页面仍不展示识别状态、红黄绿点、综合得分或达标标签。
- [x] AC-200: Given 当前期为 `2026-07-01~2026-07-22`, when 打铁 11 项构造当前、上月同期、上周同期查询, then 当前期使用 `2026-07-01~2026-07-22`，上月同期复用 `previousMonthRange(range)`，上周同期复用 `previousWeekRange(range)`；三阶段都使用同一来源日期字段、区域代码交集、车系字段、权限白名单、分子、分母、去重键和 SQL-only 规则；不得把官方自然周/月列作为比较期。
- [x] AC-201: Given 当前比率为 `53.2%`、上月同期比率为 `51.0%`、上周同期比率为 `54.0%`, when 页面展示打铁单元格, then 月环比显示 `+2.2%`、周环比显示 `-0.8%`，含义为百分点差；不得显示相对涨跌率 `+4.3%` 或其他按同期值作分母的结果。
- [x] AC-202: Given 当前期查询成功且上月同期失败、上周同期成功, when 页面展示对应打铁指标, then 当前值照常显示百分比、`--` 或 `0.0%`，月环比仅显示 `加载失败`，周环比照常显示百分点差；上周同期失败时只影响周环比。Given 当前期失败, then 当前值显示 `数据不完整`，月环比和周环比均显示 `加载失败`。
- [x] AC-203: Given 当前期、上月同期或上周同期任一阶段真实无分母, when 页面展示打铁指标, then 该阶段指标值或对应环比展示 `--`；Given 分母有效且分子为 0, then 展示或计算使用 `0.0%`，不得把 0 分子误判为无样本或加载失败。
- [x] AC-204: Given PC 1280px 和 1440px 视口、浅色和深色主题, when 打铁表格展示月环比和周环比, then 单元格 DOM 与“过程分析”表格保持同样语义：包含同类 `metric-cell`、`metric-value`、`metric-trend[data-kind="month"]`、`metric-trend[data-kind="week"]`、`trend-prefix`、`trend-change` 结构；字号、行高、趋势色、错误态和横向滚动容器继承过程表，不新增页面级横向溢出，不改变销售概览、过程分析、导出按钮或二级切换位置。
- [x] AC-205: Given DCC 182 已改名为无特殊字符的可 SQL 临时表, when 审查 11 项打铁查询和导出, then DCC 四项与其余来源一样只调用 `execute-sql-query` 对 ``双品牌DCC话务指标182`` 聚合，保留已审计日期、组织白名单、业务过滤和具体车系 fail-closed 边界；不得调用 preview、分页或 fallback。销售概览、过程分析既有指标不改；打铁导出在当前二级组中包含当前值、月环比、周环比及三阶段来源状态/完整性字段。
- [x] AC-272: Given 用户筛选 `startDate=2026-07-20&endDate=2026-07-22&brand=MG&region=全部`, when 复算 DCC `30分钟跟进率` 7 个大区与官方打铁看板同源 SQL, then 页面/模型使用 DCC 自身门店范围、DCC 业务过滤和 DCC 自身组织字段，7 大区结果与官方卡同源复算误差均 `<=0.05pp`；不得通过 `validDealers`、销售行集或 `processBaselineData` 裁掉 DCC 门店后再对齐。完成证据：前置认证态直接 SQL 聚合 7 区逐行一致，南 `2021/2198`、华中 `5301/5750`、西 `1651/1785`、苏皖 `2688/2973`、北 `2812/3132`、东南 `4223/4638`、中南 `2275/2404`；后续刷新因 `guancli auth status` 60s 无输出和 direct SQL `ETIMEDOUT` 暂不可重刷，不否定前置证据。
- [x] AC-273: Given 审查 DCC 四项当前、上月同期、上周同期 SQL, when 搜索 SQL 文本和请求参数, then 不存在 `authorizedDealerCodes IN (...)`、`validDealers` 白名单 IN 子句或由 Super App 有效经销商维表生成的 DCC 门店过滤；DCC 范围仅来自 DCC 自身组织字段、官方打铁业务过滤、显式上游组织筛选和观远行级权限。
- [x] AC-274: Given 任意 DCC 四项查询日期上下文, when 审查 SQL 与日期解析, then 当前期严格使用 `startDate <= DCC真实日期字段 <= endDate`，比较期仅由既有 `previousMonthRange(range)` / `previousWeekRange(range)` 派生；SQL 和代码不得出现 `current_date`、`now()`、`yesterday`、T+1、自然周或昨天所在自然月例外。
- [x] AC-275: Given DCC 事实中存在不在 `validDealers` 的 DCC-only 门店, when 用户查看打铁指标门店层或当前范围全部经销商扁平态, then 该门店可展示 DCC 四项值，非 DCC 打铁来源指标显示 `--`；销售概览、过程分析、顶部指标、目标和动态诊断不因该 DCC-only 门店补数或改变范围。
- [x] AC-276: Given DCC 门店在 DCC 自身事实里的大区/小区归属与 `validDealers` 归属不同或无 `validDealers` 归属, when 构建打铁大区/小区/经销商行, then DCC 四项按 DCC 自身大区/小区/经销商代码名称归属汇总；不得用销售/过程组织骨架或维表归属重映射 DCC 分子分母。
- [x] AC-277: Given DCC 与非 DCC 来源行集合不同, when 计算大区、小区、合计或导出汇总, then 每个指标按自身来源分子分母重聚合，DCC 四项包含 DCC 范围内分子分母，非 DCC 指标只包含非 DCC 授权范围内分子分母；不得平均门店率、不得用任一来源的组织骨架作为全来源交集。
- [x] AC-278: Given 上游传入具体 `area/district/dealer` 或 `regionCode/districtCode/dealerCode`, when DCC 四项查询, then 筛选条件下推到 DCC 自身大区/小区/经销商代码名称字段；空授权、无 DCC 行级权限、DCC SQL 失败、字段缺失或范围不可证时，DCC 四项 fail-closed 为 `数据不完整`，不得回退到 `validDealers` 或旧缓存。
- [x] AC-279: Given 当前期、上月同期、上周同期加载 DCC 四项, when 任一阶段构造查询, then 三阶段除日期范围外共享同一 DCC 门店范围、官方业务过滤、组织字段、车系 fail-closed 和完整性门禁；比较期失败只影响对应环比为 `加载失败`，不得改变当前期 DCC 值或非 DCC 来源结果。
- [x] AC-280: Given 本轮 DCC 范围合同开发完成, when 执行回归, then 不改变 UI、目标、表头目标提示、二级 Tab、两个外链、导出入口、车系 fail-closed、DCC 四项以外的公式、销售/过程/IP/意向/试驾来源 `validDealers` 合同、移动端、发布配置或依赖。完成证据：专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`。
- [x] AC-281: Given 代码审查本轮实现, when 搜索源码、测试和构建产物, then DCC 四项不再先依赖 `processBaselineData` 丢弃门店再二次映射；打铁行集能表达 DCC 与非 DCC 安全并集，并保留 source_status / complete / fieldGapReason 证据供 QA 追溯。完成证据：Code Review 首轮 `0/4/1`，修复后 Stage 1/2 PASS，最终 `0/0/2`；独立 QA PASS `0/0/0`。
- [ ] AC-298: Given PC 销售车系筛选选择任一具体车系或多个车系, when 加载“打铁指标”11 项, then 当前、上月同期、上周同期三阶段均必须按 6 个来源发起真实 SQL 查询或明确 fail-closed；不得复用全部车系结果、旧缓存、无车系 `processBaselineData` 行集或仅展示边界说明后继续给数。
- [ ] AC-299: Given 审查 6 来源打铁 SQL 和来源状态, when 车系筛选非空, then 来源字段必须分别为 `q00.周期首次意向闭环车系名称`、`w8.周期最近意向闭环车系`、`lbfb.车系`、`c82.车系名称`、`hd284.车系名称`、`fa1.CRM闭环车系名称`；DCC 不得使用 `原始车系名称`，也不得在 `CRM闭环车系名称` 不可证时回退到全部车系。
- [ ] AC-300: Given 任一来源返回原始车系值, when 执行来源 mapper, then 只允许映射为销售闭集 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07` 或 `unmapped`；不得生成新销售选项、不得把 `全新MG4` 与 `MG4 EV` 默认合并。
- [ ] AC-301: Given 用户选择 `未知车系`, when 各来源查询并聚合, then 只匹配原始值“未知”；来源字段存在且当前范围无“未知”样本时该来源绑定指标展示真实空样本 `--`，不得标记 `数据不完整`。
- [ ] AC-302: Given 用户选择 `其他车系`, when 按已完成来源级 distinct 审计构造任一来源 SQL, then `q00/w8/lbfb/fa1` 必须永远只精确过滤原始值“其他车系”，`c82/hd284` 必须永远只在 MG 范围内按排除全部已映射销售闭集车系后的剩余车型补集计算，非 MG 不进入补集；不得因当前日期、组织或当前查询结果是否存在精确值而在两种策略间切换；补集为空展示 `--`。
- [ ] AC-303: Given 来源字段缺失、字段不可查询、映射不可证、SQL 失败、业务码失败、触达完整性上限或返回结构不可证, when 用户选择具体车系, then 该来源绑定指标 fail-closed 为 `数据不完整` 并记录 `fieldGapReason`；真实无样本、无“未知”样本或 `其他车系` 补集为空不得误判为 fail-closed。
- [ ] AC-304: Given 当前期、上月同期、上周同期任一阶段加载, when 比较 SQL 文本、请求 identity 和来源状态, then 三阶段除日期范围外必须使用同一车系字段、同一销售闭集映射、同一由来源级 distinct 审计固定的 `其他车系` 策略和同一 `未知车系` 空样本语义；比较期不得回退到全部车系、跳过车系过滤或按查询结果动态切换 `其他车系` 策略。
- [ ] AC-305: Given v1.92 实现完成, when 执行非目标回归, then 打铁 11 项公式、目标、展示样式、二级 Tab、两个外链、导出入口、销售链路 `汇报车系名称` 枚举与过滤、过程分析其他区域、UI、移动端、发布配置和依赖均不因本次改变。
- [ ] AC-306: Given 审查源码和测试文件, when 对照 v1.92 合同, then 实现范围仅限 `multi-store-super-app/iron-metrics-api.js`、`multi-store-super-app/iron-metrics-contract.js`、`multi-store-super-app/iron-metrics-model.js`、`multi-store-super-app/vehicle-series.js`、必要 `multi-store-super-app/app.js` 查询 identity/状态编排及对应测试；测试至少覆盖 `validation/iron-metrics-query.test.mjs`、`validation/iron-metrics-contract.test.mjs`、`validation/iron-metrics-app-integration.spec.js`、`validation/vehicle-series.test.mjs`、`validation/vehicle-series-multiselect.test.mjs`。
- [ ] AC-307: Given Code Review 和独立 QA 复核 v1.92, when 搜索源码、测试和构建产物, then 不存在“具体车系下返回全部车系打铁结果”、`MG4 EV` 默认并入 `全新MG4`、DCC 使用 `原始车系名称`、`未知车系` 无样本报 `数据不完整`、`其他车系` 纳入非 MG，或按当前查询结果在精确过滤和补集之间动态切换的实现或测试期望。
- [ ] AC-308: Given v1.92 准备验收, when 执行工程门禁, then `npm test`、`npm run lint`、`npm run build`、`npm run test:pc` 和 critical audit 均通过；PC 自动化至少覆盖具体车系、`其他车系`、`未知车系`、多选集合、比较期、DCC CRM 字段、真实空样本 `--`、fail-closed、非目标 UI/导出不回归。未完成登录态真实观远抽验前，不得声称最终用户验收通过。
- [ ] AC-319: Given v1.93 在 v1.92 基础上加载“打铁指标”11 项, when 车系选中集合为任一具体车系或多选集合, then 邀约 7 项和试驾 4 项在当前、上月同期、上周同期均继承同一车系上下文和同一销售闭集映射结果；不得因过程分析补改、行集重建或缓存命中而回退到全部车系打铁值。
- [ ] AC-320: Given 审查高意向低水平 `high_intent_low_level_rate`, when 对比源码、构建产物和测试 fixture, then source 与 dist 的车系字段必须一致为 `周期最近意向闭环车系`；测试必须包含“字段写成其他最近/首次意向字段时失败”的反向断言，不能靠错误字段期望继续变绿。
- [ ] AC-321: Given 打铁 6 来源 source/dist 一致性审计, when 搜索 `q00/w8/lbfb/c82/hd284/fa1` 车系字段和 SQL 片段, then source、dist、测试 fixture 与契约文档必须同时指向 `q00.周期首次意向闭环车系名称`、`w8.周期最近意向闭环车系`、`lbfb.车系`、`c82.车系名称`、`hd284.车系名称`、`fa1.CRM闭环车系名称`；不得存在源码与构建产物字段漂移、测试只断言源码或测试 mock 与真实 SQL 字段不一致。
- [ ] AC-322: Given 用户选择普通车系、多选集合、`其他车系`、`未知车系` 或当前范围含 `MG4 EV` 原始值, when 打铁 11 项查询和导出, then 6 来源均复用 v1.92 静态销售闭集映射、`未知车系` 空样本 `--`、`其他车系` 来源级精确/补集策略和 `MG4 EV` 不并入 `全新MG4` 的合同；导出数值与页面同一过滤上下文，不得仅页面过滤而 CSV 回退全部车系。
- [ ] AC-323: Given 具体车系筛选下任一打铁来源字段缺失、字段不可查询、映射不可证、SQL/业务码失败、触达上限或完整性不可证, when 当前/月/周任一阶段结算, then 只让该来源绑定指标和阶段 fail-closed 为 `数据不完整` 或对应环比 `加载失败`，并保留 `fieldGapReason`、来源字段、车系集合和日期范围；不得使用无车系 preview 明细、旧缓存、前端聚合或全部车系 legacy fallback。`全部车系` 语义下可保留既有 legacy fallback。
- [ ] AC-324: Given v1.93 完成打铁遗留缺口修复, when 执行打铁非目标回归, then 11 项公式、目标、长表字段、二级 Tab、两个外链、allDealerMode、DCC 四项门店范围合同、DCC/非 DCC 安全并集、局部来源结算、五态展示、导出入口、浅深主题、键盘/ARIA、移动端边界和依赖均不因本次变化。
- [ ] AC-325: Given v1.93 Code Review、QA 和发布准备完成, when 对照 AC-319～AC-324 出具验收证据, then 必须同时包含打铁 11 项当前/月/周三阶段 SQL 字段证据、普通/多选/其他/未知/MG4 EV/空值测试矩阵、source/dist 字段一致性、旧错误字段反向测试、具体车系 fail-closed、全部车系 fallback 边界、非目标回归和认证态生产发布后抽验结果；任一缺项不得把本阶段标为已实现、已测试或已发布。
- [x] AC-226: Given 用户在 PC “打铁指标”Tab 内查看 `邀约指标 7 / 试驾指标 4` 二级切换, when 二级切换区域渲染完成, then 二级 Tab 右侧显示可点击链接“打铁运营看板”；点击后打开固定 URL `https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845`，建议新窗口打开且具备 `noopener/noreferrer` 防护；链接继承现有样式，不移动现有二级 Tab、表格、导出入口或一级 Tab，不改变当前指标组、筛选、下钻、扁平态、分页、取数或导出范围。
- [x] AC-235: Given 用户在 PC “打铁指标”Tab 内查看 `邀约指标 7 / 试驾指标 4` 二级切换, when 二级切换区域渲染完成, then 右侧工具栏同时显示“打铁运营看板”和“优质试驾看板”两个可点击外链，顺序固定为 `打铁运营看板 → 优质试驾看板`；“优质试驾看板”点击后以 `<a target="_blank" rel="noopener noreferrer">` 新窗口打开固定 URL `https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa`，保留完整查询参数。两个外链继承同一轻量样式，1280px/1440px 浅色与深色主题下不挤压二级 Tab、不造成页面级横向溢出或文字截断；均可键盘聚焦和触发且具备可见 focus。切换邀约/试驾、点击任一外链均不得改变 `activeMetricGroup`、一级 Tab、组织层级、`drillPath`、`allDealerMode`、分页、车系筛选、数据查询或导出。完成证据：两个按钮共存、顺序固定，优质试驾完整 URL/`pgId`/`id`、`target/rel`、键盘 `Tab → Tab → Enter`、非默认 `vehicleSeries=全新MG4` + `allDealerMode=true` 状态不污染、1280/1440 浅深邀约/试驾视觉均已通过；`npm test` 126/126、`npm run test:pc` 87/87、定向 pc-tabs 10/10、lint Syntax check 45 files、build PASS、audit 0、敏感扫描 0、`git diff --check` PASS；复审最终 PASS P0/P1/P2=`0/0/0`。已随北京时间 `2026-07-23 16:49:52` 的同一测试 App 包发布至 `q0844640cf6734877a3193d6`（`operation=update`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`、包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`）；未发布生产、未 commit、未 push。

### REQ-014: PC MG 07 小订战报独立模块

**优先级：** P0

**关联范围：** SCOPE-028

**关联任务：** TASK-020

**关联流程：** FLOW-004

**状态：** v1.94 需求已确认，待开发；当前仅同步 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`，未改源码、未测试、未发布。

**需求说明：**

PC 顶部新增独立模块 `MG 07小订战报`，用于管理层和区域/小区/门店角色查看 MG 07 小订目标、累计小订、按时间进度的达成差距，以及逐层下钻后的落后对象。模块必须独立于销售总览、过程分析和打铁指标：不跟随父应用销售日期、车系筛选、销售/过程/打铁下钻状态，不改变现有导出、截图、移动端或单店跳转。

**信息架构与交互：**

- 模块标题固定为 `MG 07小订战报`；展开区域标题固定为 `小订达成表现`。
- 摘要常驻展示 4 个固定指标：`小订目标`、`累计小订`、`目标达成`、`时间进度`。
- 第五动态位按当前小订层级显示：总部层为 `落后大区`，大区层为 `落后小区`，小区层为 `落后门店`，单店层为 `自身进度状态`。
- `小订达成表现` 默认收起；展开状态仅在当前页面会话内保留，新入口、浏览器刷新或上游 URL 上下文变化后恢复收起。
- 模块视图状态使用独立 `smallOrderViewState`，不得复用或改写 `organization.viewLevel`、`drillPath`、`allDealerMode`、销售/过程/打铁页码或选中门店状态。

**固定统计期与计算：**

- 小订期固定为 `2026-07-29` 至 `2026-08-22`，含首尾共 25 天。
- 状态文案固定为：`小订即将开始`、`小订进行中`、`小订已结束`。
- 实际累计窗口：`2026-07-29` 前为空或 0；`2026-07-29` 至 `2026-08-22` 为 `2026-07-29` 至运行时今天；`2026-08-23` 起固定为完整小订期。
- 时间进度按自然日计算并保留 1 位小数，不按工作日，不跟随父应用 `startDate/endDate`。
- 核心计算字段为 `target_total`、`actual_small_order_all`、`achievement_actual`、`retained_small_order`、`cancelled_small_order`、`data_updated_at`、`period_progress`、`expected_by_time`、`gap_to_expected`、`achievement_rate`。
- `achievement_rate = achievement_actual / target_total`；目标为 0 时展示 `--`，不计算达成率和时间进度差距。

**目标数据合同：**

- 目标源文件为 `/Users/chengfengguo/Downloads/100家快闪店展车试驾车信息收集0727.xlsx`，Sheet 为 `经销商目标`。
- 目标源字段为 `区域`、`省份`、`城市`、`MAC`、`一级经销商`、`经销商简称`、`MG07小订目标`。
- 目标观远数据集已创建，名称为 `MG07小订目标_20260727`，`dsId=h8ae7b66fd5d141ec95bd246`，`parentDirId=r0d6927b9b1d640d7ac3eabb`，状态 `FINISHED`，404 行 / 8 列；运行时配置键 `mg07SmallOrderTargetDsId` 必须填该真实 `dsId`。
- 目标清洗验收固定为：404 行中 1 行总计为空代码且运行时排除；剩余 403 行经销商配置、403 家唯一 canonical 一级经销商、403 个唯一代码、总目标 30001、零目标 17 家、7 大区，并保留 `MQ856G`、`MQ877K` 等补码样本。
- `MG07小订目标` 必须清洗为非负整数；0 是合法目标，空值、负数、非数字、小数或缺字段均为目标合同失败。
- 清洗目标数据必须增加审计字段：`原一级经销商代码`、`canonical一级经销商代码`、`代码修正说明`、`组织映射状态`、`组织映射来源`、`目标源行号`。

**组织映射与权限合同：**

- 权威组织源为观远经销商维表 `a310ff90fddff4b6283841c6`（新双品牌经销商主数据维度表）和现有系统组织范围；该维表用于 canonical code、组织代码、组织名称、门店状态和角色权限裁剪。
- 目标代码优先匹配全量 MG 权威维表，不局限当前应用 valid primary（MG+开业+非二网+官网名称）。
- 当前实时审计事实：目标 403 家按 valid primary 仅命中 395 家；8 家目标合计 287 未命中 valid primary：`MQ207J=104`、`MQ257T=45`、`MQ576H=0`、`MQ576K=78`、`MQ877K=44`、`MQ9331=0`、`SQ2547=0`、`SQ2881=16`。
- 除 `MQ257T` 外，其余 7 家在全量 MG 权威维表中存在，只是预留、异常、退网或其他非 valid primary 状态；这些门店允许按全量权威维表映射 canonical code 和组织归属，再按用户权限裁剪。
- `MQ257T` 是 Excel 代码笔误：目标行名称为 `溧阳名锐`、目标 45；权威维表中名称 `溧阳名锐` 唯一命中一级经销商 `MQ256T`（溧阳名锐汽车销售服务有限公司，`4苏皖区 / SQR700 / 罗恩 SMG503`，开业非二网）。清洗上传必须规范化为 `canonical一级经销商代码=MQ256T`，原 Excel 不改，并保留 `原一级经销商代码=MQ257T`、`代码修正说明=权威维表按经销商简称唯一命中`。
- 代码 0 命中时，才允许使用 `经销商简称 + 区域全称 + MAC姓名` 在权威维表唯一匹配生成 canonical code；目标表文本本身不直接成为权限字段。0 命中或多命中必须进入 `organization_unmapped` 并 fail-closed。
- 权限裁剪必须发生在 canonical code 和权威组织映射之后；角色只能看到自己有权的 canonical 门店和上级组织，不得因目标表 `区域/MAC` 文本扩大权限范围。
- 组织映射失败的目标行及对应实际均不得进入页面、摘要目标汇总、达成分母、落后对象列表、下钻或导出型内部审计结果。

**实际数据合同：**

- 实际源固定为销售事实源 `k4c14c31c595540a0a771f50`。
- 过滤条件固定为 `品牌名称=MG`、`汇报车系名称=MG 07`、`日yyyy-mm-dd` 落在固定小订实际窗口内。
- 聚合自然键为 canonical 一级经销商代码；字段使用 `当日首触小订数`、`当日首触留存小订数`、`当日首触小订退订数` 和 `调度时间`。
- `当日首触小订转大定数` 当前隐藏，不展示、不计算目标达成、不作为替代指标。
- 实际有目标无、目标有实际无、零目标有实际、实际无目标必须分别进入审计，不能被静默吞掉。

**异常语义：**

- `zero_target_actual`：目标为 0 且实际 > 0，实际计入 `累计小订` 和上层 `achievement_actual`；本对象自身达成率展示 `--`，不计算差距。
- `unconfigured_actual`：实际存在但目标未配置，实际计入 `累计小订`，不计入 `achievement_actual`、达成率分母或默认落后列表。
- `organization_unmapped`：目标或实际无法映射到 canonical code 和权威组织，目标与实际均 fail-closed 排除，并输出审计。

**验收标准：**

- [ ] AC-326: Given PC 页面加载完成, when 查看顶部模块, then 页面存在独立模块标题 `MG 07小订战报`，摘要常驻展示 `小订目标`、`累计小订`、`目标达成`、`时间进度`，第五动态位按层级显示 `落后大区/落后小区/落后门店/自身进度状态`；不得嵌入销售总览目标摘要或复用打铁 Tab。
- [ ] AC-327: Given 用户首次进入、刷新页面或上游 URL 上下文变化, when 查看模块, then `小订达成表现` 默认收起；Given 用户手动展开后在当前会话内切换小订层级, then 展开状态保留；不得写入 URL、父应用状态或持久缓存。
- [ ] AC-328: Given 运行时日期分别为 `2026-07-28`、`2026-07-29`、`2026-08-22`、`2026-08-23`, when 计算状态和实际窗口, then 分别符合小订前、首日、末日、结束后的固定窗口语义；时间进度按 25 天自然日保留 1 位小数，不读取父应用 `startDate/endDate`。
- [ ] AC-329: Given 配置缺少 `mg07SmallOrderTargetDsId=h8ae7b66fd5d141ec95bd246`、目标数据集无权限或字段缺失, when 页面加载, then 仅 `MG 07小订战报` 进入目标不可用/数据不完整状态，销售总览、过程分析、打铁指标、车系筛选、导出和门店详情跳转均不受阻断；不得写假目标 `dsId` 或读取本地 Excel。
- [ ] AC-330: Given 目标数据集 `MG07小订目标_20260727` 已创建, when 执行目标合同 QA, then 数据集状态必须为 `FINISHED`、`dsId=h8ae7b66fd5d141ec95bd246`、`parentDirId=r0d6927b9b1d640d7ac3eabb`、404 行 / 8 列；其中 1 行总计为空代码必须运行时排除，剩余 403 行经销商配置、403 家唯一 canonical 一级经销商、403 个唯一代码、总目标 30001、零目标 17 家、7 大区，并保留 `MQ856G`、`MQ877K`；任一数量不守恒不得进入开发验收。
- [ ] AC-331: Given 目标字段存在空值、负数、非数字、小数或缺字段, when 清洗目标, then 该批目标合同失败并输出源行号；合法 0 目标保留且参与零目标审计。
- [ ] AC-332: Given 目标 403 家与 `a310ff90fddff4b6283841c6` 做组织映射, when 按 valid primary 审计, then 必须证明 valid primary 命中 395 家，8 家未命中 valid primary 合计 287，明细为 `MQ207J=104`、`MQ257T=45`、`MQ576H=0`、`MQ576K=78`、`MQ877K=44`、`MQ9331=0`、`SQ2547=0`、`SQ2881=16`；不得把这 8 家直接丢弃导致 403/30001 不守恒。
- [ ] AC-333: Given 全量 MG 权威维表映射执行完成, when 审查 8 家未命中 valid primary 目标, then 除 `MQ257T` 外 7 家必须在全量 MG 维表中找到并保留状态审计；`MQ257T` 必须按 `经销商简称 + 区域全称 + MAC姓名` 唯一匹配到 `MQ256T`，并在清洗数据中保留 `原一级经销商代码=MQ257T`、`canonical一级经销商代码=MQ256T`、`代码修正说明=权威维表按经销商简称唯一命中`。
- [ ] AC-334: Given 目标代码在权威维表 0 命中或多命中, when 无法唯一生成 canonical code, then 该行进入 `organization_unmapped` 并 fail-closed；目标表 `区域/MAC` 文本不得直接成为权限字段、组织汇总字段或下钻字段。
- [ ] AC-335: Given 任一用户角色查看小订战报, when 组织映射已生成 canonical code, then 页面先按权威组织归属建立大区/小区/门店，再按当前用户权限裁剪；QA 必须证明 `MQ257T -> MQ256T` 后角色权限未扩张，非授权 canonical 门店不出现在摘要、列表、下钻或审计可见结果中。
- [ ] AC-336: Given 实际源 `k4c14c31c595540a0a771f50` 可查询, when 构造小订实际查询, then 必须过滤 `品牌名称=MG`、`汇报车系名称=MG 07`、`日yyyy-mm-dd` 固定窗口，并聚合 `当日首触小订数`、`当日首触留存小订数`、`当日首触小订退订数`；`调度时间` 作为数据更新时间。
- [ ] AC-337: Given 实际源包含 `当日首触小订转大定数`, when 页面展示和计算, then 该字段不得展示、不得计入小订目标达成、不得替代任何小订指标。
- [ ] AC-338: Given 目标为 0 且实际 > 0, when 计算摘要和列表, then 记录 `zero_target_actual`；实际计入 `累计小订` 和上层 `achievement_actual`，该对象自身达成率展示 `--` 且不计算时间差距。
- [ ] AC-339: Given 实际存在但无目标配置, when 计算摘要和列表, then 记录 `unconfigured_actual`；该实际只计入 `累计小订`，不得计入 `achievement_actual`、达成率分母或默认落后列表。
- [ ] AC-340: Given 目标或实际无法映射到 canonical code 和权威组织, when 页面结算, then 记录 `organization_unmapped`；该目标和实际均不得进入摘要目标、达成分母、累计达成、列表、下钻或可见导出。
- [ ] AC-341: Given 用户在小订战报中下钻或返回, when 检查全局组织状态, then 只改变 `smallOrderViewState`；`organization.viewLevel`、`drillPath`、`allDealerMode`、销售/过程/打铁页码、当前 Tab 和车系筛选均保持不变。
- [ ] AC-342: Given 总部、大区、小区、销售总监、投资人或门店角色进入页面, when 打开小订战报, then 入口层级和可下钻层级只基于用户已有组织权限和 canonical code 裁剪；不得通过目标表区域文本暴露额外大区、小区或门店。
- [ ] AC-343: Given 展开 `小订达成表现`, when 查看对象列表, then 仅展示当前小订层级对象，字段至少包含对象名称/代码、目标、实际、达成率、时间进度、应达差距、状态；默认排序为 `gap_to_expected` 降序、组织代码升序。
- [ ] AC-344: Given 小订请求快速切换、刷新、下钻或返回, when 旧请求晚于新请求返回, then 独立 `smallOrderLoadToken` 必须丢弃旧响应；缓存键必须包含模块名、用户身份、权限范围、小订下钻路径、目标 dsId、实际 dsId、固定小订期和截止日期。
- [ ] AC-345: Given 目标配置失败、实际源失败、权限失败、字段完整性失败或结果为空, when 页面渲染, then 模块五态独立展示加载、成功、空、无权限、数据不完整；失败状态不得拖垮销售/过程/打铁主链路。
- [ ] AC-346: Given 1280px、1366px、1440px PC 视口和浅色/深色主题, when 查看摘要和展开列表, then 模块与现有页面视觉体系一致，摘要文本不截断、不互相覆盖、不造成页面级横向滚动，展开/收起控件可点击、可键盘聚焦。
- [ ] AC-347: Given v1.94 开发完成, when 执行非目标回归, then 销售总览、过程分析、打铁指标、负向问题率、车系筛选、目标摘要、销售导出、截图协议、移动端、单店跳转、父应用筛选器、发布配置和依赖均不因本模块变化。
- [ ] AC-348: Given 执行浏览器 QA, when 模拟 `2026-07-28`、`2026-07-29`、`2026-08-22`、`2026-08-23` 四个运行时日期, then 小订状态、实际窗口、时间进度、目标达成和落后对象均符合固定小订期，不受页面日期筛选影响。
- [ ] AC-349: Given 执行异常 QA, when 构造零目标有实际、实际无目标、组织 0 命中、多命中和 `MQ257T -> MQ256T` 样本, then 审计输出必须包含原代码、canonical code、经销商名称、目标、实际、窗口、异常类型和处理结果。
- [ ] AC-350: Given 实施文件和测试范围审查, when 对照 DEV-PLAN Phase 3AF～3AI, then 只允许新增或修改小订相关配置、API、模型、视图、样式和验证文件；不得新增依赖、升级 React/Vite/Playwright/TypeScript 或修改生产发布配置。
- [ ] AC-351: Given 工程门禁执行, when 完成实现后验收, then `npm test`、`npm run lint`、`npm run build`、`npm run test:pc`、critical audit、隐私扫描、source/dist 一致性和关键浏览器截图均通过；未完成真实 `dsId`、权限和认证态 QA 前，不得标记已发布或线上验收通过。
- [ ] AC-352: Given 目标数据集真实 `dsId=h8ae7b66fd5d141ec95bd246` 未配置、未授权或运行时不可读, when 开发/测试试图加载小订模块, then 只能进入明确配置缺失/无权限状态并保留主链路可用；不得用样例 ID、旧目标源、Excel 本地路径、前端硬编码或构建时内联数据替代真实观远目标数据集。

## 6. 数据模型

### 6.1 核心实体

| 实体 | 描述 | 关键字段 |
|---|---|---|
| 区域范围 | 当前用户可见的大区/小区及其下属门店集合 | 大区、小区、经销商代码、经销商名称 |
| 区域漏斗指标 | 区域/小区在日期区间内的销售漏斗聚合结果 | 日期区间、线索、到店、试驾、订单、转化率 |
| 门店漏斗指标 | 单门店在日期区间内的销售漏斗结果 | 经销商代码、日期区间、线索、到店、试驾、订单、转化率 |
| 门店诊断结果 | 单门店自然月官方诊断结果 | 统计月份、经销商代码、经销商名称、主问题名称、结果断点 |
| 父应用上下文 | 零售智能驾驶仓通过 URL Query 传入的筛选和主题状态 | startDate、endDate、period（兼容现行日期范围语义）、brand、brandCode、region、regionCode、district、districtCode、dealer、dealerCode、dealerShortName、theme、previewMode |
| 车系筛选上下文 | PC 页内车系多选集合及其可重放查询状态 | 重复 vehicleSeries（规范主参数）、carSeries / series（历史单值兼容读取）、品牌级全量枚举、`全部车系`、按枚举顺序稳定的选中集合 |
| MG 订单/零售目标 | MG 自然月目标配置；v1.88 起订单目标来自打铁最终目标输出，零售目标来自销售转化漏斗目标表 | 订单目标：日期、品牌、大区/小区/经销商名称、大区/小区/经销商代码、车系、订单目标、目标月份、输出行 SUM、组织代码空值审计、名称归属状态、订单源状态；零售目标：目标日期、dealer_code、车系、总零售目标、目标月份、零售目标自然键、零售源状态；缺口/冲突审计 |
| MG 07 小订目标 | MG 07 小订固定期目标配置，来自 Excel 清洗上传后的新观远数据集 | 目标源行号、原一级经销商代码、canonical一级经销商代码、经销商简称、区域全称、MAC姓名、MG07小订目标、代码修正说明、组织映射状态、组织映射来源、目标源状态 |
| MG 07 小订实际 | MG 07 小订固定期实际销售事实聚合 | dsId=`k4c14c31c595540a0a771f50`、日yyyy-mm-dd、品牌名称、汇报车系名称、canonical一级经销商代码、当日首触小订数、当日首触留存小订数、当日首触小订退订数、调度时间 |
| MG 07 小订战报视图状态 | PC 小订战报独立下钻与展开状态 | smallOrderViewState、smallOrderViewLevel、smallOrderDrillPath、smallOrderExpanded、smallOrderPageIndex、smallOrderLoadToken、cacheIdentity |
| MG 07 小订异常审计 | 小订目标、实际、组织映射和权限裁剪异常记录 | anomalyType=`zero_target_actual/unconfigured_actual/organization_unmapped`、原代码、canonical code、经销商名称、目标、实际、固定窗口、处理结果、可见性 |
| PC 截图请求 | 父应用通过 postMessage 向 PC 入口发起的长图导出请求 | type、requestId、theme、filters |
| 埋点访问事件 | GIO 自定义事件记录当前访问人和页面上下文 | trackId、pageAction、pageName、eventTime、personId、personName、McharacterName、OrgName、RegionName、SubRegionName、OrgCode |
| 移动端页面状态 | 移动端独立入口的最小视图和页面会话状态 | 当前表现类型、当前有效页码、卡片展开集合、指标展开状态 |
| 打铁运营指标 | 邀约/试驾的组织级当前、上月同期、上周同期运营指标长表 | section_code、page_order、organization_level、organization_code、organization_name、metric_code、display_name、metric_value、numerator、denominator、previous_metric_value、previous_numerator、previous_denominator、week_metric_value、week_numerator、week_denominator、month_delta_pp、week_delta_pp、target_value、target_label、unit、precision、dataset_name、dataset_id、source_status、previous_source_status、week_source_status、complete、previous_complete、week_complete、query_mode=`sql_aggregate`、date_field、vehicle_series_field、source_vehicle_series_values、sales_vehicle_series_closed_set、field_gap_reason；来源状态中的字段缺口原因为 `fieldGapReason` |
| 打铁指标视图状态 | PC 打铁指标 Tab 内的展示、二级切换、下钻和扁平态状态 | activeMetricGroup=`invite/trial`、viewLevel、drillPath、pageIndex（页面展示）、organizationOrder、allDealerMode、effectiveLevel=`store`、exportScope=`allRowsInCurrentDrill` 或 `allDealersInCurrentScope` |
| DCC 打铁门店范围 | DCC 来源 4 项独立使用的官方业务过滤后 DCC 门店集合 | DCC 自身大区/小区/经销商代码名称、DCC 行级权限状态、业务过滤状态、current/previous/week 日期范围、dcc_scope_status、DCC-only 标识 |
| 当前范围全部经销商扁平查看状态 | PC 销售概览/过程分析/打铁指标共享的只读展示模式 | allDealerMode、effectiveLevel=`store`、snapshotViewLevel、snapshotDrillPath、snapshotSalesPageIndex、snapshotProcessPageIndex、snapshotIronPageIndex、snapshotIronMetricGroup、snapshotSelectedStoreCode、activeStoreTab、pageIndex、exportScope=`allDealersInCurrentScope` |

### 6.2 实体关系

| 关系 | 描述 |
|---|---|
| 区域范围 has many 门店漏斗指标 | 一个区域/小区下有多家门店 |
| 区域漏斗指标 aggregates 门店漏斗指标 | 区域漏斗由当前权限范围内门店同口径聚合 |
| 门店诊断结果 joins 门店漏斗指标 | 诊断清单按统计月份和经销商代码拼接诊断结果与销售漏斗展示值 |
| 门店漏斗指标 joins 门店诊断结果 | 每家门店展示销售指标月环比、主问题名称和结果断点 |
| 门店漏斗指标 joins 过程标签聚合 | 过程表现 tab 展示邀约、试驾接待过程问题率和环比 |
| 父应用上下文 drives 区域漏斗指标 | URL Query 参数决定子应用筛选范围和主题 |
| 车系筛选上下文 drives 销售漏斗指标 | 重复 `vehicleSeries` 代表的选中集合仅以销售事实 `汇报车系名称` 收窄当前/上月/上周销售结果，并进入 URL、刷新、埋点与缓存键 |
| 车系筛选上下文 drives 打铁运营指标 | 重复 `vehicleSeries` 代表的选中集合进入打铁 11 项查询上下文；每个来源只允许使用本来源已审计物理车系字段和销售闭集映射过滤，缺字段或映射未审计时该来源 fail-closed 为 `数据不完整`；真实无样本展示 `--` |
| MG 07 小订目标 maps 权威经销商维表 | 目标代码优先匹配全量 MG 权威维表 `a310ff90fddff4b6283841c6` 生成 canonical code；代码 0 命中时仅允许用 `经销商简称 + 区域全称 + MAC姓名` 唯一匹配；0 命中或多命中进入 `organization_unmapped` |
| MG 07 小订目标 joins MG 07 小订实际 | 以 canonical 一级经销商代码和固定小订期关联；目标无实际显示 0，实际无目标进入 `unconfigured_actual`，零目标有实际进入 `zero_target_actual` |
| MG 07 小订战报视图状态 scopes MG 07 小订目标 / 实际 | 小订模块按自身 viewLevel/drillPath 展示大区、小区、门店，不改写销售/过程/打铁共享组织状态 |
| 父应用上下文 drives 打铁运营指标 | `startDate/endDate` 按各来源已审计日期字段闭区间过滤；`previousMonthRange(range)` 和 `previousWeekRange(range)` 派生上月同期、上周同期；`regionCode/districtCode/dealerCode` 与罗盘行权限、有效经销商白名单取交后进入每个打铁来源 SQL |
| DCC 打铁门店范围 scopes DCC 打铁四项 | 首跟通话60s占比、30分钟跟进率、24小时跟进率、2天3呼率只按 DCC 自身门店范围和组织字段聚合，不与 `validDealers` 求交；DCC 与非 DCC 门店骨架在页面层取安全并集 |
| MG 订单/零售目标 joins 区域范围 | 订单目标按 `u32` 自带组织代码/名称归入大区、小区、经销商层级并守恒，不与有效经销商维表取交集；零售目标按 `r05.dealer_code` 与现有有效经销商维表取交集，展示组织归属只取维表 |
| MG 订单/零售目标 joins 门店漏斗指标 | 订单目标实际使用 `当日订单数（首触）`，零售目标实际使用 `当日零售数`，同自然月+MG+一级经销商代码+汇报车系名称聚合 |
| PC 截图请求 captures 当前 PC 子应用页面 | 父应用向 PC 入口发起截图请求，PC 子应用返回当前页面 PNG；移动端入口不参与 |
| 移动端页面状态 presents 既有指标与门店事实 | 移动端只改变展示结构，不复制或改写业务数据口径 |
| 当前范围全部经销商扁平查看状态 derives 门店漏斗指标 / 过程基线组织骨架 / 打铁运营指标 | 激活后保留当前 `drillPath` 和上游筛选，把销售概览、过程分析和打铁指标展示粒度派生为经销商层；打铁指标仍按既有 `ironStores` / 无车系 `processBaselineData` 骨架与来源级 SQL-only 指标结果展示 |

### 6.3 数据规则

- 区域聚合只使用当前用户有权限的门店数据。
- 当前日期区间和上月同期必须同口径。
- 所有销售漏斗指标均以 `../单店销售诊断工作台_数据口径文档.md`、`../单店销售诊断工作台_前端表单数据映射.md` 和本次确认的销售漏斗数据集字段为口径来源。
- 零售字段使用销售漏斗数据集 `k4c14c31c595540a0a771f50` 的 `当日零售数/today_sale_cnt`；订单字段使用 `当日订单数（首触）/today_fst_touch_order_cnt`；交付率按 `零售 / 订单` 计算。
- 负向邀约占比和负向试驾接待占比复用原电话邀约、试驾接待达标统计标签聚合口径，只在过程表现展开后的 9 项问题明细和动态诊断中使用，不进入顶部或移动收起态指标卡。
- 过程表现 tab 中的邀约问题率复用 IP 电话标签聚合结果，按问题名匹配零钩子、未锁定时间、报价承接不足、竞品比较转化不足；三项试驾问题率复用一期单店试驾接待标签聚合结果，以 `版本推荐 -> 版本未推荐率`、`顾虑承接 -> 顾虑跳过率`、`竞品攻防 -> 竞品回避及贬低率` 作为固定映射。
- 三项试驾问题率的单店口径为唯一口径源：分母为同经销商、品牌、日期区间、一级标签下，且一级标签和二级标签均非空的去重 `试驾清单ID`；分子为该分母集合中有效判向且 `标签正负向` 为负向的去重 `试驾清单ID`。同一试驾命中多个二级标签时，每个指标内只计一次。
- 邀约四项和试驾三项必须分别按一级标签做定向聚合，仅取页面所需问题；不得返回无用 `problem_child` 组合，不得依赖前端从全量组合中过滤。
- 邀约四项和试驾三项的显示规则必须区分 `0.0%`、`--` 和错误：有分母且分子为 0 显示 `0.0%`；无一级/二级非空标签样本才显示 `--`；加载、映射、聚合、SQL/fallback、截断或完整性证据失败显示 `数据不完整`，不得伪装为空样本。
- IP 电话邀约和试驾接待必须按 `kind` 独立加载、独立完整性证据和独立错误状态；一类失败不得覆盖另一类成功结果。当前、上月同期、上周同期三阶段必须同构执行该规则。
- 试驾标签 SQL 聚合与明细分页降级必须同结果；历史表和 2026-07-17 当天实时直连表的字段映射必须与一期单店一致，不得在多店侧新增别名口径。
- 顶部及移动过程表现收起态的线索到店率按到店/线索、到店试驾率按试驾/到店、试驾订单率按订单/试驾、线索订单率按订单/线索计算；当前、上月同期、上周同期均使用同一销售漏斗事实源。
- 多店页只改变统计对象范围：从单一 `经销商代码` 扩展为当前筛选和权限范围内的多 `经销商代码` 集合；销售指标分子、分母、去重键和日期字段保持不变。
- 区域/小区聚合必须先按一期口径取得门店级或事件级基础事实，再在当前权限范围内求和、去重或加权汇总；不得用门店百分比简单平均替代一期分子分母口径。
- 门店排序默认以线索订单率下滑幅度为主，订单数下滑量用于影响规模校验。
- 当前版本不定义预估订单损失量。
- 当前重做版不展示重点追踪方向，首版不输出临时方向结论。
- 到店试驾率作为销售漏斗转化率卡片展示，不进入门店/顾问追踪方向，也不关联证据明细。
- 官方排名、官方分位、跨组织对标必须由数据层预计算，不由前端临时代表官方口径。
- 数据不在前端持久化；前端只读取观远数据集/表单结果并做展示公式。
- 父应用 URL Query 是嵌入模式下的筛选和主题单一来源；子应用不另设全局筛选状态源。
- `全部` 是筛选放开语义，不是业务字段值。
- PC 入口必须把长图截图请求视为只读操作，不改变当前页面筛选和数据状态；移动端入口不监听或响应截图协议。
- 子应用必须按 Excel `智能驾驶仓-零售过程` sheet 上报 `smartmind_sale_View`：`pageAction=0`；`pageName` 取页面标题；`eventTime` 取毫秒时间戳；`personId/personName/McharacterName/OrgName/RegionName/SubRegionName/OrgCode` 来自当前登录用户及人员管理数据集补全结果。
- 移动端入口复用同一 `smartmind_sale_View` 和身份补全链路，每次入口加载只初始化一次、上报一次，不自行新增移动端事件名；`pageName` 沿用现有页面标题/事件清单口径，端来源区分属于后续扩展。
- 移动端与 PC 端共用同一 URL 参数语义、权限范围、数据查询和指标计算口径；移动端页码、tab 和展开状态仅保存在当前页面会话，不写回数据源。
- 移动端门店列表分页基于当前可见门店集合，每页 15 家；切换页码不得改变上游 URL 传入的筛选范围。
- 本次销售漏斗最小改造中，销售源字段 `一级经销商代码/fst_dealer_code`、`父经销商简称/parent_dealer_shortname` 必须在查询层别名为既有 `经销商代码/经销商名称`；前端计算和渲染层不新增字段分支。
- 车系枚举与销售过滤唯一使用 `k4c14c31c595540a0a771f50.汇报车系名称`；枚举按品牌全量读取并由一期同构比较器排序，不能根据当前门店或日期的销售结果临时缩窄。
- 车系选中集合参与当前、上月同期、上周同期销售查询、订单/零售目标与达成、打铁 11 项六来源查询、刷新状态、埋点与缓存键；`全部车系` 表示不附加车系条件。品牌改变时必须先复位车系为 `全部车系`，再读枚举和销售事实。
- 过程链路的 `车系名称`、`CRM闭环车系名称`、`闭环车系` 和意向车系字段与销售 `汇报车系名称` 不可视为同一口径；v1.93 起“过程分析”Tab、过程指标、过程导出、查看全部经销商过程表现和动态诊断过程数据必须按 REQ-010 来源级合同分别映射过滤并继承同一车系集合。打铁 11 项按 REQ-012 来源字段和销售闭集映射真实联动；任一具体车系来源字段、映射、查询或完整性不可证时 fail-closed 为 `数据不完整`，不得回退全部车系或无车系明细。
- v1.88 起 MG 订单目标源为 `u32cb7e789f7443ff84160b4` / `打铁运营机制看板目标`，字段只使用 `日期、品牌、大区、小区、经销商、车系、订单目标、大区代码、小区代码、经销商代码`；`u32` 订单目标按输出行 SUM，不二次去重或纠正重复行；`日期/品牌/车系/订单目标` 为必需字段，组织代码可空，组织名称用于空代码时归属；`h9828e20e9026475091ae6ca` 仅为上游输入，不作为 App 最终订单目标源。MG 零售目标源仍为 `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标`，字段只使用 `目标日期、dealer_code、车系、总零售目标`；`r05.总订单目标` 不得参与订单目标。
- 订单目标组织归属优先使用 `u32` 的大区/小区/经销商代码；代码为空时使用 `u32` 的大区/小区/经销商名称归属到对应展示层级。`u32` 订单目标不与有效经销商维表取交集，不因空代码或 `validDealerMap` 未命中排除；2026-07 MG 全部车系必须保留 12 条空代码、目标 115。零售目标自然键为目标月份+MG+dealer_code+车系，并继续执行 r05 既有去重/冲突和 validDealerMap 规则。
- 订单目标达成分子为目标口径实际订单 `当日订单数（首触）`，按现有有效一级经销商代码+汇报车系名称匹配；无法映射到有效经销商代码的 `u32` 订单目标行目标保留、分子为 0 并计入审计，不得伪造实际。零售目标达成分子为同键目标口径实际零售 `当日零售数`；两条链路的 invalid_range、无目标、请求失败、目标有实际无、实际有目标无审计同构，但订单目标不使用 r05 的同键去重/冲突或白名单排除规则。
- v1.94 起 MG 07 小订战报使用固定小订期 `2026-07-29`～`2026-08-22`，不跟随父应用 `startDate/endDate` 或销售车系筛选。目标数据只通过 `mg07SmallOrderTargetDsId=h8ae7b66fd5d141ec95bd246` 读取真实观远数据集 `MG07小订目标_20260727`；配置缺失、未授权或运行时不可读必须降级小订模块，不阻断主链路。
- MG 07 小订目标清洗必须以权威经销商维表 `a310ff90fddff4b6283841c6` 生成 canonical code：代码优先匹配全量 MG 维表；代码 0 命中时才允许用 `经销商简称 + 区域全称 + MAC姓名` 唯一匹配；`MQ257T` 必须规范化为 `MQ256T` 并保留原代码和修正说明；0 命中或多命中 `organization_unmapped` fail-closed。
- MG 07 小订目标 QA 必须证明数据集 404 行 / 8 列中 1 行总计为空代码且运行时排除，403 行经销商配置、403 家唯一 canonical 一级经销商、403 个唯一代码、总目标 30001、零目标 17 家、7 大区守恒；按 valid primary 只命中 395 家的 8 家异常状态必须可审计，不能被白名单交集直接排除。
- MG 07 小订实际固定读 `k4c14c31c595540a0a771f50`，过滤 `品牌名称=MG`、`汇报车系名称=MG 07`、`日yyyy-mm-dd` 固定窗口，聚合首触小订、留存小订、退订小订；转大定字段隐藏。
- MG 07 小订战报权限裁剪必须发生在 canonical code 和权威组织映射之后；目标表 `区域/MAC` 只可作为匹配审计或展示来源，不得直接参与权限字段、汇总字段或下钻字段。
- MG 07 小订异常语义固定：`zero_target_actual` 的实际计入累计和上层达成但自身率为 `--`；`unconfigured_actual` 的实际只计入累计，不进入达成分母和默认落后列表；`organization_unmapped` 的目标和实际均排除可见计算。
- 打铁指标的 `activeMetricGroup` 只控制页面展示和导出范围，不进入数据源过滤；`invite` 与 `trial` 共享同一 `viewLevel/drillPath` 和无车系过程基线组织骨架，不建立两套下钻状态。
- 打铁指标目标值只用于生成表头 `target_label`；`target_label=null` 时前端不渲染第二层文案。不得基于 `target_value` 生成达标状态、颜色、圆点、标签或排序。
- 打铁指标来源结算必须从“整表 all-complete”改为“逐来源 settle”：来源完成即更新该来源绑定指标，来源失败或超时即 fail-closed 为 `数据不完整`，不能阻塞无关来源，也不能让整表永久骨架。
- 打铁 11 项只允许服务端 SQL 聚合取数，前端不得使用 preview 明细、分页 fallback、前端明细聚合或旧缓存补算；SQL 失败、业务码失败、字段缺失、字段映射未审计、截断或完整性不可证时，来源状态为 `数据不完整`。
- 打铁 11 项必须严格继承上游筛选器：日期使用 `startDate/endDate` 闭区间并绑定每项来源已审计真实日期字段；区域使用上游 `regionCode/districtCode/dealerCode`，与罗盘行权限和有效经销商白名单取交；车系使用每个真实来源已审计物理车系字段。缺字段或映射未审计时禁止“全部车系数据”或伪联动，必须阻断该来源并报告字段缺口。
- 打铁 11 项的月环比、周环比必须与过程分析同构：当前、上月同期、上周同期三阶段只允许日期范围不同，其他过滤、公式、去重和完整性门禁一致；比率环比为百分点差；比较期失败只影响对应环比显示为 `加载失败`，不得影响当前值。
- DCC 打铁四项范围合同覆盖 v1.72/v1.75 中“DCC 组织白名单/有效经销商白名单交集”类描述：DCC 四项不与 `validDealers` 求交，DCC 组织归属以 DCC 事实自身字段为准；销售、过程分析、IP/意向/试驾打铁来源和目标链路仍保持原白名单/权限合同。
- PC 当前范围全部经销商扁平查看只改变销售概览/过程分析/打铁指标的展示层级：销售数据来源仍为已过滤后的 `state.data.stores`，过程与打铁组织骨架来源仍为 `processBaselineData.stores` / `ironStores`；激活时等价于在保存进入前组织、销售/过程/打铁页码、打铁二级组和选中门店快照、冻结表现区真实组织返回事件后，以当前 `drillPath` 的经销商层构建行，不新增数据集、不重新定义销售/过程/打铁指标口径。
- 扁平查看模式下订单/零售排名和占比的比较集合是当前扁平经销商集合本身；不得继续按经销商所属小区拆分，否则全国/大区扁平列表中的排名不可比较。
- v1.85 起 PC 销售概览订单/零售动态展示排名均采用稳定唯一排名：主指标降序，同值按当前层级组织代码升序拆分；大区、小区、经销商三级、投资人 portfolio、当前范围全部经销商扁平模式、`drillPath` 收窄和单店收窄均适用。比较集合、排名总数、订单/零售占比分母、全国完整性门禁、车系/权限/组织/日期筛选和动态诊断口径保持不变。
- 上游 URL 筛选、品牌、日期、区域、经销商或车系变化必须清空扁平查看状态；销售概览/过程分析/打铁指标一级 Tab 切换和打铁二级组切换保留扁平查看状态。非扁平态打铁仍可合法更新真实组织层级；扁平态下打铁组织下钻/返回禁用，退出后恢复快照中的真实层级、路径、页码和二级组。

## 7. 外部依赖

| 编号 | 依赖 | 用途 | 是否必需 | 备注 |
|---|---|---|---:|---|
| DEP-001 | 一期销售漏斗指标源 | 支撑区域/门店漏斗聚合 | Yes | 严格复用一期销售漏斗分子分母和转化率公式 |
| DEP-002 | 门店诊断结果表 | 支撑门店销售表现中的主问题名称和结果断点 | Yes | 仅作为诊断结果展示源，不作为销售漏斗事实源 |
| DEP-003 | 一期 IP 电话邀约/试驾接待打标明细 | 支撑过程表现的邀约/试驾接待问题明细与动态诊断 | Yes | 只读取邀约四项、试驾三项和动态诊断所需标签数据，不进入顶部或移动收起态转化率卡；两类标签必须按 kind 独立加载和独立完整性门禁，三项试驾问题率必须复用一期单店分子分母、标签映射、去重、实时直连字段和错误状态 |
| DEP-004 | 一期单店诊断页 | 承接门店详情跳转 | Yes | 当前重做版不在区域页内展开单店详情，只通过按钮进入一期单店应用 |
| DEP-005 | 官方排名/分位结果表 | 后续如展示官方对标时读取 | No | P0 不强制展示跨组织官方排名 |
| DEP-006 | 零售智能驾驶仓父应用 | 承载「零售过程」Tab、顶部筛选和主题切换；PC 入口另承接长图导出 | Yes | 参考 `参考资料/xcf317965b417427e8765343.zip` 和嵌入文档；移动端不导出 |
| DEP-007 | URL Query 参数协议 | 初始化筛选、主题和预览模式 | Yes | 参考 `参考资料/embedded-app-url-params.md` |
| DEP-011 | 新双品牌经销商主数据维度表 | 提供现有一网有效门店白名单、组织归属和门店筛选选项 | Yes | dsId: `a310ff90fddff4b6283841c6`；本次不读取或构建父子关系，只校验维表一网 `经销商代码` 与销售事实 `一级经销商代码` 可一致匹配 |
| DEP-008 | PC 长图截图 postMessage 协议 | 父应用保存长图时获取 PC 子应用截图 | Yes | 仅 PC 入口适用；参考 `参考资料/embedded-app-capture-protocol.md`，移动端入口不响应 |
| DEP-009 | GIO SDK 与埋点事件清单 | 记录访问用户和零售过程页面浏览 | Yes | 参考根目录 `gio-tracking-integration.md` 和 Excel `智能驾驶仓主页-埋点-AI输入.xlsx` |
| DEP-010 | 人员管理-V1.4系统数据集 | 补全当前登录用户姓名、组织、角色、大区、小区和组织代码 | Yes | dsId: `hd704be94271f41e08744d31` |
| DEP-012 | 上游移动端应用 | 判断设备、选择移动端独立入口并以 iframe 传入 URL 参数 | Yes | 子应用不承担设备判断；移动端具体入口路径待开发阶段确定 |
| DEP-013 | PC 端共用前端能力 | 复用 URL 参数解析、数据查询、指标计算和门店详情跳转 | Yes | 复用能力但不修改 PC 页面入口和布局 |
| DEP-014 | 一期单店车系筛选实现 | 锁定枚举来源、排序和既有视觉基础 | Yes | 只读对标 `../super-app/src/App.tsx`、`src/services/storeDiagnosis.ts` 及相关样式；多店多选只复用真实枚举和排序，不沿用历史单选交互作为当前合同 |
| DEP-015 | 打铁运营机制看板与六个指标数据集 | 锁定新增 7 项邀约、4 项试驾的应用采用公式、目标、状态语义、来源车系字段和历史官方证据 | Yes | pageId=`c678fa8f2906744faaba8516`；完整 dsId、物理字段、应用口径和官方历史证据见 `docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md`；PC 展示与下钻设计见 `docs/superpowers/specs/2026-07-22-打铁指标PC展示与下钻设计.md`；v1.92 车系字段固定为 q00/w8/lbfb/c82/hd284/fa1 的已确认字段，DCC 使用 `CRM闭环车系名称` |
| DEP-016 | MG 零售目标数据集 | 支撑 PC 零售目标及零售达成率 | Yes | dsId=`r05b1e3995b0b4480991a4b8`；字段为 `目标日期、dealer_code、车系、总零售目标`；仅 MG，组织归属取 DEP-011；`总订单目标` 不再参与订单目标 |
| DEP-017 | 打铁运营机制看板目标输出 | 支撑 PC 订单目标及订单达成率 | Yes | ETL=`va7f9d6b8616a421c852b04c` 最终输出 dsId=`u32cb7e789f7443ff84160b4`；字段为 `日期、品牌、大区、小区、经销商、车系、订单目标、大区代码、小区代码、经销商代码`；订单组织归属按 u32 代码优先、空代码按 u32 名称归属，不与 DEP-011 取交集；上游 `h9828e20e9026475091ae6ca` 仅作来源审计，不作 App 订单目标 |
| DEP-018 | MG 07 小订目标数据集 | 支撑 PC `MG 07小订战报` 目标、达成率和落后对象 | Yes | 名称 `MG07小订目标_20260727`，dsId=`h8ae7b66fd5d141ec95bd246`，parentDirId=`r0d6927b9b1d640d7ac3eabb`，状态 `FINISHED`，404 行 / 8 列；运行时排除 1 行总计空代码，403 行经销商配置入数，目标 30001、零目标 17、403 个唯一代码、7 大区；`MQ257T` 清洗为 `MQ256T` 并保留审计 |
| DEP-019 | MG 07 小订实际销售事实源 | 支撑 PC `MG 07小订战报` 累计小订、留存、退订和更新时间 | Yes | dsId=`k4c14c31c595540a0a771f50`；过滤 `品牌名称=MG`、`汇报车系名称=MG 07`、固定小订期 `日yyyy-mm-dd`；使用 `当日首触小订数`、`当日首触留存小订数`、`当日首触小订退订数`、`调度时间` |
| DEP-020 | 全量 MG 权威经销商维表与现有组织权限 | 支撑 MG 07 小订目标 canonical code、组织归属和权限裁剪 | Yes | dsId=`a310ff90fddff4b6283841c6`；代码优先匹配全量 MG 维表，不局限 valid primary；代码 0 命中时才允许 `经销商简称 + 区域全称 + MAC姓名` 唯一匹配；目标文本不直接成为权限字段 |

## 8. 非功能需求

| 类别 | 要求 | 优先级 |
|---|---|---|
| 性能 | 销售指标和门店销售表现应随销售数据返回后立即展示 | P0 |
| 性能 | 筛选器完成归一化后，销售漏斗数据与有效门店范围并行读取；有效门店返回后只读取过程表现和动态诊断所需的邀约、试驾接待标签统计数据，顶部转化率卡不得等待标签结果 | P0 |
| 安全 | 继承观远用户身份和行权限，不展示无权限门店、顾问或客户信息 | P0 |
| 隐私 | 区域页不直接展示客户原文和顾问原文；客户证据只在一期单店页内展示 | P0 |
| 埋点 | GIO SDK 只在入口初始化一次；访问事件不得携带 token、身份证、完整密钥等敏感信息；用户基础信息只做页面会话内存缓存 | P0 |
| 兼容性 | 后续 Super APP 工程应兼容观远 Super APP 容器、iframe 嵌入和主流桌面浏览器 | P0 |
| 可靠性 | 数据缺失、上月同期缺失、无权限、无问题门店、参数缺失均需有明确状态；PC 入口另需处理截图失败 | P0 |
| 可靠性 | 试驾标签加载、字段映射、SQL 聚合、明细 fallback、分页上限、历史/实时截断必须有独立错误状态；不得把失败降级成 `--` 或 0 | P0 |
| 可靠性 | IP 电话邀约与试驾接待标签必须按 kind 独立成功、失败和重试；共用编排不得因任一 Promise 失败丢弃另一类已成功数据 | P0 |
| 可靠性 | 打铁 11 项必须按来源数据集独立记录查询状态、当前 `startDate/endDate` 闭区间、上游区域代码、车系字段审计和完整性；任一来源 SQL 失败、业务码失败、字段缺失、字段映射未审计、截断或完整性不可证不得用 0、`--`、全部车系数据、preview fallback 或旧缓存伪装成功，也不得清空其他来源已成功指标；v1.71 起必须逐来源结算并局部呈现，v1.72 起必须 SQL-only 且严格继承上游筛选，v1.75 起当前/上月同期/上周同期必须三阶段同构且比较期失败只影响对应环比 | P0 |
| 可靠性 | v1.92 起打铁 11 项车系联动必须区分真实空样本和不可证：`未知车系` 无“未知”样本、`其他车系` MG 补集为空、任一具体车系无样本均展示 `--`；只有字段/映射/查询/完整性不可证才 `数据不完整`。`全新MG4` 与 `MG4 EV` 不得默认合并，DCC 不得退回 `原始车系名称` 或全部车系 | P0 |
| 可靠性 | DCC 四项范围不可证、无 DCC 授权、空授权、SQL 失败、字段缺失或组织字段无法证明时必须 fail-closed；不得用 `validDealers`、销售/过程骨架、旧缓存或非 DCC 来源范围补齐 DCC 门店 | P0 |
| 可靠性 | 订单目标和零售目标必须拆源记录查询状态、目标归一审计、未配置实际和 invalid_range；订单目标额外记录 `u32` 输出行 SUM、空代码名称归属、无法映射实际分子和组织守恒审计，且不按同展示键去重、不按 validDealerMap 排除；零售目标保留 r05 冲突键和白名单缺口审计；任一目标链路失败不得阻断销售主链路或另一目标链路，也不得用另一源、旧目标缓存、上传原表、别名补码、硬编码补差或 fallback 值伪装成功 | P0 |
| 可靠性 | MG 07 小订战报必须独立记录目标配置、目标字段、组织映射、权限裁剪、实际源、异常语义和请求 token 状态；目标 `dsId` 未配置、无权限、字段缺失或审计失败只降级小订模块，不阻断销售/过程/打铁主链路；不得用假 `dsId`、Excel 本地路径、旧目标源或前端硬编码替代真实观远目标数据集 | P0 |
| 权限 | MG 07 小订目标必须先映射到 canonical 一级经销商代码和权威组织，再按当前用户权限裁剪；目标表 `区域/MAC` 只作展示或唯一匹配审计，不得直接成为权限字段；`MQ257T -> MQ256T` 后必须证明角色权限未扩张 | P0 |
| 数据质量 | MG 07 小订目标清洗 QA 必须证明 403 行 / 30001 目标守恒、8 家非 valid primary 异常状态可追溯、`MQ257T` 唯一名称映射为 `MQ256T`、`organization_unmapped` fail-closed 语义可验证 | P0 |
| 主题 | 白天/黑夜模式必须跟随父应用 `theme / previewMode`，避免 iframe 内外色差 | P0 |
| 导出 | 仅 PC 入口通过 `RETAIL_CAPTURE_REQUEST / RESPONSE` 协议返回完整子应用截图；移动端入口无导出按钮且不响应截图协议 | P0 |
| 导出 | PC 表现区现有导出入口必须按当前一级 tab 和当前层级导出；当一级 tab 为“打铁指标”时，非扁平态导出当前激活的邀约/试驾二级组、当前 `viewLevel/drillPath` 范围内全部组织行，扁平态导出当前激活二级组在当前全部经销商范围内的全部经销商行，均非仅当前页面分页，不新增第二个导出按钮 | P0 |
| 可访问性 | 可点击门店行、筛选器、跳转入口应具备清晰可见状态 | P1 |
| 可访问性 | PC 打铁一级 tab、二级切换、返回、分页和操作列必须可键盘访问，具备清晰焦点、`aria-selected/controls` 或等价语义，且不只靠颜色传递状态 | P0 |
| 可访问性 | PC “打铁运营看板”和“优质试驾看板”链接必须可键盘聚焦和触发，具备可读链接文本和可见 focus；新窗口外链必须使用 `target="_blank"` 与 `rel="noopener noreferrer"`，不得让当前 iframe 被外链替换；1280/1440 浅深主题下不得挤压二级 Tab 或造成文字截断、页面级横向溢出 | P0 |
| 移动兼容性 | 移动端独立入口按手机竖屏交付；业务内容在 375px CSS 宽度下无横向滚动，主流移动端 WebView/浏览器可完成全部 P0 操作 | P0 |
| 交互可靠性 | 快速重复翻页或切换 tab 时只呈现最后一次有效请求结果，旧请求不得覆盖新状态；失败可重试 | P0 |
| 交互可靠性 | 车系多选集合写入重复 `vehicleSeries`、埋点上下文与销售/目标查询缓存键；品牌切换复位车系；外点、Escape、ARIA 多选语义和菜单内部滚动可靠 | P0 |
| 交互可靠性 | PC 当前范围全部经销商扁平查看必须作为销售概览/过程分析/打铁指标共享展示状态实现；激活时保存并恢复进入前组织、销售/过程/打铁页码、打铁二级组和选中门店快照，三张 Tab 扁平态隐藏并冻结面包屑返回，不得破坏 `organization.viewLevel/drillPath`，不得改变顶部指标、上游筛选、权限白名单或打铁 11 项取数口径 | P0 |
| 可访问性 | PC 销售概览行内四率双层单元格必须在 1280px/1440px 浅深主题下保持约 108px～120px 行高、无页面级新增横向溢出；短标签具备完整可访问名称，涨跌不得只靠颜色表达 | P0 |
| 触控可用性 | 上一页、下一页、跳页、tab、展开/收起和门店详情均具有明确可点击区域、按压态和无障碍名称 | P0 |
| 可访问性 | “查看所有经销商 / 返回分层查看”入口必须可键盘聚焦和触发，具备明确无障碍名称；1280px/1440px 浅深主题下不得挤压 sticky 操作列或造成新增横向页面溢出 | P0 |
| 可访问性 | PC “销售经营进度”条必须具备可读名称，时间进度不得只靠颜色或图形表达；1280px/1440px 浅深主题下允许条内换行但不得造成页面级新增横向溢出或破坏下方指标卡基线 | P0 |

## 9. 完成定义

MVP 完成条件：

- [ ] 所有 P0 requirements 已实现。
- [ ] 页面顶部可展示销售指标框和过程指标框，包含当前值、月环比、周环比。
- [ ] PC 顶部“销售总览”标题行左侧标题组可紧接标题展示订单目标、订单达成、零售目标、零售达成、时间进度；右侧车系筛选保持最右，无目标时只显示标题且不留空槽，失败时同构降级并紧接标题，1280/1366/1440 浅深主题左侧组单行完整且无横向溢出。
- [ ] PC 顶部可展示独立 `MG 07小订战报`，摘要、展开列表、固定小订期、目标/实际源、canonical 组织映射、异常审计、权限裁剪和 1280/1366/1440 浅深主题验收全部满足 AC-326～AC-352；目标真实 `dsId`、权限和认证态 QA 未完成前，不得标记已发布或线上验收通过。
- [ ] 销售漏斗模块下方展示一个门店表现区，并通过销售表现/过程表现两个 tab 切换。
- [ ] 门店销售表现表字段为经销商名称、下发线索（月环比）、到店（月环比）、试驾（月环比）、订单（月环比）、订单排名、订单占比、零售（月环比）、零售排名、零售占比、主问题名称、结果断点，不展示月份和经销商代码。
- [ ] 页面不展示旧过程指标面板、趋势浮层、深度分析、问题分布、AI 总结、电话邀约/试驾接待切换模块。
- [ ] 过程指标框按线索到店率、到店试驾率、试驾订单率、线索订单率展示；到店试驾率不出现证据下钻入口。
- [ ] 过程分析中的 `版本未推荐率`、`顾虑跳过率`、`竞品回避及贬低率` 与一期单店同口径；`MQ8530 / MG / 2026-07-01~2026-07-16` 样本分别为 `16.7% / 7.7% / 10.0%`，并通过单店对比、多店聚合、2026-07-17 当天实时和 SQL 失败 fallback 验收。
- [ ] 过程分析中的邀约四项和试驾三项按 kind 独立加载；默认 `2026-07-01~2026-07-20 / MG / 全域` 定向聚合不触达 `5000` 上限，且 IP 失败/试驾成功、试驾失败/IP 成功、两者成功、两者均失败四类状态均已验收。
- [x] 表现区新增第三个 Tab“打铁指标”，7 项邀约和 4 项试驾的名称、顺序、目标、来源、分子分母、去重、过滤、当前区间日期、两项开口率分母、无状态展示、车系边界和五态语义均通过 AC-143～AC-150；PC 二级切换、表头层级、共享下钻、角色入口、操作列、导出当前范围全部组织行、1280/1440 浅深主题和可访问性均通过 AC-166～AC-176；现有邀约四项/试驾三项问题率未被替换。
- [ ] 打铁指标永久骨架屏修复测试发布：6 类来源逐来源结算、局部呈现、单源超时 fail-closed、旧请求不覆盖新上下文和 `数据不完整` 独立状态已进入 AC-177～AC-180 验收链路；当前已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`、包 SHA-256=`9ef29b84237fb8419492aead99f90a2c82ef7d785bc2e335fbfb75b33ce6cbc0`），最终 Code Review Stage 1/2 PASS（P0/P1=0/0），发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断），QA 执行门禁为 Node 108/108、PC 61/61、lint Syntax check 42 files、build 通过、audit critical=0；未完成登录态线上 UI 冒烟或真实观远指标数据集成验收，未发布生产、未 commit/push。
- [ ] 打铁指标 v1.72 上游筛选继承与 SQL-only 合同已重规划并验收：AC-181～AC-185 覆盖 `startDate/endDate` 闭区间、`regionCode/districtCode/dealerCode` 与有效经销商白名单取交、来源级物理车系字段过滤、无车系字段 fail-closed、禁止 preview 明细/分页 fallback；本次仅规格更新，`DEV-PLAN.md` 仍需后续同步重规划。
- [x] 打铁指标 v1.75 月环比/周环比与 DCC SQL-only 已完成并发布测试 App：AC-199～AC-205 覆盖 `邀约指标 7 / 试驾指标 4` 全量三行单元格、当前/上月同期/上周同期同口径范围、百分点差、比较期失败隔离、真实无分母 `--`、过程分析同 DOM/样式语义、DCC 新表 SQL-only 和导出字段；门禁 Node 119/119、PC 74/74、lint/build/audit/隐私扫描通过，发布包 SHA-256=`293a24705b23f9c3354e91cf196f6236b8b4f7563da0d86d05e80aefc26fe520`。未生产、未 commit/push；未执行登录态线上业务数据 UI 验收。
- [x] 打铁指标 v1.86 DCC 四项门店范围合同已完成本地实现、Code Review 与独立 QA，并已发布测试 App：AC-272～AC-281 覆盖 DCC 4 项不与 `validDealers` 求交、DCC 自身组织归属、DCC/非 DCC 安全并集、DCC-only 门店展示、父级分子分母重聚合、空授权 fail-closed、比较期同构和非 DCC 不回归；北京时间 `2026-07-24 12:54:09 CST` 发布到测试 App `q0844640cf6734877a3193d6`，`operation=update`、`version=0.1.0`、标准回执未返回 `fileKey`、URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。门禁为专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`、隐私 `0`、source/dist `29` 个复制型运行时文件一致；zip SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes、`dist 31 files / 600836 bytes`、`unzip -t` PASS；最终 Review `0/0/2`、QA `0/0/0`。匿名 HTTP `401` 仅认证边界；未做登录态线上 UI 验收，未发布生产，未 commit/push；后续刷新当前受 `guancli auth status` 60s 无输出与 direct SQL `ETIMEDOUT` 限制。
- [ ] 打铁指标 v1.92 销售车系筛选真实联动 11 项待开发：AC-298～AC-308 覆盖 6 来源三阶段真实查询、DCC `CRM闭环车系名称`、销售闭集映射、`未知车系` 真实空样本 `--`、`其他车系` 仅 MG 补集、`全新MG4` 与 `MG4 EV` 不默认合并、字段/查询不可证 fail-closed、禁止全部车系冒充，以及销售链路、过程分析其他区域、UI、导出入口、移动端和发布配置不回归；本次仅文档更新，未改源码、未发布、未 commit/push。
- [x] PC 过程表现 CSV 三列数值化导出 v1.87 已完成本地实现、Code Review 和工程门禁：交付文件为 `multi-store-super-app/app.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`，并由 build 生成 `multi-store-super-app/dist/app.js`；定向 `2/2`、Node `147/147`、PC `101/101`、lint Syntax check `45 files`、build PASS、audit `0`，source/dist `app.js` `cmp=0`、SHA-256 均为 `be44429dc33c3f63f7d8a0cf540867cf3135a4b9097690d9a1be4f679dff3665`。Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/1`，唯一 P2 为既有超长文件债；独立 QA 首次唯一 P2 为文档状态未回写，待本次回写后复核。未发布测试 App或生产，未 commit、push，未做登录态线上验收。
- [ ] PC 订单目标切换为打铁最终目标输出 v1.88 开发中/待复审：AC-283～AC-290 覆盖订单/零售目标拆源、订单源 `u32`、零售源 `r05`、禁止 `h982` 作为最终源、`2026-07 / MG` 订单目标 `1576` 行、7 区 `1995/5597/1950/2850/2615/5179/2638` 合计 `22824` 对账、12 条空组织代码但有组织名称的订单目标 `115` 必须保留、`210` 差额保留、订单/零售源失败隔离和非目标回归；本次仅文档更新，未改源码、未发布、未 commit/push。
- [x] PC 销售总览目标摘要左侧标题组 v1.91 已完成本地实现、独立 Review 与 QA，并已发布测试 App：AC-292～AC-297 覆盖 `销售总览 + 五项目标摘要` 左侧同组、摘要紧跟标题非居中、右侧车系筛选保持最右、1280/1366/1440 浅深主题单行完整、loading/success/error 紧接标题、hidden 不留空槽，以及指标卡、数据口径、异步加载、筛选、表格/导出和移动端不变；loading skeleton `172×12` 五段单行，定向 Node `2/2`、PC `12/12`、lint/build PASS；完整 suite 仅 `2` 个 Node + `1` 个 PC 因 `settings=test` 与历史 `production` 期望冲突失败，确认为范围外既有配置冲突。测试 App `q0844640cf6734877a3193d6` 发布成功：发布源 `/tmp/retail-v191-app-test-rK5Xyi/multi-store-super-app`，exit `0`、`operation=update`、`version=0.1.0`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a/`；settings 为 `environment=test`，单店 URL=`r8ce093b6d93143d8aa6852f`；zip SHA-256=`1f58981613e3ce1c346a743406179c0ba2f90fc1fd61d3cda38c6309587b504a`、`31 files`，`unzip` 与隐私扫描通过。GitHub 生产配置提交 `6f125ce` 已形成，但 push 因 SSH publickey 被拒，未推送 GitHub。
- [x] PC 当前范围全部经销商扁平查看已完成：AC-186～AC-198 已全部通过独立 Review 与最终 QA；最终门禁为 `npm test` 117/117、`npm run test:pc` 72/72、lint Syntax check 42 files、build 通过、audit critical=0，并已保存两张精确 `1440x900` viewport 浅色截图；未发布、未 commit 或 push。暗色过程表 `metric-value` 对比度与四项 P2 继承债另行处理，不阻断本次浅色展示，也不视为本阶段已修。
- [x] PC 当前范围全部经销商扁平查看 v1.77 打铁扩展最终本地 QA PASS，已发布测试 App：AC-214～AC-225 已全部实现。Review Stage 1/2 PASS，最终本地 QA 0 阻断；门禁为 `npm test` 126/126、`npm run test:pc` 85/85、lint Syntax check 45 files、build exit 0、audit critical=0。测试 Super App `q0844640cf6734877a3193d6` 平台发布成功且包信息正确：`environment=test`、exit 0、`operation=update`、版本 `0.1.0`，包 SHA-256=`e5c138b0549a6eb2b91b89964efb417b0d63ae476e447c3dd8c189bc73518807`、`138887` bytes、`31 files / 578408 bytes` 解包。发布后独立 QA 仅有限 PASS：Chrome 登录态非白屏且三张 Tab 可见；standalone 缺人员画像，未完成“查看所有经销商”登录态业务 UI 终验，不建议回滚。本项不改写 v1.73 已完成历史记录；未发布生产、未 commit、未 push。
- [x] PC “打铁指标”二级 Tab 右侧固定外链 v1.78 / AC-226 已发布测试 App：文案“打铁运营看板”、URL `https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845`、新窗口 `noopener/noreferrer` 均已验证；未移动现有二级 Tab、表格、导出入口或一级 Tab，未改变打铁 11 项数据口径、筛选、下钻、扁平态、分页或导出范围。门禁为 Node 126/126、PC 86/86、lint 45 files、build、audit critical=0、隐私扫描通过，1280/1440 浅深截图通过；Review P0/P1/P2=`0/0/2`，两项 P2 非阻断，既有 424 行测试文件拆分债本轮不拆；发布后独立 QA PASS，P0/P1/P2=`0/0/0`。测试 App `q0844640cf6734877a3193d6` `operation=update`、版本 `0.1.0`，包 SHA-256=`6f59891701ed953f8cd95173d1639cb99c90b318137cb3035a14ae06cfb7fd22`、`139391` bytes、`31 files`。匿名入口 302/401 仅表示登录保护，未做登录态线上业务 UI 验收；未发布生产、未 commit、未 push。
- [x] PC 销售经营进度条与时间进度 v1.79 已完成开发、Code Review Stage 1/2、最终 QA 与测试 App 发布：AC-227～AC-234 已关闭；Node 126/126、PC 89/89、lint 45 files、build、audit 0、隐私扫描、source/dist SHA 一致及 1280/1440 浅深四张截图通过。测试 App `q0844640cf6734877a3193d6` 发布包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`；匿名 401 只证明登录保护，Chrome 父应用自动验收持续超时，未完成登录态线上 UI 验收；未发布生产、未 commit/push。
- [x] PC 首屏销售渲染与目标异步解耦 v1.81 已完成开发、功能 QA 与测试 App 发布：AC-236～AC-242 已关闭，覆盖销售真实数据先渲染、目标独立加载态、目标成功局部回填、目标失败不阻断、旧目标响应丢弃、目标 preview 组织条件下推和性能回归门禁；本项未改变目标自然键、目标数据源、目标实际 SQL、组织归属、车系集合、自然月窗口、导出字段或销售/过程主指标口径。门禁证据：`npm test` 130/130、PC 95/95、lint Syntax check 45 files、build PASS、audit 0、1280/1440 浅深色通过；Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/2`。测试 App `q0844640cf6734877a3193d6` 更新成功，版本 `0.1.0`、`artifact=dist.0.1.0.zip`、`fileKey=1d9e70c3-938c-409d-b4e0-e1be26035edc`，最终 zip SHA-256=`3125ba0859ff122ba05aa2029eab924d2a7dbe2ab689f4a079b5104aa1810359`；zip 完整性与关键四文件 source/dist/zip 三方哈希一致性均通过。未发布生产、未 commit、未 push。
- [x] PC 目标摘要迁入销售总览标题行 v1.82 已完成开发、独立 Code Review 与最终 QA，并随共享隔离组合包发布测试 App：AC-243～AC-250 已关闭；主证据为隔离 Review/QA P0/P1/P2=`0/0/0`、Node `134/134`、PC `97/97`。2026-07-24 最终 QA 冻结快照（含当时并行 AC-258、尚未含后续 Phase 3Y）通过四态 PC `6/6`、Node `137/137`、PC `98/98`、lint/build/audit、24 张四态 × 三宽 × 双主题截图及 source/dist 一致性；全局计数不承诺随共享工作树保持不变。最新测试包、发布后 QA 与认证边界见文档顶部共享发布记录；未发布生产、未 commit、未 push。
- [x] PC 过程标签两波加载与渲染预算修复 v1.83 已完成独立 Code Review 与最终 QA，并随共享隔离组合包发布测试 App：AC-251～AC-257 已关闭；定向 Node `8/8`、Node 全量 `134/134`、PC `95/95`、lint `45 files`、build、audit `0` 通过，最终 QA P0/P1/P2=`0/0/0`。最新测试包、发布后 QA 与认证边界见文档顶部共享发布记录；未发布生产、未 commit、未 push。
- [x] PC 销售表现排名 CSV Excel 文本保护 v1.84 已发布测试 App并通过发布后独立 QA：发布前 Review Stage 1/2 与独立 QA 均 PASS，P0/P1/P2 均为 `0/0/0`；AC-258 定向 `1/1`、AC-258 + 公式注入/RFC4180 `2/2`、Node `134/134`、完整 PC `98/98`、lint Syntax check `45 files`、build PASS、audit `0`。发布源为 `/private/tmp/ac258-build-kTHdjn`，发布回执 exit `0`、`operation=update`、`appId=q0844640cf6734877a3193d6`、`version=0.1.0`，标准回执无 `fileKey`；最终 zip SHA-256=`b58a77a0da195968c801d96ee4a057eed6865f62a437a845f73aafe50b113706`，`141411` bytes、`31 files / 591132` 解包字节，完整性通过。zip 内 `app.js` SHA-256=`3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17` 且含 `excelTextRank`；zip 内 `organization-view.js` SHA-256=`36257c5f1ed3613b41260c34092a84b642c4ecd462464c7cac3a19d1ad9d5ee9`，保留 v1.84 竞争排名且未带入 v1.85。发布后 QA PASS，P0/P1/P2=`0/0/2`，两个 P2 仅为文档/边界并已关闭。匿名访问只证明登录保护，未做登录态 UI 或线上资源哈希验收；无 Windows Excel 直开实机截图。当前工作区已进入后续并行版本，不等同发布源；同源结论只限发布临时快照 source/dist/zip。未发布生产，未 commit、push。
- [x] PC 订单/零售稳定唯一排名 v1.85 已完成本地实现、独立 Review 与最终 QA，并随共享隔离组合包发布测试 App：AC-259～AC-271 已关闭，覆盖大区、小区、经销商三级订单/零售排名、53 对象末尾同值、投资人 portfolio、当前范围全部经销商扁平模式、单店收窄、全国完整性、稳定性、全 0、导出同步和非目标回归。原子提交 `ab55c19` 仅含 3 文件；门禁为 Node 定向 `23/23`、`npm test` `141/141`、lint `45 files`、build exit `0`、audit `0`、完整 PC `99/99`、最终 QA 收尾 `23/23` 和新增 53 行 PC `1/1`；Review P0/P1/P2=`0/0/1`（既有超长文件债，不阻断），QA P0/P1/P2=`0/0/0`。source/dist `organization-view` SHA-256 均为 `4980a43ba0309680e40bb2788308e5025acef659dcea3e1d4490f7ac89bd6b9c`；最新测试包、发布后 QA 与认证边界见文档顶部共享发布记录，未发布生产、未 push，未做登录态业务 UI 终验。
- [x] PC “打铁指标”二级 Tab 右侧“优质试驾看板”固定外链 v1.80 已随测试 App 发布：AC-235 已关闭，覆盖两个外链共存、顺序固定 `打铁运营看板 → 优质试驾看板`、完整 URL 与查询参数、新窗口安全属性、键盘 focus、1280/1440 浅深主题无挤压/无横向溢出，以及切换/点击不污染打铁状态、筛选、分页、查询或导出。门禁为 `npm test` 126/126、`npm run test:pc` 87/87、定向 pc-tabs 10/10、lint Syntax check 45 files、build PASS、audit 0、敏感扫描 0、`git diff --check` PASS；Code Review 复审最终 PASS P0/P1/P2=`0/0/0`；8 张现有 iron-metrics 邀约/试驾 1280/1440 浅深截图已刷新。已随北京时间 `2026-07-23 16:49:52` 的同一测试 App 包发布至 `q0844640cf6734877a3193d6`（`operation=update`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`、包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`）；未发布生产、未 commit/push。
- [x] PC 销售概览行内四率双层漏斗已完成本地实现：AC-206～AC-213 全部完成；首次 Code Review 发现并修复 1280px 右侧裁切 `41.6px` 与上月同期可比率为 `0.0%` 时误报 `--`，复跑 Stage 1/2 PASS，P0/P1/P2=`0/0/0`。最终 QA 临时副本门禁为 Node `126/126`、PC `82/82`、lint Syntax check `45 files`、build exit `0`、audit critical=`0`，功能与视觉均通过；首次 QA 唯一 P2 为文档状态不一致，本次已闭环修正。未修改顶部卡、过程分析、打铁、导出字段或数据查询；未发布、未 commit、未 push。
- [x] PC 订单/零售目标已切换到新 DS `r05b1e3995b0b4480991a4b8`：当前本地开发、代码复审、Node 90/90、PC 43/43、lint/build/audit critical=0 和旧 DS 源码/目标测试/dist 搜索清零已完成；最终 QA PASS，P0/P1/P2=0/0/0；未发布、未 commit、未 push。
- [x] 投资人 `marketing_userType=6` 门店层订单/零售排名和占比已按其当前有效门店集合统一计算，并通过 AC-165；总部、大区、小区、销售总监及普通门店层既有排名口径未回归。
- [x] 历史 PC 单选车系筛选默认“全部车系”，品牌级全量枚举和排序与一期单店同构；URL `vehicleSeries`、刷新和销售缓存键一致，品牌切换复位车系。当前多选升级已完成，见 AC-135～AC-142。
- [x] 历史具体单车系仅以销售 `汇报车系名称` 过滤销售漏斗、销售表现与销售导出；过程 Tab/过程导出明确说明同口径字段缺口，不伪造过程联动。当前多选集合联动已完成，见 AC-138、AC-141。
- [x] 历史车系筛选后 AC-088/AC-089 的大区数字前缀升序、小区/经销商订单降序和两个 Tab 同行序仍通过，并有全部车系、真实单车系、URL 重载、缓存隔离、枚举排序、1440px 展开态的自动化及截图证据。当前多选 1440×900 证据已完成，见 AC-142。
- [x] PC 车系筛选已升级为不限数量多选：默认/空集合为全部车系，重复 `vehicleSeries` URL、选中集合缓存/埋点、销售/目标/导出/排名/占比联动、过程边界、品牌复位和 1440×900 展开态证据全部通过；npm test 90/90、test:pc 43/43、lint/build/audit exit 0，Review Stage 1/2 PASS，最终 QA PASS，P0/P1/P2=0/0/2，2 项 P2 非阻断；未发布、未 commit、未 push。
- [ ] 子应用作为父应用「零售过程」Tab iframe 打开时，能读取 `startDate / endDate / brand / brandCode / region / regionCode / district / districtCode / dealer / dealerCode / dealerShortName / theme / previewMode`。
- [ ] PC 和移动端子应用页面访问时均复用 `smartmind_sale_View`，字段覆盖 `pageAction/pageName/eventTime/personId/personName/McharacterName/OrgName/RegionName/SubRegionName/OrgCode`；移动端入口单次加载只初始化一次、上报一次且不含敏感信息。
- [ ] `theme=dark&previewMode=dark` 和 `theme=light&previewMode=light` 下页面分别正确展示黑夜/白天模式。
- [ ] 父应用向 PC 入口发起 `RETAIL_CAPTURE_REQUEST` 后，PC 子应用能返回完整 PNG 截图或明确错误；移动端入口不响应该协议。
- [ ] 发布为新建独立 Super APP，不更新旧多店 App `x944c089c3c4249ea925fde6`，不修改一期单店 App。
- [ ] 主要错误状态、空状态、加载状态已处理。
- [ ] Product Spec 和后续 Design Spec / DEV-PLAN 中的 P0 内容保持一致。
- [ ] 同项目新增移动端独立入口，路径在开发阶段确定并记录；PC URL、PC 页面和 PC 既有能力未被替换或回归破坏。
- [ ] 移动端首屏无子应用标题、导航、返回、筛选和导出，直接展示两列四项核心指标，可展开到七项。
- [ ] 移动端销售表现/过程表现均使用门店卡片流；当前页首张默认展开、其余收起，每页 15 家。
- [ ] 移动端分页只包含上一页、当前页/总页数、下一页和跳页；边界禁用与非法页码校验通过。
- [ ] 移动端 URL 参数、数据口径、权限范围、主题和门店详情跳转与 PC 端一致，加载、空、错误、无权限和成功五态均已验收。

## 10. 假设与后续决策问题

### 10.1 假设

| 编号 | 假设 | 假设依据 | 错误风险 |
|---|---|---|---|
| ASM-001 | 区域聚合可基于一期销售漏斗指标源按权限范围汇总 | 一期已使用门店日粒度销售指标源 | 如果源数据不支持权限范围聚合，需要补区域聚合数据集 |
| ASM-002 | 问题门店排序以线索订单率下滑为主，订单下滑做影响规模校验 | 已确认默认排序逻辑 | 如果业务最终更重视订单绝对损失，排序需要调整 |
| ASM-003 | 到店试驾环节首版不作为追踪方向，不做证据下钻 | 已确认当前核心追踪线索邀约和试驾过程，且没有到店接待追踪数据 | 如果后续存在到店接待标签源，需要新增追踪方向、下钻设计和数据契约 |
| ASM-004 | 单店诊断页可接收并应用 2 期跳转参数 | 一期已有大区/小区/经销商/日期上下文 | 如果一期页面不支持参数化，需要在开发计划中补造跳转适配 |
| ASM-005 | 父应用会以 iframe 打开零售过程子应用，并传入 7 个约定 Query 参数 | 参考资料中 URL 参数文档和父应用构建产物一致 | 如果父应用参数名变化，子应用解析和联调需同步调整 |
| ASM-006 | 父应用长图导出会通过 postMessage 请求子应用截图 | 参考资料中截图协作协议已定义 | 如果父应用不接入该协议，子应用只能提供能力，不能保证最终长图包含 iframe |
| ASM-007 | Aily 智能体入口由父应用全局承载 | 参考资料中 Aily 文档显示其不改变顶部导航和内嵌子应用 | 如果后续要求子应用感知智能体上下文，需要单独设计接口 |
| ASM-008 | 2 期所有指标口径均复用一期单店工作台 | 用户已确认本次项目所有指标口径严格复用单店平台的数据口径和逻辑 | 如果一期口径文档或线上代码变化，2 期必须同步更新，不保留本地分叉口径 |
| ASM-009 | 上游移动端应用能可靠识别设备并配置新的移动端 iframe URL | 用户已明确设备判断属于上游职责 | 如果上游未完成入口路由，移动端页面无法被目标用户打开，但不应在子应用补设备判断 |
| ASM-010 | 现有 PC 端查询、参数解析、指标计算和门店详情跳转能力可被移动端入口复用 | 当前 PC 页面已具备这些能力，用户要求避免口径分叉 | 如果代码耦合导致无法直接复用，开发阶段需先抽取共享模块，但不得复制业务规则形成双份实现 |
| ASM-011 | 销售聚合结果只有与有效一网白名单取交集后才进入统计；交集内 `一级经销商代码/父经销商简称` 与维表一网 `经销商代码/经销商简称` 唯一且一致 | 当前筛选器值和 `metrics.js` 最终门店名称优先来自一网维表，既有逻辑会过滤白名单外销售行 | 白名单外代码直接排除且不阻断；白名单内多匹配、同码多父简称或名称不一致会导致展示口径不可信，仍须停止实施并输出差异清单 |
| ASM-012 | 官方打铁看板识别状态、周/月日期例外、两项开口率全体验点分母和官方达标分色仅作为历史页面事实保留，不进入 v1.69/v1.70 应用实现 | 用户已确认应用采用口径以当前 `startDate/endDate`、无状态展示、一期单店开口率分母和 C 方案二级切换为准 | 如果后续要求复刻官方看板周/月列、识别状态或达标分色，必须另发需求并同步更新口径文档、Spec、DEV-PLAN 和测试样本 |
| ASM-013 | 新目标 DS 仅服务 MG，且当前可命中组织应由有效经销商维表承接 | 用户已确认新表仅 MG，且查证 2026-07 新表 1542 行、订单 22578、零售 18580、无重复冲突，5 条非命中目标记录需排除并留 QA 缺口 | 如果后续扩品牌或新表组织字段被要求参与归属，必须另发需求，不能在本轮跨品牌复用 MG 目标 |
| ASM-014 | 打铁指标 v1.71 修复不改变 11 项指标公式、目标语义、二级切换或导出范围，只修加载收敛与失败隔离 | 线上测试 App `q0844640cf6734877a3193d6` 的试驾指标 4 暴露 all-complete 收敛导致慢/悬挂 DCC 或意向请求阻塞整表；本次采用逐来源结算与单源 fail-closed，并已发布测试 App `operation=update`、版本 `0.1.0`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`；发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断） | 匿名 HTTP 只证明重定向/登录保护平台边界；登录态线上 UI 冒烟和真实观远指标数据集成验收未完成前，不能声称最终用户验收或线上修复验收通过 |
| ASM-015 | 打铁指标 v1.72 不改变 11 项公式、目标、组织/下钻/导出边界，只收紧取数上下文和前端加载路径 | 用户已明确打铁模块必须严格继承上游日期、区域、车系，且前端只能使用服务端 SQL 取数；缺车系字段必须 fail-closed | 如果后续发现某打铁来源没有可审计车系字段，具体车系筛选下该来源不能展示数值，必须先补字段审计或数据源映射，不能用全部车系数据冒充联动 |
| ASM-016 | 当前范围全部经销商扁平查看可以基于现有已过滤门店集合与打铁现有组织骨架派生，不新增数据集 | 当前代码销售/过程已可按 `drillPath` 过滤后再按 level 聚合；打铁指标已有 `ironStores` / 无车系 `processBaselineData` 组织骨架和 `buildIronRows()` 组织行构建路径。将销售/过程/打铁展示 level 派生为 `store` 且保留当前 `drillPath` 即可得到当前范围经销商行；权限、白名单和打铁来源 SQL-only 已在上游生效；但扁平态必须额外保存组织、销售/过程/打铁页码、打铁二级组和选中门店快照并冻结表现区面包屑返回 | 如果开发发现销售、过程与打铁使用的已过滤门店集合不一致，必须先明确差异来源；不得通过新全量查询、销售车系行集或绕过权限补齐。若无法同时保证真实组织状态冻结、二级组切换保留和退出恢复，不得用改写 `organization.viewLevel/drillPath` 伪装通过 |
| ASM-017 | 打铁指标 v1.75 可复用过程分析三阶段周期和趋势单元格语义，不需要新增官方周/月列或状态体系 | 当前代码中过程分析已经通过 `previousMonthRange(range)`、`previousWeekRange(range)`、`metric-cell`、`metric-value` 和 `metric-trend[data-kind]` 展示当前/月环比/周环比；用户明确要求打铁样式与“过程分析”一致，且既有目标仍在指标名称下方、无状态标识 | 如果后续要求复刻官方打铁看板周/月绝对值、自然周/月例外或状态识别，需要另发需求；不能把本次环比扩展解读为官方看板复刻 |
| ASM-018 | DCC 打铁四项的门店范围独立于 Super App 有效经销商维表，但仍受观远 DCC 数据集行级权限保护 | 用户已明确选择 DCC 门店范围采用官方打铁看板业务过滤后的全部 DCC 门店，不再与 `validDealers` 求交；同时要求无 DCC 授权/查询失败/范围不可证 fail-closed | 如果 DCC 自身组织字段无法稳定映射到页面层级，必须 fail-closed 并输出字段缺口；不得回退到 `validDealers` 或用非 DCC 骨架冒充 DCC 范围 |
| ASM-019 | v1.88 订单目标必须以打铁最终目标输出行 SUM 为准，零售目标继续使用 r05 既有去重/冲突规则 | 用户已确认 `u32` 2026-07 MG 订单目标 `1576` 行、7 区为 `1995/5597/1950/2850/2615/5179/2638`、合计 `22824`；其中 12 行大区/小区/经销商代码为空但组织名称存在，订单目标 `115`，必须按名称归属并计入守恒；`h982` 上传原表直汇总 `22614` 不作 App 最终验收，`210` 差额属于现有打铁看板口径，其中荆州有为同一 `dealerCode+车系` 两行必须累加 | 如果后续要求订单目标回到上传原表、修正 ETL 差额、按 validDealerMap 排除空代码行、用别名补码/硬编码补差或去重重复输出行，必须另发需求并同步打铁看板口径；不能在 Super App 单侧修正 |
| ASM-020 | q084 当前生产发布准备复用既有多店 App ID，只切换运行时环境和单店承接 App | 用户已明确多店 App 仍为 `q0844640cf6734877a3193d6`，`environment=production`，门店详情跳转生产单店 `aca59d2e2e60f4be4b8b93ac`；不更新旧 `x944`、不创建新 App、不 commit/push、不做发布后独立 QA | 若后续要恢复测试发布，应另发需求并重新把 `settings.json` 当前环境改回 `test`，不得沿用本轮生产 staging 直接覆盖测试合同 |
| ASM-021 | MG 07 小订目标已创建为真实观远数据集，开发只需读取配置并验证权限 | 已验证目标数据集 `MG07小订目标_20260727`：dsId=`h8ae7b66fd5d141ec95bd246`，parentDirId=`r0d6927b9b1d640d7ac3eabb`，状态 `FINISHED`，404 行 / 8 列；其中 403 行经销商配置、1 行总计空代码运行时排除。目标清洗必须基于权威维表 `a310ff90fddff4b6283841c6`，并把 `MQ257T` 规范化为 `MQ256T` 保留审计 | 如果目标数据集未授权、运行时不可读或清洗后 403/30001 不守恒，开发只能展示小订模块配置缺失/数据不完整状态，不能写假 ID、读本地 Excel 或用前端硬编码伪装上线 |

### 10.2 后续决策问题

| 编号 | 问题 | 是否阻塞 | 备注 |
|---|---|---:|---|
| Q-001 | 小样本门店的弱化阈值是多少，例如线索数低于多少不进入主排序 | No | 可在数据口径阶段确认 |
| Q-002 | 区域漏斗是否需要展示官方区域排名/分位 | No | P0 不强制，后续如展示必须数据层预计算 |
| Q-003 | 问题门店列表首版展示 Top N 还是全部可见门店 | No | 默认可先展示 Top 10 或当前筛选下全部可见门店 |
| Q-004 | 跳转一期单店页的具体路由和参数名 | No | 已确认：测试环境使用 `https://rdata-pv.rauto.com/open-apps/r8ce093b6d93143d8aa6852f/`，生产环境使用 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/`；多店 App `q0844640cf6734877a3193d6` 当前生产发布配置使用 `environment=production` 并跳转生产单店，历史测试发布记录仍保留 `environment=test` 事实；门店参数传 `dealerCode / dealer`，兼容传 `storeCode / store` |
| Q-005 | 父应用正式域名和允许的 `postMessage` origin 白名单 | Yes | 长图截图协议必须校验 origin |
| Q-006 | `period=自定义` 是否会扩展传入 `startDate / endDate` | No | 当前文档说明一期暂未传具体起止日期 |
| Q-007 | 子应用在 `store` 为具体门店时是否直接进入单店视图，还是仍展示多店框架但只含 1 店 | No | 设计阶段需要明确页面体验 |
| Q-008 | 长图导出时子应用内部吸顶栏是否保留 | No | 截图协议提示需避免和父应用头部重复 |
| Q-009 | 移动端独立入口的最终文件路径和发布 URL 是什么 | Yes | 开发阶段结合工程结构与上游应用配置共同确定；Spec 不预先编造路径 |
| Q-010 | 上游移动端 iframe 可用视口、安全区和目标 WebView 版本范围 | No | 开发联调前由上游提供，用于补充兼容性测试矩阵；当前以 375px 竖屏无横向溢出为最低验收线 |
| Q-011 | 真实数据中进入有效一网白名单的 `一级经销商代码` 是否存在多条维表匹配、同码多个非空 `父经销商简称`，或销售父简称与维表一网简称不完全一致 | Yes | 白名单外一级代码按既有 `metrics.js` 过滤，不阻断；仅白名单内多匹配、多父简称或名称不一致时停止实施，不在本次需求内补关系映射或改 `metrics.js` |
| Q-012 | 新订单/零售目标上线后是否需要把历史 v1.61～v1.64 的“月目标”文案在所有辅助文档中批量改名 | No | 本轮已在当前事实源和新设计文档中改为订单/零售双目标；历史发布记录保留历史事实，DEV-PLAN 待用户审核规格后再由 dev-planner 同步 |

## 11. Agent 系统规格

本产品不是 agent / 自主系统，本节跳过。

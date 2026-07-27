# 2期多店聚合销售诊断工作台 DEV-PLAN

> **当前增量已完成本地开发、Code Review 和独立 QA 门禁，未发布（v1.94，2026-07-27）**：新增 Phase 3AF～3AI / `SCOPE-028 / TASK-020 / FLOW-004 / REQ-014 / AC-326～AC-352`，只做 PC 顶部独立 `MG 07小订战报` 模块。固定小订期为 `2026-07-29`～`2026-08-22`，摘要常驻展示 `小订目标`、`累计小订`、`目标达成`、`时间进度`，第五动态位按层级显示 `落后大区/落后小区/落后门店/自身进度状态`；`小订达成表现` 默认收起，展开状态只保留在 `smallOrderViewState`。目标源来自 `/Users/chengfengguo/Downloads/100家快闪店展车试驾车信息收集0727.xlsx` 的 `经销商目标` Sheet；目标数据集已创建，名称 `MG07小订目标_20260727`，`dsId=h8ae7b66fd5d141ec95bd246`，`parentDirId=r0d6927b9b1d640d7ac3eabb`，状态 `FINISHED`，404 行 / 8 列；运行时配置键 `mg07SmallOrderTargetDsId` 必须填真实 `dsId=h8ae7b66fd5d141ec95bd246`，不能写假 ID、读本地 Excel 或前端硬编码。目标清洗验收为排除 1 行总计空代码后 403 行、403 家唯一 canonical 一级经销商、目标 30001、零目标 17、7 大区，并保留 `MQ856G`、`MQ877K`。组织映射以权威经销商维表 `a310ff90fddff4b6283841c6` 为准，代码优先匹配全量 MG 维表，不局限 valid primary；当前审计事实为 403 家按 valid primary 仅命中 395 家，8 家未命中 valid primary 合计 287（`MQ207J=104`、`MQ257T=45`、`MQ576H=0`、`MQ576K=78`、`MQ877K=44`、`MQ9331=0`、`SQ2547=0`、`SQ2881=16`）。最新修正：`MQ257T` 是 Excel 代码笔误，目标行名称 `溧阳名锐`、目标 45，清洗时必须规范化为权威一级经销商 `MQ256T`，并保留 `原一级经销商代码=MQ257T`、`canonical一级经销商代码=MQ256T`、`代码修正说明=权威维表按经销商简称唯一命中`。实际源固定 `k4c14c31c595540a0a771f50`，过滤 `品牌名称=MG`、`汇报车系名称=MG 07`、固定日期窗口，聚合首触小订、留存、退订；转大定隐藏。配置缺失、权限失败、字段缺失或组织审计失败只降级小订模块，不阻断销售/过程/打铁主链路。已完成本地开发、Code Review Stage1/Stage2 PASS 与独立 QA 门禁，P0/P1/P2=`0/0/0`；Node `187/187`、lint `56 files`、build、PC `111/111`、critical audit `0`、source/dist 一致、隐私扫描均通过。尚未发布，尚未完成登录态生产页面验收，目标数据集对 16 个业务用户组的 `READER` 权限同步仍等待用户明确授权；未 commit/push。

> **当前增量待开发（v1.93，2026-07-27）**：新增 Phase 3AE / `REQ-010 / REQ-012 / AC-309～AC-325`，用当前真实车系筛选集合覆盖多店 PC 过程分析与打铁指标的剩余未联动区域。顶部过程 4 卡必须使用选中车系后的销售事实 `state.data` 三阶段值，不得继续读无车系 `processBaselineData`；过程分析 9 项必须继承车系选择，其中销售事实类指标从选中车系销售事实取数，4 项 IP 邀约问题率和 3 项试驾问题率按来源物理字段过滤，过程导出、查看全部经销商过程表现、动态诊断过程数据同样继承。过程来源级合同固定为：`ip.history` 数据流 `mf0b3f3f6a49f476eab32076`、DS `n418e47dacdb94291993d3d9`、字段 `周期首次意向闭环车系名称`，规范值精确过滤，`其他车系`精确；`ip.realtime` DS `ta1978fc86ae745009d0eff4` 同字段，按 raw 映射过滤，`其他车系`为 MG 品牌内补集；`drive.history` 数据流 `i81d40fe25d0042ecae6e59b`、DS `g9da02067b8a6432486f58f9`、字段 `车系名称`，按 raw 映射过滤，`其他车系`为 MG 品牌内补集；`drive.realtime` DS `ie2f283f63154402282c4968` 用规范字段 `闭环车系` 精确过滤，`车系名称`只作审计对照。销售闭集固定为 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07`；空值/null 不算未知或其他，`MG4 EV` 不并入 `全新MG4`。打铁 11 项继续沿用 v1.92 车系联动合同，并修正高意向低水平 source/dist 字段漂移为 `周期最近意向闭环车系`。选中具体车系时任一来源字段、映射、SQL 或完整性不可证必须 fail-closed 为 `数据不完整`，不得回退无车系 preview 明细；全部车系可保留既有 fallback。发布目标仅限生产多店 App `re37c3447cb0443a68a36a40`，单店跳转 URL 固定为 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/`，最终 `settings` 为 `environment=production`；不得发布 `q0844640cf6734877a3193d6`、`x944` 或其他 App。本阶段当前只更新文档，未改源码、未开发、未测试、未发布、未 commit/push。

> **当前增量待开发（v1.92，2026-07-24）**：新增 Phase 3AD / `REQ-012 / AC-298～AC-308`，只做销售车系筛选真实联动“打铁指标”7 项邀约 + 4 项试驾。所有真实车系选项必须在当前、上月同期、上周同期三阶段触发 6 来源真实 SQL 查询或明确 fail-closed；不得用全部车系数据、旧缓存、无车系 `processBaselineData` 或边界说明冒充具体车系结果。来源字段锁定为 `q00.周期首次意向闭环车系名称`、`w8.周期最近意向闭环车系`、`lbfb.车系`、`c82.车系名称`、`hd284.车系名称`、`fa1.CRM闭环车系名称`；DCC 必须使用 `CRM闭环车系名称`，`原始车系名称`不可用。销售闭集为 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07`；来源映射只能输出闭集或 `unmapped`。`未知车系`只映射原始值“未知”，无样本展示 `--`；`其他车系`按已完成来源级 distinct 审计固定为 `q00/w8/lbfb/fa1` 永远精确“其他车系”过滤、`c82/hd284` 永远仅在 MG 范围内按排除已映射闭集后的剩余车型补集，且不得因当前日期、组织或查询结果动态切换；`全新MG4` 与 `MG4 EV` 不得默认合并。fail-closed 仅用于字段/映射/查询/完整性不可证。不改打铁 11 项公式/目标/展示、销售链路枚举和过滤、过程分析其他区域、UI、导出入口、移动端、发布配置或依赖。当前只更新 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`，未改源码、未发布、未 commit/push。

> **当前增量开发中/待复审（v1.88，2026-07-24）**：新增 Phase 3AB / `REQ-011 / AC-283～AC-290`，只做 PC 订单目标与零售目标拆源、订单组织守恒和失败隔离。订单目标改读打铁 ETL `va7f9d6b8616a421c852b04c` 最终输出 `u32cb7e789f7443ff84160b4` / `打铁运营机制看板目标`，并以 `u32` 输出行为唯一事实源按行 SUM `订单目标`；`日期/品牌/车系/订单目标` 为必需字段，组织代码可空，优先用 `u32` 组织代码定位，代码为空时按 `u32` 大区/小区/经销商名称归属汇总，不因 `invalidKey` 或 `validDealerMap` 排除。零售目标仍读 `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标` 并继续既有 r05 去重/冲突和 validDealerMap 规则。`h9828e20e9026475091ae6ca` 只是上游输入，不作 App 最终订单目标源；`r05.总订单目标` 不再参与订单目标。`2026-07 / MG / 全部车系` 订单目标对账必须为 `1576` 行、7 区 `1995/5597/1950/2850/2615/5179/2638`、合计 `22824`；其中 `12` 行大区/小区/经销商代码为空但组织名称存在，目标 `115`，必须计入全国和大区守恒；`h982` 直汇总 `22614` 仅记录差异。`210` 差额来自上海安吉 `+138`、荆州有为 `+72`，其中荆州有为同一 `dealerCode+车系` 两行必须累加；本次不修打铁 ETL、不在 App 去重、不别名补码、不硬编码补差。不改订单目标实际 SQL、零售目标实际 SQL、零售目标源、销售/过程指标、UI、导出字段集合、筛选、移动端或发布配置。订单实际达成分子仍按现有有效经销商代码，无法映射到实际分子的订单目标行分子为 `0` 并计审计，不得伪造达成。订单源失败仅订单目标不可用，零售仍可展示；反之亦然。当前只更新 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`，未改源码、未发布、未 commit/push。

> **当前增量已完成本地实现、Code Review 和独立 QA 门禁，未发布（v1.87，2026-07-24）**：Phase 3AA / `REQ-002 / AC-282` 已在 `app.js` 与 `validation/pc-role-drilldown.spec.js` 实现，build 生成 `dist/app.js`。门禁为定向 `2/2`、Node `147/147`、PC `101/101`、lint `45 files`、build PASS、audit `0`；source/dist `app.js` `cmp=0`，SHA-256 均为 `be44429dc33c3f63f7d8a0cf540867cf3135a4b9097690d9a1be4f679dff3665`。Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/1`，唯一 P2 为既有超长文件债；独立 QA 首次唯一 P2 为文档状态未回写，待本次回写后复核，不提前标记最终 QA PASS。未发布测试 App或生产，未 commit、push，未做登录态线上验收。

> **当前增量已发布测试 App（v1.86，2026-07-24）**：Phase 3Z 承接 `Product-Spec.md` v1.86 / `REQ-012 / AC-272～AC-281` 与 `docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md` 顶部 v1.86，已完成打铁 DCC 来源 4 项（首跟通话60s占比、30分钟跟进率、24小时跟进率、2天3呼率）的门店范围合同本地实现、Code Review、独立 QA 与测试 App 发布。日期严格跟随用户筛选 `startDate~endDate` 闭区间；DCC 门店范围为官方打铁业务过滤后的全部 DCC 门店，不与 `validDealers` 求交；DCC 聚合按 DCC 事实自身大区/小区/经销商代码名称归属；DCC 与非 DCC 门店骨架取安全并集，DCC-only 门店可显示 DCC 四项、非 DCC 指标显示 `--`；父级按各来源自身分子分母重聚合，不平均门店率。完成修复名称 fallback、比较期缺行、DCC 名称、`fieldGapReason` 当前/月/周/CSV；缓存 query=`20260724-dcc-scope2`。门禁：专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`、隐私扫描 `0`、source/dist `29` 个复制型运行时文件一致；Code Review 修复后 Stage 1/2 PASS，最终 `0/0/2`；独立 QA PASS `0/0/0`。AC-272 前置认证态直接 SQL 聚合 7 区与官方截图逐行一致且误差 `<=0.05pp`：南 `2021/2198`、华中 `5301/5750`、西 `1651/1785`、苏皖 `2688/2973`、北 `2812/3132`、东南 `4223/4638`、中南 `2275/2404`。北京时间 `2026-07-24 12:54:09 CST` 发布测试 App `q0844640cf6734877a3193d6`：`operation=update`、`version=0.1.0`、标准回执未返回 `fileKey`、URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；zip SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes、`dist 31 files / 600836 bytes`、`unzip -t` PASS。匿名 HTTP `401` 仅认证边界；未做登录态线上 UI 验收，未发布生产，未 commit/push。当前刷新边界：后续 `guancli auth status` 60s 无输出，direct SQL 60s/90s `ETIMEDOUT` 且无 stdout/stderr；销售、过程分析、IP/意向/试驾打铁来源、UI、目标、环比周期、导出入口、车系 fail-closed、移动端、发布配置和依赖保持不变。

> **v1.82～v1.85 最新测试发布（2026-07-24 12:03:44 +0800）**：Phase 3V / 3W / 3X / 3Y 已从稳定隔离目录 `/tmp/multistore-release-20260724-RzqeFk/multi-store-super-app` 组合发布至测试 App `q0844640cf6734877a3193d6`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；命令 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .` 回执 exit `0`、`operation=update`、`version=0.1.0`，无 `fileKey`。发布源为 v1.82 QA 冻结副本叠加提交 `ab55c19` 的 v1.85 三文件，明确排除 v1.86 / Phase 3Z，不等同当前共享工作树。`dist.0.1.0.zip` SHA-256=`cd3e69e3f2f8755c865142026b40bee52f6ea5f229701c060a1b6bfa92c77360`、`141400` bytes、`31 files / 590940 bytes`，`zip -T` 通过；`npm ci` 31 packages / 0 vulnerabilities、Node `137/137`、lint `45 files`、build exit `0`、audit `0`、完整 PC `99/99`、隐私扫描 `0`。source/dist/zip 三方关键文件一致：`app.js` SHA-256=`3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17`、`visual-sync.css` 前缀=`53109529...`、`organization-view.js` SHA-256=`4980a43ba0309680e40bb2788308e5025acef659dcea3e1d4490f7ac89bd6b9c`。发布后独立 QA PASS，P0/P1/P2=`0/0/1`；唯一 P2 是 Vite 正常重写 `dist/index.html` CSS bundle 导致 source/dist `index.html` 哈希不同，非功能缺陷、不建议回滚。匿名 HEAD=`401`、GET=`302` 仅证明认证边界；未完成登录态业务 UI/真实数据终验。未发布生产，未 commit、未 push。

> **当前增量已发布测试 App，发布后独立 QA PASS（v1.84，2026-07-24）**：Phase 3X 承接 `Product-Spec.md` v1.84 / `REQ-013 / AC-258`，只修 PC 销售表现导出 CSV 中 `订单排名`、`零售排名` 被 Excel 直接打开误识别为日期的问题。发布前 Code Review Stage 1/2 与独立 QA 均 PASS，P0/P1/P2 均为 `0/0/0`；门禁为 AC-258 定向 `1/1`、AC-258 + 公式注入/RFC4180 `2/2`、`npm test` `134/134`、lint `45 files`、完整 PC `98/98`、build PASS、audit `0`。从 `/private/tmp/ac258-build-kTHdjn` 发布，最终回执 exit `0`、`operation=update`、`appId=q0844640cf6734877a3193d6`、`version=0.1.0`，标准回执无 `fileKey`；最终 zip SHA-256=`b58a77a0da195968c801d96ee4a057eed6865f62a437a845f73aafe50b113706`，`141411` bytes、`31 files / 591132` 解包字节，完整性通过。zip 内 `app.js` SHA-256=`3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17` 且含 `excelTextRank`，zip 内 `organization-view.js` SHA-256=`36257c5f1ed3613b41260c34092a84b642c4ecd462464c7cac3a19d1ad9d5ee9`，保留 v1.84 竞争排名且未带入 v1.85。`settings=test`，测试单店 `r8ce...`、生产回退 `aca...`，隐私扫描 `0`。发布后 QA PASS，P0/P1/P2=`0/0/2`，两个 P2 仅为文档/边界并已关闭。匿名访问只证明登录保护，未做登录态 UI 或线上资源哈希验收；无 Windows Excel 直开实机截图。当前工作区源码已进入后续并行版本，不等同发布源；发布同源只限临时快照 source/dist/zip。未发布生产，未 commit、push。

> **当前增量已随共享隔离组合包发布测试 App（v1.82，2026-07-24）**：Phase 3V 承接 `Product-Spec.md` v1.82 / `REQ-013 / AC-243～AC-250`，已将 PC 目标摘要迁入“销售总览”标题行中间，完成固定三段布局、五项纯文字顺序、三宽双主题单行显示及 loading/success/hidden/error 四态。可交付结论以 Phase 3V 隔离 Review/QA 为主：Code Review PASS，P0/P1/P2=`0/0/0`；隔离 Node `134/134`、PC `97/97`、lint/build/audit 通过。2026-07-24 最终 QA 冻结快照（包含当时并行 `excelTextRank` / `AC-258`，尚未包含后续 Phase 3Y）通过定向四态 PC `6/6`、Node `137/137`、PC `98/98`、lint Syntax check `45 files`、build exit `0`、audit `0`；24 张四态 × 三宽 × 双主题截图及 source/dist `app.js`、`visual-sync.css` 同源属于该冻结快照。上述全局计数不承诺后续共享工作树保持不变；AC-258、后续 Phase 3Y 及其他并行改动不属于 v1.82 独立背书，必须由各自任务独立 Review/QA。最新发布与发布后 QA 见上方共享组合记录；未发布生产、未 commit、未 push。

> **当前增量已随共享隔离组合包发布测试 App（v1.83，2026-07-24）**：Phase 3W 承接 `Product-Spec.md` v1.83 / `REQ-013 / AC-251～AC-257`，只修 PC 过程标签 `loadNegativeProcess` 加载编排和行为测试。第一波仅并发 current × ip/drive，结算后一次性合并当前期结果并刷新过程表；token 有效后第二波同波并发 previous/week × ip/drive 四个高层任务，全部结算后原子合并比较期结果、结束 loading 并刷新过程表与动态诊断。全程不调用 `renderFunnel`，不循环尾重复渲染，不修改 `data-api.js`、`metrics.js`、公式、日期范围、车系、组织权限、顶部四项、打铁、导出、移动端、依赖、发布配置。同步更新 `validation/pc-role-drilldown.spec.js` 中本次相关 PC 回归用例，把旧三波等待适配为 current 2 请求 + comparison 4 请求显式断言，并保留 A→B token 失效导航切换场景。Phase 3W 门禁通过：定向 Node 8/8、Node 全量 134/134、lint 45 files、build、PC 95/95、audit 0；独立 Code Review 与最终 QA PASS，P0/P1/P2=`0/0/0`。两个既有非阻断 LOW 保留，不扩展本次修复。最新发布与发布后 QA 见上方共享组合记录；未发布生产、未 commit、未 push，未做登录态业务 UI 或观远真实环境验收。

> **当前增量已完成并发布测试 App（v1.81，2026-07-23）**：Phase 3U 承接 `Product-Spec.md` v1.81 / `REQ-013 / AC-236～AC-242`，只做“目标异步解耦 + 组织过滤瘦身”。根因已确认：月目标请求硬阻塞首屏，导致销售指标、过程指标和销售概览表跟随目标 pending 一起占位。当前已实现：销售事实、车系枚举和有效组织范围完成后立即渲染真实销售/过程主数据；月目标后台加载并局部回填经营进度条、表格目标槽和导出目标字段；目标失败不阻断销售/过程；旧目标响应受 `loadToken` / generation 丢弃。目标 preview 可在字段映射已确认时下推 `areaCode -> rfs_code`、`districtCode -> mac_code`、`dealerCode -> dealer_code` 组织条件；未改变目标自然键、目标数据源、目标实际 SQL、有效经销商维表归属、车系集合、自然月窗口、导出字段或销售/过程主指标口径。门禁证据：Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/2`；最终 QA 功能门禁通过，`npm test` 130/130、PC 95/95、lint Syntax check 45 files、build PASS、audit 0、1280/1440 浅深色通过。发布命令重新构建并重打包后，`guancli app publish --app-id q0844640cf6734877a3193d6 --path .` 成功发布测试 App：`operation=update`、版本 `0.1.0`、`artifact=dist.0.1.0.zip`、`fileKey=1d9e70c3-938c-409d-b4e0-e1be26035edc`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。最终 zip SHA-256=`3125ba0859ff122ba05aa2029eab924d2a7dbe2ab689f4a079b5104aa1810359`，zip 完整性通过，关键四文件 source/dist/zip 三方哈希一致。未发布生产、未 commit、未 push。

> `Product-Spec.md` 是功能与口径事实源，`Design-Brief.md` 是移动布局与视觉事实源，`docs/superpowers/specs/2026-07-22-打铁指标PC展示与下钻设计.md` 是 PC 打铁指标 v1.70 展示与下钻设计事实源。2026-07-16 已将 `multi-store-super-app/` 回退到 `feature/260717-1@3a3c95e9354cb0b820b32496efcbe9b65205167d`。Phase 3B 的复杂父经销商经营单元聚合已撤回，不再是当前实现；Phase 3C 销售漏斗最小字段改造已实施、通过 Code Review 与最终 QA，并于北京时间 2026-07-16 18:01:40 发布到测试 App `q0844640cf6734877a3193d6`，未 commit 或 push。Phase 3D 已将车系筛选器迁移到销售区“销售总览”整体标题行右侧（非销售指标单框内）；本次测试发布包同时包含该应用级位置修正、PC 应用级车系筛选（销售唯一口径为 `汇报车系名称`）及“销售概览 / 过程分析”Tab 文案，已发布到同一测试 App（`operation:update`、版本 `0.1.0`、包 SHA-256 `b49f7e47ea742a705c79b381e71cbe4689bf88d35e043b2c3839d85b52b712ca`）。过程链路的异名车系字段不可伪装为同口径过滤。Phase 3E 已修复默认 `2026-07-01~2026-07-20 / MG / 全域` 下 IP/试驾标签聚合触达 `5000` 上限、共用 `Promise.all` 导致一类失败抹掉另一类成功结果的问题；默认真实查询 IP=`1896`、drive=`1371`、`isTruncated=false`，本地门禁为 Node 70/70、lint/build 通过、PC 26/26、audit critical=0，Review P0/P1=`0/0`，QA PASS P0/P1/P2=`0/0/0`。已发布到测试 App `q0844640cf6734877a3193d6`（`operation:update`、版本 `0.1.0`、`fileKey=4afc645a-70e5-42c0-8956-a4eacd62ef44`、访问地址 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、包 SHA-256 `adaa813455b94444523f5a1e28f6ccfa5a5fbf91c4cbec0864a5b73557859084`）。匿名 HEAD HTTP 401 仅确认登录态保护，未执行登录后线上 UI/功能验收；未发布生产、未 commit、未 push。Phase 3F、3F.1、3F.2 的既有实现与完成记录保持历史事实；`Product-Spec.md` v1.64 与 `docs/superpowers/specs/2026-07-21-sales-target-summary-layout-design.md` 已将 PC 顶部展示替换为标题摘要与卡内两行环比，Phase 3F.3 已完成并于北京时间 2026-07-21 20:49 发布测试 App，平台回执 `操作:update`、版本 `0.1.0`，认证态线上资源已验证为 `target2`。2026-07-22 REQ-010 v1.65 / Phase 3G 已完成 PC 应用级车系筛选不限数量多选并通过 Review 与最终 QA：npm test 90/90、test:pc 43/43、lint/build/audit exit 0、source/dist、1440x900 截图、安全和未发布边界通过，P0/P1/P2=0/0/2，两项 P2 非阻断；本目标不发布，未 commit、未 push。REQ-011 v1.67 / Phase 3H 已完成本地开发并通过 Code Review，最终 QA PASS，P0/P1/P2=0/0/0；本地门禁为 Node 90/90、PC 43/43、lint/build/audit critical=0，旧 DS 在当前业务源码/目标测试/dist 搜索为 0，新 DS 真实审计为 1542 行、订单目标 22578、零售目标 18580、5 条有效经销商缺口；未发布、未 commit、未 push。REQ-012 v1.70 对应 Phase 3I～3K 已完成本地实现、R5 Code Review PASS、独立 QA PASS 与测试 Super App 发布；发布目标为测试 App `q0844640cf6734877a3193d6`，`operation=update`，版本 `0.1.0`，访问地址 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`，包 `dist.0.1.0.zip` SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`，大小 `126818` bytes，解包 `30 files / 521802 bytes`；发布后独立 QA PASS，P0/P1/P2=`0/0/0`；匿名 HEAD/GET 与关键资源仅验证 401/302 登录态边界，未做登录后线上 UI/资源哈希验收；仍未做观远认证态真实查询，未发布生产、未 commit、未 push。Phase 4 起的历史移动端计划保持不变。
>
> **当前增量修复（v1.71，2026-07-22）**：线上测试 App `q0844640cf6734877a3193d6` 的“打铁指标 / 试驾指标 4”暴露永久骨架屏问题，根因是 6 类来源按 all-complete 收敛，慢/悬挂 DCC 或意向来源阻塞整表。Phase 3L 已完成 P1 修复测试发布：逐来源结算、局部呈现、单源超时 fail-closed 为 `数据不完整`，不影响无关指标。已发布到测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`、包 SHA-256=`9ef29b84237fb8419492aead99f90a2c82ef7d785bc2e335fbfb75b33ce6cbc0`、`30 files / 527758 bytes` 解包）。最终 Code Review Stage 1/2 PASS（P0/P1=0/0），发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断）；QA 执行门禁为 Node 108/108、PC 61/61、lint Syntax check 42 files、build 通过、audit critical=0。匿名 HTTP 仅得到重定向/登录保护的平台边界；未完成登录态线上 UI 冒烟或真实观远指标数据集成验收；未发布生产、未 commit、未 push。
>
> **当前增量修复（v1.72，2026-07-23，待开发）**：承接 `Product-Spec.md` v1.72 的 AC-181～AC-185，新增 Phase 3M，只修剩余 5 个可 SQL 来源 `inviteMention / intentLevel / qualityTrial / trialRecord / trialTalk` 的上游筛选继承与 SQL-only 合同。DCC 182 本轮保持 Phase 3L 现状，不改 DCC 查询、过滤或分页实现；非 DCC 来源在可查询品牌范围内统一改为 `execute-sql` 服务端聚合，禁止 preview 明细、分页 fallback 或前端明细聚合。已验证 `qualityTrial` 数据集为 MG 专属且无已审计可 SQL 的品牌字段：上游 `brand=MG` 或 `brand=全部` 可查询，任一非 MG 品牌必须以 `fieldGapReason` fail-closed 且零 SQL，绝不返回 MG 数据。
>
> **当前增量完成（v1.73，2026-07-23，独立 Review 与最终 QA 通过）**：承接 `Product-Spec.md` v1.73 / REQ-002 / AC-186～AC-198，Phase 3N 的 PC 表现区“销售概览 / 过程分析”当前范围全部经销商扁平查看已完成本地实现，AC-186～AC-198 全部完成。总部可从大区层手动下钻进入某大区小区层（真实 `viewLevel=district`、`drillPath` 仅含该大区）后查看该范围全部经销商，真实 `store` 层入口隐藏；扁平模式保存并恢复组织/销售页码/过程页码/`selectedStoreCode` 快照，销售/过程扁平态隐藏并冻结面包屑返回；真实 `store` 层、有效集合 `<=1`、过程局部错误、全局加载/空/错误/无权限均隐藏入口。最终门禁为 `npm test` 117/117、`npm run test:pc` 72/72、lint Syntax check 42 files、build 通过、audit critical=0；已生成销售/过程两张精确 `1440x900` viewport 浅色截图。Phase 3M / v1.74 保持不变；本阶段未发布、未 commit、未 push。
>
> **当前增量完成并发布测试 App（v1.75，2026-07-23）**：承接 `Product-Spec.md` v1.75 / REQ-012 / AC-199～AC-205，打铁 `邀约指标 7 / 试驾指标 4` 的 11 项指标已补齐与过程分析一致的月环比、周环比和表格 DOM/样式语义，DCC 182 四项已改为无特殊字符临时表 ``双品牌DCC话务指标182`` 的 `execute-sql` 聚合。当前期、上月同期、上周同期复用 `resolveDateRange(params)`、`previousMonthRange(range)`、`previousWeekRange(range)`；三阶段除日期外的公式、分子分母、去重、日期字段、组织/区域/车系/权限白名单、SQL-only 和完整性门禁同构。发布门禁为 Node 119/119、PC 74/74、lint/build/audit/隐私扫描通过；已更新测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256=`293a24705b23f9c3354e91cf196f6236b8b4f7563da0d86d05e80aefc26fe520`、`136515` bytes、31 files），入口重定向后 HTTP 200。未发布生产、未 commit、未 push；未执行登录态线上业务数据 UI 验收。
>
> **当前增量完成（v1.76，2026-07-23，本地实现、Code Review 与 QA 功能门禁通过）**：承接 `Product-Spec.md` v1.76 / REQ-002 / AC-206～AC-213，Phase 3P 已完成 PC “销售概览”表第二列 `销售结果（指标：月环比）` 的行内双层展示。上层保留 `线索 → 到店 → 试驾 → 订单 → 零售` 五段数量及数量月环比，下层新增 `线索到店率 → 到店试驾率 → 试驾订单率 → 交付率` 四率及百分点月环比；四率从当前行 `row.current` / `row.previous` 原始分子分母计算，继承大区/小区/门店、全部经销商扁平查看、投资人集合和车系筛选粒度。首次 Review 发现并修复 1280px 右侧裁切 `41.6px` 与上月同期可比率为 `0.0%` 时误报 `--`；复跑 Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/0`。最终 QA 临时副本门禁为 Node `126/126`、PC `82/82`、lint Syntax check `45 files`、build exit `0`、audit critical=`0`，功能与视觉均通过；首次 QA 唯一 P2 为文档状态不一致，本次已闭环修正。未发布、未 commit、未 push。
>
> **当前增量完成（v1.77，2026-07-23，最终本地 QA PASS，已发布测试 App）**：承接 `Product-Spec.md` v1.77 / REQ-002 / REQ-012 / AC-214～AC-225，Phase 3Q 已把 Phase 3N 的当前范围全部经销商扁平查看扩展到 PC “打铁指标”。三张一级 Tab 共用同一个 `allDealerMode`；打铁入口同样位于导出按钮左侧；扁平态使用既有 `ironStores` / 无车系 `processBaselineData` 组织骨架。独立 Review Stage 1/2 PASS，最终本地 QA 0 阻断；门禁为 Node 126/126、PC 85/85、lint Syntax check 45 files、build exit 0、audit critical=0。已发布测试 Super App `q0844640cf6734877a3193d6`（`environment=test`、exit 0、`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；发布包 SHA-256=`e5c138b0549a6eb2b91b89964efb417b0d63ae476e447c3dd8c189bc73518807`、`138887` bytes、`31 files / 578408 bytes` 解包。平台发布成功且包信息正确；发布后独立 QA 仅有限 PASS：Chrome 登录态非白屏且三张 Tab 可见，但 standalone 缺人员画像，未完成“查看所有经销商”登录态业务 UI 终验，不建议回滚。未发布生产、未 commit、未 push。
>
> **当前增量完成并发布测试 App（v1.78，2026-07-23）**：承接 `Product-Spec.md` v1.78 / REQ-012 / AC-226，Phase 3R 已在 PC “打铁指标”二级 Tab `邀约指标 7 / 试驾指标 4` 右侧增加固定链接“打铁运营看板”，目标 URL 为 `https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845`，并以新窗口安全属性打开。本增量未改变打铁指标数据口径、筛选、下钻、扁平态、分页、导出、一级 Tab 或现有导出入口。Code Review PASS，P0/P1/P2=`0/0/2`，P2 均非阻断；既有 `validation/iron-metrics-query.test.mjs` 424 行拆分债本轮不拆。门禁为 Node 126/126、PC 86/86、lint Syntax check 45 files、build、audit critical=0、隐私扫描通过，1280/1440 浅深截图通过；发布后独立 QA PASS，P0/P1/P2=`0/0/0`。已发布测试 Super App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；发布包 SHA-256=`6f59891701ed953f8cd95173d1639cb99c90b318137cb3035a14ae06cfb7fd22`、`139391` bytes、`31 files`。匿名入口 302/401 仅表示登录保护，未做登录态线上业务 UI 验收；未发布生产、未 commit、未 push。
>
> **当前增量完成（v1.80，2026-07-23，已随测试 App 发布）**：承接 `Product-Spec.md` v1.80 / REQ-012 / AC-235，Phase 3S 已在 Phase 3R 既有 PC “打铁指标”二级 Tab 右侧外链组件基础上，于“打铁运营看板”右侧新增同级固定外链“优质试驾看板”，URL 固定为 `https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa`。两个外链共存且顺序固定为 `打铁运营看板 → 优质试驾看板`，均以 `<a target="_blank" rel="noopener noreferrer">` 新窗口安全打开。本增量只复用 Phase 3R 轻量外链样式，不生成新设计文件；不修改打铁指标口径、SQL、数据集、状态、权限、筛选、下钻、扁平态、分页、导出或移动端；与 v1.79 `REQ-013 / AC-227～AC-234` 销售经营进度条文件和功能边界独立。实现文件 6 个：`index.html`、`iron-metrics-view.js`、`iron-metrics.css`、`validation/iron-metrics-pc-tabs.spec.js`、`validation/iron-metrics-a11y-visual.spec.js`、`validation/iron-metrics-query.test.mjs`。门禁为 `npm test` 126/126、`npm run test:pc` 87/87、定向 pc-tabs 10/10、lint Syntax check 45 files、build PASS、audit 0、敏感扫描 0、`git diff --check` PASS；Code Review 复审最终 PASS P0/P1/P2=`0/0/0`；8 张现有 iron-metrics 邀约/试驾 1280/1440 浅深截图已刷新。已随北京时间 `2026-07-23 16:49:52` 的同一测试 App 包发布至 `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`）；发布包 `dist.0.1.0.zip` SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`、`139940` bytes、`31 files / 583411 bytes`。未发布生产、未 commit、未 push；既有 Vite classic script 与 `NO_COLOR` warning 非阻断。
>
> **当前增量完成（v1.79，2026-07-23，已开发 / Review/QA 通过 / 已发布测试 App）**：Phase 3T / `REQ-013 / AC-227～AC-234` 已关闭；独立“销售经营进度”条、运行时自然日“时间进度”、整体显隐/失败降级及销售/过程卡基线均已完成。Code Review Stage 1/2 PASS，最终 QA PASS，P0/P1=`0/0`；门禁为 Node 126/126、PC 89/89、lint 45 files、build PASS、audit 0、隐私扫描通过，source/dist 的 `app.js` 与 `visual-sync.css` SHA-256 一致。1280/1440 浅色、深色四张截图通过；对比度浅色 target/achievement/time=`6.83/5.48/5.10`，深色=`8.43/10.13/8.69`。已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`、`139940` bytes、`31 files / 583411 bytes`。匿名入口 HTTP 401 只证明登录保护；Chrome 父应用刷新后自动 DOM/截图持续超时，未完成登录态线上 UI 验收。Phase 3T 不覆盖 Phase 3S 的功能边界；未发布生产、未 commit、未 push。

## 1. 技术栈与部署事实

| 层级 | 技术 | 版本 / 范围 | 决策 |
|---|---|---|---|
| 前端主体 | HTML + CSS + JavaScript | 浏览器原生 | 当前 PC 的实际实现；移动端继续原生实现，不因已安装 React 重写业务 |
| 构建 | Vite | `^8.1.0` | 已有构建链；按官方多页应用方式增加 HTML build input |
| 已装可选依赖 | React / ReactDOM | `^18.3.1` | 当前 PC 入口不是 React 组件；移动首版不启用 React 重写 |
| 工具 | TypeScript / plugin-react | `^5.8.2` / `^6.0.3` | 保留现有工程能力，不升级大版本 |
| 浏览器验收 | Playwright | `^1.61.1` | 用 viewport / device / colorScheme 验证移动与暗色 |
| 样式 | 原生 CSS + PC 同源 token | 现有项目 | 复用颜色、字体、语义色和层级，不继承 PC 宽表规则 |
| 数据 | 罗盘真实数据 API | `multi-store-super-app/data-api.js` / `multi-store-super-app/filter-api.js` | 复用查询、权限和原始分子/分母聚合；无数据库 |
| 包管理 | npm | lockfile v3 | 使用现有 `multi-store-super-app/package-lock.json`，不新增 UI 框架 |
| 部署 | Super App iframe 静态产物 | PC + 独立移动 URL | 上游识别设备并选择入口 |

**确定的移动工程入口：** `multi-store-super-app/mobile/index.html`；本地 URL 路径 `/mobile/`，构建产物 `multi-store-super-app/dist/mobile/index.html`。上游线上完整 URL / appId 由发布联调配置，不阻塞本地开发，计划不编造线上值。

技术依据：[Vite 多页面应用](https://vite.dev/guide/build#multi-page-app)、[Playwright 仿真](https://playwright.dev/docs/emulation)、[MDN safe-area env()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)。

## 2. 开发依据

- `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`Design-Brief.md`
- `docs/superpowers/specs/2026-07-22-mg-order-retail-target-source-design.md`
- `docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md`
- `docs/superpowers/specs/2026-07-22-打铁指标PC展示与下钻设计.md`
- `docs/superpowers/specs/2026-07-23-当前范围全部经销商扁平查看设计.md`
- `docs/superpowers/specs/2026-07-23-sales-row-conversion-rates-design.md`
- `docs/superpowers/specs/2026-07-24-unique-ranking-tiebreak-design.md`
- `multi-store-super-app/index.html`、`multi-store-super-app/app.js`、`multi-store-super-app/styles.css`、`multi-store-super-app/components.css`、`multi-store-super-app/visual-*.css`
- `multi-store-super-app/utils.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/filter-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/tracking.js`、`multi-store-super-app/capture.js`
- `multi-store-super-app/package.json`、`multi-store-super-app/package-lock.json`、`multi-store-super-app/vite.config.ts`
- `multi-store-super-app/validation/` 与根目录 `validation/` 的 PC 回归基线

## 3. Phase 划分

### Phase 1：PC 骨架与父应用上下文 — 已完成基线

**既有交付：** PC iframe 页面；URL Query、`全部`、默认日期；`previewMode || theme || light` 主题。

**关键文件：** `multi-store-super-app/index.html`、`multi-store-super-app/utils.js`、`multi-store-super-app/app.js`、`multi-store-super-app/styles.css`、`multi-store-super-app/visual-sync.css`。

**证据：** `multi-store-super-app/utils.js:4` `readRetailParams`、`multi-store-super-app/utils.js:55` `defaultDateRange`、`multi-store-super-app/app.js:42` `setTheme`；真实截图 `multi-store-super-app/validation/goal-visual-parity-final-light-1440x900.png` 与 `multi-store-super-app/validation/goal-visual-parity-final-dark-1440x900.png`。后续只回归，不重做。

### Phase 2：PC 多店聚合诊断视图 — 已完成基线

**既有交付：** 真实数据与权限范围聚合；3 项销售和 4 项过程指标；销售/过程 Tab；门店宽表、排名占比、问题断点与 15 条分页。

**关键文件：** `multi-store-super-app/data-api.js`、`multi-store-super-app/filter-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/app.js`、`multi-store-super-app/index.html`、`multi-store-super-app/components.css`。

**证据：** `multi-store-super-app/index.html` 中 `diagnosisTableBody` / `processMetricsTable`，`multi-store-super-app/app.js` 中 `renderDiagnosisList` / `renderProcessComparisonList` / `renderStorePagination`，`multi-store-super-app/metrics.js` 中 `buildWorkbench` / `buildDynamicStoreDiagnoses`；真实截图 `multi-store-super-app/validation/parity-light-dark-1440x900.png`。共享化不得改变 PC 行为。

### Phase 3：PC 单店承接、GIO 与截图 — 已完成基线

**既有交付：** 单店详情完整 Query；`smartmind_sale_View`；PC `RETAIL_CAPTURE_REQUEST` 截图协议；单店承接地址由 `settings.json` + `runtime-config.js` 按运行环境加载，开发/测试地址未配置、配置读取失败或环境非法时回退生产地址。

**关键文件：** `multi-store-super-app/settings.json`、`multi-store-super-app/runtime-config.js`、`multi-store-super-app/utils.js`、`multi-store-super-app/tracking.js`、`multi-store-super-app/capture.js`、`multi-store-super-app/app.js`。

**证据：** `multi-store-super-app/runtime-config.js` 的 `resolveRuntimeConfig` / `ready`、`multi-store-super-app/utils.js:90` `buildSingleStoreLink`、`multi-store-super-app/tracking.js:2` `trackRetailView` 与第 4/18 行 `smartmind_sale_View`、`multi-store-super-app/capture.js:112` `bindRetailCaptureProtocol` 与第 122 行截图消息判断；真实截图 `validation/phase2-store-detail-dist-1440.png`。移动只复用跳转与 GIO，不加载截图模块。

### Phase 3A：PC 角色分层与组织下钻 — 已完成

**依赖：** Phase 1~3 PC 基线；`sessionStorage['retail-cockpit:personnel-profile']`；上游品牌/大区/小区/门店/日期 Query；罗盘行权限、有效经销商白名单和带组织归属的门店级原始事实。大区全国排名另依赖版本化权威大区清单（`national-scope.js`）、同品牌当期销售事实和有效期同时成立；任一证据不完整或配置过期时必须降级为排名不可用。

**交付内容：**
- 统一解析人员画像角色，实现总部/大区/小区/销售总监/投资人入口矩阵；仅 `marketing_userType` 为 `null`、`undefined`、空字符串或纯空白时默认总部；其他关键字段缺失、非法或未知组合显示角色识别异常，不得默认总部。
- 以“上游筛选 ∩ 罗盘数据权限 ∩ 有效经销商白名单”锁定有效范围，实现总部大区→小区→门店、大区小区→门店下钻与具体筛选自动跳层；上游筛选变化清空手动路径。
- 让展示名为“销售概览 / 过程分析”的销售表现表/过程表现表共用 `viewLevel / drillPath`、面包屑和返回状态；下钻仅改变下方清单，顶部 7 张指标卡保持上游范围快照。
- 先聚合门店原始线索、到店、试驾、订单、零售和过程分子分母，再重算大区/小区比例；历史 Phase 3A 实现过竞争排名 `1,1,3`、分层占比、动态主问题和“全国/大区/小区第 X/Y”结果断点；v1.85 / Phase 3Y 起订单/零售展示排名由稳定唯一排名覆盖，分层占比和动态诊断口径不变。
- 随当前层级切换首列与操作文案，区分角色识别异常、无权限、有权限但 0 行、请求失败四类状态；门店层既有字段、详情参数和行为不变。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/national-scope.js`、`multi-store-super-app/organization-view.js`、`multi-store-super-app/utils.js`、`multi-store-super-app/filter-api.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/index.html`、`multi-store-super-app/components.css`、`multi-store-super-app/styles.css`、`multi-store-super-app/playwright.pc.config.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/pc-role-drilldown-fixtures.js`。

**四步门禁：**
1. Code Review：对照 REQ-001/REQ-002 及 PC 角色分层规则审查角色安全降级、权限交集、下钻状态机、聚合分母、排名完整性和门店详情回归；不得改移动端、一期或旧多店目录。
2. 测试完整性：执行 `(cd multi-store-super-app && npx playwright test -c playwright.pc.config.js validation/pc-role-drilldown.spec.js)`；覆盖总部、大区、小区、销售总监、投资人、未知角色，以及全部/具体大区/具体小区/具体门店、自动跳层、下钻/返回、Tab 保持、筛选重置、范围不扩大和四类异常态。
3. 编译：执行 `(cd multi-store-super-app && npm run lint && npm run build)`，全部退出 0，产物只包含已授权的 PC 变更。
4. 功能：用固定 fixture 验证顶部卡下钻前后不变、大区=所属小区求和、小区=所属门店求和、比例由原始分子分母重算、三级排名/占比/诊断正确；在 1440px light/dark 真实页面验收两个 Tab、面包屑、自动跳层和无横向异常。

**门禁证据：** Node 单元/契约测试 `19/19` 通过，Playwright PC 回归 `10/10` 通过，`npm run build` 退出码为 `0`，Code Review Stage 1 / Stage 2 均 PASS，最终 QA PASS 且 P0/P1/P2 均为 `0`；全国排名所用版本化权威大区清单有效期至 `2026-08-15`，过期或完整性不可证时按需求降级为排名不可用。

### Phase 3B：父经销商经营单元聚合 — 已撤回（仅保留历史记录）

**当前状态：** 2026-07-16 源码已恢复到 `feature/260717-1@3a3c95e9354cb0b820b32496efcbe9b65205167d`，以下“目标/已实施/完成标准/门禁证据”均为撤回前历史，不代表当前代码。后续已另立 Phase 3C 最小 Task，只调整销售漏斗的 `一级经销商代码/父经销商简称` 口径，邀约、试驾和其他过程链路保持基线逻辑。

**目标：** 页面只展示父经销商；父店及当前可见所属二网的销售和过程事实按同一经营单元聚合后参与顶部、组织清单、门店排名、占比和诊断。

**已实施：**
- `filter-api.js` 分页读取完整最新维表快照，`dealer-relations.js` 按 `(品牌代码, 经销商代码)` 建关系、按 `(品牌代码, 父级经销商代码)` 找父店；非开业一网父店可承接开业二网。父店组织负责合法经营单元筛选，异常按二网自身组织收敛为当前候选，二网 URL 归一父店，无效二网 URL 立即阻断。
- `data-api.js` 对当前候选关系异常使用同一代码集合预检当前、上月和上周销售事实：非零事实阻断；聚合 SQL 失败时仅在三段分页均完整到短末页后证明零事实并放行，否则失败关闭。
- 组织筛选存在编码时只认编码，名称仅在编码缺失时兼容；品牌“全部/空”不加品牌过滤，内部使用 `scopeDealerMembers` 和 `(品牌, 经销商代码)` 复合键查询、分片及聚合。
- 本期新增职责拆分：`dealer-sales-preflight.js` 承担异常事实证据判定，`dealer-fact-scope.js` 承担父店成员事实改写和复合键归并；数据查询、指标计算和页面运行时均已按职责拆分，`app.js` 只保留加载与协议编排。
- `app.js` 串行完成父店范围解析后再查询事实；当前、上月、上周和负向过程补充查询复用同一 `scopeDealerCodes`。
- `data-api.js` 的销售 SQL 与销售/DCC/试驾/订单/标签 preview fallback 在存在成员集合时统一使用经销商代码 `IN`，不再按二网自身组织提前过滤。
- `metrics.js` 将销售、DCC、试驾、订单和 IP/试驾标签的成员代码改写到父店后汇总原始分子分母，仅输出父店行；`national-scope.js` 可把二网事实映射回父店责任大区。
- 经销商维表使用 5000 行分页和 50000 行硬上限，只有读到短末页才标记完整；标签 SQL 按 20 个成员分片，每片 5000 行命中即失败，分片原始计数合并后再算比例。
- 过程阶段携带完整性证据；完整零样本保持正常 `--` 语义，截断或任一阶段失败时清空局部过程值并显示“数据覆盖不足”，销售结果不受影响。

**完成标准：** 已达成。Node 契约测试覆盖 `10/8 + 3/2 + 2/1 = 15/11`、跨组织归并、多品牌隔离、非开业父店承接、二网 URL、成员权限、异常候选范围、三周期事实预检及分页证据、过程分子分母和全国完整性；`npm test`、`npm run lint`、`npm run build` 均退出 0，独立 Code Review 与最终 QA 均 PASS。

**验证边界：** `npm run lint` 对当前 30 个浏览器经典脚本执行 `node --check` 语法检查，不代替 ESLint 规则审查；`validation/source-size.test.mjs` 自动阻断根目录业务 JavaScript 单文件超过 300 行，Vite 产物验证由独立 `npm run build` 承担。Phase 3A 的历史完成证据保持不变。

**最终门禁证据：** 2026-07-16 最终执行 Node `63/63`、Playwright PC `17/17`，`npm run lint`、`npm run build` 均退出 `0`，独立 Code Review 与最终 QA 均 PASS。真实经销商维表源为 `a310ff90fddff4b6283841c6`：分页门禁 `pageSize=5000`、`maxRows=50000`，输出 `rowCount/pageCount/complete/hitLimit`，只有读到短末页才允许 `complete=true`；达到硬上限、分页失败或完整性不可证均阻断。标签查询按 20 个复合成员分片、单片 5000 行上限，测试已验证 25 个成员的实际 SQL 精确拆为 `20 + 5`。

### Phase 3C：销售漏斗一级经销商字段最小改造 — 已发布测试 App

**目标：** 只把销售漏斗事实的门店筛选/分组键从 `经销商代码` 改为 `一级经销商代码/fst_dealer_code`，展示名从 `经销商名称` 改为 `父经销商简称/parent_dealer_shortname`；通过别名继续输出既有 `经销商代码/经销商名称`，让前端加载编排和渲染零改。最终统计范围为销售一级代码聚合结果与有效一网白名单的交集，白名单外代码由既有逻辑过滤，不阻断实施。

**交付内容：**
- 在 `data-api.js` 的销售表字段配置中区分源聚合键/源展示名与下游既有字段名；销售 SQL 的非空判断、具体门店过滤、SELECT 和 GROUP BY 使用一级经销商代码，展示名取父经销商简称。
- 当前、上月、上周继续复用同一个销售 SQL 生成函数；销售明细分页降级改用一级经销商代码过滤，并在返回 `metrics.js` 前归一为既有字段结构。
- 保留 `filter-api.js` 的一网维表白名单、组织和权限逻辑；不满足现有有效一网白名单条件的销售一级代码由既有 `metrics.js` 过滤，不展示、不参与顶部或销售行合计。仅对进入白名单的代码校验维表一网记录唯一匹配、同码没有多个非空父简称，并且销售父简称与对应维表一网简称完全一致。
- 不修改 DCC、试驾/订单明细、邀约、IP/试驾标签的查询字段、SQL/预览筛选及负向过程指标，也不修改 URL、页面组件、埋点和导出逻辑；`线索到店率`、`到店试驾率`、`试驾订单率`、`线索订单率` 均由销售分子分母计算，按新的一级经销商口径重算并允许变化；不新增父子关系模块。

**实施代码文件：** 只修改 `multi-store-super-app/data-api.js`。

**实施测试文件：** 只新增 `multi-store-super-app/validation/data-api-sales-parent.test.mjs`。SQL、明细降级、当前/上月/上周、白名单外一级代码由既有 `metrics.js` 过滤、白名单内代码唯一匹配及销售父简称与维表简称完全一致的契约断言全部集中在该文件；未修改任何既有测试或 PC fixture。

**四步门禁：**
1. Code Review：确认业务源码 diff 仅有 `data-api.js`、测试 diff 仅新增 `validation/data-api-sales-parent.test.mjs`；销售以外的过滤/SQL/加载函数无改动；确认没有 `dealer-relations`、`scopeDealerCodes`、二网 URL 归一或 UI 分支。
2. 测试完整性：执行 `(cd multi-store-super-app && npm test)`；新增测试集中覆盖 `10/8 + 3/2 + 2/1 = 15/11`、具体父店按一级经销商代码过滤、当前/上月/上周一致、SQL 与明细降级同构、一级代码/父简称空值与转义、白名单外一级代码由既有 `metrics.js` 过滤、白名单内代码唯一匹配、销售父简称与维表一网简称完全一致。
3. 编译：执行 `(cd multi-store-super-app && npm run lint && npm run build)`，全部退出 `0`；构建产物仍加载原 `app.js / metrics.js / filter-api.js`。
4. 功能：执行 `(cd multi-store-super-app && npm run test:pc)`，并在测试环境用真实区域/小区/父店各验一例：销售不再错误空态；白名单外一级代码不展示且不进入顶部或销售行合计；只有在白名单内唯一性与名称一致性门禁通过后才验收父店行显示父经销商简称；顶部数量等于销售行合计；DCC、试驾/订单明细、邀约、IP/试驾标签及负向过程指标保持基线，四项顶部转化率按新销售聚合结果正确变化。

**停止条件：** 进入有效一网白名单的销售一级代码出现多条维表匹配、同码多个非空父简称、销售父简称与对应维表一网简称不完全一致，过程事实 SQL/字段需要联动修改，或必须修改 `filter-api.js`/`metrics.js`/`app.js` 才能运行时，立即停止实施并输出代码与名称差异清单，不扩展本 Phase。白名单外代码由既有 `metrics.js` 过滤，不属于停止条件。

**门禁结果：** 真实数据一致性检查、自动化、编译、PC 回归、独立 Code Review 和最终 QA 已全部通过；已发布到测试 App `q0844640cf6734877a3193d6`，未发布生产 App，也未 commit 或 push。

**验收证据：** `npm test` `40/40`、`npm run lint`、`npm run build`、`npm run test:pc` `14/14` 均退出 `0`，AC-080～AC-087 全部 PASS，最终 Code Review 与 QA 的 P0/P1/P2 为 `0/0/0`。三阶段白名单内/外代码数为当前 `911/54`、上月同期 `899/60`、上周同期 `911/54`，白名单外并集 84 个代码按口径排除；白名单内维表非唯一、同码多父简称、父简称为空及简称不一致均为 `0`。真实样本 `MQ530Q / 菏泽首信` 的 19 个原始经销商代码聚合订单/零售为 `57/39`，与逐成员求和一致。`data-api.js` 与构建产物 SHA-256 为 `f639f60ea8f0a985f17753539f442e50d5556faffb15db989ff87a4d2cf7c886`，新增测试 SHA-256 为 `5fe10cdf4e850f26d5b63cbd13aa6a1bc02bcf435b77b93a790b405ff3e2b92b`；过程链路组合哈希保持基线值 `18116f68934d1d164993fe839706719191db79a2b186b55df8421eb22f08fcee`。

**发布证据：** 北京时间 2026-07-16 18:01:40 与运行时门店详情环境跳转修复合并发布到测试 App `q0844640cf6734877a3193d6`，版本 `0.1.0`，发布包 SHA-256 为 `90e68518da3805ea3af0b9c9981d1588ac7fc5239f10f011fe846c141f97e5cb`；线上首页和 13 个资源均为 `200` 且与本地 `dist/` 哈希一致，线上 `environment=test`，发布后冒烟和独立 QA 均 PASS。

### Phase 3D：PC 应用级车系筛选 — 已发布测试 App，Code Review P0/P1=0，QA final PASS（P0/P1/P2=0/0/0）

**目标：** 在不修改一期 `../super-app/`、不开发移动端的前提下，将单店车系筛选原样对齐到多店 PC。默认“全部车系”，从销售漏斗字段 `汇报车系名称` 按品牌取得全量真实枚举；选中后只收窄销售事实，并显式保留过程数据的同口径边界。

**交付内容：**
- 先只读对标 `../super-app/src/App.tsx`、`src/services/storeDiagnosis.ts` 和相关样式，复用其品牌级枚举、`compareVehicleSeriesOptions`、`vehicleSeries/carSeries/series` URL 兼容、刷新与缓存逻辑；不得手写多店枚举或第二套排序。
- 在 PC 销售区应用级“销售总览”标题行右侧新增唯一的“车系 / 全部车系”控件；标题行位于销售指标框和过程指标框共同上方，控件不得落入任一单独指标框。触发器和菜单严格使用单店的宽度 `176px–280px`、高 `36px`、`1px solid rgba(49, 107, 255, 0.18)` 边框、`8px` 圆角、既有阴影、标签/值字号、`+6px` 菜单间距、`260px` 内部滚动、选中/悬停色、箭头、外点/Escape 和 ARIA 行为。
- 只对销售漏斗 `k4c14c31c595540a0a771f50.汇报车系名称` 增加车系条件。当前/上月/上周销售、顶部销售与四项转化率、销售表现、销售导出、排名/占比及组织表排序均按同一筛选结果重算；车系进入 URL `vehicleSeries`、刷新状态和销售缓存键，品牌切换先复位“全部车系”。
- 逐数据源审计 DCC、试驾、订单、IP/试驾标签的可用字段。它们没有销售同口径 `汇报车系名称` 时不新增枚举、不跨字段过滤；具体车系下在过程 Tab 和过程导出显示固定边界说明，过程事实仍按组织/日期范围。
- 保持 AC-088/AC-089：大区按名称数字前缀升序，小区/经销商按筛选后订单降序、同订单代码升序；两个 Tab 同行序，权限白名单、日期与下钻不变。

**涉及代码与测试文件：** `multi-store-super-app/index.html`、`app.js`、`data-api.js`、`filter-api.js`、`filter-ui.js`、`metrics.js`、`organization-view.js`、`components.css`/现有 PC 样式文件、`validation/*.test.mjs`、`validation/pc-role-drilldown.spec.js`（实际改动以单店同构代码路径和数据源审计结果为准；不得为了满足清单扩展过程事实 SQL）。

**四步门禁：**
1. **Code Review：** 独立核查枚举/排序源唯一来自一期同构逻辑和销售 `汇报车系名称`，不存在硬编码车系或异名字段假过滤；复核 URL、缓存、品牌复位、导出边界、权限/日期/下钻与 AC-088/089 排序不变量。
2. **测试完整性：** `(cd multi-store-super-app && npm test)` 覆盖默认全部、真实单车系、按品牌全量枚举、单店同构排序、URL `vehicleSeries/carSeries/series` 重载、车系缓存隔离、品牌复位、销售导出、过程边界说明及车系前后组织排序回归；不得以 mock 车系替代真实查询契约。
3. **编译：** `(cd multi-store-super-app && npm run lint && npm run build)` 均退出 `0`，构建产物含车系实现且不引入移动端入口改动。
4. **功能：** `(cd multi-store-super-app && npm run test:pc)` 退出 `0`；在 1440px PC 运行时保存默认/展开/真实单车系截图，并用自动断言证明筛选器位于销售总览整体标题行右侧、不在任一指标框内，以及单店样式、菜单滚动、外点/Escape/ARIA、销售联动、过程边界和组织排序。

**停止条件：** 若销售漏斗数据集不能按品牌读取 `汇报车系名称` 全量枚举，或单店同构排序/缓存逻辑无法复用，先输出真实字段/调用差异而不以硬编码、当前门店结果或过程异名字段替代；若过程链路要求使用另一口径才可“联动”，维持边界说明，不扩展过程 SQL。

**实现、发布与自检证据：** AC-090～AC-099 的实现自检已完成；本次测试包包含车系筛选器迁移至“销售总览”整体标题行右侧（非销售指标单框内）的应用级位置修正，以及此前“销售概览 / 过程分析”Tab 文案。`npm test` `48/48`、`npm run lint`、`npm run build`、`npm run test:pc` `18/18` 均退出 `0`，`npm audit` critical=`0`，`settings.json` 为 `environment=test`；`dist/` 隐私扫描未发现 `/Users/`、API key 或 `.db/.env/.pem/.key/credential` 文件。1440px 展开态截图为 `multi-store-super-app/validation/pc-vehicle-series-menu-expanded-1440x900.png`。最终 Code Review P0/P1=`0/0`；最终 QA PASS，P0/P1/P2=`0/0/0`。已通过 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 发布至测试 App（`operation:update`、版本 `0.1.0`、包 SHA-256 `b49f7e47ea742a705c79b381e71cbe4689bf88d35e043b2c3839d85b52b712ca`，访问地址 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；匿名 HEAD HTTP `401` 仅证明登录态保护，未执行登录后线上 UI/功能验收；未发布生产、未 commit、未 push。

### Phase 3E：过程标签定向聚合与独立错误状态 — 已发布测试 App

**目标：** 修复默认 `2026-07-01~2026-07-20 / MG / 全域` 下历史 IP 聚合真实 5118 行、历史试驾聚合真实 6141 行触达平台 `limit=5000` 后 fail-closed，且 IP/试驾共用 `Promise.all` 导致任一失败整段丢弃的问题。修复后邀约四项和试驾三项分别可用、分别报错，顶部四项销售转化率不受标签链路影响。

**交付内容：**
- 将过程标签查询拆为 `kind=ip` 与 `kind=drive` 两条独立链路：独立 SQL、独立 fallback、独立缓存键、独立 `rowCount / hitLimit / complete / error` 证据；不得再用一个 `Promise.all` 的失败结果清空两类标签。
- IP 电话邀约只按页面需要的四项一级标签定向聚合：`零钩子`、`未锁定时间`、`报价承接不足`、`竞品比较转化不足`；试驾接待只按三项一级标签定向聚合：`版本推荐`、`顾虑承接`、`竞品攻防`。不返回无用 `problem_child` 组合，不在前端先拉全量再过滤。
- 保留一期分子/分母、品牌/经销商/日期、去重键、历史/实时字段映射和当前/上月/上周三阶段同构口径；SQL 聚合结果仍以 `5000` 为完整性门禁，触达上限或证据不可证明时该 kind 显示 `数据不完整`。
- UI 状态统一：有样本分子 0 显示 `0.0%`，真无样本显示 `--`，加载/截断/失败/完整性不可证显示 `数据不完整`；邀约四项和试驾三项均遵守。

**实施代码文件：** `multi-store-super-app/data-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/app.js`；如现有职责拆分需要同步状态展示，可最小修改 `multi-store-super-app/components.css` 或现有 PC 样式文件，但不得改动移动端未开发入口、一期 `../super-app/` 或旧多店目录。

**实施测试文件：** 新增或扩展 `multi-store-super-app/validation/process-tags-kind-state.test.mjs`、`multi-store-super-app/validation/process-tags-directed-sql.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`。测试必须覆盖 AC-107～AC-114，并保留 AC-100～AC-106 的试驾单店同口径断言。

**四步门禁：**
1. **Code Review：** 核查 IP/试驾按 kind 独立链路、独立完整性证据、独立错误状态；确认没有无用 `problem_child` 组合、没有静默截断、没有标签失败影响顶部四项销售转化率。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；必须覆盖 IP 失败/drive 成功、drive 失败/IP 成功、两者成功、两者均失败、默认全域定向 SQL 未触达 `5000`、current/previous/week 三阶段同构、`0.0%` vs `--` vs `数据不完整`。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，全部退出 `0`；构建产物不得包含本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感文件。
4. **功能与发布：** 执行 `(cd multi-store-super-app && npm run test:pc)`；用默认 `2026-07-01~2026-07-20 / MG / 全域` 和至少一个单店样本验证过程分析输出正确、顶部四项销售转化率不变。发布前确认 `settings.json` 为 `environment=test`，再执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app`；仅发布测试 App，不发布生产、不 commit、不 push。

**停止条件：** 如果定向一级标签聚合仍触达 `5000`、平台不能证明完整性、历史/实时字段映射与一期不一致、或必须改写一期口径才能出数，立即停止并输出失败 kind、阶段、SQL 范围、`rowCount / hitLimit / complete / error`，不得用部分结果验收。

**实现、发布与自检证据：** AC-107～AC-114 已完成实现、Code Review、QA 和测试 App 发布。默认真实查询 `2026-07-01~2026-07-20 / MG / 全域` 返回 IP=`1896`、drive=`1371`、`isTruncated=false`；`npm test` `70/70`、`npm run lint`、`npm run build`、`npm run test:pc` `26/26` 均通过，`npm audit` critical=`0`。最终 Review P0/P1=`0/0`；QA PASS，P0/P1/P2=`0/0/0`。已通过 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 发布至测试 App（`operation:update`、版本 `0.1.0`、`fileKey=4afc645a-70e5-42c0-8956-a4eacd62ef44`、包 SHA-256 `adaa813455b94444523f5a1e28f6ccfa5a5fbf91c4cbec0864a5b73557859084`，访问地址 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`）；匿名 HEAD HTTP `401` 仅证明登录态保护，未执行登录后线上 UI/功能验收；未发布生产、未 commit、未 push。

### Phase 3F：PC 月目标与目标达成 — 已完成本地验证

**目标：** 在不改变现有销售主订单、漏斗、排名、占比或过程链路的前提下，只读接入目标数据集，并为默认全部车系与具体车系提供可下钻、可导出的月目标和目标达成。

**交付内容：**
- 在 `multi-store-super-app/data-api.js` 新增目标表 DS、目标自然键归一/冲突审计、日期有效性判定、目标聚合与独立“自然月+品牌名称+一级经销商代码+汇报车系名称”实际订单 SQL；目标请求失败不得阻断销售 bundle。
- 在 `metrics.js` 将目标键归并为 `targetBySeries/targetByStore`，将目标门店并入 `factCodes`；在 `organization-view.js` 对月目标、目标口径实际订单、未配置月目标订单、冲突键数逐层汇总并保证下钻对账。
- 在 `app.js/index.html/visual-sync.css` 实现所有指标卡和订单/零售表现的同高 2×2 骨架、目标错误/空槽状态及销售导出六字段。页面只显示“月目标、目标达成”，不显示部分目标缺口提示。
- 新增 `validation/monthly-target.test.mjs` 并扩展相关数据、组织及 Playwright 用例，覆盖自然键、防重/冲突、目标为 0、全部/单车系、target-only/actual-only、主订单不变、组织守恒、日期、无目标/失败、导出及 1280/1440 明暗主题截图。

**四步门禁：**
1. **Code Review：** 独立核查目标实际 SQL 保留车系维度，主订单链未被替换，目标门店进入组织 universe，页面未残留禁用文案或部分缺口提示。
2. **测试完整性：** `(cd multi-store-super-app && npm test)` 覆盖 AC-115～AC-121 及既有销售/过程回归；错误和无目标状态必须有真实用例。
3. **编译：** `(cd multi-store-super-app && npm run lint && npm run build)` 均退出 0。
4. **功能：** `(cd multi-store-super-app && npm run test:pc)` 通过；保存 1440px、1280px light/dark 截图，核对目标对账、target-only、全部车系和目标请求失败不阻断销售。

**停止条件：** 若目标数据集读取、业务结果、权限或目标月解释无法证明，不得写入或伪造目标；降级为“月目标数据暂不可用”，并输出请求阶段、业务错误和影响范围。

**完成证据（2026-07-21）：** 已只读接入 `u32cb7e789f7443ff84160b4`，并在真实观远查询验证目标表字段和目标口径实际订单 SQL 均可返回 MG 2026-07 数据。`npm test` 79/79、`npm run lint`、`npm run build`、`npm run test:pc` 33/33 和 `npm audit --omit=dev --audit-level=critical` 均通过；独立 Code Review 双阶段和独立 QA 均通过（P0/P1=0），四张 1280/1440px 明暗截图已保存。已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256 `143301505ff3524d078de8e80268923684cbcac5c2136b9cd3ecf28339b49038`）；匿名入口 HTTP 401，仅确认登录态保护，未做登录后线上 UI 验收。未 commit、未 push。

#### Phase 3F.1：PC 月目标布局二次迭代 — 已完成本地验证

**目标：** 只调整 PC 展示布局和排名文案，不改变目标数据、主订单、销售漏斗、排名/占比计算、导出字段、组织下钻或失败降级。

**交付内容：**
- 将顶部订单、交付率、零售和四张过程指标卡的月环比、周环比固定为第一行；订单卡有有效目标时第二行展示月目标、目标达成；无目标指标第二行保留真实 `aria-hidden=true` 空槽，避免中部空白。
- 将销售概览表订单表现调整为第一行 `月目标｜目标达成`、第二行 `排名｜占比`；零售表现调整为第一行同高空槽、第二行 `排名｜占比`。
- 将订单/零售排名标签统一为“排名”，保留名次/分母，不再显示“全国排名/大区排名/小区排名”。
- 修复 1280px 笔记本屏目标文字不完整问题；1280px/1440px 浅色、深色主题不得出现目标截断、新增横向滚动、主问题/结果断点/操作列挤压。

**验证门禁：**
1. **Code Review：** 核查改动仅限 PC 展示和测试；不得新增“覆盖达成/覆盖不足/部分车系/部分门店”提示，不得改写目标口径、销售主链路、组织下钻、导出或失败降级。
2. **测试完整性：** 新增或更新用例覆盖 AC-122～AC-125，包括有目标、无目标、目标失败、订单/零售表现 2×2 顺序、排名文案和空槽 `aria-hidden`。
3. **编译：** `(cd multi-store-super-app && npm run lint && npm run build)` 均退出 0。
4. **功能：** `(cd multi-store-super-app && npm run test:pc)` 通过；保存或刷新 1280px、1440px light/dark 截图，明确目标文字完整、无横向滚动。

**完成证据（2026-07-21）：** 已修改 `multi-store-super-app/app.js`、`visual-sync.css` 和 `validation/pc-role-drilldown.spec.js`，并同步 `dist`。`npm test` 79/79、`npm run lint`、`npm run build`、`npm run test:pc` 33/33 均通过；四张 1280/1440px 浅深截图已刷新，覆盖目标、排名、占比、主问题、结果断点和操作列无截断/无横向溢出。独立 Code Review 双阶段与独立 QA 均通过（P0/P1=0）；已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256 `3d265f537db879a1d557715c3c1725d8a9f30331bd55a17056b87b804ba631da`）。匿名入口 HTTP 401，仅确认登录态保护，未做登录后线上 UI 验收；未 commit、未 push。

#### Phase 3F.2：单月自然月目标达成窗口 — 已完成本地验证，QA PASS

**目标：** 用户在同一自然月内选择任意起止日期时，月目标和目标达成稳定按该完整自然月计算；跨月筛选隐藏目标区域；用户筛选日期对既有主销售和过程口径保持不变。

**交付内容：**
- 调整 `multi-store-super-app/data-api.js` 的目标日期解析：以“开始、结束日期是否同月”取代“开始日期必须为 1 日”；单月返回完整自然月的目标读取窗口，以及月初至今天或月末中较早者的独立目标实际订单窗口；跨月不发起有效目标读取。
- 保持目标自然键归一、目标实际订单 SQL 的品牌/一级经销商代码/汇报车系名称维度、行权限、有效门店白名单和全部/具体车系过滤不变；主销售查询继续使用用户原始筛选窗口。
- 将跨月状态接入既有目标空槽与导出状态：顶部订单卡和订单表现不展示月目标、目标达成，零售及无目标指标的 2×2 骨架不变；不新增业务提示或空值替代文案。
- 扩展月目标单元契约及 PC 浏览器用例，覆盖当前月、历史月、跨月和筛选联动；页面和导出对同一组织行使用同一目标窗口结果。

**关键文件：** `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`multi-store-super-app/data-api.js`、`multi-store-super-app/validation/monthly-target.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`DEV-PLAN.md`。

**四步门禁：**
1. **Code Review：** 核查目标实际订单仅改变日期窗口，未回退车系维度、目标自然键、目标门店并入、行权限或主销售筛选日期；跨月不会把多个自然月合并为一个分母或分子。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；覆盖 AC-126～AC-128，至少断言 7/10–7/15 的整月目标和月初至今天实际窗口、历史月月末封顶、跨月不展示有效目标、全部/单车系与组织过滤不回归。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，均退出 0；构建产物携带最新 `data-api.js`，且不包含本地路径或敏感文件。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；保存 1280px 与 1440px 浅色/深色截图，核对单月任意日期仍完整展示目标、跨月隐藏目标、既有销售结果和宽表不横向溢出。随后进入独立 Code Review → QA；通过后才可按用户指令发布测试 App。

**停止条件：** 如果应用运行时“今天”的日期无法稳定取得、目标实际订单窗口与目标月份不一致、跨月仍返回有效分母/分子，或任何筛选导致主销售窗口被改写，停止并保留现有已发布版本，不发布。

**完成证据（2026-07-21）：** 已在 `multi-store-super-app/data-api.js`、`validation/monthly-target.test.mjs`、`validation/pc-role-drilldown.spec.js` 完成 Phase 3F.2。单月任意日期使用完整自然月目标及月初至 `min(今天, 月末)` 的目标实际；跨月及未来月返回 `invalid_range` 空槽并发起零目标请求；主销售不变、导出目标数值为空、未新增文案。目标专项测试 `11/11`、`npm test` `81/81`、`npm run lint`、`npm run build` 均退出 `0`、`npm run test:pc` `34/34`；独立 Code Review P0/P1=`0/0`。独立 QA 在临时副本 PASS，P0/P1/P2=`0/0/0`，复跑 `npm test` `81/81`、`npm run test:pc` `34/34`、lint/build `0`，且 `npm audit --omit=dev --audit-level=critical` 为 0 vulnerabilities。发布前 current tree 为 `environment=test`，隐私扫描无命中；已在项目根运行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 且命令无报错完成。发布包 `multi-store-super-app/dist.0.1.0.zip` 于 2026-07-21 17:49 生成，SHA-256=`c1dc8399807cbca9d3f06c1f933d928aa76d46c51446513467c0564d43619d3e`。CLI 未输出平台 `operation`、版本或 `fileKey`，不作推断；匿名入口 HTTP 401 仅确认登录保护，未做登录后 UI 验收。

#### Phase 3F.3：PC 销售指标标题摘要与卡内两行环比 — 已发布测试 App

**目标：** 落实 `Product-Spec.md` v1.64 的 REQ-011 与 `docs/superpowers/specs/2026-07-21-sales-target-summary-layout-design.md`：PC 顶部将月目标/达成率从订单卡迁到“销售指标”标题右侧；顶部订单、交付率、零售和四张过程卡统一仅显示当前值、月环比、周环比，其中两条环比纵向两行排列。此阶段仅调整 PC 呈现和其浏览器回归用例，不改变目标数据、目标实际订单、主销售、表格、导出、车系/组织筛选、排名、下钻或移动端。

**交付内容：**
- 在 `multi-store-super-app/app.js` 将顶部销售指标标题渲染为“标题 + 目标摘要”同一区域：有有效月目标时展示 `订单目标：{月目标}　达成率：{目标达成率}`；无有效月目标时不渲染摘要；目标加载中在摘要位置渲染同尺寸骨架；目标请求、权限或业务码失败时仅在摘要位置渲染既有 `月目标数据暂不可用`。订单卡及其余六张顶部指标卡均删除目标文本、目标空槽、失败提示和目标骨架，只保留指标值与月/周环比两行。
- 在 `multi-store-super-app/visual-sync.css` 实现标题 20px/700、摘要标签 13px/500 灰蓝、订单目标数值 15px/700 蓝色、达成率数值 15px/700 绿色及两者之间的轻分隔线；标题和摘要在 1280px/1440px 浅深主题下可在同一区域换行。将所有顶部卡片的月环比、周环比固定为纵向两行，保留现有正负趋势色和足够卡内高度，禁止文本截断和新增横向滚动。
- 更新 `multi-store-super-app/validation/pc-role-drilldown.spec.js` 的 PC 渲染回归：覆盖有效目标、无有效目标、目标加载、目标不可用四态；断言摘要状态位置正确、七张顶部卡片均无目标语义且月/周环比为纵向两行；覆盖 1280px/1440px 的浅色/深色 `scrollWidth <= innerWidth`、标题/摘要可换行、表格订单表现 2×2 结构、车系/组织筛选、过程卡、排名、下钻及销售导出字段不回归。
- 本轮不修改 `multi-store-super-app/validation/monthly-target.test.mjs`：该文件覆盖数据与目标窗口契约，现有变化不触及其数据分支；若实现中不得不改变目标状态数据契约，必须先补该文件对四态输入/输出不变的契约断言，再运行全量 Node 测试。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`；仅当目标状态数据契约被实现改动触及时才追加 `multi-store-super-app/validation/monthly-target.test.mjs`。

**四步门禁：**
1. **Code Review：** 独立核查改动只限 PC 渲染、样式和浏览器测试；七张顶部卡片均不残留月目标、目标达成、订单目标、达成率、目标空槽、错误提示或骨架；摘要四态不改目标数据/查询/计算，不改表格订单表现、零售表现、车系/组织筛选、过程卡、排名、下钻和导出字段。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`，再执行 `(cd multi-store-super-app && npx playwright test validation/pc-role-drilldown.spec.js)`；有效目标、无目标、加载、失败、七卡内容、两行环比、表格不变和筛选/下钻/导出回归均有断言。若触及目标状态数据契约，`validation/monthly-target.test.mjs` 的新增四态契约断言必须同时通过。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，均退出 0；不得以构建产物替代源码或测试修改。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`，保存 1280px、1440px 的浅色/深色截图；核对标题摘要层级与换行、两行环比完整显示、页面无横向滚动、表格订单表现的 `月目标｜目标达成 / 排名｜占比` 未变。

**Review → QA → 发布边界：** 四步门禁通过后，必须先完成独立 Code Review；若有问题，修复后从本阶段 Code Review 重跑。Code Review 通过后再进入独立 QA，QA 不通过则修复并重跑 Code Review 与 QA。只有两者均通过后，才可在用户明确指令下评估是否发布；本阶段计划本身不发布、不提交、不推送。

**停止条件：** 只要目标摘要状态无法与既有目标状态一一对应、任一顶部卡片仍显示目标相关内容、1280px/1440px 任一浅深组合出现截断或横向溢出，或发现改动需要变更目标查询/计算、表格/导出、筛选或下钻，即停止在本阶段并收窄为呈现层修复，不得借此扩展数据链路。

**完成证据（2026-07-21）：** Phase 3F.3 已完成标题摘要与卡内两行环比实现，验收仍为 `npm test` `81/81`、PC `35/35`、lint/build/audit 通过。发布更正：此前 17:49 发布因 `guancli` 1.0.34 与过期 profile token 未返回平台回执，线上仍为 `target1`，不得认定成功；本次按用户授权通过官方 POST `/public-api/user/loginId/sign-in` 刷新本机 `guancli` profile（文档不记录密钥、账号或 token），并升级 `guancli` 至 1.0.42。北京时间 2026-07-21 20:49 从 `multi-store-super-app/` 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，平台真实回执为 `操作:update`、版本 `0.1.0` 且 appId 对应；新 `multi-store-super-app/dist.0.1.0.zip` 时间为 20:49:00，SHA-256=`1c917cd1feec3231f0b8bdc6cb44c7f26493253de0c8cf6f41d3d79872651b4a`。匿名线上 URL 仍返回 HTTP 401，仅说明登录保护；已用新 UID token 认证读取线上资源，`index.html` Last-Modified 为 Tue, 21 Jul 2026 12:49:01 GMT（北京时间 20:49:01），引用 `app.js?v=20260721-target2`，不再引用 `target1`；线上 `target2` 的 `app.js` HTTP 200，包含 `sales-target-summary` / `订单目标`，且无 `target-meta`。本阶段未发布生产、未 commit、未 push。

### Phase 3G：PC 应用级车系筛选多选升级 — 已完成并通过最终 QA

**目标：** 将既有 PC 应用级车系筛选从历史单选升级为不限数量多选；默认/无具体选择仍为“全部车系”。选中集合必须作为同一个产品上下文进入销售事实、订单/零售目标、URL、刷新、埋点和缓存；过程链路继续保持同口径边界，不改移动端、不改一期、不发布。

**交付内容：**
- 在 `multi-store-super-app/filter-ui.js`、`app.js` 和现有 PC 样式中把车系菜单改为复选列表：单项点击只切换勾选且菜单不关闭，外点或 `Escape` 关闭；点击“全部车系”清空集合；取消最后一项回到“全部车系”；触发器按 0/1/N 项显示“全部车系 / 名称 / 已选 N 个车系”。
- 在 URL 与状态层把车系值统一为按品牌枚举顺序稳定的集合：重复 `vehicleSeries` 为唯一规范写法；兼容读取历史单值 `vehicleSeries/carSeries/series`，本地变更后清除别名；非法或不属于当前品牌枚举的值剔除。
- 在 `data-api.js`、`metrics.js`、`organization-view.js` 与目标链路中统一消费选中集合：当前/月同期/周同期销售事实、顶部指标、销售概览、销售导出、订单/零售目标与达成、订单/零售排名与占比均按 `汇报车系名称 IN (集合)` 重算；全部车系不加条件。
- 在刷新、重试、GIO/页面埋点、销售查询缓存键和目标查询缓存键中加入规范化选中集合；品牌切换时先清空集合、清 URL、清旧缓存上下文，再加载新品牌枚举和销售/目标结果。
- 保留过程 Tab、过程指标和过程导出的异名字段边界说明；当前多店基于已过滤 `peerRows` 动态计算的 `orderRank/retailRank/orderShare/retailShare` 必须继续展示并随多选集合重算；只有独立官方排名、官方分位或官方诊断结果表缺车系维度时才隐藏或降级，不展示全盘官方结果冒充车系集合结果。

**交付文件：** `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`、`multi-store-super-app/filter-ui.js`、`multi-store-super-app/app.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/organization-view.js`、`multi-store-super-app/components.css`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/vehicle-series-multiselect.test.mjs`（新增）、`multi-store-super-app/validation/monthly-target.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/pc-vehicle-series-multiselect-expanded-1440x900.png`（生成证据）。

**四步门禁：**
1. **Code Review：** 独立核查无单选残留；重复 `vehicleSeries` 规范化、别名清理、枚举顺序稳定、品牌复位、缓存/埋点隔离、销售/目标集合过滤、过程边界、动态排名/占比继续展示以及独立官方结果缺车系维度时隐藏均符合 AC-135～AC-142；确认未修改移动端、一期 `../super-app/`、旧多店目录、权限、日期、组织下钻或排序规则。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；必须覆盖默认全部、连续多选不关闭、点击全部清空、取消最后一项回全部、0/1/N 触发器文案、重复 URL 稳定序列化、历史别名兼容与清除、非法值剔除、品牌复位、缓存/旧请求隔离、销售集合联动、订单/零售目标集合联动、动态排名/占比随集合重算、过程边界和独立官方结果缺车系维度时隐藏。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，均退出 `0`；构建产物不得包含本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；在 1440×900 PC 视口保存多选菜单展开态截图，自动断言唯一 `#vehicleSeriesFilter` 仍位于“销售总览”标题行右侧、两组指标框上方且不在任一 `.metric-panel` 内，菜单 260px 内部滚动、ARIA 多选、外点/Escape、销售/目标/导出联动和权限/日期/下钻/排序不回归。

**Review → QA → 发布边界：** 四步门禁通过后必须进入独立 Code Review；Review 不通过则修复后重跑四步门禁。Review 通过后进入独立 QA；QA 不通过则修复并重跑四步门禁、Code Review 与 QA。本阶段不发布、不提交、不推送；即使 QA 通过，也必须等用户另行明确发布指令。

**停止条件：** 如果销售漏斗数据集无法证明品牌级全量 `汇报车系名称` 枚举、重复 URL 与观远容器冲突、缓存隔离不可证明、目标链路无法保留车系维度，或过程链路必须混用异名字段才可出数，停止实现并输出失败阶段、字段/URL/缓存差异和影响范围，不用硬编码枚举、单选降级或过程伪联动绕过。

**完成证据（2026-07-22）：** Phase 3G 已完成 AC-135～AC-142：默认全部、多选连续切换、重复 `vehicleSeries` URL 归一、销售/目标/导出/动态排名/动态占比集合联动、过程边界、品牌复位、缓存/埋点隔离和 1440x900 展开态证据均已覆盖。门禁为 npm test 90/90、test:pc 43/43、lint/build/audit exit 0；source/dist、1440x900 多选展开态截图、安全和未发布边界通过；两阶段 Review Stage 1/2 PASS，最终 QA PASS，P0/P1/P2=0/0/2，无新增缺陷。2 项 P2 为非阻断：大文件职责集中、无车系 baseline 完整 loader 性能冗余。本阶段不发布、未 commit、未 push。

### Phase 3H：MG 订单/零售目标源切换 — 已开发，Code Review PASS，最终 QA PASS

**目标：** 落实 `Product-Spec.md` v1.67 / REQ-011 与 `docs/superpowers/specs/2026-07-22-mg-order-retail-target-source-design.md`：将 PC 目标链路从旧订单目标单链路切换为 MG 新“订单目标 + 零售目标”双链路。旧订单目标 DS `u32cb7e789f7443ff84160b4` 必须从当前业务代码、目标测试和构建产物引用中移除；新目标源固定为 `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标`。本阶段不改移动端、不改一期 `../super-app/`、不写目标数据、不补授权、不发布、不 commit、不 push。

**当前状态（2026-07-22）：** 已完成本地源码、测试和构建产物同步；旧 DS `u32cb7e789f7443ff84160b4` 在当前业务源码、目标测试与 `dist/` 搜索为 0；`data-api.js` 已指向新 DS `r05b1e3995b0b4480991a4b8` 并读取 `目标日期/dealer_code/车系/总订单目标/总零售目标`，`metrics.js`、`organization-view.js`、`app.js` 已按订单/零售双目标和导出字段接入。真实 2026-07 新 DS 审计为 1542 行、订单目标 22578、零售目标 18580、5 条有效经销商缺口；本地门禁 Node 90/90、PC 43/43、lint/build/audit critical=0；已通过代码复审。最终 QA PASS，P0/P1/P2=0/0/0；本阶段尚未发布、未 commit、未 push。

**依赖状态：** Phase 3F.3 的标题摘要与卡内两行环比已上线；Phase 3G 所需的规范化车系选中集合、重复 `vehicleSeries` URL、销售/目标缓存隔离和品牌复位在当前实现中已作为 AC-158 相关依赖被本地回归覆盖。若后续发布前改动 `index.html`、资源 query 或缓存键，需重跑旧 DS 搜索、Node/PC 回归和 QA。

**交付内容：**
- 在 `multi-store-super-app/data-api.js` 将目标 DS 和字段契约替换为新表：只读取 `目标日期、dealer_code、车系、总订单目标、总零售目标`；品牌固定补常量 `MG`；不得继续读取或信任目标表中的 `area/city_name/rfs_name/mac_name` 等组织字段；旧 DS ID 和旧字段映射不得残留在当前业务代码、目标测试或构建产物引用中。
- 实现目标自然键归一：以 `目标月份 + MG + dealer_code + 车系` 去重；同键订单目标或零售目标一致时保留一个值，任一目标值冲突时仅作废对应指标并计数；`目标日期/dealer_code/车系` 为空、目标非数字或负目标剔除；0 目标保留但达成率为空；2026-07 样本需可核对新表 1542 行、订单目标 22578、零售目标 18580、5 条非命中有效经销商维表记录进入缺口审计。
- 新增双目标口径实际查询：订单目标实际按自然月 + `品牌名称=MG` + `一级经销商代码` + `汇报车系名称` 聚合 `当日订单数（首触）`；零售目标实际按同键聚合 `当日零售数`。不得复用已丢失车系维度的 `salesAggregateSql` 计算任一目标分子；不得改写主订单、主零售、漏斗、动态排名、动态占比和过程指标口径。
- 在 `multi-store-super-app/metrics.js` 和 `organization-view.js` 将单一 `monthlyTarget` 拆为订单目标、零售目标两套目标、目标口径实际、达成率、状态和审计；目标有实际无的有效经销商必须生成组织行且实际为 0，实际有目标无仅进入主订单/主零售和未配置目标实际审计；全国/大区/小区/门店下钻时顶部目标不变，当前列表行目标之和与父范围目标守恒。
- 在 `multi-store-super-app/app.js`、`index.html`、`visual-sync.css` 和销售导出逻辑中更新展示与导出：顶部“销售指标”标题摘要显示 `订单目标/订单达成/零售目标/零售达成`；七张顶部指标卡仍只展示指标值、月环比、周环比；订单表现和零售表现均为 `月目标｜目标达成 / 排名｜占比`；销售导出包含订单与零售的目标、目标口径实际、达成率、状态、未配置实际、冲突键和目标有效门店缺口字段。
- 保留 Phase 3F.2 的日期窗口规则并升级为双链路：仅 MG + 单一自然月 + 非未来月展示目标；目标读取整月，目标实际读取月初至 `min(今天, 月末)`；跨月、未来月、非 MG 品牌或品牌为“全部”且未明确 MG 时隐藏订单/零售目标并输出 `invalid_range`、`非 MG 隐藏` 等导出状态，不新增跨品牌复用提示，主销售链路继续按用户筛选日期展示。

**关键文件：** `multi-store-super-app/data-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/organization-view.js`、`multi-store-super-app/app.js`、`multi-store-super-app/index.html`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/monthly-target.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/mg-order-retail-target-source.test.mjs`（新增）、`multi-store-super-app/validation/pc-order-retail-target-1280-light.png`（生成证据）、`multi-store-super-app/validation/pc-order-retail-target-1280-dark.png`（生成证据）、`multi-store-super-app/validation/pc-order-retail-target-1440-light.png`（生成证据）、`multi-store-super-app/validation/pc-order-retail-target-1440-dark.png`（生成证据）。

**四步门禁：**
1. **Code Review：** 独立核查 AC-151～AC-164 全覆盖：旧 DS 和旧字段映射删除，新 DS/字段唯一；组织归属只取有效经销商维表；订单/零售目标实际 SQL 均保留自然月、MG、一级经销商代码、汇报车系名称维度；七张顶部卡无目标内容；订单/零售表现 2x2；非 MG、跨月、未来月和失败降级不阻断销售主链路；未修改移动端、一期、权限、日期、组织下钻、排序、过程事实过滤或发布配置。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；必须覆盖旧 DS 搜索清零、新字段归一、冲突/空键/负数/0 目标、2026-07 样本 1542/22578/18580/5 条缺口、目标有实际无、实际有目标无、全部车系与多选集合、跨月/未来月/非 MG 隐藏、请求失败/无权限/业务码失败、导出字段、下钻守恒和双实际 SQL 维度。`validation/monthly-target.test.mjs` 必须从旧订单单链路断言升级为订单/零售双链路断言。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，均退出 `0`；构建产物不得包含旧 DS `u32cb7e789f7443ff84160b4`、旧目标字段映射、本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；在 1280px 与 1440px、浅色与深色主题保存截图并自动断言标题摘要可换行且层级弱于标题，订单表现与零售表现 2x2 文字不截断、无新增横向溢出，目标失败只影响目标位置，销售主链路、过程卡、动态排名/占比、车系多选、下钻和导出主字段不回归。

**验收映射：** AC-151 旧 DS 清零；AC-152 新字段与目标自然键归一；AC-153 组织归属只取有效经销商维表；AC-154 2026-07 样本与 5 条缺口对账；AC-155 标题摘要四项且七张顶部卡无目标；AC-156 订单/零售表现均为 2x2；AC-157 target-only 与 actual-only；AC-158 车系集合联动；AC-159 跨月、未来月、非 MG 隐藏；AC-160 失败降级不阻断主链路；AC-161 导出字段完整且同页面一致；AC-162 下钻守恒；AC-163 双实际 SQL 维度；AC-164 1280px/1440px 浅深主题无横向溢出。

**DoD / 门禁状态：** 四步门禁中的本地测试、编译、功能回归和旧 DS 构建产物搜索均已通过；独立 Code Review 已通过。最终 QA PASS，P0/P1/P2=0/0/0；QA 门禁为旧 DS 搜索清零、Node 90/90、PC 43/43、lint/build/audit critical=0。

**Review → QA → 发布边界：** 当前已过 Code Review 和最终 QA；不得发布、提交或推送。后续发布必须等用户另行明确发布指令。

**停止条件：** 如果新目标 DS 业务码失败、字段缺失、2026-07 样本合计无法复核、有效经销商维表缺口无法审计、目标实际 SQL 无法保留车系维度、旧 DS 引用无法清零、非 MG/跨月/未来月状态会污染主销售链路，或实现需要改写过程事实/移动端/一期能力，停止并输出失败阶段、数据源返回、差异字段、影响范围和下一步确认项，不用旧目标源、硬编码组织或无车系维度聚合绕过。

### Phase 3I：PC 打铁指标数据查询合同与独立源状态 — 已完成并发布测试 Super App

**目标：** 落实 `Product-Spec.md` v1.69/v1.70 的 REQ-012 数据合同，以及 `docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md` 的 11 项应用采用口径。先建立打铁指标查询、聚合、长表输出和独立来源状态，不渲染第三 Tab，不改销售概览、过程分析、负向问题率、车系筛选、组织下钻、移动端、一期或发布配置。技术栈沿用现有原生 HTML/CSS/JavaScript、Vite、Playwright、npm，不新增依赖。

**交付内容：**
- 在 `multi-store-super-app/data-api.js` 新增打铁指标数据源配置、日期字段映射、六类来源查询、组织范围过滤、完整性证据和长表输出。输出字段为 `section_code/page_order/organization_level/organization_code/organization_name/metric_code/display_name/metric_value/numerator/denominator/target_value/target_label/unit/precision/dataset_name/dataset_id/source_status/complete`；不得输出 `status_value/status_label`。
- 在 `multi-store-super-app/metrics.js` 或现有共享计算层新增组织聚合适配：大区、小区、门店均先聚合原始分子/分母或源计数后计算比例，不平均下级百分比；两项试驾开口率先限定对应 `试驾体验点` 后再取 distinct `试驾清单ID`。
- 建立来源状态：加载、成功、真无样本、分母有效但分子 0、失败/截断/字段缺失/完整性不可证。任一来源失败只影响对应指标，不清空其他来源成功指标。
- 保留车系边界：打铁指标不使用销售 `汇报车系名称` 过滤过程来源字段；组织骨架复用无车系 `processBaselineData` / 过程基线有效组织集合，并沿用 `OrganizationView` 同层级排序规则，不使用具体车系筛选后的销售行集作为打铁行集。

**关键文件：** `multi-store-super-app/iron-metrics-contract.js`、`multi-store-super-app/iron-metrics-api.js`、`multi-store-super-app/iron-metrics-model.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/app.js`、`multi-store-super-app/validation/iron-metrics-contract.test.mjs`、`multi-store-super-app/validation/iron-metrics-query.test.mjs`、`docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md`（只读依据）。

**四步门禁：**
1. **Code Review：** 核查 11 项名称、顺序、目标、数据集、日期字段、过滤条件、去重键、分子分母、两项开口率体验点分母、`target_label`、无状态字段和车系边界；确认未修改 UI、导出、移动端、一期或已完成目标链路。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；新增测试覆盖 11 项长表合同、目标 label、首跟 `target_label=null`、当前 `startDate/endDate` 闭区间、DCC `NI` 条件、两项开口率分母、组织层级聚合、`0.0% / -- / 数据不完整`、六来源独立失败和车系不伪联动。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，均退出 `0`；构建产物不得包含本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 暂不验收 UI；通过测试 fixture 或本地调试入口读取打铁长表快照，核对邀约 7 项、试驾 4 项、当前组织层级、目标提示和来源状态完整。

**停止条件：** 任一来源字段、日期字段、去重键或完整性证据无法证明，DCC 排除条件无法按 `NI` 表达，两项试驾开口率只能用全体验点分母，或实现必须混用销售车系字段才出数时，停止并输出失败指标、来源数据集、字段差异和影响范围，不用硬编码百分比或旧缓存绕过。

**完成证据（2026-07-22）：** 已完成本地实现、R5 Code Review、独立 QA 与测试 Super App 发布。最终本地基线为 `npm test` 106/106、`npm run test:pc` 58/58、真实静态语法 `npm run lint`、`npm run build`、`npm audit --omit=dev --audit-level=critical` 0 vulnerabilities；已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、包 `dist.0.1.0.zip`、SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`、大小 `126818` bytes、解包 `30 files / 521802 bytes`）；发布后独立 QA PASS，P0/P1/P2=`0/0/0`；匿名 HEAD/GET 与关键资源仅验证 401/302 登录态边界，未做登录后线上 UI/资源哈希验收；未做观远认证态真实查询，未发布生产、未 commit、未 push。

### Phase 3J：PC 第三 Tab、C 方案二级切换与表头目标层级 — 已完成并发布测试 Super App

**目标：** 在现有表现区右上 tablist 中新增第三个一级 Tab“打铁指标”，并实现已批准 C 方案二级切换和表头层级。此阶段只接入 Phase 3I 的打铁长表渲染，不改变下钻状态机和导出实现；开发阶段原计划不发布、不 commit、不 push，后续已按用户授权发布测试 Super App，仍未发布生产、未 commit、未 push。

**交付内容：**
- 在 `multi-store-super-app/index.html` 和 `app.js` 中把一级 tablist 扩展为 `销售概览 → 过程分析 → 打铁指标`，默认仍激活“销售概览”；“打铁指标”不抢占入口。
- 在“打铁指标”面板内新增 `邀约指标 7 / 试驾指标 4` 二级切换，默认激活邀约组，同一时间只展示当前组；二级切换只改 `activeMetricGroup`。
- 渲染邀约 7 列和试驾 4 列的紧凑表格。表头两层：第一层指标名称，第二层 `目标 xx%`；`首跟通话60s占比` 第二层不渲染可读文案。
- 目标只做口径提示，不生成红绿底色、圆点、达标/未达标标签、官方识别状态、综合得分或状态列。
- 样式继承现有 PC tab、按钮、边框、紧凑表格、sticky 首列、浅/深色 token；不改销售概览、过程分析、负向问题率和导出按钮位置。

**关键文件：** `multi-store-super-app/index.html`、`multi-store-super-app/app.js`、`multi-store-super-app/iron-metrics-view.js`、`multi-store-super-app/iron-metrics.css`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/iron-metrics-pc-tabs.spec.js`。

**四步门禁：**
1. **Code Review：** 核查一级 tab 默认值、二级切换状态、表头层级、首跟无占位、无目标达标视觉、现有两个 Tab 和导出按钮位置不变；确认未改数据口径、组织下钻、销售/目标/过程链路或移动端。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；再执行 `(cd multi-store-super-app && npx playwright test validation/iron-metrics-pc-tabs.spec.js)`；覆盖 AC-166～AC-169、邀约默认、试驾切换、同屏只一组、表头目标、首跟无占位、无识别状态和旧 Tab 不回归。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，均退出 `0`。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；保存 1440px 浅色/深色“打铁指标”截图，核对二级切换、表头层级、目标提示、无状态色和现有 tab/导出布局。

**停止条件：** 若第三 Tab 会改变默认激活页、二级切换需要复制一套下钻状态、首跟目标无法做到无可读占位、目标视觉被误用为达标状态，或 1280/1440 出现页面级横向溢出，停止并收窄为呈现层修复。

**完成证据（2026-07-22）：** 已完成本地实现、R5 Code Review、独立 QA 与测试 Super App 发布。最终本地基线为 `npm test` 106/106、`npm run test:pc` 58/58、真实静态语法 `npm run lint`、`npm run build`、`npm audit --omit=dev --audit-level=critical` 0 vulnerabilities；已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、包 `dist.0.1.0.zip`、SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`、大小 `126818` bytes、解包 `30 files / 521802 bytes`）；发布后独立 QA PASS，P0/P1/P2=`0/0/0`；匿名 HEAD/GET 与关键资源仅验证 401/302 登录态边界，未做登录后线上 UI/资源哈希验收；未做观远认证态真实查询，未发布生产、未 commit、未 push。

### Phase 3K：PC 打铁共享下钻、导出、视觉与无障碍回归 — 已完成并发布测试 Super App

**目标：** 完成 v1.70 的组织下钻、返回、分页、导出、响应式、浅深主题、键盘/ARIA 和五态验收。此阶段把“打铁指标”纳入现有组织表现区完整闭环，但不改变已完成销售、过程、目标和车系能力。

**交付内容：**
- 将“打铁指标”接入现有 `viewLevel/drillPath`、范围文案、返回上一级、页面分页和组织行序。组织骨架复用无车系 `processBaselineData` / 过程基线有效组织集合，并沿用 `OrganizationView` 同层级排序规则；共享行序不要求具体车系筛选后销售概览与打铁指标行数或成员完全一致。总部支持大区→小区→门店；大区角色支持小区→门店；小区、销售总监、投资人直接门店；上游具体大区/小区/门店继续自动跳层。
- 操作列按层级沿用“查看小区 / 查看门店 / 门店详情”；门店详情复用既有跳转参数。
- 复用现有 PC 导出入口：一级 Tab 为“打铁指标”时，导出当前激活二级组、当前 `viewLevel/drillPath` 范围内全部组织行，非仅当前 15 行分页；导出行序与页面同一打铁组织骨架排序一致，不新增第二个导出按钮。
- 补齐五态 UI：加载骨架、百分比值、`--`、`0.0%`、`数据不完整`；快速切一级 Tab、二级组、分页、返回时旧请求不得覆盖新状态。
- 完成 1280px/1440px 浅色/深色视觉回归，以及一级 tab、二级切换、返回、分页、操作列和导出的键盘/ARIA 验收。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/organization-view.js`、`multi-store-super-app/iron-metrics-api.js`、`multi-store-super-app/iron-metrics-model.js`、`multi-store-super-app/iron-metrics-view.js`、`multi-store-super-app/iron-metrics.css`、`multi-store-super-app/package.json`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/iron-metrics-drill-export.spec.js`、`multi-store-super-app/validation/iron-metrics-a11y-visual.spec.js`、`multi-store-super-app/validation/syntax-check.mjs`。

**四步门禁：**
1. **Code Review：** 独立核查 AC-170～AC-176：共享下钻不重置、打铁复用无车系过程基线组织骨架、角色入口与自动跳层、操作列、导出当前组当前下钻范围全部组织行、1280/1440 浅深主题、键盘/ARIA、五态和缓存隔离；确认未新增导出按钮、未移动旧导出、未改销售概览/过程分析/负向问题率。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；再执行 `(cd multi-store-super-app && npx playwright test validation/iron-metrics-drill-export.spec.js validation/iron-metrics-a11y-visual.spec.js)`；覆盖总部/大区/小区/销售总监/投资人、上游具体组织自动跳层、邀约/试驾切换不重置、返回、页面分页、导出字段、导出当前下钻范围全部组织行、五态、快速切换和键盘/ARIA。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，均退出 `0`；构建产物不得包含本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；保存 1280px 与 1440px、浅色与深色的“邀约指标 7”和“试驾指标 4”截图，断言 `scrollWidth <= innerWidth`，现有销售概览、过程分析、负向问题率、目标摘要、车系多选、下钻和导出主字段不回归。

**Review → QA → 发布边界：** 四步门禁通过后必须进入独立 Code Review；Review 不通过则修复后重跑四步门禁。Review 通过后进入独立 QA；QA 不通过则修复并重跑四步门禁、Code Review 与 QA。开发阶段不自行发布、不提交、不推送；本轮已在用户明确授权后发布测试 Super App，仍未发布生产、未 commit、未 push。

**停止条件：** 若邀约/试驾切换会重置下钻、导出无法区分当前二级组、角色入口与现有 `viewLevel/drillPath` 冲突、任一来源失败会清空其他指标、键盘/ARIA 无法与可见状态一致，或 1280/1440 浅深主题破坏现有表现区布局，停止并输出失败状态、影响文件和建议收窄路径。

**完成证据（2026-07-22）：** 已完成本地实现、R5 Code Review、独立 QA 与测试 Super App 发布。最终本地基线为 `npm test` 106/106、`npm run test:pc` 58/58、真实静态语法 `npm run lint`、`npm run build`、`npm audit --omit=dev --audit-level=critical` 0 vulnerabilities；生产默认运行时不暴露打铁测试接口；已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、包 `dist.0.1.0.zip`、SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`、大小 `126818` bytes、解包 `30 files / 521802 bytes`）；发布后独立 QA PASS，P0/P1/P2=`0/0/0`；匿名 HEAD/GET 与关键资源仅验证 401/302 登录态边界，未做登录后线上 UI/资源哈希验收；未做观远认证态真实查询，未发布生产、未 commit、未 push。

### Phase 3L：打铁指标永久骨架屏修复 — 已发布测试 App，发布后独立 QA PASS

**目标：** 修复线上测试 App `q0844640cf6734877a3193d6` 中“打铁指标 / 试驾指标 4”永久骨架屏问题。核心改造是把打铁 6 类来源从 all-complete 收敛改为逐来源结算；任一来源完成即局部呈现，任一来源超时、悬挂、业务失败或完整性不可证时 fail-closed 为 `数据不完整`，且不阻塞无关指标。

**交付内容：**
- 调整打铁来源编排：6 类来源独立 settle、独立状态、独立 UI 更新；不再以整表 all-complete 作为展示前置条件。
- 调整加载状态：来源加载中只影响其绑定指标，其他已完成来源立即展示百分比、`--` 或 `0.0%`；旧请求晚返回不得覆盖新上下文。
- 调整失败语义：DCC/意向等单源超时、慢请求、悬挂、业务码失败、字段缺失或截断只标记该来源绑定指标为 `数据不完整`，不得把无关指标回退为骨架或清空。
- 保持业务边界：不改变 11 项公式、数据集、目标提示、二级切换、组织下钻、导出范围、车系边界、销售概览或过程分析。

**关键文件：** `multi-store-super-app/iron-metrics-api.js`、`multi-store-super-app/iron-metrics-model.js`、`multi-store-super-app/iron-metrics-view.js`、`multi-store-super-app/app.js`、`multi-store-super-app/validation/iron-metrics-contract.test.mjs`、`multi-store-super-app/validation/iron-metrics-query.test.mjs`、`multi-store-super-app/validation/iron-metrics-pc-tabs.spec.js`、`multi-store-super-app/validation/iron-metrics-drill-export.spec.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/syntax-check.mjs`。

**四步门禁：**
1. **Code Review：** 核查 all-complete 是否从展示前置条件中移除；逐来源 settle、超时 fail-closed、旧请求防覆盖、缓存键和状态映射是否只影响打铁链路；确认未改销售/目标/过程既有口径、二级切换、导出和移动端。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；必须覆盖任一来源成功先展示、DCC 慢/挂起、意向失败、单源超时、其他来源成功不受影响、`0.0% / -- / 数据不完整` 不混淆、快速切组/分页/筛选下旧请求不覆盖新状态。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build)`，均退出 `0`；构建产物不得包含本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；重点覆盖“打铁指标 / 试驾指标 4”在慢/悬挂 DCC 或意向来源下不再整表骨架，成功来源局部呈现，失败来源显示 `数据不完整`。

**当前验证与测试发布证据（2026-07-22）：** v1.70 原测试计数基线 `npm test` 106/106、`npm run test:pc` 58/58 已漂移；本次修复门禁为 `npm test` 108/108、`npm run test:pc` 61/61、lint Syntax check 42 files、build 通过、audit critical=0。已发布到测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`、包 `dist.0.1.0.zip` SHA-256=`9ef29b84237fb8419492aead99f90a2c82ef7d785bc2e335fbfb75b33ce6cbc0`、大小 `128080` bytes、解包 `30 files / 527758 bytes`）。匿名 HTTP 仅验证到重定向/登录保护的平台边界，不等同于登录态线上 UI 验收。

**Review → QA → 发布边界：** 当前已完成测试 App 发布、最终 Code Review Stage 1/2 PASS（P0/P1=0/0）和发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断）；未完成登录态已发布 UI 冒烟，未完成真实观远指标数据集成验收。未发布生产、未 commit、未 push。匿名 HTTP 只能作为平台登录保护边界记录，不得写成线上 UI 或业务验收通过。

**停止条件：** 如果修复仍依赖 all-complete、单源失败会让整表骨架、旧缓存会覆盖新上下文、超时后无法可靠转为 `数据不完整`、或需要改写指标公式/目标/导出/组织下钻才能绕过问题，停止并回报失败来源、触发路径、影响指标和需确认项。

### Phase 3M：打铁非 DCC 来源 SQL-only 与上游筛选继承 — 待开发

**目标：** 落实 `Product-Spec.md` v1.72 / AC-181～AC-185，只修剩余可 SQL 的 5 个打铁来源 `inviteMention / intentLevel / qualityTrial / trialRecord / trialTalk`。本 Phase 保持 Phase 3L 已完成的逐来源 settle、局部呈现、旧请求防覆盖和 `数据不完整` 状态语义不变；DCC 182 先不动，继续沿用 Phase 3L 后的现状，不把 DCC preview/分页改造纳入本轮。

**交付内容：**
- 将 `inviteMention / intentLevel / qualityTrial / trialRecord / trialTalk` 在允许查询的品牌范围内收敛为 `execute-sql` 服务端聚合：SQL 直接输出组织层级原始分子、分母、比例、来源状态、完整性证据、`query_mode='sql_aggregate'`、`date_field`、`vehicle_series_field` 和 `field_gap_reason`；前端只消费聚合结果，不再拉取 preview 明细、不分页扫描明细、不在 SQL 失败后 fallback 到明细聚合或旧缓存补算。`qualityTrial` 的非 MG 路径是已定义的零 SQL fail-closed，不得为了“5 源全 SQL”伪造查询。
- 严格继承上游查询上下文：5 个来源都使用父应用当前 `startDate/endDate` 闭区间、`regionCode/districtCode/dealerCode` 与罗盘行权限和有效经销商白名单交集、PC 车系多选集合；区域过滤只能用代码字段和白名单交集，不用大区/小区展示名模糊匹配扩大范围。品牌语义中，`qualityTrial` 例外为已验证的 MG 专属数据集：`brand=MG` 或 `brand=全部` 可执行不带虚构品牌条件的 SQL，任一非 MG 品牌在发 SQL 前返回 `数据不完整` 和 `fieldGapReason`，不发 `execute-sql`、不返回 MG 行；其他来源继续按其已审计品牌语义处理。
- 修正试驾类日期字段：`trialRecord / trialTalk` 的 SQL 日期过滤统一绑定展示字段 `试驾接待时间` 对应的已审计物理字段，不再使用不可对齐或历史遗留的日期口径；验收必须证明 `startDate <= 试驾接待时间 <= endDate`。
- 修正 `qualityTrial` 来源：删除不存在的 `品牌` preview 筛选路径，改为服务端 SQL 聚合；已验证其 DS 为 MG 专属且未审计到可 SQL 的品牌字段，因此不得要求或伪造品牌字段 SQL 过滤。仅在 `brand=MG` 或 `brand=全部` 时以真实 SQL 证明组织字段、日期字段、车系字段、`SUM(优质试驾数) / SUM(常规试驾数)` 口径和完整性证据；任一非 MG 品牌必须在调用前以 `fieldGapReason` fail-closed、零 SQL，且不得向该品牌返回 MG 数据。
- 车系按来源级字段审计执行：每个来源只能使用本来源已审计物理车系字段和已确认枚举映射过滤；字段缺失、字段不可查询、枚举无法对齐或映射未确认时，该来源绑定指标 fail-closed 为 `数据不完整` 并输出 `field_gap_reason`，不得返回全部车系数据、不得静默忽略车系条件、不得使用销售 `汇报车系名称` 代理。
- 保持既有表现层：不改变 11 项公式、目标提示、二级切换、组织下钻、导出范围、Phase 3L 逐来源呈现、销售概览、过程分析、移动端或发布配置。导出同样只允许导出 SQL 聚合成功或 fail-closed 状态，不得导出 fallback 数值。
- 聚合性能要求：每个非 DCC 来源在可查询品牌范围内按当前有效组织范围一次或少量可解释 SQL 聚合完成，禁止按门店逐个 preview 分片；`qualityTrial` 的非 MG 品牌保护必须在发 SQL 前终止，不计为 SQL fallback。SQL 返回行数不得触达前端 `5000` 明细上限，超时、业务码失败、行数截断、完整性证据缺失或结果字段缺失均按来源 fail-closed 处理。

**关键文件：** `multi-store-super-app/iron-metrics-api.js`、`multi-store-super-app/iron-metrics-contract.js`、`multi-store-super-app/iron-metrics-model.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/app.js`、`multi-store-super-app/validation/iron-metrics-query.test.mjs`、`multi-store-super-app/validation/iron-metrics-contract.test.mjs`、`multi-store-super-app/validation/iron-metrics-pc-tabs.spec.js`、`multi-store-super-app/validation/iron-metrics-drill-export.spec.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/syntax-check.mjs`。只读依据：`Product-Spec.md`、`docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md`。

**四步门禁：**
1. **Code Review：** 核查本 Phase 只触达 5 个非 DCC 来源；DCC 182 代码路径、过滤、分页和状态不被修改；可查询品牌范围内的 5 个来源均为 `execute-sql` 聚合，禁止 preview fallback；上游日期/组织/车系上下文进入 SQL。`qualityTrial` 必须只在 MG/全部查询，非 MG 必须在 SQL 前以 `fieldGapReason` fail-closed、零 SQL，且不得返回 MG 数据；具体车系缺口 fail-closed；Phase 3L 逐来源局部呈现不回退。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；新增或更新测试覆盖 AC-181～AC-185：5 个来源在可查询品牌范围内的 SQL-only 调用、无 preview 调用、`startDate/endDate` 闭区间、组织代码与白名单交集、车系字段映射成功路径、车系字段缺口 fail-closed、`qualityTrial` 无 `品牌` preview 筛选且 `brand=MG/全部` 可查询、非 MG `fieldGapReason`/零 SQL/无 MG 数据返回、试驾日期字段为 `试驾接待时间`、SQL 失败/超时/截断不 fallback、导出不含 fallback 数值，并保留 Phase 3L 逐来源 settle 测试。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build && npm audit --omit=dev --audit-level=critical)`，均退出 `0`；构建产物不得包含本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；用默认日期、具体 `startDate/endDate`、大区/小区/门店、`brand=MG/全部/任一非 MG`、全部车系与具体车系各验一组，确认非 DCC 来源按 SQL 聚合返回或 fail-closed，`qualityTrial` 非 MG 不发 SQL 且不显示 MG 数值，已完成来源仍局部呈现，导出范围与页面一致，销售概览/过程分析/目标/移动端不回归。

**停止条件：** 任一非 DCC 来源在其允许查询品牌范围内的真实 SQL 查询字段、日期字段、组织代码字段、车系字段或聚合结果无法验证时立即停止，并输出来源、数据集、缺口字段、失败 SQL/业务码和影响指标；不得用 preview 明细、分页 fallback、前端明细聚合、旧缓存、全部车系数据或销售 `汇报车系名称` 绕过。`qualityTrial` 已确认的“MG 专属、无可 SQL 品牌字段”不是要求补造品牌字段的停止条件：MG/全部可查，非 MG 必须 `fieldGapReason` fail-closed 且零 SQL，绝不返回 MG 数据。若修复必须改 DCC 182、必须重写 Phase 3L 逐来源呈现、或必须改变 11 项指标公式/目标/导出/组织下钻，也停止并回报需另立需求。

### Phase 3N：PC 当前范围全部经销商扁平查看 — 已完成，独立 Review 与最终 QA 通过

**目标：** 落实 `Product-Spec.md` v1.73 / REQ-002 / AC-186～AC-198，以及 `docs/superpowers/specs/2026-07-23-当前范围全部经销商扁平查看设计.md`。本 Phase 只作用于 PC 表现区“销售概览 / 过程分析”，让总部、大区或可达下钻层用户在保留真实分层状态的同时，一键查看当前范围内全部可见经销商；不改变打铁指标、顶部指标、上游筛选、权限、移动端或 Phase 3M 打铁 SQL-only 计划。当前已完成本地实现，AC-186～AC-198 全部通过独立 Review 与最终 QA。

**交付内容：**
- 在 `multi-store-super-app/index.html` 的表现区 header 工具区、现有导出按钮左侧新增可逆入口，默认文案 `查看所有经销商`，激活文案 `返回分层查看`；只在“销售概览 / 过程分析”、真实 `organization.viewLevel !== 'store'`、当前有效经销商集合 `>1`、无全局加载/空/错误/无权限且对应过程数据无局部错误时显示。真实 `store` 层、单门店/有效集合 `<=1`、过程局部错误和“打铁指标”Tab 均隐藏该入口。不得把完整文字按钮放入 sticky 操作列表头。
- 在 `multi-store-super-app/app.js` 新增销售/过程共享 `allDealerMode` 页面状态：激活时保存进入前 `organization.viewLevel/drillPath`、销售/过程页码和 `selectedStoreCode` 快照，不改写真实组织状态，仅为销售/过程派生 `effectiveLevel='store'` 并保留当前 `drillPath`；销售/过程扁平态隐藏面包屑返回按钮且返回事件不生效；关闭时恢复快照；上游 URL Query、品牌、日期、大区、小区、经销商或车系上下文变化时清空；销售/过程 tab 切换保留；打铁忽略派生层级但仍显示真实层级，若用户在打铁中合法下钻/返回，销售/过程扁平快照同步到最新真实层级和页码。
- 统一销售/过程 rows 构建、标题、首列、操作、面包屑、分页和导出：销售标题为 `全部经销商销售表现`，过程标题为 `全部经销商过程表现`，首列为 `经销商名称`，操作列仅 `门店详情`，范围文案保留真实组织范围，顶部指标不随扁平清单变化；扁平态销售/过程不显示真实面包屑返回。
- 扁平范围固定为 `上游 URL 筛选 ∩ 罗盘行权限 ∩ 有效经销商白名单 ∩ 当前 drillPath`；可达下钻场景为总部从大区层手动下钻进入某大区小区层（真实 `viewLevel=district`、`drillPath` 仅含该大区）后查看该大区当前可见经销商，真实 `store` 层不触发扁平。数据来源继续使用现有已过滤集合，销售概览用 `state.data.stores`，过程分析用 `processBaselineData.stores`。不得新增数据集、触发新全量查询、绕过权限或用诊断补数扩大范围。
- 扁平模式下订单排名、零售排名、订单占比、零售占比均在当前扁平经销商集合内统一比较和计算，不按经销商所属小区拆分；历史 Phase 3N 完成时排名采用竞赛排名，v1.85 / Phase 3Y 起同一比较集合内改为稳定唯一排名。分页继续每页 15 家，进入扁平模式从第 1 页开始，导出必须包含当前扁平范围全部经销商而非仅当前页。
- 在 `multi-store-super-app/visual-sync.css` 复用现有 export 次按钮、紧凑 header 工具区、浅深主题 token 和响应式规则；覆盖 1280px/1440px 明暗主题及 `<=900px` 响应式，不新增 UI 体系，不挤压表格 sticky 首列/操作列，不产生新增页面级横向溢出。
- 已更新 `multi-store-super-app/validation/organization-view.test.mjs` 与 `multi-store-super-app/validation/pc-role-drilldown.spec.js`，覆盖 AC-186～AC-198，包括 AC-188/190/197/198 的可达路径、可逆状态、入口隐藏和视觉合同；已生成两张精确 `1440x900` viewport 浅色截图：销售扁平态、过程扁平态，未用 fullPage 长图替代。

**关键文件：** `multi-store-super-app/index.html`、`multi-store-super-app/app.js`、`multi-store-super-app/organization-view.js`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/organization-view.test.mjs`（如需）、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/pc-all-dealers-sales-flat-1440x900-light.png`（生成证据）、`multi-store-super-app/validation/pc-all-dealers-process-flat-1440x900-light.png`（生成证据）。只读依据：`Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`docs/superpowers/specs/2026-07-23-当前范围全部经销商扁平查看设计.md`。

**四步门禁：**
1. **Code Review：** 核查入口位置在导出按钮左侧且不进入 sticky 操作列表头；`allDealerMode` 不改写真实 `organization.viewLevel/drillPath`；激活时保存组织/销售页码/过程页码/`selectedStoreCode` 快照；销售/过程扁平态隐藏并冻结面包屑返回；打铁隐藏入口但仍操作真实层级并同步快照；顶部指标、上游筛选、权限白名单、移动端和 Phase 3M 打铁链路不被修改；扁平排名/占比使用当前扁平经销商集合。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；必须覆盖 AC-186～AC-198，包括全国全部经销商、大区全部经销商、总部大区层手动下钻到某大区小区层的可达 AC-188、真实 `store` 层隐藏入口、销售/过程共享、快照恢复、扁平态面包屑返回隐藏且事件不生效、打铁真实下钻/返回后同步扁平快照、上游筛选重置、34 家按 15 条分页、销售/过程导出全部扁平行、统一排名/占比、权限白名单、真实 store/有效集合 `<=1`/过程局部错误/全局五态隐藏入口和无障碍名称。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build && npm audit --omit=dev --audit-level=critical)`，均退出 `0`；构建产物不得包含本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；在 1440×900 浅色主题至少保存销售扁平态和过程扁平态精确 viewport 截图，文件名分别为 `pc-all-dealers-sales-flat-1440x900-light.png`、`pc-all-dealers-process-flat-1440x900-light.png`；如需 fullPage 长图必须另存为补充证据。额外覆盖 1280/1440 浅深主题与 `<=900px` 响应式断言，确认按钮位置、标题、首列、操作列、面包屑/范围文案、分页、导出、返回分层和打铁不回归。

**完成状态（2026-07-23）：** 独立 Review 与最终 QA 通过，本地实现完成，AC-186～AC-198 全部完成；未发布、未 commit、未 push。最终门禁为 `npm test` 117/117、`npm run test:pc` 72/72、lint Syntax check 42 files、build 通过、audit critical=0；销售与过程精确 `1440x900` viewport 浅色截图均已生成。

**继承债（不阻断 Phase 3N）：** 暗色过程表 `metric-value` 对比度另开后续，明确不属于本次 Phase 3N 浅色功能展示回归。P2 的文件过长、过滤逻辑重复、AC-188 旧 DOM 断言、未挂载 `filter-ui` 转义仍为技术债，本次未修，不得把本阶段完成状态解读为这些债务已经清零。

**Review → QA → 发布边界：** 本阶段不发布、不提交、不推送；即使后续 QA 通过，也必须等用户另行明确发布指令。

**停止条件：** 如果实现必须新增数据集、触发新全量查询、绕过罗盘行权限或有效经销商白名单、改写真实 `organization.viewLevel/drillPath`、改变顶部指标、让打铁指标读取扁平派生层级、把按钮塞进 sticky 操作列表头、在真实 `store` 层/有效集合 `<=1`/过程局部错误/全局五态仍显示入口、扁平态仍能通过销售/过程面包屑返回改写真实组织状态、退出无法恢复快照、或在 1280/1440/`<=900px` 出现新增横向溢出，立即停止并输出冲突点、影响 AC 和建议收窄路径，不用隐藏文案、导出当前页、小区分母排名或 fullPage 截图伪装通过。

### Phase 3O：打铁月环比/周环比与 DCC SQL-only — 已发布测试 Super App

**目标：** 落实 `Product-Spec.md` v1.75 / REQ-012 / AC-199～AC-205。给“打铁指标”Tab 的 `邀约指标 7`、`试驾指标 4` 全部 11 项补齐当前值、月环比、周环比三行展示，并让单元格 DOM / CSS 语义对齐“过程分析”；DCC 182 四项改用 ``双品牌DCC话务指标182`` 的服务端 SQL 聚合，彻底移除该来源 preview/分页/fallback；不改变销售概览、过程分析既有指标、11 项公式、目标、二级切换、组织下钻、导出范围、移动端或发布配置。

**交付内容：**
- 扩展打铁数据合同和模型：在现有当前期 SQL-only 聚合基础上，按来源和阶段输出当前、上月同期、上周同期的分子、分母、比率、来源状态、完整性证据和字段缺口；上月同期复用 `previousMonthRange(range)`，上周同期复用 `previousWeekRange(range)`，不得新建官方周/月列。
- 迁移 DCC 182：SQL 输入表固定为 ``双品牌DCC话务指标182``，按 `下发CRM时间` 聚合首跟 60 秒、30 分钟、24 小时三项，按 `日期-门店看板` 聚合 2 天 3 呼；保留 DCC 业务过滤与有效经销商代码白名单，具体车系没有已审计字段时 fail-closed，不得放宽为全部车系。
- 计算 `month_delta_pp = 当前 metric_value - 上月同期 metric_value`、`week_delta_pp = 当前 metric_value - 上周同期 metric_value`，按过程分析同款 `+2.2% / -0.8% / -- / 加载失败` 展示；比率环比是百分点差，不是相对涨跌率。
- 改造打铁表格渲染：单元格使用当前值 + `月环比` + `周环比` 三行结构，维护同类 `metric-cell`、`metric-value`、`metric-trend[data-kind="month|week"]`、`trend-prefix`、`trend-change` 语义；`iron-*` class 仅作命名空间，不新增第二套趋势样式体系。
- 失败隔离：当前期成功但上月或上周失败时，当前值照常展示，仅对应环比显示 `加载失败`；当前期失败时当前值显示 `数据不完整`，两个环比显示 `加载失败`；真实无分母显示 `--`，分母有效且分子为 0 显示/计算 `0.0%`。
- 导出补齐当前值、月环比、周环比及三阶段来源状态/完整性字段；不得导出 preview/fallback 补算值，不新增导出按钮。

**关键文件：** `multi-store-super-app/iron-metrics-api.js`、`multi-store-super-app/iron-metrics-contract.js`、`multi-store-super-app/iron-metrics-model.js`、`multi-store-super-app/iron-metrics-view.js`、`multi-store-super-app/iron-metrics.css`、`multi-store-super-app/app.js`、`multi-store-super-app/validation/iron-metrics-query.test.mjs`、`multi-store-super-app/validation/iron-metrics-contract.test.mjs`、`multi-store-super-app/validation/iron-metrics-pc-tabs.spec.js`、`multi-store-super-app/validation/iron-metrics-drill-export.spec.js`、`multi-store-super-app/validation/iron-metrics-a11y-visual.spec.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/syntax-check.mjs`。只读依据：`Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md` 和“过程分析”当前实现。

**四步门禁：**
1. **Code Review：** 核查三阶段仅日期范围不同，公式、分子分母、去重、日期字段、组织/区域/车系/权限白名单、SQL-only 与完整性门禁同构；DCC 只调用 SQL 新表、无 preview/fallback，且保留日期、组织、业务过滤与车系 fail-closed；销售概览、过程分析、目标语义、二级切换、组织下钻、导出入口和移动端无回归。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；覆盖 AC-199～AC-205，包括两个二级组 11 项三行单元格、`previousMonthRange` / `previousWeekRange`、百分点差、比较期失败隔离、当前期失败、真实无分母、0 分子、过程分析 DOM 语义、DCC 新表 SQL-only / 无 preview 和导出字段。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build && npm audit --omit=dev --audit-level=critical)`，均退出 `0`；构建产物不得包含本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；在 1280px/1440px 浅深主题验证打铁邀约组、试驾组当前值/月环比/周环比可读，目标仍在指标名下方，表格横向滚动容器、导出按钮、二级切换、操作列、销售概览和过程分析均不回归。

**停止条件：** 如果 DCC 新表 SQL 无法返回完整聚合、必须恢复 preview/fallback、必须新增官方周/月绝对值列、必须把销售 `汇报车系名称` 代理到过程来源、必须改变 11 项公式/目标/组织下钻/导出范围，或无法证明比较期失败只影响对应环比，立即停止并输出失败来源、阶段、字段缺口、影响 AC 和建议收窄路径。

**完成证据（2026-07-23）：** 用户已明确授权将会话 `019f87af-fc4d-7650-8ba5-b82f9a40fd55` 与本次调整合并发布。发布前 `npm test` 119/119、`npm run test:pc` 74/74、lint、build、audit critical=0、`dist/` 隐私扫描和旧 DCC 表名清零均通过。已执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，平台回执 `operation=update`、版本 `0.1.0`；发布包 `dist.0.1.0.zip` SHA-256=`293a24705b23f9c3354e91cf196f6236b8b4f7563da0d86d05e80aefc26fe520`、大小 `136515` bytes、31 files。压缩包内含 `20260723-iron-sql5`、`20260723-iron-compare2` 与新表 ``双品牌DCC话务指标182``，不含旧表名；线上入口重定向后 HTTP 200。未发布生产、未 commit、未 push；未执行登录态线上业务数据 UI 验收。

### Phase 3P：PC 销售概览行内四率双层漏斗 — 已完成本地实现与 Review/QA 功能门禁

**目标：** 落实 `Product-Spec.md` v1.76 / REQ-002 / AC-206～AC-213。仅在 PC “销售概览”表第二列 `销售结果（指标：月环比）` 中增加下层四率，形成上层五段数量、下层四率的双层单元格；不改变顶部销售/过程指标卡、过程分析、打铁指标、订单表现、零售表现、主问题、结果断点、操作列、数据查询、导出字段、移动端或发布配置。

**依赖：** Phase 3C 销售漏斗原始分子分母、Phase 3G 车系筛选销售事实联动、Phase 3N 全部经销商扁平查看、`docs/superpowers/specs/2026-07-23-sales-row-conversion-rates-design.md`、`Product-Spec.md` v1.76。

**交付内容：**
- 在 `app.js` 中让销售概览行对象基于 `row.current` 与 `row.previous` 计算四个行内转化率：`线索到店率=到店/线索`、`到店试驾率=试驾/到店`、`试驾订单率=订单/试驾`、`交付率=零售/订单`；月环比为当前率减上月同期率的百分点差，不使用相对涨跌率。
- 行粒度继承当前销售概览：大区、小区、门店、全部经销商扁平视图和投资人门店集合均先聚合原始线索、到店、试驾、订单、零售，再计算四率；车系多选仍只通过销售事实字段 `汇报车系名称` 影响 `row.current / row.previous`。
- 在销售结果单元格渲染上层五段数量及数量月环比，下层四个等宽转化率及百分点月环比；分母有效且分子为 0 显示 `0.0%`，分母为 0 显示 `--`，当前有效但上月同期分母为 0 时月环比显示 `--`，销售主链路错误复用现有表格状态。
- 在 `visual-sync.css` 中实现约 108px～120px 行高、上下层主次层级、下层四等分、浅深主题 token、短标签和完整可访问名称；PC 1280px/1440px 不新增页面级横向溢出。
- 补齐对应验证：公式、百分点差、`0.0% / -- / 错误` 语义、行粒度聚合、扁平/投资人/车系场景、顶部卡第四项 `线索订单率` 与表内第四率 `交付率` 的差异、导出字段不变、1280px/1440px 浅深主题视觉与可访问性。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/sales-row-conversion-rates.test.mjs`。

**四步门禁：**
1. **Code Review：** 核查实现范围仅限销售概览第二列渲染与行内四率计算；公式、顺序、百分点月环比、行粒度聚合、`0.0% / -- / 错误` 语义、表内交付率与顶部线索订单率差异均符合 AC-206～AC-213；确认顶部卡、过程分析、打铁、订单/零售表现、主问题、结果断点、导出字段、数据查询和移动端无回归。
2. **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；覆盖四率公式、上月同期分母为 0、分子为 0、无分母、销售链路错误、扁平视图、投资人集合、车系筛选和导出字段不变。
3. **编译：** 执行 `(cd multi-store-super-app && npm run lint && npm run build && npm audit --omit=dev --audit-level=critical)`，均退出 `0`；不得新增依赖，不得在构建产物中写入本地绝对路径、API key、`.env/.pem/.key/credential` 等敏感内容。
4. **功能：** 执行 `(cd multi-store-super-app && npm run test:pc)`；在 1280px/1440px 浅色和深色主题验证双层单元格行高约 108px～120px、下层四等分、短标签可读且有完整可访问名称、页面级无新增横向溢出，主问题、结果断点和操作列仍可读。

**停止条件：** 如果实现需要修改 `data-api.js`、`metrics.js`、`organization-view.js`、导出协议、顶部指标卡、过程分析、打铁指标、移动端、数据查询或新增依赖，先停止并回到上游文档重新评估范围；如果行内四率只能通过平均门店率、复用顶部格式化值、把表内第四率改为线索订单率、或新增表格列/交互/导出字段才能实现，也必须停止。

**完成证据（2026-07-23）：** 实现范围为 `multi-store-super-app/app.js`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/sales-row-conversion-rates.test.mjs`。首次 Code Review 发现 1280px 视口右侧裁切 `41.6px`、上月同期可比率为 `0.0%` 时被误判为 `--`，均已修复；复跑 Stage 1/2 PASS，P0/P1/P2=`0/0/0`。最终 QA 在临时副本复跑 Node `126/126`、PC `82/82`、lint Syntax check `45 files`、build exit `0`、audit critical=`0`，功能与视觉门禁均通过；首次 QA 唯一 P2 为文档状态不一致，本次已闭环修正。未发布、未 commit、未 push。

### Phase 3Q：PC 打铁指标当前范围全部经销商扁平查看 — 最终本地 QA PASS，已发布测试 App

**目标：** 落实 `Product-Spec.md` v1.77 / REQ-002 / REQ-012 / AC-214～AC-225。把 Phase 3N 已完成的“当前范围全部经销商”从销售概览/过程分析扩展到“打铁指标”；不改变顶部指标、销售概览行内四率、过程分析、打铁 11 项公式/目标/SQL-only/车系字段 fail-closed、DCC 新表、移动端或发布配置。

**依赖：** Phase 3N 共享 `allDealerMode` 和快照机制、Phase 3K 打铁共享下钻与导出、Phase 3O 打铁三阶段环比与 DCC SQL-only、`docs/superpowers/specs/2026-07-23-当前范围全部经销商扁平查看设计.md` v1.77、`docs/superpowers/specs/2026-07-22-打铁指标PC展示与下钻设计.md` v1.77。

**交付内容：**
- 在表现区 header 工具区复用同一“查看所有经销商 / 返回分层查看”入口；当一级 Tab 为“打铁指标”且真实非 `store` 层、当前有效经销商集合 `>1`、无全局/打铁局部阻断状态时显示，位置仍在导出按钮左侧，不进入 sticky 操作列表头。
- 扩展 `allDealerMode` 快照：进入时保存 `organization.viewLevel/drillPath`、销售页码、过程页码、打铁页码、打铁二级组和 `selectedStoreCode`；退出时恢复。上游品牌、日期、区域、经销商、车系或 iframe Query 变化清空；一级 Tab 切换和打铁二级组切换保留。
- 打铁扁平态基于既有 `ironStores` / 无车系 `processBaselineData` 组织骨架派生 `effectiveLevel=store`，范围为 `上游 URL 筛选 ∩ 罗盘行权限 ∩ 有效经销商白名单 ∩ 当前 drillPath`；不得使用销售 `汇报车系名称` 过滤后的销售行集，不新增全量查询或绕过权限。
- 打铁扁平态标题为 `全部经销商打铁表现`，首列为 `经销商名称`，操作列只保留 `门店详情`；组织下钻和面包屑返回隐藏且事件不生效。切换 `邀约指标 7 / 试驾指标 4` 只切换指标组，不改变扁平范围、页码或入口文案。
- 导出复用现有 PC 导出入口：打铁扁平态导出当前激活二级组在当前扁平范围内全部经销商行，非仅当前 15 行分页；字段沿用 Phase 3O 的当前值、月环比、周环比、来源状态和完整性字段。
- 补齐验证：入口显隐、全国/大区/当前 `drillPath` 范围、三 Tab 共享、二级组切换、快照恢复、扁平态禁用下钻、导出全部扁平行、权限白名单、无新数据源、1280/1440 浅深主题和键盘/ARIA。

**关键文件：** `multi-store-super-app/index.html`、`multi-store-super-app/app.js`、`multi-store-super-app/iron-metrics-view.js`、`multi-store-super-app/iron-metrics-model.js`、`multi-store-super-app/iron-metrics.css`、`multi-store-super-app/validation/iron-metrics-drill-export.spec.js`、`multi-store-super-app/validation/iron-metrics-a11y-visual.spec.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/organization-view.test.mjs`（仅当共享行构建契约被触及时）。

**四步门禁：**
1. [x] **Code Review：** 已核查打铁入口位置、共享 `allDealerMode`、快照字段、二级组保留、打铁扁平行集、组织下钻禁用、导出全量扁平行、顶部指标和打铁 11 项口径不变；快照恢复、当前二级组阻断、打铁骨架、真实截图、ARIA 和 CSV 三阶段对齐已修复闭环，Stage 1/2 PASS。
2. [x] **测试完整性：** `(cd multi-store-super-app && npm test)` 126/126，打铁导出专项 5/5；AC-214～AC-225 的状态机、范围、导出、权限白名单及 Phase 3N/3O 回归均通过。
3. [x] **编译：** `(cd multi-store-super-app && npm run lint && npm run build && npm audit --omit=dev --audit-level=critical)` 均通过，lint Syntax check 45 files、build exit 0、audit critical=0；未新增依赖，构建与安全门禁为绿。
4. [x] **功能：** `(cd multi-store-super-app && npm run test:pc)` 85/85；1280px/1440px 浅深主题、入口、二级切换、操作列、导出、返回分层和无障碍均通过，真实截图为 `validation/pc-all-dealers-iron-flat-1440x900-light.png` 与 `validation/pc-all-dealers-iron-flat-1440x900-dark.png`。

**最终本地 QA：** PASS，0 阻断；Phase 3Q 本地交付完成。

**测试发布与线上验证：** 已发布测试 Super App `q0844640cf6734877a3193d6`，URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；`environment=test`，平台命令 exit 0，`operation=update`、版本 `0.1.0`。包 SHA-256=`e5c138b0549a6eb2b91b89964efb417b0d63ae476e447c3dd8c189bc73518807`、`138887` bytes、`31 files / 578408 bytes` 解包，平台发布成功且包信息正确。发布后独立 QA 仅有限 PASS：Chrome 登录态非白屏且三张 Tab 可见；standalone 缺人员画像，未完成“查看所有经销商”登录态业务 UI 终验，不声称完整线上 QA PASS，当前不建议回滚。未发布生产、未 commit、未 push。

**停止条件：** 如果实现必须新增打铁数据集、触发新全量查询、改写真实 `organization.viewLevel/drillPath`、使用销售车系过滤后的销售行集补齐打铁行、改变 11 项公式/目标/SQL-only/车系 fail-closed、恢复组织下钻、只导出当前页或新增第二个导出按钮，立即停止并输出冲突点、影响 AC 和建议收窄路径。

### Phase 3R：PC 打铁指标固定运营看板链接 — 已发布测试 App

**目标：** 落实 `Product-Spec.md` v1.78 / REQ-012 / AC-226。仅在 PC “打铁指标”模块二级 Tab `邀约指标 7 / 试驾指标 4` 右侧新增固定链接“打铁运营看板”；不移动现有二级 Tab、表格、导出入口或一级 Tab，不改变打铁 11 项取数、筛选、下钻、扁平态、分页或导出范围。

**依赖：** Phase 3J 已完成的打铁二级切换 DOM/ARIA，Phase 3Q 已完成的打铁扁平态入口与工具区布局，`Product-Spec.md` v1.78。

**交付内容：**
- 在打铁指标二级切换行右侧新增唯一外链，文案固定为“打铁运营看板”，URL 固定为 `https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845`。
- 外链继承现有页面轻量工具/链接样式，与二级 Tab 同行；不得改变 `邀约指标 7 / 试驾指标 4` 顺序、默认激活、选中态、键盘语义或表格起始位置。
- 点击建议使用新窗口打开；实现为 `<a>` 时必须包含 `target="_blank"` 和 `rel="noopener noreferrer"`，避免当前 Super App iframe 被外链替换。
- 链接不读写任何业务状态，不进入查询参数、缓存键、埋点、导出字段或打铁数据模型。

**关键文件：** `multi-store-super-app/iron-metrics-view.js`、`multi-store-super-app/iron-metrics.css`、`multi-store-super-app/validation/iron-metrics-pc-tabs.spec.js`、`multi-store-super-app/validation/iron-metrics-a11y-visual.spec.js`。

**四步门禁：**
1. [x] **Code Review：** PASS，P0/P1/P2=`0/0/2`；外链 URL、文案、位置、`target/rel` 安全属性和最小改动通过审查，未触碰打铁查询、导出、一级 Tab、二级 Tab 状态机、扁平态或移动端。两项 P2 均非阻断，其中既有 `validation/iron-metrics-query.test.mjs` 424 行拆分债本轮不拆。
2. [x] **测试完整性：** `(cd multi-store-super-app && npm test)` 126/126；AC-226 的链接存在、固定 href、新窗口安全属性及切换邀约/试驾后状态不变均通过。
3. [x] **编译：** lint Syntax check 45 files、build 通过、`npm audit --omit=dev --audit-level=critical` critical=0、隐私扫描通过；未新增依赖。
4. [x] **功能：** `(cd multi-store-super-app && npm run test:pc)` 86/86；1280px/1440px 浅色与深色截图通过，链接位于二级 Tab 右侧且未挤压既有控件。

**完成状态：** Phase 3R 已发布测试 Super App `q0844640cf6734877a3193d6`，`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；发布包 `dist.0.1.0.zip` SHA-256=`6f59891701ed953f8cd95173d1639cb99c90b318137cb3035a14ae06cfb7fd22`、`139391` bytes、`31 files`。发布后独立 QA PASS，P0/P1/P2=`0/0/0`；匿名入口 302/401 仅表示登录保护，未做登录态线上业务 UI 验收。未发布生产、未 commit、未 push。

**停止条件：** 如果实现需要移动现有二级 Tab、表格、导出入口或一级 Tab，或需要改写打铁状态机、查询、导出、筛选、分页、扁平态、移动端、发布配置或新增依赖，立即停止并回到需求确认。

### Phase 3S：PC 打铁指标优质试驾看板链接 — 已随测试 App 发布

**目标：** 落实 `Product-Spec.md` v1.80 / REQ-012 / AC-235。仅在 PC “打铁指标”模块二级 Tab `邀约指标 7 / 试驾指标 4` 右侧工具栏新增第二个固定外链“优质试驾看板”，放在已完成“打铁运营看板”右侧；两个外链均保留，不改变打铁 11 项取数、筛选、下钻、扁平态、分页、导出、一级 Tab、二级 Tab 状态或 v1.79 销售经营进度条。

**依赖：** Phase 3R 已完成的外链组件、轻量外链样式和安全打开合同；Phase 3J 已完成的打铁二级切换 DOM/ARIA；Phase 3Q 已完成的打铁工具区布局。独立于 v1.79 `REQ-013 / AC-227～AC-234`，不得把销售经营进度条顺手实现或标完成。

**交付内容：**
- 在打铁指标二级切换行右侧同一工具栏保留“打铁运营看板”，并在其右侧新增“优质试驾看板”；顺序固定为 `打铁运营看板 → 优质试驾看板`。
- “优质试驾看板”URL 固定为 `https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa`，必须原样保留 `pgId` 和 `id` 查询参数。
- 两个外链均实现为 `<a target="_blank" rel="noopener noreferrer">`，点击新窗口安全打开，当前 Super App iframe 不导航离开。
- 外链复用 Phase 3R 轻量样式和工具栏布局；1280px/1440px 浅色、深色主题下不得挤压二级 Tab，不造成页面级横向溢出或文字截断；键盘可聚焦/触发且可见 focus。
- 切换邀约/试驾、点击任一外链均不得读写或重置 `activeMetricGroup`、一级 Tab、组织层级、`drillPath`、`allDealerMode`、分页、车系筛选、数据查询、导出、缓存键或埋点上下文。

**关键文件：** `multi-store-super-app/index.html`、`multi-store-super-app/iron-metrics-view.js`、`multi-store-super-app/iron-metrics.css`、`multi-store-super-app/validation/iron-metrics-pc-tabs.spec.js`、`multi-store-super-app/validation/iron-metrics-a11y-visual.spec.js`、`multi-store-super-app/validation/iron-metrics-query.test.mjs`。

**四步门禁：**
1. [x] **Code Review：** 初审 PASS P0/P1/P2=`0/0/2`，两项 P2 均为测试强度；补测后复审最终 PASS P0/P1/P2=`0/0/0`。已确认两个外链共存与固定顺序、URL 查询参数完整、`target/rel` 安全属性、无状态污染、未触碰查询/导出/筛选/分页/移动端/v1.79 经营进度条。
2. [x] **测试完整性：** `(cd multi-store-super-app && npm test)` 126/126；定向 pc-tabs 10/10。专项覆盖“优质试驾看板”链接存在、固定 href、完整 `pgId/id`、新窗口安全属性、键盘 `Tab → Tab → Enter`、切换邀约/试驾后两个外链仍存在且状态不变、非默认 `vehicleSeries=全新MG4` + `allDealerMode=true` 状态不污染。
3. [x] **编译：** lint Syntax check 45 files、build PASS、`npm audit --omit=dev --audit-level=critical` audit 0、敏感扫描 0、`git diff --check` PASS；未新增依赖。既有 Vite classic script 与 `NO_COLOR` warning 非阻断。
4. [x] **功能与视觉 QA：** `(cd multi-store-super-app && npm run test:pc)` 87/87；8 张现有 iron-metrics 邀约/试驾 1280px/1440px 浅色与深色截图已刷新并通过，两个外链不挤压二级 Tab、不造成页面级横向溢出、文字不截断、focus 可见。

**完成状态：** AC-235 已关闭，并随北京时间 `2026-07-23 16:49:52` 的同一测试 App 包发布至 `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`）；发布包 `dist.0.1.0.zip` SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`、`139940` bytes、`31 files / 583411 bytes`。未发布生产、未 commit、未 push，不生成设计文件。

**停止条件：** 如果实现需要新增打铁数据、改指标口径/SQL/数据集/权限，移动二级 Tab、表格、导出入口或一级 Tab，改写 `activeMetricGroup`、`allDealerMode`、`drillPath`、分页、筛选、查询、导出或发布配置，或触碰 v1.79 销售经营进度条实现，立即停止并回到需求确认。

### Phase 3T：PC 销售经营进度条与时间进度 — 已完成并发布测试 App

**目标：** 落实 `Product-Spec.md` v1.79 / REQ-013 / AC-227～AC-234 和已批准的方案 A。仅重排 PC 顶部销售总览：把既有订单/零售目标摘要从“销售指标”标题行迁移到销售指标、过程指标两个并排模块上方的独立“销售经营进度”条，并新增只表达当月日历进度的“时间进度”；不改变目标链路或任何业务指标口径。

**依赖：** Phase 3H 已完成的 REQ-011 订单/零售双目标、双达成及隐藏/失败状态；Phase 3F.3 已完成的七张顶部指标卡与卡内两行环比；视觉事实源为 `docs/superpowers/specs/2026-07-23-sales-time-progress-layout-design.md`。本阶段与 Phase 3S 文件和功能边界独立，不覆盖或改变 Phase 3S 状态。

**交付内容：**
- 在销售指标、过程指标两个并排模块上方新增独立“销售经营进度”条，内容顺序固定为 `订单目标 → 订单达成 → 零售目标 → 零售达成 → 时间进度`；销售指标与过程指标模块内部恢复为仅标题 + 指标卡。
- 时间进度严格按页面运行时当前自然日计算：`今天日期序号 / 当月天数 * 100%`，展示 1 位小数；每月 1 日按 `1 / 当月天数` 展示，月末展示 `100.0%`。不得读取父应用筛选 `endDate`、目标实际统计窗口、工作日或完整已过天数。
- 时间进度使用中性灰蓝，不使用红色、绿色、箭头、达标标签、状态圆点或填充进度条；订单/零售目标继续使用既有蓝色语义，订单/零售达成继续使用既有绿色语义。
- 经营进度条整体复用 REQ-011 状态：无目标、跨月、未来月、非 MG 或目标隐藏时整条隐藏且不得单独展示时间进度；目标请求失败、无权限或业务码失败时，在经营进度条位置显示既有“月目标数据暂不可用”类文案，销售卡、过程卡和销售主链路继续展示。
- 销售指标 3 张卡与过程指标 4 张卡保持同起点、同高、同水平基线；七张卡仍只展示当前值、月环比、周环比，月环比与周环比继续上下两行。1280px/1440px 浅色与深色主题下，仅允许经营进度条内部自然换行，不得造成页面级新增横向溢出、任一模块单独加高或空白占位。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`；仅当浏览器缓存版本必须刷新时修改 `multi-store-super-app/index.html` 的现有静态资源版本。不得修改其他源码、测试、数据合同或移动端文件。

**四步门禁：**
1. [x] **Code Review：** Stage 1/2 PASS；AC-227～AC-234 全部通过，P0/P1=`0/0`，范围未触及数据源、目标计算、表格、导出、过程链路或移动端。
2. [x] **测试完整性：** Node 126/126；固定五项顺序、运行日/筛选日解耦、月初/月末、整体隐藏/失败提示和七张卡两行环比均已覆盖。
3. [x] **编译：** lint Syntax check 45 files、build PASS、audit 0、隐私扫描通过；source/dist 的 `app.js` 与 `visual-sync.css` SHA-256 一致。
4. [x] **功能与视觉 QA：** PC 89/89，最终 QA PASS，P0/P1=`0/0`；1280/1440 浅色、深色四张截图通过，对比度浅色 target/achievement/time=`6.83/5.48/5.10`、深色=`8.43/10.13/8.69`。

**完成状态：** 已完成开发、Code Review Stage 1/2、最终 QA 与测试 App 发布。测试 App `q0844640cf6734877a3193d6` 平台回执 `operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`；发布包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`、`139940` bytes、`31 files / 583411 bytes`。匿名 401 只证明登录保护；Chrome 父应用自动 DOM/截图持续超时，未完成登录态线上 UI 验收。未发布生产、未 commit、未 push。

**停止条件：** 如果实现需要新增或修改数据源、目标自然键、目标实际 SQL、订单/零售目标或达成计算、表格、导出、过程指标取数/链路、筛选、下钻、移动端、发布配置或新依赖，或无法保证失败/隐藏状态下时间进度不单独出现，立即停止并回到需求确认。

### Phase 3U：PC 首屏销售渲染与目标异步解耦 — 已完成并发布测试 App

**目标：** 落实 `Product-Spec.md` v1.81 / `REQ-013 / AC-236～AC-242`。修复月目标请求硬阻塞首屏的问题：销售事实、车系枚举和有效组织范围完成后立即渲染真实销售指标、过程指标、销售概览表和可用组织行；月目标独立后台加载并局部回填目标区域。

**交付内容：**
- 拆分 `loadSalesRaw` 首屏完成条件：主链路只等待销售事实、车系枚举和有效组织范围；`loadMonthlyTargetRaw` 不得阻塞全局 `state.loading` 解除。
- 为月目标建立独立 pending/success/error 状态；pending 只显示在经营进度条和表格目标槽，success 局部回填目标摘要、目标槽和导出目标字段，error 只显示目标暂不可用类状态。
- 销售主链路与目标后台链路共用 `loadToken` / generation；旧目标响应晚到必须丢弃。
- 目标 preview 可下推 `areaCode -> rfs_code`、`districtCode -> mac_code`、`dealerCode -> dealer_code` 组织条件；该条件只用于减少读取量，不改变目标归属和业务口径。字段映射无法证明时跳过下推，但首屏解耦仍必须完成。

**关键文件：** `multi-store-super-app/data-api.js`、`multi-store-super-app/app.js`、`multi-store-super-app/validation/monthly-target.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`。不得修改目标 DS、目标自然键、目标实际 SQL、有效经销商维表归属、车系集合、自然月窗口、导出字段、过程指标、打铁指标、移动端或发布配置。

**四步门禁：**
1. [x] **Code Review：** Stage 1/2 PASS；AC-236～AC-242 覆盖完整，P0/P1/P2=`0/0/2`，未改变目标、销售、过程口径。
2. [x] **测试完整性：** `npm test` 130/130；覆盖目标 pending 不阻塞销售、目标成功局部回填、目标失败不回退全局 loading、旧目标响应丢弃、组织条件下推和无下推 fallback。
3. [x] **编译：** lint Syntax check 45 files、`npm run build` PASS、audit critical=0 通过。
4. [x] **功能与视觉 QA：** `npm run test:pc` 95/95；最终 QA 功能门禁通过，覆盖默认全域和 SMG310 类组织筛选场景；1280px/1440px 浅深主题通过。

**完成状态：** 已完成本地开发、Code Review Stage 1/2、最终 QA 功能门禁与测试 App 发布。发布命令重新构建并重打包后成功更新测试 App `q0844640cf6734877a3193d6`：`operation=update`、版本 `0.1.0`、`artifact=dist.0.1.0.zip`、`fileKey=1d9e70c3-938c-409d-b4e0-e1be26035edc`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。最终 zip SHA-256=`3125ba0859ff122ba05aa2029eab924d2a7dbe2ab689f4a079b5104aa1810359`，zip 完整性与关键四文件 source/dist/zip 三方哈希一致性均通过。未发布生产、未 commit、未 push。

**停止条件：** 如果实现需要改目标数据集、目标自然键、订单/零售目标实际 SQL、目标归属来源、车系集合语义、自然月窗口、导出字段、销售/过程主指标口径、打铁指标、移动端或发布配置，立即停止并回到需求确认。

### Phase 3V：PC 销售总览标题行目标摘要 — 已发布测试 App，发布后独立 QA PASS

**目标：** 落实 `Product-Spec.md` v1.82 / `REQ-013 / AC-243～AC-250` 与 `docs/superpowers/specs/2026-07-24-sales-target-header-inline-layout-design.md`。将 PC 目标摘要从销售/过程指标上方的独立经营进度通栏迁入“销售总览”标题行中间，形成固定三段 `销售总览｜目标摘要｜车系筛选`；下方直接进入销售指标和过程指标，保持两组指标同起点、同高、卡片同水平基线。

**Spec / 设计映射：**
- AC-243：`renderFunnelOverview` 输出结构改为标题行内三段，删除 `#funnelGrid > .sales-target-summary` 独立通栏位置。
- AC-244：标题行中间五项顺序固定为 `订单目标 → 订单达成 → 零售目标 → 零售达成 → 时间进度`；目标蓝、达成绿、时间灰蓝。
- AC-245：五项为纯文字行内辅助信息，不使用胶囊、边框、背景、阴影、状态圆点、箭头、达标标签或进度条填充。
- AC-246：1280px、1366px、1440px 浅色和深色主题均单行完整展示，不隐藏、不换行、不截断，不新增页面级横向滚动；车系筛选仍可点击使用。
- AC-247：摘要展示或隐藏时，下方销售/过程指标模块起点、高度和卡片基线不变，不用空槽、加高销售模块或改变卡片内容做视觉对齐。
- AC-248：目标 pending 时标题行中间显示五段行内骨架；销售指标、过程指标、销售概览表和可用组织行继续继承 v1.81 先行展示真实数据。
- AC-249：无目标、跨月、未来月、非 MG 或目标按 REQ-011 隐藏时，中间摘要整体不渲染且不留空，不单独展示时间进度。
- AC-250：目标请求失败、无权限、业务码失败或超时时，中间仅显示 `月目标数据暂不可用`；表格目标槽、导出、筛选、移动端和数据链路边界保持既有口径。

**依赖与非目标：**
- 依赖 Phase 3T 已完成的五项内容、时间进度公式、目标显隐/失败状态和销售/过程卡基线；依赖 Phase 3U 已完成的目标异步解耦，月目标 pending/error 不阻塞主销售/过程链路。
- 依赖 Phase 3D / 3G 的唯一 `#vehicleSeriesFilter` 应用级右侧位置、车系多选 URL 与目标联动合同。
- 本阶段仅改 PC 顶部销售总览呈现与对应自动化，不改目标数据源、目标自然键、订单/零售目标实际 SQL、目标计算、有效经销商维表、自然月窗口、销售/过程指标公式、表格目标位、导出字段、筛选合同、移动端、发布配置或依赖。
- 不得混入 Phase 3W / v1.83 的过程标签两波加载和渲染预算修复；Phase 3W 当前状态保持本地修复、独立 Code Review 与最终 QA PASS。

**实际交付：**
- 在 `multi-store-super-app/app.js` 将 `targetSummary(monthlyTarget)` 从 `funnel-overview-header` 后方独立节点迁入标题行中间：左侧 `h2`，中间目标摘要，右侧 `renderVehicleSeriesFilter()`；隐藏状态不输出中间摘要 DOM，失败状态只输出 `月目标数据暂不可用`。
- 将目标摘要的 `aria-label` 从独立“销售经营进度”改为标题行目标摘要语义；loading 骨架仍为 5 段行内骨架，但不使用独立 section 通栏尺寸，不撑高标题行。
- 在 `multi-store-super-app/visual-sync.css` 重写 `.funnel-overview-header` 与 `.sales-target-summary` 的 PC 布局：三段同一行，标题和车系筛选固定可读/可操作宽度，中间摘要 `min-width: 0` 但五项在 1280px 及以上完整单行；移除独立摘要的边框、背景、阴影、圆角和通栏 padding。
- 补齐浅色/深色颜色 token：订单/零售目标沿用目标蓝，订单/零售达成沿用达成绿，时间进度使用灰蓝；对比度不得低于现有目标摘要门禁。
- 在 `multi-store-super-app/validation/pc-role-drilldown.spec.js` 更新目标摘要 DOM 断言：定位从 `#funnelGrid > .sales-target-summary` 改为 `.funnel-overview-header .sales-target-summary`，断言标题、摘要和车系筛选为同一标题行三段，且 `.metric-panel .panel-head` 与 `#funnelGrid > .sales-target-summary` 均无目标摘要。
- 扩展 PC 视觉回归到 `1280 / 1366 / 1440 × 900` 的 light/dark 六组截图，覆盖 success、loading、hidden、error 四态；保留表格目标槽、导出目标字段、车系多选、组织下钻、销售/过程主数据先行和 Phase 3W 过程加载相关用例不回归。
- 仅当静态资源缓存必须刷新时修改 `multi-store-super-app/index.html` 已有 `app.js` / `visual-sync.css` query 版本；不改 HTML 结构入口、脚本加载方式或移动端入口。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`；必要时仅修改 `multi-store-super-app/index.html` 的既有静态资源版本。不得修改 `data-api.js`、`metrics.js`、`filter-ui.js`、`organization-view.js`、目标测试数据源合同、移动端、构建配置、发布配置或依赖。

**验收清单：**
- [x] 1280px、1366px、1440px PC 视口下，标题行均为 `销售总览｜目标摘要｜车系筛选` 三段同一行，五项目标摘要完整可读且车系筛选可点击。
- [x] success 状态五项顺序、文案和颜色正确：订单目标、订单达成、零售目标、零售达成、时间进度；无胶囊、边框、背景、阴影、箭头、状态点或进度条。
- [x] loading 状态标题行中间显示 5 段行内骨架，销售指标、过程指标、销售概览表和可用组织行展示真实数据，不等待月目标。
- [x] hidden 状态中间摘要整体不渲染、不留空槽、不显示时间进度；右侧车系筛选和下方指标基线不漂移。
- [x] error 状态中间仅 `月目标数据暂不可用`，销售指标卡、过程指标卡、表格目标槽、导出、筛选、移动端和目标数据链路均保持既有口径。
- [x] 下方销售指标和过程指标同起点、同高、卡片同水平基线；七张卡仍只展示当前值、月环比和周环比。
- [x] 页面级 `document.documentElement.scrollWidth <= window.innerWidth`，`#salesTabPanel` 和标题行自身无新增横向滚动。

**四步门禁：**
1. [x] **Code Review：** Phase 3V 隔离 Review PASS，P0/P1/P2=`0/0/0`；AC-243～AC-250、设计映射、文件边界和 v1.81/v1.83 不回归均通过。
2. [x] **测试完整性：** Phase 3V 隔离 Node `134/134`、PC `97/97`；2026-07-24 最终 QA 冻结快照（含当时并行 AC-258、尚未含后续 Phase 3Y）定向四态 PC `6/6`、Node `137/137`、PC `98/98`。冻结快照全局计数不承诺随共享工作树保持不变。
3. [x] **编译验证：** 隔离 lint/build/audit 通过；上述冻结快照 lint Syntax check `45 files`、build exit `0`、audit `0`，source/dist 的 `app.js` 与 `visual-sync.css` 一致。
4. [x] **功能测试：** 上述冻结快照的 24 张 loading/success/hidden/error × 1280/1366/1440 × light/dark 截图通过；DOM 门禁确认无页面级横向滚动、标题行不换行/不截断且车系筛选可用。AC-258、后续 Phase 3Y 及其他并行改动须各自独立 Review/QA，不纳入 Phase 3V 背书。

**停止条件：** 如果实现需要修改目标数据源、目标自然键、订单/零售目标实际 SQL、目标计算、有效经销商归属、自然月窗口、表格目标槽、导出字段、车系筛选合同、移动端、过程标签加载编排、发布配置或新增依赖，立即停止并回到需求确认；如果 1280/1366/1440 任一浅深组合无法单行完整展示且无横向滚动，也停止，不允许用隐藏、截断、换行或独立通栏规避。

**风险与回滚：** 主要风险是标题、五项目标和车系筛选在 1280px 同行空间竞争，导致摘要挤压、筛选不可用或页面横溢；回滚策略是仅回退 Phase 3V 对 `app.js` / `visual-sync.css` / `pc-role-drilldown.spec.js` / 静态资源 query 的改动，恢复 Phase 3T 独立经营进度条和 Phase 3U 异步语义，不回退目标数据、表格、导出或 Phase 3W 过程加载修复。

**发布状态：** Phase 3V 已随 v1.82～v1.85 共享隔离组合包发布测试 App，发布回执、包哈希、三方同源、发布后 QA 与认证边界见文档顶部最新测试发布记录。未完成登录态业务 UI/真实数据终验，不得声称生产上线或最终用户验收通过；未发布生产、未 commit、未 push。

### Phase 3W：PC 过程标签两波加载与渲染预算修复 — 已发布测试 App，发布后独立 QA PASS

**目标：** 落实 `Product-Spec.md` v1.83 / `REQ-013 / AC-251～AC-257`。修复过程标签 current、previous、week 三阶段串行和重复渲染：current 先行，比较期 previous/week 同波并发；阶段结算后按 token 原子合并和限定刷新，避免过程表、动态诊断和漏斗被重复刷新。

**交付内容：**
- `loadNegativeProcess` 第一波只启动 current × ip/drive 两个高层任务，使用 `Promise.allSettled`；两项未结算前 previous/week 不启动、不提交。
- current 波结算后先校验 token；有效才合并成功 raw 与 `state.processErrors[kind].current`，`buildWorkbench + rebuildIronStores` 各 1 次，`state.processStage=current`，只 `renderProcessComparisonList` 1 次；不得 `renderFunnel` 或 `refreshDynamicDiagnoses`。
- token 仍有效才启动第二波 previous/week × ip/drive 四个高层任务，同波 `Promise.allSettled`；全部结算后再校验 token，原子合并成功 raw 与 `state.processErrors[kind][previous|week]`。
- 第二波合并后 `buildWorkbench + rebuildIronStores` 各 1 次，`state.processLoading=false`、`state.processStage=week`、`state.processError=processErrorMessage()`；只 `renderProcessComparisonList` 1 次、`refreshDynamicDiagnoses` 1 次，不循环尾重复渲染、不 `renderFunnel`。
- 扩展 `validation/process-tags-kind-state.test.mjs`，用受控 deferred Promise 验证加载顺序、并发预算、渲染预算、阶段失败隔离、token 失效和 current 未完成不提交比较期；继续保留既有 SQL/fallback/evidence 断言。
- 同步更新 `validation/pc-role-drilldown.spec.js` 中本次相关 PC 回归用例，把旧 current/previous/week 三波等待适配为 current 2 请求 + comparison 4 请求显式断言，并保留 A→B token 失效导航切换场景。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/validation/process-tags-kind-state.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`。文档同步文件为 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`。`data-api.js`、`metrics.js`、CSS、`index.html`、移动端、发布配置和依赖保持不变；测试修改范围仅限上述 `process-tags-kind-state.test.mjs` 与本次相关 `pc-role-drilldown.spec.js` 用例，其他测试保持不变。构建产物仅允许由 `npm run build` 生成，不手改。

**四步门禁：**
1. [x] **Code Review：** 独立核查 AC-251～AC-257；功能 PASS，无 HIGH；确认 Phase 3W 隔离交付未触碰禁止文件、业务口径或 Phase 3V 范围。两个非阻断 LOW（生产测试全局开关硬化债、比较期 pending 暂显示 `--`）进入后续项，不扩展本次修复。
2. [x] **测试完整性：** `node --test validation/process-tags-kind-state.test.mjs` 8/8；`npm test` 134/134，保留 SQL/fallback/evidence 测试。
3. [x] **编译：** `npm run lint` 通过，Syntax check 45 files；`npm run build` PASS；`npm audit --omit=dev --audit-level=critical` 0 漏洞。QA 快照时 `app.js` 与 `dist/app.js` 整文件 SHA-256 一致；随后并行 v1.82 销售目标摘要 DOM 修改导致当前整文件不同，但 `loadNegativeProcess` 至 `loadIronMetrics` 修复切片 source/dist 仍逐字一致（SHA-256=`1330d39d6e952faa520ddb758656d668bf66a24e1c7713980624a7655123f123`，cmp=0）。
4. [x] **功能测试：** `npm run test:pc` 95/95；其中 `validation/pc-role-drilldown.spec.js` 已覆盖旧三波回归用例适配为 current 2 请求 + comparison 4 请求显式断言，并保留 A→B token 失效导航切换场景。
5. [x] **最终独立 QA 与发布：** 功能 QA PASS，P0/P1/P2=`0/0/0`；Phase 3W 隔离 QA 定向 Node 8/8、相关 Playwright 3/3 通过，QA 独立复跑记录保留相关 Playwright 3/3 与 4/4。随后 Phase 3W 已随 v1.82～v1.85 共享隔离组合包发布测试 App，发布后组合 QA PASS，P0/P1/P2=`0/0/1`；唯一 P2 为 Vite 重写 dist `index.html`，非功能缺陷。发布证据见文档顶部；未发布生产、未 commit、未 push，未做登录态业务 UI 或观远真实环境验收。

**停止条件：** 如果修复需要修改 `data-api.js`、`metrics.js`、过程公式、日期范围、车系、组织权限、顶部四项、打铁、导出、移动端、依赖、发布配置，或无法用行为测试证明 token 失效与两波并发合同，立即停止并输出差异和阻断原因。

### Phase 3X：PC 销售表现排名 CSV Excel 文本保护 — 已发布测试 App，发布后独立 QA PASS

**目标：** 落实 `Product-Spec.md` v1.84 / `REQ-013 / AC-258`。修复 PC 销售表现导出 CSV 被 Excel 直接打开时，将 `订单排名`、`零售排名` 的 `1/7`、`7/7` 自动解析为日期的问题。

**交付内容：**
- 仅对销售表现导出 CSV 的 `订单排名`、`零售排名` 做 Excel 文本保护，Excel 直接打开时可见值仍为 `x/y`。
- 标准 CSV 解析或导入后仍可还原原始 `x/y` 排名语义。
- 保持既有 CSV RFC4180 转义和公式注入防护，不新增文件类型、依赖或导出入口。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`；必要时新增最小 Node 单测。文档同步文件为 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`。

**四步门禁：**
1. [x] **Code Review：** Stage 1/2 PASS，最终 P0/P1/P2=`0/0/0`；已核查 AC-258、字段边界、公式注入防护、RFC4180 与非目标均未回归。
2. [x] **测试完整性：** AC-258 定向 `1/1`，AC-258 + 公式注入/RFC4180 `2/2`，`npm test` `134/134`；已覆盖 `订单排名`、`零售排名` 的 `1/7`、`7/7` 文本保护、实际 CSV 字节与解析语义还原。
3. [x] **编译验证：** lint Syntax check `45 files`、build PASS、audit `0`；发布临时快照内 source/dist `app.js` SHA-256 均为 `3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17`。当前工作区已进入后续并行版本，不等同发布源。
4. [x] **功能测试、发布与发布后独立 QA：** 完整 PC `98/98`；从 `/private/tmp/ac258-build-kTHdjn` 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，最终回执 exit `0`、`operation=update`、`appId=q0844640cf6734877a3193d6`、`version=0.1.0`、URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`，标准回执无 `fileKey`。最终 zip SHA-256=`b58a77a0da195968c801d96ee4a057eed6865f62a437a845f73aafe50b113706`，`141411` bytes、`31 files / 591132` 解包字节，`unzip -t` 通过；zip 内 `app.js` SHA-256=`3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17` 且含 `excelTextRank`，zip 内 `organization-view.js` SHA-256=`36257c5f1ed3613b41260c34092a84b642c4ecd462464c7cac3a19d1ad9d5ee9`，保留 `previousValue/previousRank` 的 v1.84 竞争排名且未带入 v1.85。`settings=test`，测试单店 `r8ce...`、生产回退 `aca...`，隐私扫描 `0`。发布后独立 QA PASS，P0/P1/P2=`0/0/2`，两个 P2 仅为文档同步/边界澄清并已关闭。匿名访问只证明登录保护，未做登录态 UI/线上资源哈希或 Windows Excel 直开实机验收；发布同源只限临时快照 source/dist/zip。未发布生产，未 commit、push。

**停止条件：** 如果实现需要改变排名计算、其他导出列、导出范围、文件类型/依赖、页面 UI、数据查询、移动端、发布配置或削弱公式注入防护，立即停止并回到需求确认。

### Phase 3Y：PC 订单/零售稳定唯一排名 — 已发布测试 App，发布后独立 QA PASS

**目标：** 落实 `Product-Spec.md` v1.85 / `REQ-002 / AC-259～AC-271` 与 `docs/superpowers/specs/2026-07-24-unique-ranking-tiebreak-design.md`。只把 PC 销售概览订单排名、零售排名从竞争排名改为稳定唯一排名：主指标降序，同值按当前层级组织代码升序拆分，连续输出 `1/n ... n/n`，不再出现并列名次或末尾停在同一名次。

**口径边界：**
- 大区、小区、经销商三级都适用；订单排名按订单数，零售排名按零售数，两个指标分别独立计算。
- 比较集合沿用现有 `comparisonKey()` / `peerRows` 逻辑：大区层为全国完整大区集合，小区层为所属大区内小区集合，经销商层为所属小区、投资人 portfolio、当前范围全部经销商扁平集合、当前 `drillPath` 收窄集合或具体门店收窄后的集合。
- 全国完整性不可证时，大区层订单排名和零售排名继续显示 `--`；本阶段不得绕过 `national-scope.js` 的完整性门禁。
- 订单占比、零售占比分母和格式保持当前比较集合合计值，不因唯一名次拆分改变。
- 页面和导出仍只展示 `排名 x/y`，不展示组织代码、并列说明、同值说明、末位人数或 tooltip。

**交付内容：**
- 在 `multi-store-super-app/organization-view.js` 修改 `rankRows()` 名次分配逻辑：保留当前排序中的 `主指标降序 + 组织代码升序`，删除“同值复用上一名次”的竞争排名分支，直接按排序后索引生成 `rankValue = index + 1`。
- 保留 `buildViewRows()` 对 `peerRows` 分别计算 `orderRank`、`retailRank` 的数据流；不得改变 `comparisonKey()`、`rankScope="portfolio"`、`allDealerMode`、`drillPath`、单店 `1/1`、`share`、`totalCount` 或 `rate()` 空值语义。
- 更新 `multi-store-super-app/validation/organization-view.test.mjs`：将既有竞争排名断言改为稳定唯一排名，并新增大区、小区、经销商三级、双指标、全 0、53 对象末尾 `n/n`、portfolio、扁平模式、单店收窄、全国不完整 `--` 和输入顺序扰动稳定性测试。
- 更新 `multi-store-super-app/validation/pc-role-drilldown.spec.js`：补 PC 页面与导出回归，覆盖页面排名值与 CSV 导出排名一致、Excel 文本保护仍有效、当前范围全部经销商扁平模式和投资人 portfolio 下同值拆分。
- 如需刷新缓存，仅修改 `multi-store-super-app/index.html` 既有 `organization-view.js` / `app.js` 资源 query；不得改 HTML 结构、移动端入口、构建配置或发布配置。

**关键文件：** `multi-store-super-app/organization-view.js`、`multi-store-super-app/validation/organization-view.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`；必要时仅修改 `multi-store-super-app/index.html` 的既有静态资源版本。文档同步文件为 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`。不得修改 `data-api.js`、`metrics.js`、`filter-api.js`、`filter-ui.js`、`national-scope.js`、目标链路、过程链路、打铁链路、移动端、`dist/`、发布配置或依赖。

**验收映射：**
- AC-259～AC-260：大区层订单/零售稳定唯一排名，全国完整性成立时同值按大区代码升序拆分。
- AC-261～AC-262：小区层与经销商层订单/零售稳定唯一排名，同值分别按小区代码、经销商代码拆分。
- AC-263：53 对象末尾同值连续展示到 `53/53`。
- AC-264～AC-265：投资人 portfolio 和当前范围全部经销商扁平模式沿用当前比较集合，只改同值名次拆分。
- AC-266～AC-269：单店 `1/1`、全国不完整 `--`、输入顺序稳定性和全 0 稳定唯一排名。
- AC-270～AC-271：导出同步、Excel 文本保护不回归，以及非目标口径回归。

**四步门禁：**
1. [x] **Code Review：** 独立核查 AC-259～AC-271、设计文档映射和文件边界；确认未改变比较集合、占比分母、全国完整性、车系筛选、动态诊断、目标、过程、打铁、移动端或发布配置；最终 P0/P1/P2=`0/0/1`，P2 为既有超长文件债，不阻断。
2. [x] **测试完整性：** Node 定向 `23/23`、`npm test` `141/141` 通过；覆盖三级、双指标、全 0、末尾 `n/n`、portfolio、扁平模式、单店收窄、全国不完整、输入顺序扰动和 Phase 3X CSV 文本保护不回归。
3. [x] **编译验证：** lint Syntax check `45 files`、build exit `0`、audit `0`；source/dist `organization-view` SHA-256 均为 `4980a43ba0309680e40bb2788308e5025acef659dcea3e1d4490f7ac89bd6b9c`。
4. [x] **功能测试：** 完整 PC `99/99`、最终 QA 收尾 `23/23` 和新增 53 行 PC `1/1` 通过；最终 QA PASS P0/P1/P2=`0/0/0`。页面订单/零售排名与导出排名一致，53 对象末尾可到 `n/n`，投资人 portfolio 与扁平模式不按所属小区拆分，全国完整性不可证继续显示 `--`。

**停止条件：** 如果实现需要新增字段、数据源、SQL、接口参数、前端状态、tooltip、并列说明、组织代码展示、导出列、依赖、移动端改造或发布配置，立即停止并回到需求确认；如果任一回归证明占比分母、比较集合、全国完整性、车系/权限/组织/日期筛选、目标、过程、打铁或导出格式被改动，也停止，不用“唯一排名”掩盖口径漂移。

**风险与回滚：** 主要风险是旧测试或旧 UI 文案仍按竞争排名断言，导致唯一排名实现后误判；次要风险是导出继续读取旧排名字段或 Excel 文本保护被覆盖。回滚策略是仅回退 Phase 3Y 对 `organization-view.js`、`organization-view.test.mjs`、`pc-role-drilldown.spec.js` 和静态资源 query 的改动，恢复 Phase 3X 后状态，不回退目标、过程、打铁、车系、多店组织下钻或导出格式。

**发布状态：** Phase 3Y 已完成本地实现、Code Review、测试完整性、编译验证和独立 QA；原子提交 `ab55c19` 仅含 3 文件。已随 v1.82～v1.85 共享隔离组合包发布测试 App，发布回执、包哈希、三方同源、发布后 QA 与认证边界见文档顶部。未发布生产、未 push，未完成登录态业务 UI/真实数据终验；不得声称生产上线或最终用户验收通过。

### Phase 3Z：打铁 DCC 四项门店范围合同 — 已发布测试 App

**目标与范围：** 落实 `Product-Spec.md` v1.86 / `REQ-012 / AC-272～AC-281` 和 `docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md` 顶部 v1.86。只调整打铁 DCC 来源 4 项：`first_follow_call_60s_rate`、`follow_30min_rate`、`follow_24h_rate`、`two_day_three_call_rate`。DCC 当前期、上月同期、上周同期均使用 DCC 自身事实、官方打铁业务过滤和 DCC 自身组织字段；不再与 Super App 有效经销商维表 `validDealers`、销售行集或 `processBaselineData` 求交后再补数。

**口径边界：**
- 日期：当前期必须严格使用用户筛选闭区间 `startDate <= DCC真实日期字段 <= endDate`；比较期只由既有 `previousMonthRange(range)` / `previousWeekRange(range)` 派生。SQL 和代码不得出现 `current_date`、`now()`、`yesterday`、T+1、自然周或昨天所在自然月例外。
- 门店范围：DCC 四项范围仅来自 DCC 自身组织字段、官方打铁业务过滤、显式上游组织筛选和观远 DCC 数据集行级权限；不得生成 `authorizedDealerCodes IN (...)`、`validDealers` 白名单 IN 子句或由 Super App 有效经销商维表派生的 DCC 门店过滤。
- 组织归属：大区、小区、经销商行按 DCC 事实自身的大区/小区/经销商代码名称归属；显式 `area/district/dealer` 或 `regionCode/districtCode/dealerCode` 必须下推到 DCC 自身字段。
- 行集并集：打铁行集必须能表达 DCC 与非 DCC 安全并集；DCC-only 门店在门店层和当前范围全部经销商扁平态可展示 DCC 四项，其他非 DCC 指标显示 `--`。销售概览、过程分析、顶部指标、目标和动态诊断不得因 DCC-only 门店补数或扩大范围。
- 聚合：大区、小区、合计和导出汇总均按各指标自身来源的分子分母累加后重算；不得平均门店率，不得用任一来源组织骨架作为全来源交集。
- 失败语义：空授权、无 DCC 行级权限、DCC SQL 失败、字段缺失或范围不可证时，DCC 四项 fail-closed 为 `数据不完整`；比较期失败只影响对应环比为 `加载失败`，不得改写当前期 DCC 值或非 DCC 来源结果。

**实施文件：**
- `multi-store-super-app/iron-metrics-api.js`：已调整 DCC 四项 SQL 构造、日期闭区间、DCC 自身组织筛选、官方业务过滤、行级权限 fail-closed 证据和三阶段同构参数；禁止 preview、分页 fallback 和 `validDealers` DCC 过滤。
- `multi-store-super-app/iron-metrics-model.js`：已调整打铁行集合并、DCC-only 门店表达、父级分子分母重聚合、非 DCC 指标 `--` 和 `source_status / complete / fieldGapReason` 透出。
- `multi-store-super-app/iron-metrics-view.js`、`multi-store-super-app/app.js`、`multi-store-super-app/index.html`：完成 DCC/非 DCC 安全并集的视图/加载/导出必要适配，并刷新静态资源 query 为 `20260724-dcc-scope2`；未改 UI 结构、Tab、外链、目标、销售/过程主链路或移动端。
- `multi-store-super-app/validation/iron-metrics-query.test.mjs`：已补 DCC SQL 文本、日期、组织字段、无 `validDealers` 过滤、三阶段同构、失败隔离和官方复算样例契约。
- `multi-store-super-app/validation/iron-metrics-contract.test.mjs`、`multi-store-super-app/validation/iron-metrics-app-integration.spec.js`：已覆盖 DCC-only 门店、DCC/非 DCC 安全并集、父级分子分母重算、`source_status / complete / fieldGapReason`、当前/月/周/CSV 证据链。
- 既有 drill/export 测试仅作回归；源码实现未改发布配置、依赖、移动端、销售/过程数据源或其他非 DCC 打铁来源；发布时已重新构建并发布当前 `dist/` 与 `dist.0.1.0.zip`。

**测试矩阵：**
- AC-272：用 `startDate=2026-07-20&endDate=2026-07-22&brand=MG&region=全部` 复算 DCC `30分钟跟进率` 7 个大区，与官方打铁看板同源 SQL 误差均 `<=0.05pp`，且不得靠 `validDealers` 裁剪后对齐。完成证据为前置认证态直接 SQL 聚合 7 区逐行一致：南 `2021/2198`、华中 `5301/5750`、西 `1651/1785`、苏皖 `2688/2973`、北 `2812/3132`、东南 `4223/4638`、中南 `2275/2404`；后续刷新因 `guancli auth status` 60s 无输出、direct SQL 60s/90s `ETIMEDOUT` 暂不可重刷。
- AC-273～AC-274：审查当前、上月同期、上周同期 DCC 四项 SQL 和参数，确认无 `authorizedDealerCodes IN (...)`、无 `validDealers` DCC 白名单、无 `current_date/now/yesterday/T+1/自然周/月例外`。
- AC-275～AC-276：构造 DCC-only 门店和 DCC 事实组织归属不同于 `validDealers` 的样本，验证门店层、扁平态、父级行均按 DCC 自身组织显示 DCC 四项，销售/过程/顶部/目标/诊断不补数。
- AC-277：验证大区、小区、合计和导出汇总按各来源自身分子分母重算；DCC 四项包含 DCC 范围，非 DCC 指标只包含非 DCC 授权范围，绝不平均门店率。
- AC-278：验证显式 `area/district/dealer` 与 `regionCode/districtCode/dealerCode` 下推到 DCC 自身字段；空授权、无权限、SQL 失败、字段缺失、范围不可证均 `数据不完整`，不读旧缓存。
- AC-279：验证 current / previous / week 三阶段除日期外同构；比较期失败只影响月环比或周环比为 `加载失败`。
- AC-280：全量回归证明 UI、目标、表头目标提示、二级 Tab、两个外链、导出入口、车系 fail-closed、DCC 四项以外公式、销售/过程/IP/意向/试驾来源 `validDealers` 合同、移动端、发布配置和依赖不变。
- AC-281：源码、测试和构建产物搜索证明 DCC 四项不再先依赖 `processBaselineData` 丢弃门店再二次映射；打铁行集保留 `source_status / complete / fieldGapReason` 证据供 QA 追溯。

**完成标准：**
1. [x] **Code Review：** 独立核查 AC-272～AC-281、v1.86 口径文档映射和文件边界；首轮 `0/4/1`，修复后 Stage 1/2 PASS，最终 P0/P1/P2=`0/0/2`，两项 P2 仅大文件拆分、浏览器集成偏 API 直调。
2. [x] **测试完整性：** `(cd multi-store-super-app && npm test)` Node `147/147` 通过；定向 DCC query/contract 专项 `35/35`，覆盖官方 7 大区复算、SQL 文本禁用项、日期闭区间、组织下推、DCC-only、安全并集、父级重聚合、三阶段同构和失败隔离。
3. [x] **编译验证：** lint Syntax check `45 files`、build PASS、audit `0`、隐私扫描 `0`；已刷新资源 query 为 `20260724-dcc-scope2`，source/dist `29` 个复制型运行时文件一致，发布时重新构建 `dist/`，未手改发布配置或依赖。
4. [x] **功能测试与独立 QA：** `(cd multi-store-super-app && npm run test:pc)` PC `99/99` 通过；PC/导出回归证明打铁门店层、当前范围全部经销商扁平态、导出汇总和非目标模块均符合 AC-272～AC-281。独立 QA PASS P0/P1/P2=`0/0/0`。登录态线上 UI 未验收前不得声称最终用户验收通过。

**风险与回滚：** 主要风险是把 DCC 四项从 `validDealers` 交集改为 DCC 自身范围后，打铁行集与既有非 DCC 行集不再同形，导致父级合计、导出或扁平态误用交集/平均门店率。次要风险是为了补齐 DCC-only 门店误改销售/过程/顶部/目标范围，或把 DCC 自身组织归属重映射到销售组织。回滚策略是仅回退 Phase 3Z 对 `iron-metrics-api.js`、`iron-metrics-model.js`、必要 `app.js` 和 DCC query/contract/PC 测试的改动，恢复 Phase 3O/3Q 后 DCC SQL-only 与扁平展示状态；不得回退 UI 外链、目标、销售/过程、车系、多店组织下钻、移动端或发布配置。

**发布状态：** Phase 3Z 已完成本地实现、Code Review、测试完整性、编译验证、功能测试、独立 QA 复核和测试 App 发布。北京时间 `2026-07-24 12:54:09 CST` 已发布测试 App `q0844640cf6734877a3193d6`，回执 `operation=update`、`version=0.1.0`、标准回执未返回 `fileKey`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；zip SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes、`dist 31 files / 600836 bytes`、`unzip -t` PASS。匿名 HTTP `401` 仅认证边界；未做登录态线上业务数据 UI 验收，未发布生产，未 commit/push。

### Phase 3AA：PC 过程表现 CSV 三列数值化导出 — 本地实现、Code Review 和工程门禁完成，独立 QA 待文档回写后复核，未发布

**目标：** 落实 `Product-Spec.md` v1.87 / `REQ-002 / AC-282`。将当前过程表现 CSV 中每项“当前值 / 月环比 / 周环比”拼接文本改为可直接统计的独立数值列，不改变过程指标计算、数据查询或页面展示。

**交付内容：**
- 基于现有 `PROCESS_TABLE_METRIC_LABELS` 9 个指标生成 27 个指标列；每个指标的三列表头固定为 `<指标>(%)`、`<指标>月环比(百分点)`、`<指标>周环比(百分点)`，按现有指标顺序逐项 current→month→week 紧邻排列。
- 当前值与环比按页面百分比数值尺度输出纯数值；去除 `%`、正号、月/周前缀、斜杠和拼接文案。不可比、加载失败、数据不完整或无值输出空字符串，合法 0 输出 `0`。
- 导出列集合不受页面月/周开关影响；保留组织首列、具体车系边界说明行、现有分层/扁平全量范围、CSV 格式与转义/公式注入防护、既有导出入口。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`；文档同步文件为 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`。不得修改过程指标公式、数据 API、查询参数、组织/日期/权限/车系边界、页面 UI、移动端、依赖或发布配置。

**四步门禁：**
1. [x] **Code Review：** Stage 1/2 PASS，P0/P1/P2=`0/0/1`；唯一 P2 为既有 `app.js` 超长文件债，不阻断 AC-282。已核查 9 × 3 列顺序、数值尺度、合法 0、空单元格、车系说明行和非目标边界。
2. [x] **测试完整性：** AC-282 定向 `2/2`、Node `147/147`；CSV 解析覆盖 `10.3/-4.5/0.1`、合法 0、空值/失败留空、页面月/周开关组合、9 指标 × 3 列顺序、组织首列和车系边界说明行。
3. [x] **编译验证：** lint Syntax check `45 files`、build PASS、audit `0`；build 生成 `dist/app.js`，source/dist `app.js` `cmp=0`，SHA-256 均为 `be44429dc33c3f63f7d8a0cf540867cf3135a4b9097690d9a1be4f679dff3665`。
4. [x] **功能测试与独立 QA 门禁：** PC `101/101`；实际 CSV 解析证明指标数据列为数值或空字符串，不含 `%`、`+`、`月`、`周`、斜杠、`--`、`加载失败` 或 `数据不完整`。独立 QA 首次复核唯一 P2 为三份文档仍写待开发，本次已回写，最终 QA 待回写后复核；不得提前写最终 QA PASS。未发布测试 App或生产，未做登录态线上验收。

**停止条件：** 如果实现需要改变现有 9 个过程指标名称/公式、数据查询、组织或日期范围、车系边界说明、导出入口、文件格式、页面月/周开关行为、页面 UI、移动端、依赖或发布配置，立即停止并回到需求确认。

### Phase 3AB：PC 订单目标切换为打铁最终目标输出 — 开发中/待复审

**目标：** 落实 `Product-Spec.md` v1.88 / `REQ-011 / AC-283～AC-290`。只把订单目标从 `r05.总订单目标` 拆出并改读打铁最终目标输出 `u32cb7e789f7443ff84160b4`，订单目标按 `u32` 自带组织代码/名称守恒汇总；零售目标继续读取 `r05b1e3995b0b4480991a4b8` 并按 validDealerMap 旧规则展示，保证 Super App 订单目标与打铁运营机制看板一致。

**交付内容：**
- 在目标数据 API 中拆分订单目标源与零售目标源：订单目标读取 `u32` 的 `日期、品牌、大区、小区、经销商、车系、订单目标、大区代码、小区代码、经销商代码`，以输出行为唯一事实源按行 SUM `订单目标`，不按展示键二次去重、不纠正重复行；`日期/品牌/车系/订单目标` 为必需字段，组织代码可空，优先代码定位，代码为空时用 `u32` 组织名称归入大区/小区/经销商汇总。零售目标继续读取 `r05` 的 `目标日期、dealer_code、车系、总零售目标` 并保留既有 r05 去重/冲突与 validDealerMap 规则。
- 禁止 `r05.总订单目标` 继续参与订单目标；禁止把 `h9828e20e9026475091ae6ca` 作为 App 最终订单目标，只把 `h982` 直汇总 `22614` 与 `u32` 合计 `22824` 用于 QA 差异说明。
- 保留既有单月整月目标规则、目标实际 SQL、车系集合联动、顶部标题行目标摘要、表格 2x2 目标位和现有导出字段集合；但有效经销商维表归属只继续约束零售目标和订单实际分子，不能用于排除 `u32` 订单目标分母。
- 新增订单目标组织守恒审计：`2026-07 / MG / 全部车系` 必须证明 `1576` 行、七区 `1995/5597/1950/2850/2615/5179/2638`、全国 `22824`；12 条空组织代码但有组织名称的 `115` 必须进入全国和对应大区汇总，不得被 invalidKey、validDealerMap、别名补码或硬编码补差处理。
- 订单实际达成分子仍按现有有效一级经销商代码和车系聚合；无法映射到实际分子的订单目标行保留目标分母、分子为 `0` 并进入审计，不得用名称反查代码或零售源伪造达成。
- 拆分订单/零售目标加载状态与错误状态：订单源失败只影响订单目标和订单达成；零售源失败只影响零售目标和零售达成；销售主链路、过程链路、排名、占比、打铁指标和 UI 不回退。

**关键文件：** `multi-store-super-app/data-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/app.js`、`multi-store-super-app/organization-view.js`、`multi-store-super-app/validation/monthly-target.test.mjs`、`multi-store-super-app/validation/mg-order-retail-target-source.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`。如构建需要同步静态资源版本，仅允许最小修改 `multi-store-super-app/index.html`；不得修改 UI 样式、导出字段集合、移动端、发布配置或依赖。

**四步门禁：**
1. [ ] **Code Review：** 独立核查 AC-283～AC-290，确认订单目标唯一源为 `u32`，零售目标唯一源为 `r05`，`h982` 不是最终源，`r05.总订单目标` 不再参与订单目标；确认订单/零售失败隔离没有改销售主链路、过程链路、打铁、UI、筛选、导出字段集合或发布配置。
2. [ ] **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；必须覆盖 `u32` 字段映射、订单输出行 SUM、同一展示键多行累加、组织代码为空但组织名称存在时按名称归属、`r05` 零售自然键与去重/冲突规则、`2026-07 / MG` 输入 `1576` 行、7 区 `1995/5597/1950/2850/2615/5179/2638` 与合计 `22824`、12 条空代码目标 `115` 不被 invalidKey/validDealerMap 排除、`h982=22614` 不作验收值、`210` 差额保留、荆州有为同一 `dealerCode+车系` 两行不去重、无法映射实际分子的订单目标分子为 `0` 并计审计、订单源失败零售仍展示、零售源失败订单仍展示、车系集合联动、非 MG/跨月/未来月隐藏。
3. [ ] **编译验证：** 执行 `(cd multi-store-super-app && npm run lint && npm run build && npm audit --omit=dev --audit-level=critical)`，全部退出 `0`；构建产物中目标源拆分与源码一致，且不包含本地绝对路径、密钥、`.env/.pem/.key/credential`。
4. [ ] **功能测试与独立 QA：** 执行 `(cd multi-store-super-app && npm run test:pc)`；PC 自动化必须证明顶部标题行、订单表现、零售表现、导出值、加载态、订单源失败态、零售源失败态和非目标回归均通过。登录态真实观远环境至少抽验 `2026-07 / MG / 全部车系` 订单目标输入行数 `1576`、全国 `22824`、七区值以及 12 条空代码目标 `115` 保留；未完成登录态线上 UI 前不得声称最终用户验收通过。

**停止条件：** 如果 `u32` 必需字段缺失、品牌/日期/车系/订单目标不可证、组织代码为空且组织名称也无法归属到展示层级、`2026-07 / MG` 按输出行 SUM 不能复核到 `22824`、12 条空代码目标 `115` 无法守恒到全国/大区、实现必须修改订单目标实际或零售目标实际 SQL、需要改 UI/导出字段集合/销售过程指标/筛选/发布配置，或为了消除 `210` 差额而需要修打铁 ETL、改读 `h982`、按 validDealerMap 排除空代码行、在 App 另行去重、别名补码或硬编码补差，立即停止并输出差异清单，不用 `r05.总订单目标` 或伪造达成绕过。

### Phase 3AD：销售车系筛选真实联动打铁 11 项 — 待开发

**目标：** 落实 `Product-Spec.md` v1.92 / `REQ-012 / AC-298～AC-308`。把 PC 销售车系多选集合真实下推到打铁 11 项 6 个来源和三阶段查询中；所有具体车系都必须按来源物理字段和销售闭集映射过滤，不得继续返回全部车系打铁结果冒充联动。

**交付内容：**
- 在 `iron-metrics-api.js` 中收敛来源字段合同：邀约提及使用 `周期首次意向闭环车系名称`，高意向低水平使用 `周期最近意向闭环车系`，优质试驾使用 `车系`，试驾录音和试驾话术使用 `车系名称`，DCC 使用 `CRM闭环车系名称`；DCC `原始车系名称` 不可作为 fallback。
- 新增来源级销售闭集 mapper：输出只能是 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07` 或 `unmapped`；`全新MG4` 与 `MG4 EV` 不默认合并。
- 实现 `未知车系` 与 `其他车系` 语义：未知只匹配原始“未知”，无样本展示 `--`；`其他车系`以已完成来源级 distinct 审计固定为 `q00/w8/lbfb/fa1` 永远精确原始“其他车系”过滤、`c82/hd284` 永远只在 MG 范围内取排除已映射闭集后的补集，非 MG 不进入补集，严禁按当前查询结果动态切换。
- 三阶段同构：当前、上月同期、上周同期除日期外使用同一来源字段、同一映射、同一由来源级 distinct 审计固定的 `其他车系` 策略、同一 fail-closed 条件、同一请求 identity 和来源状态。
- 只在字段不存在、字段不可查询、映射不可证、SQL/业务码/完整性不可证时 fail-closed 为 `数据不完整`；真实无样本展示 `--`。
- 保持非目标不变：打铁 11 项公式/目标/展示、二级 Tab、外链、导出入口、销售链路 `汇报车系名称` 枚举与过滤、过程分析其他区域、UI、移动端、发布配置和依赖均不改。

**关键文件：** `multi-store-super-app/iron-metrics-api.js`、`multi-store-super-app/iron-metrics-contract.js`、`multi-store-super-app/iron-metrics-model.js`、`multi-store-super-app/vehicle-series.js`、必要 `multi-store-super-app/app.js` 查询 identity/状态编排；测试文件 `multi-store-super-app/validation/iron-metrics-query.test.mjs`、`multi-store-super-app/validation/iron-metrics-contract.test.mjs`、`multi-store-super-app/validation/iron-metrics-app-integration.spec.js`、`multi-store-super-app/validation/vehicle-series.test.mjs`、`multi-store-super-app/validation/vehicle-series-multiselect.test.mjs`。

**四步门禁：**
1. [ ] **Code Review：** 独立核查 AC-298～AC-308，重点查全部车系冒充、DCC 字段 fallback、`MG4 EV` 默认合并、unknown/other 语义、`q00/w8/lbfb/fa1` 精确过滤与 `c82/hd284` MG 补集的静态来源合同、三阶段同构和非目标回归。
2. [ ] **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；必须覆盖 6 来源字段、销售闭集 mapper、具体车系、多选集合、`未知车系` 无样本 `--`、`其他车系` 的静态来源策略（`q00/w8/lbfb/fa1` 精确值、`c82/hd284` MG 补集）、补集为空 `--`、任意日期/组织/空结果下不得切换策略、`MG4 EV` 不默认并入 `全新MG4`、DCC 只用 `CRM闭环车系名称`、字段/映射/SQL 不可证 fail-closed、当前/月/周三阶段同构、禁止全部车系 SQL。
3. [ ] **编译验证：** 执行 `(cd multi-store-super-app && npm run lint && npm run build && npm audit --omit=dev --audit-level=critical)`，全部退出 `0`；构建产物中车系来源字段、映射和请求 identity 与源码一致，不包含本地绝对路径、密钥、`.env/.pem/.key/credential`。
4. [ ] **功能测试与独立 QA：** 执行 `(cd multi-store-super-app && npm run test:pc)`；PC 自动化至少验证具体车系、`其他车系`、`未知车系`、多选集合、打铁二级组切换、导出入口、销售概览/过程分析非目标区域和 UI 不回归。登录态真实观远环境至少抽验一个普通车系、`其他车系`、`未知车系` 的来源状态与样本语义；未完成登录态真实抽验前不得声称最终用户验收通过。

**停止条件：** 任一来源无法证明字段可查询或映射可证、DCC 只能拿到 `原始车系名称`、`全新MG4/MG4 EV` 需要业务归并但未确认、`其他车系` 需要纳入非 MG 才能出数、实现必须改 11 项公式/目标/UI/导出入口/销售枚举/过程分析其他区域/发布配置，或测试只能通过返回全部车系结果消差，立即停止并输出字段与样本差异清单。

### Phase 4：共享能力与 Vite 多入口地基 — 待开发

**交付内容：**
- 配置 PC `multi-store-super-app/index.html` 和 `multi-store-super-app/mobile/index.html` 两个 build input，PC 根路径与行为不变，`multi-store-super-app/dist/mobile/index.html` 可独立打开。
- 将 URL 解析/校验、日期、查询、计算、权限/白名单结果、主题、GIO 和单店链接作为两端唯一共享能力；移动不得复制公式或数据集配置。
- 建立移动启动与状态容器，不加载 PC 表格 DOM、`multi-store-super-app/capture.js`、导出、设备判断或入口跳转。

**关键文件（待开发项会在本 Phase 新建）：** `multi-store-super-app/vite.config.ts`、`multi-store-super-app/package.json`、`multi-store-super-app/mobile/index.html`、`multi-store-super-app/mobile/mobile-app.js`、`multi-store-super-app/mobile/mobile-styles.css`、`multi-store-super-app/utils.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/filter-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/tracking.js`、`multi-store-super-app/playwright.config.js`（新建，配置可复现的 webServer/baseURL）、`multi-store-super-app/validation/mobile-shared-entry.spec.js`（新建首个测试）。

**四步门禁：**
1. Code Review：mobile 无公式/数据集 ID 副本、无截图监听；PC 无入口跳转或 DOM 改造。
2. 测试完整性：先新建 Playwright config 与首个测试，再执行 `(cd multi-store-super-app && npx playwright test validation/mobile-shared-entry.spec.js)`；覆盖合法/缺失/非法/层级冲突 Query、默认日期、主题优先级、明确无权限与 0 行。
3. 编译：`(cd multi-store-super-app && npm run build)` 退出 0，`multi-store-super-app/dist/index.html` 与 `multi-store-super-app/dist/mobile/index.html` 均存在。
4. 功能：`(cd multi-store-super-app && npm run preview -- --port 4173)` 后按 Playwright config 的 baseURL 打开 `/` 与 `/mobile/`；PC 保留宽表和截图协议，mobile 只显示独立壳且请求上下文一致。

### Phase 5：移动核心指标与主题壳 — 待开发

**交付内容：**
- 实现无标题、返回、导航、筛选、导出的纵向 iframe 业务页，页面只由 `html` 纵向滚动。
- 两列默认显示订单、交付率、零售、线索到店率；“展开全部/收起”按到店试驾率、试驾订单率、线索订单率切换 4→7→4，值、月/周环比和正向率语义与 PC 同口径。
- 实现 light/dark、同形骨架、safe-area fallback、reduced-motion 和 44px 触控区。

**关键文件：** `multi-store-super-app/mobile/index.html`、`multi-store-super-app/mobile/mobile-app.js`、`multi-store-super-app/mobile/mobile-styles.css`、`multi-store-super-app/visual-base.css`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/mobile-metrics-theme.spec.js`（待新建）。

**四步门禁：**
1. Review：核对 4→7 顺序、三项补充转化率公式与正向率语义、主题优先级、无宿主 UI 与截图监听。
2. 测试：`(cd multi-store-super-app && npx playwright test validation/mobile-metrics-theme.spec.js)`；覆盖 375/390/430 light/dark、4→7→4、骨架、减少动效和无横溢出。
3. 编译：`(cd multi-store-super-app && npm run build)` 退出 0，移动 CSS/JS 可从产物解析。
4. 功能：在 375×667、390×844、430×932 的双主题预览；两列与边距正确，`scrollWidth === clientWidth`。

### Phase 6：销售表现门店卡片流 — 待开发

**交付内容：**
- 收起态显示门店/组织、amber 主问题、线索→到店→试驾→订单→零售当前值和展开控制。
- 展开态追加订单/零售小区排名占比、主问题、完整结果断点、收起与门店详情；首张展开，其余收起。
- 五步漏斗单行适配，长文本不挤压操作且无横向滚动。

**关键文件：** `multi-store-super-app/mobile/mobile-app.js`、`multi-store-super-app/mobile/mobile-styles.css`、`multi-store-super-app/metrics.js`、`multi-store-super-app/utils.js`、`multi-store-super-app/validation/mobile-sales-cards.spec.js`（待新建）。

**四步门禁：**
1. Review：逐项核对两态字段，不显示月份/代码，不新算排名或诊断。
2. 测试：`(cd multi-store-super-app && npx playwright test validation/mobile-sales-cards.spec.js)`；覆盖首张展开、任意展收、换页初始化、空值、长文本、3 宽度。
3. 编译：`(cd multi-store-super-app && npm run build)` 退出 0，控制台无资源错误。
4. 功能：以至少 15 店对比 PC 同店五步值、排名占比、问题和断点，两态无溢出。

### Phase 7：过程卡片、Tab 与单一页码 — 待开发

**交付内容：**
- 两个等宽 Tab 只显示当前 panel；共用单一当前有效页码，仅超出目标总页数时归 1。
- 过程卡收起态为线索到店率、到店试驾率、试驾订单率、线索订单率 2×2 摘要；四项均由销售原始分子分母计算，与 PC 顶部过程指标卡同值。
- 展开态复用 PC 邀约 5 项、试驾接待 4 项问题指标，各含当前值/月环比/周环比、正确语义色和门店详情。

**关键文件：** `multi-store-super-app/mobile/index.html`、`multi-store-super-app/mobile/mobile-app.js`、`multi-store-super-app/mobile/mobile-styles.css`、`multi-store-super-app/metrics.js`、`multi-store-super-app/validation/mobile-process-tabs.spec.js`（待新建）。

**四步门禁：**
1. Review：核对 4 项转化率摘要、9 项标签问题明细、月/周环比、标签 lower-is-better、tab/tabpanel 与单页码。
2. 测试：`(cd multi-store-super-app && npx playwright test validation/mobile-process-tabs.spec.js)`；覆盖快速切 Tab、旧请求不回填、页码越界归 1、两态与空值。
3. 编译：`(cd multi-store-super-app && npm run build)` 退出 0，Tab 语义结构有效。
4. 功能：390px 双主题切换销售/过程并展开返回；不双铺、同店指标与 PC 一致、无旧结果闪回。

### Phase 8：分页、六态、跳转与 GIO — 待开发

**交付内容：**
- 每页 15 家；实现上一页—当前/总页—下一页与跳页；非 `1..总页数` 整数原地报错且不查询。
- 实现默认、加载、成功、空、请求/参数错误、无权限六态；明确权限失败才显示无权限，权限通过但 0 行只为空态。
- 复用单店完整 Query 与 GIO 身份组织上下文；每次访问只报一次 `smartmind_sale_View`，展收/Tab/翻页不重复。

**关键文件：** `multi-store-super-app/mobile/mobile-app.js`、`multi-store-super-app/mobile/mobile-styles.css`、`multi-store-super-app/utils.js`、`multi-store-super-app/tracking.js`、`multi-store-super-app/validation/mobile-states-pagination.spec.js`（待新建）。

**四步门禁：**
1. Review：检查单页码、请求 token/abort、权限来源、GIO 去重和链接参数。
2. 测试：`(cd multi-store-super-app && npx playwright test validation/mobile-states-pagination.spec.js)`；覆盖 0/1/15/16/340 条、首末页、空/小数/非数字/0/超限跳页、快速翻页/切 Tab 竞态、六态、Query、GIO 一次。
3. 编译：`(cd multi-store-super-app && npm run build)` 退出 0，无未处理 Promise。
4. 功能：23 页场景验首/中/末/跳页；对比同店同日期 PC/mobile 跳转 Query；GIO 一次；失败保留上下文并可重试。

### Phase 9：尺寸、可访问性与 PC 回归 — 待开发

**交付内容：**
- 收口 375/390/430px 双主题的边距、safe-area、长文本、五步漏斗、分页两行、唯一 `html` 纵向滚动和无横溢出。
- 补齐键盘顺序、ARIA、可见焦点、live region、错误关联、非纯色语义、44×44px 和 WCAG 2.2 AA 目标。
- 回归 PC URL、宽表、主题、分页、跳转与截图/导出；mobile 无导出且不响应 PC 截图消息。

**关键文件：** `multi-store-super-app/mobile/mobile-styles.css`、`multi-store-super-app/mobile/index.html`、`multi-store-super-app/validation/mobile-responsive-a11y.spec.js`（待新建）、`multi-store-super-app/validation/pc-regression.spec.js`（待新建）、`multi-store-super-app/validation/mobile-final-*.png`（待生成）。

**四步门禁：**
1. Review：对照 Design Brief token/尺寸/交互/A11y；确认 PC diff 无业务行为改变。
2. 测试：`(cd multi-store-super-app && npx playwright test validation/mobile-*.spec.js validation/pc-regression.spec.js)`；覆盖 3 宽×2 主题、六态、两 Tab、两类卡两态、分页、Query、权限、竞态、跳转、GIO、PC 导出。
3. 编译：`(cd multi-store-super-app && npm run lint && npm run build)` 均退出 0，PC/mobile 产物完整。
4. 功能：按 `multi-store-super-app/playwright.config.js` 启动的可复现预览保存 375/390/430 light/dark 六张基准图；人工对比 PC 1440×900 双主题、单店链接和 PC 截图请求。

## 4. 功能依赖 DAG

```text
Phase 1~3 PC 已有基线
  └─> Phase 3A PC 角色分层 + 组织下钻（本轮优先交付）
        └─> Phase 3C 销售漏斗一级经销商字段最小改造（已发布测试 App）
              └─> Phase 3D PC 应用级车系筛选（已发布测试 App，Code Review P0/P1=0，QA final PASS）
                    └─> Phase 3E 过程标签定向聚合 + 独立错误状态（已发布测试 App，Review P0/P1=0，QA PASS）
                          └─> Phase 3F 月目标接入
                                └─> Phase 3F.1 历史 PC 月目标布局二次迭代
                                      └─> Phase 3F.2 单月自然月目标达成窗口
                                            └─> Phase 3F.3 标题摘要 + 卡内两行环比（已发布测试 App）
                                                  └─> Phase 3G PC 车系筛选多选升级（已完成，Review 与最终 QA PASS；本目标不发布）
                                                        └─> Phase 3H MG 订单/零售目标源切换（已开发，Code Review PASS，最终 QA PASS）
                                                              ├─> Phase 3L 打铁永久骨架屏修复（已发布测试 App，发布后独立 QA PASS）
                                                              ├─> Phase 3M 打铁非 DCC SQL-only 与上游筛选继承（待开发）
                                                              ├─> Phase 3N PC 当前范围全部经销商扁平查看（已完成，独立 Review 与最终 QA 通过）
                                                              ├─> Phase 3O 打铁月环比/周环比与 DCC SQL-only（已发布测试 App）
                                                              ├─> Phase 3P PC 销售概览行内四率双层漏斗（已完成本地实现与 Review/QA 功能门禁）
                                                              ├─> Phase 3Q PC 打铁指标当前范围全部经销商扁平查看（最终本地 QA PASS，已发布测试 App；线上有限 QA）
                                                              ├─> Phase 3R PC 打铁指标固定运营看板链接（已发布测试 App）
                                                              ├─> Phase 3S PC 打铁指标优质试驾看板链接（已随测试 App 发布）
                                                              ├─> Phase 3T PC 销售经营进度条与时间进度（已完成并发布测试 App）
                                                              ├─> Phase 3U PC 首屏销售渲染与目标异步解耦（已完成并发布测试 App）
                                                              ├─> Phase 3V PC 销售总览标题行目标摘要（已发布测试 App，发布后独立 QA PASS）
                                                              ├─> Phase 3W PC 过程标签两波加载与渲染预算修复（已发布测试 App，发布后独立 QA PASS）
                                                              ├─> Phase 3X PC 销售表现排名 CSV Excel 文本保护（已发布测试 App，发布后独立 QA PASS）
                                                              ├─> Phase 3Y PC 订单/零售稳定唯一排名（已发布测试 App，发布后独立 QA PASS）
                                                              ├─> Phase 3Z 打铁 DCC 四项门店范围合同（已发布测试 App）
                                                              ├─> Phase 3AB PC 订单目标切换为打铁最终目标输出（开发中/待复审）
                                                              ├─> Phase 3AD 销售车系筛选真实联动打铁11项（待开发）
                                                              ├─> Phase 3AE 车系筛选联动过程分析与打铁遗留缺口（待开发）
                                                              ├─> Phase 3AF～3AI MG 07 小订战报（本地开发、Review、QA 门禁完成，未发布/未线上终验）
                                                              ├─> Phase 4 共享能力 + 多入口（后续移动端）
                                                              └─> Phase 5 指标 + 主题壳
                                                                    └─> Phase 6 销售卡
                                                                          └─> Phase 7 过程卡 + Tab + 单页码
                                                                                └─> Phase 8 分页 + 六态 + 跳转 + GIO
                                                                                      └─> Phase 9 适配 + A11y + PC 回归
```

顺序不可逆：移动 UI 先依赖唯一共享口径；两类卡可渲染后再收口分页/状态；最后做全尺寸与 PC 回归。

本轮顺序门禁：Phase 3C 已通过 Review→Fix→QA，并已发布到测试 App `q0844640cf6734877a3193d6`；Phase 3D 已完成一期源码与真实数据字段审计、实现与本地自检，最终 Code Review P0/P1=`0/0`、最终 QA PASS（P0/P1/P2=`0/0/0`），并与“销售概览 / 过程分析”Tab 文案发布到同一测试 App（未发布生产、未 commit、未 push；匿名 HEAD 401 不构成登录后线上 UI/功能冒烟）；Phase 3E 已完成 AC-107～AC-114、本地门禁和测试 App 发布，Review P0/P1=`0/0`，QA PASS（P0/P1/P2=`0/0/0`），默认真实查询 IP=`1896`、drive=`1371`、`isTruncated=false`；Phase 3F 已完成 v1.61 月目标接入、测试 App 发布和本地门禁；Phase 3F.1 已完成 v1.62 布局实现、本地门禁、独立 Code Review 与独立 QA（P0/P1=0），并已发布测试 App，未 commit、未 push；Phase 3F.2 已完成单月完整目标窗口实现、本地验证与独立 QA PASS（目标专项 `11/11`、Node `81/81`、lint/build `0`、PC `34/34`、audit 0 vulnerabilities），并已发布到测试 App `q0844640cf6734877a3193d6`；CLI 未输出平台操作字段，匿名入口 401 不构成登录后 UI 验收；Phase 3F.3 对应 REQ-011 v1.64 与 AC-129～AC-134，已完成标题摘要与卡内两行环比实现，`npm test` `81/81`、PC `35/35`、lint/build/audit 通过，并于北京时间 2026-07-21 20:49 发布测试 App，平台回执 `操作:update`、版本 `0.1.0`，认证态线上资源已验证为 `target2`；Phase 3G 对应 REQ-010 v1.65 与 AC-135～AC-142，已完成并通过 Review 与最终 QA：npm test 90/90、test:pc 43/43、lint/build/audit exit 0、source/dist、1440x900 截图、安全和未发布边界通过，P0/P1/P2=0/0/2，两项 P2 非阻断；本目标不发布，未 commit、未 push；Phase 3H 对应 REQ-011 v1.67 与 AC-151～AC-164，已完成本地开发、目标测试与构建产物同步，Node 90/90、PC 43/43、lint/build/audit critical=0、旧 DS 源码/目标测试/dist 搜索清零、新 DS 真实审计 1542/22578/18580/5 缺口，Code Review PASS；最终 QA PASS，P0/P1/P2=0/0/0；未发布、未 commit、未 push；Phase 3I～3K 对应 REQ-012 v1.70 与 AC-143～AC-150、AC-166～AC-176，已完成本地实现、R5 Code Review PASS、独立 QA PASS 与测试 Super App 发布，最终基线 Node 106/106、PC 58/58、真实静态语法 lint、build、audit 0 通过；测试 App `q0844640cf6734877a3193d6` 已 `operation=update` 至版本 `0.1.0`，URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`，包 `dist.0.1.0.zip` SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`，大小 `126818` bytes，解包 `30 files / 521802 bytes`；发布后独立 QA PASS，P0/P1/P2=`0/0/0`；匿名 HEAD/GET 与关键资源仅验证 401/302 登录态边界，未做登录后线上 UI/资源哈希验收；未做观远认证态真实查询，未发布生产、未 commit、未 push；Phase 4~9 移动端仍按后续计划实施。

Phase 3L 当前作为 v1.71 P1 修复单独闭环，已完成测试 App 发布：打铁来源从 all-complete 收敛改为逐来源结算，单源超时 fail-closed 为 `数据不完整`；测试 App `q0844640cf6734877a3193d6` 已 `operation=update` 至版本 `0.1.0`，URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`，`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`，包 `dist.0.1.0.zip` SHA-256=`9ef29b84237fb8419492aead99f90a2c82ef7d785bc2e335fbfb75b33ce6cbc0`，大小 `128080` bytes，解包 `30 files / 527758 bytes`。最终 Code Review Stage 1/2 PASS（P0/P1=0/0），发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断）；QA 执行门禁为 Node 108/108、PC 61/61、lint Syntax check 42 files、build 通过、audit critical=0。匿名 HTTP 仅证明重定向/登录保护平台边界，未完成登录态线上 UI 冒烟或真实观远指标数据集成验收；未发布生产、未 commit、未 push。

Phase 3M 作为 v1.72 P0 增量修复单独排期，当前待开发：只处理 `inviteMention / intentLevel / qualityTrial / trialRecord / trialTalk` 5 个非 DCC 来源的 SQL-only 与上游筛选继承；其中 `qualityTrial` 为 MG 专属、无已审计可 SQL 品牌字段，MG/全部可查询，非 MG 必须 `fieldGapReason` fail-closed 且零 SQL，不得返回 MG 数据；DCC 182 保持现状；本阶段完成前，不能声称 AC-181～AC-185 已落实。

Phase 3N 作为 v1.73 P0 增量已单独完成：只处理 PC 销售概览/过程分析的当前范围全部经销商扁平查看；入口在表现区 header 工具区、导出按钮左侧，不放 sticky 操作列表头。AC-186～AC-198 已全部通过独立 Review 与最终 QA；可达大区小区层场景、扁平快照/面包屑冻结/退出恢复、入口隐藏条件和精确 `1440x900` 浅色证据均已闭环。Phase 3N 不覆盖、重排或阻塞 Phase 3M 的 qualityTrial / 非 DCC SQL-only 计划，两者改动边界独立。

Phase 3O 作为 v1.75 P0 增量已发布测试 App：打铁 11 项补齐月环比、周环比和过程分析同款单元格语义，DCC 182 已改为新表 SQL-only；复用现有 `previousMonthRange(range)` / `previousWeekRange(range)`，比率按百分点差展示，比较期失败只影响对应环比。Phase 3O 不覆盖、重排或阻塞 Phase 3M SQL-only、Phase 3N 扁平查看，三者边界独立。

Phase 3P 作为 v1.76 P0 增量已完成本地实现、Code Review 与 QA 功能/视觉门禁，首次 QA 唯一文档状态 P2 已在本次修正：只处理 PC 销售概览第二列 `销售结果（指标：月环比）` 的行内四率双层展示，不覆盖、重排或阻塞 Phase 3M、Phase 3N、Phase 3O，也不进入 Phase 4~9 移动端计划；未发布、未 commit、未 push。

Phase 3Q 作为 v1.77 P0 增量已通过独立 Review 与最终本地 QA，并发布测试 App：平台发布成功且包信息正确；发布后线上验证仅有限 PASS，登录态业务 UI 终验未完成。该增量只处理 PC 打铁指标当前范围全部经销商扁平查看，不覆盖、重排或阻塞 Phase 3M、Phase 3O、Phase 3P，也不进入 Phase 4~9 移动端计划。

Phase 3R 作为 v1.78 P0 轻量增量已发布测试 App：只处理 PC 打铁指标二级 Tab 右侧固定外链“打铁运营看板”，不覆盖、重排或阻塞 Phase 3M、Phase 3O、Phase 3P、Phase 3Q，也不进入 Phase 4~9 移动端计划。

Phase 3S 作为 v1.80 P0 轻量增量已随测试 App 发布：只在 Phase 3R 外链组件基础上新增 PC 打铁指标二级 Tab 右侧固定外链“优质试驾看板”，两个外链共存并固定顺序为 `打铁运营看板 → 优质试驾看板`；不覆盖、重排或阻塞 Phase 3M、Phase 3O、Phase 3P、Phase 3Q、Phase 3R，也不实现 v1.79 销售经营进度条或进入 Phase 4~9 移动端计划。门禁为 Node 126/126、PC 87/87、定向 pc-tabs 10/10、lint 45 files、build PASS、audit 0、敏感扫描 0、`git diff --check` PASS；复审最终 PASS P0/P1/P2=`0/0/0`。已随北京时间 `2026-07-23 16:49:52` 的同一测试 App 包发布至 `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`、包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`）；未发布生产、未 commit、未 push。

Phase 3T 作为 v1.79 P0 PC 顶部布局增量已完成并发布测试 App：AC-227～AC-234 已关闭，Code Review Stage 1/2 与最终 QA PASS，Node 126/126、PC 89/89、lint 45 files、build、audit 0、隐私扫描、source/dist SHA 一致及 1280/1440 浅深四张截图通过；不覆盖、重排或改变 Phase 3S 状态。登录态线上 UI 验收未完成；未发布生产、未 commit、未 push。

Phase 3Y 作为 v1.85 P0 增量已完成本地实现、独立 Review 与最终 QA，并随 v1.82～v1.85 共享隔离组合包发布测试 App：只处理 PC 销售概览订单/零售排名同值名次拆分，覆盖大区、小区、经销商三级、投资人 portfolio、当前范围全部经销商扁平模式、`drillPath` 收窄、单店、全 0、53 对象末尾同值和导出同步。不覆盖、重排或阻塞 Phase 3V、Phase 3W、Phase 3X，也不进入 Phase 4~9 移动端计划；原子提交 `ab55c19` 仅含 3 文件。发布证据见文档顶部；未发布生产、未 push，未做登录态业务 UI 终验。

Phase 3Z 作为 v1.86 P0 增量已完成并发布测试 App：只处理打铁 DCC 来源 4 项门店范围合同，覆盖 DCC 日期闭区间、官方业务过滤后的全部 DCC 门店、不与 `validDealers` 求交、DCC 自身组织归属、DCC/非 DCC 安全并集、DCC-only 门店展示、父级分子分母重聚合、组织筛选下推、三阶段同构、失败 fail-closed 和非 DCC 不回归。不覆盖、重排或阻塞 Phase 3V、Phase 3W、Phase 3X、Phase 3Y，也不进入 Phase 4~9 移动端计划；已通过专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`、隐私 `0`、source/dist `29` 个复制型运行时文件一致、Code Review 和独立 QA。北京时间 `2026-07-24 12:54:09 CST` 已发布测试 App `q0844640cf6734877a3193d6`，`operation=update`、`version=0.1.0`、无 `fileKey`、zip SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes、`dist 31 files / 600836 bytes`、`unzip -t` PASS；匿名 HTTP `401` 仅认证边界，未做登录态线上 UI 验收，未发布生产，未 commit/push。

Phase 3AB 作为 v1.88 P0 增量开发中/待复审：只处理 PC 订单目标源从 `r05.总订单目标` 切换为 `u32cb7e789f7443ff84160b4` 打铁最终目标输出，订单目标按 `u32` 自带组织代码/名称守恒汇总，并把订单/零售目标失败状态拆开。不覆盖、重排或阻塞 Phase 3V、Phase 3W、Phase 3X、Phase 3Y、Phase 3Z，也不进入 Phase 4~9 移动端计划；不改订单目标实际 SQL、零售目标实际 SQL、零售目标源、销售/过程指标、UI、导出字段集合、筛选、发布配置或打铁 ETL。

Phase 3AD 作为 v1.92 P0 增量待开发：只处理销售车系多选集合对打铁 11 项六来源、三阶段查询的真实联动。它不覆盖、重排或阻塞 Phase 3AB，也不进入 Phase 4~9 移动端计划；不改打铁 11 项公式/目标/展示、销售链路枚举与过滤、过程分析其他区域、UI、导出入口、发布配置或依赖。

Phase 3AE 作为 v1.93 P0 增量待开发：只处理多店 PC 车系选择对过程分析、过程导出、动态诊断过程数据和打铁 11 项遗留缺口的真实联动，覆盖旧的过程未联动当前合同。它不覆盖、重排或阻塞 Phase 3AB / 3AD，也不进入 Phase 4~9 移动端计划；不改其他 UI、公式、目标、组织权限、日期默认、排序占比、导出入口、移动端、依赖或发布配置。

Phase 3AF～3AI 作为 v1.94 P0 增量已完成本地开发、Code Review 和独立 QA 门禁，未发布：只处理 PC 顶部独立 `MG 07小订战报`，拆为目标配置/数据合同、canonical 组织映射与异常审计、UI 交互与状态隔离、全量回归与发布前验收四段。它不覆盖、重排或阻塞 Phase 3AB / 3AD / 3AE，也不进入 Phase 4~9 移动端计划；不改销售总览、过程分析、打铁指标、负向问题率、门店详情跳转、销售导出、截图协议、移动端、父应用筛选器、依赖或发布配置。尚未完成生产发布、登录态生产页面验收和目标数据集对 16 个业务用户组的 `READER` 权限同步。

### Phase 3AE：车系筛选联动过程分析与打铁遗留缺口 — 待开发

**目标：** 落实 `Product-Spec.md` v1.93 / `REQ-010 / REQ-012 / AC-309～AC-325`。选中具体车系或车系集合后，顶部过程 4 卡、过程分析 9 项、过程导出、查看全部经销商过程表现、动态诊断过程数据和打铁 11 项都必须使用同一车系上下文；不能再用无车系 `processBaselineData`、全部车系数据、旧缓存或静态说明冒充联动。

**交付内容：**
- 顶部过程 4 卡改读选中车系后的销售事实 `state.data` 当前/上月同期/上周同期三阶段值；不得读取无车系 `processBaselineData`。
- 过程分析 9 项继承车系集合：销售事实类指标从选中车系销售事实取数；4 项 IP 邀约问题率、3 项试驾问题率按来源物理车系字段过滤，并在当前/月/周三阶段保持字段、映射、fail-closed 条件和请求 identity 同构。
- 来源级合同固定：`ip.history` 数据流 `mf0b3f3f6a49f476eab32076`、DS `n418e47dacdb94291993d3d9`、字段 `周期首次意向闭环车系名称`，规范值精确过滤，`其他车系`精确；`ip.realtime` DS `ta1978fc86ae745009d0eff4` 同字段，raw 映射过滤，`其他车系`为 MG 品牌内补集；`drive.history` 数据流 `i81d40fe25d0042ecae6e59b`、DS `g9da02067b8a6432486f58f9`、字段 `车系名称`，raw 映射过滤，`其他车系`为 MG 品牌内补集；`drive.realtime` DS `ie2f283f63154402282c4968` 用规范字段 `闭环车系` 精确过滤，`车系名称`只作审计对照。
- raw 映射必须静态、可审计：`ip.realtime` 中 `新一代MG5/2023款MG5/全新MG5天蝎座 -> MG5`，`MG07 EV/MG07 DMH -> MG 07`，`MG Cyberster -> Cyberster`，`MG4 EV/MG6/MG ONE` 不映射到具体闭集，仅可在选择 `其他车系` 时按 MG 补集进入；`drive.history` 中 `新一代MG5/2023款MG5 -> MG5`，`MG Cyberster -> Cyberster`，`MG4 EV` 不映射到 `全新MG4`，仅可在选择 `其他车系` 时按 MG 补集进入。空值/null 不算 `未知车系` 或 `其他车系`。
- 过程导出、查看全部经销商过程表现和动态诊断过程数据必须继承同一车系选择；删除或改写现有过程 Tab 与 CSV 的静态未联动说明，禁止用说明文案代替真实过滤。
- 打铁 11 项沿用 v1.92 车系联动合同，并修正高意向低水平 source/dist 字段漂移：source 与 dist 均必须使用 `周期最近意向闭环车系`，同步修正写错预期仍能变绿的测试。
- 选中具体车系时，任何字段缺失、查询失败、映射不可证或完整性不可证都必须 fail-closed 为 `数据不完整`；不得回退无车系 preview 明细。选择全部车系时可保留既有 fallback。

**关键文件：** `multi-store-super-app/app.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/metrics.js`、`multi-store-super-app/organization-view.js`、`multi-store-super-app/vehicle-series.js`、`multi-store-super-app/iron-metrics-api.js`、`multi-store-super-app/iron-metrics-contract.js`、`multi-store-super-app/iron-metrics-model.js`、必要 `multi-store-super-app/index.html` 静态资源版本；测试文件 `multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/vehicle-series*.test.mjs`、`multi-store-super-app/validation/process-tags-*.test.mjs`、`multi-store-super-app/validation/iron-metrics-*.mjs`、`multi-store-super-app/validation/iron-metrics-*.spec.js`、必要 source/dist 审计测试。

**四步门禁：**
1. [ ] **Code Review：** 独立核查 AC-309～AC-325，重点查顶部过程卡 `state.data`、过程 9 项来源字段、过程导出/扁平查看/动态诊断继承、打铁高意向字段 source/dist 一致、raw 映射、`其他车系`策略、空值语义、具体车系 fail-closed、无车系 fallback 边界和非目标回归。
2. [ ] **测试完整性：** 执行 `(cd multi-store-super-app && npm test)`；必须覆盖普通车系、多选集合、`其他车系`、`未知车系`、空值/null、`MG4 EV` 不并入 `全新MG4`、IP/试驾历史与实时四来源 current/month/week 同构、过程导出、查看全部经销商、动态诊断、打铁 11 项、source/dist 字段一致和旧错误预期反绿防护。
3. [ ] **编译与安全验证：** 执行 `(cd multi-store-super-app && npm run lint && npm run build && npm run test:pc && npm audit --omit=dev --audit-level=critical)`，再执行隐私扫描、source/dist 一致性、zip 完整性检查；全部通过后才能进入发布准备。
4. [ ] **QA 与生产发布：** 独立 QA 必须达到 P0/P1/P2=`0/0/0`；发布前从干净 staging 构建，最终 `settings` 为 `environment=production`。只允许发布生产多店 App `re37c3447cb0443a68a36a40`，禁止发布 `q0844640cf6734877a3193d6`、`x944` 或其他 App；单店跳转 URL 固定为 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/`。发布后必须做登录态线上抽验：多车系、多模块、导出、动态诊断和单店跳转 URL。

**停止条件：** 任何来源无法证明字段可查、raw 映射不可审计、`其他车系`必须临时按结果动态切换才有数、`MG4 EV` 需要业务确认才能归并、具体车系 SQL 失败只能靠无车系 preview 才出数、source/dist 字段不一致、QA 不到 `0/0/0`、staging 不干净、`settings` 非 production、或发布目标不是 `re37c3447cb0443a68a36a40`，立即停止并输出差异清单，不发布、不 commit、不 push。

### Phase 3AF：MG 07 小订目标配置与数据合同 — 已完成本地开发与门禁，未发布

**目标：** 落实 `REQ-014 / AC-329～AC-333 / AC-350 / AC-352` 的目标数据合同。把已创建目标数据集 `MG07小订目标_20260727`（`dsId=h8ae7b66fd5d141ec95bd246`）配置读取、权威维表审计和基础 API 边界做成可验证能力；配置缺失、未授权、字段缺失或运行时不可读时只降级小订模块。

**交付内容：**
- 新增小订配置读取：运行时只认 `mg07SmallOrderTargetDsId=h8ae7b66fd5d141ec95bd246`；配置缺失、无权限、字段缺失或合同失败时返回小订模块专属错误状态。
- 新增目标数据合同校验：字段 `区域/省份/城市/MAC/一级经销商/经销商简称/MG07小订目标`，清洗后字段 `原一级经销商代码/canonical一级经销商代码/代码修正说明/组织映射状态/组织映射来源/目标源行号`。
- 目标 QA 必须证明目标数据集 `FINISHED`、404 行 / 8 列，运行时排除 1 行总计空代码后为 403 行、403 家唯一 canonical 一级经销商、目标 30001、零目标 17、7 大区，并保留 `MQ856G`、`MQ877K`。
- 目标字段规则：`MG07小订目标` 为非负整数，0 合法；空值、负数、非数字、小数或缺字段均使目标合同失败。
- 记录当前审计事实：按应用 valid primary 仅命中 395 家，8 家未命中 valid primary 合计 287，明细为 `MQ207J=104`、`MQ257T=45`、`MQ576H=0`、`MQ576K=78`、`MQ877K=44`、`MQ9331=0`、`SQ2547=0`、`SQ2881=16`。

**关键文件：** 计划新增或修改 `multi-store-super-app/small-order-config.js`、`multi-store-super-app/small-order-api.js`、`multi-store-super-app/settings.json`、`multi-store-super-app/runtime-config.js`、`multi-store-super-app/validation/small-order-config.test.mjs`、`multi-store-super-app/validation/small-order-contract.test.mjs`；如需纳入构建复制清单，仅最小修改 `multi-store-super-app/package.json` 或 `multi-store-super-app/vite.config.ts`。不得新增依赖或升级现有依赖。

**四步门禁：**
1. [x] **Code Review：** 已核查配置键写真实 `dsId=h8ae7b66fd5d141ec95bd246`、无假 `dsId`、无本地 Excel 运行时读取、配置缺失只降级小订模块、目标字段与 QA 数量合同完整。
2. [x] **测试完整性：** Node 测试已覆盖配置缺失、字段缺失、403/30001 守恒、零目标、非法目标值、8 家 valid primary 异常明细和无权限状态。
3. [x] **编译与安全验证：** Node `187/187`、lint Syntax check `56 files`、build PASS，隐私扫描未发现本地 Excel 作为运行时代码依赖。
4. [x] **功能验证：** 已验证真实 `mg07SmallOrderTargetDsId` 成功态，以及配置缺失、未授权、字段缺失或运行时不可读时 PC 页面主链路可用、小订模块显示配置缺失/目标不可用状态。

**完成证据：** 真实回放 `404` 行中排除 `1` 行总计空代码，入数 `403` 家；唯一原代码 / canonical 代码均 `403`，目标合计 `30001`、零目标 `17`、覆盖 `7` 区；未写假 ID、未读取本地 Excel、未新增依赖。

**停止条件：** 需要写假目标 `dsId`、读本地 Excel、前端硬编码目标、用旧目标源替代，或目标合同无法证明 403/30001 守恒时停止。

### Phase 3AG：MG 07 小订 canonical 组织映射与异常审计 — 已完成本地开发与门禁，未发布

**目标：** 落实 `REQ-014 / AC-332～AC-345 / AC-349`。用权威经销商维表 `a310ff90fddff4b6283841c6` 生成 canonical code、组织归属和权限裁剪，处理 `MQ257T -> MQ256T` 清洗修正，并建立异常审计。

**交付内容：**
- 目标代码优先匹配全量 MG 权威维表，不局限 valid primary；除 `MQ257T` 外，7 家未命中 valid primary 的目标必须映射到全量 MG 维表并保留状态审计。
- `MQ257T` 按 `经销商简称 + 区域全称 + MAC姓名` 唯一匹配为 `MQ256T`，清洗目标保留 `原一级经销商代码=MQ257T`、`canonical一级经销商代码=MQ256T`、`代码修正说明=权威维表按经销商简称唯一命中`。
- 代码 0 命中时才启用名称组合唯一匹配；0 命中或多命中进入 `organization_unmapped` 并 fail-closed。
- 权限裁剪必须在 canonical code 和权威组织映射之后执行；目标表 `区域/MAC` 不直接进入权限字段、组织汇总字段或下钻字段。
- 建立异常审计：`zero_target_actual`、`unconfigured_actual`、`organization_unmapped`，输出原代码、canonical code、经销商名称、目标、实际、窗口、原因和处理结果。
- 实际源固定 `k4c14c31c595540a0a771f50`，过滤 `品牌名称=MG`、`汇报车系名称=MG 07`、固定小订窗口，聚合首触小订、留存、退订和更新时间；转大定隐藏。

**关键文件：** 计划新增或修改 `multi-store-super-app/small-order-model.js`、`multi-store-super-app/small-order-api.js`、`multi-store-super-app/organization-scope.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/filter-api.js`、`multi-store-super-app/validation/small-order-model.test.mjs`、`multi-store-super-app/validation/small-order-date-boundary.test.mjs`、`multi-store-super-app/validation/small-order-contract.test.mjs`。

**四步门禁：**
1. [x] **Code Review：** 已审查 canonical code 生成、`MQ257T -> MQ256T` 审计字段、权限不扩张、目标文本不直接做权限字段、异常 fail-closed。
2. [x] **测试完整性：** Node 测试已覆盖 8 家异常状态、`MQ257T` 唯一名称映射、0 命中、多命中、零目标有实际、实际无目标、目标无实际、组织失败排除。
3. [x] **编译与安全验证：** Node `187/187`、lint `56 files`、build PASS；请求 identity 已包含目标 dsId、实际 dsId、固定小订期、截止日期、权限范围和小订下钻路径。
4. [x] **数据 QA：** 已证明修正后 403 行 / 30001 目标全部可映射、`organization_unmapped=0`；本地角色权限裁剪合同通过，生产 16 个业务用户组 `READER` 同步仍待授权。

**完成证据：** 403 家逐码逐值校验通过；8 家 valid primary 异常合计 `287` 可追溯；`MQ257T -> MQ256T` 按溧阳名锐唯一名称命中，原代码与 canonical 代码保留审计；`395/8/287` 逐码逐值口径已闭环。

**停止条件：** `MQ257T` 被当作未入维表门店、8 家异常被 valid primary 直接排除、目标文本扩大权限、0/多命中仍入数、实际源被替换、转大定被展示或用于达成时停止。

### Phase 3AH：MG 07 小订战报 UI、交互与状态隔离 — 已完成本地开发与门禁，未发布

**目标：** 落实 `REQ-014 / AC-326～AC-328 / AC-341～AC-348`。在 PC 顶部实现独立模块、摘要、展开列表、独立下钻和响应式视觉，不污染销售/过程/打铁主状态。

**交付内容：**
- PC 顶部新增 `MG 07小订战报` 模块；摘要常驻展示 `小订目标`、`累计小订`、`目标达成`、`时间进度`，第五动态位按层级变化。
- `小订达成表现` 默认收起，当前页面会话内展开状态保留；刷新、重新进入或上游 URL 变化后默认收起。
- 实现独立 `smallOrderViewState`、`smallOrderLoadToken` 和缓存 identity，不改写 `organization.viewLevel/drillPath/allDealerMode`。
- 展开列表字段：对象名称/代码、目标、实际、达成率、时间进度、应达差距、状态；默认排序 `gap_to_expected` 降序、组织代码升序。
- 四个日期边界 `2026-07-28`、`2026-07-29`、`2026-08-22`、`2026-08-23` 覆盖状态、时间进度、实际窗口和落后对象。
- 1280/1366/1440 PC 浅色/深色主题摘要和列表无文字重叠、无页面级横向滚动，展开控件可键盘聚焦。

**关键文件：** 计划新增或修改 `multi-store-super-app/small-order-view.js`、`multi-store-super-app/app.js`、`multi-store-super-app/index.html`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/components.css`、`multi-store-super-app/visual-base.css`、`multi-store-super-app/visual-responsive.css`、`multi-store-super-app/validation/small-order-app-integration.spec.js`、`multi-store-super-app/validation/small-order-a11y-visual.spec.js`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`。

**四步门禁：**
1. [x] **Code Review：** 已核查小订 UI 独立状态、展开会话语义、缓存 key、非目标主链路不污染和可访问性。
2. [x] **测试完整性：** Playwright 已覆盖总部/大区/小区/门店角色入口、展开/收起、独立下钻、请求竞态、四个日期边界、失败五态。
3. [x] **编译与安全验证：** Node `187/187`、lint `56 files`、build PASS、PC Playwright `111/111`，source/dist 小订相关文件一致。
4. [x] **视觉 QA：** 1280/1366/1440 浅色/深色截图通过；摘要、列表、按钮、焦点环无重叠、截断或横向页面溢出。

**完成证据：** `smallOrderViewState` 与主 `organization.viewLevel/drillPath/allDealerMode` 隔离；`2026-07-28`、`2026-07-29`、`2026-08-22`、`2026-08-23` 四日期边界通过；非目标销售/过程/打铁/导出/截图/单店跳转回归通过。

**停止条件：** 小订下钻改写主组织状态、展开状态写入 URL 或持久缓存、父日期或车系筛选影响小订固定期、UI 造成主销售区挤压、或需要新增依赖时停止。

### Phase 3AI：MG 07 小订战报全量回归与发布前验收 — 本地门禁完成，未发布/未线上终验

**目标：** 对 `REQ-014 / AC-326～AC-352` 做完整工程门禁、独立 QA 和发布前证据收口。真实目标 `dsId` 已创建，但未完成权限、运行时可读性和认证态 QA 前，不得标记已发布或线上验收通过。

**交付内容：**
- 执行完整 Node、PC、lint、build、critical audit、隐私扫描、source/dist 一致性和截图门禁。
- 独立 Code Review 和 QA 必须达到 P0/P1/P2=`0/0/0`。
- QA 证据必须覆盖目标 403/30001 守恒、8 家异常状态、`MQ257T -> MQ256T`、角色权限不扩张、零目标有实际、实际无目标、组织 0/多命中、四个日期边界、1280/1366/1440 浅深主题。
- 非目标回归：销售总览、过程分析、打铁指标、车系筛选、目标摘要、销售导出、截图协议、移动端入口、单店跳转和发布配置不变。
- 依赖核对：沿用现有 `multi-store-super-app/package.json` 与 `package-lock.json`，即 React 18.3.1、Vite 8.1.0、Playwright 1.61.1、TypeScript 5.8.2、package-lock v3；不得新增依赖或升级版本。

**关键文件：** `multi-store-super-app/package.json`、`multi-store-super-app/package-lock.json`、`multi-store-super-app/validation/*.mjs`、`multi-store-super-app/validation/*.spec.js`、`multi-store-super-app/dist/` 生成产物；发布前仅允许从干净 staging 构建，不授权本阶段直接发布、commit 或 push。

**四步门禁：**
1. [x] **Code Review：** 独立审查 AC-326～AC-352 已通过，P0/P1/P2=`0/0/0`。
2. [x] **测试完整性：** `(cd multi-store-super-app && npm test)` 已通过，Node `187/187`；专项小订测试和既有目标/车系/打铁/导出测试无回归。
3. [x] **编译与安全验证：** lint Syntax check `56 files`、build PASS、PC Playwright `111/111`、critical audit `0`、隐私扫描、source/dist 一致和关键资源校验均通过。
4. [x] **业务 QA：** 本地真实 `mg07SmallOrderTargetDsId=h8ae7b66fd5d141ec95bd246` 合同、成功态、未授权/字段缺失/运行时不可读安全降级均已验证；生产登录态页面抽验和目标数据集对 16 个业务用户组的 `READER` 权限同步尚未完成，不能用本地结果替代线上终验。

**停止条件：** QA P0/P1/P2 不是 `0/0/0`、真实目标 `dsId` 未按 `h8ae7b66fd5d141ec95bd246` 配置、目标数据集无权限或运行时不可读却声称成功态、任何非目标主链路回归失败、依赖变化、发布目标或 settings 被改动时停止。当前发布前仍需用户明确授权后同步目标数据集 16 个业务用户组 `READER`，并完成登录态生产页面验收。

## 5. Product-Spec + Design-Brief P0 覆盖矩阵

| P0 条目 | Phase | 验证证据 |
|---|---:|---|
| AC-080～AC-087：销售按一级经销商代码聚合、名称一致时按父简称展示；过程事实查询与负向指标不变，四项顶部转化率重算 | 3C | 销售 SQL/降级契约测试；代码与名称一致性；真实父店样本；PC 全回归；源码 diff 边界 |
| SCOPE-021 / REQ-010 / AC-090～AC-098：PC 车系下拉、销售同字段联动、过程边界和组织排序回归 | 3D | 一期源码对标；销售 `汇报车系名称` 字段审计；全部/真实单车系/URL/缓存/品牌复位自动化；1440px 展开截图 `pc-vehicle-series-menu-expanded-1440x900.png`；Code Review P0/P1=`0/0`，QA final PASS（P0/P1/P2=`0/0/0`） |
| SCOPE-023 / AC-107～AC-114：过程标签定向聚合、IP/试驾独立错误状态、默认全域不触达 5000、顶部四率不受标签影响 | 3E | kind 独立状态测试；定向 SQL 契约；默认 `2026-07-01~2026-07-20 / MG / 全域` 真实查询 IP=`1896`、drive=`1371`、`isTruncated=false`；Node 70/70、PC 26/26、lint/build、audit critical=0；Review P0/P1=`0/0`，QA PASS（P0/P1/P2=`0/0/0`）；已发布测试 App |
| SCOPE-024 / REQ-011 / AC-115～AC-128：PC 月目标与目标达成、顶部环比固定第一行、订单/零售表现 2×2 顺序、排名文案和单月完整目标窗口 | 3F、3F.1、3F.2 | v1.61/v1.62 已完成目标接入和布局发布；3F.2 已实现完整自然月目标、月初至 `min(今天, 月末)` 实际、跨月/未来月 `invalid_range` 空槽与零目标请求，主销售不变、导出目标数值为空、未新增文案；专项 `11/11`、Node `81/81`、lint/build `0`、PC `34/34`，Review P0/P1=`0/0`，QA PASS P0/P1/P2=`0/0/0`、audit 0 vulnerabilities；已发布测试 App，zip SHA-256=`c1dc8399807cbca9d3f06c1f933d928aa76d46c51446513467c0564d43619d3e`，CLI 无平台操作字段 |
| REQ-011 v1.64 / AC-129～AC-134：PC 标题目标摘要、七张顶部卡仅值+两行环比、无目标隐藏、失败摘要降级、1280px/1440px 浅深主题与既有表格/筛选/下钻/导出不变 | 3F.3 | `npm test` `81/81`、PC `35/35`、lint/build/audit 通过；已于北京时间 2026-07-21 20:49 用 `guancli` 1.0.42 发布测试 App，平台回执 `操作:update`、版本 `0.1.0`；线上认证态资源为 `app.js?v=20260721-target2`，`app.js` HTTP 200 且包含 `sales-target-summary` / `订单目标`。 |
| REQ-010 v1.65 / AC-135～AC-142：PC 车系筛选不限数量多选、重复 `vehicleSeries` URL、销售/目标/导出/动态排名/动态占比集合联动、过程边界、品牌复位、缓存/埋点隔离和 1440×900 展开态证据 | 3G | 已完成并通过 Review 与最终 QA：npm test 90/90、test:pc 43/43、lint/build/audit exit 0、source/dist、1440x900 多选展开态截图、安全和未发布边界通过，P0/P1/P2=0/0/2，两项 P2 非阻断；本目标不发布，未 commit、未 push |
| REQ-011 v1.67 / AC-151～AC-164：PC 目标源切换为新 DS `r05b1e3995b0b4480991a4b8`，订单/零售双目标、双实际、双达成、组织守恒、车系集合、非 MG/跨月/未来月隐藏、失败降级、导出与审计字段 | 3H | 已开发并通过 Code Review；Node 90/90、PC 43/43、lint/build/audit critical=0，旧 DS 在业务源码/目标测试/dist 搜索为 0，新 DS 真实审计 1542/22578/18580/5 缺口。最终 QA PASS，P0/P1/P2=0/0/0；未发布、未 commit、未 push |
| REQ-012 v1.69 / AC-143～AC-150：打铁 7 项邀约 + 4 项试驾当前区间口径、长表合同、目标值、两项试驾开口率分母、无识别状态、车系不伪联动和五态 | 3I | 已本地实现；Node 合同测试覆盖 11 项长表合同、目标 label、当前日期闭区间、两项开口率分母、组织聚合、五态和来源独立失败；最终基线 Node 106/106、PC 58/58、真实 lint/build/audit 0；R5 Review PASS、独立 QA PASS |
| REQ-012 v1.70 / AC-166～AC-169：PC 第三 Tab、C 方案二级切换、表头“名称在上目标在下”、首跟无占位、目标只作口径提示 | 3J | 已本地实现并发布测试 Super App；PC 用例覆盖一级 Tab 顺序、默认销售概览、邀约默认、试驾切换、同屏只一组、表头目标、首跟无占位和无达标视觉；未改变现有两个 Tab 和导出按钮位置。发布信息：测试 App `q0844640cf6734877a3193d6`、`operation=update`、版本 `0.1.0`、包 SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`、`126818` bytes、`30 files / 521802 bytes`；发布后 QA PASS，未生产、未 commit、未 push |
| REQ-012 v1.70 / AC-170～AC-176：共享下钻、无车系过程基线组织骨架、角色入口、操作列、导出当前二级组当前范围全部组织行、1280/1440 浅深主题、键盘/ARIA、五态与缓存隔离 | 3K | 已本地实现并发布测试 Super App；PC 用例覆盖总部/大区/小区/销售总监/投资人、上游具体组织自动跳层、页面分页、导出字段、导出当前范围全部组织行、视觉回归、无障碍和生产默认不暴露测试接口。发布信息：测试 App `q0844640cf6734877a3193d6`、`operation=update`、版本 `0.1.0`、包 SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`、`126818` bytes、`30 files / 521802 bytes`；发布后 QA PASS，未生产、未 commit、未 push |
| REQ-012 v1.71 / AC-177～AC-180：打铁永久骨架屏修复，6 类来源逐来源结算、局部呈现、单源超时 fail-closed、旧请求不覆盖新上下文 | 3L | 已发布测试 App；最终 Code Review Stage 1/2 PASS（P0/P1=0/0）；发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断），QA 执行 Node 108/108、PC 61/61、lint Syntax check 42 files、build 通过、audit critical=0。测试 App `q0844640cf6734877a3193d6` `operation=update`、版本 `0.1.0`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`、包 SHA-256=`9ef29b84237fb8419492aead99f90a2c82ef7d785bc2e335fbfb75b33ce6cbc0`；未完成登录态线上 UI 冒烟或真实观远指标数据集成验收；未生产、未 commit、未 push |
| REQ-012 v1.72 / AC-181～AC-185：打铁 11 项继承上游 `startDate/endDate`、组织、品牌和车系；非 DCC 来源 SQL-only 聚合；缺车系字段 fail-closed；禁止 preview 明细、分页 fallback、前端聚合和旧缓存补算 | 3M | 待开发；本轮范围只含 `inviteMention / intentLevel / qualityTrial / trialRecord / trialTalk`，DCC 182 保持现状。验收需证明可查询品牌范围内 5 个来源走 `execute-sql`，`trialRecord/trialTalk` 使用 `试驾接待时间`；`qualityTrial` 删除不存在的 `品牌` preview 筛选，因 DS 为 MG 专属且无已审计可 SQL 品牌字段，只在 MG/全部查询，非 MG 必须 `fieldGapReason` fail-closed、零 SQL、不返回 MG 数据；真实 SQL 字段和结果可验证，否则停止，不用 preview 兜底 |
| REQ-002 v1.73 / AC-186～AC-198：PC 当前范围全部经销商扁平查看，header 工具区入口、销售/过程共享 `allDealerMode`、打铁忽略、全国/大区/当前下钻路径扁平、返回分层、筛选重置、15 家分页、全量导出、权限白名单、统一排名占比、五态复用、响应式与无障碍 | 3N | 已完成并通过独立 Review 与最终 QA；总部从大区层手动下钻到某大区小区层（真实 `viewLevel=district`、`drillPath` 仅含该大区）的可达扁平场景、真实 `store` 层隐藏、组织/销售页码/过程页码/`selectedStoreCode` 快照恢复、销售/过程面包屑冻结、真实 store/有效集合 `<=1`/过程局部错误/全局五态入口隐藏均已覆盖。门禁：Node 117/117、PC 72/72、lint Syntax check 42 files、build 通过、audit critical=0；截图为 `pc-all-dealers-sales-flat-1440x900-light.png`、`pc-all-dealers-process-flat-1440x900-light.png`；未发布、未 commit、未 push |
| REQ-012 v1.75 / AC-199～AC-205：打铁 `邀约指标 7 / 试驾指标 4` 全部 11 项展示当前值、月环比、周环比；三阶段同口径范围、百分点差、比较期失败隔离、真实无分母、过程分析同 DOM/样式语义、DCC 新表 SQL-only 和导出字段 | 3O | 已发布测试 App；当前、上月同期、上周同期仅日期不同，其他公式/过滤/完整性同构；DCC 只读 ``双品牌DCC话务指标182`` SQL、无 preview；发布门禁 Node 119/119、PC 74/74、lint/build/audit/隐私扫描通过，包 SHA-256=`293a24705b23f9c3354e91cf196f6236b8b4f7563da0d86d05e80aefc26fe520`；未生产、未 commit、未 push |
| REQ-002 v1.76 / AC-206～AC-213：PC 销售概览第二列 `销售结果（指标：月环比）` 行内四率双层漏斗，上层五段数量及数量月环比，下层 `线索到店率 / 到店试驾率 / 试驾订单率 / 交付率` 四等分及百分点月环比，覆盖行粒度、扁平、投资人、车系、空值、错误、颜色、可访问性、1280/1440 浅深主题和导出不变 | 3P | 已完成本地实现与 Review/QA 功能门禁；Node 126/126、PC 82/82、lint 45 files、build exit 0、audit critical=0，首次 QA 唯一文档状态 P2 已修正。表内第四率为交付率，顶部第四过程卡仍为线索订单率；数据查询、导出字段、顶部卡、过程分析、打铁指标、移动端和依赖未改，未发布、未 commit、未 push |
| REQ-002 / REQ-012 v1.77 / AC-214～AC-225：PC 打铁指标当前范围全部经销商扁平查看，覆盖入口显隐、全国/大区/当前 `drillPath` 范围、三 Tab 共享 `allDealerMode`、二级组切换保留、快照恢复、扁平态禁用组织下钻、打铁导出全部扁平行、权限白名单、无新数据源、1280/1440 浅深主题和键盘/ARIA | 3Q | 最终本地 QA PASS，已发布测试 App；Node 126/126、PC 85/85、lint 45 files、build exit 0、audit 0。平台 exit 0、`operation=update`、版本 `0.1.0`，包 SHA-256=`e5c138b0549a6eb2b91b89964efb417b0d63ae476e447c3dd8c189bc73518807`。发布后线上验证仅有限 PASS：Chrome 登录态非白屏、三 Tab 可见；standalone 缺人员画像，业务 UI 终验未完成。不建议回滚，未发布生产、未 commit、未 push |
| REQ-012 v1.78 / AC-226：PC 打铁指标二级 Tab 右侧固定外链“打铁运营看板”，URL 固定、新窗口安全属性、继承现有样式、不移动二级 Tab/表格/导出/一级 Tab、不改变打铁状态与数据口径 | 3R | 已发布测试 App `q0844640cf6734877a3193d6`；Node 126/126、PC 86/86、lint 45 files、build、audit critical=0、隐私扫描通过，1280/1440 浅深截图通过；发布后 QA PASS，P0/P1/P2=0/0/0。包 SHA-256=`6f59891701ed953f8cd95173d1639cb99c90b318137cb3035a14ae06cfb7fd22`、139391 bytes、31 files；未生产、未 commit、未 push |
| REQ-012 v1.80 / AC-235：PC 打铁指标二级 Tab 右侧固定外链“优质试驾看板”，与“打铁运营看板”共存且顺序固定，完整 URL 与 `pgId/id` 查询参数保留，新窗口安全属性、键盘 focus、1280/1440 浅深主题无挤压/无横向溢出，点击不污染打铁状态、筛选、分页、查询或导出 | 3S | 已随测试 App 发布；实现文件 6 个：`index.html`、`iron-metrics-view.js`、`iron-metrics.css`、`validation/iron-metrics-pc-tabs.spec.js`、`validation/iron-metrics-a11y-visual.spec.js`、`validation/iron-metrics-query.test.mjs`。Node 126/126、PC 87/87、定向 pc-tabs 10/10、lint 45 files、build PASS、audit 0、敏感扫描 0、`git diff --check` PASS；8 张 iron-metrics 1280/1440 浅深截图已刷新；复审最终 PASS P0/P1/P2=0/0/0。测试 App `q0844640cf6734877a3193d6` `operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`、包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`；未发布生产、未 commit、未 push |
| REQ-013 v1.79 / AC-227～AC-234：PC 独立“销售经营进度”条，五项固定顺序；时间进度按运行时今天日序/当月天数显示 1 位小数且不取筛选 `endDate`；整体隐藏/失败降级；销售/过程卡同起点同高同基线、月周环比上下两行；1280/1440 浅深主题无新增横向溢出；表格、导出、过程链路和移动端不变 | 3T | 已完成并发布测试 App；Review Stage 1/2、最终 QA PASS，P0/P1=0/0；Node 126/126、PC 89/89、lint 45 files、build、audit 0、隐私扫描与 source/dist SHA 一致通过；1280/1440 浅深四张截图通过。包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`；登录态线上 UI 验收未完成，未生产、未 commit、未 push |
| REQ-013 v1.81 / AC-236～AC-242：PC 首屏销售渲染与目标异步解耦，销售事实/车系枚举/有效组织范围先渲染，月目标后台 pending/success/error 局部回填，失败不阻断主链路，旧目标响应按 `loadToken` / generation 丢弃，目标 preview 组织条件下推并保留无下推 fallback | 3U | 已完成本地开发、Code Review Stage 1/2、最终 QA 功能门禁与测试 App 发布；Node 130/130、PC 95/95、lint Syntax check 45 files、build PASS、audit 0、1280/1440 浅深色通过；Review P0/P1/P2=0/0/2。测试 App `q0844640cf6734877a3193d6` `operation=update`、版本 `0.1.0`、`fileKey=1d9e70c3-938c-409d-b4e0-e1be26035edc`，最终 zip SHA-256=`3125ba0859ff122ba05aa2029eab924d2a7dbe2ab689f4a079b5104aa1810359`；zip 完整性与关键四文件 source/dist/zip 三方哈希一致性均通过。未发布生产、未 commit、未 push |
| REQ-013 v1.82 / AC-243～AC-250：PC 目标摘要迁入“销售总览”标题行中间，标题行固定 `销售总览｜目标摘要｜车系筛选`；五项固定顺序、纯文字行内辅助视觉、1280/1366/1440 浅深主题单行完整；loading/success/hidden/error 四态继承 v1.81 异步语义和 REQ-011 降级边界；销售/过程指标同起点同高同基线，数据源、目标自然键、表格、导出、筛选和移动端不变 | 3V | 已完成隔离 Review/QA并随 v1.82～v1.85 共享隔离组合包发布测试 App；主证据 P0/P1/P2=`0/0/0`、隔离 Node `134/134`、PC `97/97`，最新包与发布后 QA 证据见文档顶部 |
| REQ-013 v1.84 / AC-258：PC 销售表现导出 CSV 中 `订单排名`、`零售排名` 的 Excel 文本保护，保持可见 `x/y` 且 CSV 解析语义可还原，不改变排名计算、导出范围、文件类型、页面 UI、数据查询或发布配置 | 3X | 已发布测试 App；发布回执 exit `0`、`operation=update`、版本 `0.1.0`，zip SHA-256=`b58a77a0da195968c801d96ee4a057eed6865f62a437a845f73aafe50b113706`；发布后独立 QA PASS，P0/P1/P2=`0/0/2`，两个 P2 为文档/边界并已关闭。未发布生产，未 commit、push |
| REQ-002 v1.85 / AC-259～AC-271：PC 订单/零售稳定唯一排名，大区/小区/经销商三级按主指标降序、同值组织代码升序拆分；覆盖 53 对象末尾 `n/n`、投资人 portfolio、当前范围全部经销商扁平模式、单店 `1/1`、全国不完整 `--`、输入顺序稳定、全 0、导出同步和非目标回归 | 3Y | 已完成独立 Review 与最终 QA并随 v1.82～v1.85 共享隔离组合包发布测试 App；原子提交 `ab55c19` 仅含 3 文件，完整 PC `99/99`，最新包与发布后 QA 证据见文档顶部；未发布生产、未 push |
| REQ-012 v1.86 / AC-272～AC-281：打铁 DCC 四项门店范围合同，DCC 日期按用户筛选闭区间，范围为官方业务过滤后全部 DCC 门店且不与 `validDealers` 求交，按 DCC 自身组织归属，DCC/非 DCC 安全并集，DCC-only 门店可展示 DCC 四项，父级按自身分子分母重聚合，组织筛选下推，失败 fail-closed，非 DCC 来源和销售/过程/目标/UI/移动端不回归 | 3Z | 已完成本地实现、Review、独立 QA 与测试 App 发布；实现文件 `iron-metrics-api.js`、`iron-metrics-model.js`、`iron-metrics-view.js`、`app.js`、`index.html`，测试 `iron-metrics-query.test.mjs`、`iron-metrics-contract.test.mjs`、`iron-metrics-app-integration.spec.js`。专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`、隐私 `0`、source/dist `29` 个复制型运行时文件一致；最终 Review `0/0/2`、QA `0/0/0`。北京时间 `2026-07-24 12:54:09 CST` 发布测试 App `q0844640cf6734877a3193d6`，`operation=update`、`version=0.1.0`、无 `fileKey`、zip SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes、`dist 31 files / 600836 bytes`、`unzip -t` PASS；匿名 HTTP `401` 仅认证边界。未发布生产，未 commit/push，未做登录态线上 UI 验收 |
| REQ-011 v1.88 / AC-283～AC-290：PC 订单目标切换为打铁最终目标输出，订单源 `u32`、零售源 `r05`，订单按 `u32` 输出行 SUM 且同展示键多行累加，组织代码可空且空代码按 u32 组织名称归属，禁止 `h982` 作为最终订单目标源，`2026-07 / MG` 输入 `1576` 行、7 区订单目标 `1995/5597/1950/2850/2615/5179/2638` 合计 `22824`，12 条空代码目标 `115` 保留，`210` 差额保留，订单/零售源失败隔离，非目标回归 | 3AB | 开发中/待复审；实施必须证明 `r05.总订单目标` 不再参与订单目标，`h982=22614` 只作差异说明，不作 App 验收值。测试需覆盖 `u32` 字段映射、输出行 SUM、同展示键多行累加、空代码名称归属、无法映射实际分子为 0 并计审计、订单/零售源独立失败、车系集合联动、非 MG/跨月/未来月隐藏、UI/导出字段集合/销售过程指标/发布配置不变 |
| REQ-012 v1.92 / AC-298～AC-308：销售车系筛选真实联动打铁 11 项，6 来源字段为 q00 周期首次意向闭环车系名称、w8 周期最近意向闭环车系、lbfb 车系、c82/hd284 车系名称、DCC fa1 CRM闭环车系名称；销售闭集映射、`未知车系` 原始“未知”、`其他车系` 的来源级静态策略（`q00/w8/lbfb/fa1` 精确过滤，`c82/hd284` MG 补集，不按查询结果切换）、`全新MG4/MG4 EV` 不默认合并、字段/查询不可证 fail-closed、真实无样本 `--`、三阶段同构、非目标回归 | 3AD | 待开发；实施必须证明所有真实车系选项触发当前/月/周三阶段 6 来源真实查询或明确 fail-closed，不得用全部车系结果冒充。关键文件 `iron-metrics-api.js`、`iron-metrics-contract.js`、`iron-metrics-model.js`、`vehicle-series.js`、必要 `app.js`；测试 `iron-metrics-query.test.mjs`、`iron-metrics-contract.test.mjs`、`iron-metrics-app-integration.spec.js`、`vehicle-series.test.mjs`、`vehicle-series-multiselect.test.mjs`。未改源码、未发布、未 commit/push |
| SCOPE-028 / REQ-014 v1.94 / AC-326～AC-352：PC 独立 `MG 07小订战报`，固定小订期 `2026-07-29～2026-08-22`，目标源经 `mg07SmallOrderTargetDsId=h8ae7b66fd5d141ec95bd246` 注入真实 dsId，目标数据集 `MG07小订目标_20260727` 为 `FINISHED`、404 行 / 8 列，运行时排除 1 行总计空代码后目标 403 行/30001 守恒，权威维表 `a310ff90fddff4b6283841c6` canonical 映射，8 家 valid primary 异常状态审计，`MQ257T -> MQ256T` 清洗修正，实际源 `k4c14c31c595540a0a771f50`，独立 `smallOrderViewState`，异常 `zero_target_actual/unconfigured_actual/organization_unmapped`，权限不扩张，四日期边界和 1280/1366/1440 浅深主题 | 3AF～3AI | 已完成本地开发、Code Review Stage1/Stage2 与独立 QA 门禁，P0/P1/P2=`0/0/0`；Node `187/187`、lint `56 files`、build PASS、PC `111/111`、critical audit `0`、source/dist 一致、隐私扫描通过。真实回放 `404/1/403`、唯一原/规范代码 `403`、目标 `30001`、零目标 `17`、`7` 区、`organization_unmapped=0`、`395/8/287` 逐码逐值、`MQ257T -> MQ256T` 均已闭环。尚未发布，未完成登录态生产页面验收，目标数据集对 16 个业务用户组的 `READER` 权限同步待用户授权 |
| SCOPE-014 / REQ-009 / AC-042：独立移动 iframe、无宿主 UI | 4~5 | 双入口构建；`multi-store-super-app/dist/mobile/index.html`；无标题/筛选/导出 |
| SCOPE-015 / AC-043：两列 4 指标展开至 7；补充到店试驾率、试驾订单率、线索订单率 | 5 | 4→7→4 自动测试；三项公式/PC 同值断言；3 宽×2 主题截图 |
| SCOPE-016 / AC-044 / AC-045 / AC-054：销售列表、销售卡收起/展开、首张展开 | 6 | 字段断言；15 家展收；PC/mobile 值对比 |
| SCOPE-016 / AC-046：过程四项转化率摘要、9 项问题明细、过程卡两态和 Tab | 7 | Tab/竞态测试；四率公式与 9 项明细字段断言 |
| AC-047 / AC-048：15 条、上下页和合法跳页 | 8 | 0/1/15/16/340 条与非法输入测试 |
| AC-049：门店详情复用 PC 参数 | 8 | 同店同日期 PC/mobile Query 等价 |
| AC-050：无导出/无限滚动/设备判断/截图响应 | 4、9 | DOM/消息测试；PC 截图回归 |
| AC-051：六态，0 行不反推无权限 | 8 | 六态 fixture；权限失败 vs 空结果断言 |
| AC-052：PC URL、布局和需求不变 | 4、9 | PC 1440 双主题、分页/导出/跳转回归 |
| AC-053：复用 GIO 及身份组织属性 | 8 | spy 断言访问一次、属性完整 |
| Design Brief 3.5：状态文案与行为 | 8 | 六态文案、操作、live region |
| Design Brief 3.6~3.7：3 宽、safe-area、滚动 | 5、9 | 六张图；scrollWidth/overflow/触控断言 |
| Design Brief 4~8：同源 token、双主题、趋势、A11y | 5~9 | computed style、contrast、focus、keyboard、reduced-motion |

## 6. 关键文件与边界

| 文件 | 处理 | 边界 |
|---|---|---|
| `multi-store-super-app/mobile/index.html` | 待新建多页入口 | 无宿主 UI、无 `multi-store-super-app/capture.js` |
| `multi-store-super-app/mobile/mobile-app.js` | 待新建移动渲染与交互状态 | 不定义公式/数据集 ID |
| `multi-store-super-app/mobile/mobile-styles.css` | 待新建移动布局 | 复用 PC token，不改 PC 宽表 |
| `multi-store-super-app/vite.config.ts` / `multi-store-super-app/package.json` | 增加双入口及产物复制 | 保留根入口和相对 base；不升级/引框架 |
| `multi-store-super-app/playwright.config.js` | Phase 4 待新建测试配置 | 配置可复现 webServer/baseURL |
| `multi-store-super-app/utils.js` / `multi-store-super-app/data-api.js` / `multi-store-super-app/filter-api.js` / `multi-store-super-app/metrics.js` / `multi-store-super-app/tracking.js` | 两端唯一共享能力 | 改动必须跑 PC 回归 |
| `multi-store-super-app/app.js` / `filter-ui.js` / `organization-view.js` / `components.css` | Phase 3D 候选 PC 车系实现与组织排序回归点 | 以一期同构调用和真实数据审计决定最小改动；不得扩展移动端或过程事实过滤 |
| `multi-store-super-app/data-api.js` / `metrics.js` / `app.js` / `validation/process-tags-*.test.mjs` | Phase 3E 过程标签修复点 | IP/试驾按 kind 独立链路、定向一级标签聚合、完整性证据和 UI 状态；不得影响顶部四项销售转化率 |
| `multi-store-super-app/app.js` / `visual-sync.css` / `validation/pc-role-drilldown.spec.js` | Phase 3F.3 已完成的标题摘要、卡内两行环比与 PC 回归点 | 只改 PC 呈现与浏览器测试；目标数据、目标实际订单、表格、导出、车系/组织筛选、过程卡、排名、下钻和移动端不改。仅当改动目标状态数据契约时，才追加 `validation/monthly-target.test.mjs`。 |
| `multi-store-super-app/filter-ui.js` / `app.js` / `data-api.js` / `metrics.js` / `organization-view.js` / `components.css` / `visual-sync.css` / `validation/vehicle-series-multiselect.test.mjs` / `validation/monthly-target.test.mjs` / `validation/pc-role-drilldown.spec.js` | Phase 3G PC 车系多选升级点 | 已完成选中集合贯穿 URL、销售、目标、导出、缓存、埋点和 1440x900 证据；npm test 90/90、test:pc 43/43、lint/build/audit exit 0，Review Stage 1/2 PASS，最终 QA PASS，P0/P1/P2=0/0/2；不得改移动端、一期、权限、日期、组织下钻、排序或过程事实过滤 |
| `multi-store-super-app/data-api.js` / `metrics.js` / `organization-view.js` / `app.js` / `index.html` / `visual-sync.css` / `validation/monthly-target.test.mjs` / `validation/mg-order-retail-target-source.test.mjs` / `validation/pc-role-drilldown.spec.js` | Phase 3H 已开发的 MG 订单/零售目标源切换点 | 旧 DS 和旧字段映射当前已清零；新 DS 只读、MG 常量、有效经销商维表归属、订单/零售双实际 SQL、双目标导出和 1280/1440 证据已过本地门禁、Code Review 与最终 QA；不得改移动端、一期、权限、日期、组织下钻、排序或过程事实过滤 |
| `multi-store-super-app/iron-metrics-contract.js` / `iron-metrics-api.js` / `iron-metrics-model.js` / `data-api.js` / `app.js` / `validation/iron-metrics-contract.test.mjs` / `validation/iron-metrics-query.test.mjs` | Phase 3I PC 打铁数据合同 | 已完成 11 项查询、长表合同、组织聚合、`target_label`、五态和独立来源状态；未改移动端、一期、销售/目标/过程既有口径 |
| `multi-store-super-app/index.html` / `app.js` / `iron-metrics-view.js` / `iron-metrics.css` / `validation/iron-metrics-pc-tabs.spec.js` / `validation/pc-role-drilldown.spec.js` | Phase 3J PC 第三 Tab 与二级切换 | 已完成“打铁指标”一级 Tab、`邀约指标 7 / 试驾指标 4` 二级切换和表头目标层级；未改变默认一级 Tab、现有两个 Tab、导出按钮位置或目标达标语义 |
| `multi-store-super-app/app.js` / `organization-view.js` / `iron-metrics-api.js` / `iron-metrics-model.js` / `iron-metrics-view.js` / `iron-metrics.css` / `package.json` / `validation/iron-metrics-drill-export.spec.js` / `validation/iron-metrics-a11y-visual.spec.js` / `validation/pc-role-drilldown.spec.js` / `validation/syntax-check.mjs` | Phase 3K PC 打铁共享下钻、导出与回归 | 已接入现有 `viewLevel/drillPath`、返回、页面分页、操作列和导出；组织骨架复用无车系过程基线有效组织集合和 `OrganizationView` 排序；导出当前范围全部组织行，非仅当前页；已覆盖 1280/1440 浅深主题、键盘/ARIA、五态、缓存隔离、CSV 安全和生产默认不暴露测试接口；未新增第二个导出按钮、未破坏销售概览/过程分析/负向问题率 |
| `multi-store-super-app/iron-metrics-api.js` / `iron-metrics-model.js` / `iron-metrics-view.js` / `app.js` / `validation/iron-metrics-*.mjs` / `validation/iron-metrics-*.spec.js` / `validation/pc-role-drilldown.spec.js` | Phase 3L 打铁永久骨架屏修复 | 已发布测试 App，发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断）；来源结算从 all-complete 改为逐来源 settle，单源超时/失败只让绑定指标显示 `数据不完整`，其他来源局部呈现；不得改 11 项公式、目标语义、二级切换、导出范围、销售/目标/过程既有口径或移动端 |
| `multi-store-super-app/iron-metrics-api.js` / `iron-metrics-contract.js` / `iron-metrics-model.js` / `data-api.js` / `app.js` / `validation/iron-metrics-query.test.mjs` / `validation/iron-metrics-contract.test.mjs` / `validation/iron-metrics-*.spec.js` / `validation/pc-role-drilldown.spec.js` / `validation/syntax-check.mjs` | Phase 3M 打铁非 DCC SQL-only 与上游筛选继承 | 待开发；只改 5 个非 DCC 来源在可查询品牌范围内的 `execute-sql` 聚合、日期/组织/车系上下文、字段缺口 fail-closed 和测试。`qualityTrial` 是 MG 专属例外：MG/全部可查，非 MG `fieldGapReason` fail-closed、零 SQL、不得返回 MG 数据；DCC 182、Phase 3L 逐来源呈现、11 项公式、导出范围、销售/目标/过程既有口径和移动端不改 |
| `multi-store-super-app/index.html` / `app.js` / `organization-view.js` / `visual-sync.css` / `validation/organization-view.test.mjs` / `validation/pc-role-drilldown.spec.js` | Phase 3N PC 当前范围全部经销商扁平查看 | 已完成 header 工具区入口、共享 `allDealerMode`、快照恢复、面包屑冻结、rows/标题/首列/操作/分页/导出/排名占比和 1280/1440/`<=900px` 回归，独立 Review 与最终 QA 通过；打铁指标、顶部指标、上游筛选、权限白名单、移动端、Phase 3M 打铁 SQL-only 和新增数据集未改 |
| `multi-store-super-app/iron-metrics-api.js` / `iron-metrics-contract.js` / `iron-metrics-model.js` / `iron-metrics-view.js` / `iron-metrics.css` / `app.js` / `validation/iron-metrics-query.test.mjs` / `validation/iron-metrics-contract.test.mjs` / `validation/iron-metrics-pc-tabs.spec.js` / `validation/iron-metrics-drill-export.spec.js` / `validation/iron-metrics-a11y-visual.spec.js` / `validation/pc-role-drilldown.spec.js` | Phase 3O 打铁月环比/周环比与 DCC SQL-only | 已发布测试 App：打铁三阶段比较数据合同、百分点差、三行 DOM/样式、比较期失败隔离、导出字段和 DCC 新表 SQL 聚合已进入发布包；DCC 不得 preview/fallback，保留过滤与车系 fail-closed。销售概览、过程分析既有指标、目标语义、二级切换、组织下钻、移动端、发布配置不改 |
| `multi-store-super-app/app.js` / `multi-store-super-app/visual-sync.css` / `multi-store-super-app/validation/pc-role-drilldown.spec.js` / `multi-store-super-app/validation/sales-row-conversion-rates.test.mjs` | Phase 3P PC 销售概览行内四率双层漏斗 | 已完成；实现范围精确落在这 4 个文件，完成第二列双层单元格渲染、四率计算、1280/1440 浅深视觉与回归验证。Code Review Stage 1/2 PASS，P0/P1/P2=0/0/0；QA 功能/视觉门禁通过，文档状态 P2 已修正；未触达数据查询、导出字段、顶部卡、过程分析、打铁指标、移动端或新增依赖 |
| `multi-store-super-app/index.html` / `app.js` / `iron-metrics-view.js` / `iron-metrics-model.js` / `iron-metrics.css` / `validation/iron-metrics-drill-export.spec.js` / `validation/iron-metrics-a11y-visual.spec.js` / `validation/pc-role-drilldown.spec.js` / `validation/organization-view.test.mjs` | Phase 3Q PC 打铁指标当前范围全部经销商扁平查看 | 最终本地 QA PASS，测试 App 发布成功；已交付 header 入口、共享 `allDealerMode`、快照恢复、当前组阻断、打铁骨架、全量 CSV 三阶段导出、ARIA 和浅深回归。平台/包证据已核；发布后线上 QA 仅有限 PASS，因 standalone 缺人员画像，业务 UI 终验未完成。未发布生产、未 commit、未 push |
| `multi-store-super-app/iron-metrics-view.js` / `iron-metrics.css` / `validation/iron-metrics-pc-tabs.spec.js` / `validation/iron-metrics-a11y-visual.spec.js` | Phase 3R PC 打铁指标固定运营看板链接 | 已完成固定外链、链接安全属性与布局回归；未触达打铁数据查询、导出、一级 Tab、二级 Tab 状态机、扁平态、移动端或新增依赖 |
| `multi-store-super-app/app.js` / `visual-sync.css` / `validation/pc-role-drilldown.spec.js` / 必要时 `index.html` 静态资源版本 | Phase 3T PC 销售经营进度条与时间进度 | 已完成；范围边界、整体显隐/失败提示、运行时自然日计算、卡片基线和 1280/1440 浅深回归均已通过 Review/QA；source/dist 的 `app.js` 与 `visual-sync.css` SHA-256 一致，未改变数据源、目标计算、表格、导出、过程链路或移动端 |
| `multi-store-super-app/app.js` / `visual-sync.css` / `validation/pc-role-drilldown.spec.js` / 必要时 `index.html` 静态资源版本 | Phase 3V PC 销售总览标题行目标摘要 | 已完成四态回归、隔离 Review/QA，并随 v1.82～v1.85 共享隔离组合包发布测试 App；最新发布证据见文档顶部。目标数据源、自然键、实际 SQL、表格目标位、导出、车系筛选合同、移动端、发布配置和依赖未纳入改动 |
| `multi-store-super-app/app.js` / `validation/pc-role-drilldown.spec.js` | Phase 3X PC 销售表现排名 CSV Excel 文本保护 | 已从隔离临时快照发布测试 App并通过发布后独立 QA；发布 zip 内 `app.js` 包含 `excelTextRank`，`organization-view.js` 保留 v1.84 竞争排名且未带入 v1.85。当前工作区不等同发布源；未发布生产，未 commit、push |
| `multi-store-super-app/organization-view.js` / `validation/organization-view.test.mjs` / `validation/pc-role-drilldown.spec.js` / 必要时 `index.html` 静态资源版本 | Phase 3Y PC 订单/零售稳定唯一排名 | 已完成独立 Review 与最终 QA，并随 v1.82～v1.85 共享隔离组合包发布测试 App；`rankRows()`、Node/PC/导出回归与完整 PC `99/99` 已闭环，最新发布证据见文档顶部；比较集合、占比分母、全国完整性、筛选、目标、过程、打铁、移动端、发布配置和依赖不变 |
| `multi-store-super-app/iron-metrics-api.js` / `iron-metrics-model.js` / `iron-metrics-view.js` / `app.js` / `index.html` / `validation/iron-metrics-query.test.mjs` / `validation/iron-metrics-contract.test.mjs` / `validation/iron-metrics-app-integration.spec.js` / 既有 drill/export 回归测试 | Phase 3Z 打铁 DCC 四项门店范围合同 | 已完成并发布测试 App；只改 DCC 四项 SQL 范围、DCC 自身组织归属、DCC/非 DCC 安全并集、父级分子分母重聚合、DCC-only 门店表达、来源证据、名称 fallback、比较期缺行、DCC 名称和 `fieldGapReason` 当前/月/周/CSV。`app.js` 仅做加载/导出编排必要适配；未改 UI、其他数据源、销售/过程/目标、车系 fail-closed、移动端、发布配置和依赖；发布时已重新构建 `dist/` 并发布 `dist.0.1.0.zip` |
| `multi-store-super-app/data-api.js` / `metrics.js` / `app.js` / `organization-view.js` / `validation/monthly-target.test.mjs` / `validation/mg-order-retail-target-source.test.mjs` / `validation/pc-role-drilldown.spec.js` / 必要时 `index.html` 静态资源版本 | Phase 3AB PC 订单目标切换为打铁最终目标输出 | 开发中/待复审；只改订单/零售目标源拆分、订单目标 `u32` 字段映射、输出行 SUM、空代码名称归属、订单组织守恒、目标状态隔离、对账审计和对应测试。不得改订单目标实际 SQL、零售目标实际 SQL、零售目标源、销售/过程指标、UI、导出字段集合、筛选、打铁指标、移动端、发布配置或依赖 |
| `multi-store-super-app/iron-metrics-api.js` / `iron-metrics-contract.js` / `iron-metrics-model.js` / `vehicle-series.js` / 必要 `app.js` / `validation/iron-metrics-query.test.mjs` / `validation/iron-metrics-contract.test.mjs` / `validation/iron-metrics-app-integration.spec.js` / `validation/vehicle-series.test.mjs` / `validation/vehicle-series-multiselect.test.mjs` | Phase 3AD 销售车系筛选真实联动打铁 11 项 | 待开发；只改来源车系字段合同、销售闭集 mapper、unknown/other 样本语义、三阶段请求 identity/source state、fail-closed 证据和对应测试。不得改 11 项公式/目标/展示、销售链路枚举与过滤、过程分析其他区域、UI、导出入口、移动端、发布配置或依赖 |
| `multi-store-super-app/small-order-config.js` / `small-order-api.js` / `small-order-model.js` / `small-order-view.js` / `small-order-contract.js` / `settings.json` / `runtime-config.js` / `app.js` / `index.html` / `visual-sync.css` / `components.css` / `visual-base.css` / `visual-responsive.css` / `validation/small-order-*.test.mjs` / `validation/small-order-*.spec.js` / `validation/pc-role-drilldown.spec.js` | Phase 3AF～3AI MG 07 小订战报 | 已完成本地开发、Review 和 QA 门禁；只新增小订配置、目标/实际 API、canonical 组织映射、异常审计、独立视图状态、PC UI 与对应测试。文件拆分后 `small-order-contract.js` 约 `284` 行、`small-order-model.js` 约 `138` 行；未新增依赖、未升级 React/Vite/Playwright/TypeScript、未改发布配置，未把目标 Excel/假 dsId 写入运行时代码。尚未发布，登录态生产页面验收和 16 组 `READER` 权限同步未完成 |
| `multi-store-super-app/capture.js` | PC 专属 | mobile 不加载、不复制 |
| `multi-store-super-app/validation/mobile-*.spec.js` | 各 Phase 待新建移动测试 | 覆盖视口、主题、交互、状态、竞态、协议 |
| `multi-store-super-app/validation/pc-regression.spec.js` | Phase 9 待新建 PC 回归 | 锁定 URL/布局/导出/跳转 |

## 7. 风险、外部依赖与回滚

- **前端加载风险低但有两个硬前提：** `app.js` 仍并行读取一网白名单与销售数据，`metrics.js` 仍按 `经销商代码` 过滤且门店名称优先取 `validDealerMap`。查询层别名稳定、一级代码唯一命中白名单且销售父简称与维表一网简称完全一致时，加载编排和最终展示无需调整；代码不一致会过滤为空，名称不一致会显示维表简称而非销售父简称，任一情况均停止实施。
- **共享化破坏 PC：** Phase 4 先锁定 PC 特征；回归失败即回滚共享改动，不修改 PC 预期消差。
- **口径分叉：** mobile 禁止数据集 ID、分子/分母、排名或诊断规则；需要能力只扩展共享模块并双端回归。
- **权限混淆：** 只用明确权限/白名单结果判无权限；API 0 行只能为空态。
- **竞态：** 翻页、Tab、重试共用 token/abort，旧请求不得覆盖新上下文。
- **车系口径错配：** 仅销售 `汇报车系名称` 能作为枚举和过滤字段；DCC、试驾、订单、IP/试驾标签的异名车系字段不得混用。过程链路缺同口径字段时必须保留原范围并展示边界说明。
- **车系缓存串值：** 规范化车系选中集合必须进入销售查询、目标查询、刷新和埋点上下文；品牌改变先复位“全部车系”；URL 重载、快速切换和重试均不得显示旧车系结果。
- **目标源串用：** v1.88 起订单目标必须使用 `u32cb7e789f7443ff84160b4` 打铁最终目标输出，零售目标必须使用 `r05b1e3995b0b4480991a4b8`；`r05.总订单目标`、`h9828e20e9026475091ae6ca` 直汇总、旧缓存、另一目标源、别名补码或硬编码补差都不得伪装成当前订单目标。历史 Phase 3F～3H 记录保留历史事实，不代表当前可继续沿用单源目标。
- **打铁目标差额误修：** `u32` 与 `h982` 的 `210` 差额属于现有打铁看板口径，上海安吉 `+138`、荆州有为 `+72` 不在 App 层修正。若实现为了追平 `h982=22614` 改读上传原表、补去重、修 ETL 或硬编码差额，必须停止。
- **订单/零售目标失败串联：** Phase 3AB 必须让订单源失败只影响订单目标、零售源失败只影响零售目标，销售主链路和另一目标链路继续展示。若继续用单一 `monthlyTarget` 失败状态导致一侧失败拖垮另一侧，必须停止。
- **目标组织错归属：** 订单 `u32` 的大区/小区/经销商字段是订单目标组织归属事实源，优先代码、空代码按名称归属；不得用有效经销商维表排除订单目标空代码行。零售 `r05` 只提供目标自然键和目标值，零售页面展示组织归属必须取有效经销商维表 `a310ff90fddff4b6283841c6`；未命中白名单的零售目标排除展示并进入缺口审计，不得临时信任零售目标源组织字段。
- **目标实际维度丢失：** 订单目标实际和零售目标实际必须独立按自然月、MG、一级经销商代码、汇报车系名称聚合；复用 `salesAggregateSql` 会丢车系维度，属于停止条件。
- **标题行空间竞争：** v1.82 三段标题行在 1280px 需要同时容纳 `销售总览`、五项目标摘要和车系筛选。不得用隐藏、截断、换行、页面横滚、恢复独立通栏或给销售模块加高来消差；只能在标题行内部通过辅助字号、间距、固定筛选宽度和弹性中段收敛。任一 1280/1366/1440 浅深组合不达标即停止并回到布局方案确认。
- **唯一排名误改比较集合：** Phase 3Y 只删除同值复用上一名次的竞争排名行为，不能改 `comparisonKey()`、`peerRows`、portfolio、扁平模式、`drillPath`、单店收窄、占比分母或全国完整性门禁。若为了得到连续名次而扩大可见集合、补入无权限对象、改变排序字段、用输入顺序/随机数/时间戳拆分同值，必须停止。
- **唯一排名导出不同步：** Phase 3Y 页面与导出必须使用同一稳定唯一排名结果；Phase 3X 的 Excel 文本保护不得被覆盖。若 CSV 字段名、列顺序、文件格式、公式注入防护或 `订单排名`/`零售排名` 可见 `x/y` 文本保护发生变化，必须停止并回到需求确认。
- **过程标签完整性误判：** 默认全域历史 IP/试驾原聚合已证明可能超过 `5000`；Phase 3E 已用定向一级标签聚合将默认真实查询降至 IP=`1896`、drive=`1371` 且 `isTruncated=false`，但完整性门禁仍保留 `5000`，不能把截断结果当成功。
- **过程标签联动失败：** IP 与试驾不得共用单一失败状态；任何重试、缓存或 Promise 编排都必须保证一类失败不覆盖另一类成功结果。
- **打铁来源完整性误判：** 打铁 11 项来自六类来源，必须各自记录 `source_status/complete`；任一来源失败不得用 `--`、0 或旧缓存伪装成功，也不得清空其他来源成功指标。
- **打铁目标语义误用：** `target_value/target_label` 只服务表头口径提示；不得生成达标颜色、圆点、标签、官方识别状态、综合得分或排序权重。
- **打铁下钻状态分叉：** 邀约/试驾二级切换只改 `activeMetricGroup`；复制第二套 `viewLevel/drillPath/pageIndex`，或把具体车系筛选后的销售行集当作打铁行集，会导致切组回层、成员错配或导出错层，属于停止条件。
- **打铁导出入口膨胀：** 复用当前 PC 导出入口，不新增第二个导出按钮；导出必须绑定当前二级组和当前 `viewLevel/drillPath` 范围内全部组织行，非仅当前页面分页。
- **打铁 all-complete 阻塞：** v1.71 修复必须证明慢/悬挂 DCC 或意向来源不会阻塞整表；单源超时 fail-closed 为 `数据不完整`，无关来源已成功指标必须局部呈现。当前已完成测试 App 发布与发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断）；登录态线上 UI 冒烟和真实观远指标数据集成验收未完成前，不得发布生产或声称最终用户验收通过。
- **打铁 SQL-only 伪达成：** v1.72 的非 DCC 来源必须在其可查询品牌范围内以真实 SQL 字段和聚合结果证明 `startDate/endDate`、组织交集、车系筛选均已生效；`qualityTrial` 不得继续使用不存在的 `品牌` preview 筛选，且因 MG 专属 DS 无已审计可 SQL 品牌字段，MG/全部只能按真实组织/日期/车系 SQL 查询，非 MG 必须 `fieldGapReason` fail-closed、零 SQL、绝不返回 MG 数据；`trialRecord/trialTalk` 必须以 `试驾接待时间` 为日期口径。字段或结果无法验证时 fail-closed 并停止，不得用 preview、分页 fallback、前端聚合、旧缓存或全部车系数据补数。
- **打铁车系伪联动：** Phase 3AD 必须证明具体车系下 6 来源当前/月/周三阶段均按来源物理字段和销售闭集映射查询；不得用全部车系结果、无车系 `processBaselineData`、旧缓存或提示文案冒充联动。DCC 只能用 `CRM闭环车系名称`，不能回退 `原始车系名称`。
- **未知/其他语义误判：** `未知车系` 无原始“未知”样本、`其他车系` MG 补集为空、普通具体车系真实无样本都应展示 `--`；只有字段/映射/查询/完整性不可证才 `数据不完整`。`其他车系`以来源级 distinct 审计为静态合同：`q00/w8/lbfb/fa1` 永远精确过滤，`c82/hd284` 永远 MG 补集；若实现按当前日期、组织或结果有无动态切换，或把非 MG 纳入补集，必须停止。
- **MG4 变体误合并：** `全新MG4` 与 `MG4 EV` 不得默认合并；若某来源只有 `MG4 EV` 但业务未确认归属，不能为了出数映射到 `全新MG4`。
- **打铁环比口径串错：** v1.75 只能复用过程分析的 `previousMonthRange(range)` / `previousWeekRange(range)` 做比较期，且三阶段只允许日期范围不同；比率环比必须是百分点差，不得改成相对涨跌率、官方自然周/月列或新增状态识别。比较期失败只能影响对应环比，不能把当前值降级或清空。
- **DCC 范围与安全并集串错：** Phase 3Z 必须让 DCC 四项使用官方业务过滤后的全部 DCC 门店和 DCC 自身组织字段，不得再与 `validDealers`、销售行集或 `processBaselineData` 求交；但也不得把 DCC-only 门店反向补进销售概览、过程分析、顶部指标、目标或动态诊断。父级必须按来源自身分子分母重聚合，不能平均门店率；范围不可证、无 DCC 权限、字段缺失或 SQL 失败必须 fail-closed 为 `数据不完整`。
- **打铁样式另起体系：** v1.75 单元格必须维护过程分析同类 `metric-cell`、`metric-value`、`metric-trend[data-kind]`、`trend-prefix`、`trend-change` 语义和浅深主题 token；若实现需要新建完全不同的趋势 DOM、改变表头目标层级、挤压导出按钮/二级切换或造成新增页面横向溢出，必须停止并回报。
- **全部经销商扁平模式串层：** v1.73 只能改变销售概览/过程分析的展示粒度，不能改写真实 `organization.viewLevel/drillPath`、顶部指标、打铁指标或上游筛选；范围必须仍为上游筛选、罗盘行权限、有效经销商白名单和当前 `drillPath` 的交集。若销售与过程已过滤门店集合不一致，先定位数据来源差异，不得新增全量查询或绕过权限补齐。
- **扁平排名/导出伪达成：** 全部经销商模式下订单/零售排名和占比必须以当前扁平经销商集合为比较集合，不得继续按所属小区拆分；销售/过程导出必须导出当前扁平范围全部经销商，不能只导出当前页 15 家。
- **扁平入口挤压布局：** 按钮必须在表现区 header 工具区、导出按钮左侧，复用现有次按钮体系；放进 sticky 操作列表头或新增一套按钮体系会挤压列宽和破坏语义，属于停止条件。1280/1440 浅深和 `<=900px` 必须验证无新增横向页面溢出。
- **打铁扁平扩展串口径：** Phase 3Q 只能把展示粒度派生为经销商层，不能把销售 `汇报车系名称` 过滤后的销售行集当作打铁行集，也不能新增全量查询、绕过权限白名单、改变打铁 11 项公式/目标/SQL-only/车系 fail-closed 或 DCC 新表。二级组切换必须保留扁平态和页码；扁平态组织下钻/返回必须禁用；导出必须覆盖当前扁平范围全部经销商，不能只导出当前 15 行。
- **打铁运营看板外链挤压或污染状态：** Phase 3R 链接只能放在打铁二级 Tab 右侧并继承现有样式；不得移动二级 Tab、表格、导出入口或一级 Tab，不得读写 `activeMetricGroup`、`allDealerMode`、分页、筛选、缓存、导出字段或查询上下文。外链必须新窗口打开并具备 `noopener/noreferrer`。
- **优质试驾看板外链挤压或污染状态已关闭：** Phase 3S 已复用 Phase 3R 外链组件，在“打铁运营看板”右侧新增“优质试驾看板”；两个外链共存且顺序固定，完整 URL 保留 `pgId` 和 `id` 查询参数，新窗口 `noopener/noreferrer` 已验证。非默认 `vehicleSeries=全新MG4` + `allDealerMode=true` 状态不污染、键盘 `Tab → Tab → Enter`、1280/1440 浅深邀约/试驾视觉均已通过；未读写 `activeMetricGroup`、一级 Tab、`drillPath`、`allDealerMode`、分页、筛选、缓存、查询、导出或 v1.79 经营进度条状态。
- **销售行内四率口径串错风险已关闭：** Phase 3P 已从销售概览行 `row.current / row.previous` 原始线索、到店、试驾、订单、零售计算四率，未平均门店率、未复用顶部格式化值；表内第四率保持交付率，月环比保持百分点差，车系/权限/扁平/投资人当前行粒度已通过 Node 126/126 与 PC 82/82 回归。
- **销售结果单元格过密风险已关闭：** 首次 Review 发现 1280px 视口右侧裁切 `41.6px` 后已修复；1280px/1440px 浅深主题的第二列上下双层、下层四等分、约 108px～120px 行高、主问题/结果断点/操作列可读和页面级无新增横向溢出已通过 QA 功能/视觉门禁，未新增表格列、展开交互、悬浮层、导出字段或第二套视觉体系。
- **滚动/安全区：** 首版由 `html` 唯一纵向滚动并用 `env(...,0px)`；若宿主未来确认自动撑高，另起变更，不作为首版前提。
- **线上入口：** 上游发布联调提供新移动 Super App URL / appId 并配置设备路由；本地 `/mobile/` 先独立验收，不阻塞 Phase 4~9。
- **发布边界：** 本计划不部署、不更新旧多店/一期单店 App，不提交、不推送。

## 8. Definition of Done

- Phase 3C 已单独完成 AC-080～AC-087：业务源码只改 `data-api.js`，测试只新增 `validation/data-api-sales-parent.test.mjs`，SQL/明细降级同构，当前/上月/上周一致，白名单外一级代码由既有 `metrics.js` 过滤且不计入顶部或销售行合计，白名单内代码唯一匹配、同码单一父简称且销售父简称与维表一网简称完全一致，销售真实样本、Node、PC、lint、build、Code Review 与 QA 全部通过；已发布到测试 App `q0844640cf6734877a3193d6`，未 commit 或 push。
- 本轮先以 Phase 3A 单独验收：PC 角色矩阵、自动跳层、三级下钻/聚合/排名/诊断、顶部卡片不变式、范围交集和四类异常态均有自动化与 1440px light/dark 证据；移动端不在本轮 DoD 内。
- Phase 3A 已完成 Node `19/19`、Playwright PC `10/10`、build 退出 `0`、Code Review Stage 1 / Stage 2 PASS 和最终 QA PASS，P0/P1/P2 均为 `0`。权威大区清单有效期至 `2026-08-15`，到期前必须刷新版本，否则全国排名自动降级。
- Phase 3D 已以销售 `汇报车系名称` 完成默认全部/真实单车系、品牌全量枚举与单店同构排序、URL 重载、缓存隔离、品牌复位、销售导出、过程边界说明和 AC-088/089 回归；与“销售概览 / 过程分析”Tab 文案合并后，`npm test` `48/48`、`npm run lint`、`npm run build`、`npm run test:pc` `18/18`、`npm audit` critical=`0` 与 1440px 展开态截图均通过本地门禁，`environment=test`。最终 Code Review P0/P1=`0/0`，QA final PASS（P0/P1/P2=`0/0/0`）；已发布测试 App `q0844640cf6734877a3193d6`（版本 `0.1.0`、包 SHA-256 `4760f523ad362dd37886a5138d9e35c179290edc29c2c12d3c9276ce825ff6f3`），未发布生产、未 commit、未 push；匿名 HEAD 401 不构成登录后线上 UI/功能冒烟。
- Phase 3E 已完成 AC-107～AC-114：IP/试驾四态组合、默认全域定向 SQL、三阶段同构、顶部四项销售转化率不受影响、无用 `problem_child` 组合清理、`0.0% / -- / 数据不完整` 状态区分；`npm test` `70/70`、lint/build、PC `26/26`、audit critical=`0`、Review P0/P1=`0/0`、QA PASS（P0/P1/P2=`0/0/0`）均完成，并已发布测试 App `q0844640cf6734877a3193d6`（`operation:update`、版本 `0.1.0`、`fileKey=4afc645a-70e5-42c0-8956-a4eacd62ef44`、包 SHA-256 `adaa813455b94444523f5a1e28f6ccfa5a5fbf91c4cbec0864a5b73557859084`）；未发布生产、未 commit、未 push。
- Phase 3F 已完成 v1.61 月目标接入、目标达成、组织守恒、销售导出和测试 App 发布；Phase 3F.1 已完成 v1.62 顶部环比/目标顺序、订单/零售表现顺序、排名文案统一和 1280/1440 浅深主题无截断无横滚的本地门禁、独立 Code Review 与独立 QA，未发布。
- Phase 3F.2 已完成 AC-126～AC-128：实现范围限于 `data-api.js`、`validation/monthly-target.test.mjs`、`validation/pc-role-drilldown.spec.js`；单月任意日期使用完整自然月目标与月初至 `min(今天, 月末)` 实际，跨月及未来月进入 `invalid_range` 空槽与零目标请求，主销售不变、导出目标数值为空、未新增文案。目标专项 `11/11`、`npm test` `81/81`、lint/build `0`、PC `34/34`，独立 Code Review P0/P1=`0/0`；独立 QA 在临时副本 PASS，P0/P1/P2=`0/0/0`，复跑 Node `81/81`、PC `34/34`、lint/build `0`，audit 0 vulnerabilities。已在 `environment=test` 的 current tree 通过 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 发布测试 App，zip 于 17:49 生成，SHA-256=`c1dc8399807cbca9d3f06c1f933d928aa76d46c51446513467c0564d43619d3e`；CLI 未输出 `operation`、版本或 `fileKey`，匿名入口 HTTP 401 仅确认登录保护，未做登录后 UI 验收。
- Phase 3F.3 对应 REQ-011 v1.64 的 AC-129～AC-134，已完成标题有效目标摘要、无目标隐藏、加载/失败摘要降级、七张顶部卡仅当前值与纵向月/周环比、1280px/1440px 浅深主题无截断/无横向滚动，以及订单表现 2×2、目标口径、车系/组织筛选、过程卡、排名、下钻、导出字段不回归；`npm test` `81/81`、PC `35/35`、lint/build/audit 通过，已发布测试 App 并用认证态线上资源验证 `target2`。未发布生产、未 commit、未 push。
- Phase 3G 已完成 AC-135～AC-142：PC 车系筛选不限数量多选、菜单连续切换不关闭、点击全部/取消最后一项回全部、重复 `vehicleSeries` URL 稳定序列化并清别名、销售/目标/导出/动态排名/动态占比集合联动、过程边界、品牌复位、缓存/埋点隔离、独立官方结果缺车系维度时隐藏和 1440x900 展开态证据均已覆盖。npm test 90/90、test:pc 43/43、lint/build/audit exit 0；source/dist、截图、安全和未发布边界通过；Review Stage 1/2 PASS，最终 QA PASS，P0/P1/P2=0/0/2，两项 P2 非阻断；本目标不发布，未 commit、未 push。
- Phase 3H 已完成 AC-151～AC-164 的本地开发、Code Review 与最终 QA 门禁：旧 DS `u32cb7e789f7443ff84160b4` 从当前业务代码、目标测试和构建产物引用中移除；新 DS `r05b1e3995b0b4480991a4b8` 只读接入并按 `目标日期/dealer_code/车系/总订单目标/总零售目标` 归一；订单/零售目标、两类目标口径实际、达成率、组织守恒、车系集合、非 MG 隐藏、跨月/未来月降级、失败降级、导出字段、冲突/未配置/白名单缺口审计和 1280/1440 浅深视觉均已纳入 Node 90/90 与 PC 43/43；lint/build/audit critical=0。最终 QA PASS，P0/P1/P2=0/0/0；本阶段不发布、不 commit、不 push。
- Phase 3I～3K 已完成，打铁指标可视为本地开发与测试发布完成：Phase 3I 已通过 11 项数据合同、目标 label、组织聚合、五态和独立来源状态；Phase 3J 已通过第三 Tab、C 方案二级切换、表头目标层级和目标非达标视觉；Phase 3K 已通过共享下钻、无车系过程基线组织骨架、角色入口、操作列、导出当前二级组当前范围全部组织行、1280/1440 浅深主题、键盘/ARIA、五态与缓存隔离。最终门禁为 Node 106/106、PC 58/58、真实静态语法 lint、build、audit 0，R5 Code Review PASS、独立 QA PASS；已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、包 `dist.0.1.0.zip`、SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`、大小 `126818` bytes、解包 `30 files / 521802 bytes`）；发布后独立 QA PASS，P0/P1/P2=`0/0/0`；匿名 HEAD/GET 与关键资源仅验证 401/302 登录态边界，未做登录后线上 UI/资源哈希验收；未做观远认证态真实查询，未发布生产、未 commit、未 push。
- Phase 3L 已完成测试 App 发布：打铁永久骨架屏修复已按逐来源结算、局部呈现、单源 fail-closed 和旧请求防覆盖方向推进；已发布到测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`、包 SHA-256=`9ef29b84237fb8419492aead99f90a2c82ef7d785bc2e335fbfb75b33ce6cbc0`）。最终 Code Review Stage 1/2 PASS（P0/P1=0/0），发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断），QA 执行门禁为 Node 108/108、PC 61/61、lint Syntax check 42 files、build 通过、audit critical=0；未完成登录态线上 UI 冒烟或真实观远指标数据集成验收；未发布生产、未 commit、未 push。
- Phase 3O 已发布测试 App：打铁 11 项已补齐当前值、月环比、周环比三行展示，比较周期、百分点差、失败隔离、真实无分母、过程分析同 DOM/样式语义、DCC 新表 SQL-only 和导出字段已覆盖 AC-199～AC-205；发布门禁为 `npm test` 119/119、`npm run test:pc` 74/74、lint、build、audit critical=0 和隐私扫描通过。测试 App `q0844640cf6734877a3193d6` `operation=update`、版本 `0.1.0`、包 SHA-256=`293a24705b23f9c3354e91cf196f6236b8b4f7563da0d86d05e80aefc26fe520`；未发布生产、未 commit、未 push，未执行登录态线上业务数据 UI 验收。
- Phase 3N 已完成 AC-186～AC-198 的本地实现、独立 Review 与最终 QA：总部可达大区小区层扁平场景、真实 store 层隐藏、快照/面包屑冻结/退出恢复、入口隐藏条件、分页/导出/统一排名占比和无障碍均已覆盖；门禁为 Node 117/117、PC 72/72、lint Syntax check 42 files、build 通过、audit critical=0，两张精确 `1440x900` viewport 浅色截图已生成。暗色过程表 `metric-value` 对比度另开后续，不阻断本次浅色展示；文件过长、过滤逻辑重复、AC-188 旧 DOM 断言、未挂载 `filter-ui` 转义保留为 P2 技术债。未发布、未 commit、未 push。
- Phase 3P 已完成本地实现、Code Review 与 QA 功能/视觉门禁：AC-206～AC-213 已全部完成，上层五段数量、下层四率、百分点月环比、行粒度聚合、扁平/投资人/车系、`0.0% / -- / 错误`、颜色与可访问性、1280/1440 浅深主题无页面级新增横向溢出均已覆盖；首次 Review 的 1280px 裁切 `41.6px` 与可比 `0.0%` 误报 `--` 已修复，复跑 Stage 1/2 PASS，P0/P1/P2=0/0/0；最终 QA 临时副本 Node 126/126、PC 82/82、lint 45 files、build exit 0、audit critical=0，首次 QA 唯一文档状态 P2 已修正。顶部卡、过程分析、打铁、导出字段、数据查询、移动端和依赖未改；未发布、未 commit、未 push。
- [x] Phase 3Q 最终本地 QA PASS，已发布测试 App：AC-214～AC-225 已全部实现；门禁为 Node 126/126、PC 85/85、lint Syntax check 45 files、build exit 0、audit critical=0，Stage 1/2 PASS，本地 QA 0 阻断。平台 exit 0、`operation=update`、版本 `0.1.0`，发布包 SHA-256=`e5c138b0549a6eb2b91b89964efb417b0d63ae476e447c3dd8c189bc73518807`、`138887` bytes、`31 files / 578408 bytes` 解包；发布后线上验证仅有限 PASS，登录态业务 UI 终验未完成，不建议回滚。未发布生产、未 commit、未 push。
- [x] Phase 3R 已发布测试 App：AC-226 已关闭；Node 126/126、PC 86/86、lint 45 files、build、audit critical=0、隐私扫描通过，1280/1440 浅深截图通过；发布后独立 QA PASS，P0/P1/P2=`0/0/0`。测试 App `q0844640cf6734877a3193d6` `operation=update`、版本 `0.1.0`，包 SHA-256=`6f59891701ed953f8cd95173d1639cb99c90b318137cb3035a14ae06cfb7fd22`、`139391` bytes、`31 files`；匿名入口 302/401 仅表示登录保护，未做登录态线上业务 UI 验收；未发布生产、未 commit、未 push。
- [x] Phase 3S 已随测试 App 发布：AC-235 已关闭；两个外链共存、顺序固定 `打铁运营看板 → 优质试驾看板`，“优质试驾看板”完整 URL 和 `pgId/id` 查询参数保留，新窗口 `target="_blank"` + `rel="noopener noreferrer"`，键盘 focus 可见，1280/1440 浅深主题无二级 Tab 挤压、无文字截断、无页面级横向溢出，切换/点击不改变打铁状态、组织、分页、车系筛选、查询或导出。门禁为 Node 126/126、PC 87/87、定向 pc-tabs 10/10、lint 45 files、build PASS、audit 0、敏感扫描 0、`git diff --check` PASS；Code Review 复审最终 PASS P0/P1/P2=`0/0/0`；8 张现有 iron-metrics 邀约/试驾 1280/1440 浅深截图已刷新。已随北京时间 `2026-07-23 16:49:52` 的同一测试 App 包发布至 `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`、包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`）；未发布生产、未 commit、未 push。
- [x] Phase 3T 已完成并发布测试 App：AC-227～AC-234 已关闭；Review Stage 1/2、最终 QA PASS，P0/P1=`0/0`；Node 126/126、PC 89/89、lint 45 files、build、audit 0、隐私扫描、source/dist SHA 一致及 1280/1440 浅深四张截图全部通过。测试 App `q0844640cf6734877a3193d6` 包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`；匿名 401 只证明登录保护，Chrome 父应用自动验收持续超时，未完成登录态线上 UI 验收；未发布生产、未 commit、未 push。
- [x] Phase 3U 已完成并发布测试 App：AC-236～AC-242 已关闭；销售主链路不再等待月目标请求，目标 pending/success/error 局部回填，失败不回退全局 loading，旧响应按 `loadToken` / generation 丢弃，组织条件下推和 fallback 已覆盖。门禁为 Node 130/130、PC 95/95、lint 45 files、build PASS、audit 0、1280/1440 浅深色通过；Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/2`。测试 App `q0844640cf6734877a3193d6` `operation=update`、版本 `0.1.0`、`artifact=dist.0.1.0.zip`、`fileKey=1d9e70c3-938c-409d-b4e0-e1be26035edc`，最终 zip SHA-256=`3125ba0859ff122ba05aa2029eab924d2a7dbe2ab689f4a079b5104aa1810359`；zip 完整性与关键四文件 source/dist/zip 三方哈希一致性均通过。未发布生产、未 commit、未 push。
- [x] Phase 3V 已完成独立 Review/QA并随 v1.82～v1.85 共享隔离组合包发布测试 App：AC-243～AC-250 已关闭；隔离 P0/P1/P2=`0/0/0`、Node `134/134`、PC `97/97`，最新包与发布后 QA 证据见文档顶部；未发布生产、未 commit、未 push。
- [x] Phase 3X 已发布测试 App并通过发布后独立 QA：AC-258 只覆盖 PC 销售表现导出 CSV 中 `订单排名`、`零售排名` 的 Excel 文本保护；发布前 Review/QA P0/P1/P2 均为 `0/0/0`，门禁为 AC-258 定向 `1/1`、AC-258 + 公式注入/RFC4180 `2/2`、Node `134/134`、完整 PC `98/98`、lint `45 files`、build PASS、audit `0`。发布源 `/private/tmp/ac258-build-kTHdjn`，回执 exit `0`、`operation=update`、`appId=q0844640cf6734877a3193d6`、`version=0.1.0`，标准回执无 `fileKey`；最终 zip SHA-256=`b58a77a0da195968c801d96ee4a057eed6865f62a437a845f73aafe50b113706`，`141411` bytes、`31 files / 591132` 解包字节，完整性通过。发布后 QA PASS，P0/P1/P2=`0/0/2`，两个 P2 为文档/边界并已关闭。匿名访问只证明登录保护，未做登录态 UI、线上资源哈希或 Windows Excel 实机验收；当前工作区不等同发布源，同源只限发布临时快照 source/dist/zip。未发布生产，未 commit、push。
- [x] Phase 3Y 已完成独立 Review/QA并随 v1.82～v1.85 共享隔离组合包发布测试 App：AC-259～AC-271 已关闭；原子提交 `ab55c19` 仅含 3 文件，Node `141/141`、完整 PC `99/99`，最新包与发布后 QA 证据见文档顶部；未发布生产、未 push，未做登录态业务 UI 终验。
- [x] Phase 3Z 已发布测试 App：AC-272～AC-281 已完成打铁 DCC 四项门店范围合同，覆盖 DCC 日期闭区间、官方业务过滤后全部 DCC 门店、不与 `validDealers` 求交、DCC 自身组织归属、DCC/非 DCC 安全并集、DCC-only 门店展示、父级分子分母重聚合、组织筛选下推、三阶段同构、失败 fail-closed、非 DCC 来源与销售/过程/目标/UI/移动端不回归；门禁为专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`、隐私 `0`、source/dist `29` 个复制型运行时文件一致，最终 Review `0/0/2`，独立 QA `0/0/0`。北京时间 `2026-07-24 12:54:09 CST` 发布测试 App `q0844640cf6734877a3193d6`，`operation=update`、`version=0.1.0`、无 `fileKey`、URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；zip SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes、`dist 31 files / 600836 bytes`、`unzip -t` PASS。匿名 HTTP `401` 仅认证边界；未发布生产、未 commit/push，未做登录态线上 UI 验收。
- [ ] Phase 3AB 开发中/待复审：AC-283～AC-290 已定义订单目标 `u32`、零售目标 `r05`、禁止 `h982` 最终源、`2026-07 / MG` 订单目标 `1576` 行、合计 `22824`、12 条空代码目标 `115` 保留、`210` 差额保留、订单/零售失败隔离和非目标回归；本次仅文档更新，未改源码、未发布、未 commit/push。
- [ ] Phase 3AD 待开发：AC-298～AC-308 已定义销售车系筛选真实联动打铁 11 项、6 来源字段、DCC `CRM闭环车系名称`、销售闭集映射、`未知车系` 真实空样本 `--`、`其他车系` 的来源级静态策略（`q00/w8/lbfb/fa1` 精确过滤，`c82/hd284` MG 补集，不按查询结果切换）、`全新MG4/MG4 EV` 不默认合并、字段/查询不可证 fail-closed、三阶段同构和非目标回归；本次仅文档更新，未改源码、未发布、未 commit/push。
- Phase 4~9 依赖正序完成，每阶段四步门禁均有可复核证据。
- 从项目根执行 `(cd multi-store-super-app && npm run lint && npm run build)` 退出 0，PC 根入口和 `multi-store-super-app/dist/mobile/index.html` 均可运行。
- 375/390/430 双主题全部通过；无业务横向滚动、只由 `html` 纵向滚动，safe-area、44px、键盘和焦点可用。
- 4→7、两 Tab、两类卡两态、15 条分页/非法跳页、六态、Query、权限、竞态、跳转和 GIO 一次均有自动化与浏览器证据。
- mobile 无宿主 UI、筛选、导出、设备判断、无限滚动或截图响应；PC URL、宽表、主题、分页、跳转和截图/导出回归通过。
- 两端调用同一 URL 语义、查询、计算、权限、主题、GIO 和单店链接能力，mobile 无业务规则副本。
- 上游线上 URL/appId 留到发布联调；计划内无阻塞开发的占位项。

## 9. 开发规则

- 除已写成完整子 shell 的命令外，本计划所有 npm/npx 命令的执行目录均为 `multi-store-super-app/`；当前已具备 PC Playwright config 和测试文件，但尚无移动端 Playwright config/测试，必须由 Phase 4 先新建移动端 config 和首个测试后才执行移动端 runner。
- 固定 npm 与现有 lockfile；不升级 React/Vite 大版本，不新增 UI 框架。
- 每 Phase 必须依次通过 Code Review → 测试完整性 → 编译 → 功能测试。
- 改共享能力时同时跑移动定向测试和 PC 回归，不在 mobile 修补第二套口径。
- 保留用户既有改动，不做无关清理；本计划不授权部署、commit 或 push。

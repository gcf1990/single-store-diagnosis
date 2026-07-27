# 变更记录

## [v1.94] - 2026-07-27

### PC MG 07 小订战报独立模块（本地开发与独立审查完成，未发布）
- 新增 `SCOPE-028 / TASK-020 / FLOW-004 / REQ-014 / AC-326～AC-352` 与 DEV-PLAN Phase 3AF～3AI：PC 顶部新增独立模块 `MG 07小订战报`，采用摘要常驻、`小订达成表现`按需展开方案；固定小订期为 `2026-07-29` 至 `2026-08-22`，不跟随销售日期、车系筛选或现有销售/过程/打铁下钻。
- 摘要固定展示 `小订目标`、`累计小订`、`目标达成`、`时间进度`；第五动态位按当前小订层级显示 `落后大区 / 落后小区 / 落后门店 / 自身进度状态`。展开状态只保留在当前页面会话，新入口或刷新默认收起。
- 目标源锁定为 `/Users/chengfengguo/Downloads/100家快闪店展车试驾车信息收集0727.xlsx` 的 `经销商目标` Sheet；目标数据集已创建，名称 `MG07小订目标_20260727`，`dsId=h8ae7b66fd5d141ec95bd246`，`parentDirId=r0d6927b9b1d640d7ac3eabb`，状态 `FINISHED`，404 行 / 8 列；运行时配置键 `mg07SmallOrderTargetDsId` 必须填该真实 `dsId`，文档、源码、配置和测试不得写假 ID。
- 目标清洗验收锁定为排除合计行后 403 行、403 家唯一 canonical 一级经销商、总目标 30001、零目标 17 家、7 大区，并保留 `MQ856G`、`MQ877K` 等补码样本。目标字段 `MG07小订目标` 只允许非负整数，0 合法。
- 组织映射合同修订为权威经销商维表 `a310ff90fddff4b6283841c6`（新双品牌经销商主数据维度表）代码优先，匹配全量 MG 维表，不局限当前应用 valid primary。当前审计事实：目标 403 家按 valid primary 仅命中 395 家；8 家未命中 valid primary 合计 287，明细为 `MQ207J=104`、`MQ257T=45`、`MQ576H=0`、`MQ576K=78`、`MQ877K=44`、`MQ9331=0`、`SQ2547=0`、`SQ2881=16`。
- 同步最新核验修正：`MQ257T` 是 Excel 代码笔误，不是未入维表门店；目标行名称 `溧阳名锐`、目标 45，必须在清洗上传时规范化为权威一级经销商代码 `MQ256T`（溧阳名锐汽车销售服务有限公司，`4苏皖区 / SQR700 / 罗恩 SMG503`，开业非二网）。原 Excel 不改，清洗目标数据增加 `原一级经销商代码=MQ257T`、`canonical一级经销商代码=MQ256T`、`代码修正说明=权威维表按经销商简称唯一命中`。
- 代码 0 命中时，才允许用 `经销商简称 + 区域全称 + MAC姓名` 在权威维表唯一匹配生成 canonical code；目标表 `区域/MAC` 文本只用于展示或审计，不直接成为权限字段、组织汇总字段或下钻字段。0 命中或多命中进入 `organization_unmapped` 并 fail-closed。
- 实际源固定为销售事实源 `k4c14c31c595540a0a771f50`，过滤 `品牌名称=MG`、`汇报车系名称=MG 07`、日期字段 `日yyyy-mm-dd`，聚合 `当日首触小订数`、`当日首触留存小订数`、`当日首触小订退订数`，`调度时间` 作为更新时间；`当日首触小订转大定数` 当前隐藏。
- 异常语义锁定：`zero_target_actual` 的实际计入累计和上层达成但自身达成率为 `--`；`unconfigured_actual` 的实际只计入累计，不进入达成分母和默认落后列表；`organization_unmapped` 的目标与实际均排除可见计算。
- QA 已证明 403 行 / 30001 目标守恒、8 家异常状态映射可追溯、`MQ257T -> MQ256T` 唯一名称映射、角色权限不扩张合同、4 个日期边界、1280/1366/1440 浅深主题、非目标主链路不回归。
- 完成证据：Code Review Stage1/Stage2 PASS，P0/P1/P2=`0/0/0`；Node `187/187`、lint Syntax check `56 files`、build PASS、PC Playwright `111/111`、critical audit `0`、source/dist 一致、隐私扫描通过。目标真实回放 `404/1/403`，唯一原代码 / canonical 代码均 `403`，目标 `30001`、零目标 `17`、`7` 区、`organization_unmapped=0`，`395/8/287` 逐码逐值，`MQ257T -> MQ256T` 已闭环；文件拆分后 `small-order-contract.js` 约 `284` 行、`small-order-model.js` 约 `138` 行。
- 锁定非目标：不改销售总览、过程分析、打铁指标、负向问题率、门店详情跳转、销售导出、截图协议、移动端、父应用筛选器、转大定展示、依赖或发布配置。当前仅完成本地开发与独立审查，尚未发布，尚未完成登录态生产页面验收，目标数据集对 16 个业务用户组的 `READER` 权限同步仍等待用户明确授权；未 commit/push。

## [v1.93] - 2026-07-27

### 销售车系筛选联动多店所有未覆盖部分（需求已确认，待开发）
- 新增 `REQ-010 / REQ-012 / AC-309～AC-325` 与 Phase 3AE：本版本替代旧“过程分析不联动车系、只展示边界说明”的当前合同。PC 车系多选集合必须同时联动顶部过程指标 4 卡、过程分析 9 项、过程导出、查看所有经销商过程表现、动态诊断中的过程数据，以及打铁 11 项；不得继续用说明文案冒充联动。
- 顶部过程指标 4 卡（线索到店率、到店试驾率、试驾订单率、线索订单率）必须使用已选车系后的销售事实 `state.data` 三阶段值，不再使用清空车系的 `processBaselineData`。
- 过程分析 9 项必须联动：线索到店率与试驾订单率来自已选车系销售事实；4 项 IP 邀约问题率 + 3 项试驾问题率通过真实物理车系字段过滤，当前、上月同期、上周同期三阶段同构。过程导出、查看所有经销商过程表现和动态诊断的过程数据全部继承同一选择。
- 删除/改写过程 Tab 与 CSV 旧固定说明“车系筛选仅覆盖销售漏斗及销售表现…”；过程 Tab 和过程导出不得再把具体车系下的未过滤过程值包装成“边界说明后可用”。
- 打铁 11 项全部联动，承接并收紧 v1.92：修复高意向低水平 source 字段为 `周期最近意向闭环车系`，消除 source/dist 漂移；修正把错误预期写绿的测试，禁止通过测试预期匹配错误源码。
- 锁定 2026-07-27 只读字段审计：IP 历史 `n418e47dacdb94291993d3d9` 用 `周期首次意向闭环车系名称`；IP 实时 `ta1978fc86ae745009d0eff4` 用 `周期首次意向闭环车系名称`；试驾历史 `g9da02067b8a6432486f58f9` 用 `车系名称`；试驾实时 `ie2f283f63154402282c4968` 用 `闭环车系`，不得混用同时存在的 `车系名称` 作为实时过滤字段。
- 锁定销售闭集仍为 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07`。映射必须来源级静态、可审计；`未知车系` 只映射原值“未知”，空值不算未知；无样本显示 `--`；`其他车系` 在有精确规范值的来源精确过滤，在 raw source 没有精确值的来源只能在品牌 MG 范围内排除所有已映射闭集后的补集；`MG4 EV` 不得并入 `全新MG4`。
- fail-closed 规则扩展到过程与打铁：字段不存在、查询失败、映射不可证、完整性不可证都标记为数据不完整，绝不能回退全部车系。
- 锁定非目标：不改其他 UI、公式、目标、组织权限、日期、销售目标、排名占比、导出入口、移动端、依赖。
- 发布目标固定为多店生产 App `re37c3447cb0443a68a36a40`；单店跳转生产 URL 固定 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/`；最终 `settings.environment=production`。不得发布 `q084`、`x944` 或其他 App。
- 门禁与验收：文档→开发→Code Review→QA `0/0/0`→clean staging→`npm test` / `npm run lint` / `npm run build` / `npm run test:pc` / `npm audit --omit=dev --audit-level=critical` / privacy scan / source-dist / zip；只发布 `re37`；登录态线上抽验多车系、多模块和跳转 URL。本次仅更新三份文档，未改源码、未发布、未 commit/push。

## [v1.92] - 2026-07-24

### 销售车系筛选真实联动打铁 11 项（需求已确认，待开发）
- 新增 `REQ-012 / AC-298～AC-308` 与 Phase 3AD：销售筛选器中的所有真实车系选项必须联动“打铁指标”7 项邀约 + 4 项试驾；当前、上月同期、上周同期三阶段均触发 6 个来源真实查询，不得用全部车系数据、旧缓存、无车系组织骨架或边界说明冒充具体车系结果。
- 锁定 6 个来源字段：邀约提及 `q00.周期首次意向闭环车系名称`、高意向低水平 `w8.周期最近意向闭环车系`、优质试驾 `lbfb.车系`、试驾录音 `c82.车系名称`、试驾话术 `hd284.车系名称`、DCC `fa1.CRM闭环车系名称`；DCC 必须使用 `CRM闭环车系名称`，`原始车系名称`不可作为可用字段。
- 锁定销售闭集与映射：销售闭集为 `MG5、全新MG4、MG7、其他车系、未知车系、MG ES5、MG 4X、Cyberster、MG 07`；来源映射只能输出该闭集或 `unmapped`。`未知车系`只映射原始值“未知”；来源中无“未知”样本时返回真实空样本 `--`，不标记 `数据不完整`。`全新MG4` 与 `MG4 EV` 不得默认合并。
- 锁定“其他车系”的来源级静态策略：已完成 distinct 审计确认 `q00/w8/lbfb/fa1` 存在精确“其他车系”，四者永远精确过滤；`c82/hd284` 无精确值，二者永远只在 MG 范围内按排除全部已映射销售闭集车系后的剩余车型补集计算，非 MG 不进入补集。不得因当前日期、组织或查询结果动态切换，避免重复计数或混入口径。
- fail-closed 仅用于字段不存在、字段不可查询、映射不可证、SQL/业务码/完整性不可证等情形；真实无样本、无“未知”样本或补集为空均展示 `--`。
- 锁定非目标：不改打铁 11 项公式/目标/展示、销售链路既有 `汇报车系名称` 枚举与过滤、过程分析其他区域、UI、导出入口、移动端、发布配置或依赖。
- DEV-PLAN 新增 Phase 3AD，实施文件和测试清单写入计划；本次仅更新 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md`，未修改源码、测试、构建产物，未发布、未 commit/push。

## [v1.91] - 2026-07-24

### PC 销售总览目标摘要左侧标题组（本地实现、Review、QA 通过并已发布测试 App，未推送 GitHub）
- 用户确认将 PC“销售总览”标题行中 v1.82 原本位于中间的目标摘要移动到左侧，参考图 2：左侧同一组 `销售总览 + 订单目标/订单达成/零售目标/零售达成/时间进度`，右侧维持车系筛选器；摘要紧跟标题、非居中，不再采用 `销售总览｜目标摘要｜车系筛选` 的三段居中布局。
- 新增 `REQ-013 / AC-292～AC-297`：覆盖左侧标题组结构、五项固定顺序和颜色语义、1280/1366/1440px 浅深主题单行完整、不隐藏/不换行/不截断/无横向滚动、车系筛选保持最右且可用，以及 loading/success/error 摘要或错误文案紧接标题、hidden 只显示标题且不留空槽。
- 锁定非目标：不改指标卡、数据口径、目标数据源、目标自然键、目标实际 SQL、v1.81 异步加载、筛选、表格目标槽、导出字段、移动端、发布配置或依赖；只修订 PC 标题行布局位置。
- 历史处理：v1.82 已发布测试 App、AC-243～AC-250、Phase 3V Review/QA 和 v1.82～v1.85 共享隔离组合包记录继续作为历史事实保留，不改写为当前发布或当前验收。
- 完成状态：v1.91 已完成本地实现、独立 Review 与 QA；loading skeleton 为 `172×12` 五段单行；定向 Node `2/2`、PC `12/12`、lint/build PASS。完整 suite 仅 `2` 个 Node + `1` 个 PC 因 `settings=test` 与历史 `production` 期望冲突失败，确认为范围外既有配置冲突。
- 测试 App 发布成功：App `q0844640cf6734877a3193d6`，发布源 `/tmp/retail-v191-app-test-rK5Xyi/multi-store-super-app`，命令 exit `0`、`operation=update`、`version=0.1.0`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a/`；settings 为 `environment=test`，单店 URL=`r8ce093b6d93143d8aa6852f`；zip SHA-256=`1f58981613e3ce1c346a743406179c0ba2f90fc1fd61d3cda38c6309587b504a`、`31 files`，`unzip` 与隐私扫描通过。
- 更新设计文档 `docs/superpowers/specs/2026-07-24-sales-target-header-inline-layout-design.md`：状态改为本地实现、Review、QA 通过并已发布测试 App，当前方案为左侧标题组，并重述原“中间”布局为 v1.82 历史。
- GitHub 生产配置提交 `6f125ce` 已形成，但 push 因 SSH publickey 被拒，未推送 GitHub；本次文档回写不修改 `DEV-PLAN.md`、代码或发布配置。

## [v1.90] - 2026-07-24

### q084 生产配置已发布（production）
- 用户变更：既有多店 App 仍使用 `q0844640cf6734877a3193d6`，但当前准备发布配置从 `environment=test` 切换为 `environment=production`；门店详情跳转从测试单店 `r8ce093b6d93143d8aa6852f` 改为生产单店 `aca59d2e2e60f4be4b8b93ac`。
- 冲突解决：`Product-Spec.md` 中原“测试多店 App q084 MUST 使用 environment=test、不得跳生产单店”的当前合同被本版本 supersede；历史测试发布记录继续保留为历史事实，不改写成生产发布。
- 范围：只更新源文档、`multi-store-super-app/settings.json` 和直接依赖当前 settings 的自动化合同；`runtime-config.js` 已有生产兜底，除非门禁发现不一致不修改；不更新旧多店 App `x944c089c3c4249ea925fde6`，不创建新 App，不 commit/push。
- 门禁完成：干净 staging 为 `/tmp/q084-prod-staging-KHOClv/multi-store-super-app`；source manifest `67` files，manifest SHA-256=`98e6f480903c2d80534fe004230f08c3a85ebdf35c314c9a6bb76f33fb9f3202`。`npm ci --ignore-scripts` 安装 `31` packages、audit `32` packages、`0` vulnerabilities；`npm test` `156/156`；`npm run lint` Syntax check `45 files`；`npm run build` PASS，保留既有 Vite classic script warning；`npm run test:pc` `105/105`，仅既有 `NO_COLOR`/`FORCE_COLOR` warning；`npm audit --omit=dev --audit-level=critical` `0` vulnerabilities。
- 产物核验：`dist` 为 `31 files / 621880 bytes`；`dist/settings.json` 为 `environment=production`，测试映射仍为 `r8ce...`，生产映射为 `aca...`；29 个复制型运行时文件 source/dist 一致；dist 隐私/安全扫描 `/Users/`、密钥前缀、API key、明文密码、`.env/.db/credentials/.pem/.key` 命中均为 `0`；构建产物门店详情 URL 指向 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/` 并保留门店、日期、品牌、区域、车系和来源参数；Material `expand_more` path 存在，未命中 `⌄/⌃` 车系图标逻辑。
- Code Review：主 Agent 已完成快速 Code Review，Stage 1/2 PASS，P0/P1/P2=`0/0/0`，明确可发布。
- 发布回执：北京时间 `2026-07-24 18:02 CST` 从 staging 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path . --raw`，exit `0`，stdout/stderr 合并输出显示 `app publish 执行成功`、`操作: update`、`appId: q0844640cf6734877a3193d6`、`版本: 0.1.0`、`压缩包: /private/tmp/q084-prod-staging-KHOClv/multi-store-super-app/dist.0.1.0.zip`、`访问地址: https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；标准输出未返回 `fileKey`。
- 发布包核验：最终 `dist.0.1.0.zip` SHA-256=`5c91405087924da6a482163307405eb33ce0c8e9744fa3b4369ca68155f4204a`、大小 `147855` bytes，`unzip -t` PASS，解包 `31 files / 621880 bytes`；zip 内 `settings.json` 为 `environment=production`，production URL 为 `https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/`；`app.js` SHA-256=`49326df5684a7dac2e1b3724b6f5558ed6066503492246c2acaaf051e76e323d`、`visual-sync.css` SHA-256=`529ce79388c4397a27e6cd06d402993a598facff9bc476a8c2de3e790be4e2b9`、`settings.json` SHA-256=`d2a67c64228568f024fd53a6dcd56b6b7869c7c990dc8bfd68f64efc498cee48`、`runtime-config.js` SHA-256=`3682e6b3637768865322e4e85e325809a35a0b0bf2dc31de51a6c08c2a0645af`，四个关键文件 source/dist/zip 三方一致；zip 解包隐私/安全扫描 0，Material `expand_more` path 存在，未命中 `⌄/⌃` 车系图标逻辑。
- 发布后最小匿名核验：入口 HEAD final `401`、0 redirects；入口 GET `302 -> /open-apps-redirect/q0844640cf6734877a3193d6/ -> 200 text/html`，仅证明认证/平台壳边界，不能代表登录态 UI 或业务数据验收。
- 当前状态：已覆盖发布唯一目标 `q0844640cf6734877a3193d6` 为 production 配置；未更新旧 `x944`，未创建新 App，未 commit/push；按用户明确要求未执行发布后独立 QA，未做登录态线上 UI 验收。

## [v1.89] - 2026-07-24

### PC 车系筛选下拉图标 Material Symbols 合同（已完成并通过 Review/最终 QA）
- 补充 PC 车系筛选触发器图标合同：下拉图标采用 Material Symbols `expand_more` 设计形态，本地 CSS mask 或内联 SVG path 实现，不依赖外网字体；关闭态朝下、展开态旋转 180deg，18px 视觉尺寸，颜色继承品牌蓝。
- 保持车系筛选多选、URL 参数、查询、菜单、ARIA 逻辑不变；图标仅作装饰，保留 `aria-hidden=true`，不得继续使用 `⌄/⌃` 文本箭头。
- 验收证据：定向 Playwright `1/1`、lint `45 files`、build PASS、Code Review Stage 1/2 PASS、最终 QA PASS，P0/P1/P2=`0/0/0`；1440x900 截图 `multi-store-super-app/validation/pc-vehicle-series-material-icon-1440x900.png`，SHA-256=`4eb64ed72db786d2855e68c85d4560692721f23f6f71d1906e6b987daa3befbb`；未发布、未 commit/push。

## [v1.88] - 2026-07-24

### PC 订单目标切换为打铁最终目标输出（需求已确认，开发中/待复审）
- 新增 `REQ-011 / AC-283～AC-290`：PC 订单目标从 `r05b1e3995b0b4480991a4b8` 的 `总订单目标` 拆出，改读打铁 ETL `va7f9d6b8616a421c852b04c` 最终输出 `u32cb7e789f7443ff84160b4` / `打铁运营机制看板目标`；零售目标仍读 `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标`，零售链路、字段和口径不改。
- 锁定口径来源：`h9828e20e9026475091ae6ca` / `打铁-目标上传` 只是上游输入，不得作为 Super App 订单目标最终源；`u32` 字段限定为 `日期、品牌、大区、小区、经销商、车系、订单目标、大区代码、小区代码、经销商代码`。订单目标以 `u32` 输出行为唯一事实源，订单行的 `日期/品牌/车系/订单目标` 为必需字段，组织代码可为空；组织定位优先用代码，代码为空时用 `u32` 自带大区/小区/经销商名称归入对应层级汇总，不按 `validDealerMap` 排除。
- 锁定对账验收：`2026-07 / MG / 全部车系` 的 `u32` 订单目标真实只读证据为 `1576` 行，7 个大区必须为 `1995/5597/1950/2850/2615/5179/2638`，合计 `22824`；其中 `12` 行大区/小区/经销商代码为空但保留组织名称，订单目标 `115`，必须计入全国和对应大区守恒，不得因 `invalidKey`、`validDealerMap` 或空代码被排除。`h982` 上传原表直汇总为 `22614`，但不得作为 App 最终订单目标对账值。
- 明确组织规则拆分：订单目标按 `u32` 自带组织字段聚合，零售目标继续按 `r05 + validDealerMap` 既有规则取交集；不得用别名补码、硬编码补差或有效经销商维表反向改写 `u32` 目标组织。订单实际达成分子仍按现有有效一级经销商代码与车系聚合，无法映射到实际分子的订单目标行分子为 `0` 并进入审计，不得伪造达成。
- 明确 ETL 差额边界：`u32` 相比 `h982` 的 `210` 差额属于当前打铁看板口径，差额来自上海安吉 `+138`、荆州有为 `+72`；其中荆州有为存在同一 `dealerCode+车系` 两行输出，本次不修打铁 ETL、不在 App 另行去重，否则会与看板不一致并低于 `22824`。
- 锁定非目标：不改 UI、销售/过程指标、订单实际 SQL、零售实际 SQL、零售目标源、导出字段集合、筛选、移动端和发布配置；只更新目标数据源拆分、订单组织守恒、目标状态隔离与审计。订单源失败时仅订单目标不可用，零售仍可展示；零售源失败时仅零售目标不可用，订单仍可展示。
- 更新 `Product-Spec.md` 与 `DEV-PLAN.md`：新增开发中/待复审 Phase 3AB，实施文件和测试清单写入计划；不修改源码、构建产物或发布配置，未 commit、未 push。

## [v1.87] - 2026-07-24

### PC 过程表现 CSV 三列数值化导出（本地实现、Code Review 和工程门禁完成，独立 QA 待文档回写后复核，未发布）
- 新增 `REQ-002 / AC-282`：现有 `PROCESS_TABLE_METRIC_LABELS` 9 个过程指标各拆为相邻三列 `<指标>(%)`、`<指标>月环比(百分点)`、`<指标>周环比(百分点)`，按现有指标顺序逐项 current→month→week，共 27 个指标列；组织名称继续作为首列。
- 数据单元格只输出可统计数值，例如页面 `10.3% / 月-4.5% / 周+0.1%` 导出为 `10.3`、`-4.5`、`0.1`；不带 `%`、`+`、`月`、`周`、斜杠或其他文案。不可比、加载失败、数据不完整或无值输出空单元格，合法 0 输出 `0`。
- 无论页面月环比/周环比开关状态，CSV 固定包含 current、month、week 三列；选中具体车系时保留现有车系边界说明行，现有导出入口、当前分层/全部经销商扁平范围、CSV 文件格式与安全转义、数据查询、页面 UI、移动端和发布配置不变。
- 版本冲突核对：当前最高已占用版本为 v1.86、最高 AC 为 AC-281、最高 Phase 为 3Z，本增量使用下一个未占用编号 v1.87 / AC-282 / Phase 3AA，不回写 v1.86 及更早历史内容。
- 已更新 `multi-store-super-app/app.js` 与 `multi-store-super-app/validation/pc-role-drilldown.spec.js`，并由 `npm run build` 生成 `multi-store-super-app/dist/app.js`；定向 `2/2`、Node `147/147`、PC `101/101`、lint Syntax check `45 files`、build PASS、audit `0`，source/dist `app.js` `cmp=0`、SHA-256 均为 `be44429dc33c3f63f7d8a0cf540867cf3135a4b9097690d9a1be4f679dff3665`。
- Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/1`，唯一 P2 为既有超长文件债、不阻断；独立 QA 首次复核唯一 P2 为文档状态未回写，待本次回写后复核，不提前记录最终 QA PASS。
- 未发布测试 App或生产，未 commit、push，未做登录态线上验收。

## [v1.86] - 2026-07-24

### DCC 打铁四项门店范围合同（已发布测试 App）
- `REQ-012 / AC-272～AC-281` 已完成本地实现：DCC 来源四项（首跟通话60s占比、30分钟跟进率、24小时跟进率、2天3呼率）门店范围改为官方打铁看板 8 条业务过滤后的全部 DCC 门店，不再与 Super App `validDealers` 求交；观远 DCC 数据集行级权限仍是安全边界，无 DCC 授权、查询失败或范围不可证必须 fail-closed。
- DCC 组织归属已落地：DCC 聚合按 DCC 事实自身大区/小区/经销商代码名称构建，显式 `area/district/dealer` 筛选继续下推 DCC 自身组织字段；DCC 与非 DCC 门店骨架取安全并集，DCC-only 门店 DCC 指标可显示、非 DCC 指标显示 `--`；父级按各来源自身分子分母重聚合，不平均门店率。
- 完成修复：名称 fallback、比较期缺行、DCC 名称、`fieldGapReason` 当前/月/周/CSV 证据链；缓存 query 升级为 `20260724-dcc-scope2`。修改源码 `iron-metrics-api.js`、`iron-metrics-model.js`、`iron-metrics-view.js`、`app.js`、`index.html`；测试 `iron-metrics-query.test.mjs`、`iron-metrics-contract.test.mjs`、`iron-metrics-app-integration.spec.js`，既有 drill/export 测试仅作回归。
- 验收证据：专项 `35/35`、Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`；Code Review 首轮 `0/4/1`，修复后 Stage 1/2 PASS，最终 `0/0/2`（P2 仅大文件拆分、浏览器集成偏 API 直调）；独立 QA PASS `0/0/0`。
- AC-272 真实证据：前置认证态直接 SQL 聚合 7 区与官方截图逐行一致且误差 `<=0.05pp`：南 `2021/2198`、华中 `5301/5750`、西 `1651/1785`、苏皖 `2688/2973`、北 `2812/3132`、东南 `4223/4638`、中南 `2275/2404`。当前刷新边界：后续 `guancli auth status` 60s 无输出，direct SQL 60s/90s `ETIMEDOUT` 且无 stdout/stderr；该刷新失败不否定前置证据。
- 已发布测试 App：北京时间 `2026-07-24 12:54:09 CST`，从当前 `multi-store-super-app/` 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，回执 exit `0`、`operation=update`、`version=0.1.0`，标准回执未返回 `fileKey`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。
- 发布包与门禁：`dist.0.1.0.zip` SHA-256=`37f676a0e50ad7f4d63032da63b680d6df51a21f6fb380bb689a4d4542353ab2`、`143510` bytes、`unzip -t` PASS；`dist` 为 `31 files / 600836 bytes`。发布前门禁为 Node `147/147`、PC `99/99`、lint `45 files`、build PASS、audit `0`、隐私扫描 `0`，source/dist `29` 个复制型运行时文件一致。
- 匿名 HTTP `401` 仅证明认证边界；未做登录态线上 UI 验收，未发布生产，未 commit 或 push。不变项仍包括销售、过程分析、IP/意向/试驾打铁来源、UI、目标、环比周期、导出入口、车系 fail-closed、其他公式、移动端、发布配置和依赖。

## [v1.85] - 2026-07-24

### PC 订单/零售稳定唯一排名（已随 v1.82～v1.85 共享隔离组合包发布测试 App，发布后独立 QA PASS）
- 依据已确认设计 `docs/superpowers/specs/2026-07-24-unique-ranking-tiebreak-design.md`，新增 `REQ-002 / AC-259～AC-271`：PC 销售概览中的订单排名、零售排名在大区、小区、经销商三级统一改为稳定唯一排名，主指标降序，同值按当前层级组织代码升序拆分，连续输出 `1/n ... n/n`，不得展示或导出并列排名。
- 锁定适用范围：大区层、小区层、经销商层、投资人 portfolio、当前范围全部经销商扁平模式、当前 `drillPath` 收窄、单店收窄、全 0、53 对象末尾同值和导出同步。
- 锁定不变项：比较集合、排名总数、订单/零售占比分母、全国完整性门禁、车系筛选、权限白名单、组织筛选、日期筛选、数据查询、动态诊断、目标字段、过程分析、打铁指标、移动端、发布配置和依赖均不因本次改动变化。
- 非目标：不新增字段、数据源、SQL、接口参数、前端状态、tooltip、组织代码展示、并列名次说明、末位人数说明或导出列；不引入随机数、时间戳或输入数组原始顺序作为拆分依据。
- 后续已完成本地实现并以原子提交 `ab55c19` 落地（仅 3 文件）；本次仅同步 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md` 最终状态。
- 门禁通过：Node 定向 `23/23`、`npm test` `141/141`、lint Syntax check `45 files`、build exit `0`、audit `0`、完整 PC `99/99`；最终 QA 收尾 `23/23` 和新增 53 行 PC `1/1`。独立 Review 最终 P0/P1/P2=`0/0/1`（P2 为既有超长文件债，不阻断），最终 QA PASS P0/P1/P2=`0/0/0`；source/dist `organization-view` SHA-256 均为 `4980a43ba0309680e40bb2788308e5025acef659dcea3e1d4490f7ac89bd6b9c`。
- **最新测试 App 发布：** 北京时间 `2026-07-24 12:03:44 +0800`，从稳定隔离目录 `/tmp/multistore-release-20260724-RzqeFk/multi-store-super-app` 执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，将 v1.82 / Phase 3V、v1.83 / Phase 3W、v1.84 / Phase 3X、v1.85 / Phase 3Y 共享组合发布至测试 App `q0844640cf6734877a3193d6`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；回执 exit `0`、`operation=update`、`version=0.1.0`，标准回执未返回 `fileKey`。发布源为 v1.82 QA 冻结副本叠加提交 `ab55c19` 的 v1.85 三文件，明确排除 v1.86 / Phase 3Z，不等同当前共享工作树。
- **最新发布包与门禁：** `dist.0.1.0.zip` SHA-256=`cd3e69e3f2f8755c865142026b40bee52f6ea5f229701c060a1b6bfa92c77360`、`141400` bytes、`31 files / 590940 bytes`，`zip -T` 通过；`npm ci` 31 packages / 0 vulnerabilities、Node `137/137`、lint `45 files`、build exit `0`、audit `0`、完整 PC `99/99`、隐私扫描 `0`。source/dist/zip 三方关键文件一致：`app.js` SHA-256=`3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17`、`visual-sync.css` 前缀=`53109529...`、`organization-view.js` SHA-256=`4980a43ba0309680e40bb2788308e5025acef659dcea3e1d4490f7ac89bd6b9c`。
- **发布后 QA：** 独立 QA PASS，P0/P1/P2=`0/0/1`；唯一 P2 是 Vite 正常重写 `dist/index.html` CSS bundle，导致 source/dist `index.html` 哈希不同，不影响关键业务文件同源或功能，不建议回滚。匿名 HEAD=`401`、GET=`302` 跳转至平台壳，只证明认证边界；未完成登录态业务 UI/真实数据终验。未发布生产、未 commit、未 push。

## [v1.84] - 2026-07-24

### PC 销售表现排名 CSV Excel 文本保护（已发布测试 App，发布后独立 QA PASS）
- 新增 `REQ-013 / AC-258`：PC 销售表现导出 CSV 中 `订单排名`、`零售排名` 在 Excel 直接打开时必须保持可见 `x/y` 文本，例如 `1/7`、`7/7` 不被自动解析为日期；标准 CSV 解析或导入后仍可还原原始 `x/y` 排名语义。
- 锁定非目标：不改变排名计算、其他导出列、导出范围、文件类型/依赖、公式注入防护、页面 UI、数据查询、移动端或发布配置。
- 发布前 Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/0`；独立 QA PASS，P0/P1/P2=`0/0/0`。
- 门禁通过：AC-258 定向 `1/1`、AC-258 + 公式注入/RFC4180 `2/2`、`npm test` `134/134`、lint Syntax check `45 files`、完整 PC `98/98`、build PASS（QA 在 `/tmp` 临时副本）、audit `0`；source `app.js` 与 `dist/app.js` SHA-256 均为 `3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17`。
- 最终验收覆盖代码机制、实际 CSV 字节/解析与自动化；无用户截图对应 Windows Excel 实机，不冒充 Windows Excel 直开实机验收。
- 发布源为 `/private/tmp/ac258-build-kTHdjn`；执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path .`，最终成功回执 exit `0`、`operation=update`、`appId=q0844640cf6734877a3193d6`、`version=0.1.0`，URL=`https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；标准回执未返回 `fileKey`。
- 最终 zip SHA-256=`b58a77a0da195968c801d96ee4a057eed6865f62a437a845f73aafe50b113706`，`141411` bytes、`31 files / 591132` 解包字节，`unzip -t` 通过；zip 内 `app.js` SHA-256=`3955336b81d65acc1e60c31d922887fafc53375d6fa428e5bf86526c73f6be17` 且包含 `excelTextRank`，zip 内 `organization-view.js` SHA-256=`36257c5f1ed3613b41260c34092a84b642c4ecd462464c7cac3a19d1ad9d5ee9`，保留 `previousValue/previousRank` 的 v1.84 竞争排名，明确未带入 v1.85。
- 发布设置为 `settings=test`，测试单店 `r8ce...`、生产回退 `aca...`，隐私扫描 `0`。发布后独立 QA PASS，P0/P1/P2=`0/0/2`，两个 P2 仅要求文档同步/边界澄清并随本次同步关闭。
- 匿名 HEAD 关键资源为 `401`、GET 为 `302` 跳转，追随后为 `200 text/html`，仅证明登录保护；未做登录态 UI 或线上资源哈希验收。当前工作区源码已进入后续并行版本，不等同发布源；发布同源只限 `/private/tmp/ac258-build-kTHdjn` 的 source/dist/zip。未发布生产，未 commit、push。
- **最新状态：** 上述 `/private/tmp/ac258-build-kTHdjn` 与 SHA-256=`b58a...` 为 v1.84 单版本历史发布；测试 App 最新发布已由 `2026-07-24 12:03:44 +0800` 的 v1.82～v1.85 共享隔离组合包覆盖，最新包和发布后 QA 证据见 v1.85 章节，v1.84 功能仍在包内。

## [v1.83] - 2026-07-24

### PC 过程标签两波加载与渲染预算修复（已随共享隔离组合包发布测试 App，发布后独立 QA PASS）
- 锁定 `REQ-013 / AC-251～AC-257`：`loadNegativeProcess` 第一波只启动 current × ip/drive，结算并校验 token 后合并当前期结果；token 有效才启动第二波 previous/week × ip/drive 四个高层任务，同波 `Promise.allSettled`。
- 锁定渲染预算：current 波结算后 `buildWorkbench + rebuildIronStores` 各 1 次、`processStage=current`、只刷新过程分析表 1 次；第二波结算后再 `buildWorkbench + rebuildIronStores` 各 1 次、`processLoading=false`、`processStage=week`、更新 `processError`，只刷新过程分析表 1 次和动态诊断 1 次；全程不得调用 `renderFunnel`，不得循环尾重复渲染。
- 锁定 token 门禁：第一波期间失效不得启动第二波或回写任何过程状态；第二波期间失效不得回写最终状态。
- 锁定非目标：保留 `state.processErrors[kind][stage]`、evidence、5000 fail-closed、SQL/fallback、`0.0%/--/数据不完整`；不修改 `data-api.js`、`metrics.js`、公式、日期范围、车系、组织权限、顶部四项、打铁、导出、移动端、依赖、发布配置，不发布、commit 或 push。
- 测试范围：扩展 `validation/process-tags-kind-state.test.mjs` 为受控 deferred Promise 行为测试，覆盖 current 并发、比较期四项同波启动、渲染预算、阶段失败隔离、两类 token 失效、current 未完成不提交比较期，并继续保留既有 SQL/fallback/evidence 断言；同步更新 `validation/pc-role-drilldown.spec.js` 中本次相关 PC 回归用例，把旧 current/previous/week 三波等待适配为 current 2 请求 + comparison 4 请求显式断言，并保留 A→B token 失效导航切换场景。
- 门禁通过：定向 `node --test validation/process-tags-kind-state.test.mjs` 8/8；`npm test` 134/134；`npm run lint` Syntax check 45 files；`npm run build` PASS；`npm run test:pc` 95/95；`npm audit --omit=dev --audit-level=critical` 0 漏洞。QA 快照时 `app.js` 与 `dist/app.js` 整文件 SHA-256 一致；随后并行 v1.82 销售目标摘要 DOM 修改导致当前整文件不同，但 `loadNegativeProcess` 至 `loadIronMetrics` 修复切片 source/dist 仍逐字一致（SHA-256=`1330d39d6e952faa520ddb758656d668bf66a24e1c7713980624a7655123f123`，cmp=0）。
- 独立 Code Review Stage 1/2 功能 PASS，无 HIGH；最终独立 QA PASS，P0/P1/P2=`0/0/0`；并行变化后当前源码重新复跑定向 `node --test validation/process-tags-kind-state.test.mjs` 8/8、相关 Playwright 3/3 通过，QA 独立复跑记录保留相关 Playwright 3/3 与 4/4。两个非阻断 LOW（生产测试全局开关硬化债、比较期 pending 暂显示 `--`）记录为后续项，不扩展本次修复。已进入 v1.82～v1.85 最新共享隔离组合包，发布与发布后 QA 证据见 v1.85 章节；未发布生产、未 commit、未 push，未做登录态业务 UI 或观远真实环境验收。

## [v1.82] - 2026-07-24

### PC 目标摘要迁入销售总览标题行（已随共享隔离组合包发布测试 App，发布后独立 QA PASS）
- 用户已批准新方案 A：目标摘要不再作为销售/过程指标上方独立通栏展示，迁入“销售总览”标题行中间，即位于 `销售总览` 标题与最右侧车系筛选之间；标题行固定三段为 `销售总览｜目标摘要｜车系筛选`。
- 本版本明确 supersede v1.79 中“独立销售经营进度条 / 单独占一行”的布局条款，但不改变 v1.79/v1.81 已确认的业务口径、状态口径、目标数据源、目标自然键、目标实际 SQL、异步加载、表格目标槽、导出、筛选或移动端边界。
- 新增 `REQ-013 / AC-243～AC-250`：覆盖五项固定顺序 `订单目标 → 订单达成 → 零售目标 → 零售达成 → 时间进度`、纯文字辅助视觉、目标蓝/达成绿/时间灰蓝、1280/1366/1440 浅深主题单行完整、不隐藏/不换行/不截断、无新增横向滚动、下方销售/过程指标同起点同高、loading/success/hidden/error 状态。
- 状态规则保持：loading 在标题行中间显示五段行内骨架且销售/过程主链路先行；有目标正常展示；无目标、跨月、未来月、非 MG 或目标隐藏时摘要整体隐藏；失败时标题行中间仅显示 `月目标数据暂不可用`。
- 新增设计文档 `docs/superpowers/specs/2026-07-24-sales-target-header-inline-layout-design.md`，记录结论、信息架构、响应式数值边界、状态、数据流不变、测试和范围边界。
- 设计阶段最初只更新 `Product-Spec.md`、`Product-Spec-CHANGELOG.md` 和设计文档；后续 Phase 3V 已完成 `app.js`、`visual-sync.css`、`validation/pc-role-drilldown.spec.js` 的本地实现与对应构建产物同步，未改变发布配置。
- Phase 3V 隔离 Code Review PASS，P0/P1/P2=`0/0/0`；隔离门禁为 Node `134/134`、PC `97/97`、lint/build/audit 通过。
- 2026-07-24 最终 QA 冻结快照（包含当时并行 `excelTextRank` / `AC-258`，尚未包含后续 Phase 3Y）通过定向四态 PC `6/6`、Node `137/137`、PC `98/98`、lint Syntax check `45 files`、build exit `0`、audit `0`；24 张 loading/success/hidden/error × 1280/1366/1440 × light/dark 截图通过，source/dist 的 `app.js` 与 `visual-sync.css` 一致。
- v1.82 可交付结论以 Phase 3V 隔离 Review/QA 为主；上述全局计数、24 张截图和 source/dist 同源仅为当时冻结快照证据，不承诺后续共享工作树计数不变。AC-258、后续 Phase 3Y 及其他并行改动不属于 v1.82 的独立背书，必须由各自任务独立 Review/QA。v1.82 已进入 v1.82～v1.85 最新共享隔离组合包，发布与发布后 QA 证据见 v1.85 章节；未发布生产、未 commit、未 push。

## [v1.81] - 2026-07-23

### PC 首屏销售渲染与目标异步解耦（已完成并发布测试 App）
- `REQ-013 / AC-236～AC-242` 已完成：修复 q084 测试 App 首屏变慢问题。根因已确认：月目标请求硬阻塞首屏，`loadSalesRaw` 曾在 `Promise.all` 中同时等待 `salesBundle`、`vehicleSeriesOptions`、`loadMonthlyTargetRaw`，`app.js` 在目标完成前不解除全局 loading。
- 实际实现：拆分销售主链路与月目标后台链路；销售事实、车系枚举和有效组织范围完成后立即渲染真实销售指标、过程指标、销售概览表和可用组织行；月目标独立 pending/success/error，经营进度条和表格目标槽显示同尺寸加载态并在成功后局部回填。
- 目标失败、无权限、业务码失败或超时不阻断销售/过程主链路，不让已渲染销售卡、过程卡、销售概览表回退为全局骨架；旧筛选目标结果受同一 `loadToken` / generation 门禁约束，不覆盖新上下文。
- 目标 preview 已在字段映射确认时追加组织条件：`areaCode -> rfs_code`、`districtCode -> mac_code`、`dealerCode -> dealer_code`；组织条件只减少读取量，不改变目标自然键、目标数据源、目标实际 SQL、有效经销商维表归属、车系集合、自然月窗口或导出字段；字段缺失时保留无下推 fallback。
- 实现与测试涉及 `multi-store-super-app/app.js`、`multi-store-super-app/data-api.js`、`multi-store-super-app/validation/monthly-target.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`，未新增依赖，未改移动端、打铁指标或发布配置。
- 门禁证据：Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/2`；最终 QA 功能门禁通过，`npm test` 130/130、`npm run test:pc` 95/95、lint Syntax check 45 files、build PASS、audit 0、1280/1440 浅深色通过。
- 测试 App 发布记录：发布命令重新构建并重打包后，`guancli app publish --app-id q0844640cf6734877a3193d6 --path .` 成功；`operation=update`、版本 `0.1.0`、`artifact=dist.0.1.0.zip`、`fileKey=1d9e70c3-938c-409d-b4e0-e1be26035edc`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。最终 zip SHA-256=`3125ba0859ff122ba05aa2029eab924d2a7dbe2ab689f4a079b5104aa1810359`，zip 完整性通过，关键四文件 source/dist/zip 三方哈希一致。未发布生产、未 commit、未 push。

## [v1.80] - 2026-07-23

### PC 打铁指标优质试驾看板链接（已随测试 App 发布）
- `SCOPE-025 / TASK-018 / REQ-012 / AC-235` 已完成本地实现：PC “打铁指标”二级 Tab 右侧工具栏在已完成“打铁运营看板”右侧新增固定外链“优质试驾看板”，两个外链共存，顺序固定为 `打铁运营看板 → 优质试驾看板`。
- “优质试驾看板”完整 URL 固定为 `https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa`，已验证原样保留 `pgId` 和 `id` 查询参数；两个外链均使用 `<a target="_blank" rel="noopener noreferrer">` 新窗口安全打开，不让当前 Super App iframe 导航离开。
- 实现文件 6 个：`index.html`、`iron-metrics-view.js`、`iron-metrics.css`、`validation/iron-metrics-pc-tabs.spec.js`、`validation/iron-metrics-a11y-visual.spec.js`、`validation/iron-metrics-query.test.mjs`。
- 交互和视觉已验证：键盘 `Tab → Tab → Enter` 可触发，非默认 `vehicleSeries=全新MG4` + `allDealerMode=true` 状态不污染；8 张现有 iron-metrics 邀约/试驾 1280/1440 浅深截图已刷新并通过；既有 Vite classic script 与 `NO_COLOR` warning 非阻断。
- 门禁通过：`npm test` 126/126、`npm run test:pc` 87/87、定向 pc-tabs 10/10、lint Syntax check 45 files、build PASS、audit 0、敏感扫描 0、`git diff --check` PASS。
- Code Review 初审 PASS P0/P1/P2=`0/0/2`，两项 P2 均为测试强度；补测后复审最终 PASS P0/P1/P2=`0/0/0`。
- 依赖仍为既有 Phase 3R 外链组件，与 v1.79 `REQ-013 / AC-227～AC-234` 销售经营进度文件和功能边界独立。已随北京时间 `2026-07-23 16:49:52` 的同一测试 App 包发布至 `q0844640cf6734877a3193d6`（`operation=update`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`）；发布包 SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`。未发布生产、未 commit、未 push。

## [v1.79] - 2026-07-23

### PC 销售经营进度条与时间进度（已开发、Review/QA 通过并发布测试 App）
- 新增 `REQ-013 / AC-227～AC-234`：PC 顶部销售总览在“销售指标”和“过程指标”两个并排模块上方新增独立“销售经营进度”条，条内展示订单目标、订单达成、零售目标、零售达成、时间进度。
- 时间进度公式锁定为 `今天日期序号 / 当月月末日期序号 * 100%`，展示 1 位小数；例如 7 月 23 日为 `23 / 31 = 74.2%`。时间进度使用中性灰蓝，不使用绿色/红色，不表达达标。
- 经营进度条整体继承既有目标摘要降级：跨月、未来、非 MG、无目标时整条隐藏；请求失败可显示既有“月目标数据暂不可用”类文案；不得单独显示时间进度。
- 锁定布局边界：销售指标和过程指标模块内部仅标题 + 指标卡；七张指标卡继续只展示当前值、月环比、周环比，月环比/周环比上下两行；1280/1440 浅深主题下仅经营进度条内部自然换行，不得造成页面级横向溢出或破坏下方卡片同高、同起点、同水平基线。
- 新增设计文档 `docs/superpowers/specs/2026-07-23-sales-time-progress-layout-design.md`；Phase 3T 已据此完成开发，`AC-227～AC-234` 全部关闭。
- Code Review Stage 1/2 PASS，最终 QA PASS，P0/P1=`0/0`。门禁通过：Node 126/126、PC 89/89、lint Syntax check 45 files、build PASS、audit 0、隐私扫描通过；source/dist 的 `app.js` 与 `visual-sync.css` SHA-256 一致。
- 1280/1440 浅色、深色四张截图通过；对比度为浅色 target/achievement/time=`6.83/5.48/5.10`，深色=`8.43/10.13/8.69`。
- 已发布测试 App `q0844640cf6734877a3193d6`：`operation=update`、版本 `0.1.0`、`fileKey=b9d58203-1406-4160-aea8-63e4aeed5615`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。发布包 `dist.0.1.0.zip` SHA-256=`e9dbd6c3a61ae4ee7c02ff96469ab3ce10da6f9bc54e168cd845c0dff6f00a21`、`139940` bytes、`31 files / 583411 bytes`。
- 匿名入口 HTTP 401 只证明登录保护；Chrome 父应用刷新后自动 DOM/截图持续超时，未完成登录态线上 UI 验收。未发布生产、未 commit、未 push。

## [v1.78] - 2026-07-23

### 打铁指标固定运营看板链接（已发布测试 App）
- Phase 3R / AC-226 已完成：PC “打铁指标”二级 Tab `邀约指标 7 / 试驾指标 4` 右侧新增固定外链“打铁运营看板”，URL、`target="_blank"`、`rel="noopener noreferrer"`、样式与位置均通过验证；未移动既有二级 Tab、表格、导出入口或一级 Tab，未改变打铁状态与数据口径。
- 门禁通过：`npm test` 126/126、`npm run test:pc` 86/86、lint Syntax check 45 files、build、audit critical=0、隐私扫描通过，1280/1440 浅色与深色截图通过。
- Code Review PASS，P0/P1/P2=`0/0/2`；P2 均非阻断，其中既有 `validation/iron-metrics-query.test.mjs` 424 行测试文件拆分债本轮不拆。发布后独立 QA PASS，P0/P1/P2=`0/0/0`。
- 已发布测试 Super App `q0844640cf6734877a3193d6`：`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；发布包 `dist.0.1.0.zip` SHA-256=`6f59891701ed953f8cd95173d1639cb99c90b318137cb3035a14ae06cfb7fd22`、`139391` bytes、`31 files`。匿名入口 302/401 仅表示登录保护，未做登录态线上业务 UI 验收；未发布生产、未 commit、未 push。v1.76/v1.77 既有记录保持不变。

## [v1.77] - 2026-07-23

### 打铁指标当前范围全部经销商扁平查看最终本地 QA PASS，已发布测试 App
- 版本冲突审计：`v1.76` 已被 PC 销售概览行内四率双层漏斗合同占用，本次使用下一个未占用版本 `v1.77`；保留 v1.73 当前范围全部经销商扁平查看已完成记录、v1.75 打铁三阶段环比已发布记录和 v1.76 已完成本地实现与门禁记录不改。
- 用户纠正范围：v1.73 将“当前范围全部经销商扁平查看”限定在销售概览/过程分析，并明确打铁不启用；本次确认为范围错误，v1.77 将该能力扩展到“打铁指标”。这是对 v1.73 排除条款的增量覆盖，不回写 v1.73 已完成 AC-186～AC-198 的历史事实。
- 更新 `Product-Spec.md` 顶部状态、SCOPE-013、SCOPE-026、TASK-017、FLOW-003、REQ-002、REQ-012、数据模型、数据规则、非功能需求、完成定义和 ASM-016，并新增 AC-214～AC-225。
- 锁定三 Tab 共享状态：`销售概览 / 过程分析 / 打铁指标` 共用同一个 `allDealerMode`；进入时保存真实 `organization.viewLevel/drillPath`、销售页码、过程页码、打铁页码、打铁二级组和 `selectedStoreCode` 快照；退出时恢复；上游品牌/日期/区域/经销商/车系/iframe Query 变化时清空。
- 锁定打铁范围口径：打铁扁平态按 `上游 URL 筛选 ∩ 罗盘行权限 ∩ 有效经销商白名单 ∩ 当前 drillPath` 展示全部可见经销商，基于既有 `ironStores` / 无车系 `processBaselineData` 组织骨架派生经销商层，不新增数据集、不触发新全量查询、不用销售 `汇报车系名称` 后的销售行集补齐。
- 锁定交互和导出：打铁扁平态标题为“全部经销商打铁表现”，入口在导出按钮左侧；`邀约指标 7 / 试驾指标 4` 二级切换不得清空扁平态、范围、页码或入口文案；扁平态禁用组织下钻和面包屑返回，只保留门店详情；现有导出入口导出当前激活二级组在当前扁平范围内全部经销商行，非仅当前 15 行分页，不新增第二个导出按钮。
- 锁定非目标：不改变顶部指标、上游筛选、权限白名单、打铁 11 项公式/目标/SQL-only/来源状态/车系字段 fail-closed、DCC 新表口径、销售概览行内四率、移动端或发布配置；不新增打铁数据集、依赖或导出按钮，不发布、commit 或 push。
- 更新 `Design-Brief.md`、`DEV-PLAN.md`、`docs/superpowers/specs/2026-07-23-当前范围全部经销商扁平查看设计.md` 和 `docs/superpowers/specs/2026-07-22-打铁指标PC展示与下钻设计.md`，将实现阶段纳入 Phase 3Q。
- 本地实现已完成 AC-214～AC-225：三张一级 Tab 共享 `allDealerMode`；打铁页码、二级组和 `selectedStoreCode` 纳入进入前快照并可恢复；入口阻断按当前激活的邀约/试驾组来源状态判断，已在扁平态时保留退出入口；打铁行集只使用既有 `ironStores` / 无车系 `processBaselineData` 组织骨架。
- 独立 Review 修复闭环已完成：CSV 全量导出改为使用当前期、上月同期、上周同期三阶段 raw 数据计算值与百分点差，并覆盖 RFC4180 转义/公式注入中和；工具区、打铁分页和跳页输入补齐准确 ARIA；真实浅深主题截图为 `pc-all-dealers-iron-flat-1440x900-light.png` 与 `pc-all-dealers-iron-flat-1440x900-dark.png`。最终 Review Stage 1/2 PASS。
- 最终 QA 0 阻断；门禁证据为 `npm test` 126/126、`npm run test:pc` 85/85、lint Syntax check 45 files、build exit 0、audit critical=0；AC-214～AC-225 保持 12/12 勾选。
- 测试发布平台证据：目标 App `q0844640cf6734877a3193d6`，URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；`environment=test`，发布命令 exit 0，平台回执 `operation=update`、版本 `0.1.0`。发布包 SHA-256=`e5c138b0549a6eb2b91b89964efb417b0d63ae476e447c3dd8c189bc73518807`、`138887` bytes、`31 files / 578408 bytes` 解包，平台发布成功且包信息正确。
- 发布后独立 QA 仅有限 PASS：Chrome 登录态页面非白屏且 `销售概览 / 过程分析 / 打铁指标` 三张 Tab 可见；standalone 缺人员画像，未完成“查看所有经销商”登录态业务 UI 终验。因此不声称完整线上 QA PASS，当前不建议回滚。

### 状态
- Phase 3Q 已通过独立 Review 与最终本地 QA，并成功发布测试 App；发布后线上验证为有限 PASS，登录态业务 UI 终验未完成。未发布生产、未 commit、未 push。

## [v1.76] - 2026-07-23

### PC 销售概览行内四率双层漏斗已完成本地实现与 Review/QA 功能门禁
- 版本冲突审计：`v1.75` 已被打铁指标月环比/周环比、DCC SQL-only 和测试 App 发布占用，本次使用下一个未占用版本 `v1.76`；保留 v1.73 当前范围全部经销商扁平查看、v1.75 打铁三阶段环比和历史移动端规划记录不改。
- 已完成 AC-206～AC-213：PC “销售概览”表第二列 `销售结果（指标：月环比）` 采用上层五段数量、下层四率的双层漏斗结构；上层为 `线索 → 到店 → 试驾 → 订单 → 零售` 五段数量及数量月环比，下层为四个等宽转化率 `线索到店率 → 到店试驾率 → 试驾订单率 → 交付率` 及百分点月环比。
- 实现文件共 4 个：`multi-store-super-app/app.js`、`multi-store-super-app/visual-sync.css`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`、`multi-store-super-app/validation/sales-row-conversion-rates.test.mjs`。技术栈保持 HTML/CSS/JavaScript + Vite + Playwright，未新增依赖。
- 公式与粒度保持既定合同：`线索到店率=到店/线索`、`到店试驾率=试驾/到店`、`试驾订单率=订单/试驾`、`交付率=零售/订单`；四率只从当前销售概览行 `row.current` 与 `row.previous` 的原始分子/分母计算，适用于大区、小区、门店、全部经销商扁平查看、投资人门店集合和车系筛选后的销售事实，不得平均门店率。
- 首次 Code Review 发现两项问题：1280px 视口右侧裁切 `41.6px`；上月同期可比率为 `0.0%` 时被误判为 `--`。两项均已修复，复跑 Code Review Stage 1/2 PASS，P0/P1/P2=`0/0/0`。
- 最终 QA 在临时副本复跑 Node `126/126`、PC `82/82`、lint Syntax check `45 files`、build exit `0`、audit critical=`0`，功能与视觉门禁均通过；首次 QA 唯一 P2 为文档状态不一致，本次已闭环修正。
- 非目标保持不变：未新增交互、悬浮层、展开态、筛选器、表格列、导出字段或第二个导出入口；未修改顶部销售/过程指标卡、过程分析表、打铁指标、订单表现、零售表现、主问题、结果断点、操作列或数据查询。

### 状态
- Phase 3P 已完成本地实现、Code Review 与 QA 功能/视觉门禁；本次修正文档状态 P2。未发布、未 commit、未 push。

## [v1.75] - 2026-07-23

### 打铁指标月环比/周环比、DCC SQL-only 与测试 App 发布
- 版本冲突审计：`v1.74` 已被打铁 `qualityTrial` 品牌语义更正占用，本次使用下一个未占用版本 `v1.75`；保留 v1.69 应用公式、v1.70 展示/下钻/导出、v1.71 逐来源结算、v1.72 SQL-only 与 v1.74 品牌语义历史记录不改。
- 更新 `Product-Spec.md` 的顶部状态、SCOPE-025、TASK-016、REQ-012、数据模型/关系/规则、非功能可靠性、完成定义和 ASM-017，并新增 AC-199～AC-205：打铁 `邀约指标 7` 与 `试驾指标 4` 两个二级模块的全部 11 项指标均展示当前值、月环比和周环比。
- 锁定比较周期：当前期使用父应用 `startDate/endDate` 或默认 `resolveDateRange(params)`；上月同期复用过程分析现有 `previousMonthRange(range)`；上周同期复用过程分析现有 `previousWeekRange(range)`。三阶段仅日期范围不同，指标公式、分子分母、去重键、日期字段、区域代码、车系字段、权限白名单、SQL-only 与完整性门禁必须同构。
- 锁定展示口径：比率环比按百分点差展示，例如当前 53.2%、上月同期 51.0% 时月环比为 `+2.2%`，不得按相对涨跌率展示；真实无分母显示 `--`，分母有效且分子为 0 显示/计算 `0.0%`。
- 锁定失败隔离：任一比较期 SQL 失败、业务码失败、超时、截断、字段缺失、字段映射未审计或完整性不可证，只让对应 `月环比` 或 `周环比` 显示 `加载失败`，当前值不受影响；当前期失败时当前值显示 `数据不完整`，两个环比显示 `加载失败`。
- 锁定前端样式语义：打铁单元格必须维护与“过程分析”同样的 DOM/CSS 语义，复用同类 `process-table`、`metric-cell`、`metric-value`、`metric-trend[data-kind="month|week"]`、`trend-prefix`、`trend-change` 结构和浅深主题 token；目标仍放指标名称下方，不新增状态标识、不生成达标颜色。
- 锁定非目标：不改变销售概览、过程分析既有指标，不改 DCC 来源查询/过滤/分页当前实现，不改变 11 项公式、目标、二级切换、组织/下钻、导出范围、权限、移动端、源码、测试、构建产物；不发布、commit 或 push。
- 更新 `DEV-PLAN.md`：新增 Phase 3O，记录打铁三阶段比较、过程分析样式对齐、关键文件、四步门禁、停止条件、覆盖矩阵、关键文件边界、风险和 DoD。

### 状态
- 实现与发布门禁已完成：`npm test` 119/119、`npm run test:pc` 74/74、lint、build、audit critical=0 和 `dist/` 隐私扫描均通过。DCC SQL 实测新表可查询，发布包确认只含新表 ``双品牌DCC话务指标182``、环比资源版本与 31 个构建文件。
- 已按用户授权更新测试 Super App `q0844640cf6734877a3193d6`：`operation=update`、版本 `0.1.0`、包 SHA-256=`293a24705b23f9c3354e91cf196f6236b8b4f7563da0d86d05e80aefc26fe520`、大小 `136515` bytes；入口重定向后 HTTP 200。未发布生产、未 commit、未 push；未执行登录态线上业务数据 UI 验收。

### 追加修订：DCC 182 SQL-only（同日）
- 用户已将 DCC 182 临时表改名去除特殊字符。经 `execute-sql-query` 实测，``双品牌DCC话务指标182`` 可查询；原 ``【双品牌】DCC话务指标_182`` 不再可用。
- AC-205 与 Phase 3O 同步改为：DCC 四项和其余打铁来源统一走 SQL 聚合，禁止 DCC preview、分页或 fallback；保留原有业务过滤、日期/组织白名单和具体车系无审计字段时的 fail-closed 边界。

## [v1.73] - 2026-07-23

### 新增
- 新增 PC 当前范围全部经销商扁平查看合同：在表现区 header 工具区、导出按钮左侧新增“查看所有经销商 / 返回分层查看”可逆入口；入口只作用于“销售概览”和“过程分析”，当前层级已为门店或切到“打铁指标”时隐藏。
- 新增 `allDealerMode` 共享状态规则：销售概览和过程分析共用同一扁平模式；激活时不改写 `organization.viewLevel/drillPath`，仅派生 `effectiveLevel=store` 并保留当前 `drillPath`，从全国、大区或当前下钻路径扁平到经销商行。
- 新增 AC-186～AC-198，覆盖全国范围、大区范围、当前下钻路径、销售/过程共享、返回分层、打铁不受影响、上游筛选重置、每页 15 家分页、导出全部扁平经销商、权限白名单、扁平排名口径、响应式与无障碍。
- 新增正式设计方案 `docs/superpowers/specs/2026-07-23-当前范围全部经销商扁平查看设计.md`，记录入口位置、状态机、范围口径、导出、分页、响应式和验收映射。

### 修改
- 更新 `Product-Spec.md` 的顶部状态、SCOPE-013、SCOPE-026、OUT-019、TASK-017、FLOW-003、REQ-002、数据模型、数据规则、非功能需求、完成定义和 ASM-016。
- 锁定扁平排名与占比口径：订单排名、零售排名、订单占比、零售占比均在当前扁平经销商集合内统一比较和计算，不按所属小区拆分。
- 锁定非目标：本次不新增数据集、不触发新全量查询、不扩大权限、不改变顶部指标、不改变打铁指标、不修改 `Design-Brief.md`，也不覆盖 v1.74 / Phase 3M；本目标不发布、commit 或 push。
- 明确不把完整文字按钮放入 sticky 操作列表头：操作列宽度仅约 6%-8% 且语义为行级动作，放入模式切换会破坏表格稳定性；入口固定在 header 工具区。
- Review 返工：独立 Review 首轮发现 AC-188 原 Given 要求真实 `store` 层点击入口不可达，已改为“总部从大区层手动下钻进入某大区小区层（真实 `viewLevel=district`、`drillPath` 仅含该大区）”后点击入口，只展示该大区当前可见经销商；真实 `store` 层已是经销商清单，入口隐藏。
- Review 返工：补齐扁平模式可逆合同。激活时保存进入前 `organization.viewLevel/drillPath`、销售/过程页码和 `selectedStoreCode` 快照；销售/过程扁平态冻结真实组织状态，面包屑返回按钮隐藏且返回事件不生效；关闭后恢复快照。切到打铁仍显示真实层级；若用户在打铁中合法下钻/返回，销售/过程扁平快照同步到最新真实层级与页码。
- Review 返工：入口隐藏条件扩展为真实 `store` 层、当前有效经销商集合 `<=1`、过程局部错误态、全局加载/空/错误/无权限均隐藏；视觉证据要求文件名和截图尺寸精确对应 `1440x900` viewport，非 fullPage 长图。

### 状态
- v1.73 / Phase 3N 已通过独立 Review 与最终 QA，本地实现完成，AC-186～AC-198 全部完成；未发布、未 commit、未 push。
- 最新门禁：`npm test` 117/117、`npm run test:pc` 72/72、lint Syntax check 42 files、build 通过、audit critical=0。浅色功能展示证据为两张精确 `1440x900` viewport 截图：`multi-store-super-app/validation/pc-all-dealers-sales-flat-1440x900-light.png`、`multi-store-super-app/validation/pc-all-dealers-process-flat-1440x900-light.png`。
- Review 继承债不属于 Phase 3N 回归：暗色过程表 `metric-value` 对比度另开后续，不阻断本次浅色展示；P2 的文件过长、过滤逻辑重复、AC-188 旧 DOM 断言、未挂载 `filter-ui` 转义仍为技术债，本次不冒充已修。

## [v1.72] - 2026-07-23

### 打铁指标上游筛选继承与 SQL-only 查询合同（仅规格更新，待重规划）
- 版本冲突审计：`v1.71` 已被打铁指标永久骨架屏修复合同占用，本次使用下一个未占用版本 `v1.72`；保留 v1.69 应用公式、v1.70 展示/下钻/导出、v1.71 逐来源结算历史记录不改。
- 更新 `Product-Spec.md` 的顶部状态、SCOPE-025、TASK-016、REQ-012、数据模型/关系/规则、非功能可靠性、完成定义和 ASM-015，并新增 AC-181～AC-185：打铁模块 11 项取数范围必须严格继承上游应用筛选器的 `startDate/endDate`、`regionCode/districtCode/dealerCode` 和车系多选集合；日期为 `startDate <= 真实日期字段 <= endDate` 闭区间；区域范围为上游组织代码、罗盘行权限与有效经销商白名单的交集。
- 锁定车系规则：打铁每个真实来源必须使用该来源已审计的物理车系字段做 SQL 过滤；不得把销售漏斗 `汇报车系名称` 代理到试驾、邀约、DCC 或话术来源；任一来源缺车系字段或字段映射未审计时，具体车系筛选必须 fail-closed 为 `数据不完整` 并报告字段缺口，不得返回“全部车系数据”或伪联动。
- 锁定 SQL-only：前端加载打铁 11 项只能消费服务端 SQL 聚合结果；不得再走 preview 明细、分页 fallback 或前端明细聚合。SQL 失败、业务码失败、字段缺失、截断或完整性不可证时显示 `数据不完整`，不能降级到 preview。
- 锁定非目标：本次不改变 11 项指标公式、目标、展示顺序、二级切换、组织/下钻状态、导出范围、现有 v1.70/v1.71 发布记录；仅更新 `Product-Spec.md` 和 `Product-Spec-CHANGELOG.md`，不修改 `DEV-PLAN.md`、源码、测试、构建产物，不发布、commit 或 push。

### 状态
- 本轮仅规格更新。`DEV-PLAN.md` 需要后续由 dev-planner 基于 v1.72 重新拆解实现阶段和回归门禁，但本次按用户要求不修改。
- 与历史合同冲突时，以 v1.72 的打铁 SQL-only、上游筛选继承和车系字段 fail-closed 规则优先；v1.59/过程分析的明细 fallback 规则只适用于非打铁过程问题率，不得外推到打铁 11 项。

## [v1.71] - 2026-07-22

### 打铁指标永久骨架屏修复合同（已发布测试 App，发布后独立 QA PASS）
- 问题定位：线上测试 App `q0844640cf6734877a3193d6` 中，“打铁指标”切到 `试驾指标 4` 时，6 类来源按 all-complete 收敛；慢请求或悬挂的 DCC/意向来源会阻塞整张打铁表，导致无关已完成指标也长期停留骨架屏。
- 更新 `Product-Spec.md` 的 REQ-012、数据规则、非功能可靠性、完成定义和 ASM-014，并新增 AC-177～AC-180：打铁 6 类来源必须逐来源结算，来源成功后立即局部呈现；单来源超时/失败 fail-closed 为 `数据不完整`，只影响该来源绑定指标。
- 锁定非目标：本次不改变 11 项指标公式、目标语义、二级切换、组织下钻、导出范围、车系边界或 v1.70 发布记录；不把失败来源降级为 `--`、0 或旧缓存。
- 更新 `DEV-PLAN.md`：新增 Phase 3L，记录修复范围、关键文件、四步门禁、停止条件和 P1 待闭环项；补齐矩阵、关键文件边界、风险与 DoD。
- 更新 `README.md`：在当前测试 App 记录之后同步“当前 P1 修复状态”，明确本轮已发布测试 App，发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断），但登录态线上 UI 冒烟和真实观远指标数据集成验收仍 pending。

### 状态
- 本轮已发布到测试 Super App `q0844640cf6734877a3193d6`：`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、`fileKey=6a97ffd3-71bc-4262-8bb5-a1d096cde83e`。
- 发布包 `dist.0.1.0.zip`，SHA-256=`9ef29b84237fb8419492aead99f90a2c82ef7d785bc2e335fbfb75b33ce6cbc0`，大小 `128080` bytes，解包 `30 files / 527758 bytes`；包内外核验不代表登录态线上 UI 验收。
- 门禁已通过：`npm test` 108/108、`npm run test:pc` 61/61、lint Syntax check 42 files、build 通过、audit critical=0。
- 最终 Code Review Stage 1/2 PASS（P0/P1=0/0）；发布后独立 QA PASS（P0/P1/P2=0/0/1，P2仅模块拆分建议/非阻断），QA 执行 `npm test` 108/108、`npm run test:pc` 61/61、lint Syntax check 42 files、build、audit critical=0。
- 匿名 HTTP 仅得到重定向/登录保护的平台边界；未完成登录态已发布 UI 冒烟、未完成真实观远指标数据集成验收。不得声称最终用户验收或线上修复验收通过。
- 未发布生产、未 commit、未 push。

## [v1.70] - 2026-07-22

### 打铁指标 PC 展示、二级切换、下钻与导出合同（已本地实现）
- 版本冲突审计：`v1.69` 已被打铁指标应用采用口径占用，本次使用下一个未占用版本 `v1.70`；保留 v1.66 官方页面复原、v1.69 应用口径修订、v1.67/v1.68 既有历史记录不改。
- 更新 `Product-Spec.md` 的 SCOPE-025、FLOW-003、REQ-012、数据模型、DEP-015、非功能需求、完成定义和 ASM-012，并新增 AC-166～AC-176：PC 表现区第三 Tab“打铁指标”内采用 C 方案二级切换，`邀约指标 7` 默认激活，`试驾指标 4` 同级切换，同一时间只展示一组。
- 锁定表头层级：每个指标表头按“指标名称在上、目标 xx% 在下”；`首跟通话60s占比` 无目标，指标名下方不显示“无目标”、`--` 或任何占位文案。
- 锁定目标语义：目标仅作口径提示，不产生红绿底色、圆点、达标/未达标标签、官方识别状态、综合得分、排序权重或状态字段；v1.69 的 `target_value` 继续保留为数据合同，v1.70 新增 `target_label` 只服务表头展示。
- 锁定组织状态机：两个二级指标组共享无车系 `processBaselineData` / 过程基线有效组织集合、`OrganizationView` 行序、范围文案、`viewLevel/drillPath`、返回上一级和页面分页状态；切换邀约/试驾不重置下钻。具体车系筛选后，不要求销售概览与打铁指标行数或成员完全一致。
- 锁定操作列与导出：操作列沿用“查看小区 / 查看门店 / 门店详情”；复用当前 PC 导出入口，导出当前激活邀约/试驾组和当前 `viewLevel/drillPath` 范围内全部组织行，非仅当前页面分页，不新增第二个导出按钮。
- 新增正式设计文档 `docs/superpowers/specs/2026-07-22-打铁指标PC展示与下钻设计.md`，记录页面定位、组件、层级、下钻状态机、字段布局、状态、响应式、导出、无障碍和 AC 映射；`.superpowers` 下 HTML 原型只作为已批准概念证据，不作为长期依赖。
- 更新 `Design-Brief.md`：保留移动端主规范，新增 PC 打铁指标增量章节，声明本次无 Pencil/Figma 设计稿，正式设计真相以新增设计文档为准。
- 更新 `DEV-PLAN.md`：Phase 3I～3K 已完成本地实现，覆盖打铁数据查询合同/独立源状态、第三 Tab 与二级切换、组织下钻/导出/测试/视觉回归；技术栈沿用现有原生 HTML/CSS/JavaScript、Vite、Playwright、npm，不新增依赖。

### 状态
- 已完成 `multi-store-super-app/` 本地实现、测试和构建产物同步；同步回填 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`DEV-PLAN.md` 与正式设计文档状态。
- 最终本地基线：`npm test` 106/106、`npm run test:pc` 58/58、真实静态语法 `npm run lint`、`npm run build`、`npm audit --omit=dev --audit-level=critical` 0 vulnerabilities 通过；R5 Code Review PASS，独立 QA PASS。
- 已发布到测试 Super App `q0844640cf6734877a3193d6`：`operation=update`、版本 `0.1.0`、URL `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`；发布包 `dist.0.1.0.zip`，SHA-256=`e089f253db4f16bda597a79bf2e5363f09385b3d8b9e5b50227475550eebd8e7`，大小 `126818` bytes，解包 `30 files / 521802 bytes`。
- 发布后独立 QA PASS，P0/P1/P2=0/0/0。匿名 HEAD `401`、匿名关键资源 GET/HEAD `401/302` 仅记录为认证边界，未做登录态线上 UI 或资源哈希验收；未做观远认证态真实查询仍成立；未发布生产、未 commit、未 push。

## [v1.69] - 2026-07-22

### 打铁指标第三 Tab 与应用采用口径修订（仅文档，待开发）
- 版本冲突审计：`v1.67` 已被 MG 订单/零售目标源切换占用，`v1.68` 已被投资人门店层排名/占比分母修正占用；本次打铁需求使用下一个未占用版本 `v1.69`，保留既有 v1.67/v1.68 历史记录不改。
- 更新 SCOPE-013、SCOPE-025、TASK-016、REQ-012、数据模型、DEP-015、可靠性、完成定义和 ASM-012：在现有表现区右上 tablist 中，于“过程分析”右侧新增第三个 Tab“打铁指标”，顺序固定为 `销售概览 → 过程分析 → 打铁指标`，默认激活仍为“销售概览”。
- 锁定打铁指标只展示 7 项邀约 + 4 项试驾当前区间值；11 项全部只跟随上游应用传入或当前有效 `startDate/endDate`，不复制官方打铁看板周/月列、T+1、自然周、自然月、today/yesterday、24h 周、2天3呼月或手机互联月 `>` 日期规则。
- 锁定不展示任何识别状态、红黄绿点、综合得分、官方邀约 L5 状态或试驾状态；统一输出合同不输出 `status_value/status_label`。目标值可在列头或辅助文案显示，但不生成状态颜色；首跟通话60s占比无目标。
- 锁定两项开口率按一期单店口径：手车互联先限定 `试驾体验点='手机互联'`、离车泊入先限定 `试驾体验点='全场景自动泊车-离车泊入'`，再以对应体验点内 distinct `试驾清单ID` 为分母，分子为其中 `是否提及='是'` 的 distinct ID；不使用官方打铁看板“全部体验点试驾”分母。
- 试驾第 2 项展示名统一为“试驾录音回收率”，公式仍为 `是否有录音='Y'` 的 distinct `试驾接待编码(PK)` / 全部 distinct `试驾接待编码(PK)`。
- 五态统一为：加载骨架、成功百分比、真无样本 `--`、分母有效但分子 0 为 `0.0%`、来源失败/截断/不可证为 `数据不完整`；各数据源独立失败不清空其他来源已成功指标。
- 详细口径文档 `docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md` 已新增靠前的“应用采用口径(v1.69)”，并将官方页面事实、09:04 复算矩阵、官方识别状态分层为历史证据，不再作为应用最终验收值。
- 详细口径新增 `v1.69 应用日期字段映射表`：11 项逐项锁定真实日期字段和 `startDate <= field <= endDate` 闭区间条件；§4.2/§5.2 的周/月、T+1、`current_date/yesterday`、自然月等仅标记为 v1.66 官方历史事实，不作为 v1.69 应用合同。
- 统一输出合同修正为长表：`section_code` 只允许 `invite` / `trial`，不输出 `section_name`、`invite_region`、`trial_region`；官方历史展示名保留“试驾录音上传率”，v1.69 应用展示名才使用“试驾录音回收率”。

### 状态
- 本轮仅修改 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、`docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md`；未修改 `DEV-PLAN.md`、`multi-store-super-app/` 源码、测试、构建产物或 AGENTS。
- 未开发、未发布、未 commit、未 push。后续需要 dev-planner 将 v1.69 拆入 PC 打铁指标实现 Phase，并安排与 Phase 3A/3D/3E/3G/3H 的回归门禁。

## [v1.68] - 2026-07-22

### 投资人门店层排名/占比分母修正（已实现，本地验证通过，Code Review PASS）
- 更新 SCOPE-020、REQ-002、REQ-003、完成定义和 AC-039/040/059：投资人 `marketing_userType=6` 进入门店层时，订单排名、零售排名和对应占比按其当前有效门店集合统一计算，不再按门店所属小区或 `districtCode` 拆分。
- 锁定约束：投资人当前有效门店集合必须已经过当前品牌、日期、车系、上游组织筛选、罗盘行权限和有效经销商白名单过滤；默认进入保留 5 店则显示 `x/5`，上游具体 `dealerCode/store` 只保留 1 店时必须显示 `1/1`，不得由诊断结果或补数扩大到小区。
- 锁定边界：其他角色保持现有层级口径，非投资人门店层仍按所属小区排名和计算占比；本次只改订单排名、零售排名及对应占比，不改变主问题/结果断点动态诊断口径。
- AC-165 已实现并勾选，覆盖投资人 5 家有效门店分布在 2 个小区时，订单/零售排名均显示 `x/5`，订单/零售占比分母分别为 5 店订单/零售合计；同时覆盖上游具体 `dealerCode/store` 收窄到 1 店时显示 `1/1`。UI 仍只显示“排名”且不新增投资人或小区文案。
- 实现文件：`multi-store-super-app/organization-view.js`、`multi-store-super-app/app.js`、`multi-store-super-app/validation/organization-view.test.mjs`、`multi-store-super-app/validation/pc-role-drilldown.spec.js`。

### 状态
- 本地验证通过：专项 Node `19/19`、`npm test` `89/89`、投资人 Playwright `1/1`、`npm run build` 退出 `0`。
- Code Review Stage 1/2 均 PASS，HIGH/MEDIUM/LOW=`0/0/0`。
- 未发布；完整 PC 仍有并发月目标测试漂移，本次不处理、不宣称完整 PC 全绿。本次不同步 `DEV-PLAN.md`。

## [v1.67] - 2026-07-22

### MG 订单/零售目标源切换（需求已确认；后续已开发、通过代码复审并最终 QA PASS）
- 更新 REQ-011、SCOPE-024、TASK-015、DEP-016、数据模型和完成定义：PC 目标链路从旧订单目标单链路升级为 MG 新“订单目标 + 零售目标”双链路。
- 锁定新目标源为 `r05b1e3995b0b4480991a4b8` / `MG-销售转化漏斗-零批订目标`，字段限定为 `目标日期、dealer_code、车系、总订单目标、总零售目标`；旧目标 DS `u32cb7e789f7443ff84160b4` 只保留历史记录，不得作为当前代码依赖。
- 锁定目标自然键为“目标月份+MG+dealer_code+车系”；品牌由 MG 常量补齐，组织归属只取现有有效经销商维表 `a310ff90fddff4b6283841c6`，不能信新表 `area/city_name/rfs_name/mac_name` 等组织字段。
- 锁定双分子：订单目标达成分子保持目标口径实际订单 `当日订单数（首触）`；零售目标达成分子为目标口径实际零售 `当日零售数`。两者均按自然月+MG+一级经销商代码+汇报车系名称独立聚合，不复用丢失车系维度的 `salesAggregateSql`。
- 锁定展示和导出：顶部“销售指标”标题摘要同时展示订单目标/订单达成与零售目标/零售达成；订单表现和零售表现均为“月目标｜目标达成 / 排名｜占比”2x2；销售导出新增零售目标、零售目标口径实际、零售目标达成率和订单/零售对应状态、冲突、未配置实际、白名单缺口审计字段。
- 新增 AC-151～AC-164，覆盖旧 DS 移除、新 DS 字段、自然键归一、组织白名单、2026-07 样本 1542 行/订单 22578/零售 18580/5 条非命中缺口、标题摘要、表格 2x2、target-only/actual-only、车系集合、跨月/未来月/非 MG 隐藏、失败降级、导出、下钻守恒、SQL 维度和 1280/1440 视觉。
- 新增开发级设计文档 `docs/superpowers/specs/2026-07-22-mg-order-retail-target-source-design.md`，记录当前代码契约、目标数据合同、展示/导出字段、降级状态、审计和验收映射。

### 状态
- 需求确认当次仅修改 `Product-Spec.md`、`Product-Spec-CHANGELOG.md` 并新增设计文档，未修改 `multi-store-super-app/` 业务源码、测试、构建产物、认证配置、发布配置或 `DEV-PLAN.md`。
- 当前已完成后续本地开发、目标测试和构建产物同步：旧目标 DS `u32cb7e789f7443ff84160b4` 在业务源码、目标测试和 `dist/` 搜索为 0；新目标 DS 真实审计为 1542 行、订单目标 22578、零售目标 18580、5 条有效经销商缺口；Node 90/90、PC 43/43、lint/build/audit critical=0；代码复审通过。
- 最终 QA PASS，P0/P1/P2=0/0/0；未发布、未 commit、未 push。历史需求确认记录保留，不作为当前代码仍旧单链路的结论。

## [v1.66] - 2026-07-22

### 打铁看板邀约/试驾运营指标合同（历史官方页面复原；已被 v1.69 应用口径修订）
- 新增 SCOPE-025、TASK-016、REQ-012、DEP-015 和 AC-143～AC-150，在现有过程分析中新增独立“打铁运营指标”组；现有邀约四项/试驾三项负向问题率继续保留，不互相覆盖。
- 锁定当前官方页面真实范围为 7 项邀约 + 4 项试驾，名称、顺序与目标为：邀约进店试驾提及率 53%、加微申请提及率 56%、高意向低水平 5%、首跟通话60s占比无目标、30分钟跟进率 85%、24小时跟进率 90%、2天3呼率 80%；优质试驾率 45%、试驾录音上传率 65%、手车互联开口率 50%、离车泊入开口率 50%。
- 新增开发级口径文件 `docs/superpowers/specs/2026-07-22-打铁看板邀约试驾指标口径.md`，逐项记录数据集、物理字段、分子、分母、去重键、过滤、日期、聚合、目标、状态和 MG 周度分子分母复算样本；月口径按逐指标日期规则和例外进入后续实现测试。历史会话中的试驾 NPS、有效录音数、质检完成数/率等不并入本次 11 项。
- 锁定六个指标数据集与目标数据集，明确 DCC `NI` 排除条件不得误写成等号，两项试驾开口率分母为全体有效去重试驾清单而非对应体验点样本，合计必须重新聚合原始分子分母而非平均大区比例。
- 锁定三个官方日期/边界例外：24小时跟进率周口径使用 `current_date/yesterday`，2天3呼率月口径使用昨天所在自然月至昨天，手机互联月分母起始日为 `>` 而分子为 `>=`。
- 锁定识别状态：邀约按 7 项 `IF(实绩>=目标,100,0)`求和并使用当前渲染表第 5 行得分 `L5`分色，保留空目标固定加分和高意向方向反常两个官方缺陷；试驾只按周度优质试驾率，红 `<31.5%`、黄 `31.5%~<45%`、绿 `>=45%`。

### 状态
- 本次仅新增指标口径文档并更新 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`；未修改 `multi-store-super-app/` 源码、测试、构建产物、`DEV-PLAN.md` 或兄弟目录，未发布、commit、push。
- 前端布局、查询实现和测试排期尚未执行；实现必须以 REQ-012 和口径文档为单一事实源，并通过 AC-143～AC-150。

## [v1.65] - 2026-07-22

### PC 应用级车系筛选多选升级（已完成并通过 Review 与最终 QA，本目标不发布）
- 更新 REQ-010：PC 应用级车系筛选从历史单选升级为不限数量多选；默认、无具体选择、取消最后一项均为“全部车系”，点击“全部车系”清空具体选择。
- 锁定多选交互：菜单为复选列表，点击单个车系只切换勾选且不关闭菜单；外点或 `Escape` 关闭；触发器 0 项显示“全部车系”、1 项显示车系名称、2 项及以上显示“已选 N 个车系”；列表必须具备 `aria-multiselectable`、option `aria-selected` 和可见勾选态。
- 锁定 URL 与状态：规范参数为重复 `vehicleSeries`，按当前品牌真实枚举顺序稳定序列化；兼容读取历史单值 `vehicleSeries/carSeries/series`，本地变更后清除别名；选中集合进入刷新、埋点、销售查询缓存键和月目标查询缓存键，品牌切换先清空为“全部车系”。
- 锁定数据覆盖：选中集合必须联动当前/月同期/周同期销售事实、顶部指标、销售概览、销售导出、月目标/达成、订单/零售动态排名与动态占比；“全部车系”不加 `汇报车系名称` 条件。
- 锁定边界：过程链路异名车系字段不伪联动；任一具体车系被选中时继续展示过程边界说明；当前多店 `organization-view` 基于已过滤 `peerRows` 动态计算的 `orderRank/retailRank/orderShare/retailShare` 必须继续展示并随多选集合重算；只有独立官方排名、官方分位或官方诊断结果表缺车系维度时才隐藏或降级，不展示全盘官方结果冒充车系集合结果。
- AC-135～AC-142 已由 `[ ]` 更新为 `[x]`，覆盖默认全部、多选连续切换、重复 URL 归一、销售集合联动、清空回全部、品牌复位、月目标多选集合口径和 1440×900 展开态证据。

### 状态
- 后续已完成本地实现和验证：npm test 90/90、test:pc 43/43、lint/build/audit exit 0，source/dist、1440x900 多选展开态截图、安全和未发布边界均通过。
- 两阶段 Review Stage 1/2 PASS；最终 QA PASS，P0/P1/P2=0/0/2，无新增缺陷。2 项 P2 仍为非阻断：大文件职责集中、无车系 baseline 完整 loader 性能冗余；本目标不发布，未 commit、未 push。
- 历史 v1.55～v1.64 已实现/已发布记录保留为历史；v1.67/v1.68 后续记录不在本次改动范围。

## [v1.64] - 2026-07-21

### PC 销售指标标题摘要布局（已开发，代码审查与独立 QA 通过，测试环境已发布）
- 更新 REQ-011：PC 顶部指标卡恢复为仅展示“指标值 + 月环比 + 周环比”，月环比、周环比必须上下两行展示，禁止横向并排或截断。
- 明确替换 v1.62 的“顶部订单卡第二行展示月目标、目标达成”规则：月目标/达成从订单卡移除，改到“销售指标”标题行右侧次级摘要，结构为 `订单目标：22,487　达成率：49.5%`。
- 锁定标题摘要视觉：标题 20px/700；摘要标签 13px/500 灰蓝；摘要数值 15px/700，订单目标蓝、达成率绿；标题与摘要用轻分割线隔开，窄宽下可同区换行但摘要层级弱于标题。
- 新增 AC-129～AC-134，覆盖有效目标标题摘要、卡内两行环比、无目标隐藏摘要、失败降级迁移到标题摘要位置、1280/1440 浅深主题无横向溢出，以及表格订单表现/数据口径/筛选/导出/过程卡/排名/下钻不变。

### 状态
- 已新增 PC 视觉设计文档 `docs/superpowers/specs/2026-07-21-sales-target-summary-layout-design.md`，并引用已确认示意资产 `.superpowers/brainstorm/49110-1784634166/content/target-summary-final-two-line-deltas.html`。
- 用户线上截图暴露旧卡内目标布局；根因是 `index.html` 中 `visual-sync.css` 与 `app.js` 的缓存 query 仍为 `target1`，两处均已升级为 `target2`。
- 缓存 query 修正后已完成构建、独立代码审查与独立 QA：`npm test` 81/81、PC 35/35、lint/build/audit 均通过。
- 发布更正：此前 17:49 发布因 `guancli` 1.0.34 与过期 profile token 未返回平台回执，线上仍为 `target1`，不得认定成功；本次按用户授权通过官方 POST `/public-api/user/loginId/sign-in` 刷新本机 `guancli` profile（文档不记录密钥、账号或 token），并升级 `guancli` 至 1.0.42。
- 已于北京时间 2026-07-21 20:49 从 `multi-store-super-app/` 重新发布测试环境 App `q0844640cf6734877a3193d6`：`guancli app publish --app-id q0844640cf6734877a3193d6 --path .` 返回真实平台回执 `操作:update`、版本 `0.1.0` 且 appId 对应；新 `multi-store-super-app/dist.0.1.0.zip` 时间为 20:49:00，SHA-256=`1c917cd1feec3231f0b8bdc6cb44c7f26493253de0c8cf6f41d3d79872651b4a`。
- 匿名线上 URL 仍返回 HTTP 401，仅说明登录保护；已用新 UID token 认证读取线上资源，`index.html` Last-Modified 为 Tue, 21 Jul 2026 12:49:01 GMT（北京时间 20:49:01），引用 `app.js?v=20260721-target2`，不再引用 `target1`；线上 `target2` 的 `app.js` HTTP 200，包含 `sales-target-summary` / `订单目标`，且无 `target-meta`。

## [v1.63] - 2026-07-21

### 单月自然月目标达成（已实现，本地验证通过，QA PASS）
- 更新 REQ-011：取消“筛选必须从自然月 1 日开始”的限制；只要开始、结束日期位于同一自然月，即展示该月完整月目标和目标达成。
- 锁定双窗口口径：月目标读取当月 1 日至月末；目标口径实际订单读取当月 1 日至今天与月末的较早者。顶部订单、漏斗、排名、占比、零售及过程指标仍严格按用户实际筛选日期计算。
- 锁定跨月行为：跨月筛选不合并多月目标，隐藏月目标和目标达成，不新增业务提示，销售主链路继续可用。
- 新增 AC-126～AC-128，覆盖同月任意日期、历史月/当前月实际订单边界、跨月隐藏、筛选联动、组织守恒、导出和布局回归。

### 状态
- 已在 `multi-store-super-app/data-api.js`、`validation/monthly-target.test.mjs`、`validation/pc-role-drilldown.spec.js` 实现；单月任意日期使用完整自然月目标及月初至 `min(今天, 月末)` 的目标实际，跨月及未来月进入 `invalid_range` 空槽与零目标请求，主销售不变、导出目标数值为空、未新增文案。
- 本地验证通过：目标专项测试 `11/11`、`npm test` `81/81`、`npm run lint`、`npm run build` 均退出 `0`、`npm run test:pc` `34/34`；独立 Code Review P0/P1=`0/0`。独立 QA 在临时副本复核 PASS，P0/P1/P2=`0/0/0`，通过 `npm test` `81/81`、`npm run test:pc` `34/34`、lint/build `0` 和 `npm audit --omit=dev --audit-level=critical`（0 vulnerabilities）。
- 发布前 current tree 为 `environment=test`，上述 `81/81`、PC `34/34`、lint/build `0`、audit 0 vulnerabilities 均通过，隐私扫描无命中。已在项目根执行 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 并无报错完成，发布包 `multi-store-super-app/dist.0.1.0.zip` 于 2026-07-21 17:49 生成，SHA-256=`c1dc8399807cbca9d3f06c1f933d928aa76d46c51446513467c0564d43619d3e`。CLI 未输出平台 `operation`、版本或 `fileKey`，不作推断；匿名入口 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/` 为 HTTP 401，仅确认登录保护，未做登录后 UI 验收。

## [v1.62] - 2026-07-21

### PC 月目标布局二次迭代（已实现，本地验证通过）
- 更新 REQ-011、Design Brief §11 和 DEV-PLAN Phase 3F 后续子任务：顶部所有销售/过程指标卡的月环比、周环比固定为第一行；订单卡有有效目标时第二行展示“月目标、目标达成”；无目标指标第二行必须是真实 `aria-hidden=true` 空槽，避免中部视觉空白。
- 调整销售概览表订单/零售表现 2×2 顺序：订单表现第一行“月目标｜目标达成”、第二行“排名｜占比”；零售表现第一行同高空槽、第二行“排名｜占比”。
- 表格订单/零售排名文案统一为“排名”，保留原有名次/分母，不再展示“全国排名/大区排名/小区排名”前缀。
- 新增 1280px 笔记本屏门禁：1280px 与 1440px 的浅色、深色主题均不得出现目标文字截断、新增横向滚动、主问题/结果断点/操作列被挤压。

### 状态
- 已修改 `multi-store-super-app/app.js`、`visual-sync.css`、`validation/pc-role-drilldown.spec.js` 及同步构建产物；`npm test` 79/79、`npm run lint`、`npm run build`、`npm run test:pc` 33/33 均通过，1280/1440px 浅深四张截图已刷新。
- 历史 v1.61 测试 App 发布记录保持不变；本轮 v1.62 已实现并通过本地验证，独立 Code Review 双阶段与独立 QA 均通过（P0/P1=0），已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256 `3d265f537db879a1d557715c3c1725d8a9f30331bd55a17056b87b804ba631da`）。匿名入口 HTTP 401，仅确认登录态保护，未做登录后线上 UI 验收；未 commit、未 push。
- 口径边界保持不变：不改变主订单、漏斗、排名、占比、销售导出、组织下钻或目标失败降级；不新增“覆盖达成/覆盖不足/部分车系/部分门店”提示。

## [v1.61] - 2026-07-21

### PC 月目标与目标达成（已实现，本地验证通过）
- 新增 REQ-011、SCOPE-024、TASK-015 与 AC-115～AC-121：多店 PC 销售总览只读接入目标数据集 `u32cb7e789f7443ff84160b4`，新增“月目标、目标达成”。
- 锁定目标自然键为“目标月份+品牌+经销商代码+车系”；同键一致值去重，冲突、空关键字段和负目标不进入有效目标，0 目标保留但目标达成留空。
- 锁定主订单、漏斗、排名和占比口径不变；目标达成只使用按“自然月+品牌名称+一级经销商代码+汇报车系名称”聚合的独立实际查询。默认全部车系须汇总全部有效目标车系，target-only 门店必须补入组织行。
- PC 所有顶部指标卡及订单/零售表现列统一 2×2 骨架；页面只显示“月目标、目标达成”，不显示“订单目标、覆盖达成、目标覆盖不足”或部分目标缺口提示。目标查询成功但本范围无目标时隐藏目标内容；失败/无权限显示“月目标数据暂不可用”。

### 状态
- 已完成业务源码、测试、设计和计划文档回填：目标表只读接入、目标自然键归一、独立目标实际订单聚合、target-only/actual-only 处理、组织守恒、2×2 展示和销售导出均已实现。
- 本地门禁通过：`npm test` 79/79、`npm run lint`、`npm run build`、`npm run test:pc` 33/33、`npm audit --omit=dev --audit-level=critical` 0 vulnerabilities；四张视觉基准图为 `multi-store-super-app/validation/pc-monthly-target-{light,dark}-{1280,1440}x900.png`。
- 独立 Code Review 已通过双阶段，独立 QA 已通过，P0/P1=0；已发布测试 App `q0844640cf6734877a3193d6`（`operation=update`、版本 `0.1.0`、包 SHA-256 `143301505ff3524d078de8e80268923684cbcac5c2136b9cd3ecf28339b49038`）。匿名入口 HTTP 401，仅证明登录态保护，未做登录后线上 UI 验收；未写目标数据、未授权、未 commit、未 push。

## [v1.60] - 2026-07-21

### 过程标签定向聚合与独立错误状态
- 新增 SCOPE-023、TASK-014、AC-107～AC-114，锁定过程分析邀约四项和试驾三项必须分别按 kind 独立加载、独立完整性证据、独立错误状态。
- 明确默认 `2026-07-01~2026-07-20 / MG / 全域` 根因：历史 IP 聚合 5118 行、历史试驾聚合 6141 行均超过平台 `limit=5000`，不能静默截断；需改为页面所需一级标签定向聚合，不返回无用 `problem_child` 组合。
- UI 状态统一为：有样本分子 0 显示 `0.0%`，真无样本显示 `--`，加载、截断、失败或完整性不可证显示 `数据不完整`；邀约和试驾均遵守。
- DEV-PLAN 新增 Phase 3E，要求覆盖 IP 失败/drive 成功、drive 失败/IP 成功、两者成功、两者均失败、三阶段同构、默认全域不触达 5000、顶部四项销售转化率不受影响，并发布到测试 App `q0844640cf6734877a3193d6`。

### 状态
- 已完成业务源码与测试实现，并回填 `Product-Spec.md`、`Product-Spec-CHANGELOG.md` 和 `DEV-PLAN.md` 的发布状态；发布后补齐源表一级标签到页面展示名映射，原 QA P2 已关闭；未修改 AGENTS，未发布生产、未 commit、未 push。

### 实际完成证据
- 默认真实查询 `2026-07-01~2026-07-20 / MG / 全域`：IP=`1896`、drive=`1371`、`isTruncated=false`。
- 门禁通过：`npm test` `70/70`、`npm run lint`、`npm run build`、`npm run test:pc` `26/26`、`npm audit` critical=`0`；最终 Review P0/P1=`0/0`，QA PASS，P0/P1/P2=`0/0/0`。
- 已发布到测试 App `q0844640cf6734877a3193d6`：`operation=update`、版本 `0.1.0`、`fileKey=4afc645a-70e5-42c0-8956-a4eacd62ef44`、访问地址 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`、zip SHA-256 `adaa813455b94444523f5a1e28f6ccfa5a5fbf91c4cbec0864a5b73557859084`。
- 匿名 HEAD HTTP `401` 仅说明入口受登录态保护，未执行登录后线上 UI/功能验收；未发布生产、未 commit、未 push。

## [v1.59] - 2026-07-17

### 多店三项试驾问题率单店同口径规格
- 新增 SCOPE-022、TASK-013、AC-100～AC-106，锁定 PC 过程分析和移动端过程展开态中的 `版本未推荐率`、`顾虑跳过率`、`竞品回避及贬低率` 必须与一期单店口径完全一致。
- 明确单店为唯一口径源：分母为同经销商、品牌、日期区间、一级标签下且一级/二级标签均非空的去重 `试驾清单ID`；分子为其中有效判向且负向的去重 `试驾清单ID`；同一试驾在同一指标内命中多个二级标签只计一次。
- 固定三项映射：`版本推荐 -> 版本未推荐率`、`顾虑承接 -> 顾虑跳过率`、`竞品攻防 -> 竞品回避及贬低率`；多店不得用展示别名、销售车系字段或自建标签规则替代一期字段口径。
- 补齐状态和降级规则：有分母且负向为 0 显示 `0.0%`，无一级/二级非空标签样本才显示 `--`；加载、字段映射、SQL 聚合、明细 fallback、分页上限、历史/实时截断或完整性证据失败必须显示错误/数据不完整，不得伪装为 `--`。
- 验收样本锁定 `MQ8530 / MG / 2026-07-01~2026-07-16` 为 `16.7% / 7.7% / 10.0%`，并要求覆盖单店对比、多店聚合、2026-07-17 当天实时直连字段映射和 SQL 失败 fallback 同结果。

### 状态
- 本次仅更新 `Product-Spec.md` 和 `Product-Spec-CHANGELOG.md`；未修改业务源码、测试、AGENTS、未发布、未 commit、未 push。

## [v1.58] - 2026-07-16

### 测试 App 发布：车系筛选应用级位置修正
- 已将最新“车系筛选器迁移到销售总览整体右上角（非销售指标单框内）”修复发布到测试 App `q0844640cf6734877a3193d6`。本次包同时包含此前 PC 车系筛选（销售唯一口径为 `汇报车系名称`、过程事实保留同口径边界）及“销售概览 / 过程分析”Tab 文案。
- 使用 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 发布成功，平台返回 `operation:update`、版本 `0.1.0`；访问地址为 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`，发布包 `multi-store-super-app/dist.0.1.0.zip` SHA-256 为 `b49f7e47ea742a705c79b381e71cbe4689bf88d35e043b2c3839d85b52b712ca`（100K）。
- 发布门禁：`npm test` `48/48`、`npm run lint`、`npm run build`、`npm run test:pc` `18/18` 均通过，`npm audit` critical=`0`，`settings.json` 为 `environment=test`；`dist/` 隐私扫描未发现 `/Users/`、API key 或 `.db/.env/.pem/.key/credential` 文件。
- 匿名 HEAD 返回 HTTP `401`，仅说明入口受登录态保护；未执行登录后线上 UI/功能验收。未发布生产、未 commit、未 push。

## [v1.57] - 2026-07-16

### PC 车系筛选应用级位置修正（已实现）
- 唯一的 `#vehicleSeriesFilter` 从“销售指标”单框内部移至销售区“销售总览”整体标题行右侧，位于销售指标框与过程指标框的共同上方；未复制筛选器，未改变其 ID、URL、数据过滤、缓存、键盘、ARIA 或点击外部关闭逻辑。
- 新增 AC-099：1440px 下明确验证筛选器属于应用级 overview header、不是任一 `.metric-panel` 子元素，且两组指标框在标题行下方保持独立宽度；窄屏继续在应用级标题行内纵向降级。
- 本次仅调整多店 PC 布局、规格与回归测试；不修改一期 `../super-app`，不发布、commit 或 push。

## [v1.56] - 2026-07-16

### PC 门店表现 Tab 展示名
- 多店 PC 门店表现区的两个 Tab 展示名由“销售表现表”“过程表现表”调整为“销售概览”“过程分析”。
- 仅调整展示文案：`salesTab` / `processTab` 的 id、`data-store-tab`、`role`、`aria-controls`、默认选中状态和现有切换逻辑保持不变；销售表现表、过程表现表及其数据口径、组织排序均不变。
- Product Spec、DEV-PLAN 与 PC 自动化用例同步使用新 Tab 展示名；表格实体仍保留“销售表现表”“过程表现表”术语，避免混淆数据口径。

### 验证
- `multi-store-super-app/` 已通过 `npm test`（48/48）、`npm run lint`、`npm run build` 和 `npm run test:pc`（18/18）。新增 PC 用例覆盖新 Tab 文案、稳定语义属性及双面板切换。
- 已使用 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 将本次车系筛选与“销售概览 / 过程分析”Tab 文案发布到测试 App `q0844640cf6734877a3193d6`（平台返回 `operation:update`、版本 `0.1.0`）；访问地址为 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`，发布包 `multi-store-super-app/dist.0.1.0.zip` SHA-256 为 `4760f523ad362dd37886a5138d9e35c179290edc29c2c12d3c9276ce825ff6f3`（100K）。
- 发布前 `npm audit` critical=`0`、`settings.json` 为 `environment=test`，且 `dist/` 隐私扫描未发现 `/Users/`、常见 API key 或 `.db/.env/.pem/.key/credential` 文件。发布后匿名 HEAD 返回 HTTP `401`，仅证明入口受登录态保护；未执行登录后线上 UI/功能冒烟。本次未修改一期 `../super-app/`，未 commit 或 push，未发布生产环境。

## [v1.55] - 2026-07-16

### PC 应用级车系筛选（已实现，Code Review P0/P1=0，QA final PASS）
- 新增 SCOPE-021、TASK-012、REQ-010 与 AC-090～AC-098：多店 PC 新增默认“全部车系”的应用级下拉，严格对齐一期单店 `../super-app` 的品牌全量枚举、`compareVehicleSeriesOptions` 排序、URL 兼容、刷新/缓存和下拉视觉/无障碍交互。
- 销售漏斗数据集 `k4c14c31c595540a0a771f50` 的 `汇报车系名称` 是唯一枚举与过滤字段。全量枚举只受品牌影响；排序为真实存在的 `全新MG4/MG 4X/MG 07` 置顶、其余 `zh-CN`、真实存在的 `其他车系/未知车系/位置车系` 置底，禁止硬编码枚举或多店独立排序。
- 具体车系进入 URL 主参数 `vehicleSeries`（兼容读取 `carSeries/series`）、刷新状态和销售查询缓存键；当前/上月/上周销售、顶部销售与四项转化率、销售表现、销售导出、排名和占比使用同一 `汇报车系名称` 条件重算。品牌切换必须复位为“全部车系”。
- 过程数据源虽存在不同命名的车系字段，但没有销售 `汇报车系名称` 同口径字段。历史 v1.55 不创建另一套枚举或过滤，并要求过程 Tab 和过程导出固定展示未联动边界说明；该历史合同已被 v1.93 的过程真实联动合同覆盖。
- 固化回归边界：车系筛选后 v1.53 的大区数字前缀升序、小区/经销商订单降序、同订单代码升序、两个 Tab 同行序、权限白名单、日期和下钻均不得回归；不开发移动端，不发布、commit 或 push。

### 状态
- `multi-store-super-app/` 的车系实现与自动化已完成：`npm test` `48/48`、`npm run lint`、`npm run build`、`npm run test:pc` `17/17` 均退出 `0`；1440px 展开态证据已更新为 `multi-store-super-app/validation/pc-vehicle-series-menu-expanded-1440x900.png`。
- AC-090～AC-098 已通过实现自检：销售唯一字段、品牌全量枚举、一期同构排序、URL 别名规范化、品牌复位、缓存重试/隔离、销售联动、过程边界及组织排序回归均已覆盖。
- 最终 Code Review 已复跑，P0/P1=`0/0`；最终 QA PASS，P0/P1/P2=`0/0/0`。本版本未发布、未 commit、未 push。

## [v1.54] - 2026-07-16

### PC 与移动端过程指标卡统一为转化漏斗
- PC 顶部过程指标卡已从负向邀约占比、负向试驾接待占比调整为到店试驾率（试驾/到店）、线索订单率（订单/线索）；四张卡统一按线索到店率、到店试驾率、试驾订单率、线索订单率顺序展示，复用销售原始分子分母计算当前值、月环比、周环比，并使用普通正向率语义。
- 移动端尚未开发；后续 Phase 5 的 4→7 展开补充卡和 Phase 7 过程表现收起态同步为同一套四项转化率。展开态仍保留邀约与试驾接待 9 项问题标签明细。
- 已同步 SCOPE-001、SCOPE-015、FLOW-001、FLOW-002、REQ-001、REQ-004、REQ-009、AC-001、AC-011、AC-031、AC-043、AC-046、数据规则、依赖、性能要求、完成定义和 DEV-PLAN 覆盖矩阵。

### 状态
- PC 实现与自动化回归用例已完成 QA，并与 v1.53 合并包通过 `npm test` 43/43、`npm audit` critical 0、`npm run lint` 与 `npm run build` 退出 0、PC 自动化验收 16/16、独立 QA P0/P1/P2=`0/0/0`。
- 已于北京时间 2026-07-16 18:45:50 使用 `guancli app publish --app-id q0844640cf6734877a3193d6 --path multi-store-super-app` 发布到测试 App `q0844640cf6734877a3193d6`；平台返回 `operation:update`、版本 `0.1.0`，访问地址为 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`。匿名资源探测受登录态限制：应用与 `organization-view` 返回 302、入口返回 401，未验证线上同源哈希。
- 移动端仅更新后续规格与验收，未创建未排期页面代码；本次未 commit、未 push。

## [v1.53] - 2026-07-16

### 组织表现清单排序规则
- 大区清单改为提取大区名称开头的连续数字并按数值升序排列；无数字前缀的大区排在其后，同类按大区代码稳定升序。
- 小区、经销商清单改为按当前日期筛选范围聚合后的订单数降序排列；订单数相同时分别按小区代码、经销商代码稳定升序。
- “销售表现”“过程表现”两个 tab 在相同层级和筛选范围下必须保持相同行序，并新增 AC-088、AC-089 覆盖大区、小区和经销商排序验收。

### 实现与验证
- 本次排序规则已实现并验证：`npm test` 43/43，`npm run lint`、`npm run build` 均退出 0，PC 自动化验收 14/14，Code Review Stage 1/2 PASS。

### 状态
- 本次已实现并验证，并与 v1.54 合并包于北京时间 2026-07-16 18:45:50 发布到测试 App `q0844640cf6734877a3193d6`（平台返回 `operation:update`、版本 `0.1.0`）；本次未 commit、未 push。

## [v1.52] - 2026-07-16

### 测试 Super App 合并发布
- 已将会话 `019f6a15-0087-74b0-8e66-80795fce8793` 的运行时门店详情环境跳转修复，与 Phase 3C 销售漏斗 `一级经销商代码/父经销商简称` 最小改造合并发布。
- 北京时间 2026-07-16 18:01:40 发布到测试 App `q0844640cf6734877a3193d6`，平台返回 `update`，版本 `0.1.0`；访问地址为 `https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/`，发布包 SHA-256 为 `90e68518da3805ea3af0b9c9981d1588ac7fc5239f10f011fe846c141f97e5cb`。
- 发布门禁通过：`npm test` `40/40`、`npm run lint` 与 `npm run build` 均退出 `0`、Playwright PC `14/14`、`npm audit` `0` 漏洞，隐私审计通过。
- 线上首页和 13 个资源均返回 `200`，并与本地 `dist/` 逐文件哈希一致；`data-api.js` SHA-256 为 `f639f60ea8f0a985f17753539f442e50d5556faffb15db989ff87a4d2cf7c886`，`runtime-config.js` 为 `3682e6b3637768865322e4e85e325809a35a0b0bf2dc31de51a6c08c2a0645af`，`settings.json` 为 `0bc4be7f9bd9c1774d63e99ae74b906bf275b41020395207c95172102900663e`。
- 线上保持 `environment=test`：测试单店 App 为 `r8ce093b6d93143d8aa6852f`，生产/兜底单店 App 为 `aca59d2e2e60f4be4b8b93ac`；销售漏斗一级代码聚合与父简称展示逻辑已上线。
- 发布后线上冒烟和独立静态 QA 均 PASS，P0/P1/P2 为 `0/0/0`，认证 HTTP、资源哈希、运行时配置与代码语义一致。

### 状态
- Phase 3C 已发布到测试 App；本次未 commit 或 push，未发布生产 App。

## [v1.51] - 2026-07-16

### Phase 3C 实施与验收
- 已完成销售漏斗最小改造：销售事实按 `一级经销商代码` 筛选和聚合、按 `父经销商简称` 命名，并继续别名为下游既有 `经销商代码/经销商名称`；业务源码仅修改 `multi-store-super-app/data-api.js`，测试仅新增 `multi-store-super-app/validation/data-api-sales-parent.test.mjs`。
- 最终统计范围为销售一级代码聚合结果与现有有效一网白名单的交集。当前、上月同期、上周同期白名单内/外代码数分别为 `911/54`、`899/60`、`911/54`；三阶段白名单外并集 84 个代码均按确认口径排除，不展示、不参与顶部指标或销售行合计。
- 白名单内数据门禁通过：维表非唯一 `0`、同码多父简称 `0`、父简称为空 `0`、销售父简称与维表一网简称不一致 `0`。
- 真实样本 `MQ530Q / 菏泽首信` 覆盖 19 个原始经销商代码，聚合订单/零售为 `57/39`，与逐成员求和 `57/39` 完全一致。
- `npm test` `40/40`、`npm run lint`、`npm run build`、`npm run test:pc` `14/14` 均退出 `0`；AC-080～AC-087、独立 Code Review 和最终 QA 全部 PASS，P0/P1/P2 为 `0/0/0`。
- `data-api.js` 与构建产物 SHA-256 为 `f639f60ea8f0a985f17753539f442e50d5556faffb15db989ff87a4d2cf7c886`，新增测试 SHA-256 为 `5fe10cdf4e850f26d5b63cbd13aa6a1bc02bcf435b77b93a790b405ff3e2b92b`；过程链路组合哈希保持基线值 `18116f68934d1d164993fe839706719191db79a2b186b55df8421eb22f08fcee`。

### 状态
- Phase 3C 已实施并验证，尚未发布、commit 或 push；v1.49 的测试应用发布记录不属于本次 Phase 3C 发布。

## [v1.50] - 2026-07-16

### 销售一级经销商白名单统计口径
- 销售事实按 `一级经销商代码` 聚合后，与现有有效一网白名单取交集作为最终统计范围；白名单外代码不展示、不参与顶部指标或销售行合计，也不再阻断实施。
- 白名单内代码仍须唯一匹配一条维表一网记录，同码不得出现多个非空父简称，销售 `父经销商简称` 必须与维表一网 `经销商简称` 完全一致；任一条件不满足仍停止实施并输出差异清单。
- 已确认的 84 个当前/上月/上周三阶段异常一级代码均因不满足现有有效一网白名单条件而被排除，不纳入统计。

### 状态
- 本次仅更新需求口径与开发计划，尚未修改源码或测试，也未执行实现验收或发布。

## [v1.49] - 2026-07-16

### Bugfix：门店详情环境地址
- 测试多店 App `q0844640cf6734877a3193d6` 的发布环境由 `production` 修正为 `test`，门店详情使用测试单店 App `r8ce093b6d93143d8aa6852f`。
- 生产单店 App 地址由错误的多店 App `re37c3447cb0443a68a36a40` 修正为 `aca59d2e2e60f4be4b8b93ac`，运行时安全兜底同步更新。
- 本次仅修改运行时地址配置、配置契约测试和交付文档，不修改销售、过程数据口径及链接参数协议。
- 已于北京时间 2026-07-16 17:21 发布到测试 App `q0844640cf6734877a3193d6`，平台返回 `update`、版本 `0.1.0`；线上配置与实际详情链接均已核验为测试单店 App `r8ce093b6d93143d8aa6852f`。

## [v1.48] - 2026-07-16

### 测试环境发布
- 回退基线 `feature/260717-1@3a3c95e9354cb0b820b32496efcbe9b65205167d` 已于北京时间 2026-07-16 16:44:44 发布到测试 App `q0844640cf6734877a3193d6`，平台返回 `update`，版本 `0.1.0`。
- AC-080～AC-087 最小销售方案仍未实施，未随本次发布包发布。

## [v1.47] - 2026-07-16

### 方案收敛
- 新增 AC-080～AC-087，取代已撤回的 AC-068～AC-079：只调整销售漏斗数据集 `k4c14c31c595540a0a771f50`，以 `一级经销商代码/fst_dealer_code` 筛选和聚合，以 `父经销商简称/parent_dealer_shortname` 展示。
- 销售查询结果继续别名为下游既有 `经销商代码/经销商名称`，预计业务源码只修改 `multi-store-super-app/data-api.js`，保持 `filter-api.js`、`metrics.js`、`app.js` 和页面组件不变。
- SQL 聚合与明细分页降级必须输出相同结构；当前、上月、上周统一使用新字段。
- 经销商维表只保留现有一网白名单、组织与权限职责；销售一级经销商代码必须与一网代码唯一匹配，销售父经销商简称必须与对应一网经销商简称完全一致。代码或名称任一不一致均停止实施并输出清单，不扩展为关系层或修改 `metrics.js`。
- DCC、试驾/订单明细、邀约、IP/试驾标签的查询字段、SQL/预览筛选和负向过程指标不变；`线索到店率`、`试驾订单率` 来自销售聚合，按新的一级经销商口径重算并允许变化。URL 二网归一、UI 和全品牌改造均不在本次范围。
- 测试改动固定为只新增 `validation/data-api-sales-parent.test.mjs`，SQL、明细降级、三阶段、白名单代码和名称一致性契约均在该文件验证，不修改既有测试。

### 状态
- 本次只完成需求与开发方案文档，未修改源码或测试，未执行实现验收，未发布应用。

## [v1.46] - 2026-07-16

### 回退
- `multi-store-super-app/` 源码完整回退到 `feature/260717-1@3a3c95e9354cb0b820b32496efcbe9b65205167d`，与远端分支保持同源。
- 撤回 v1.45 的完整父经销商关系建图、全事实成员展开、异常事实预检、过程指标父店聚合及相关新增模块；v1.45 内容保留为历史记录，不再代表当前实现。
- AC-068～AC-079 改为“已撤回”，不计入当前版本完成度。
- 下一步仅计划调整销售漏斗：以销售漏斗数据集的 `一级经销商代码` 作为筛选/聚合键，以 `父经销商简称` 作为页面展示名称；本次回退不改销售字段、不发布应用。

## [v1.45] - 2026-07-16

> **状态：已由 v1.46 撤回。** 以下内容只保留为历史实施记录，不是当前源码能力。

### 调整
- 多店应用展示单位统一为父经销商（一网）：筛选、门店清单、排名、占比、诊断、导出和埋点均不出现二网独立行、名称、代码或数量。
- 二网按 `(品牌代码, 父级经销商代码)` 映射父店，组织归属取父店同品牌大区/小区；父店及当前可见二网的销售、DCC、试驾、订单和标签事实使用同一 `scopeDealerCodes` 查询并按父店聚合。
- 当前、上月、上周复用当前关系快照；所有比率先汇总原始分子分母后重算，二网过程缺失不影响父店订单、零售结果展示。
- 经销商关系改为读取完整最新快照建图；开业二网匹配到同品牌一网父店后，即使父店为非开业或退网中，也由父店名称和组织承接并形成展示单元。
- URL 传入无效二网代码时立即阻断；孤儿、多个父级、父级仍为二网、重复键和成环先按当前组织收敛候选问题，再用同一异常代码集合预检当前、上月和上周销售事实。
- 候选异常任一销售事实非零即阻断；三段均完整且为零才允许其余合法父店展示。聚合 SQL 失败时只有三段分页均读到短末页才可证明完整，分页失败、触上限或证据不足均失败关闭。
- 组织范围匹配改为编码优先：存在大区/小区编码时不再同时校验可能过期的名称；合法父店和异常候选共用该规则，防止漏店或绕过预检。
- `brand=全部` 或空值不再默认 MG；新增内部复合成员 `scopeDealerMembers`，销售 SQL、过程分片、父店事实归并和组织排名按品牌与经销商代码复合键隔离。
- 本次相关职责拆为 `dealer-sales-preflight.js` 和 `dealer-fact-scope.js`，避免继续扩张销售异常预检与父店事实归并逻辑。
- 经销商维表改为分页读取并增加硬上限门禁；标签聚合改为成员分片执行，每片命中结果行上限即阻断，禁止消费截断结果。
- 过程覆盖语义区分“完整查询但零样本”和“请求截断/阶段失败”：前者正常显示 `--`，后者清除局部负向过程值并显示“数据覆盖不足”，销售结果继续保留。
- `npm run lint` 改为浏览器业务 JS 的真实 `node --check` syntax lint，Vite 构建仍由 `npm run build` 独立验证。

### 范围
- 本次只调整 `multi-store-super-app` 的父经销商聚合数据链路、契约测试和交付文档；不新增二网 UI，不修改一期单店详情口径，也不发布生产应用。

---

## [v1.44] - 2026-07-16

### 调整
- 门店详情入口地址改由 `multi-store-super-app/settings.json` 运行时配置管理：通过 `environment` 选择 `development`、`test` 或 `production` 地址；开发、测试环境地址为空时回退生产地址。
- 配置读取失败或环境值非法时同样回退生产地址；原有品牌、大区、小区、门店、日期与来源上下文 Query 参数协议保持不变。

### 范围
- 本次仅调整多店 PC 的门店详情运行时地址配置与对应自动化验收；不修改移动端、数据口径或角色识别逻辑。

---

## [v1.43] - 2026-07-16

### 调整
- PC 角色识别新增受限兜底：仅当 `marketing_userType` 为 `null`、`undefined`、空字符串或纯空白时，按总部角色进入清单；仍沿用“上游筛选 ∩ 罗盘数据权限 ∩ 有效经销商白名单”确定数据范围。
- 非空未知用户类型、非法 JSON、非对象人员画像及 `marketing_userType=4` 的组织类型缺失/非法继续进入角色识别异常，不默认总部。

### 范围
- 本次仅调整 `multi-store-super-app` PC 人员画像角色解析与对应验收规则；不改上游数据写入、查询范围、移动端，也不发布到生产平台。

---

## [v1.42] - 2026-07-16

### 调整
- PC 组织表现区标题右侧的层级导航改为“当前清单实际组织范围”：唯一大区展示真实大区名，唯一大区+唯一小区展示“大区名 - 小区名”，跨多大区时隐藏；不再展示角色、通用层级或门店名称。
- 范围文案同时响应上游 Query 的大区/小区/门店筛选和表格下钻/返回；只传代码时从有效清单反查真实名称，上游筛选变化先清空旧 `drillPath` 再重算。
- 销售表现/过程表现共用范围文案；手动下钻存在时保留返回按钮。

### 范围
- 本次仅调整 `multi-store-super-app` PC 组织表现区的范围文案规则与验收标准，移动端布局和其他业务口径保持不变。

---

## [v1.41] - 2026-07-15

### 调整
- PC 组织表现区的动态层级导航由标题下方独立一行调整为紧跟模块标题右侧展示；下钻/返回、销售表现/过程表现共享层级、右侧导出和 tab 行为保持不变。

### 范围
- 本次仅调整 `multi-store-super-app` PC 布局要求，移动端保持不变。

---

## [v1.40] - 2026-07-15

### 新增
- 新增 PC 访问角色分层：从 `sessionStorage['retail-cockpit:personnel-profile']` 统一识别总部、大区、小区、销售总监和投资人；字段缺失、非法 JSON 或未知组合进入角色识别异常，不得默认总部。
- 新增 PC 大区→小区→门店组织下钻与上游具体筛选自动跳层；销售表现/过程表现共用层级、面包屑和返回路径。
- 新增大区、小区、门店三级原始分子分母聚合、竞争排名、层级占比和动态主问题/结果断点口径；该排名方式为 v1.40 历史记录，v1.85 起订单/零售展示排名由稳定唯一排名覆盖。

### 调整
- 目标用户扩展为总部、大区、小区、销售总监和投资人；角色只决定清单入口，有效范围始终是“上游筛选 ∩ 罗盘数据权限 ∩ 有效经销商白名单”。
- 明确顶部指标卡只跟随上游筛选，不随下方清单下钻变化；全国完整性不可证时不展示伪全国排名。
- 全国完整性改为使用带数据集来源、刷新时间和有效期的版本化权威大区清单校验；当前组织集合不等、销售事实未覆盖或配置过期均禁止输出全国排名。

### 范围
- 本轮只实现和验收 `multi-store-super-app` PC 入口；移动端需求与历史开发计划保持不变，不纳入本轮代码调整。

---

## [v1.39] - 2026-07-13

### 新增
- 新增多店聚合“零售过程”移动端独立页面范围：与 PC 端业务链路一致，由上游移动端应用判断设备并选择新的 iframe URL；具体移动端入口路径待开发阶段确定。
- 新增移动端核心指标布局：首屏两列展示订单、交付率、零售、线索到店率，其余三项过程指标通过“展开全部”查看。
- 新增销售表现/过程表现门店卡片流：销售卡片展示五步漏斗、订单/零售排名与占比、问题徽标和诊断结论；过程卡片展示四项过程指标，展开后展示问题标签及月环比、周环比。
- 新增移动端分页规则：每页 15 家，只保留上一页、当前页/总页数、下一页和跳至指定页，并明确首末页禁用与非法页码校验。
- 新增加载、空、错误、无权限、成功五态及 URL 参数缺失/非法的可验收行为。

### 调整
- 明确移动端与 PC 端共用 URL 参数语义、数据查询、指标计算、权限和门店详情跳转口径，但移动端采用同项目独立入口，不以响应式布局替换 PC 页面。
- 明确移动端子应用首屏直接从核心业务指标开始，不渲染标题栏、返回按钮、上游导航、筛选器或筛选摘要。

### 移除
- 移动端首版不提供导出、无限滚动和设备判断能力；这些能力不影响 PC 端既有导出及页面规则。

### 文档校准
- 明确销售卡片收起态用于快速扫描，展开态才追加排名占比、完整诊断结论、展开控制和门店详情。
- 明确权限校验失败才进入无权限状态；权限通过但结果为 0 进入空状态，禁止以 0 行反推无权限。
- 修复范围编号重复；明确主题、截图协议和全局导出条款的 PC/移动端适用边界，并补齐移动端复用现有 GIO 事件的验收口径。
- 将单店页跳转与 P0 范围保持一致，并把移动端分页状态收敛为单一“当前有效页码”，不暗示销售/过程两套独立页码状态。

---

## [v1.38] - 2026-07-09

### 调整
- 门店销售表现中的订单排名、零售排名改为按当前筛选日期范围动态计算的小区排名，不再读取官方月度排名作为展示排名。
- 门店诊断的排名分位判断继续与当前日期范围动态排名口径一致，避免展示排名和诊断判断使用不同分母或不同时间范围。

---

## [v1.37] - 2026-07-09

### 调整
- 门店销售表现的结果断点文案改为证据优先：先展示命中主问题的指标、当前值和小区位置，再输出断点提炼，避免只给业务抽象结论。

---

## [v1.36] - 2026-07-08

### 调整
- 多店 Super App 改为嵌入主应用模式：头部筛选器隐藏且不再挂载交互筛选逻辑，筛选变化由主应用通过 iframe 新 URL 重新打开页面。
- URL 入参协议更新为 `startDate / endDate / brand / brandCode / region / regionCode / district / districtCode / dealer / dealerCode / dealerShortName / theme / previewMode`。
- 数据筛选规则明确为：品牌使用 `brand` 品牌名称筛选；大区、小区、经销商分别使用 `regionCode / districtCode / dealerCode` 代码筛选。
- 主题参数修正为 `previewMode` 优先于 `theme`，`previewMode=light` 可覆盖 `theme=dark`。

---

## [v1.35] - 2026-07-07

### 调整
- 完整对标一期单店 App 当前前端基线：全局背景/主色、筛选器高度、销售/过程指标卡尺寸、tab 胶囊样式、表格行高/表头/边框、按钮和状态标签均同步到单店最终覆盖参数。
- 顶部销售指标和过程指标卡片配置对齐一期单店前端指标卡最终覆盖：紧凑白底卡片、约 118px 高、18px 圆角、12px 标签、29px 主数值、12px 环比文字。
- 门店过程表现表恢复双层合并表头：首层按“邀约”“试驾接待”分组，第二层只展示指标名，不再把模块名写到指标名前缀里。
- 门店过程表现表在“邀约”和“试驾接待”两个列组之间增加竖向分隔线，保留无全量单元格框线的清爽表格风格。
- 门店销售表现和门店过程表现改为同一门店表现区内的两个 tab，默认展示销售表现，点击过程表现后切换，避免页面同时铺开两张大表。
- 门店销售表现表去掉“月份”“经销商代码”两列，首列改为经销商名称，降低表格信息密度。
- 门店销售表现行内展开的邀约/试驾过程表收紧最大宽度、列宽、间距和字号，避免展开区横向铺得过宽。
- 过程指标卡片顺序调整为线索到店率、负向邀约占比、试驾订单率、负向试驾接待占比。
- 门店销售表现和门店过程表现两张表的经销商名称列固定在左侧，并统一表格字体到单店顾问表现表风格。
- 门店销售表现表头两个排名字段由 `订单小区排名`、`零售小区排名` 改为 `订单排名`、`零售排名`，排名口径仍为小区排名。
- 门店销售表现表取消行内展开过程指标：移除全部展开/全部收起和单店展开/收起入口，过程指标只保留在“过程表现”tab 中展示。
- 门店销售表现和门店过程表现标题右侧移除“X 家门店”计数徽标。

---

## [v1.34] - 2026-07-07

### 调整
- 门店销售表现表中两个排名字段改为 `订单小区排名`、`零售小区排名`。
- 排名和占比单元格只保留数值，不再重复展示“小区排名”“小区占比”辅助文字。

---

## [v1.33] - 2026-07-07

### 修复
- 修复筛选器缺少小区默认值的问题：demo 缺参时按当前品牌/大区自动落到第一个有效小区；superApp 首次加载时等待维表默认小区归一化后再渲染筛选器，避免先显示“小区 全部”。

---

## [v1.32] - 2026-07-07

### 调整
- 顶部销售漏斗模块桌面端改为一行指标卡布局：销售指标框 3 张卡、过程指标框 4 张卡同时处于同一视觉行。
- 销售指标框与过程指标框宽度按 3:4 分配，保证 7 张指标卡视觉宽度一致；卡片高度保持统一。

---

## [v1.31] - 2026-07-07

### 调整
- 独立过程表模块名称从“门店过程指标清单”改为“门店过程表现”。
- 门店过程表现表改为参考一期单店“顾问表现”表的单行指标布局：去掉月份和经销商代码字段，首列仅保留经销商名称。
- 表头改为单层指标列，通过“邀约·”“试驾接待·”前缀区分模块；指标单元格在同一行内展示当前值、月环比、周环比，不展示单元格框线。

---

## [v1.30] - 2026-07-07

### 调整
- 销售漏斗右侧模块名称从“负向过程指标”改为“过程指标”。
- 过程指标框新增 `线索到店率` 和 `试驾订单率` 两张指标卡，继续保留 `负向邀约占比`、`负向试驾接待占比`。
- 线索到店率按到店 / 下发线索计算，试驾订单率按订单 / 试驾计算，均展示当前值、月环比、周环比。

---

## [v1.29] - 2026-07-07

### 新增
- 门店销售表现表在订单后新增订单排名、订单占比、零售、零售排名、零售占比。
- 订单排名读取官方排名分位结果表 `xa257b3a018be4418b6100bc` 的 `orders` 小区排名。
- 订单占比按门店订单 / 当前小区订单合计计算，零售占比按门店零售 / 当前小区零售合计计算，均以整数百分比展示。
- 零售排名字段先以 Mock 小区排名占位，后续排名表产出 `retail_sales` 后切换真实数据。

---

## [v1.28] - 2026-07-07

### 新增
- 在门店销售表现模块下方新增独立“门店过程指标清单”，与现有行内展开方案同时保留，用于对比前端呈现效果。
- 新清单一家门店只展示一行，按“邀约”“试驾接待”列组展示过程指标；每个指标单元格包含当前值、月环比、周环比。
- 门店销售表现行支持点击联动下方过程指标清单，对应门店行高亮并定位。

---

## [v1.27] - 2026-07-07

### 新增
- 门店销售表现表新增单店行展开/收起和全部展开/全部收起能力；展开内容显示在对应门店行下方。
- 展开内容按“邀约”“试驾”两个模块归类：邀约展示线索到店率、零钩子率、未锁定时间率、报价承接不足率、竞品比较转化不足率；试驾展示试驾订单率、版本未推荐率、顾虑跳过率、竞品回避及贬低率。
- 展开指标改为清晰表格形态：每个模块一张表，指标作为行，当前值/月环比/周环比作为列，不使用指标卡；销售转化率来自销售漏斗事实聚合，问题率复用现有邀约/试驾标签聚合，当前范围无样本展示“--”。

---

## [v1.26] - 2026-07-07

### 新增
- 恢复门店销售表现表的“门店详情”跳转：每家门店行末展示按钮，点击进入一期单店诊断正式应用，并携带品牌、大区、小区、经销商名称、经销商代码、日期区间、主题和来源上下文。

---

## [v1.25] - 2026-07-07

### 修复
- 优化 Super App 筛选器加载：品牌、大区、小区、经销商选项改为复用同一份经销商维表缓存，本地推导级联选项；首屏经销商维表预览请求从 2 次降为 1 次，切换大区/小区不再重复发起经销商维表预览任务。

---

## [v1.24] - 2026-07-07

### 修复
- 优化 Super App 首屏加载：销售指标和门店销售表现不再等待负向邀约/试驾标签统计返回；负向过程指标改为后台读取，完成后仅刷新销售漏斗模块中的负向过程卡片。

---

## [v1.23] - 2026-07-07

### 修改
- 销售漏斗模块从 8 个旧漏斗卡调整为两个视觉框：销售指标框展示订单、交付率、零售；负向过程指标框展示负向邀约占比、负向试驾接待占比。
- 新增零售指标口径：零售来自销售漏斗数据集 `k4c14c31c595540a0a771f50` 的 `当日零售数/today_sale_cnt`，交付率按 `零售 / 订单` 计算。
- 负向邀约占比、负向试驾接待占比只作为销售漏斗模块内的汇总占比卡片展示，页面仍不恢复旧电话邀约/试驾接待过程分析模块。
- 所有销售漏斗卡片展示当前值、月环比、周环比。

---

## [v1.22] - 2026-07-07

### 修改
- 2 期多店聚合工作台按最新截图重做为简版结构：顶部筛选 + 8 个销售指标卡 + 门店销售表现表。
- P0 范围删除页面内过程指标、趋势浮层、深度分析、问题分布、AI 诊断总结、电话邀约/试驾接待切换模块；Super App 只保留销售指标读取与门店销售表现渲染。
- 发布策略改为新建独立 Super App 发布，不更新旧多店 App `x944c089c3c4249ea925fde6`，也不修改一期单店 App。

---

## [v1.21] - 2026-07-06

### 修复
- 对齐多店页面外层与单店线上基线：顶部筛选区、标题区、主体容器改为全宽铺满，移除 1440px 居中上限，避免宽屏下出现比单店更窄的灰边。
- 补齐多店标题区“多店销售诊断工作台”，并将“深度分析”标题与电话邀约/试驾接待切换移到卡片外层，匹配单店深度分析结构。
- 修复 1280px 桌面宽度下旧组件样式提前折行的问题，筛选器保持桌面一行展示。
- 对齐问题分布默认展开与展开/收起交互：默认展开首项，点击其他一级问题单项展开，再次点击当前项收起；二级问题行按单店的左名称、中计数、右负向标签格式展示。

---

## [v1.20] - 2026-07-06

### 修复
- 对齐多店问题分布模块与一期单店顾问表现的问题分布交互和样式：一级问题改为单项受控展开/再次点击收起；二级问题行文字左对齐，补齐展开容器间距。

---

## [v1.19] - 2026-07-06

### 新增
- 在销售漏斗下方新增“门店销售表现”：用门店诊断结果表提供月份、经销商、主问题和结果断点，用销售漏斗源按同一小区、同一月份和上月同期补充下发线索、到店、试驾、订单及月环比。前端只做展示拼接，不把门店诊断结果表扩展为全页面数据源。

---

## [v1.18] - 2026-07-06

### 优化
- 优化多店前端加载编排：筛选器完成归一化后并行读取销售漏斗数据和有效门店范围；有效门店返回后立即启动邀约/试驾过程数据读取，不再等待漏斗渲染完成。该调整不改变任何数据集、字段、筛选条件、分子分母、去重键、正负向判定和聚合口径。

---

## [v1.17] - 2026-07-06

### 修改
- 统一多店页面所有月环比、周环比展示格式：使用 `▲/▼` 箭头呈现变化方向，不再展示 `+/-` 符号。

---

## [v1.16] - 2026-07-06

### 修复
- 修复门店表现模块在邀约/试驾过程数据加载中时不展示负向问题指标列的问题；加载态先展示标准问题列，数据返回后再填充值和追加实际额外问题列。

---

## [v1.15] - 2026-07-06

### 修复
- 修复多店问题分布百分比误用 `问题数 / 全部负向问题数` 的构成比，改为展示每类问题自身发生率，保持与单店问题分布和上方负向占比口径一致。

---

## [v1.14] - 2026-07-06

### 修改
- 多店门店表现表格列宽对齐一期单店顾问表现：样本列和结果列扩展到 150px，问题指标列扩展到 240px，避免新增周/月环比后指标排布过密。

---

## [v1.13] - 2026-07-06

### 修改
- 多店门店表现表格在门店列后补充结果转化指标：电话邀约模式展示门店 `线索到店率`，试驾接待模式展示门店 `试驾订单率`，按门店原始分子/分母重算并展示月环比。

---

## [v1.12] - 2026-07-06

### 修复
- 修复多店试驾平均里程、平均时长被按百分比函数放大 100 倍的问题；两项指标改为普通平均值 `合计值 / 有效事件数`。

---

## [v1.11] - 2026-07-06

### 修改
- 多店问题分布对齐一期单店问题分布：一级负向问题支持点击展开/收起，展开后展示二级细项问题、计数和“负向”标签，配色方案复用单店样式。

---

## [v1.10] - 2026-07-06

### 修改
- 移除门店表现行内“逻辑未确认”可见占位；重点追踪方向判定逻辑仍未确认，P0 不在门店表现中输出临时方向判断。

---

## [v1.9] - 2026-07-06

### 修改
- 明确多店“门店表现”指标列必须与一期单店“顾问表现”一致：电话邀约展示通话数和邀约负向问题率，试驾接待展示试驾数和试驾负向问题率；多店仅改变聚合粒度为门店，并额外保留“门店详情”跳转按钮。

---

## [v1.8] - 2026-07-05

### 修改
- 多店销售漏斗指标卡不展示小区排名、全国排名，也不保留排名位占位文案；卡片只展示当前值和上月同期变化。

---

## [v1.7] - 2026-07-05

### 修改
- 发布范围明确为接入真实观远数据的正式独立 Super App，不修改已有一期单店工作台 App。
- 多店聚合指标明确按当前筛选范围原始分子/分母重算，不使用门店百分比简单平均。
- 过程模块保留所有已接入指标；追踪方向判定逻辑未确认前展示“逻辑未确认”。
- 邀约/试驾日趋势明确展示负向问题标签日趋势。

---

## [v1.6] - 2026-07-05

### 修改
- 将邀约/试驾日趋势从页面固定展示模块调整为过程卡右上角按钮触发的趋势浮层。

---

## [v1.5] - 2026-07-05

### 修改
- 明确 2 期所有指标口径严格复用一期单店工作台的数据口径和逻辑，不新增独立指标定义。
- 明确 2 期数据契约只能补充区域/小区/多门店范围下的筛选、聚合和字段映射，不得改写一期分子分母、去重、日期字段、正负向判定和 T+1/当天直连分片逻辑。
- 将前端 mock 数据边界收紧为视觉和交互验收用途，正式联调必须回到一期数据口径文档、前端表单数据映射和 `storeDiagnosis.ts` 现有逻辑。

---

## [v1.4] - 2026-07-03

### 修改
- P0 页面先不放区域级“重点追踪方向/负向问题波动最大门店”独立模块。
- 保留问题门店列表中的门店追踪方向和过程提示，用于承接单店下钻。

---

## [v1.3] - 2026-07-03

### 修改
- 将复杂的“预估订单损失量”从当前设计中移除，P0 不定义、不展示预测损失口径。
- 将追踪方向从三类漏斗断点收敛为两类：`线索到店` 和 `试驾订单`。
- 将 `到店试驾率` 调整为仅在销售漏斗中展示，不进入门店/顾问追踪方向，也不做证据下钻。
- 将“主断点”相关表述统一调整为“重点追踪方向”，用于承接线索邀约和试驾过程两类管理动作。

---

## [v1.2] - 2026-07-02

### 新增
- 新增 GIO 访问埋点要求：零售智能驾驶仓「零售过程」页面访问上报 `smartmind_sale_View`。
- 新增当前登录用户基础信息补全依赖：通过人员管理-V1.4系统数据集补全姓名、组织、角色、大区、小区和组织代码。

### 修改
- 补充嵌入流程、数据实体、外部依赖、非功能要求和验收标准中的埋点验收口径。

---

## [v1.1] - 2026-06-29

### 新增
- 新增大平台嵌入兼容范围：2 期页面作为零售智能驾驶仓「零售过程」Tab 的 iframe 子应用交付。
- 新增 URL Query 参数适配要求：读取 `period / brand / area / district / store / theme / previewMode`，并按父应用筛选上下文初始化页面。
- 新增白天/黑夜主题兼容要求：子应用跟随父应用 `theme / previewMode`，不自建独立主题入口。
- 新增长图导出截图协作要求：子应用响应父应用 `RETAIL_CAPTURE_REQUEST`，返回完整 PNG 截图或明确错误。
- 新增父应用参考依赖：`参考资料/xcf317965b417427e8765343.zip`、`embedded-app-url-params.md`、`embedded-app-capture-protocol.md`。

### 修改
- 将产品定位从“2期多店聚合销售诊断工作台”调整为“2期多店聚合销售诊断工作台与大应用嵌入兼容”。
- 将入口流程从“独立进入工作台”调整为“父应用点击零售过程 Tab 后通过 iframe 打开子应用”。
- 将筛选来源从子应用内部筛选调整为父应用 Query 参数；子应用不重复实现大平台顶部导航、全局筛选、主题切换和保存长图菜单。
- 调整日期校验：不再硬性要求日期结束不包含今天，是否包含今天由父应用 `period` 映射口径决定。

### 删除
- 移除子应用自建大平台级主题切换和长图导出入口的范围。

---

## [v1.0] - 2026-06-29

- 初始版本：定义多店工作台 P0 为区域销售漏斗总览、区域主断点、问题门店列表、门店主断点与预估订单损失量、单店页跳转。

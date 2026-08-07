# 多店跳单店筛选条件合同设计

> 文档状态：方案待用户确认，未实施。
> 日期：2026-07-22
> 范围：仅设计多店 `multi-store-super-app/` 跳转父项目单店 `../super-app/` 时的筛选条件合同；本文件不代表代码已发布、已 QA 或已合并。
> 本轮限制：只更新本文档；当前父 `super-app` 与测试文件中的代码变化来自并发外部任务，不是本文档任务实施结果。
> 本轮补充：纳入 2026-07-22 只读实证，仍保持“待用户确认、未实施”；未修改源码、PRD、DEV-PLAN、测试、dist 或发布配置。

## 1. 结论摘要

| 事项 | 结论 | 优先级 | 原因 |
|---|---|---:|---|
| 多店 builder | 默认不改业务 builder；只补合同测试与规格锁定 | P0 | `multi-store-super-app/utils.js:98-132` 已由所有门店详情入口共用，且通过 `URLSearchParams.append("vehicleSeries", series)` 写重复参数；最新复核显示多店真实 URL 桥接可恢复 `[全新MG4, MG 4X]`。 |
| 单店主链 | 不是从零必须改；并发主链实现已出现且可保留，但 6 类缺口未闭环，不能交付 | P0 | 当前树已具备 `getAll` 重复参数、`string[]`、空集合、别名 fallback、去重排序、多选 UI、重复 URL 写回、`popstate`、页面内品牌/组织复位、销售 SQL/preview `IN`、稳定 cache key、常规 effect cancellation 和官方排名隐藏。 |
| 明确缺口 | 6 类缺口必须收口后才可实施 | P0 | 销售权威源与本地聚合映射存在冲突；过程来源分级未固化；手动/父壳 refresh 无 filterKey/token；URL 选择未按销售闭集剔除非法值；GIO 事件分工需文档锁定；交付完整性未证明 source/dist 同源且无旧合同残留。 |
| 过程数据 | 选项闭集只来自销售 `汇报车系名称`；来源级 mapper 只能返回销售闭集值或 `unmapped` | P0 | 当前全局 mapper 错把 `MG4 EV` 归入 `全新MG4`、缺 `MG07 EV/MG07 DMH -> MG 07`，RW 本地规则也未经销售闭集验证；最新只读实证已支持将试驾话术、NPS 和实时试驾标签列为 B，其他来源按 B-C/C 边界处理。 |
| 埋点事件 | 默认保持 `smartmind_sale_View` 官方入口 PV 与 `single_store_diagnosis_visit` 筛选上下文事件分工，不新增事件 | P0 | `smartmind_sale_View` 每次加载一次且不加车系字段；`single_store_diagnosis_visit` 随 `appliedFilter` 变化并按 key 去重，绝不能用于 PV 计数。 |
| `brand=全部` | 非阻塞待确认，不纳入本次默认改造 | P1 | 多店 builder 当前将 `brand=全部` 强制落为 `MG`；这是品牌合同边界，不应混入车系多选跳转改造。 |
| 目标/导出 | 单店 N/A | P2 | 当前父 `super-app` 未发现目标或导出功能，不为了抽象合同新增。 |

外部技术依据：WHATWG URL 标准定义 `get(name)` 只返回首个同名参数，`getAll(name)` 返回所有同名参数；因此跨应用多选必须用 `getAll + append` 的重复参数合同，禁止首项截断。

## 2. 当前真实调用链

```text
多店销售/过程门店行
  -> multi-store-super-app/app.js 渲染 [data-store-detail]
  -> RetailUtils.buildSingleStoreLink(params, row.store)
  -> runtime-config.js 解析当前环境单店 App URL
  -> URL query 携带门店、组织、日期、主题、source 和重复 vehicleSeries
  -> 父项目 ../super-app/index.html
  -> src/main.tsx
  -> App.tsx buildFilterFromSearchParams()
  -> StoreFilter / appliedFilter
  -> storeDiagnosis.ts 数据读取与页面渲染
```

### 2.1 多店状态 -> URL 参数 -> 单店 state -> 数据影响

| 上游状态 | URL 主参数 | 兼容别名/重复 | 单店读取优先级 | 单店 state | 数据影响 |
|---|---|---|---|---|---|
| 来源 | `source/sourceApp/sourceModule` | 无 | 仅上下文 | 暂不进入 `StoreFilter` | 仅审计/追踪，不改变数据 |
| 日期 | `startDate/endDate` | `dateStart/dateEnd` | `startDate` 优先，`endDate` 优先 | `startDate/endDate` | 全部销售与过程请求时间边界必须保真 |
| 品牌 | `brand` | `brandCode` 辅助 | `brand` | `brand` | 枚举、销售和过程品牌过滤；`brand=全部` 当前多店会落 MG，另列待确认 |
| 大区 | `region` | `area` | `region` 优先，`area` fallback | `region` | 组织上下文展示与筛选 |
| 小区 | `district` | `districtCode` 辅助 | `district` | `district` | 组织上下文展示与筛选 |
| 经销商名称 | `dealerShortName/dealer/store` | 多店三者同写 | `dealerShortName` > `dealer` > `store` | `dealer` | 标题展示与门店筛选 fallback |
| 经销商代码 | `dealerCompanyCode/dealerCode/storeCode` | 多店三者同写 | `dealerCompanyCode` > `dealerCode` > `storeCode` | `dealerCode` | 单店真实门店过滤；销售父级聚合另走 `salesDealerCode` |
| 主题 | `previewMode/theme` | 无 | `previewMode` > `theme` | 嵌入主题常量 | light/dark 视觉保真 |
| 车系集合 | 重复 `vehicleSeries` | `carSeries/series` 历史单值 fallback | 只要存在 canonical `vehicleSeries`，就不读别名；否则 `carSeries` > `series` | `vehicleSeries: string[]` | 销售 `汇报车系名称 IN (...)`；过程按分级策略处理；空数组=全部 |

### 2.2 当前代码证据与漂移说明

| 层级 | 当前证据 | 设计判断 |
|---|---|---|
| 多店 builder | `multi-store-super-app/utils.js:104-128` 写品牌、日期、组织、门店、主题，并对规范化后的车系集合逐个 `append("vehicleSeries", series)`。 | 多店不需要重写 builder；补跨应用测试即可。 |
| 多店车系合同 | `Product-Spec.md:904-908`、`941-948` 已锁重复参数、别名清理、品牌复位、销售集合联动；`DEV-PLAN.md:261-263` 记录 Phase 3G 已完成但未发布。 | 多店侧规格已相对完整；本设计只要求后续避免回归。 |
| 单店运行入口 | 父 `单店销售诊断工作台_PRD.md:13-19` 明确实际验收对象为 `super-app/`，`index-no-ai.html` 为静态基线；父根 `README.md:9-10` 仍把 `index-no-ai-retail-process.html` 写成当前线上基线。 | 必须列文档收口项，本轮不改。 |
| 单店车系工具层 | `../super-app/src/vehicleSeries.ts:25-63` 已有数组归一、排序、summary、tracking、`getAll` 读取和 `append` 写回。 | 当前并发实现已覆盖核心纯函数雏形，可保留；但 URL selection 仍需按当前品牌真实枚举二次剔除非法值。 |
| 单店状态类型 | `../super-app/src/services/storeDiagnosis.ts:73-84` 的 `StoreFilter.vehicleSeries?: string[]`。 | 单店已从 string 初步转向 string[]。 |
| 单店 URL 与 popstate | `../super-app/src/App.tsx:209-228` 读写 URL；`3302-3319` 监听 `popstate` 并恢复车系集合。 | 重复 URL 写回和 history 主链已出现；仍需补非法枚举和 refresh 竞态测试。 |
| 单店 UI | `../super-app/src/App.tsx:1579-1670` 已有多选菜单、0/1/N 文案、连续点击不关闭、`aria-multiselectable`。 | UI 方向正确；最新复核提到已新增 1440 截图，但完整 verify wrapper/build/verify:gio 未由本文档任务复跑。 |
| 单店销售过滤 | `../super-app/src/services/storeDiagnosis.ts:790-791` SQL WHERE 走 `buildSalesSqlWhere`，`795-796` 执行 SQL 聚合；`1774-1775` cache key 含 `vehicleSeriesKey`；`1792-1803` preview filter 构造会追加 `vehicleSeriesFilterCondition`，`1806-1818` preview fallback 按该 filters 分页读取。 | 销售链路已出现关键实现，但仍需合同测试证明 SQL/preview 同构。 |
| 单店全局 mapper | `../super-app/src/services/storeDiagnosis.ts:513-555` 的 `REPORT_VEHICLE_SERIES_RULES` 将 `MG4 EV -> 全新MG4`，未覆盖 `MG07 EV/MG07 DMH -> MG 07`；RW 还有 `RX5系列 -> RX5`、`iMax8（含ev） -> iMAX8 DMH` 等本地规则。 | 当前主要缺口是 mapper 口径错误，不是没有 mapper；MG 建议改为 `MG07 EV/MG07 DMH -> MG 07`、`MG4 EV -> 其他车系`，RW 每条规则必须对销售闭集逐项验证。 |
| 四类试驾补充指标 | `../super-app/src/services/storeDiagnosis.ts:609-627` 的 `buildTrialMetricSqlWhere` 已调用 `buildReportVehicleSeriesSql` 后再 `IN`；`630-720` 的录音、优质试驾、话术和 NPS 均共用该路径，NPS 在 `703-720` 按传入 `brand` 和 `品牌` 字段过滤。 | 已推翻历史结论：四类不是拿原始字段直连 SQL IN，NPS 也不是固定 MG；后续问题集中在来源分级、全局 mapper 和无品牌来源边界。 |
| 单店 GIO | 实现已有双事件：`smartmind_sale_View` 做官方入口 PV，`single_store_diagnosis_visit` 携带 `vehicleSeries` 稳定文本与 `vehicleSeriesCount`。 | 文档/事件清单未锁定；`smartmind_sale_View` 不加车系，诊断事件不得计 PV，仅剩正式纳入清单与空集合文案待确认。 |
| 单店测试 | 最新复核显示已新增 `vehicle-series-contract.test.mjs`、`vehicle-series-ui.test.mjs`、`verify-vehicle-series.mjs`、package `verify:vehicle-series` 和 1440 截图。 | 合同 3/3、父店 3/3、lint PASS；但本文档任务未复跑完整 verify wrapper/build/verify:gio，不能写已 QA 或全绿。 |

### 2.3 14:07 稳定树缺口清单

| 严重级别 | 缺口 | 当前影响 | 设计处置 |
|---|---|---|---|
| P0 | 过程来源已有全局 mapper，但分级尚未落实且 mapper 口径错误：`MG4 EV -> 全新MG4`、缺 `MG07 EV/MG07 DMH -> MG 07`，RW 本地规则未经销售闭集校验 | B 来源会因错误 alias 错分，B-C/C 来源会出现“有 mapper 即可联动”的假安全；四类补充指标当前已经过 `buildReportVehicleSeriesSql`，NPS 也已按传入品牌过滤，旧版“原始字段直连 SQL IN / NPS 品牌写死”判断已推翻 | 先修正全局 mapper，再按来源分级启用：话术、NPS、试驾实时标签按 B 设计联动；录音按 B-C、优质试驾和 IP 按 C 暂不联动；其他来源保持既有实证分级 |
| HIGH | `../super-app/src/App.tsx:3560-3604` 手动刷新/父壳 `REFRESH_DATA` 无 `filterKey/requestKey` token | A 车系刷新晚返回时可覆盖 B 车系页面，常规 effect cancellation 覆盖不了 refresh 分支 | 引入统一 `filterKey`，所有 refresh patch merge 前校验；父壳 `requestId` 只用于回包关联，不等同筛选身份 |
| MEDIUM | URL selection 未按当前品牌真实枚举剔除非法值，且 App 会把非法值并入菜单 | `vehicleSeries=非法车系` 可能显示为可选项并进入状态，造成假筛选 | 枚举加载后用当前品牌 options 二次 reconcile；非法值从 state、URL、菜单移除 |
| MEDIUM | GIO 文档/事件清单未锁定 | 实现已有双事件：`smartmind_sale_View` 是官方入口 PV，`single_store_diagnosis_visit` 是筛选上下文事件；若后者被当 PV 会放大访问量 | 默认 `smartmind_sale_View` 不加车系、诊断事件不得计 PV；仅将“是否正式纳入事件清单”和“空集合上报文案”列为上线前确认 |
| MEDIUM | 交付完整性未证明 | 当前只确认部分源码测试和截图，未证明两端 source/dist 同源、构建产物含最新合同代码、无旧单值参数/旧字段残留、无敏感信息 | 交付前必须新增完整性门禁并通过：source/dist 同源校验、构建产物合同扫描、旧合同残留扫描、敏感扫描 0 命中 |

### 2.4 只读实证与本轮收口

| 实证项 | 只读结果 | 设计收口 |
|---|---|---|
| 销售权威源 | `k4c...` 在 `2026-07-01~2026-07-21` 中，`品牌=MG / 汇报车系名称=全新MG4 / 原始车系=全新MG4` 为 92452 行；`品牌=MG / 汇报车系名称=其他车系 / 原始车系=MG4 EV` 为 262 行。 | `MG4 EV` 技术默认必须按销售事实归 `其他车系`；是否要改口径仍列唯一车系业务确认，未改销售权威口径前禁止覆盖。 |
| 当前全局 mapper | `REPORT_VEHICLE_SERIES_RULES` 在 `storeDiagnosis.ts:513-555` 含错误 `MG4 EV -> 全新MG4`，缺 `MG07 EV/MG07 DMH -> MG 07`，且 RW 规则沿用本地聚合映射。 | MG 建议改为 `MG07 EV/MG07 DMH -> MG 07`、`MG4 EV -> 其他车系`；RW `RX5/RX5 PLUS/iMAX8/E-iMAX8` 等别名必须以销售闭集实证，不能以本地硬编码为真值。 |
| 荣威映射冲突 | RW 的 `RX5/RX5 PLUS/iMAX8/E-iMAX8` 与本地聚合映射存在冲突。 | 不使用本地硬编码聚合映射作为跨源真值；RW 车系同样先回销售闭集校验。 |
| B 类已抽样来源 | 试驾明细 `c642...`、订单 `m349...`、试驾标签历史 `g9da...` 已抽样证明可进入 B 类。 | 允许设计来源级 mapper，但 mapper 只能返回销售闭集值或 `unmapped`；不能扩展选项，也不能把未知值猜成相近车系。 |
| 试驾录音 `c82...` | MG、`2026-07-01~2026-07-21`，SQL `exit 0/isTruncated=false`；去重 15857，其中全新MG4 10982、MG4 EV 9、MG 4X 4328、MG7 388、新一代MG5 114。 | 判 B-C，当前暂不联动；已经过 SQL mapper 不代表别名口径正确，需补全量枚举和销售闭集 fixture 后才能升 B。 |
| 优质试驾 `lbfb...` | MG、同期 SQL `exit 0/isTruncated=false`；MG4 EV 63、MG07 EV 188、MG07 DMH 13，空车系 2169，占 15.06%；源表无品牌字段。 | 判 C，暂不联动；只能明确为 MG 专用来源，不得在荣威/双品牌场景复用或依赖调用参数“猜品牌”。 |
| 试驾话术 `hd284...` 与 NPS `ud47...` | 同期 SQL `exit 0/isTruncated=false`；话术去重 11421、NPS 2704 份，两者枚举可对齐销售闭集；NPS 当前代码已按传入品牌过滤。 | 两者判 B，修正全局 mapper 并补 fixture 后可联动；无需修 NPS 品牌过滤。 |
| 试驾实时标签 `ie2...` | 闭环车系/原始车系组合稳定且有品牌字段；当前实时 SQL source 的车系字段仍是 `car_ser_name`。 | 判 B，可联动；实现必须优先 `closed_loop_car_series`，仅当其为空时用 `car_ser_name` 兜底，两者均须过销售闭集 mapper。 |
| DCC 污染 | DCC 在 MG 品牌下存在荣威车系污染。 | DCC 不得直接按原始车系字段联动；必须先做品牌+销售闭集双重校验，否则返回 `unmapped`。 |
| IP 历史 `n418...` | MG、同期 120159 通；原值冲突 10666/8.877%，至少错分/不确定 2932/2.440%，包括 MG07 EV 2746、MG07 DMH 78、最近意向原值 MG4 EV 且首次闭环/销售可比值为其他车系的字段冲突样本 77 通、其他 31。 | 判 C，暂不联动；销售事实仍归 `其他车系`，当前 mapper 错归 `全新MG4`；若未来重启，优先“首次闭环车系”，“最近意向车系”只做展示或前者空值兜底，不得无条件优先最近值。 |
| IP 实时 `ta197...` | MG、同期 94074 通，原值冲突仅 1；但原始别名 MG07 EV 2177、MG07 DMH 46、MG4 EV 55 会被当前 mapper 错分。 | 判 C，暂不联动；不能因原值冲突低就忽略 mapper 系统性错误，未来联动同样采用首次闭环优先策略。 |
| guancli 受阻 | DCC/实时源 `execute-sql` 返回 API500，`status=5001 TABLE_OR_VIEW_NOT_FOUND`；本轮使用 schema/preview 收口。 | 本轮只记录只读证据，不把 execute-sql 失败来源误判为“可联动”或“无数据”。后续验证需优先 schema/preview 或可用 SQL 路径复核。 |

### 2.5 精确只读实证表（MG，2026-07-01~21）

> 全表 SQL 状态：`exit 0`、`isTruncated=false`。本表只用于方案设计，不代表已改代码或已完成 QA。

| 来源 | 样本事实 | 分级 | 车系联动结论 | 方案要求 |
|---|---:|---|---|---|
| `c82...` 试驾录音 | 15857；全新MG4 10982、MG4 EV 9、MG4X 4328、MG7 388、新一代MG5 114 | B-C | 否 | 暂不联动；补全量枚举、销售闭集 fixture 和 mapper 冲突样本后再升 B。 |
| `lbfb...` 优质试驾 | 无品牌字段；MG4 EV 63、MG07 EV 188、MG07 DMH 13、空 2169/15.06% | C | 否 | 只能明确为 MG 专用来源；不得双品牌复用，不能靠传入品牌参数补品牌事实。 |
| `hd284...` 试驾话术 | 11421；枚举可对齐销售闭集 | B | 是 | 可联动；先修正全局 mapper，确保输出销售闭集值或 `unmapped`。 |
| `ud47...` NPS | 2704；枚举可对齐销售闭集 | B | 是 | 可联动；当前 `storeDiagnosis.ts:703-720` 已按传入 `brand` 与 `品牌` 字段过滤。 |
| `ie2...` 实时试驾标签 | 有闭环车系、原始车系和品牌字段 | B | 是 | 实现必须优先 `closed_loop_car_series`，为空再用 `car_ser_name` 兜底，并统一过销售闭集 mapper。 |
| `n418...` IP 历史 | 120159；原值冲突 10666/8.877%；至少 2932/2.440% 错分或不确定：MG07EV 2746、MG07DMH 78、最近意向原值 MG4 EV 且首次闭环/销售可比值为其他车系的字段冲突样本 77 通、其他 31 | C | 否 | 暂不联动；销售事实仍归 `其他车系`，当前 mapper 错归 `全新MG4`；未来如重启，优先首次闭环车系，最近意向车系只做展示或空值兜底。 |
| `ta197...` IP 实时 | 94074；冲突 1；原始别名 MG07EV 2177、MG07DMH 46、MG4EV 55 会被当前 mapper 错分 | C | 否 | 暂不联动；不能因冲突低忽略 alias 系统性错分，未来同样按首次闭环优先。 |

## 3. 规范合同

### 3.1 URL 参数合同

- Canonical 参数只使用重复 `vehicleSeries`：`?vehicleSeries=MG5&vehicleSeries=MG7`。
- `vehicleSeries` 一旦存在，优先级高于 `carSeries/series`；别名只在 canonical 完全不存在时 fallback。
- 空集合表示“全部车系”：URL 省略全部车系参数，不传 `vehicleSeries=全部车系`，也不传空字符串。
- 禁止逗号拼接：`vehicleSeries=MG5,MG7` 必须视为非法单值并剔除，不拆分。
- 禁止首项截断：读取端必须使用 `getAll("vehicleSeries")`，不得使用 `get("vehicleSeries")` 代表集合。
- 写回时删除 `vehicleSeries/carSeries/series` 后按规范集合逐项 `append("vehicleSeries", value)`。
- 编码由 `URLSearchParams` 负责，不手写 `%20`、`+` 或中文编码。

### 3.2 集合归一合同

- 输入：`string | string[] | null | undefined`。
- 输出：`string[]`，去空白、去重、删除 `全部车系`、删除非法枚举。
- 选项闭集：只来自销售权威源 `k4c...` 的 `汇报车系名称`；任何过程源、补充源、本地映射表或硬编码别名都不能新增选项。
- 排序：必须按当前品牌销售闭集枚举顺序稳定排序；不能按点击顺序、字典序或接口抖动顺序。
- 非法值：剔除；剔除后为空即全部车系。
- 品牌变化：先清空车系集合并清 URL，再读取新品牌枚举和数据；不得带旧品牌车系查新品牌。
- 组织/门店变化：单店 PRD 已要求复位，当前 App Header 对 region/district/dealer 变更已有清空动作；跨应用跳转时按 URL 初始上下文直接恢复，不做二次猜测。

### 3.3 刷新与历史合同

- 页面刷新：从 URL 恢复同一规范集合。
- 浏览器前进/后退：`popstate` 必须恢复集合、文案、数据和埋点上下文。
- 父壳刷新：`REFRESH_DATA` 必须绑定当前 `filterKey/requestKey`；旧请求返回时如果 requestKey 不等于当前 key，不得 merge patch。
- 手动刷新：与父壳刷新共用同一 requestKey 机制，不能仅依赖全局 `refreshInFlightRef`。
- 常规 `useEffect` cancellation 可保留，但它不是 refresh 分支的完整隔离方案。
- 日期、门店、主题：刷新或 history 不得丢失 `startDate/endDate/dealerCode/dealer/theme/previewMode`。

### 3.4 数据影响合同

- 销售事实：`汇报车系名称 IN (选中集合)`；空集合不加条件。
- 销售 preview fallback：同样使用 `IN`，与 SQL 路径同构。
- 官方排名/分位：缺车系维度时，非空集合继续隐藏或明确不可用，不展示总盘排名冒充车系排名。
- 过程事实：只允许“已证明且 mapper 返回销售闭集值”的来源按集合过滤；mapper 返回 `unmapped`、未证明或存在冲突的来源，保持既有组织/日期范围，并显示边界说明。
- 来源级 mapper：输入为来源原始车系字段和品牌上下文；输出只能是销售闭集中的一个值或 `unmapped`。禁止默认把 `MG4 EV` 并入 `全新MG4`；MG07 EV/MG07 DMH 应回到销售闭集 `MG 07`（业务简称可写 MG07）；禁止把 RW `RX5/RX5 PLUS/iMAX8/E-iMAX8` 按本地聚合映射硬并；IP 字段优先级确认前禁止无条件取“最近意向车系”。
- 四类试驾补充指标不是同一策略：试驾话术、NPS 判 B，可在修正 mapper 和补 fixture 后联动；录音判 B-C，暂不联动；优质试驾判 C 且无品牌字段，只能按 MG 专用边界处理。
- GIO：`smartmind_sale_View` 是官方入口 PV，每次加载一次且不加车系字段；`single_store_diagnosis_visit` 是筛选上下文事件，随 `appliedFilter` 变化并按 key 去重，不能计 PV。默认不新增事件；是否正式纳入事件清单和空集合上报文案上线前确认，不阻塞核心 URL/筛选参数合同。

## 4. 方案架构

### 4.1 单店建议结构

当前主链不是空白起步。建议在保留并发实现基础上，把 `../super-app/src/vehicleSeries.ts` 升级为正式合同层，或新增 `filter-contract.ts` 承载以下职责：

```text
src/filter-contract.ts
  parseFilterFromSearchParams(searchParams, enumOptions?)
  normalizeVehicleSeriesSelection(input, enumOptions?)
  reconcileVehicleSeriesWithOptions(selection, enumOptions)
  writeVehicleSeriesToSearchParams(params, selection)
  vehicleSeriesKey(selection)
  vehicleSeriesSummary(selection)
  filterKey(filter)
```

落地要求：

- `StoreFilter.vehicleSeries` 固定为 `string[]`，空数组为全部；当前可先保留 `?: string[]`，但最终建议收紧。
- `App.tsx` 只调合同函数，不在组件内手写参数解析和排序。
- `storeDiagnosis.ts` 销售 SQL 与 preview fallback 共用 `selectedVehicleSeries` 和 `vehicleSeriesKey`；过程来源必须先过来源级 mapper，mapper 返回销售闭集值才可消费车系集合，返回 `unmapped` 或未证明时只能消费门店、组织和日期边界。
- `loadWorkbenchInitialData/loadFunnelDataPatch/loadIpDataPatch/loadDriveBaseDataPatch/loadTrialOrderDataPatch` 的响应合并前统一核对 requestKey。
- `trackSingleStoreVisit` 已保留 `vehicleSeries` 文本和 `vehicleSeriesCount`；默认保持它为筛选上下文事件。`smartmind_sale_View` 仍是官方入口 PV，不加车系字段。
- 多店 `buildSingleStoreLink` 保留，仅补测试，避免两端各自生成不同 URL。

### 4.2 当前并发实现可保留项

- `vehicleSeries.ts` 的 `getAll/append`、空集合、`全部/全部车系` 归一、别名 fallback、去重排序、summary、tracking 文本。
- `StoreFilter.vehicleSeries?: string[]`、`App.tsx` 多选 UI、重复 URL 写回、`popstate` 和页面内品牌/组织复位。
- 销售 SQL/preview `IN`、稳定 cache key、官方排名隐藏、常规 effect cancellation。
- 辅助 GIO 事件 `single_store_diagnosis_visit` 的集合文本与 count。
- 多店真实 URL 桥接 `[全新MG4, MG 4X]` 的合同方向。

### 4.3 必须补齐项

- 请求身份：为每次 appliedFilter 生成 `filterKey`，特别覆盖手动/父壳 refresh。
- 非法值剔除：URL selection 必须按当前品牌销售闭集 reconcile，非法项不得进入菜单、状态、查询或埋点上下文。
- 过程来源和补充指标：DCC、试驾明细、订单、IP 标签、试驾标签、录音、优质试驾、开口率、NPS 按 A/B/C 分级治理；B 类必须经 mapper 返回销售闭集值，C/冲突/未证明来源不随车系联动；NPS 当前已按传入品牌过滤，无需作为固定品牌缺陷处理。
- 正式 GIO 事件：默认保持 `smartmind_sale_View` 官方 PV 与 `single_store_diagnosis_visit` 筛选上下文分工；是否把后者正式纳入事件清单、空集合上报“全部车系”还是空值，需上线前业务确认。
- 交付完整性：补 source/dist 同源、构建产物最新合同代码、旧单值参数/旧字段残留、敏感信息扫描门禁。
- 文档收口：父根 README 与父 PRD/DEV-PLAN 的验收基线冲突；`super-app/README.md` 当前宣称过程全量映射联动，也需与最终分级策略统一。

## 5. 过程数据源分级表

| 等级 | 来源 | 只读证据/字段 | 策略 |
|---|---|---|---|
| A：权威枚举与过滤 | 销售漏斗 `k4c14c31c595540a0a771f50` | 字段为 `汇报车系名称`；`2026-07-01~2026-07-21` 中 MG/全新MG4/全新MG4=92452 行，MG/其他车系/MG4 EV=262 行。 | 必须联动，作为选项闭集和过滤唯一事实源；`MG4 EV -> 全新MG4` 与权威汇报口径冲突，不得默认沿用。 |
| B：已抽样证明但必须回销售闭集 | 试驾明细 `c642...`、订单 `m349...`、试驾标签历史 `g9da...`、试驾话术 `hd284...`、NPS `ud47...`、实时试驾标签 `ie2...` | 已抽样证明可建立来源级映射；话术 11421、NPS 2704 枚举可对齐；实时试驾标签有闭环车系、原始车系和品牌字段。仍都不是选项源。 | 可设计 mapper；mapper 只能返回销售闭集值或 `unmapped`。实时试驾标签必须 `closed_loop_car_series` 优先、`car_ser_name` 兜底。 |
| B-C 边界 | 试驾录音 `c82...` | MG 同期去重 15857；全新MG4 10982、MG4 EV 9、MG4X 4328、MG7 388、新一代MG5 114。 | 暂不联动；需要补全量枚举、销售闭集 fixture 和冲突样本后才能升级为 B。 |
| C 或部分映射 | DCC `fa1...` | MG 品牌下存在荣威车系污染；DCC/实时源 execute-sql 曾返回 API500 `status=5001 TABLE_OR_VIEW_NOT_FOUND`，本轮用 schema/preview 收口。 | 不按原始车系字段过滤；除非后续证明品牌+销售闭集 mapper 可稳定返回，否则保持组织/日期范围。 |
| C 或部分映射 | IP 历史 `n418...`、IP 实时 `ta197...` | “最近意向车系”与“首次闭环车系”存在冲突，不能无条件取最近；实时源 SQL 路径受阻时只能用 schema/preview。 | IP 字段优先级必须业务确认；确认前不随车系联动。 |
| C 或部分映射 | 优质试驾 `lbfb...` | 源表无品牌字段；MG 同期空车系 2169/15.06%，且存在 MG4 EV 63、MG07 EV 188、MG07 DMH 13。 | 暂不联动；只能明确为 MG 专用来源，不得在荣威或双品牌场景复用。 |
| C：无车系维度 | 官方排名/分位 `xa257...` | 非空车系时跳过 `fetchRanks` 并 warning。 | 保持隐藏/不可用，不展示总盘排名。 |

分级原则：只有 A 能作为选项闭集并直接按汇报口径过滤；B 必须通过来源级 mapper 回到销售闭集，且以真实抽样对账和 fixture 证明；B-C、C、冲突或未证明来源不随车系联动。当前 `super-app/README.md:61-66` 宣称 DCC、试驾、订单和打标“统一映射后过滤”，但本轮只读实证已证明该说法过宽，后续必须按本表收口。

## 6. UI 方案

- 单店车系控件保持应用级位置：销售指标头部右侧，继承现有样式，不做无关视觉重构。
- 触发器文案：0 项“全部车系”；1 项显示车系名；N 项显示“已选 N 个车系”。
- 菜单交互：具体车系复选连续点击不关闭；点击“全部车系”清空；外点或 `Escape` 关闭。
- ARIA：触发器 `aria-haspopup=listbox`、`aria-expanded`；菜单 `role=listbox`、`aria-multiselectable=true`；选项 `role=option`、`aria-selected` 与可见勾选一致。
- 焦点：`Escape` 关闭后焦点回触发器；禁用态有明确 `disabled` 与可读文案。
- 品牌/组织复位：复位后触发器回“全部车系”，URL 清空车系参数，旧请求不得回填。
- 过程边界说明：若最终来源未证明或 mapper 返回 `unmapped`，非空集合时在过程模块/明细区显示“车系筛选仅覆盖销售汇报口径数据；当前过程来源无可证明同口径字段，保持门店/日期范围。”

## 7. 测试设计

| 测试层 | 用例 | 完成标准 |
|---|---|---|
| 纯合同测试 | `vehicleSeries=全新MG4&vehicleSeries=MG 4X` 读出两个值；`carSeries/series` fallback；canonical 优先；非法/空值剔除；特殊字符编码；排序稳定。 | Node 测试不依赖 DOM，断言 `string[]`、URL 和 key。 |
| 多店单测 | `buildSingleStoreLink` 对空集合省略；对 1/N 集合重复 append；保留门店、日期、品牌、组织、主题；`brand=全部` 当前落 MG 并记录边界。 | 不改 builder，仅补合同 fixture。 |
| 单店单测 | `StoreFilter.vehicleSeries=[]/1/N`；销售 SQL `IN`；preview `IN`；cache key 不复用；官方排名非空集合跳过。 | 覆盖 `storeDiagnosis.ts` SQL 与 fallback。 |
| 单店组件测试 | 0/1/N 文案；菜单连续操作；全部车系清空；外点/Escape；ARIA；品牌/组织复位。 | DOM 断言和键盘行为通过。 |
| 跨应用浏览器 | 多店选 2 个车系点销售/过程门店详情，单店 URL 和 UI 恢复同一集合；刷新保持；history 前进/后退保持。 | Playwright 1440x900 截图和 URL 断言。 |
| 请求竞态 | 快速切换 A/B 车系、父壳刷新、手动刷新，旧请求晚返回。 | 只有最后一次 requestKey 可 merge。 |
| 来源 mapper | MG4 EV 不得默认并入全新MG4；MG07 EV/MG07 DMH 回销售闭集 `MG 07`；RW `RX5/RX5 PLUS/iMAX8/E-iMAX8` 不得按本地聚合硬并；DCC 污染样本返回 `unmapped`；IP 字段冲突需待业务确认。 | mapper 只返回销售闭集值或 `unmapped`；未证明来源不触发车系过滤。 |
| 过程边界 | DCC、IP 历史/实时、录音 B-C、优质试驾 C 在未证明时不被过滤；试驾明细、订单、试驾标签历史、话术、NPS、实时试驾标签即使为 B，也必须按销售闭集 fixture 对账。 | 不出现“看似联动但口径不明”的结果。 |
| 七源只读基线 fixture | 固化 `c82=15857/B-C`、`lbfb=空车系2169/15.06%/C`、`hd284=11421/B`、`ud47=2704/B`、`ie2=B/闭环字段优先`、`n418=120159/C`、`ta197=94074/C`。 | 作为 mapper 规则变更的回归门禁；数据时点来自 2026-07-01~21 只读对账，只用于测试基线，不硬编码为产品恒定值。 |
| GIO | `smartmind_sale_View` 每加载一次、无车系字段；`single_store_diagnosis_visit` 随 `appliedFilter` 变化并按 key 去重，携带稳定集合文本、count 和 key。 | PV 只能统计 `smartmind_sale_View`；筛选上下文事件不能计 PV；事件字段不含数组对象、token 或敏感信息。 |
| 视觉 | 1440x900 展开态、浅/深色、长车系名、滚动菜单。 | 不遮挡、不横溢、不挤压指标。 |
| 交付完整性 | 两端 source/dist 同源；构建产物包含最新合同代码；无旧单值参数、旧字段残留；敏感扫描本地绝对路径、API key、`.env`、`.pem`、`.key`、`credential`。 | source 与 dist 指纹/内容可追溯；构建产物能检出最新 `getAll/append/string[]/filterKey/B 类边界` 合同；旧 `get("vehicleSeries")`、逗号拼接、单值字段误用 0 命中；敏感扫描 0 命中。 |

当前测试现状（来自最新复核，不由本文档任务复跑）：已新增 `vehicle-series-contract.test.mjs`、`vehicle-series-ui.test.mjs`、`verify-vehicle-series.mjs`、package `verify:vehicle-series` 和 1440 截图；合同 3/3、父店 3/3、lint PASS。完整 verify wrapper、build、`verify:gio` 在本轮只读约束下未由我们复跑，因此不得标记已 QA、已发布或全绿。

仍缺测试：refresh 竞态、非法枚举剔除、来源级 mapper 冲突样本、七源只读基线 fixture、DCC/IP/录音/优质试驾不联动边界、话术/NPS/实时试驾标签 B 类联动证明、实际 GIO payload、真实跨应用 Playwright、交付完整性门禁。

建议共享一份合同 fixture，例如：

```json
{
  "brand": "MG",
  "options": ["全新MG4", "MG 4X", "MG 07", "MG5", "其他车系", "未知车系"],
  "selected": ["MG 4X", "全新MG4"],
  "canonicalUrl": "vehicleSeries=全新MG4&vehicleSeries=MG+4X"
}
```

fixture 应共享，运行时代码不强行共享；多店是原生 JS，单店是 React/TS，强行抽运行时代码会扩大风险。

## 8. 文件影响清单

### 必须改

| 文件 | 改动 |
|---|---|
| `../super-app/src/App.tsx` | 保留当前 URL/UI 主链；补 refresh `filterKey/requestKey`、非法枚举 reconcile、必要焦点细节。 |
| `../super-app/src/vehicleSeries.ts` 或新增 `../super-app/src/filter-contract.ts` | 保留当前合同函数；补按当前品牌 options 剔除非法值和 filterKey。 |
| `../super-app/src/services/storeDiagnosis.ts` | 保留销售 SQL/preview IN 和 `buildTrialMetricSqlWhere -> buildReportVehicleSeriesSql` 当前路径；新增/收口来源级 mapper；B 类 mapper 只返回销售闭集值或 `unmapped`；录音 B-C、优质试驾 C、IP C、DCC 污染/未证明来源不按车系过滤；话术、NPS、实时试驾标签按 B 类补 fixture 后可联动；无需修 NPS 品牌过滤。 |
| `../super-app/src/services/gioTracking.ts`、`smartmindTracking.ts` | 默认不改事件分工：`smartmind_sale_View` 只做官方入口 PV 且不加车系字段，`single_store_diagnosis_visit` 做筛选上下文。是否正式纳入事件清单和空集合文案待用户确认后再改文档/测试。 |
| `../super-app/validation/` | 已有部分车系测试；继续补 refresh 竞态、非法枚举、来源级 mapper 冲突样本、DCC/IP/录音/优质试驾边界、话术/NPS/实时试驾标签 B 类联动、实际 GIO payload、真实跨应用 Playwright 和交付完整性门禁。 |
| 两端 `dist/` 或发布产物目录 | 不在本文档任务内修改；后续交付必须证明 source/dist 同源、构建产物包含最新合同代码、无旧合同残留、无敏感信息。 |

### 仅测试或文档

| 文件 | 改动 |
|---|---|
| `multi-store-super-app/validation/` | 若当前并发测试未覆盖真实 URL 桥接，补 `buildSingleStoreLink` 跨应用合同测试。 |
| `../super-app/README.md` | 后续收口 URL 多选说明和过程分级边界。 |
| `../README.md` | 后续修正 `index-no-ai-retail-process.html` 与 PRD 冲突。 |
| `../单店销售诊断工作台_PRD.md`、`../DEV-PLAN.md` | 当前已出现 Phase 3 多选合同；确认方案后再由主流程同步最终边界。 |

### 不改

| 对象 | 原因 |
|---|---|
| 本轮除本文档外的任何文件 | 用户明确当前只做分析和方案设计；源码、PRD、DEV-PLAN、测试、dist、发布配置均严禁修改。 |
| 多店 `multi-store-super-app/utils.js` builder | 当前满足重复参数输出，不做默认改造。 |
| 多店源码业务逻辑 | 本轮是跨应用合同设计，不改运行行为。 |
| 目标功能 | 单店当前 N/A，不凭空新增。 |
| 导出功能 | 单店当前 N/A，不凭空新增。 |
| `brand=全部` 行为 | 单列待确认，不纳入默认车系合同改造。 |

## 9. 实施阶段、回滚点、风险与未决策

### 9.1 阶段

1. 主链确认：保留当前 `getAll/string[]/URL/UI/销售 IN/cache/rank hide` 主链，先不重写。
2. 请求隔离补洞：引入 requestKey，统一 manual refresh/父壳 refresh 的 merge 门禁。
3. 非法枚举补洞：URL selection 按当前品牌真实枚举剔除非法值，并清理 URL/菜单。
4. 来源级 mapper 补洞：销售 A 作为选项和过滤权威源；试驾明细、订单、试驾标签历史、试驾话术、NPS、实时试驾标签按 B 类闭集 mapper 对账，其中实时试驾标签优先 `closed_loop_car_series`、`car_ser_name` 兜底；录音按 B-C 暂不联动；DCC、IP 历史/实时、优质试驾在未证明或字段冲突时不按车系过滤，只保留组织/日期范围和边界说明。
5. GIO 决策：默认保持两事件分工，不新增事件；上线前仅确认 `single_store_diagnosis_visit` 是否正式纳入事件清单，以及空集合上报文案。
6. 完整验证：补 refresh 竞态、非法枚举、全部 B 类来源映射证明、实际 GIO payload、真实跨应用 Playwright、build、verify wrapper、verify:gio。
7. 交付完整性验证：两端 source/dist 同源；构建产物包含最新合同代码；旧单值参数/旧字段残留 0 命中；本地绝对路径、API key、`.env`、`.pem`、`.key`、`credential` 敏感扫描 0 命中。
8. 文档收口：PRD/DEV-PLAN/README/super-app README 同步最终边界。

### 9.2 回滚点

- 阶段 1 若销售多选主链异常，回滚到空集合/单值兼容，但必须保留不截断的读取测试。
- 阶段 2 若 requestKey 或刷新编排异常，回滚刷新编排，不回滚 URL 合同。
- 阶段 3 若非法枚举 reconcile 误删合法车系，可回滚 reconcile 实现，但必须保留“非法值不得进入 state/URL/菜单/查询”的测试。
- 阶段 4 若来源映射无法证明或出现 MG4 EV/RW/IP/DCC 类冲突，回滚对应来源车系过滤，仅保留销售联动、组织/日期范围和边界说明。
- 阶段 5 若 GIO 正式事件清单未确认或 payload 异常，不改 `smartmind_sale_View`，继续保持 `single_store_diagnosis_visit` 为筛选上下文事件。
- 阶段 6 若完整验证失败，回到对应实现阶段修复；不得用局部通过替代完整 verify、build、GIO 和跨应用验证。
- 阶段 7 若交付完整性验证失败，阻断发布；回滚或重建 dist，直到 source/dist 同源、旧合同残留和敏感扫描全部通过。
- 阶段 8 若文档收口冲突，回滚冲突文案，不回滚已验证代码；以最终 PRD/README/DEV-PLAN 一致为准。

### 9.3 风险

| 风险 | 影响 | 处理 |
|---|---|---|
| 并发实现未经过 QA | 代码看起来已做，但行为未验收 | 设计文档只描述“当前树已出现”，不宣称完成。 |
| 来源字段映射误用 | 销售汇报口径和 DCC/试驾/订单/IP 标签/试驾标签/补充指标原始口径混算；MG4 EV、MG07 EV/DMH、RW、IP、DCC 冲突会造成错筛 | 选项只来自销售闭集；mapper 只返回闭集值或 `unmapped`；MG4 EV 技术推荐按销售事实归 `其他车系`，MG07 EV/DMH 归 `MG 07`，RW 逐条回销售闭集核验，未证明/冲突不联动。 |
| GIO 事件误计 PV | `single_store_diagnosis_visit` 随筛选变化，若计 PV 会放大访问量 | PV 只用 `smartmind_sale_View`；筛选上下文只用 `single_store_diagnosis_visit`。 |
| 旧请求覆盖 | 快速切换车系后页面串数 | requestKey 合同。 |
| 交付产物漂移 | source 已修但 dist 未含最新合同，或旧单值参数残留 | source/dist 同源、构建产物合同扫描、旧残留扫描、敏感扫描全部纳入 QA 门禁。 |
| 文档冲突 | 后续 Agent 误读验收对象或过程联动范围 | README/PRD/DEV-PLAN 收口作为正式任务。 |
| `brand=全部` | 多店默认落 MG，跨品牌语义不清 | 单独确认，不阻塞本次。 |

### 9.4 未决策项

| 编号 | 问题 | 是否阻塞本合同 |
|---|---|---:|
| Q1 | `brand=全部` 跳单店到底应落 MG、保留全部，还是阻断选择？ | No |
| Q2 | IP 在“最近意向车系”和“首次闭环车系”冲突时的业务优先级是什么？默认方案为首次闭环优先、最近只展示或空值兜底，是否业务认可？ | Yes，阻塞 IP 车系联动 |
| Q3 | 单店 `vehicleSeries` 是否从可选数组收紧为必填数组？ | No，但建议 |
| Q4 | `single_store_diagnosis_visit` 是否正式纳入事件清单？空集合上报文案用“全部车系”还是空值？ | No，不阻塞核心参数合同；上线前确认 |
| Q5 | 父壳 `REFRESH_DATA` 是否会并发发送多个 requestId？ | No，但影响 requestKey 测试强度 |
| Q6 | `MG4 EV` 是否接受技术默认按销售事实归 `其他车系`？若业务要并入全新MG4，必须先改销售权威口径。 | Yes，阻塞 MG4 EV alias 最终实现 |

## 10. 可测验收标准

- Given 多店当前选中 `["全新MG4","MG 4X"]`，When 点击任一销售/过程门店详情，Then 单店 URL 包含两个重复 `vehicleSeries`，且保留 `startDate/endDate/brand/region/district/dealer/dealerCode/theme/previewMode`。
- Given 单店 URL 同时包含 `vehicleSeries=全新MG4&vehicleSeries=MG 4X&carSeries=MG7`，When 页面加载，Then 只采用 canonical 两个值，并按枚举顺序写回，别名清除。
- Given 单店 URL 只有 `carSeries=MG7`，When 页面加载，Then fallback 为 `["MG7"]` 并在下一次写回时变成规范 `vehicleSeries=MG7`。
- Given URL 无车系或全部车系被清空，When 页面加载或点击“全部车系”，Then state 为 `[]`，URL 不含车系参数，销售查询不附加车系条件。
- Given 选中多个车系，When 销售 SQL 和 preview fallback 执行，Then 均使用完整 `汇报车系名称 IN (...)` 集合，且 cache key 含稳定集合 key。
- Given 选中具体车系，When 读取官方排名/分位，Then 不请求或不展示无车系维度总盘排名，并给出明确不可用说明。
- Given 用户快速从 A 集合切到 B 集合，When A 请求晚返回，Then A 响应被丢弃，页面只展示 B 集合结果。
- Given 品牌或组织变化，When 新筛选生效，Then 车系集合清空、URL 清理、GIO count=0、旧请求不回填。
- Given 来源 mapper 遇到 `MG4 EV`，When 销售权威源显示其 `汇报车系名称=其他车系`，Then 不得默认输出 `全新MG4`。
- Given 来源 mapper 遇到 `MG07 EV/MG07 DMH/MG07EV/MG07DMH`，When 当前品牌为 MG，Then 默认输出销售闭集 `MG 07`；若当前销售闭集实际枚举写作 `MG07`，以销售闭集原文为准。
- Given 来源 mapper 遇到 RW `RX5/RX5 PLUS/iMAX8/E-iMAX8`，When 本地聚合映射与销售权威口径冲突，Then mapper 返回销售闭集值或 `unmapped`，不得按本地硬编码聚合。
- Given DCC、IP 历史/实时、录音 B-C 或优质试驾 C 未被证明，When 选中具体车系，Then 不按原始车系字段或前端映射字段过滤，仅保持组织/日期范围，页面显示边界说明。
- Given 试驾明细、订单、试驾标签历史、话术、NPS、实时试驾标签申请按车系联动，When 缺少销售闭集 mapper、真实抽样对账或 fixture 任一证据，Then Review/QA 判失败，不允许交付为“已联动”。
- Given 实时试驾标签同时存在 `closed_loop_car_series` 和 `car_ser_name`，When 生成车系过滤字段，Then 优先使用 `closed_loop_car_series`；仅当闭环字段为空时才用 `car_ser_name` 兜底。
- Given mapper 规则发生变更，When 跑回归测试，Then 必须加载七源只读基线 fixture：`c82=15857/B-C`、`lbfb=空车系2169/15.06%/C`、`hd284=11421/B`、`ud47=2704/B`、`ie2=B/闭环字段优先`、`n418=120159/C`、`ta197=94074/C`；这些数值只代表 2026-07-01~21 只读对账基线，不得写成产品恒定阈值或展示口径。
- Given GIO 上报，When 页面加载，Then `smartmind_sale_View` 只上报一次官方入口 PV 且不含车系字段。
- Given GIO 上报，When `appliedFilter` 变化，Then `single_store_diagnosis_visit` 按 key 去重后记录筛选上下文，`vehicleSeries` 为“全部车系”/单值/稳定拼接文本，`vehicleSeriesCount` 为 0/1/N，且该事件不得计入 PV。
- Given 1440x900 页面展开菜单，When 连续选择/取消至少 3 次，Then 文案、勾选、ARIA、滚动、焦点和布局不回归。
- Given 进入交付前检查，When 扫描 source 与 dist，Then 两端同源、构建产物包含最新合同代码、旧单值参数/旧字段残留 0 命中，且本地绝对路径、API key、`.env`、`.pem`、`.key`、`credential` 敏感扫描 0 命中。

## 11. 建议 Review -> QA 门禁

1. Code Review Stage 1：只看合同边界，重点查是否有 `get("vehicleSeries")`、逗号拼接、首项截断、别名覆盖 canonical、旧请求无 key、未证明来源伪联动、`MG4 EV -> 全新MG4` 默认映射、IP 无条件取最近意向车系。
2. Code Review Stage 2：看实现质量，重点查纯函数可测性、UI 可访问性、cache key 稳定性、来源级 mapper 只返回销售闭集或 `unmapped`、GIO 两事件分工和文档一致性。
3. QA：独立跑单店合同测试、跨应用 Playwright、1440x900、品牌变化、快速切换、父壳刷新、GIO mock、来源级 mapper 冲突样本、C/未证明来源过程边界。
4. 交付完整性 QA：两端 source/dist 同源；构建产物包含最新合同代码；`get("vehicleSeries")` 旧单值读取、逗号拼接、旧字段误用等残留 0 命中；本地绝对路径、API key、`.env`、`.pem`、`.key`、`credential` 敏感扫描 0 命中。
5. QA 不通过必须回实现 Agent 修复后重跑；通过前不得发布、commit 或 push。

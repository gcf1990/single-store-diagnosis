# MG07 小订战报最终独立 QA

## 结论

PASS / 通过。

P0/P1/P2 = 0/0/0。

全量命令门禁、数据口径、权限边界、角色入口、日期边界、截图、source/dist、安全扫描和文档一致性均通过。原两个 P2 均已关闭：`validation/small-order-model.test.mjs` 488 行超限已拆分关闭；三份主文档的 v1.94 最终计数已与本次复核一致，lint 计数均为 `56 files`，未再残留错误 `53 files`。

## 具体问题

无 P0 / P1 / P2 问题。

## 已关闭问题

- 原 P2-1 文件行数门禁未满足：已关闭。
  - 证据：`wc -l` 本次输出 `validation/small-order-model.test.mjs=146`、`validation/small-order-api.test.mjs=130`、`validation/small-order-real-replay.test.mjs=140`、`validation/small-order-test-helpers.mjs=45`、`validation/small-order-app-integration.spec.js=159`。
  - 证据：生产相关文件本次核验为 `small-order-config.js=65`、`small-order-contract.js=284`、`small-order-model.js=138`、`small-order-api.js=200`、`small-order-view.js=89`、`small-order.css=204`。
  - 对照：上述所有核验文件均 `<300` 行。
- 原 P2-2 文档 QA 计数与最终 QA 不一致：已关闭。
  - 证据：`npm run lint` 本次输出 `Syntax check passed: 56 files`。
  - 证据：`rg -n '53 files|lint Syntax check `53 files`|lint `53 files`' Product-Spec.md DEV-PLAN.md Product-Spec-CHANGELOG.md` 无命中，exit `1`。
  - 证据：`Product-Spec.md:1530` 写 `lint Syntax check 56 files`。
  - 证据：`DEV-PLAN.md:3` 写 `lint 56 files`。
  - 证据：`Product-Spec-CHANGELOG.md:16` 写 `lint Syntax check 56 files`。

## 通过项证据

- 真实 `/tmp` 回放：`qa-screenshots/mg07-small-order-final/tmp-replay-audit.json`
  - `sourceRows=404`
  - `summaryRows=1`
  - `configuredRows=403`
  - `targetTotal=30001`
  - `zeroTargetRows=17`
  - `areaCount=7`
  - `unmappedRows=0`
  - `validPrimaryHits=395`
  - `specialStatusRows=8`
  - `specialStatusTarget=287`
  - `MQ257T -> MQ256T`，门店 `溧阳名锐`，目标 `45`
- 篡改 fail-closed：
  - 重复代码篡改：`status=data_incomplete`，错误 `sourceUniqueCodes、canonicalUniqueCodes`
  - 异常店逐值篡改：`status=data_incomplete`，错误 `validPrimaryMissDetailsMatch`
- 六入口：`qa-screenshots/mg07-small-order-final/role-entry-results.json`
  - 总部：首层 `area`，第五动态位 `落后大区`
  - 大区：首层 `district`，第五动态位 `落后小区`
  - 小区：首层 `store`，第五动态位 `落后门店`
  - 销售总监：首层 `store`，第五动态位 `自身进度状态`
  - 投资人：首层 `store`，第五动态位 `落后门店`
  - 精确单店：首层 `store`，第五动态位 `自身进度状态`
- 四日期边界：`qa-screenshots/mg07-small-order-final/date-boundary-results.json`
  - `2026-07-28`：`小订即将开始`，实际窗口 `null`，进度 `0.0%`
  - `2026-07-29`：`小订进行中`，实际窗口 `2026-07-29~2026-07-29`，进度 `4.0%`
  - `2026-08-22`：`小订进行中`，实际窗口 `2026-07-29~2026-08-22`，进度 `100.0%`
  - `2026-08-23`：`小订已结束`，实际窗口 `2026-07-29~2026-08-22`，进度 `100.0%`
- actual unavailable：
  - `npm test` 用例通过：`实际源不可用时保留目标但不构造0实际、达成率和落后缺口`
  - PC 用例通过：`实际源不可用时页面保留目标并将实际相关字段显示为空值语义`
  - PC 用例通过：`实际源不可用的表格状态使用中性色而非成功或失败色`
- 目标/合同失败不可展开：
  - `small-order-view.js` 仅 `ready/partial/empty` 渲染展开按钮；`target_unavailable/data_incomplete` 渲染状态消息。
- 命令门禁：
  - `npm test`：187/187 passed
  - `npm run lint`：Syntax check passed 56 files
  - `npm run build`：exit 0
  - `npm run test:pc`：111/111 passed
  - `npm audit --omit=dev --audit-level=critical`：found 0 vulnerabilities
  - `git diff --check -- Product-Spec.md DEV-PLAN.md Product-Spec-CHANGELOG.md qa-screenshots/mg07-small-order-final/QA-REPORT.md multi-store-super-app`：exit 0
- source/dist：
  - 复制型运行时文件 `cmp` 无 mismatch。
  - `dist`：37 files，784 KB。
- 隐私扫描：
  - 排除测试和本地代理的非密钥变量名后，`/Users/`、private key、api key、secret、password、credential 无命中。
  - `.env*`、`*.pem`、`*.key`、`*credential*`、`*.db` 无命中。
- 真实数据集：
  - `guancli ds get h8ae7b66fd5d141ec95bd246 --brief`：`MG07小订目标_20260727`，`FINISHED`，404 行 / 8 列，更新 `2026-07-27 18:22:34+0800`。
  - `guancli ds get a310ff90fddff4b6283841c6 --brief`：组织维表 `FINISHED`，35008 行 / 42 列。
  - `guancli ds get k4c14c31c595540a0a771f50 --brief`：实际销售主表 `FINISHED`，字段覆盖 `当日首触小订数/留存/退订/转大定`、`汇报车系名称`、`一级经销商代码`。
- 权限/认证态与发布边界：
  - `guancli auth status`：uIdToken 有效，过期时间 `2026-08-10 02:04:05`，AdminToken 无。
  - 匿名访问测试 App `q0844640cf6734877a3193d6`：HTTP 401。
  - 匿名访问生产 App `re37c3447cb0443a68a36a40`：HTTP 401。
  - QA 未执行发布命令；未做登录态线上业务页验收。
- 文档边界：
  - `Product-Spec.md`、`DEV-PLAN.md`、`Product-Spec-CHANGELOG.md` 均写明 v1.94 未发布、登录态生产页面验收未完成、16 组 READER 权限等待用户明确授权。
  - 未发现错误宣称“线上完成”或“权限完成”。

## 截图路径

- `/Users/chengfengguo/Documents/trae_projects/日常工作/零售全链路检核/销售诊断工作台-new/单店诊断工作台demo/2期-多店聚合-重做版/qa-screenshots/mg07-small-order-final/mg07-small-order-1280-light.png`
- `/Users/chengfengguo/Documents/trae_projects/日常工作/零售全链路检核/销售诊断工作台-new/单店诊断工作台demo/2期-多店聚合-重做版/qa-screenshots/mg07-small-order-final/mg07-small-order-1280-dark.png`
- `/Users/chengfengguo/Documents/trae_projects/日常工作/零售全链路检核/销售诊断工作台-new/单店诊断工作台demo/2期-多店聚合-重做版/qa-screenshots/mg07-small-order-final/mg07-small-order-1366-light.png`
- `/Users/chengfengguo/Documents/trae_projects/日常工作/零售全链路检核/销售诊断工作台-new/单店诊断工作台demo/2期-多店聚合-重做版/qa-screenshots/mg07-small-order-final/mg07-small-order-1366-dark.png`
- `/Users/chengfengguo/Documents/trae_projects/日常工作/零售全链路检核/销售诊断工作台-new/单店诊断工作台demo/2期-多店聚合-重做版/qa-screenshots/mg07-small-order-final/mg07-small-order-1440-light.png`
- `/Users/chengfengguo/Documents/trae_projects/日常工作/零售全链路检核/销售诊断工作台-new/单店诊断工作台demo/2期-多店聚合-重做版/qa-screenshots/mg07-small-order-final/mg07-small-order-1440-dark.png`

## 修复建议

无需修复。当前可直接交付本地开发与独立 QA 结果；发布、16 组 READER 权限同步和登录态生产页面验收仍按文档边界处理。

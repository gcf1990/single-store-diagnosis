# 单店销售诊断工作台 Super App

本目录是观远 Super App 形态的 React + TypeScript + Vite 工程。

当前前端 demo 基线只认根目录的 `index-no-ai.html`，不以根目录 `index.html` 作为本期验收基线。

## 运行

```bash
npm install
npm run dev
```

本地地址：

```text
http://localhost:5173/
```

构建：

```bash
npm run build
```

## 数据源边界

已确认数据源已接入 `src/services/storeDiagnosis.ts`，运行在观远 Super App 环境时会通过 `/api/data-source/...` 读取：

- 销售漏斗指标源
- DCC 话务指标源
- 试驾明细宽表
- 官方排名分位结果表

本地开发如果没有观远 API 代理或登录态，页面会显示读取失败提示并回退 mock，避免误把空页面当成真实数据。

未确认数据源保持独立服务层占位，当前 IP 已接真实打标明细，试驾打标仍用 mock 明细支撑可视化和交互：

- IP 打标明细数据集：`IP电话邀约问题诊断明细表-202606后`（dsId: `n418e47dacdb94291993d3d9`）
- 试驾打标明细数据集

后续接入真实观远数据时，优先替换 `src/services/storeDiagnosis.ts`，不要把打标明细源写死在页面组件里。

## 已复刻交互

- 顶部大区、小区、经销商、日期筛选。
- 销售漏斗 8 指标展示。
- 邀约/试驾过程指标分组。
- 点击指标切换深度分析聚焦。
- 点击更多按钮打开日趋势浮窗。
- 电话邀约/试驾接待 Tab 切换。
- 标签分布、顾问分布、明细清单。
- 点击明细打开客户证据抽屉。

export const ironRaw = {
  range: { startDate: "2026-07-01", endDate: "2026-07-20" },
  sourceStates: {
    inviteMention: { status: "success", complete: true },
    intentLevel: { status: "success", complete: true },
    dcc: { status: "success", complete: true },
    qualityTrial: { status: "success", complete: true },
    trialRecord: { status: "success", complete: true },
    trialTalk: { status: "success", complete: true }
  },
  inviteMentionRows: [
    { dealer_code: "S1", record_id: "C1", ai_qc_score: 98, mg_inv_in_trial: 1, mg_plus_micro_apply: 0 },
    { dealer_code: "S1", record_id: "C2", ai_qc_score: 97, mg_inv_in_trial: 0, mg_plus_micro_apply: 1 },
    { dealer_code: "S2", record_id: "C3", ai_qc_score: 90, mg_inv_in_trial: 0, mg_plus_micro_apply: 0 }
  ],
  intentLevelRows: [
    { "经销商代码": "S1", "意向等级": "高意向", "销售等级": "低" },
    { "经销商代码": "S1", "意向等级": "高意向", "销售等级": "高" },
    { "经销商代码": "S2", "意向等级": "高意向", "销售等级": "高" }
  ],
  dccRows: [
    { "经销商代码": "S1", "线索编码": "L1", "下发CRM时间": "2026-07-01", "首次通话时长": "70", "首次通话时长(秒)": 70, "是否接通": "是", "是否工作时段线索（10-18）": "工作时段", "工作时段30分钟跟进（10-18）": "是", "是否24小时外呼": "是" },
    { "经销商代码": "S1", "线索编码": "L2", "下发CRM时间": "2026-07-20", "首次通话时长": "20", "首次通话时长(秒)": 20, "是否接通": "是", "是否工作时段线索（10-18）": "工作时段", "工作时段30分钟跟进（10-18）": "否", "是否24小时外呼": "否" },
    { "经销商代码": "S2", "线索编码": "L3", "下发CRM时间": "2026-07-10", "首次通话时长": "", "首次通话时长(秒)": 0, "是否接通": "否", "是否工作时段线索（10-18）": "非工作时段", "工作时段30分钟跟进（10-18）": "否", "是否24小时外呼": "否" }
  ],
  dccThreeCallRows: [
    { "经销商代码": "S1", "线索编码": "L1", "日期-门店看板": "2026-07-01", "是否完成48小时三呼": "否" },
    { "经销商代码": "S1", "线索编码": "L2", "日期-门店看板": "2026-07-20", "是否完成48小时三呼": "是" },
    { "经销商代码": "S2", "线索编码": "L3", "日期-门店看板": "2026-07-10", "是否完成48小时三呼": "否" }
  ],
  qualityTrialRows: [
    { "经销商代码": "S1", "优质试驾数": 1, "常规试驾数": 2 },
    { "经销商代码": "S2", "优质试驾数": 0, "常规试驾数": 1 }
  ],
  trialRecordRows: [
    { "经销商代码": "S1", "试驾接待编码(PK)": "R1", "是否有录音": "Y" },
    { "经销商代码": "S1", "试驾接待编码(PK)": "R2", "是否有录音": "N" }
  ],
  trialTalkRows: [
    { "经销商代码": "S1", "试驾清单ID": "T1", "试驾体验点": "手机互联", "是否提及": "是" },
    { "经销商代码": "S1", "试驾清单ID": "T2", "试驾体验点": "手机互联", "是否提及": "否" },
    { "经销商代码": "S1", "试驾清单ID": "T3", "试驾体验点": "全场景自动泊车-离车泊入", "是否提及": "否" },
    { "经销商代码": "S1", "试驾清单ID": "T4", "试驾体验点": "其他", "是否提及": "是" }
  ]
};

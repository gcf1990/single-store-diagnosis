(function (root) {
  const SOURCE_STATUS = { loading: "loading", success: "success", empty: "empty", incomplete: "incomplete" };
  const DS = {
    inviteMention: "q00c55c3745c34650badf4f8",
    intentLevel: "w8f3c4f1af6c54f7d91f4dc5",
    dcc: "fa1bfbd7736f34d1d8633883",
    trialRecord: "c82d917a45e37437bac8ade4",
    qualityTrial: "lbfb702c771cd496d85896f7",
    trialTalk: "hd284d093e54c4b29bc32ccc",
    target: "k7cd977aec6874e6ead56ce9"
  };
  const GROUPS = [
    { code: "invite", label: "邀约指标 7", count: 7 },
    { code: "trial", label: "试驾指标 4", count: 4 }
  ];
  const METRICS = [
    { section: "invite", order: 1, code: "invite_trial_mention_rate", name: "邀约进店试驾提及率", target: 0.53, ds: DS.inviteMention, source: "inviteMention" },
    { section: "invite", order: 2, code: "wechat_apply_mention_rate", name: "加微申请提及率", target: 0.56, ds: DS.inviteMention, source: "inviteMention" },
    { section: "invite", order: 3, code: "high_intent_low_level_rate", name: "高意向低水平", target: 0.05, ds: DS.intentLevel, source: "intentLevel" },
    { section: "invite", order: 4, code: "first_follow_call_60s_rate", name: "首跟通话60s占比", target: null, ds: DS.dcc, source: "dcc" },
    { section: "invite", order: 5, code: "follow_30min_rate", name: "30分钟跟进率", target: 0.85, ds: DS.dcc, source: "dcc" },
    { section: "invite", order: 6, code: "follow_24h_rate", name: "24小时跟进率", target: 0.9, ds: DS.dcc, source: "dcc" },
    { section: "invite", order: 7, code: "two_day_three_call_rate", name: "2天3呼率", target: 0.8, ds: DS.dcc, source: "dcc" },
    { section: "trial", order: 1, code: "quality_trial_rate", name: "优质试驾率", target: 0.45, ds: DS.qualityTrial, source: "qualityTrial" },
    { section: "trial", order: 2, code: "trial_record_upload_rate", name: "试驾录音回收率", target: 0.65, ds: DS.trialRecord, source: "trialRecord" },
    { section: "trial", order: 3, code: "phone_car_interconnect_mention_rate", name: "手车互联开口率", target: 0.5, ds: DS.trialTalk, source: "trialTalk" },
    { section: "trial", order: 4, code: "remote_parking_mention_rate", name: "离车泊入开口率", target: 0.5, ds: DS.trialTalk, source: "trialTalk" }
  ];
  const SOURCE_NAMES = {
    inviteMention: "[准实时]话务记录明细宽表&ads_sale_mart_ipcall_recd_dtl_wide_comb_wms",
    intentLevel: "IP电话意向水平标签拼信息",
    dcc: "双品牌DCC话务指标182",
    trialRecord: "[直连][市场营销数据应用集市]全量试驾明细拼接录音画像表&ads_sale_mart_t_trial_splice_record_prt_comb_wms",
    qualityTrial: "MG试驾看板数据-3试驾点",
    trialTalk: "[直连][市场营销数据应用集市]试驾场景顾问话术质检&ads_sale_mart_t_trial_cons_talk_qi_comb_wms"
  };
  function targetLabel(value) {
    return value == null ? null : `目标 ${Math.round(value * 100)}%`;
  }
  function metricsFor(section) {
    return METRICS.filter((metric) => metric.section === section).sort((a, b) => a.order - b.order);
  }
  function metricByCode(code) {
    return METRICS.find((metric) => metric.code === code) || null;
  }
  root.IronMetricsContract = { DS, GROUPS, METRICS, SOURCE_NAMES, SOURCE_STATUS, targetLabel, metricsFor, metricByCode };
})(window);

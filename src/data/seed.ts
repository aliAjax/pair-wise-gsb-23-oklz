// 资料层初始数据：房间/点位、消毒剂与培养基批次、检验员、
// 以及用于演示的历史采样轮次与判定版本。

import type { AppState } from "../types";

export const SEED_STATE: AppState = {
  rooms: [
    {
      id: "CR-1201",
      name: "刻蚀区 1201",
      grade: "ISO 5",
      limitCfu: 1,
      points: [
        { id: "CR-1201-P1", name: "设备外壳 1.0m", surface: "不锈钢" },
        { id: "CR-1201-P2", name: "东墙面", surface: "彩钢板" },
        { id: "CR-1201-P3", name: "操作台台面", surface: "环氧树脂" },
        { id: "CR-1201-P4", name: "传递窗内表面", surface: "不锈钢" },
      ],
    },
    {
      id: "CR-2107",
      name: "薄膜区 2107",
      grade: "ISO 6",
      limitCfu: 3,
      points: [
        { id: "CR-2107-P1", name: "涂布机导轨", surface: "阳极氧化铝" },
        { id: "CR-2107-P2", name: "北墙面", surface: "彩钢板" },
        { id: "CR-2107-P3", name: "地面回风口", surface: "PVC" },
      ],
    },
    {
      id: "Y-0302",
      name: "黄光区 0302",
      grade: "黄光区",
      limitCfu: 3,
      points: [
        { id: "Y-0302-P1", name: "涂胶机台", surface: "不锈钢" },
        { id: "Y-0302-P2", name: "防黄光板墙面", surface: "彩钢板" },
        { id: "Y-0302-P3", name: "周转车台面", surface: "不锈钢" },
      ],
    },
    {
      id: "CR-1803",
      name: "清洗区 1803",
      grade: "ISO 7",
      limitCfu: 5,
      points: [
        { id: "CR-1803-P1", name: "清洗槽外壁", surface: "PP" },
        { id: "CR-1803-P2", name: "南墙面", surface: "彩钢板" },
        { id: "CR-1803-P3", name: "地漏周边地面", surface: "环氧自流平" },
      ],
    },
  ],

  batches: [
    { id: "B-D-2408", no: "XD-2408", kind: "disinfectant", name: "0.2% 过氧乙酸", expiresOn: "2026-12-31" },
    { id: "B-D-2311", no: "XD-2311", kind: "disinfectant", name: "75% 乙醇", expiresOn: "2026-08-31" },
    { id: "B-D-2503", no: "XD-2503", kind: "disinfectant", name: "季铵盐消毒剂", expiresOn: "2027-03-15" },
    { id: "B-M-2410", no: "TSA-2410", kind: "medium", name: "TSA 接触碟 55mm", expiresOn: "2026-11-30" },
    { id: "B-M-2306", no: "TSA-2306", kind: "medium", name: "TSA 接触碟 55mm", expiresOn: "2026-09-15" },
    { id: "B-M-2507", no: "TSA-2507", kind: "medium", name: "TSA 接触碟 55mm", expiresOn: "2027-01-20" },
  ],

  analysts: [
    { id: "A-01", name: "王敏", title: "微生物检验员" },
    { id: "A-02", name: "李强", title: "微生物检验员" },
    { id: "A-03", name: "陈静", title: "微生物检验员" },
    { id: "A-04", name: "赵工", title: "QA 主管" },
  ],

  rounds: [
    // CR-1201：初擦菌落超限已阻断，复擦进行中（漏 1 点 + 1 点未换人）
    {
      id: "R-1201-1",
      roomId: "CR-1201",
      kind: "initial",
      roundBatchNo: "CHG-0918-A",
      openedAt: "2026-09-18T08:30",
      openedBy: "赵工",
      sealed: true,
      sealedAt: "2026-09-20T16:05",
    },
    {
      id: "R-1201-2",
      roomId: "CR-1201",
      kind: "rewipe",
      roundBatchNo: "CHG-0922-B",
      rewipeReason: "初擦 P1 设备外壳菌落 6 CFU/碟，超 ISO 5 限值 1；重新消毒后安排复擦。",
      openedAt: "2026-09-22T09:00",
      openedBy: "赵工",
      sealed: false,
    },
    // CR-2107：初擦漏采阻断，复擦全点通过已放行（结果冻结）
    {
      id: "R-2107-1",
      roomId: "CR-2107",
      kind: "initial",
      roundBatchNo: "CHG-0915-C",
      openedAt: "2026-09-15T08:40",
      openedBy: "赵工",
      sealed: true,
      sealedAt: "2026-09-17T15:20",
    },
    {
      id: "R-2107-2",
      roomId: "CR-2107",
      kind: "rewipe",
      roundBatchNo: "CHG-0919-D",
      rewipeReason: "初擦 P3 地面回风口漏采，补齐后复测全部点位。",
      openedAt: "2026-09-19T09:10",
      openedBy: "赵工",
      sealed: true,
      sealedAt: "2026-09-21T17:00",
    },
    // Y-0302：初擦进行中，已登记 2 点（其中 1 点培养基过期），尚漏 1 点
    {
      id: "R-0302-1",
      roomId: "Y-0302",
      kind: "initial",
      roundBatchNo: "CHG-0923-E",
      openedAt: "2026-09-23T10:00",
      openedBy: "赵工",
      sealed: false,
    },
    // CR-1803：初擦使用过期消毒剂，已阻断待处理
    {
      id: "R-1803-1",
      roomId: "CR-1803",
      kind: "initial",
      roundBatchNo: "CHG-0920-F",
      openedAt: "2026-09-20T08:20",
      openedBy: "赵工",
      sealed: true,
      sealedAt: "2026-09-22T16:40",
    },
  ],

  samples: [
    // CR-1201 初擦：P1 超限
    {
      id: "S-1001", roomId: "CR-1201", roundId: "R-1201-1", pointId: "CR-1201-P1",
      roundBatchNo: "CHG-0918-A", sampledAt: "2026-09-18",
      disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2410",
      cfu: 6, analystId: "A-01", createdAt: "2026-09-18T09:12", updatedAt: "2026-09-18T09:12",
    },
    {
      id: "S-1002", roomId: "CR-1201", roundId: "R-1201-1", pointId: "CR-1201-P2",
      roundBatchNo: "CHG-0918-A", sampledAt: "2026-09-18",
      disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2410",
      cfu: 0, analystId: "A-01", createdAt: "2026-09-18T09:20", updatedAt: "2026-09-18T09:20",
    },
    {
      id: "S-1003", roomId: "CR-1201", roundId: "R-1201-1", pointId: "CR-1201-P3",
      roundBatchNo: "CHG-0918-A", sampledAt: "2026-09-18",
      disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2410",
      cfu: 1, analystId: "A-02", createdAt: "2026-09-18T09:31", updatedAt: "2026-09-18T09:31",
    },
    {
      id: "S-1004", roomId: "CR-1201", roundId: "R-1201-1", pointId: "CR-1201-P4",
      roundBatchNo: "CHG-0918-A", sampledAt: "2026-09-18",
      disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2410",
      cfu: 0, analystId: "A-02", createdAt: "2026-09-18T09:40", updatedAt: "2026-09-18T09:40",
    },
    // CR-1201 复擦：已采 3 点，P3 漏采；P1 未换人（仍为 A-01），演示换人拦截
    {
      id: "S-1005", roomId: "CR-1201", roundId: "R-1201-2", pointId: "CR-1201-P1",
      roundBatchNo: "CHG-0922-B", sampledAt: "2026-09-22",
      disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507",
      cfu: 0, analystId: "A-01", createdAt: "2026-09-22T09:40", updatedAt: "2026-09-22T09:40",
    },
    {
      id: "S-1006", roomId: "CR-1201", roundId: "R-1201-2", pointId: "CR-1201-P2",
      roundBatchNo: "CHG-0922-B", sampledAt: "2026-09-22",
      disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507",
      cfu: 0, analystId: "A-03", createdAt: "2026-09-22T09:48", updatedAt: "2026-09-22T09:48",
    },
    {
      id: "S-1007", roomId: "CR-1201", roundId: "R-1201-2", pointId: "CR-1201-P4",
      roundBatchNo: "CHG-0922-B", sampledAt: "2026-09-22",
      disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507",
      cfu: 1, analystId: "A-03", createdAt: "2026-09-22T09:55", updatedAt: "2026-09-22T09:55",
    },

    // CR-2107 初擦：P3 漏采（仅 2 条）
    {
      id: "S-2001", roomId: "CR-2107", roundId: "R-2107-1", pointId: "CR-2107-P1",
      roundBatchNo: "CHG-0915-C", sampledAt: "2026-09-15",
      disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2410",
      cfu: 1, analystId: "A-02", createdAt: "2026-09-15T09:00", updatedAt: "2026-09-15T09:00",
    },
    {
      id: "S-2002", roomId: "CR-2107", roundId: "R-2107-1", pointId: "CR-2107-P2",
      roundBatchNo: "CHG-0915-C", sampledAt: "2026-09-15",
      disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2410",
      cfu: 2, analystId: "A-02", createdAt: "2026-09-15T09:08", updatedAt: "2026-09-15T09:08",
    },
    // CR-2107 复擦：全点合格、全部换人
    {
      id: "S-2003", roomId: "CR-2107", roundId: "R-2107-2", pointId: "CR-2107-P1",
      roundBatchNo: "CHG-0919-D", sampledAt: "2026-09-19",
      disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507",
      cfu: 0, analystId: "A-01", createdAt: "2026-09-19T10:00", updatedAt: "2026-09-19T10:00",
    },
    {
      id: "S-2004", roomId: "CR-2107", roundId: "R-2107-2", pointId: "CR-2107-P2",
      roundBatchNo: "CHG-0919-D", sampledAt: "2026-09-19",
      disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507",
      cfu: 1, analystId: "A-01", createdAt: "2026-09-19T10:07", updatedAt: "2026-09-19T10:07",
    },
    {
      id: "S-2005", roomId: "CR-2107", roundId: "R-2107-2", pointId: "CR-2107-P3",
      roundBatchNo: "CHG-0919-D", sampledAt: "2026-09-19",
      disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507",
      cfu: 0, analystId: "A-03", createdAt: "2026-09-19T10:15", updatedAt: "2026-09-19T10:15",
    },

    // Y-0302 初擦（进行中）：P2 使用过期培养基 TSA-2306
    {
      id: "S-3001", roomId: "Y-0302", roundId: "R-0302-1", pointId: "Y-0302-P1",
      roundBatchNo: "CHG-0923-E", sampledAt: "2026-09-23",
      disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2410",
      cfu: 1, analystId: "A-01", createdAt: "2026-09-23T10:30", updatedAt: "2026-09-23T10:30",
    },
    {
      id: "S-3002", roomId: "Y-0302", roundId: "R-0302-1", pointId: "Y-0302-P2",
      roundBatchNo: "CHG-0923-E", sampledAt: "2026-09-23",
      disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2306",
      cfu: 0, analystId: "A-01", createdAt: "2026-09-23T10:38", updatedAt: "2026-09-23T10:38",
    },

    // CR-1803 初擦：全部使用过期 75% 乙醇 XD-2311
    {
      id: "S-4001", roomId: "CR-1803", roundId: "R-1803-1", pointId: "CR-1803-P1",
      roundBatchNo: "CHG-0920-F", sampledAt: "2026-09-20",
      disinfectantBatchId: "B-D-2311", mediumBatchId: "B-M-2410",
      cfu: 2, analystId: "A-02", createdAt: "2026-09-20T09:00", updatedAt: "2026-09-20T09:00",
    },
    {
      id: "S-4002", roomId: "CR-1803", roundId: "R-1803-1", pointId: "CR-1803-P2",
      roundBatchNo: "CHG-0920-F", sampledAt: "2026-09-20",
      disinfectantBatchId: "B-D-2311", mediumBatchId: "B-M-2410",
      cfu: 1, analystId: "A-02", createdAt: "2026-09-20T09:07", updatedAt: "2026-09-20T09:07",
    },
    {
      id: "S-4003", roomId: "CR-1803", roundId: "R-1803-1", pointId: "CR-1803-P3",
      roundBatchNo: "CHG-0920-F", sampledAt: "2026-09-20",
      disinfectantBatchId: "B-D-2311", mediumBatchId: "B-M-2410",
      cfu: 3, analystId: "A-03", createdAt: "2026-09-20T09:15", updatedAt: "2026-09-20T09:15",
    },
  ],

  judgments: [
    {
      id: "J-1201-1", roomId: "CR-1201", roundId: "R-1201-1", verdict: "blocked",
      reason: "P1 设备外壳菌落 6 CFU/碟，超 ISO 5 限值（≤1），房间停待处理，禁止开工。",
      decidedAt: "2026-09-20T16:05", decider: "赵工", version: 1,
    },
    {
      id: "J-2107-1", roomId: "CR-2107", roundId: "R-2107-1", verdict: "blocked",
      reason: "P3 地面回风口漏采，采样未覆盖全部点位，不予放行。",
      decidedAt: "2026-09-17T15:20", decider: "赵工", version: 1,
    },
    {
      id: "J-2107-2", roomId: "CR-2107", roundId: "R-2107-2", verdict: "released",
      reason: "复擦 3 个点位全部采样，菌落 0/1/0 CFU/碟均 ≤3，批次在有效期内，准予放行。",
      decidedAt: "2026-09-21T17:00", decider: "赵工", version: 2,
    },
    {
      id: "J-1803-1", roomId: "CR-1803", roundId: "R-1803-1", verdict: "blocked",
      reason: "三点位均使用已过期消毒剂 XD-2311（2026-08-31 到期），结果无效，房间停待处理。",
      decidedAt: "2026-09-22T16:40", decider: "赵工", version: 1,
    },
  ],
};

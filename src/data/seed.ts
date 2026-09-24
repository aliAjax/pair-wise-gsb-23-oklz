// 资料层：主数据与演示种子记录
// 演示基准日期：2026-09-24

import type { AppData, Inspector, LotBatch, RoomDef } from "./types";

export const TODAY = "2026-09-24";

export const ROOMS: RoomDef[] = [
  {
    id: "CR-1201",
    name: "灌装间 A 线",
    grade: "A",
    points: [
      { id: "P-01", name: "层流罩内壁" },
      { id: "P-02", name: "灌装针头支架" },
      { id: "P-03", name: "隔离器操作手套" },
    ],
  },
  {
    id: "CR-2203",
    name: "配液间",
    grade: "B",
    points: [
      { id: "P-01", name: "RABS 操作台面" },
      { id: "P-02", name: "传递窗内侧" },
      { id: "P-03", name: "墙面回风栅" },
      { id: "P-04", name: "地面排水口周边" },
    ],
  },
  {
    id: "CR-3105",
    name: "洁具清洗间",
    grade: "C",
    points: [
      { id: "P-01", name: "清洗池台面" },
      { id: "P-02", name: "洁具架中层" },
      { id: "P-03", name: "地漏周边" },
    ],
  },
  {
    id: "CR-4302",
    name: "器具存放间",
    grade: "D",
    points: [
      { id: "P-01", name: "存放架上层" },
      { id: "P-02", name: "房门把手" },
    ],
  },
];

export const INSPECTORS: Inspector[] = [
  { id: "U01", name: "王敏", role: "微生物检验员" },
  { id: "U02", name: "李强", role: "微生物检验员" },
  { id: "U03", name: "陈静", role: "QC 主管" },
  { id: "U04", name: "赵磊", role: "QA 放行人" },
];

export const DISINFECTANTS: LotBatch[] = [
  { id: "XD-2608", name: "0.1% 季铵盐消毒剂", expiryDate: "2026-11-30" },
  { id: "XD-2609", name: "75% 乙醇", expiryDate: "2026-10-15" },
  { id: "XD-2512", name: "0.5% 过氧乙酸", expiryDate: "2026-08-31" },
];

export const MEDIA: LotBatch[] = [
  { id: "M-TA-2608", name: "胰酪大豆胨琼脂接触碟(TSA)", expiryDate: "2026-12-15" },
  { id: "M-TA-2609", name: "胰酪大豆胨琼脂接触碟(TSA)", expiryDate: "2026-10-01" },
  { id: "M-TA-2511", name: "沙氏葡萄糖琼脂接触碟(SDA)", expiryDate: "2026-09-05" },
];

const stamp = "2026-09-24T08:00:00.000Z";
const stampAfter = "2026-09-24T16:00:00.000Z";

export function createSeedData(): AppData {
  const data: AppData = {
    disinfectants: DISINFECTANTS,
    media: MEDIA,
    rounds: [
      // CR-1201 首批，全部合格，已放行冻结
      { id: "R-1001", roomId: "CR-1201", createdAt: stamp, createdBy: "U01", frozen: true },
      // CR-2203 首批，P-04 漏采，待处理
      { id: "R-2001", roomId: "CR-2203", createdAt: stamp, createdBy: "U02", frozen: false },
      // CR-3105 首批，消毒剂过期 + P-03 超限，停行
      { id: "R-3001", roomId: "CR-3105", createdAt: stamp, createdBy: "U01", frozen: true },
      // CR-3105 复擦批次（换人），复擦尚未完成
      {
        id: "R-3002",
        roomId: "CR-3105",
        createdAt: stampAfter,
        createdBy: "U02",
        frozen: false,
        reworkOf: { roundId: "R-3001", reason: "首批消毒剂批号 XD-2512 已过期，且地漏周边菌落 28 CFU 超过 C 级 25 CFU 限度，按偏差流程复擦" },
      },
      // CR-4302 首批已建，尚未登记结果
      { id: "R-4001", roomId: "CR-4302", createdAt: stampAfter, createdBy: "U01", frozen: false },
    ],
    samples: [
      // CR-1201 合格（A 级不得检出）
      { id: "S-1001", roundId: "R-1001", roomId: "CR-1201", pointId: "P-01", disinfectantBatchId: "XD-2608", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 0, inspectorId: "U01", createdAt: stamp, updatedAt: stamp, frozen: true },
      { id: "S-1002", roundId: "R-1001", roomId: "CR-1201", pointId: "P-02", disinfectantBatchId: "XD-2609", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 0, inspectorId: "U01", createdAt: stamp, updatedAt: stamp, frozen: true },
      { id: "S-1003", roundId: "R-1001", roomId: "CR-1201", pointId: "P-03", disinfectantBatchId: "XD-2608", mediumBatchId: "M-TA-2609", sampledAt: TODAY, cfu: 0, inspectorId: "U02", createdAt: stamp, updatedAt: stamp, frozen: true },

      // CR-2203：P-04 漏采（无记录），其余有效
      { id: "S-2001", roundId: "R-2001", roomId: "CR-2203", pointId: "P-01", disinfectantBatchId: "XD-2609", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 1, inspectorId: "U02", createdAt: stamp, updatedAt: stamp, frozen: false },
      { id: "S-2002", roundId: "R-2001", roomId: "CR-2203", pointId: "P-02", disinfectantBatchId: "XD-2609", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 0, inspectorId: "U02", createdAt: stamp, updatedAt: stamp, frozen: false },
      { id: "S-2003", roundId: "R-2001", roomId: "CR-2203", pointId: "P-03", disinfectantBatchId: "XD-2608", mediumBatchId: "M-TA-2609", sampledAt: TODAY, cfu: 4, inspectorId: "U01", createdAt: stamp, updatedAt: stamp, frozen: false },

      // CR-3105 首批：消毒剂过期 + P-03 超限
      { id: "S-3001", roundId: "R-3001", roomId: "CR-3105", pointId: "P-01", disinfectantBatchId: "XD-2512", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 6, inspectorId: "U01", createdAt: stamp, updatedAt: stamp, frozen: true },
      { id: "S-3002", roundId: "R-3001", roomId: "CR-3105", pointId: "P-02", disinfectantBatchId: "XD-2512", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 12, inspectorId: "U01", createdAt: stamp, updatedAt: stamp, frozen: true },
      { id: "S-3003", roundId: "R-3001", roomId: "CR-3105", pointId: "P-03", disinfectantBatchId: "XD-2512", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 28, inspectorId: "U01", createdAt: stamp, updatedAt: stamp, frozen: true },

      // CR-3105 复擦（换人 U02），只采了 1/3
      { id: "S-3101", roundId: "R-3002", roomId: "CR-3105", pointId: "P-01", disinfectantBatchId: "XD-2608", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 2, inspectorId: "U02", createdAt: stampAfter, updatedAt: stampAfter, frozen: false },
    ],
    decisions: [
      {
        id: "D-1001",
        roomId: "CR-1201",
        roundId: "R-1001",
        version: 1,
        verdict: "released",
        reason: "首批全部点位合格，符合放行条件",
        decidedBy: "U04",
        decidedAt: stampAfter,
        basis: {
          evaluatedAt: stampAfter,
          totalPoints: 3,
          sampledPoints: 3,
          countedPoints: 3,
          complete: true,
          passed: true,
          findings: [
            { pointId: "P-01", pointName: "层流罩内壁", codes: [], details: [] },
            { pointId: "P-02", pointName: "灌装针头支架", codes: [], details: [] },
            { pointId: "P-03", pointName: "隔离器操作手套", codes: [], details: [] },
          ],
        },
      },
      {
        id: "D-3001",
        roomId: "CR-3105",
        roundId: "R-3001",
        version: 1,
        verdict: "blocked",
        reason: "消毒剂批号 XD-2512 已过期且地漏周边菌落超限，按偏差停行处理",
        decidedBy: "U04",
        decidedAt: stampAfter,
        basis: {
          evaluatedAt: stampAfter,
          totalPoints: 3,
          sampledPoints: 3,
          countedPoints: 3,
          complete: true,
          passed: false,
          findings: [
            {
              pointId: "P-01",
              pointName: "清洗池台面",
              codes: ["DISINFECTANT_EXPIRED"],
              details: ["消毒剂批号 XD-2512（0.5% 过氧乙酸）已于 2026-08-31 过期"],
            },
            {
              pointId: "P-02",
              pointName: "洁具架中层",
              codes: ["DISINFECTANT_EXPIRED"],
              details: ["消毒剂批号 XD-2512（0.5% 过氧乙酸）已于 2026-08-31 过期"],
            },
            {
              pointId: "P-03",
              pointName: "地漏周边",
              codes: ["DISINFECTANT_EXPIRED", "CFU_OVER_LIMIT"],
              details: [
                "消毒剂批号 XD-2512（0.5% 过氧乙酸）已于 2026-08-31 过期",
                "菌落数 28 CFU 超过 C 级限度 25 CFU/碟",
              ],
            },
          ],
        },
      },
    ],
  };
  return data;
}

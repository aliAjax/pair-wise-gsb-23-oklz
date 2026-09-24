/* 规则自检：不经过页面，直接跑判定层 + 保存层（内存版 localStorage 替身） */
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => delete store[k],
};

import { SEED_STATE } from "../src/data/seed";
import {
  activeProblems,
  evaluateRound,
  getRoom,
  latestRound,
  rewipeAnalystConflicts,
  roomStatus,
  ROOM_STATUS,
  roundPasses,
} from "../src/domain/rules";
import { judgeRoom, openRewipe, overturnJudgment, resetState, upsertSample } from "../src/storage/repository";
import type { AppState } from "../src/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}
function expectThrow(name: string, fn: () => unknown, fragment?: string) {
  try {
    fn();
    check(name, false, "（未抛错）");
  } catch (error) {
    const message = (error as Error).message;
    check(name + (fragment ? `：${message}` : ""), !fragment || message.includes(fragment));
  }
}

let state: AppState = resetState();

// 1. 种子数据四种房间状态
console.log("种子状态：");
check("CR-1201 初擦超限 → 阻断待处理", roomStatus(state, "CR-1201") === ROOM_STATUS.BLOCKED);
check("CR-2107 复擦全过 → 已放行", roomStatus(state, "CR-2107") === ROOM_STATUS.RELEASED);
check("Y-0302 采样未判定 → 采样中禁开工", roomStatus(state, "Y-0302") === ROOM_STATUS.COLLECTING);
check("CR-1803 过期消毒剂 → 阻断待处理", roomStatus(state, "CR-1803") === ROOM_STATUS.BLOCKED);

let round = latestRound(state, "CR-1201")!;
let checks = evaluateRound(state, getRoom(state, "CR-1201"), round);
check("CR-1201 复擦漏采 P3", checks.some((c) => c.problems.some((p) => p.type === "missing" && p.pointId === "CR-1201-P3")));
check("CR-1201 复擦 P1 未换人被识别", rewipeAnalystConflicts(state, getRoom(state, "CR-1201"), round)[0]?.includes("设备外壳"));
check("CR-1201 复擦整体不通过", !roundPasses(checks));

round = latestRound(state, "Y-0302")!;
checks = evaluateRound(state, getRoom(state, "Y-0302"), round);
check("Y-0302 识别过期培养基", checks.some((c) => c.problems.some((p) => p.type === "batchExpired")));

// 2. upsert：同点位同批更新而非新增
console.log("登记/更新：");
const beforeCount = state.samples.length;
state = upsertSample(state, "Y-0302", {
  pointId: "Y-0302-P3",
  sampledAt: "2026-09-24",
  roundBatchNo: "CHG-0923-E",
  disinfectantBatchId: "B-D-2503",
  mediumBatchId: "B-M-2507",
  cfu: 2,
  analystId: "A-03",
}).state;
check("新点位新增一条", state.samples.length === beforeCount + 1);
state = upsertSample(state, "Y-0302", {
  pointId: "Y-0302-P3",
  sampledAt: "2026-09-24",
  roundBatchNo: "CHG-0923-E",
  disinfectantBatchId: "B-D-2503",
  mediumBatchId: "B-M-2507",
  cfu: 1,
  analystId: "A-03",
}).state;
check("同点位同批只留一条（更新）", state.samples.length === beforeCount + 1);
expectThrow("批次不一致被拦截", () =>
  upsertSample(state, "Y-0302", {
    pointId: "Y-0302-P3", sampledAt: "2026-09-24", roundBatchNo: "CHG-9999-Z",
    disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507", cfu: 1, analystId: "A-03",
  }), "不一致");

// Y-0302 仍有过期培养基 P2，放行须被拦
expectThrow("存在过期批次不能放行", () => judgeRoom(state, "Y-0302", "released", "尝试放行"), "不能放行");
state = judgeRoom(state, "Y-0302", "blocked", "P2 使用过期培养基 TSA-2306，阻断");
check("阻断后房间待处理", roomStatus(state, "Y-0302") === ROOM_STATUS.BLOCKED);
expectThrow("已封闭轮次不能再登记", () =>
  upsertSample(state, "Y-0302", {
    pointId: "Y-0302-P1", sampledAt: "2026-09-24", roundBatchNo: "CHG-0923-E",
    disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507", cfu: 0, analystId: "A-01",
  }), "冻结");

// 3. 复擦换人 + 全点复测 + 冻结放行
console.log("复擦闭环：");
expectThrow("复擦必须填批次", () => openRewipe(state, "Y-0302", "", "说明"), "批次");
state = openRewipe(state, "Y-0302", "CHG-0924-G", "更换有效培养基，重新消毒");
const yRound = latestRound(state, "Y-0302")!;
check("复擦批次登记为新批次", yRound.roundBatchNo === "CHG-0924-G");

// 故意先让 P1 仍由 A-01 复测（初擦 P1 是 A-01）
state = upsertSample(state, "Y-0302", {
  pointId: "Y-0302-P1", sampledAt: "2026-09-24", roundBatchNo: "CHG-0924-G",
  disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2507", cfu: 0, analystId: "A-01",
}).state;
state = upsertSample(state, "Y-0302", {
  pointId: "Y-0302-P2", sampledAt: "2026-09-24", roundBatchNo: "CHG-0924-G",
  disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2507", cfu: 0, analystId: "A-02",
}).state;
expectThrow("未全部复测不能放行（漏 P3）", () => judgeRoom(state, "Y-0302", "released", "尝试放行"), "不能放行");
state = upsertSample(state, "Y-0302", {
  pointId: "Y-0302-P3", sampledAt: "2026-09-24", roundBatchNo: "CHG-0924-G",
  disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2507", cfu: 0, analystId: "A-02",
}).state;
expectThrow("复擦未换人不能放行", () => judgeRoom(state, "Y-0302", "released", "尝试放行"), "换人");

// P1 改由 A-02（初擦未做 P1）复测，P2/P3 改由初擦未做这两点的 A-03 复测；
// P3 初擦登记人是 A-03，因此复擦用 A-02（同一点位换人才是约束，检验员可兼不同点位）
state = upsertSample(state, "Y-0302", {
  pointId: "Y-0302-P1", sampledAt: "2026-09-24", roundBatchNo: "CHG-0924-G",
  disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2507", cfu: 0, analystId: "A-02",
}).state;
state = upsertSample(state, "Y-0302", {
  pointId: "Y-0302-P2", sampledAt: "2026-09-24", roundBatchNo: "CHG-0924-G",
  disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2507", cfu: 0, analystId: "A-03",
}).state;
state = upsertSample(state, "Y-0302", {
  pointId: "Y-0302-P3", sampledAt: "2026-09-24", roundBatchNo: "CHG-0924-G",
  disinfectantBatchId: "B-D-2408", mediumBatchId: "B-M-2507", cfu: 0, analystId: "A-02",
}).state;
state = judgeRoom(state, "Y-0302", "released", "复擦三点位全部合格、换人复测，放行");
check("放行后房间可开工", roomStatus(state, "Y-0302") === ROOM_STATUS.RELEASED);
check("放行后无挂起问题", activeProblems(state, "Y-0302").length === 0);
check("放行轮次已冻结", latestRound(state, "Y-0302")!.sealed === true);

// 4. 改判只新增版本
console.log("改判版本：");
expectThrow("改判必须填原因", () => overturnJudgment(state, "Y-0302", "blocked", "  "), "原因");
const versionsBefore = (state as any).judgments.filter((j: any) => j.roomId === "Y-0302").length;
state = overturnJudgment(state, "Y-0302", "blocked", "复盘发现培养温度偏差，原结果无效");
const versionsAfter = (state as any).judgments.filter((j: any) => j.roomId === "Y-0302").length;
check("改判新增一条版本", versionsAfter === versionsBefore + 1);
check("新版本指向被改判版本", Boolean((state as any).judgments.filter((j: any) => j.roomId === "Y-0302").at(-1).overturns));
check("改判后房间回到待处理", roomStatus(state, "Y-0302") === ROOM_STATUS.BLOCKED);
check("历史放行版本仍保留", (state as any).judgments.filter((j: any) => j.roomId === "Y-0302" && j.verdict === "released").length === 1);
expectThrow("同样式改判被拦截", () => overturnJudgment(state, "Y-0302", "blocked", "再来一次"), "无需");

// 5. CR-2107 已冻结轮次只读
console.log("冻结保护：");
expectThrow("已放行房间历史轮次不能改记录", () =>
  upsertSample(state, "CR-2107", {
    pointId: "CR-2107-P1", sampledAt: "2026-09-24", roundBatchNo: "CHG-0919-D",
    disinfectantBatchId: "B-D-2503", mediumBatchId: "B-M-2507", cfu: 0, analystId: "A-02",
  }), "冻结");

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);

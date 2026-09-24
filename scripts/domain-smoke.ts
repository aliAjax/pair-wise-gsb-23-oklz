// 判定层关键规则冒烟测试（不入库，直接跑纯函数）
import assert from "node:assert";
import { createSeedData, TODAY } from "../src/data/seed";
import {
  DomainError,
  addDecision,
  boardState,
  checkReworkInspectorChange,
  createReworkRound,
  createRound,
  decisionsForRoom,
  decisionsForRound,
  evaluateRound,
  latestRound,
  upsertSample,
} from "../src/domain/rules";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, name);
  passed += 1;
  console.log("✓", name);
}

function room(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ROOMS } = require("../src/data/seed");
  return ROOMS.find((r: any) => r.id === id);
}

let data = createSeedData();

// 1. 种子：CR-1201 已放行；CR-2203 漏采待处理；CR-3105 停行（复擦进行中）
const s1201 = evaluateRound(room("CR-1201"), latestRound(data, "CR-1201")!, data, TODAY);
ok("CR-1201 评估通过且冻结", s1201.passed && s1201.frozen);
ok("CR-1201 看板为已放行", boardState(s1201, decisionsForRoom(data, "CR-1201")[0]) === "released");

const s2203 = evaluateRound(room("CR-2203"), latestRound(data, "CR-2203")!, data, TODAY);
ok("CR-2203 不完整（P-04 漏采）", !s2203.complete);
ok("CR-2203 存在漏采码", s2203.points.some((p) => p.codes.includes("MISSING")));
ok("CR-2203 看板为待处理", boardState(s2203, undefined) === "processing");

const s3105 = evaluateRound(room("CR-3105"), latestRound(data, "CR-3105")!, data, TODAY);
ok("CR-3105 最新复擦批未采全", s3105.sampledPoints === 1 && !s3105.complete);
ok("CR-3105 房间仍不可开工", boardState(s3105, decisionsForRoom(data, "CR-3105")[0]) === "processing");

// 2. 同点位同批 upsert：不新增第二条
const before = data.samples.filter((s) => s.roundId === "R-2001" && s.pointId === "P-01").length;
data = upsertSample(data, {
  roundId: "R-2001", roomId: "CR-2203", pointId: "P-01",
  disinfectantBatchId: "XD-2609", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 2, inspectorId: "U02",
});
const after = data.samples.filter((s) => s.roundId === "R-2001" && s.pointId === "P-01").length;
ok("同点位同批仍只有一条", before === 1 && after === 1);
ok("更新取最新值 CFU=2", data.samples.find((s) => s.roundId === "R-2001" && s.pointId === "P-01")!.cfu === 2);

// 3. 补采 P-04 后全部合格，可放行并冻结
data = upsertSample(data, {
  roundId: "R-2001", roomId: "CR-2203", pointId: "P-04",
  disinfectantBatchId: "XD-2609", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 3, inspectorId: "U01",
});
let ev2203 = evaluateRound(room("CR-2203"), latestRound(data, "CR-2203")!, data, TODAY);
ok("补采后 CR-2203 全部合格", ev2203.passed);
ok("合格但未判行 = 待放行", boardState(ev2203, undefined) === "pending_release");
data = addDecision(data, room("CR-2203"), {
  roomId: "CR-2203", roundId: "R-2001", verdict: "released", reason: "", decidedBy: "U04",
}, TODAY);
ev2203 = evaluateRound(room("CR-2203"), latestRound(data, "CR-2203")!, data, TODAY);
ok("放行后批次冻结", ev2203.frozen);
ok("放行后看板可开工", boardState(ev2203, decisionsForRoom(data, "CR-2203")[0]) === "released");

// 4. 冻结后不得再改采样
let blocked = false;
try {
  upsertSample(data, {
    roundId: "R-2001", roomId: "CR-2203", pointId: "P-01",
    disinfectantBatchId: "XD-2609", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 0, inspectorId: "U02",
  });
} catch (e) { blocked = e instanceof DomainError; }
ok("冻结批次禁止修改结果", blocked);

// 5. 改判必须带原因，且只追加版本
let revisionErr = false;
try {
  data = addDecision(data, room("CR-2203"), {
    roomId: "CR-2203", roundId: "R-2001", verdict: "blocked", reason: "", decidedBy: "U04",
  }, TODAY);
} catch (e) { revisionErr = e instanceof DomainError; }
ok("改判无原因被拒", revisionErr);
const vBefore = decisionsForRoom(data, "CR-2203").length;
data = addDecision(data, room("CR-2203"), {
  roomId: "CR-2203", roundId: "R-2001", verdict: "blocked", reason: "复核发现培养时长偏差，撤销放行", decidedBy: "U03",
}, TODAY);
const versions = decisionsForRoom(data, "CR-2203");
ok("改判后版本数 +1", versions.length === vBefore + 1 && versions[0].version === 2);
ok("历史 v1 仍为放行", versions[1].verdict === "released");
ev2203 = evaluateRound(room("CR-2203"), latestRound(data, "CR-2203")!, data, TODAY);
ok("改判停行后看板不可开工", boardState(ev2203, versions[0]) === "processing");

// 6. 复擦换人：CR-3105 复擦批 P-01 已由 U02 采，U01 再采同点应允许（与源批 U01 不同的是 U02；U01 是源批检验员 → 应拒绝）
let sameInspectorBlocked = false;
try {
  upsertSample(data, {
    roundId: "R-3002", roomId: "CR-3105", pointId: "P-02",
    disinfectantBatchId: "XD-2608", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 3, inspectorId: "U01",
  });
} catch (e) { sameInspectorBlocked = e instanceof DomainError; }
ok("复擦同点位原检验员被拒绝", sameInspectorBlocked);
data = upsertSample(data, {
  roundId: "R-3002", roomId: "CR-3105", pointId: "P-02",
  disinfectantBatchId: "XD-2608", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 3, inspectorId: "U02",
});
ok("复擦换人登记成功", true);

// 7. 复擦批采全合格后放行；过期消毒剂不能放行
let expiredBlocked = false;
try {
  data = addDecision(data, room("CR-3105"), {
    roomId: "CR-3105", roundId: "R-3002", verdict: "released", reason: "", decidedBy: "U04",
  }, TODAY);
} catch (e) { expiredBlocked = e instanceof DomainError; }
ok("未采全的复擦批不能放行", expiredBlocked);

// 采剩余点位（换人 U02 vs 源批 U01）
data = upsertSample(data, {
  roundId: "R-3002", roomId: "CR-3105", pointId: "P-03",
  disinfectantBatchId: "XD-2608", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 5, inspectorId: "U02",
});
const ev3105rw = evaluateRound(room("CR-3105"), latestRound(data, "CR-3105")!, data, TODAY);
ok("复擦全部合格", ev3105rw.passed);
data = addDecision(data, room("CR-3105"), {
  roomId: "CR-3105", roundId: "R-3002", verdict: "released", reason: "复擦全部合格，偏差关闭", decidedBy: "U04",
}, TODAY);
ok("复擦通过后放行", boardState(
  evaluateRound(room("CR-3105"), latestRound(data, "CR-3105")!, data, TODAY),
  decisionsForRoom(data, "CR-3105")[0],
) === "released");
ok("复擦换人校验无冲突", checkReworkInspectorChange(data, "R-3001", "R-3002").length === 0);

// 8. 过期批次判定：CR-4302 已有未冻结首批 R-4001，用过期消毒剂登记全部点位
const r4302Id = latestRound(data, "CR-4302")!.id;
for (const p of room("CR-4302").points) {
  data = upsertSample(data, {
    roundId: r4302Id, roomId: "CR-4302", pointId: p.id,
    disinfectantBatchId: "XD-2512", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 0, inspectorId: "U02",
  });
}
const ev4302 = evaluateRound(room("CR-4302"), latestRound(data, "CR-4302")!, data, TODAY);
ok("过期消毒剂房间不通过", !ev4302.passed && ev4302.points.every((pt) => pt.codes.includes("DISINFECTANT_EXPIRED")));
let expiredReleaseBlocked = false;
try {
  addDecision(data, room("CR-4302"), {
    roomId: "CR-4302", roundId: r4302Id, verdict: "released", reason: "", decidedBy: "U04",
  }, TODAY);
} catch (e) { expiredReleaseBlocked = e instanceof DomainError; }
ok("过期批次无法放行", expiredReleaseBlocked);

// 9. CR-1201 已放行后可开下一批；但未放行房间不能开新批
const n1201 = createRound(data, { roomId: "CR-1201", createdBy: "U01" });
ok("已放行房间可开下一批", Boolean(n1201.roundId));
data = n1201.data;
const newest = evaluateRound(room("CR-1201"), latestRound(data, "CR-1201")!, data, TODAY);
ok("新批建立后看板回到待采样", boardState(newest, decisionsForRound(data, newest.round!.id)[0]) === "not_started");

let noNewRoundBlocked = false;
try { createRound(data, { roomId: "CR-4302", createdBy: "U01" }); }
catch (e) { noNewRoundBlocked = e instanceof DomainError; }
ok("未放行房间不能直接开新批", noNewRoundBlocked);

// 10. 超限：D 级 >50 超；A 级 >0 即超（不得检出）
const r4302b = createReworkRound(data, r4302Id, "消毒剂过期，复擦", "U02");
data = r4302b.data;
data = upsertSample(data, {
  roundId: r4302b.roundId, roomId: "CR-4302", pointId: "P-01",
  disinfectantBatchId: "XD-2609", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 51, inspectorId: "U01",
});
const evD = evaluateRound(room("CR-4302"), latestRound(data, "CR-4302")!, data, TODAY);
ok("D 级 51 CFU 判超限", evD.points.find((p) => p.pointId === "P-01")!.codes.includes("CFU_OVER_LIMIT"));

// A 级 1 CFU 即超限（不得检出）：CR-1201 种子已放行，可开下一批做断言
const fresh = createSeedData();
const a1 = createRound(fresh, { roomId: "CR-1201", createdBy: "U02" });
let freshData = a1.data;
freshData = upsertSample(freshData, {
  roundId: a1.roundId, roomId: "CR-1201", pointId: "P-01",
  disinfectantBatchId: "XD-2608", mediumBatchId: "M-TA-2608", sampledAt: TODAY, cfu: 1, inspectorId: "U01",
});
const evA = evaluateRound(room("CR-1201"), latestRound(freshData, "CR-1201")!, freshData, TODAY);
ok("A 级 1 CFU 即超限（不得检出）", evA.points[0].codes.includes("CFU_OVER_LIMIT"));

console.log(`\n全部 ${passed} 项规则检查通过`);

// 判定层：擦拭采样与房间放行的业务规则（纯函数，不碰 DOM / 存储 / React）

import { GRADE_RULES } from "../data/types";
import type {
  AppData,
  DecisionVersion,
  EvaluationSnapshot,
  Grade,
  LotBatch,
  RoomDef,
  SamplingRound,
  SnapshotFinding,
  Verdict,
  WipeSample,
} from "../data/types";

// ---------------------------------------------------------------------------
// 批次有效期
// ---------------------------------------------------------------------------

export function isLotExpired(batch: LotBatch | undefined, today: string): boolean {
  return Boolean(batch && batch.expiryDate < today);
}

export function describeBatch(batch: LotBatch | undefined): string {
  return batch ? `${batch.id}（${batch.name}）` : "未选择批次";
}

// ---------------------------------------------------------------------------
// 评估：过期、漏采、未读数、超限
// ---------------------------------------------------------------------------

export const FINDING_LABELS: Record<string, string> = {
  MISSING: "漏采",
  PENDING_COUNT: "培养未读数",
  DISINFECTANT_EXPIRED: "消毒剂过期",
  MEDIA_EXPIRED: "培养基过期",
  CFU_OVER_LIMIT: "菌落超限",
};

export interface PointEvaluation {
  room: RoomDef;
  pointId: string;
  pointName: string;
  sample: WipeSample | undefined;
  codes: string[];
  details: string[];
}

export interface RoomEvaluation {
  room: RoomDef;
  round: SamplingRound | undefined;
  limit: number;
  points: PointEvaluation[];
  /** 已登记采样记录的点位数 */
  sampledPoints: number;
  /** 已有菌落读数的点位数 */
  countedPoints: number;
  totalPoints: number;
  /** 全部点位均已采样且读数 */
  complete: boolean;
  /** 完整且无任何问题（过期/漏采/未读数/超限） */
  passed: boolean;
  /** 该批次是否处于冻结状态 */
  frozen: boolean;
}

function evaluatePoint(
  room: RoomDef,
  pointId: string,
  pointName: string,
  sample: WipeSample | undefined,
  limit: number,
  today: string,
  disinfectants: LotBatch[],
  media: LotBatch[],
): PointEvaluation {
  const codes: string[] = [];
  const details: string[] = [];

  if (!sample) {
    codes.push("MISSING");
    details.push("该点位尚未登记擦拭采样记录");
    return { room, pointId, pointName, sample, codes, details };
  }

  const disinfectant = disinfectants.find((b) => b.id === sample.disinfectantBatchId);
  const medium = media.find((b) => b.id === sample.mediumBatchId);

  if (isLotExpired(disinfectant, today)) {
    codes.push("DISINFECTANT_EXPIRED");
    details.push(`消毒剂批号 ${describeBatch(disinfectant)} 已于 ${disinfectant?.expiryDate} 过期`);
  }
  if (!disinfectant) {
    codes.push("DISINFECTANT_EXPIRED");
    details.push("消毒剂批次在主数据中不存在，不得使用");
  }
  if (isLotExpired(medium, today)) {
    codes.push("MEDIA_EXPIRED");
    details.push(`培养基批号 ${describeBatch(medium)} 已于 ${medium?.expiryDate} 过期`);
  }
  if (!medium) {
    codes.push("MEDIA_EXPIRED");
    details.push("培养基批次在主数据中不存在，不得使用");
  }

  if (sample.cfu === null) {
    codes.push("PENDING_COUNT");
    details.push("已采样但菌落数尚未读数");
  } else if (sample.cfu > limit) {
    codes.push("CFU_OVER_LIMIT");
    const gradeLabel = GRADE_RULES[room.grade].label;
    details.push(`菌落数 ${sample.cfu} CFU 超过 ${gradeLabel}限度 ${limit} CFU/碟`);
  }

  return { room, pointId, pointName, sample, codes, details };
}

export function evaluateRound(
  room: RoomDef,
  round: SamplingRound | undefined,
  data: AppData,
  today: string,
): RoomEvaluation {
  const limit = GRADE_RULES[room.grade].contactPlateLimit;
  const samples = round ? data.samples.filter((s) => s.roundId === round.id) : [];

  const points = room.points.map((p) => {
    const sample = samples.find((s) => s.pointId === p.id);
    return evaluatePoint(room, p.id, p.name, sample, limit, today, data.disinfectants, data.media);
  });

  const sampledPoints = points.filter((p) => p.sample).length;
  const countedPoints = points.filter((p) => p.sample && p.sample.cfu !== null).length;
  const complete = sampledPoints === room.points.length && countedPoints === room.points.length;
  const passed = complete && points.every((p) => p.codes.length === 0);

  return {
    room,
    round,
    limit,
    points,
    sampledPoints,
    countedPoints,
    totalPoints: room.points.length,
    complete,
    passed,
    frozen: Boolean(round?.frozen),
  };
}

export function toSnapshot(ev: RoomEvaluation, evaluatedAt: string): EvaluationSnapshot {
  const findings: SnapshotFinding[] = ev.points
    .filter((p) => p.codes.length > 0)
    .map((p) => ({ pointId: p.pointId, pointName: p.pointName, codes: [...p.codes], details: [...p.details] }));
  return {
    evaluatedAt,
    totalPoints: ev.totalPoints,
    sampledPoints: ev.sampledPoints,
    countedPoints: ev.countedPoints,
    complete: ev.complete,
    passed: ev.passed,
    findings,
  };
}

// ---------------------------------------------------------------------------
// 批次查询
// ---------------------------------------------------------------------------

export function latestRound(data: AppData, roomId: string): SamplingRound | undefined {
  // 批次按建立顺序追加，数组末尾即最新；不依赖时间戳排序（演示环境时钟固定）
  let latest: SamplingRound | undefined;
  let latestIndex = -1;
  data.rounds.forEach((r, index) => {
    if (r.roomId === roomId && index > latestIndex) {
      latest = r;
      latestIndex = index;
    }
  });
  return latest;
}

export function roundsForRoom(data: AppData, roomId: string): SamplingRound[] {
  // 保持数组建立顺序（新批次总是追加在末尾）
  return data.rounds.filter((r) => r.roomId === roomId);
}

export function roundSamples(data: AppData, roundId: string): WipeSample[] {
  return data.samples.filter((s) => s.roundId === roundId);
}

export function decisionsForRoom(data: AppData, roomId: string): DecisionVersion[] {
  return data.decisions
    .filter((d) => d.roomId === roomId)
    .sort((a, b) => (b.version - a.version) || b.decidedAt.localeCompare(a.decidedAt) || b.id.localeCompare(a.id));
}

export function decisionsForRound(data: AppData, roundId: string): DecisionVersion[] {
  return data.decisions
    .filter((d) => d.roundId === roundId)
    .sort((a, b) => (b.version - a.version) || b.decidedAt.localeCompare(a.decidedAt) || b.id.localeCompare(a.id));
}

// ---------------------------------------------------------------------------
// 看板状态
// ---------------------------------------------------------------------------

export type BoardState = "released" | "pending_release" | "processing" | "not_started";

export const BOARD_COLUMNS: { key: BoardState; title: string; hint: string }[] = [
  { key: "not_started", title: "待采样", hint: "尚未建批或没有任何采样记录，禁止开工" },
  { key: "processing", title: "待处理", hint: "漏采 / 过期 / 未读数 / 超限，禁止开工" },
  { key: "pending_release", title: "待放行", hint: "全部点位合格，等待 QA 判行冻结" },
  { key: "released", title: "已放行", hint: "结果已冻结，可凭记录开工" },
];

export function boardState(ev: RoomEvaluation, latestDecision: DecisionVersion | undefined): BoardState {
  if (!ev.round || ev.sampledPoints === 0) return "not_started";
  // 已判行的批次（均会冻结）：放行才可开工，停行留待处理（需复擦）
  if (ev.frozen) {
    if (latestDecision?.roundId === ev.round.id && latestDecision.verdict === "released") return "released";
    return "processing";
  }
  // 未判行的批次：合格待 QA 判行，否则停在待处理
  if (ev.passed) return "pending_release";
  return "processing";
}

/** 是否可开工：仅最新批次已判行放行 */
export function canStartWork(ev: RoomEvaluation, latestDecision: DecisionVersion | undefined): boolean {
  return boardState(ev, latestDecision) === "released";
}

// ---------------------------------------------------------------------------
// 写操作：同点位同批 upsert、建批/复擦、判定版本追加
// ---------------------------------------------------------------------------

export class DomainError extends Error {}

export interface SampleInput {
  roundId: string;
  roomId: string;
  pointId: string;
  disinfectantBatchId: string;
  mediumBatchId: string;
  sampledAt: string;
  cfu: number | null;
  inspectorId: string;
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 登记/更新一条擦拭结果。
 * 规则：同一房间同一点位在同一采样批次内只保留一条（存在即更新，不新增）。
 */
export function upsertSample(data: AppData, input: SampleInput): AppData {
  const round = data.rounds.find((r) => r.id === input.roundId);
  if (!round) throw new DomainError("采样批次不存在");
  if (round.roomId !== input.roomId) throw new DomainError("采样批次与房间不匹配");
  if (round.frozen) throw new DomainError("该批次结果已冻结，不能修改；如需复测请另开复擦批次");
  if (!input.disinfectantBatchId) throw new DomainError("请选择消毒剂批次");
  if (!input.mediumBatchId) throw new DomainError("请选择培养基批次");
  if (!input.inspectorId) throw new DomainError("请选择检验员");
  if (!input.sampledAt) throw new DomainError("请填写采样日期");
  if (input.cfu !== null && (!Number.isFinite(input.cfu) || input.cfu < 0)) {
    throw new DomainError("菌落数须为不小于 0 的整数");
  }

  // 复擦批次：同一点位必须换人采样
  if (round.reworkOf) {
    const oldSample = data.samples.find(
      (s) => s.roundId === round.reworkOf!.roundId && s.roomId === input.roomId && s.pointId === input.pointId,
    );
    if (oldSample && oldSample.inspectorId === input.inspectorId) {
      throw new DomainError("复擦必须换人：该点位原批由同一检验员采样，请指定其他检验员");
    }
  }

  const ts = nowIso();
  const existing = data.samples.find((s) => s.roundId === input.roundId && s.roomId === input.roomId && s.pointId === input.pointId);

  let samples: WipeSample[];
  if (existing) {
    samples = data.samples.map((s) =>
      s.id === existing.id
        ? {
            ...s,
            disinfectantBatchId: input.disinfectantBatchId,
            mediumBatchId: input.mediumBatchId,
            sampledAt: input.sampledAt,
            cfu: input.cfu,
            inspectorId: input.inspectorId,
            updatedAt: ts,
          }
        : s,
    );
  } else {
    const sample: WipeSample = {
      id: makeId("S"),
      createdAt: ts,
      updatedAt: ts,
      frozen: false,
      ...input,
    };
    samples = [...data.samples, sample];
  }
  return { ...data, samples };
}

export interface NewRoundInput {
  roomId: string;
  createdBy: string;
}

/**
 * 新建采样批次。
 * 房间首批可直接建批；已有批次时，只有最新批已冻结且判行放行（完成上一轮换产），
 * 才允许开下一批；未放行的批次只能走复擦流程。
 */
export function createRound(data: AppData, input: NewRoundInput): { data: AppData; roundId: string } {
  if (!input.createdBy) throw new DomainError("请选择登记人");
  const latest = latestRound(data, input.roomId);
  if (latest) {
    if (!latest.frozen) throw new DomainError("当前批次尚未冻结，请在该批次中继续登记或走复擦");
    const decision = decisionsForRound(data, latest.id)[0];
    if (decision?.verdict !== "released") {
      throw new DomainError("上一批次未放行，请通过复擦完成复测，不能直接开新批");
    }
  }
  const round: SamplingRound = {
    id: makeId("R"),
    roomId: input.roomId,
    createdAt: nowIso(),
    createdBy: input.createdBy,
    frozen: false,
  };
  return { data: { ...data, rounds: [...data.rounds, round] }, roundId: round.id };
}

/**
 * 复擦：基于一个未通过的批次另开新批（复擦批若仍不合格可继续复擦）。
 * 规则：必须填写原因；复擦批次需对全部点位重新采样，且每个点位检验员与源批不同（换人）。
 */
export function createReworkRound(
  data: AppData,
  sourceRoundId: string,
  reason: string,
  createdBy: string,
): { data: AppData; roundId: string } {
  const source = data.rounds.find((r) => r.id === sourceRoundId);
  if (!source) throw new DomainError("原采样批次不存在");
  const already = data.rounds.some((r) => r.reworkOf?.roundId === sourceRoundId);
  if (already) throw new DomainError("该批次已开过复擦批，请在最新复擦批次中继续登记");
  if (source.frozen && decisionsForRound(data, source.id)[0]?.verdict === "released") {
    throw new DomainError("该批次已放行，请为下一轮换产直接新建采样批次");
  }
  if (!reason.trim()) throw new DomainError("复擦必须填写原因");
  if (!createdBy) throw new DomainError("请选择登记人");

  const round: SamplingRound = {
    id: makeId("R"),
    roomId: source.roomId,
    createdAt: nowIso(),
    createdBy,
    frozen: false,
    reworkOf: { roundId: sourceRoundId, reason: reason.trim() },
  };
  return { data: { ...data, rounds: [...data.rounds, round] }, roundId: round.id };
}

export interface DecisionInput {
  roomId: string;
  roundId: string;
  verdict: Verdict;
  reason: string;
  decidedBy: string;
}

/**
 * 追加一条判定版本。规则：
 * - 只追加新版本，不覆盖既有判定；
 * - 首个版本放行要求评估全部合格；任何版本的改判都必须填写原因；
 * - 放行时冻结该批次及其全部采样结果。
 */
export function addDecision(
  data: AppData,
  room: RoomDef,
  input: DecisionInput,
  today: string,
): AppData {
  const round = data.rounds.find((r) => r.id === input.roundId);
  if (!round || round.roomId !== input.roomId) throw new DomainError("采样批次不存在或与房间不匹配");
  if (!input.decidedBy) throw new DomainError("请选择判定人");

  const prior = data.decisions
    .filter((d) => d.roomId === input.roomId)
    .sort((a, b) => b.version - a.version);
  const isRevision = prior.length > 0;
  if (isRevision && !input.reason.trim()) throw new DomainError("改判必须填写原因");
  if (!isRevision && input.verdict === "blocked" && !input.reason.trim()) {
    throw new DomainError("停行处理必须填写原因");
  }

  const ev = evaluateRound(room, round, data, today);
  if (input.verdict === "released" && !ev.passed) {
    throw new DomainError("存在漏采、过期、未读数或超限点位，不满足放行条件");
  }

  const ts = nowIso();
  const version: DecisionVersion = {
    id: makeId("D"),
    roomId: input.roomId,
    roundId: input.roundId,
    version: prior.length ? prior[0].version + 1 : 1,
    verdict: input.verdict,
    reason: input.reason.trim(),
    decidedBy: input.decidedBy,
    decidedAt: ts,
    basis: toSnapshot(ev, ts),
  };

  const next: AppData = { ...data, decisions: [...data.decisions, version] };

  // 放行或停行均冻结该批次：结果作为判定证据留存，复测须另开复擦批次
  return {
    ...next,
    rounds: next.rounds.map((r) => (r.id === round.id ? { ...r, frozen: true } : r)),
    samples: next.samples.map((s) => (s.roundId === round.id ? { ...s, frozen: true } : s)),
  };
}

/** 复擦时的换人校验：复擦批每个点位检验员必须与原批对应点位不同 */
export function checkReworkInspectorChange(
  data: AppData,
  sourceRoundId: string,
  reworkRoundId: string,
): string[] {
  const source = new Map(data.samples.filter((s) => s.roundId === sourceRoundId).map((s) => [s.pointId, s]));
  const rework = data.samples.filter((s) => s.roundId === reworkRoundId);
  const conflicts: string[] = [];
  for (const s of rework) {
    const old = source.get(s.pointId);
    if (old && old.inspectorId === s.inspectorId) {
      conflicts.push(s.pointId);
    }
  }
  return conflicts;
}

export function gradeLabel(grade: Grade): string {
  return GRADE_RULES[grade].label;
}

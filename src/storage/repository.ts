// 保存层：localStorage 持久化与状态变更仓库
// 所有写入都经过判定层规则校验，页面层只调用这里的动作。

import { SEED_STATE } from "../data/seed";
import {
  evaluateRound,
  getRoom,
  latestRound,
  nextVersion,
  rewipeAnalystConflicts,
  roomJudgments,
  roomRounds,
  roundPasses,
  roundSamples,
  TODAY,
} from "../domain/rules";
import type {
  AppState,
  Judgment,
  SampleRecord,
  SamplingRound,
  Verdict,
} from "../types";

const STORAGE_KEY = "hxwl-09.wipe-release.v1";

export function timestamp(): string {
  // 演示环境基准日固定为 2026-09-24，时间取本地时刻
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  return `${TODAY}T${hhmm}`;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    // 存档损坏时回落到初始台账
  }
  return structuredClone(SEED_STATE);
}

export function resetState(): AppState {
  const fresh = structuredClone(SEED_STATE);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function persist(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export interface SampleDraft {
  pointId: string;
  sampledAt: string;
  roundBatchNo: string;
  disinfectantBatchId: string;
  mediumBatchId: string;
  cfu: number;
  analystId: string;
}

/**
 * 登记一条擦拭结果。
 * 同一轮次（同一换产消毒批次）同一点位只留一条：重复登记即更新。
 */
export function upsertSample(
  state: AppState,
  roomId: string,
  draft: SampleDraft
): { state: AppState; merged: boolean } {
  const room = getRoom(state, roomId);
  const round = latestRound(state, roomId);
  if (!round) throw new Error("该房间还没有采样轮次，请先发起初擦或复擦");
  if (round.sealed) throw new Error("该轮次已判定封闭，结果冻结，不能再登记或修改");
  if (!room.points.some((point) => point.id === draft.pointId)) {
    throw new Error("点位不属于该房间");
  }
  if (!draft.roundBatchNo.trim()) throw new Error("请填写换产消毒批次号");
  if (!round.roundBatchNo) throw new Error("本轮消毒批次未登记，请联系 QA 补录");
  if (draft.roundBatchNo.trim() !== round.roundBatchNo) {
    throw new Error(`消毒批次与本轮不一致，应为 ${round.roundBatchNo}`);
  }
  if (!draft.sampledAt) throw new Error("请选择采样日期");
  if (!draft.disinfectantBatchId) throw new Error("请选择消毒剂批次");
  if (!draft.mediumBatchId) throw new Error("请选择培养基批次");
  if (!Number.isFinite(draft.cfu) || draft.cfu < 0) throw new Error("菌落数需为不小于 0 的整数");
  if (!draft.analystId) throw new Error("请选择检验员");

  const next = structuredClone(state);
  const samples = next.samples;
  const existing = samples.find(
    (sample) => sample.roundId === round.id && sample.pointId === draft.pointId
  );
  const now = timestamp();

  if (existing) {
    existing.sampledAt = draft.sampledAt;
    existing.roundBatchNo = draft.roundBatchNo.trim();
    existing.disinfectantBatchId = draft.disinfectantBatchId;
    existing.mediumBatchId = draft.mediumBatchId;
    existing.cfu = draft.cfu;
    existing.analystId = draft.analystId;
    existing.updatedAt = now;
  } else {
    samples.push({
      id: uid("S"),
      roomId,
      roundId: round.id,
      pointId: draft.pointId,
      roundBatchNo: draft.roundBatchNo.trim(),
      sampledAt: draft.sampledAt,
      disinfectantBatchId: draft.disinfectantBatchId,
      mediumBatchId: draft.mediumBatchId,
      cfu: draft.cfu,
      analystId: draft.analystId,
      createdAt: now,
      updatedAt: now,
    });
  }

  persist(next);
  return { state: next, merged: Boolean(existing) };
}

/**
 * 判定房间：依据当前最新轮次的全部点位检查放行/阻断。
 * 通过 → 放行并冻结该轮结果；不通过 → 阻断，房间停在待处理。
 */
export function judgeRoom(
  state: AppState,
  roomId: string,
  verdict: Verdict,
  reason: string
): AppState {
  const room = getRoom(state, roomId);
  const round = latestRound(state, roomId);
  if (!round) throw new Error("没有可判定的采样轮次");
  if (round.sealed) throw new Error("该轮次已判定，请通过改判或发起复擦处理");
  if (!reason.trim()) throw new Error("判定必须填写原因/依据");

  const checks = evaluateRound(state, room, round);
  const passes = roundPasses(checks);

  if (verdict === "released" && !passes) {
    throw new Error("存在过期批次、漏采或菌落超限，不能放行");
  }
  if (verdict === "released" && round.kind === "rewipe") {
    const conflicts = rewipeAnalystConflicts(state, room, round);
    if (conflicts.length > 0) {
      throw new Error(`复擦须换人，以下点位仍由原检验员复测：${conflicts.join("、")}`);
    }
  }

  const next = structuredClone(state);
  const target = next.rounds.find((item) => item.id === round.id)!;
  target.sealed = true;
  target.sealedAt = timestamp();

  const judgments = next.judgments;
  judgments.push({
    id: uid("J"),
    roomId,
    roundId: round.id,
    verdict,
    reason: reason.trim(),
    decidedAt: timestamp(),
    decider: "QA 值班",
    version: nextVersion(next, roomId),
  } satisfies Judgment);

  persist(next);
  return next;
}

/**
 * 发起复擦：房间停在待处理后重新消毒复测。
 * 复擦为全新一轮，登记时逐点校验换人，且必须覆盖全部点位。
 */
export function openRewipe(
  state: AppState,
  roomId: string,
  roundBatchNo: string,
  reason: string
): AppState {
  const round = latestRound(state, roomId);
  if (!round) throw new Error("没有可复擦的轮次");
  if (!round.sealed) throw new Error("上一轮尚未判定，不能发起复擦");
  const judgments = roomJudgments(state, roomId);
  if (judgments.length === 0) throw new Error("上一轮尚未判定，不能发起复擦");
  if (!roundBatchNo.trim()) throw new Error("请填写重新消毒后的换产批次号");
  if (!reason.trim()) throw new Error("发起复擦必须填写消毒/整改说明");

  const next = structuredClone(state);
  next.rounds.push({
    id: uid("R"),
    roomId,
    kind: "rewipe",
    roundBatchNo: roundBatchNo.trim(),
    rewipeReason: reason.trim(),
    openedAt: timestamp(),
    openedBy: "QA 值班",
    sealed: false,
  } satisfies SamplingRound);

  persist(next);
  return next;
}

/**
 * 改判：只新增一条带原因的版本，不覆盖、不删除历史判定。
 * 放行结果冻结后如需调整，使用本动作形成 V2、V3… 版本链。
 */
export function overturnJudgment(
  state: AppState,
  roomId: string,
  verdict: Verdict,
  reason: string
): AppState {
  const round = latestRound(state, roomId);
  if (!round || !round.sealed) throw new Error("当前没有已冻结的判定可改判");
  if (!reason.trim()) throw new Error("改判必须填写原因");

  const next = structuredClone(state);
  const current = roomJudgments(next, roomId).at(-1)!;
  if (current.verdict === verdict) {
    throw new Error(`当前已是「${verdict === "released" ? "放行" : "阻断"}」，无需同样式改判`);
  }

  next.judgments.push({
    id: uid("J"),
    roomId,
    roundId: current.roundId,
    verdict,
    reason: reason.trim(),
    decidedAt: timestamp(),
    decider: "QA 值班",
    version: nextVersion(next, roomId),
    overturns: current.id,
  } satisfies Judgment);

  persist(next);
  return next;
}

export function recordById(state: AppState, id: string): SampleRecord | undefined {
  return state.samples.find((sample) => sample.id === id);
}

export function roundsOf(state: AppState, roomId: string): SamplingRound[] {
  return roomRounds(state, roomId);
}

export function samplesOfRound(state: AppState, roundId: string): SampleRecord[] {
  return roundSamples(state, roundId);
}

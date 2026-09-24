// 判定层：过期、漏采、菌落超限、复擦换人、放行状态等纯业务规则
// 不依赖 React / localStorage，可独立推演。

import type {
  Analyst,
  AppState,
  CheckProblem,
  Judgment,
  Room,
  SampleRecord,
  SamplingRound,
  Verdict,
} from "../types";

/** 当前基准日期（演示固定为 2026-09-24） */
export const TODAY = "2026-09-24";

export function toDate(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** 批次是否已过期（到期日当天即视为失效） */
export function isBatchExpired(expiresOn: string, today: string = TODAY): boolean {
  return toDate(expiresOn) <= toDate(today);
}

export const ROOM_STATUS = {
  RELEASED: "released", // 已放行，可开工
  BLOCKED: "blocked", // 待处理，禁止开工
  COLLECTING: "collecting", // 采样/检测中，结果未齐，禁止开工
} as const;

export type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];

export const ROOM_STATUS_TEXT: Record<RoomStatus, string> = {
  released: "已放行 · 可开工",
  blocked: "待处理 · 禁止开工",
  collecting: "采样中 · 禁止开工",
};

export function getRoom(state: AppState, roomId: string): Room {
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room) throw new Error("房间不存在：" + roomId);
  return room;
}

export function roomRounds(state: AppState, roomId: string): SamplingRound[] {
  return state.rounds
    .filter((round) => round.roomId === roomId)
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt) || a.id.localeCompare(b.id));
}

export function latestRound(state: AppState, roomId: string): SamplingRound | undefined {
  return roomRounds(state, roomId).at(-1);
}

export function previousRound(state: AppState, roomId: string): SamplingRound | undefined {
  return roomRounds(state, roomId).at(-2);
}

export function roundSamples(state: AppState, roundId: string): SampleRecord[] {
  return state.samples.filter((sample) => sample.roundId === roundId);
}

/** 房间的判定版本时间线，V1 在前 */
export function roomJudgments(state: AppState, roomId: string): Judgment[] {
  return state.judgments
    .filter((judgment) => judgment.roomId === roomId)
    .sort((a, b) => a.version - b.version);
}

export function latestJudgment(state: AppState, roomId: string): Judgment | undefined {
  return roomJudgments(state, roomId).at(-1);
}

/**
 * 房间当前状态：
 * - 最新判定为放行 → 已放行（结果冻结，可开工）
 * - 最新判定为阻断 → 待处理（禁止开工）
 * - 还没有判定 → 采样中（禁止开工，结果未齐不得开工）
 */
export function roomStatus(state: AppState, roomId: string): RoomStatus {
  const judgment = latestJudgment(state, roomId);
  if (judgment?.verdict === "released") return ROOM_STATUS.RELEASED;
  if (judgment?.verdict === "blocked") return ROOM_STATUS.BLOCKED;
  return ROOM_STATUS.COLLECTING;
}

export function roundLabel(round: SamplingRound, ordinal?: number): string {
  if (round.kind === "initial") return "初擦";
  return ordinal && ordinal > 1 ? `第 ${ordinal} 次复擦` : "复擦";
}

export interface PointCheck {
  pointId: string;
  record?: SampleRecord;
  problems: CheckProblem[];
}

/**
 * 评估一轮采样，逐点位列出问题：
 * 1. 漏采：该点位在本轮没有记录
 * 2. 批次过期：消毒剂或培养基批次已到/过期
 * 3. 菌落超限：CFU 超过房间表面微生物限值
 */
export function evaluateRound(
  state: AppState,
  room: Room,
  round: SamplingRound,
  today: string = TODAY
): PointCheck[] {
  const records = roundSamples(state, round.id);
  return room.points.map((point) => {
    const record = records.find((item) => item.pointId === point.id);
    if (!record) {
      return {
        pointId: point.id,
        problems: [
          {
            type: "missing",
            pointId: point.id,
            message: `点位「${point.name}」漏采，复擦须复测全部点位`,
          },
        ],
      };
    }

    const problems: CheckProblem[] = [];
    const disinfectant = state.batches.find((b) => b.id === record.disinfectantBatchId);
    const medium = state.batches.find((b) => b.id === record.mediumBatchId);

    for (const batch of [disinfectant, medium]) {
      if (batch && isBatchExpired(batch.expiresOn, today)) {
        problems.push({
          type: "batchExpired",
          sampleId: record.id,
          batchId: batch.id,
          message: `${batch.kind === "disinfectant" ? "消毒剂" : "培养基"}批次 ${batch.no} 已过期（${batch.expiresOn} 到期）`,
        });
      }
    }

    if (record.cfu > room.limitCfu) {
      problems.push({
        type: "cfuExceeded",
        sampleId: record.id,
        cfu: record.cfu,
        limit: room.limitCfu,
        message: `菌落数 ${record.cfu} CFU/碟，超过 ${room.grade} 限值 ${room.limitCfu}`,
      });
    }

    return { pointId: point.id, record, problems };
  });
}

export function roundPasses(checks: PointCheck[]): boolean {
  return checks.every((check) => check.problems.length === 0);
}

/** 当前未放行房间仍挂起的问题（看板统计用） */
export function activeProblems(state: AppState, roomId: string): CheckProblem[] {
  if (roomStatus(state, roomId) === ROOM_STATUS.RELEASED) return [];
  const round = latestRound(state, roomId);
  if (!round) return [];
  return evaluateRound(state, getRoom(state, roomId), round).flatMap((check) => check.problems);
}

/**
 * 复擦换人：同一点位复擦记录的检验员，不得与紧邻上一轮该点位记录相同。
 * 返回违规点位名称列表（空数组表示全部满足换人要求）。
 */
export function rewipeAnalystConflicts(
  state: AppState,
  room: Room,
  currentRound: SamplingRound
): string[] {
  const rounds = roomRounds(state, room.id);
  const index = rounds.findIndex((round) => round.id === currentRound.id);
  const prior = rounds[index - 1];
  if (!prior || currentRound.kind !== "rewipe") return [];

  const priorByPoint = new Map(roundSamples(state, prior.id).map((sample) => [sample.pointId, sample]));
  const currentByPoint = new Map(
    roundSamples(state, currentRound.id).map((sample) => [sample.pointId, sample])
  );

  const conflicts: string[] = [];
  for (const point of room.points) {
    const before = priorByPoint.get(point.id);
    const now = currentByPoint.get(point.id);
    if (before && now && before.analystId === now.analystId) {
      conflicts.push(point.name);
    }
  }
  return conflicts;
}

export function getAnalyst(state: AppState, analystId: string): Analyst | undefined {
  return state.analysts.find((analyst) => analyst.id === analystId);
}

export function nextVersion(state: AppState, roomId: string): number {
  return roomJudgments(state, roomId).length + 1;
}

export function verdictText(verdict: Verdict): string {
  return verdict === "released" ? "放行" : "阻断";
}

// 资料层：擦拭采样与房间放行的领域模型

export type Grade = "ISO 5" | "ISO 6" | "ISO 7" | "黄光区";

export type BatchKind = "disinfectant" | "medium";

/** 房间（静态资料 + 按点登记的擦拭采样点位） */
export interface Room {
  id: string;
  name: string;
  grade: Grade;
  /** 表面微生物限值：CFU/碟（接触碟） */
  limitCfu: number;
  points: SamplingPoint[];
}

export interface SamplingPoint {
  id: string;
  /** 点位名称，如「东墙面 1.0m」 */
  name: string;
  surface: string;
}

/** 消毒剂 / 培养基批次台账 */
export interface MaterialBatch {
  id: string;
  no: string;
  kind: BatchKind;
  name: string;
  expiresOn: string; // YYYY-MM-DD
}

/** 检验员（复擦需换人，需要可比对） */
export interface Analyst {
  id: string;
  name: string;
  title: string;
}

/**
 * 一条擦拭采样记录
 * 唯一约束：同一 roundId 下 (pointId, roundBatchNo) 只留一条，
 * 重复登记更新同一条，不新增。
 */
export interface SampleRecord {
  id: string;
  roomId: string;
  roundId: string;
  pointId: string;
  /** 本轮擦拭所用消毒批次编号（房间换产消毒批次） */
  roundBatchNo: string;
  sampledAt: string; // YYYY-MM-DD
  disinfectantBatchId: string;
  mediumBatchId: string;
  /** 菌落计数，CFU/碟 */
  cfu: number;
  analystId: string;
  /** upsert 时保留首登时间，updatedAt 记录末次更新 */
  createdAt: string;
  updatedAt: string;
}

export type RoundKind = "initial" | "rewipe";

/** 一次采样轮次：初擦或复擦；复擦必须复测全部点位 */
export interface SamplingRound {
  id: string;
  roomId: string;
  kind: RoundKind;
  /** 该轮次对应的房间换产消毒批次 */
  roundBatchNo: string;
  /** 发起复擦的原因（初擦为空） */
  rewipeReason?: string;
  openedAt: string;
  openedBy: string; // 发起/复测安排人
  /** 判定后封闭：已判定轮次的记录不可再编辑 */
  sealed: boolean;
  sealedAt?: string;
}

export type Verdict = "released" | "blocked";

/** 放行判定版本：改判不覆盖，只新增带原因的版本 */
export interface Judgment {
  id: string;
  roomId: string;
  roundId: string;
  verdict: Verdict;
  reason: string;
  decidedAt: string;
  decider: string;
  /** V1 为首次判定，每次改判递增 */
  version: number;
  /** 被改判的上一版本 id；首判为空 */
  overturns?: string;
}

export interface AppState {
  rooms: Room[];
  batches: MaterialBatch[];
  analysts: Analyst[];
  rounds: SamplingRound[];
  samples: SampleRecord[];
  judgments: Judgment[];
}

/** 评估某条采样/某个点位时发现的问题 */
export type CheckProblem =
  | { type: "missing"; pointId: string; message: string }
  | { type: "batchExpired"; sampleId: string; batchId: string; message: string }
  | { type: "cfuExceeded"; sampleId: string; cfu: number; limit: number; message: string };

// 资料层：擦拭采样与房间放行的领域资料定义（不含业务判定逻辑）

export type Grade = "A" | "B" | "C" | "D";

/** 洁净级别表面微生物限度（接触碟 Φ55mm，GMP 无菌药品附录动态标准） */
export interface GradeRule {
  grade: Grade;
  label: string;
  /** 每碟最大允许菌落数 CFU；A 级为 0（标准为 <1，即不得检出） */
  contactPlateLimit: number;
  note: string;
}

export const GRADE_RULES: Record<Grade, GradeRule> = {
  A: { grade: "A", label: "A 级", contactPlateLimit: 0, note: "标准 <1 CFU/碟，即不得检出" },
  B: { grade: "B", label: "B 级", contactPlateLimit: 5, note: "接触碟 Φ55mm 动态限度 5 CFU/碟" },
  C: { grade: "C", label: "C 级", contactPlateLimit: 25, note: "接触碟 Φ55mm 动态限度 25 CFU/碟" },
  D: { grade: "D", label: "D 级", contactPlateLimit: 50, note: "接触碟 Φ55mm 动态限度 50 CFU/碟" },
};

export interface LotBatch {
  /** 批号，全局唯一 */
  id: string;
  name: string;
  /** 有效期至（ISO 日期 yyyy-mm-dd） */
  expiryDate: string;
}

export interface PointDef {
  /** 点位编号 */
  id: string;
  /** 点位描述，如 层流罩内壁 */
  name: string;
}

export interface RoomDef {
  id: string;
  name: string;
  grade: Grade;
  points: PointDef[];
}

export interface Inspector {
  id: string;
  name: string;
  role: string;
}

/** 采样批次（一次房间擦拭为一批，复擦另开新批并回指原批） */
export interface SamplingRound {
  id: string;
  roomId: string;
  createdAt: string;
  createdBy: string;
  /** 非空表示本批为复擦批次 */
  reworkOf?: {
    roundId: string;
    reason: string;
  };
  /** 判行通过后冻结，冻结批次不得再登记/修改结果 */
  frozen: boolean;
}

/** 擦拭采样结果：同一房间点位在同一采样批次内只允许存在一条 */
export interface WipeSample {
  id: string;
  roundId: string;
  roomId: string;
  pointId: string;
  disinfectantBatchId: string;
  mediumBatchId: string;
  /** 采样日期 yyyy-mm-dd */
  sampledAt: string;
  /** 菌落数 CFU；null 表示已采样但培养未读数 */
  cfu: number | null;
  inspectorId: string;
  createdAt: string;
  updatedAt: string;
  frozen: boolean;
}

export type Verdict = "released" | "blocked";

export const VERDICT_LABELS: Record<Verdict, string> = {
  released: "放行（可开工）",
  blocked: "停行（待处理）",
};

/** 判定时刻的问题快照，随版本留存，保证历史可追溯 */
export interface EvaluationSnapshot {
  evaluatedAt: string;
  totalPoints: number;
  sampledPoints: number;
  countedPoints: number;
  complete: boolean;
  passed: boolean;
  findings: SnapshotFinding[];
}

export interface SnapshotFinding {
  pointId: string;
  pointName: string;
  codes: string[];
  details: string[];
}

/** 判定版本：只追加，不覆盖；改判必须带原因 */
export interface DecisionVersion {
  id: string;
  roomId: string;
  roundId: string;
  version: number;
  verdict: Verdict;
  reason: string;
  decidedBy: string;
  decidedAt: string;
  basis: EvaluationSnapshot;
}

/** 全量持久化资料（主数据 + 过程记录） */
export interface AppData {
  rounds: SamplingRound[];
  samples: WipeSample[];
  decisions: DecisionVersion[];
  disinfectants: LotBatch[];
  media: LotBatch[];
}

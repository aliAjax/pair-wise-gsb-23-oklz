import { INSPECTORS, ROOMS } from "../data/seed";
import type { LotBatch, RoomDef, WipeSample } from "../data/types";
import { FINDING_LABELS, evaluateRound, latestRound } from "../domain/rules";
import type { AppData } from "../data/types";

export function roomById(id: string): RoomDef {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`未知房间 ${id}`);
  return room;
}

export function inspectorName(id: string | undefined): string {
  if (!id) return "—";
  return INSPECTORS.find((u) => u.id === id)?.name ?? id;
}

export function lotLabel(batch: LotBatch | undefined): string {
  return batch ? `${batch.id} · ${batch.name}` : "—";
}

export function expired(batch: LotBatch | undefined, today: string): boolean {
  return Boolean(batch && batch.expiryDate < today);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shortRoundId(roundId: string): string {
  return roundId.startsWith("R-") ? roundId : roundId;
}

export function findingText(code: string): string {
  return FINDING_LABELS[code] ?? code;
}

/** 台账行状态标记 */
export function sampleRowFlags(sample: WipeSample, data: AppData, today: string): { problems: string[]; ok: boolean } {
  const room = roomById(sample.roomId);
  const ev = evaluateRound(room, data.rounds.find((r) => r.id === sample.roundId), data, today);
  const point = ev.points.find((p) => p.pointId === sample.pointId);
  return { problems: point ? point.codes.map(findingText) : [], ok: point ? point.codes.length === 0 : true };
}

export function roomLatestRound(data: AppData, roomId: string) {
  return latestRound(data, roomId);
}

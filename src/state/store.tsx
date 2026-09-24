import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppData, LotBatch, RoomDef } from "../data/types";
import { TODAY } from "../data/seed";
import {
  DomainError,
  addDecision,
  createReworkRound,
  createRound,
  upsertSample,
  type DecisionInput,
  type SampleInput,
} from "../domain/rules";
import { exportJson, loadData, resetData, saveData } from "../storage/repository";

export interface Notice {
  type: "ok" | "err";
  message: string;
}

interface StoreValue {
  data: AppData;
  today: string;
  notice: Notice | null;
  registerSample: (input: SampleInput) => boolean;
  openRound: (roomId: string, createdBy: string) => string | null;
  openRework: (sourceRoundId: string, reason: string, createdBy: string) => string | null;
  decide: (room: RoomDef, input: DecisionInput) => boolean;
  addLot: (kind: "disinfectant" | "medium", lot: LotBatch) => boolean;
  reset: () => void;
  exportData: () => void;
  clearNotice: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function applyOrThrow(data: AppData, mutate: () => AppData, okMessage: string): { data: AppData; notice: Notice } {
  const next = mutate();
  return { data: next, notice: { type: "ok", message: okMessage } };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    saveData(data);
  }, [data]);

  function pushNotice(next: Notice) {
    setNotice(next);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3600);
  }

  const value = useMemo<StoreValue>(
    () => ({
      data,
      today: TODAY,
      notice,
      clearNotice: () => setNotice(null),
      registerSample(input) {
        try {
          const result = applyOrThrow(data, () => upsertSample(data, input), "擦拭结果已登记（同点位同批仅保留一条）");
          setData(result.data);
          pushNotice(result.notice);
          return true;
        } catch (err) {
          pushNotice({ type: "err", message: err instanceof DomainError ? err.message : "登记失败" });
          return false;
        }
      },
      openRound(roomId, createdBy) {
        try {
          const result = createRound(data, { roomId, createdBy });
          setData(result.data);
          pushNotice({ type: "ok", message: "采样批次已建立，请按点位登记擦拭结果" });
          return result.roundId;
        } catch (err) {
          pushNotice({ type: "err", message: err instanceof DomainError ? err.message : "建批失败" });
          return null;
        }
      },
      openRework(sourceRoundId, reason, createdBy) {
        try {
          const result = createReworkRound(data, sourceRoundId, reason, createdBy);
          setData(result.data);
          pushNotice({ type: "ok", message: "复擦批次已建立，须由不同检验员复测全部点位" });
          return result.roundId;
        } catch (err) {
          pushNotice({ type: "err", message: err instanceof DomainError ? err.message : "复擦建批失败" });
          return null;
        }
      },
      decide(room, input) {
        try {
          const next = addDecision(data, room, input, TODAY);
          setData(next);
          pushNotice({
            type: "ok",
            message:
              input.verdict === "released"
                ? "判定版本已追加，该批次结果已冻结并放行"
                : "停行判定已记录为新版本，房间待处理、不得开工",
          });
          return true;
        } catch (err) {
          pushNotice({ type: "err", message: err instanceof DomainError ? err.message : "判定失败" });
          return false;
        }
      },
      addLot(kind, lot) {
        try {
          const listKey = kind === "disinfectant" ? "disinfectants" : "media";
          const label = kind === "disinfectant" ? "消毒剂" : "培养基";
          if (!lot.id.trim() || !lot.name.trim() || !lot.expiryDate) {
            throw new DomainError("批号、名称和有效期均为必填");
          }
          if (data[listKey].some((b) => b.id === lot.id.trim())) {
            throw new DomainError(`${label}批号已存在`);
          }
          const normalized: LotBatch = { ...lot, id: lot.id.trim(), name: lot.name.trim() };
          setData({ ...data, [listKey]: [...data[listKey], normalized] });
          pushNotice({ type: "ok", message: `${label}批次 ${normalized.id} 已加入资料` });
          return true;
        } catch (err) {
          pushNotice({ type: "err", message: err instanceof DomainError ? err.message : "新增批次失败" });
          return false;
        }
      },
      reset() {
        setData(resetData());
        pushNotice({ type: "ok", message: "已恢复为演示种子数据" });
      },
      exportData() {
        exportJson(data);
        pushNotice({ type: "ok", message: "全量记录 JSON 已导出" });
      },
    }),
    [data, notice],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}

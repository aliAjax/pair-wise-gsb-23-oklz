import { useEffect, useMemo, useState } from "react";
import type { AppState } from "../types";
import type { SampleDraft } from "../storage/repository";
import { TODAY } from "../domain/rules";
import { isBatchExpired } from "../domain/rules";

interface Props {
  state: AppState;
  roomId: string;
  roundBatchNo: string;
  /** 预填某点位（重复登记）时传入 */
  defaultPointId?: string;
  defaultDraft?: Partial<SampleDraft>;
  onSubmit: (draft: SampleDraft) => void;
}

export function SampleForm({ state, roomId, roundBatchNo, defaultPointId, defaultDraft, onSubmit }: Props) {
  const room = state.rooms.find((item) => item.id === roomId)!;
  const registeredPointIds = useMemo(() => {
    const round = state.rounds
      .filter((item) => item.roomId === roomId)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
    return new Set(
      state.samples.filter((sample) => sample.roundId === round?.id).map((sample) => sample.pointId)
    );
  }, [state, roomId]);

  const [pointId, setPointId] = useState(defaultPointId ?? "");
  const [sampledAt, setSampledAt] = useState(defaultDraft?.sampledAt ?? TODAY);
  const [disinfectantBatchId, setDisinfectant] = useState(defaultDraft?.disinfectantBatchId ?? "");
  const [mediumBatchId, setMedium] = useState(defaultDraft?.mediumBatchId ?? "");
  const [cfu, setCfu] = useState(defaultDraft?.cfu !== undefined ? String(defaultDraft.cfu) : "");
  const [analystId, setAnalyst] = useState(defaultDraft?.analystId ?? "");

  // 切换预填点位时同步表单
  useEffect(() => {
    if (defaultPointId) setPointId(defaultPointId);
  }, [defaultPointId]);

  const disinfectants = state.batches.filter((batch) => batch.kind === "disinfectant");
  const media = state.batches.filter((batch) => batch.kind === "medium");
  const selectedPoint = room.points.find((point) => point.id === pointId);
  const duplicate = Boolean(pointId && registeredPointIds.has(pointId) && pointId !== defaultPointId);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      pointId,
      sampledAt,
      roundBatchNo,
      disinfectantBatchId,
      mediumBatchId,
      cfu: Number(cfu),
      analystId,
    });
    if (!defaultPointId) {
      setPointId("");
      setCfu("");
    }
  }

  return (
    <form className="sample-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          <span>采样点位 *</span>
          <select value={pointId} onChange={(event) => setPointId(event.target.value)}>
            <option value="">选择点位</option>
            {room.points.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}（{point.surface}）
                {registeredPointIds.has(point.id) ? " · 已登记" : ""}
              </option>
            ))}
          </select>
          {duplicate && <em className="field-hint">该点位本批已登记，提交将更新原记录（不新增）</em>}
        </label>

        <label>
          <span>采样日期 *</span>
          <input type="date" value={sampledAt} onChange={(event) => setSampledAt(event.target.value)} />
        </label>

        <label>
          <span>消毒剂批次 *</span>
          <select value={disinfectantBatchId} onChange={(event) => setDisinfectant(event.target.value)}>
            <option value="">选择消毒剂批次</option>
            {disinfectants.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.no} · {batch.name}
                {isBatchExpired(batch.expiresOn) ? `（已过期 ${batch.expiresOn}）` : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>培养基批次 *</span>
          <select value={mediumBatchId} onChange={(event) => setMedium(event.target.value)}>
            <option value="">选择培养基批次</option>
            {media.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.no} · {batch.name}
                {isBatchExpired(batch.expiresOn) ? `（已过期 ${batch.expiresOn}）` : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>菌落数 CFU/碟 *</span>
          <input
            type="number"
            min={0}
            step={1}
            value={cfu}
            placeholder={`限值 ≤ ${room.limitCfu}`}
            onChange={(event) => setCfu(event.target.value)}
          />
          {selectedPoint && cfu !== "" && Number(cfu) > room.limitCfu && (
            <em className="field-hint bad">超过 {room.grade} 限值 {room.limitCfu}</em>
          )}
        </label>

        <label>
          <span>检验员 *</span>
          <select value={analystId} onChange={(event) => setAnalyst(event.target.value)}>
            <option value="">选择检验员</option>
            {state.analysts.map((analyst) => (
              <option key={analyst.id} value={analyst.id}>
                {analyst.name} · {analyst.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-footer">
        <span className="batch-line">
          本轮换产消毒批次：<strong>{roundBatchNo || "未登记"}</strong>（同一点位同批只留一条）
        </span>
        <button type="submit" className="primary-action">
          登记擦拭结果
        </button>
      </div>
    </form>
  );
}

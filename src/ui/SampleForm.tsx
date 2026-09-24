import { useEffect, useState } from "react";
import { INSPECTORS, TODAY } from "../data/seed";
import type { LotBatch, SamplingRound, WipeSample } from "../data/types";
import { useStore } from "../state/store";

interface SampleFormProps {
  round: SamplingRound;
  roomId: string;
  pointId: string;
  pointName: string;
  sample: WipeSample | undefined;
  reworkOldInspectorId?: string;
  onDone: () => void;
}

export function SampleForm({ round, roomId, pointId, pointName, sample, reworkOldInspectorId, onDone }: SampleFormProps) {
  const { data, today, registerSample } = useStore();
  const [disinfectantBatchId, setDisinfectant] = useState(sample?.disinfectantBatchId ?? "");
  const [mediumBatchId, setMedium] = useState(sample?.mediumBatchId ?? "");
  const [sampledAt, setSampledAt] = useState(sample?.sampledAt ?? TODAY);
  const [cfuText, setCfuText] = useState(sample?.cfu === null || sample === undefined ? "" : String(sample.cfu));
  const [pending, setPending] = useState(sample?.cfu === null);
  const [inspectorId, setInspector] = useState(sample?.inspectorId ?? "");

  useEffect(() => {
    setDisinfectant(sample?.disinfectantBatchId ?? "");
    setMedium(sample?.mediumBatchId ?? "");
    setSampledAt(sample?.sampledAt ?? TODAY);
    setCfuText(sample?.cfu === null || sample === undefined ? "" : String(sample.cfu));
    setPending(sample?.cfu === null);
    setInspector(sample?.inspectorId ?? "");
  }, [sample, round.id, pointId]);

  if (round.frozen) return null;

  const lotTag = (b: LotBatch) => (
    <span className={b.expiryDate < today ? "lot-expired" : "lot-valid"}>
      {b.expiryDate < today ? `已过期(${b.expiryDate})` : `有效期至 ${b.expiryDate}`}
    </span>
  );

  const reworkConflict = round.reworkOf && reworkOldInspectorId && inspectorId === reworkOldInspectorId;

  function submit() {
    const cfu = pending ? null : cfuText === "" ? null : Number(cfuText);
    const ok = registerSample({
      roundId: round.id,
      roomId,
      pointId,
      disinfectantBatchId,
      mediumBatchId,
      sampledAt,
      cfu,
      inspectorId,
    });
    if (ok) onDone();
  }

  return (
    <div className="sample-form">
      <div className="form-grid">
        <label>
          <span>消毒剂批次</span>
          <select value={disinfectantBatchId} onChange={(e) => setDisinfectant(e.target.value)}>
            <option value="">请选择</option>
            {data.disinfectants.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.name}
              </option>
            ))}
          </select>
          {disinfectantBatchId && lotTag(data.disinfectants.find((b) => b.id === disinfectantBatchId)!)}
        </label>
        <label>
          <span>培养基批次</span>
          <select value={mediumBatchId} onChange={(e) => setMedium(e.target.value)}>
            <option value="">请选择</option>
            {data.media.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.name}
              </option>
            ))}
          </select>
          {mediumBatchId && lotTag(data.media.find((b) => b.id === mediumBatchId)!)}
        </label>
        <label>
          <span>采样日期</span>
          <input type="date" value={sampledAt} max={today} onChange={(e) => setSampledAt(e.target.value)} />
        </label>
        <label>
          <span>检验员</span>
          <select value={inspectorId} onChange={(e) => setInspector(e.target.value)} className={reworkConflict ? "input-error" : ""}>
            <option value="">请选择</option>
            {INSPECTORS.filter((u) => u.role.includes("检验员")).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </select>
          {reworkConflict && <em className="field-warn">复擦须换人：该点位原批由此检验员采样</em>}
        </label>
        <label className="cfu-field">
          <span>菌落数 CFU / 碟</span>
          <div className="cfu-row">
            <input
              type="number"
              min={0}
              step={1}
              value={cfuText}
              disabled={pending}
              placeholder={pending ? "待读数" : "0"}
              onChange={(e) => setCfuText(e.target.value)}
            />
            <label className="check-inline">
              <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
              培养未读数
            </label>
          </div>
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-action" onClick={submit}>
          {sample ? "更新该点位结果" : "登记该点位"}
        </button>
        <span className="form-hint">同一点位同一采样批次仅保留一条，重复登记为更新</span>
      </div>
      <p className="point-name-line">点位：{pointId} {pointName}</p>
    </div>
  );
}

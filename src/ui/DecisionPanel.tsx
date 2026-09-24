import { useState } from "react";
import { INSPECTORS } from "../data/seed";
import { VERDICT_LABELS } from "../data/types";
import type { DecisionVersion, RoomDef, RoomEvaluation } from "./DrawerTypes";
import { useStore } from "../state/store";
import { formatDateTime, inspectorName } from "./helpers";

interface FreshDecisionProps {
  room: RoomDef;
  ev: RoomEvaluation;
  onChanged: () => void;
}

/** 未冻结批次的首次判定：放行 / 停行 */
export function FreshDecisionPanel({ room, ev, onChanged }: FreshDecisionProps) {
  const { decide } = useStore();
  const [reason, setReason] = useState("");
  const [decidedBy, setDecidedBy] = useState("");
  const [mode, setMode] = useState<"idle" | "release" | "block">("idle");
  if (!ev.round) return null;

  function submit() {
    const verdict = mode === "release" ? "released" as const : "blocked" as const;
    const ok = decide(room, { roomId: room.id, roundId: ev.round!.id, verdict, reason, decidedBy });
    if (ok) {
      setReason("");
      setMode("idle");
      onChanged();
    }
  }

  return (
    <div className="decision-box">
      <p>放行后冻结采样结果、房间可开工；停行则冻结证据并把房间留在待处理，需另开复擦批次复测。</p>
      {mode === "idle" ? (
        <div className="decision-actions">
          <button className="primary-action" disabled={!ev.passed} title={ev.passed ? "" : "全部点位合格且读数齐全后才能放行"} onClick={() => setMode("release")}>
            判行放行并冻结
          </button>
          <button className="danger-action" onClick={() => setMode("block")}>停行处理</button>
          {!ev.passed && <span className="form-hint">当前不满足放行条件，请先处理红色问题项或走复擦</span>}
        </div>
      ) : (
        <div className="decision-form">
          <label className="full">
            <span>{mode === "release" ? "放行备注（选填）" : "停行原因 *"}</span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === "release" ? "如：全部点位合格，同意放行" : "如：消毒剂过期且地漏周边超限，按偏差停行"} />
          </label>
          <label>
            <span>判定人 *</span>
            <select value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)}>
              <option value="">请选择</option>
              {INSPECTORS.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
            </select>
          </label>
          <div className="decision-actions">
            <button className={mode === "release" ? "primary-action" : "danger-action"} onClick={submit}>
              确认{mode === "release" ? "放行" : "停行"}
            </button>
            <button onClick={() => setMode("idle")}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 最新批已放行冻结后的改判：只能新增一条带原因的停行版本 */
export function RevisionPanel({ room, ev, decisions, onChanged }: {
  room: RoomDef;
  ev: RoomEvaluation;
  decisions: DecisionVersion[];
  onChanged: () => void;
}) {
  const { decide } = useStore();
  const [reason, setReason] = useState("");
  const [decidedBy, setDecidedBy] = useState("");
  const [confirm, setConfirm] = useState(false);
  const nextVersion = decisions[0].version + 1;

  function submit() {
    const ok = decide(room, { roomId: room.id, roundId: ev.round!.id, verdict: "blocked", reason, decidedBy });
    if (ok) {
      setReason("");
      setDecidedBy("");
      setConfirm(false);
      onChanged();
    }
  }

  return (
    <div className="decision-box frozen-box">
      <p>本批已冻结放行。改判不会覆盖或删除既有记录，只会追加一条<b>带原因</b>的新版本。</p>
      <div className="decision-form">
        <label className="full">
          <span>改判停行原因 *</span>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：放行后复核发现培养时长偏差，撤销放行" />
        </label>
        <label>
          <span>判定人 *</span>
          <select value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)}>
            <option value="">请选择</option>
            {INSPECTORS.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
          </select>
        </label>
        <div className="decision-actions">
          {!confirm ? (
            <button className="danger-action" disabled={!reason.trim() || !decidedBy} onClick={() => setConfirm(true)}>
              新增停行版本 v{nextVersion}
            </button>
          ) : (
            <>
              <span className="form-hint">确认在已冻结放行基础上改判停行？房间将立即不可开工。</span>
              <button className="danger-action" onClick={submit}>确认改判</button>
              <button onClick={() => setConfirm(false)}>取消</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function VersionHistory({ decisions }: { decisions: DecisionVersion[] }) {
  if (decisions.length === 0) {
    return <p className="empty-history">暂无判定版本。</p>;
  }
  return (
    <ol className="version-list">
      {decisions.map((d) => (
        <li key={d.id} className={`version-item verdict-${d.verdict}`}>
          <header>
            <strong>v{d.version}</strong>
            <span className={`verdict-badge ${d.verdict}`}>{VERDICT_LABELS[d.verdict]}</span>
            <time>{formatDateTime(d.decidedAt)}</time>
          </header>
          <p className="version-reason">{d.reason || "（未填写原因）"}</p>
          <p className="version-meta">
            判定人：{inspectorName(d.decidedBy)} · 批次 {d.roundId.slice(-6)} · 点位 {d.basis.countedPoints}/{d.basis.totalPoints} 已读数
            {d.basis.findings.length > 0 && <> · 留存问题 {d.basis.findings.flatMap((f) => f.codes).length} 项</>}
          </p>
          {d.basis.findings.length > 0 && (
            <ul className="basis-findings">
              {d.basis.findings.map((f) => (
                <li key={f.pointId}>{f.pointId} {f.pointName}：{f.details.join("；")}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

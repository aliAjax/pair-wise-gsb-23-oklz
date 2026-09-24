import { useMemo, useState } from "react";
import { INSPECTORS } from "../data/seed";
import { GRADE_RULES } from "../data/types";
import {
  boardState,
  canStartWork,
  decisionsForRoom,
  decisionsForRound,
  evaluateRound,
  gradeLabel,
  roundsForRoom,
} from "../domain/rules";
import { useStore } from "../state/store";
import { formatDateTime, inspectorName, lotLabel, roomById } from "./helpers";
import { SampleForm } from "./SampleForm";
import { FreshDecisionPanel, RevisionPanel, VersionHistory } from "./DecisionPanel";

interface RoomDrawerProps {
  roomId: string;
  onClose: () => void;
}

const CODE_BADGE: Record<string, string> = {
  MISSING: "漏采",
  PENDING_COUNT: "未读数",
  DISINFECTANT_EXPIRED: "消毒剂过期",
  MEDIA_EXPIRED: "培养基过期",
  CFU_OVER_LIMIT: "菌落超限",
};

export function RoomDrawer({ roomId, onClose }: RoomDrawerProps) {
  const { data, today, openRound, openRework } = useStore();
  const room = roomById(roomId);
  const roomRounds = useMemo(
    () => roundsForRoom(data, roomId),
    [data.rounds, roomId],
  );
  const [selectedRoundId, setSelectedRoundId] = useState<string | undefined>(roomRounds[roomRounds.length - 1]?.id);
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null);
  const [showRework, setShowRework] = useState(false);
  const [reworkReason, setReworkReason] = useState("");
  const [reworkBy, setReworkBy] = useState("");
  const [newRoundBy, setNewRoundBy] = useState("");
  const [tick, setTick] = useState(0);

  const round = roomRounds.find((r) => r.id === selectedRoundId) ?? roomRounds[roomRounds.length - 1];
  const ev = evaluateRound(room, round, data, today);
  const latestRoomRound = roomRounds[roomRounds.length - 1];
  const latestRoomEv = evaluateRound(room, latestRoomRound, data, today);
  const decisions = decisionsForRoom(data, roomId);
  const latestDecision = decisions[0];
  const roundDecision = round ? decisionsForRound(data, round.id)[0] : undefined;
  // 房间开工状态始终以最新批次（及其判定）为准，而不是当前正在查看的历史批次
  const roomState = boardState(latestRoomEv, decisionsForRound(data, latestRoomRound?.id ?? "")[0]);
  const startable = canStartWork(latestRoomEv, decisionsForRound(data, latestRoomRound?.id ?? "")[0]);
  const reworkExists = (roundId: string) => data.rounds.some((r) => r.reworkOf?.roundId === roundId);
  const isLatestReleased =
    Boolean(latestRoomRound?.frozen) && latestDecision?.roundId === latestRoomRound?.id && latestDecision.verdict === "released";
  const showNextBatch = isLatestReleased && latestRoomRound?.id === round?.id;

  void tick;

  const stateBanner: Record<string, { cls: string; text: string }> = {
    released: { cls: "banner-ok", text: "已判行放行且结果冻结，可凭本批次记录开工" },
    pending_release: { cls: "banner-wait", text: "全部点位合格，等待 QA 判行；判行前不得开工" },
    processing: { cls: "banner-err", text: "房间停在待处理：存在漏采 / 过期 / 未读数 / 超限，禁止开工" },
    not_started: { cls: "banner-muted", text: "尚未采样，禁止开工" },
  };

  function handleRework() {
    if (!round) return;
    const id = openRework(round.id, reworkReason, reworkBy);
    if (id) {
      setSelectedRoundId(id);
      setShowRework(false);
      setReworkReason("");
      setReworkBy("");
      setExpandedPoint(null);
      setTick((t) => t + 1);
    }
  }

  function handleNewRound() {
    const id = openRound(roomId, newRoundBy);
    if (id) {
      setSelectedRoundId(id);
      setNewRoundBy("");
      setTick((t) => t + 1);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="drawer-title-row">
              <h2>{room.id}</h2>
              <span className="grade-tag">{gradeLabel(room.grade)}</span>
            </div>
            <p>{room.name} · 接触碟限度 ≤{GRADE_RULES[room.grade].contactPlateLimit} CFU/碟 · {GRADE_RULES[room.grade].note}</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className={`drawer-banner ${stateBanner[roomState].cls}`}>
          <strong>{startable ? "可开工" : "不可开工"}</strong>
          <span>{stateBanner[roomState].text}</span>
        </div>

        <div className="drawer-body">
          {roomRounds.length > 1 && (
            <section className="drawer-section">
              <h3>采样批次</h3>
              <div className="round-tabs">
                {[...roomRounds].reverse().map((r) => (
                  <button
                    key={r.id}
                    className={`round-tab ${round?.id === r.id ? "active" : ""}`}
                    onClick={() => { setSelectedRoundId(r.id); setExpandedPoint(null); }}
                  >
                    {r.reworkOf ? "复擦批 " : ""}{r.id.slice(-4)}
                    {r.frozen ? " · 冻结" : ""}
                  </button>
                ))}
              </div>
            </section>
          )}

          {!round && (
            <section className="drawer-section">
              <h3>建立采样批次</h3>
              <p className="form-hint">该房间尚未采样。换产品前须先建批，完成全部 {room.points.length} 个点位擦拭并合格放行后才能开工。</p>
              <div className="decision-form">
                <label>
                  <span>登记人 *</span>
                  <select value={newRoundBy} onChange={(e) => setNewRoundBy(e.target.value)}>
                    <option value="">请选择</option>
                    {INSPECTORS.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
                  </select>
                </label>
                <div className="decision-actions">
                  <button className="primary-action" disabled={!newRoundBy} onClick={handleNewRound}>建立采样批次</button>
                </div>
              </div>
            </section>
          )}

          {round && (
            <>
              <section className="drawer-section">
                <div className="round-meta">
                  <h3>{round.reworkOf ? "复擦批次" : "采样批次"} {round.id}</h3>
                  <div className="round-badges">
                    <span>登记：{inspectorName(round.createdBy)} · {formatDateTime(round.createdAt)}</span>
                    {round.frozen && <span className="frozen-badge">已冻结</span>}
                    {round.reworkOf && <span className="rework-badge">复擦 · 须换人复测全部点位</span>}
                  </div>
                </div>
                {round.reworkOf && (
                  <p className="rework-reason">复擦原因：{round.reworkOf.reason}</p>
                )}

                <div className="points-table">
                  <div className="points-row points-row-head">
                    <span>点位</span>
                    <span>消毒剂 / 培养基</span>
                    <span>采样日期</span>
                    <span>检验员</span>
                    <span>CFU</span>
                    <span>判定</span>
                  </div>
                  {ev.points.map((p) => {
                    const s = p.sample;
                    const open = expandedPoint === p.pointId;
                    const sourceSamples = round.reworkOf
                      ? data.samples.find((x) => x.roundId === round.reworkOf!.roundId && x.pointId === p.pointId)
                      : undefined;
                    return (
                      <div key={p.pointId} className={`points-block ${p.codes.length ? "has-problem" : ""} ${s ? "" : "missing"}`}>
                        <button className="points-row" onClick={() => !round.frozen && setExpandedPoint(open ? null : p.pointId)}>
                          <span data-col="点位"><b>{p.pointId}</b> {p.pointName}</span>
                          <span data-col="消毒剂 / 培养基">
                            {s ? (
                              <>
                                {lotLabel(data.disinfectants.find((b) => b.id === s.disinfectantBatchId))}
                                <br />
                                {lotLabel(data.media.find((b) => b.id === s.mediumBatchId))}
                              </>
                            ) : "—"}
                          </span>
                          <span data-col="采样日期">{s?.sampledAt ?? "—"}</span>
                          <span data-col="检验员">{s ? inspectorName(s.inspectorId) : "—"}</span>
                          <span data-col="CFU" className={p.codes.includes("CFU_OVER_LIMIT") ? "cfu-bad" : ""}>
                            {!s ? "未采" : s.cfu === null ? "待读数" : `${s.cfu} / ≤${ev.limit}`}
                          </span>
                          <span data-col="判定">
                            {p.codes.length === 0 ? (
                              <i className="badge ok">合格</i>
                            ) : (
                              p.codes.map((c) => <i key={c} className="badge bad">{CODE_BADGE[c] ?? c}</i>)
                            )}
                            {s?.frozen && <i className="badge frozen">冻结</i>}
                          </span>
                        </button>
                        {p.codes.length > 0 && (
                          <ul className="point-details">
                            {p.details.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        )}
                        {open && !round.frozen && (
                          <SampleForm
                            round={round}
                            roomId={room.id}
                            pointId={p.pointId}
                            pointName={p.pointName}
                            sample={s}
                            reworkOldInspectorId={sourceSamples?.inspectorId}
                            onDone={() => setTick((t) => t + 1)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="completeness-line">
                  采样进度 {ev.sampledPoints}/{ev.totalPoints} 点位 · 读数 {ev.countedPoints}/{ev.totalPoints}
                  {ev.complete ? (ev.passed ? " · 全部合格，可提交放行" : " · 已采全但存在问题") : " · 未采全/未读数，按漏采或待处理处理"}
                </p>
              </section>

              {!round.frozen && (
                <section className="drawer-section">
                  <h3>判行</h3>
                  <FreshDecisionPanel room={room} ev={ev} onChanged={() => setTick((t) => t + 1)} />
                </section>
              )}

              {round.frozen && roundDecision?.verdict === "released" && latestRoomRound?.id === round.id && (
                <section className="drawer-section">
                  <h3>改判</h3>
                  <RevisionPanel room={room} ev={ev} decisions={decisions} onChanged={() => setTick((t) => t + 1)} />
                </section>
              )}

              {showNextBatch && (
                <section className="drawer-section next-batch-section">
                  <h3>下一轮换产</h3>
                  <p className="form-hint">本批已放行。下一次换产品前须建立新采样批次重新擦拭放行；历史批次冻结保留。</p>
                  <div className="decision-form">
                    <label>
                      <span>新批登记人 *</span>
                      <select value={newRoundBy} onChange={(e) => setNewRoundBy(e.target.value)}>
                        <option value="">请选择</option>
                        {INSPECTORS.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
                      </select>
                    </label>
                    <div className="decision-actions">
                      <button className="primary-action" disabled={!newRoundBy} onClick={handleNewRound}>建立下一批采样</button>
                    </div>
                  </div>
                </section>
              )}

              {!reworkExists(round.id) && roundDecision?.verdict !== "released" && (
                <section className="drawer-section">
                  <h3>{round.frozen ? "复擦（停行后复测）" : "复擦"}</h3>
                  {!showRework ? (
                    <div className="decision-actions">
                      <button className="warn-action" onClick={() => setShowRework(true)}>
                        另开复擦批次
                      </button>
                      <span className="form-hint">
                        复擦将新建批次：复测全部 {room.points.length} 个点位，且每个点位由与该批不同的检验员执行；复擦仍不合格可继续复擦
                      </span>
                    </div>
                  ) : (
                    <div className="decision-form">
                      <label className="full">
                        <span>复擦原因 *</span>
                        <textarea rows={2} value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} placeholder="如：地漏周边超限 + 消毒剂过期，按偏差复擦" />
                      </label>
                      <label>
                        <span>复擦登记人 *</span>
                        <select value={reworkBy} onChange={(e) => setReworkBy(e.target.value)}>
                          <option value="">请选择</option>
                          {INSPECTORS.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
                        </select>
                      </label>
                      <div className="decision-actions">
                        <button className="warn-action" disabled={!reworkReason.trim() || !reworkBy} onClick={handleRework}>建立复擦批次</button>
                        <button onClick={() => setShowRework(false)}>取消</button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          <section className="drawer-section">
            <h3>判定版本（只追加，不覆盖）</h3>
            <VersionHistory decisions={decisions} />
          </section>
        </div>
      </aside>
    </div>
  );
}

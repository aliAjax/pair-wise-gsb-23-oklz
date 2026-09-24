import { useMemo, useState } from "react";
import type { AppState, Judgment, Room, SamplingRound } from "../types";
import {
  evaluateRound,
  getAnalyst,
  rewipeAnalystConflicts,
  roomJudgments,
  roundLabel,
  verdictText,
} from "../domain/rules";
import { SampleForm } from "./SampleForm";
import { Badge, cx } from "./ui";

interface Props {
  state: AppState;
  room: Room;
  selectedRoundId: string;
  onSelectRound: (id: string) => void;
  onUpsertSample: (draft: import("../storage/repository").SampleDraft) => void;
  onJudge: (verdict: "released" | "blocked", reason: string) => void;
  onRewipe: (roundBatchNo: string, reason: string) => void;
  onOverturn: (verdict: "released" | "blocked", reason: string) => void;
}

export function RoundDetail({
  state,
  room,
  selectedRoundId,
  onSelectRound,
  onUpsertSample,
  onJudge,
  onRewipe,
  onOverturn,
}: Props) {
  const rounds = useMemo(
    () =>
      state.rounds
        .filter((round) => round.roomId === room.id)
        .sort((a, b) => a.openedAt.localeCompare(b.openedAt)),
    [state, room.id]
  );
  const round = rounds.find((item) => item.id === selectedRoundId) ?? rounds.at(-1);

  if (!round) {
    return (
      <section className="panel detail-panel">
        <p className="empty-hint">该房间尚无采样轮次</p>
      </section>
    );
  }

  const checks = evaluateRound(state, room, round);
  const allPass = checks.every((check) => check.problems.length === 0);
  const sampledCount = checks.filter((check) => check.record).length;
  const isLatest = rounds.at(-1)?.id === round.id;
  const judgments = roomJudgments(state, room.id);
  const roundJudgmentVersions = judgments.filter((item) => item.roundId === round.id);
  const latestVersion = judgments.at(-1);
  const conflicts = round.kind === "rewipe" ? rewipeAnalystConflicts(state, room, round) : [];

  return (
    <section className="panel detail-panel">
      <div className="round-tabs">
        {rounds.map((item, index) => (
          <button
            key={item.id}
            className={cx("round-tab", item.id === round.id && "active")}
            onClick={() => onSelectRound(item.id)}
          >
            {roundLabel(item, index + 1)}
            {item.sealed ? " · 已冻结" : " · 进行中"}
          </button>
        ))}
      </div>

      <div className="round-meta">
        <div>
          <span>换产消毒批次</span>
          <strong>{round.roundBatchNo}</strong>
        </div>
        <div>
          <span>开启时间</span>
          <strong>{round.openedAt.replace("T", " ")}</strong>
        </div>
        <div>
          <span>安排人</span>
          <strong>{round.openedBy}</strong>
        </div>
        <div>
          <span>采样进度</span>
          <strong>
            {sampledCount}/{room.points.length} 点位
          </strong>
        </div>
      </div>

      {round.kind === "rewipe" && round.rewipeReason && (
        <p className="rewipe-reason">
          <strong>复擦原因：</strong>
          {round.rewipeReason}
        </p>
      )}

      <CheckTable state={state} room={room} round={round} />

      {!round.sealed && (
        <>
          {conflicts.length > 0 && (
            <div className="alert danger">
              复擦换人未满足：{conflicts.join("、")} 仍由上一轮同一检验员复测，判定时将被拦截。
            </div>
          )}
          <h3 className="block-title">登记擦拭结果</h3>
          <SampleForm
            state={state}
            roomId={room.id}
            roundBatchNo={round.roundBatchNo}
            onSubmit={onUpsertSample}
          />
          <JudgeBar
            allPass={allPass}
            sampledAll={sampledCount === room.points.length}
            conflicts={conflicts}
            onJudge={onJudge}
          />
        </>
      )}

      {round.sealed && (
        <div className={cx("alert", roundJudgmentVersions.some((j) => j.verdict === "released") && isLatest ? "ok" : "danger")}>
          {round.sealedAt && `该轮结果已于 ${round.sealedAt.replace("T", " ")} 冻结，记录不可修改。`}
          {roundJudgmentVersions.map((judgment) => (
            <span key={judgment.id} className="frozen-line">
              V{judgment.version} {verdictText(judgment.verdict)} · {judgment.reason}
            </span>
          ))}
        </div>
      )}

      {isLatest && round.sealed && (
        <RewipeBar onRewipe={onRewipe} />
      )}

      {isLatest && latestVersion && (
        <OverturnBar current={latestVersion} onOverturn={onOverturn} />
      )}

      <JudgmentTimeline state={state} roomId={room.id} />
    </section>
  );
}

function CheckTable({ state, room, round }: { state: AppState; room: Room; round: SamplingRound }) {
  const checks = evaluateRound(state, room, round);
  return (
    <div className="table-wrap">
      <table className="check-table">
        <thead>
          <tr>
            <th>点位</th>
            <th>消毒剂批次</th>
            <th>培养基批次</th>
            <th>菌落数</th>
            <th>检验员</th>
            <th>检查</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => {
            const record = check.record;
            const disinfectant = record
              ? state.batches.find((batch) => batch.id === record.disinfectantBatchId)
              : undefined;
            const medium = record
              ? state.batches.find((batch) => batch.id === record.mediumBatchId)
              : undefined;
            const analyst = record ? getAnalyst(state, record.analystId) : undefined;
            const point = room.points.find((item) => item.id === check.pointId)!;
            return (
              <tr key={check.pointId} className={cx(check.problems.length > 0 && "row-bad")}>
                <td>
                  {point.name}
                  <small>{point.surface}</small>
                </td>
                <td>
                  {disinfectant ? (
                    <BatchCell no={disinfectant.no} expired={check.problems.some((p) => p.type === "batchExpired" && "batchId" in p && p.batchId === disinfectant.id)} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {medium ? (
                    <BatchCell no={medium.no} expired={check.problems.some((p) => p.type === "batchExpired" && "batchId" in p && p.batchId === medium.id)} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {record ? (
                    <span className={cx(check.problems.some((p) => p.type === "cfuExceeded") && "num-bad")}>
                      {record.cfu}
                    </span>
                  ) : (
                    <Badge tone="danger">漏采</Badge>
                  )}
                </td>
                <td>{analyst ? `${analyst.name}` : "—"}</td>
                <td>
                  {check.problems.length === 0 ? (
                    <Badge tone="ok">合格</Badge>
                  ) : (
                    <ul className="problem-list">
                      {check.problems.map((problem, index) => (
                        <li key={index}>{problem.message}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BatchCell({ no, expired }: { no: string; expired: boolean }) {
  return (
    <span className={cx(expired && "num-bad")}>
      {no}
      {expired && <small> 过期</small>}
    </span>
  );
}

function JudgeBar({
  allPass,
  sampledAll,
  conflicts,
  onJudge,
}: {
  allPass: boolean;
  sampledAll: boolean;
  conflicts: string[];
  onJudge: (verdict: "released" | "blocked", reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const canRelease = allPass && sampledAll && conflicts.length === 0;

  return (
    <div className="action-bar">
      <label className="reason-field">
        <span>判定原因 / 依据 *（写入版本，冻结后不可改）</span>
        <textarea
          rows={2}
          value={reason}
          placeholder="如：全部 4 点位采样，菌落均 ≤1 CFU/碟，批次在有效期内，准予放行"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="action-buttons">
        <button className="primary-action" disabled={!canRelease || !reason.trim()} onClick={() => onJudge("released", reason)}>
          判定放行（冻结）
        </button>
        <button disabled={!reason.trim()} onClick={() => onJudge("blocked", reason)}>
          判定阻断（停待处理）
        </button>
        {!canRelease && (
          <p className="action-hint">
            {!sampledAll && "存在漏采；"}
            {!allPass && "存在过期批次或菌落超限；"}
            {conflicts.length > 0 && "复擦未换人；"}
            以上情况不能放行，只能阻断后复擦。
          </p>
        )}
      </div>
    </div>
  );
}

function RewipeBar({ onRewipe }: { onRewipe: (roundBatchNo: string, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [roundBatchNo, setRoundBatchNo] = useState("");
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <div className="action-bar">
        <div className="action-buttons">
          <button className="primary-action" onClick={() => setOpen(true)}>
            安排复擦（换人 · 复测全部点位）
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="action-bar inline-form">
      <label>
        <span>重新消毒后的换产批次号 *</span>
        <input value={roundBatchNo} placeholder="如 CHG-0924-G" onChange={(event) => setRoundBatchNo(event.target.value)} />
      </label>
      <label className="reason-field">
        <span>消毒/整改说明 *</span>
        <textarea
          rows={2}
          value={reason}
          placeholder="如：更换消毒剂批次，VHP 重新熏蒸，设备表面二次擦拭"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="action-buttons">
        <button
          className="primary-action"
          disabled={!roundBatchNo.trim() || !reason.trim()}
          onClick={() => {
            onRewipe(roundBatchNo, reason);
            setOpen(false);
            setRoundBatchNo("");
            setReason("");
          }}
        >
          开启复擦轮次
        </button>
        <button onClick={() => setOpen(false)}>取消</button>
      </div>
    </div>
  );
}

function OverturnBar({
  current,
  onOverturn,
}: {
  current: Judgment;
  onOverturn: (verdict: "released" | "blocked", reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const nextVerdict = current.verdict === "released" ? "blocked" : "released";

  if (!open) {
    return (
      <div className="action-bar subtle">
        <div className="action-buttons">
          <button onClick={() => setOpen(true)}>
            改判当前结果（新增 V{current.version + 1}，保留原版本）
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="action-bar inline-form">
      <p className="overturn-note">
        将由「{verdictText(current.verdict)}」改判为「{verdictText(nextVerdict)}」，原 V{current.version}{" "}
        记录保留，新版本须填写原因。
      </p>
      <label className="reason-field">
        <span>改判原因 *</span>
        <textarea
          rows={2}
          value={reason}
          placeholder="如：复盘发现培养温度偏差，原结果无效"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="action-buttons">
        <button
          className="primary-action"
          disabled={!reason.trim()}
          onClick={() => {
            onOverturn(nextVerdict, reason);
            setOpen(false);
            setReason("");
          }}
        >
          确认改判
        </button>
        <button onClick={() => setOpen(false)}>取消</button>
      </div>
    </div>
  );
}

function JudgmentTimeline({ state, roomId }: { state: AppState; roomId: string }) {
  const roomJudgmentsAll = roomJudgments(state, roomId);
  return (
    <div className="timeline">
      <h3 className="block-title">判定版本（改判只新增，不覆盖）</h3>
      {roomJudgmentsAll.length === 0 && <p className="empty-hint">尚无判定记录</p>}
      {roomJudgmentsAll.map((judgment) => (
        <div key={judgment.id} className={cx("timeline-item", judgment.verdict === "released" ? "ok" : "danger")}>
          <div className="timeline-head">
            <Badge tone={judgment.verdict === "released" ? "ok" : "danger"}>
              V{judgment.version} {verdictText(judgment.verdict)}
            </Badge>
            <span>{judgment.decidedAt.replace("T", " ")} · {judgment.decider}</span>
            {judgment.overturns && <Badge tone="warn">改判</Badge>}
          </div>
          <p>{judgment.reason}</p>
        </div>
      ))}
    </div>
  );
}

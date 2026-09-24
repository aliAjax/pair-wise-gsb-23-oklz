import { useMemo, useState } from "react";
import "./styles.css";
import type { AppState, Verdict } from "./types";
import {
  judgeRoom,
  loadState,
  openRewipe,
  overturnJudgment,
  resetState,
  upsertSample,
  type SampleDraft,
} from "./storage/repository";
import {
  activeProblems,
  roomStatus,
  ROOM_STATUS,
  ROOM_STATUS_TEXT,
  TODAY,
} from "./domain/rules";
import { RoomList } from "./components/RoomList";
import { RoundDetail } from "./components/RoundDetail";
import { BatchRegistry } from "./components/BatchRegistry";
import { cx } from "./components/ui";

const GRADES = ["全部", "ISO 5", "ISO 6", "ISO 7", "黄光区"];

interface Toast {
  tone: "ok" | "danger";
  text: string;
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [selectedRoomId, setSelectedRoomId] = useState<string>(state.rooms[0]?.id ?? "");
  const [gradeFilter, setGradeFilter] = useState("全部");
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const [toast, setToast] = useState<Toast | null>(null);

  const room = state.rooms.find((item) => item.id === selectedRoomId) ?? state.rooms[0];

  const metrics = useMemo(() => {
    let released = 0;
    let blocked = 0;
    let collecting = 0;
    let problems = 0;
    for (const item of state.rooms) {
      const status = roomStatus(state, item.id);
      if (status === ROOM_STATUS.RELEASED) released += 1;
      else if (status === ROOM_STATUS.BLOCKED) blocked += 1;
      else collecting += 1;
      problems += activeProblems(state, item.id).length;
    }
    return [
      { label: "已放行 · 可开工", value: released, tone: "ok" as const },
      { label: "待处理 · 禁止开工", value: blocked, tone: "danger" as const },
      { label: "采样中 · 禁止开工", value: collecting, tone: "warn" as const },
      { label: "挂起问题（过期/漏采/超限）", value: problems, tone: "danger" as const },
    ];
  }, [state]);

  function flash(tone: Toast["tone"], text: string) {
    setToast({ tone, text });
    window.setTimeout(() => setToast(null), 4200);
  }

  function handleUpsertSample(draft: SampleDraft) {
    try {
      const result = upsertSample(state, room.id, draft);
      setState(result.state);
      flash("ok", result.merged ? "已更新该点位本批记录（同一点位同批只保留一条）" : "擦拭结果已登记");
    } catch (error) {
      flash("danger", (error as Error).message);
    }
  }

  function handleJudge(verdict: Verdict, reason: string) {
    try {
      setState(judgeRoom(state, room.id, verdict, reason));
      flash("ok", verdict === "released" ? "已放行，该轮结果冻结" : "已阻断，房间停在待处理");
    } catch (error) {
      flash("danger", (error as Error).message);
    }
  }

  function handleRewipe(roundBatchNo: string, reason: string) {
    try {
      const next = openRewipe(state, room.id, roundBatchNo, reason);
      setState(next);
      const newest = next.rounds.filter((item) => item.roomId === room.id).at(-1);
      if (newest) setSelectedRoundId(newest.id);
      flash("ok", "复擦轮次已开启，请换人并复测全部点位");
    } catch (error) {
      flash("danger", (error as Error).message);
    }
  }

  function handleOverturn(verdict: Verdict, reason: string) {
    try {
      setState(overturnJudgment(state, room.id, verdict, reason));
      flash("ok", `已新增改判版本（${verdict === "released" ? "放行" : "阻断"}），原版本保留`);
    } catch (error) {
      flash("danger", (error as Error).message);
    }
  }

  function handleReset() {
    setState(resetState());
    setSelectedRoundId("");
    flash("ok", "已恢复演示台账");
  }

  const roomState = room ? roomStatus(state, room.id) : null;

  return (
    <main className="app-shell">
      {toast && (
        <div className={cx("toast", `toast-${toast.tone}`)} onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}

      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-09 · 表面微生物擦拭采样与房间放行台</p>
          <h1>换产开工放行看板</h1>
          <p className="subtitle">
            按点位登记消毒剂批次、培养基、菌落数与检验员；批次过期、漏采或菌落超限即阻断开工。
            复擦换人并复测全部点位，通过后冻结结果；改判只新增带原因的版本。
          </p>
        </div>
        <div className="stack-card">
          <span>分层结构</span>
          <strong>资料台账 · 判定规则 · 保存仓库 · 页面看板</strong>
          <span className="as-of">基准日 {TODAY}</span>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className={cx("metric-card", `metric-${metric.tone}`)}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <i className={cx("status-bar", `bar-${metric.tone}`)} />
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>洁净等级筛选</h2>
          <div className="chips muted">
            {GRADES.map((grade) => (
              <button
                key={grade}
                className={cx(gradeFilter === grade && "chip-active")}
                onClick={() => setGradeFilter(grade)}
              >
                {grade}
              </button>
            ))}
          </div>
          <BatchRegistry state={state} />
          <button className="reset-button" onClick={handleReset}>
            恢复演示台账
          </button>
        </aside>

        <section className="board-main">
          <div className="board-header">
            <h2>房间放行状态</h2>
            <p>未放行房间一律禁止开工；放行依据为最新轮次全部点位的擦拭结果</p>
          </div>
          <RoomList
            state={state}
            selectedRoomId={room?.id ?? ""}
            gradeFilter={gradeFilter}
            onSelect={(roomId) => {
              setSelectedRoomId(roomId);
              setSelectedRoundId("");
            }}
          />
        </section>
      </section>

      {room && (
        <section className="detail-section">
          <div className="detail-heading panel">
            <div>
              <p className="eyebrow">
                {room.id} · {room.grade} · 限值 ≤{room.limitCfu} CFU/碟 · {room.points.length} 个点位
              </p>
              <h2>{room.name}</h2>
            </div>
            <span className={cx("big-status", roomState && `big-status-${roomState}`)}>
              {roomState && ROOM_STATUS_TEXT[roomState]}
            </span>
          </div>
          <RoundDetail
            state={state}
            room={room}
            selectedRoundId={selectedRoundId}
            onSelectRound={setSelectedRoundId}
            onUpsertSample={handleUpsertSample}
            onJudge={handleJudge}
            onRewipe={handleRewipe}
            onOverturn={handleOverturn}
          />
        </section>
      )}
    </main>
  );
}

export default App;

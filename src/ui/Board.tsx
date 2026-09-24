import { ROOMS } from "../data/seed";
import { GRADE_RULES } from "../data/types";
import {
  BOARD_COLUMNS,
  FINDING_LABELS,
  boardState,
  decisionsForRound,
  evaluateRound,
  gradeLabel,
  latestRound,
} from "../domain/rules";
import type { BoardState } from "../domain/rules";
import { useStore } from "../state/store";
import { inspectorName } from "./helpers";

interface BoardProps {
  onOpenRoom: (roomId: string) => void;
}

export function Board({ onOpenRoom }: BoardProps) {
  const { data, today } = useStore();

  const cards = ROOMS.map((room) => {
    const round = latestRound(data, room.id);
    const ev = evaluateRound(room, round, data, today);
    const latest = round ? decisionsForRound(data, round.id)[0] : undefined;
    const state = boardState(ev, latest);
    return { room, round, ev, latest, state };
  });

  const counts = BOARD_COLUMNS.reduce<Record<BoardState, number>>(
    (acc, col) => {
      acc[col.key] = cards.filter((c) => c.state === col.key).length;
      return acc;
    },
    { released: 0, pending_release: 0, processing: 0, not_started: 0 },
  );

  return (
    <div className="board">
      {BOARD_COLUMNS.map((col) => (
        <section key={col.key} className={`kanban-col col-${col.key}`}>
          <header className="kanban-col-head">
            <div>
              <h3>{col.title}</h3>
              <p>{col.hint}</p>
            </div>
            <span className="col-count">{counts[col.key]}</span>
          </header>
          <div className="kanban-cards">
            {cards
              .filter((c) => c.state === col.key)
              .map(({ room, round, ev, latest }) => {
                const problems = ev.points.flatMap((p) => p.codes.map((c) => ({ point: p.pointName, code: c })));
                return (
                  <button key={room.id} className="room-card" onClick={() => onOpenRoom(room.id)}>
                    <div className="room-card-head">
                      <strong>{room.id}</strong>
                      <span className="grade-tag">{gradeLabel(room.grade)}</span>
                    </div>
                    <h4>{room.name}</h4>
                    <p className="room-meta">
                      点位 {ev.sampledPoints}/{ev.totalPoints} · 限度 ≤{GRADE_RULES[room.grade].contactPlateLimit} CFU
                      {round?.reworkOf ? " · 复擦批" : ""}
                      {ev.frozen ? " · 已冻结" : ""}
                    </p>
                    <div className="room-progress">
                      <span style={{ width: `${(ev.sampledPoints / ev.totalPoints) * 100}%` }} />
                    </div>
                    {col.key === "released" && latest && (
                      <p className="room-foot ok">
                        ✓ 已放行 · {inspectorName(latest.decidedBy)} · v{latest.version}
                      </p>
                    )}
                    {col.key === "pending_release" && (
                      <p className="room-foot wait">全部点位合格，待 QA 判行冻结</p>
                    )}
                    {col.key === "processing" && (
                      <ul className="room-problems">
                        {[...new Set(problems.map((p) => p.code))].slice(0, 3).map((code) => (
                          <li key={code}>{FINDING_LABELS[code] ?? code}</li>
                        ))}
                      </ul>
                    )}
                    {col.key === "not_started" && <p className="room-foot muted">禁止开工，待建批采样</p>}
                  </button>
                );
              })}
            {cards.filter((c) => c.state === col.key).length === 0 && <p className="empty-col">暂无房间</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

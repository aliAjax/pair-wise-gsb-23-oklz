import { useMemo } from "react";
import type { AppState, Room } from "../types";
import {
  activeProblems,
  latestRound,
  roomStatus,
  ROOM_STATUS_TEXT,
  roundSamples,
} from "../domain/rules";
import { Badge, cx } from "./ui";

interface Props {
  state: AppState;
  selectedRoomId: string;
  gradeFilter: string;
  onSelect: (roomId: string) => void;
}

export function RoomList({ state, selectedRoomId, gradeFilter, onSelect }: Props) {
  const rooms = useMemo(
    () => state.rooms.filter((room) => gradeFilter === "全部" || room.grade === gradeFilter),
    [state.rooms, gradeFilter]
  );

  return (
    <div className="room-list">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          state={state}
          room={room}
          selected={room.id === selectedRoomId}
          onSelect={() => onSelect(room.id)}
        />
      ))}
    </div>
  );
}

function RoomCard({
  state,
  room,
  selected,
  onSelect,
}: {
  state: AppState;
  room: Room;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = roomStatus(state, room.id);
  const round = latestRound(state, room.id);
  const sampled = round ? roundSamples(state, round.id).length : 0;
  const problems = activeProblems(state, room.id);

  return (
    <button className={cx("room-card", `room-card-${status}`, selected && "selected")} onClick={onSelect}>
      <div className="room-card-head">
        <div>
          <h3>{room.id}</h3>
          <p>{room.name}</p>
        </div>
        <Badge tone={status === "released" ? "ok" : status === "blocked" ? "danger" : "warn"}>
          {ROOM_STATUS_TEXT[status]}
        </Badge>
      </div>
      <div className="room-card-meta">
        <span>{room.grade}</span>
        <span>表面微生物限值 ≤{room.limitCfu} CFU/碟</span>
        <span>
          {round ? `${sampled}/${room.points.length} 点` : "未开轮次"}
        </span>
      </div>
      {problems.length > 0 && (
        <ul className="room-card-problems">
          {problems.slice(0, 3).map((problem, index) => (
            <li key={index}>{problem.message}</li>
          ))}
          {problems.length > 3 && <li>等 {problems.length} 项问题</li>}
        </ul>
      )}
    </button>
  );
}

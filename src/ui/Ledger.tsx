import { useMemo, useState } from "react";
import { ROOMS } from "../data/seed";
import { findingText, inspectorName, lotLabel, roomById, sampleRowFlags } from "./helpers";
import { useStore } from "../state/store";

export function Ledger() {
  const { data, today } = useStore();
  const [roomFilter, setRoomFilter] = useState("all");
  const [problemOnly, setProblemOnly] = useState(false);

  const rows = useMemo(() => {
    return data.samples
      .filter((s) => roomFilter === "all" || s.roomId === roomFilter)
      .map((s) => {
        const room = roomById(s.roomId);
        const point = room.points.find((p) => p.id === s.pointId);
        const round = data.rounds.find((r) => r.id === s.roundId);
        const flags = sampleRowFlags(s, data, today);
        const d = data.disinfectants.find((b) => b.id === s.disinfectantBatchId);
        const m = data.media.find((b) => b.id === s.mediumBatchId);
        return { s, pointName: point?.name ?? s.pointId, round, flags, d, m };
      })
      .filter((r) => !problemOnly || r.flags.problems.length > 0)
      .sort((a, b) => b.s.updatedAt.localeCompare(a.s.updatedAt));
  }, [data, today, roomFilter, problemOnly]);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>采样台账</p>
          <h2>擦拭采样记录</h2>
        </div>
        <div className="filter-inline">
          <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
            <option value="all">全部房间</option>
            {ROOMS.map((r) => <option key={r.id} value={r.id}>{r.id} {r.name}</option>)}
          </select>
          <label className="check-inline">
            <input type="checkbox" checked={problemOnly} onChange={(e) => setProblemOnly(e.target.checked)} />
            只看问题记录
          </label>
        </div>
      </div>

      <div className="table-wrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>采样批次</th>
              <th>房间 / 级别</th>
              <th>点位</th>
              <th>消毒剂批次</th>
              <th>培养基批次</th>
              <th>采样日期</th>
              <th>检验员</th>
              <th>菌落数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, pointName, round, flags, d, m }) => (
              <tr key={s.id} className={flags.problems.length ? "row-problem" : ""}>
                <td>
                  {round?.reworkOf ? "复擦 " : ""}{s.roundId.slice(-6)}
                  {s.frozen && <i className="badge frozen">冻结</i>}
                </td>
                <td>{s.roomId}</td>
                <td>{s.pointId} {pointName}</td>
                <td className={d && d.expiryDate < today ? "cell-expired" : ""}>{lotLabel(d)}</td>
                <td className={m && m.expiryDate < today ? "cell-expired" : ""}>{lotLabel(m)}</td>
                <td>{s.sampledAt}</td>
                <td>{inspectorName(s.inspectorId)}</td>
                <td className={flags.problems.includes("菌落超限") ? "cell-bad" : ""}>
                  {s.cfu === null ? "待读数" : s.cfu}
                </td>
                <td>
                  {flags.problems.length === 0 ? <i className="badge ok">合格</i> : flags.problems.map((p) => (
                    <i key={p} className="badge bad">{findingText(p)}</i>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty-history">没有符合条件的记录。</p>}
      </div>
      <p className="table-foot">同一房间同一点位在同一采样批次内仅保留一条记录，重复登记以更新方式覆盖该条，不产生重复行。</p>
    </section>
  );
}

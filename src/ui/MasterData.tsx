import { useState } from "react";
import { INSPECTORS, ROOMS, TODAY } from "../data/seed";
import { GRADE_RULES } from "../data/types";
import type { Grade } from "../data/types";
import { useStore } from "../state/store";

export function MasterData() {
  const { data, today, addLot } = useStore();

  return (
    <div className="master-grid">
      <section className="panel">
        <p className="panel-kicker">级别限度</p>
        <h2>洁净级别表面微生物限度</h2>
        <table className="mini-table">
          <thead><tr><th>级别</th><th>接触碟限度 CFU/碟</th><th>说明</th></tr></thead>
          <tbody>
            {(Object.keys(GRADE_RULES) as Grade[]).map((g) => (
              <tr key={g}>
                <td><span className="grade-tag">{GRADE_RULES[g].label}</span></td>
                <td>≤ {GRADE_RULES[g].contactPlateLimit}</td>
                <td>{GRADE_RULES[g].note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <p className="panel-kicker">房间与点位</p>
        <h2>受控房间（{ROOMS.length}）</h2>
        <ul className="room-point-list">
          {ROOMS.map((r) => (
            <li key={r.id}>
              <div className="room-point-head">
                <strong>{r.id} {r.name}</strong>
                <span className="grade-tag">{GRADE_RULES[r.grade].label}</span>
              </div>
              <p>{r.points.map((p) => `${p.id} ${p.name}`).join("　｜　")}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <p className="panel-kicker">人员</p>
        <h2>检验员 / 放行人</h2>
        <ul className="people-list">
          {INSPECTORS.map((u) => (
            <li key={u.id}><strong>{u.name}</strong><span>{u.role}</span><code>{u.id}</code></li>
          ))}
        </ul>
      </section>

      <LotList title="消毒剂批次" kind="disinfectant" lots={data.disinfectants} today={today} onAdd={addLot} />
      <LotList title="培养基批次" kind="medium" lots={data.media} today={today} onAdd={addLot} />

      <p className="data-note">系统基准日期：{TODAY}（演示数据固定）。有效期早于该日期的批次在登记与放行判定中一律判为过期。</p>
    </div>
  );
}

function LotList({ title, kind, lots, today, onAdd }: {
  title: string;
  kind: "disinfectant" | "medium";
  lots: { id: string; name: string; expiryDate: string }[];
  today: string;
  onAdd: (kind: "disinfectant" | "medium", lot: { id: string; name: string; expiryDate: string }) => boolean;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  function submit() {
    if (onAdd(kind, { id, name, expiryDate })) {
      setId("");
      setName("");
      setExpiryDate("");
    }
  }

  return (
    <section className="panel">
      <p className="panel-kicker">批次资料</p>
      <h2>{title}（{lots.length}）</h2>
      <ul className="lot-list">
        {lots.map((b) => {
          const expired = b.expiryDate < today;
          return (
            <li key={b.id} className={expired ? "lot-row expired" : "lot-row"}>
              <div>
                <strong>{b.id}</strong>
                <span>{b.name}</span>
              </div>
              <span className={expired ? "lot-expired" : "lot-valid"}>
                {expired ? "已过期 · " : "有效期至 "}{b.expiryDate}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="lot-add">
        <input placeholder="批号，如 XD-2610" value={id} onChange={(e) => setId(e.target.value)} />
        <input placeholder="名称" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        <button className="primary-action" onClick={submit}>新增批次</button>
      </div>
    </section>
  );
}

import { useMemo, useState } from "react";
import "./styles.css";
import { ROOMS } from "./data/seed";
import { boardState, decisionsForRound, evaluateRound, latestRound } from "./domain/rules";
import { StoreProvider, useStore } from "./state/store";
import { Board } from "./ui/Board";
import { Ledger } from "./ui/Ledger";
import { MasterData } from "./ui/MasterData";
import { RoomDrawer } from "./ui/RoomDrawer";

type Tab = "board" | "ledger" | "master";

const TABS: { key: Tab; label: string }[] = [
  { key: "board", label: "放行看板" },
  { key: "ledger", label: "采样台账" },
  { key: "master", label: "资料维护" },
];

function Metrics() {
  const { data, today } = useStore();
  const stats = useMemo(() => {
    let released = 0;
    let pending = 0;
    let processing = 0;
    let notStarted = 0;
    let problemPoints = 0;
    for (const room of ROOMS) {
      const round = latestRound(data, room.id);
      const ev = evaluateRound(room, round, data, today);
      const state = boardState(ev, round ? decisionsForRound(data, round.id)[0] : undefined);
      if (state === "released") released += 1;
      else if (state === "pending_release") pending += 1;
      else if (state === "processing") processing += 1;
      else notStarted += 1;
      problemPoints += ev.points.reduce((acc, p) => acc + (p.codes.length ? 1 : 0), 0);
    }
    return { released, pending, processing, notStarted, problemPoints };
  }, [data, today]);

  const cards = [
    { label: "已放行 / 可开工", value: stats.released, cls: "metric-ok" },
    { label: "合格待放行", value: stats.pending, cls: "metric-wait" },
    { label: "待处理 / 禁开工", value: stats.processing, cls: "metric-err" },
    { label: "待采样房间", value: stats.notStarted, cls: "metric-muted" },
    { label: "问题点位数", value: stats.problemPoints, cls: "metric-err" },
  ];

  return (
    <section className="metrics-grid metrics-five">
      {cards.map((c) => (
        <article key={c.label} className={`metric-card ${c.cls}`}>
          <span>{c.label}</span>
          <strong>{c.value}</strong>
        </article>
      ))}
    </section>
  );
}

function Workspace() {
  const { notice, clearNotice, exportData, reset } = useStore();
  const [tab, setTab] = useState<Tab>("board");
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-09 · 表面微生物擦拭采样与房间放行</p>
          <h1>洁净室擦拭放行看板</h1>
          <p className="subtitle">
            换产品前凭表面微生物擦拭结果放行开工：按点位登记消毒剂批次、培养基批次、菌落数与检验员；
            批次过期、漏采或菌落超限的房间停在待处理；复擦换人并复测全部点位，通过后冻结结果，改判只新增带原因的版本。
          </p>
        </div>
        <div className="stack-card">
          <span>放行铁律</span>
          <strong>未判行放行 = 禁止开工</strong>
          <p className="stack-note">同点位同批仅一条 · 放行即冻结 · 判定版本只追加</p>
        </div>
      </section>

      <Metrics />

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "tab active" : "tab"} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <div className="tab-tools">
          <button onClick={exportData}>导出 JSON</button>
          <button onClick={reset}>重置演示数据</button>
        </div>
      </nav>

      {tab === "board" && <Board onOpenRoom={setOpenRoomId} />}
      {tab === "ledger" && <Ledger />}
      {tab === "master" && <MasterData />}

      {openRoomId && <RoomDrawer key={openRoomId} roomId={openRoomId} onClose={() => setOpenRoomId(null)} />}

      {notice && (
        <div className={`toast toast-${notice.type}`} onClick={clearNotice}>
          {notice.type === "ok" ? "✓ " : "⚠ "}{notice.message}
        </div>
      )}

      <footer className="app-footer">
        <span>资料（主数据/记录） · 判定（rules 纯函数） · 保存（localStorage） · 页面（看板/台账/资料）四层分离</span>
      </footer>
    </main>
  );
}

function App() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}

export default App;

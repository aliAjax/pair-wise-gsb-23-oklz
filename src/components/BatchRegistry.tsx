import type { AppState } from "../types";
import { isBatchExpired, TODAY } from "../domain/rules";
import { Badge } from "./ui";

export function BatchRegistry({ state }: { state: AppState }) {
  const kinds = [
    { key: "disinfectant", title: "消毒剂批次" },
    { key: "medium", title: "培养基批次" },
  ] as const;

  return (
    <section className="panel batch-panel">
      <div className="section-heading">
        <div>
          <p>资料台账</p>
          <h2>批次有效期</h2>
        </div>
        <span className="as-of">基准日 {TODAY}</span>
      </div>
      {kinds.map((kind) => (
        <div key={kind.key} className="batch-group">
          <h3>{kind.title}</h3>
          <table className="batch-table">
            <tbody>
              {state.batches
                .filter((batch) => batch.kind === kind.key)
                .map((batch) => {
                  const expired = isBatchExpired(batch.expiresOn);
                  return (
                    <tr key={batch.id} className={expired ? "row-bad" : ""}>
                      <td className="batch-no">{batch.no}</td>
                      <td>{batch.name}</td>
                      <td className="batch-date">{batch.expiresOn}</td>
                      <td>
                        {expired ? <Badge tone="danger">已过期</Badge> : <Badge tone="ok">有效</Badge>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

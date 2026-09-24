// 保存层：localStorage 持久化，页面与判定逻辑不直接接触存储实现

import { createSeedData } from "../data/seed";
import type { AppData } from "../data/types";

const STORAGE_KEY = "hxwl-09.wipe-release.v1";

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedData();
      saveData(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.rounds || !parsed.samples || !parsed.decisions || !parsed.disinfectants || !parsed.media) {
      throw new Error("持久化资料结构不完整");
    }
    return parsed;
  } catch (err) {
    console.warn("无法读取本地资料，回退到种子数据", err);
    const seed = createSeedData();
    saveData(seed);
    return seed;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetData(): AppData {
  const seed = createSeedData();
  saveData(seed);
  return seed;
}

export function exportJson(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wipe-release-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

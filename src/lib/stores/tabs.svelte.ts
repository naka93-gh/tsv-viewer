/** マルチタブ状態管理。編集モード・Undo/Redo・保存をサポートする。 */
import { openFile, openFileDialog, saveFile } from "$lib/commands";
import type { EditOp, TabState } from "$lib/types";
import { ask } from "@tauri-apps/plugin-dialog";
import { SvelteSet } from "svelte/reactivity";

let nextId = 0;
function generateId(): string {
  return `tab-${nextId++}`;
}

/** EditOp の逆操作を返す */
function invertOp(op: EditOp): EditOp {
  switch (op.type) {
    case "cell":
      return { ...op, oldValue: op.newValue, newValue: op.oldValue };
    case "addRow":
      return { type: "deleteRow", rowIndex: op.rowIndex, row: op.row };
    case "deleteRow":
      return { type: "addRow", rowIndex: op.rowIndex, row: op.row };
  }
}

/** EditOp を rows に適用する */
function applyOpToRows(rows: string[][], op: EditOp): void {
  switch (op.type) {
    case "cell":
      rows[op.rowIndex] = [...rows[op.rowIndex]];
      rows[op.rowIndex][op.colIndex] = op.newValue;
      break;
    case "addRow":
      rows.splice(op.rowIndex, 0, [...op.row]);
      break;
    case "deleteRow":
      rows.splice(op.rowIndex, 1);
      break;
  }
}

/**
 * undoStack を再生して、現在のどのセルが原本と異なるかを算出する。
 * 行追加・削除によるインデックスのシフトも追跡する。
 */
function rebuildDirtyCells(tab: TabState): void {
  // 原本行の 1:1 マッピング（originalIndices[i] = 原本での行番号, null = 追加行）
  const origIndices: (number | null)[] = tab.file.rows.map((_, i) => i);

  for (const op of tab.undoStack) {
    if (op.type === "addRow") {
      origIndices.splice(op.rowIndex, 0, null);
    } else if (op.type === "deleteRow") {
      origIndices.splice(op.rowIndex, 1);
    }
  }

  const dirty = new SvelteSet<string>();
  const colCount = tab.file.headers.length;

  for (let i = 0; i < tab.rows.length; i++) {
    const origIdx = origIndices[i];
    if (origIdx === null) {
      // 追加された行 — 全セルを dirty とする
      for (let j = 0; j < colCount; j++) {
        dirty.add(`${i}:${j}`);
      }
    } else {
      // 原本行と比較して差分のあるセルを dirty とする
      const origRow = tab.file.rows[origIdx];
      for (let j = 0; j < colCount; j++) {
        if (tab.rows[i][j] !== origRow[j]) {
          dirty.add(`${i}:${j}`);
        }
      }
    }
  }

  tab.dirtyCells = dirty;
}

class TabStore {
  tabs = $state<TabState[]>([]);
  activeTabId = $state<string | null>(null);
  /** Grid への差分更新通知。version でトリガーし、op で更新内容を伝える。 */
  lastGridOp = $state<{ version: number; op: EditOp } | null>(null);
  private gridOpVersion = 0;

  get activeTab(): TabState | undefined {
    return this.tabs.find((t) => t.id === this.activeTabId);
  }

  get hasTabs(): boolean {
    return this.tabs.length > 0;
  }

  /** ファイルを新タブで開く。同一パスが既に開かれていればそのタブをアクティブにする。 */
  async open(path: string): Promise<void> {
    const existing = this.tabs.find((t) => t.file.path === path);
    if (existing) {
      this.activeTabId = existing.id;
      return;
    }

    const file = await openFile(path);
    const id = generateId();
    this.tabs.push({
      id,
      file,
      rows: [...file.rows],
      searchQuery: "",
      mode: "view",
      dirty: false,
      undoStack: [],
      redoStack: [],
      dirtyCells: new SvelteSet(),
    });
    this.activeTabId = id;
  }

  /** ファイル選択ダイアログを表示し、選択されたファイルを新タブで開く。 */
  async openDialog(): Promise<void> {
    const path = await openFileDialog();
    if (path) {
      await this.open(path);
    }
  }

  /** 指定タブをアクティブにする。 */
  activate(tabId: string): void {
    this.activeTabId = tabId;
  }

  /** 指定タブを閉じる。dirty 時は確認ダイアログを表示する。 */
  async close(tabId: string): Promise<void> {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.dirty) {
      const confirmed = await ask(
        "未保存の変更があります。保存せずに閉じますか？",
        {
          title: "確認",
          kind: "warning",
          okLabel: "閉じる",
          cancelLabel: "キャンセル",
        },
      );
      if (!confirmed) return;
    }

    const index = this.tabs.findIndex((t) => t.id === tabId);
    const wasActive = this.activeTabId === tabId;
    this.tabs.splice(index, 1);

    if (wasActive) {
      if (this.tabs.length === 0) {
        this.activeTabId = null;
      } else {
        const nextIndex = Math.min(index, this.tabs.length - 1);
        this.activeTabId = this.tabs[nextIndex].id;
      }
    }
  }

  /** アクティブタブの検索クエリを更新する。 */
  setSearchQuery(query: string): void {
    const tab = this.activeTab;
    if (tab) {
      tab.searchQuery = query;
    }
  }

  /** 閲覧/編集モードを設定する。 */
  setMode(mode: "view" | "edit"): void {
    const tab = this.activeTab;
    if (tab) {
      tab.mode = mode;
    }
  }

  /** 閲覧/編集モードをトグルする。 */
  toggleMode(): void {
    const tab = this.activeTab;
    if (tab) {
      tab.mode = tab.mode === "view" ? "edit" : "view";
    }
  }

  /** 行を追加する。 */
  addRow(rowIndex: number, position: "above" | "below"): void {
    const tab = this.activeTab;
    if (!tab) return;
    const insertIndex = position === "above" ? rowIndex : rowIndex + 1;
    const emptyRow = new Array(tab.file.headers.length).fill("");
    this.applyEdit({ type: "addRow", rowIndex: insertIndex, row: emptyRow });
  }

  /** 行を削除する。 */
  deleteRow(rowIndex: number): void {
    const tab = this.activeTab;
    if (!tab || rowIndex < 0 || rowIndex >= tab.rows.length) return;
    this.applyEdit({
      type: "deleteRow",
      rowIndex,
      row: [...tab.rows[rowIndex]],
    });
  }

  /** 編集操作を適用し、Undo スタックに積む。 */
  applyEdit(op: EditOp): void {
    const tab = this.activeTab;
    if (!tab) return;

    applyOpToRows(tab.rows, op);
    tab.undoStack.push(op);
    tab.redoStack = [];
    tab.dirty = true;
    rebuildDirtyCells(tab);
    this.lastGridOp = { version: ++this.gridOpVersion, op };
  }

  /** 直前の操作を取り消す。 */
  undo(): EditOp | undefined {
    const tab = this.activeTab;
    if (!tab || tab.undoStack.length === 0) return undefined;

    const op = tab.undoStack.pop()!;
    const inverse = invertOp(op);
    applyOpToRows(tab.rows, inverse);
    tab.redoStack.push(op);
    tab.dirty = tab.undoStack.length > 0;
    rebuildDirtyCells(tab);
    this.lastGridOp = { version: ++this.gridOpVersion, op: inverse };
    return inverse;
  }

  /** 取り消した操作をやり直す。 */
  redo(): EditOp | undefined {
    const tab = this.activeTab;
    if (!tab || tab.redoStack.length === 0) return undefined;

    const op = tab.redoStack.pop()!;
    applyOpToRows(tab.rows, op);
    tab.undoStack.push(op);
    tab.dirty = true;
    rebuildDirtyCells(tab);
    this.lastGridOp = { version: ++this.gridOpVersion, op };
    return op;
  }

  /** アクティブタブを上書き保存する。 */
  async save(): Promise<void> {
    const tab = this.activeTab;
    if (!tab || !tab.dirty) return;

    // Svelte プロキシを剥がしてプレーンデータにしてから Tauri に渡す
    const headers = $state.snapshot(tab.file.headers);
    const rows = $state.snapshot(tab.rows);

    await saveFile(tab.file.path, headers, rows, tab.file.encoding);
    tab.file.rows = rows;
    tab.rows = [...rows];
    tab.file.row_count = rows.length;
    tab.dirty = false;
    tab.undoStack = [];
    tab.redoStack = [];
    tab.dirtyCells = new SvelteSet();
  }
}

export const tabStore = new TabStore();

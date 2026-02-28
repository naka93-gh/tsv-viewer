/** マルチタブ状態管理。編集モード・Undo/Redo・保存をサポートする。 */
import {
  closeFile,
  getAllRows,
  openFileDialog,
  openFileView,
  saveFile,
  saveFileDialog,
} from "$lib/commands";
import { toastStore } from "$lib/stores/toast.svelte";
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
  if (!tab.file || !tab.rows) return;

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
      for (let j = 0; j < colCount; j++) {
        dirty.add(`${i}:${j}`);
      }
    } else {
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

  /** ファイルを新タブで開く（閲覧モード）。同一パスが既に開かれていればそのタブをアクティブにする。 */
  async open(path: string, options?: { silent?: boolean }): Promise<void> {
    const existing = this.tabs.find((t) => t.fileMeta.path === path);
    if (existing) {
      this.activeTabId = existing.id;
      return;
    }

    try {
      const fileMeta = await openFileView(path);
      const id = generateId();
      this.tabs.push({
        id,
        fileMeta,
        file: null,
        rows: null,
        searchQuery: "",
        mode: "view",
        dirty: false,
        undoStack: [],
        redoStack: [],
        dirtyCells: new SvelteSet(),
      });
      this.activeTabId = id;
      if (!options?.silent) {
        const name = path.split("/").pop() ?? path;
        toastStore.success(`${name} を読み込みました`);
      }
    } catch (e) {
      toastStore.error(`ファイルを開けませんでした: ${e}`);
    }
  }

  /** 空の新規タブを作成する。 */
  createNew(): void {
    const id = generateId();
    this.tabs.push({
      id,
      fileMeta: {
        headers: ["Column1"],
        encoding: "UTF-8",
        path: "",
        row_count: 0,
        column_count: 1,
        line_ending: "LF",
      },
      file: {
        headers: ["Column1"],
        rows: [],
        encoding: "UTF-8",
        path: "",
        row_count: 0,
        column_count: 1,
        line_ending: "LF",
      },
      rows: [],
      searchQuery: "",
      mode: "edit",
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

  /** 次のタブをアクティブにする。末尾なら先頭に戻る。 */
  activateNext(): void {
    if (this.tabs.length <= 1) return;
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    this.activeTabId = this.tabs[(idx + 1) % this.tabs.length].id;
  }

  /** 前のタブをアクティブにする。先頭なら末尾に戻る。 */
  activatePrev(): void {
    if (this.tabs.length <= 1) return;
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    this.activeTabId =
      this.tabs[(idx - 1 + this.tabs.length) % this.tabs.length].id;
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

    // Rust キャッシュ解放
    if (tab.fileMeta.path) {
      closeFile(tab.fileMeta.path).catch(() => {});
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

  /** 閲覧/編集モードをトグルする。 */
  async toggleMode(): Promise<void> {
    const tab = this.activeTab;
    if (!tab) return;

    if (tab.mode === "view") {
      // view → edit: 全行取得
      if (!tab.fileMeta.path) return;
      try {
        const parsed = await getAllRows(tab.fileMeta.path);
        tab.file = parsed;
        tab.rows = [...parsed.rows];
        tab.mode = "edit";
      } catch (e) {
        toastStore.error(`編集モードへの切り替えに失敗しました: ${e}`);
      }
    } else {
      // edit → view: dirty 時は確認
      if (tab.dirty) {
        const confirmed = await ask(
          "未保存の変更があります。閲覧モードに戻ると変更は破棄されます。",
          {
            title: "確認",
            kind: "warning",
            okLabel: "破棄して閲覧モードへ",
            cancelLabel: "キャンセル",
          },
        );
        if (!confirmed) return;
      }
      tab.file = null;
      tab.rows = null;
      tab.mode = "view";
      tab.dirty = false;
      tab.undoStack = [];
      tab.redoStack = [];
      tab.dirtyCells = new SvelteSet();
    }
  }

  /** 行を追加する。 */
  addRow(rowIndex: number, position: "above" | "below"): void {
    const tab = this.activeTab;
    if (!tab || !tab.file) return;
    const insertIndex = position === "above" ? rowIndex : rowIndex + 1;
    const emptyRow = new Array(tab.file.headers.length).fill("");
    this.applyEdit({ type: "addRow", rowIndex: insertIndex, row: emptyRow });
  }

  /** 行を削除する。 */
  deleteRow(rowIndex: number): void {
    const tab = this.activeTab;
    if (!tab || !tab.rows || rowIndex < 0 || rowIndex >= tab.rows.length)
      return;
    this.applyEdit({
      type: "deleteRow",
      rowIndex,
      row: [...tab.rows[rowIndex]],
    });
  }

  /** 編集操作を適用し、Undo スタックに積む。 */
  applyEdit(op: EditOp): void {
    const tab = this.activeTab;
    if (!tab || !tab.rows) return;

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
    if (!tab || !tab.rows || tab.undoStack.length === 0) return undefined;

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
    if (!tab || !tab.rows || tab.redoStack.length === 0) return undefined;

    const op = tab.redoStack.pop()!;
    applyOpToRows(tab.rows, op);
    tab.undoStack.push(op);
    tab.dirty = true;
    rebuildDirtyCells(tab);
    this.lastGridOp = { version: ++this.gridOpVersion, op };
    return op;
  }

  /** 名前を付けて保存。ダイアログで選択されたパスに保存する。 */
  async saveAs(): Promise<void> {
    const tab = this.activeTab;
    if (!tab || !tab.file || !tab.rows) return;

    const newPath = await saveFileDialog(tab.fileMeta.path || undefined);
    if (!newPath) return;

    try {
      const oldPath = tab.fileMeta.path;
      const headers = $state.snapshot(tab.file.headers);
      const rows = $state.snapshot(tab.rows);

      await saveFile(
        newPath,
        headers,
        rows,
        tab.fileMeta.encoding,
        tab.fileMeta.line_ending,
      );

      // パスが変わった場合、旧キャッシュを解放
      // （save_file が新パスでキャッシュを作成済み）
      if (oldPath && oldPath !== newPath) {
        closeFile(oldPath).catch(() => {});
      }

      tab.fileMeta.path = newPath;
      tab.file.path = newPath;
      tab.file.rows = rows;
      tab.rows = [...rows];
      tab.fileMeta.row_count = rows.length;
      tab.file.row_count = rows.length;
      tab.dirty = false;
      tab.undoStack = [];
      tab.redoStack = [];
      tab.dirtyCells = new SvelteSet();
      const name = newPath.split("/").pop() ?? newPath;
      toastStore.success(`${name} に保存しました`);
    } catch (e) {
      toastStore.error(`保存に失敗しました: ${e}`);
    }
  }

  /** アクティブタブを上書き保存する。パスが未設定の場合は名前を付けて保存にフォールバック。 */
  async save(): Promise<void> {
    const tab = this.activeTab;
    if (!tab || !tab.dirty || !tab.file || !tab.rows) return;

    if (!tab.fileMeta.path) {
      return this.saveAs();
    }

    try {
      const headers = $state.snapshot(tab.file.headers);
      const rows = $state.snapshot(tab.rows);

      await saveFile(
        tab.fileMeta.path,
        headers,
        rows,
        tab.fileMeta.encoding,
        tab.fileMeta.line_ending,
      );
      tab.file.rows = rows;
      tab.rows = [...rows];
      tab.fileMeta.row_count = rows.length;
      tab.file.row_count = rows.length;
      tab.dirty = false;
      tab.undoStack = [];
      tab.redoStack = [];
      tab.dirtyCells = new SvelteSet();
      toastStore.success("保存しました");
    } catch (e) {
      toastStore.error(`保存に失敗しました: ${e}`);
    }
  }
}

export const tabStore = new TabStore();

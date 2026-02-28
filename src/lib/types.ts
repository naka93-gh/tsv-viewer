/**
 * Rust 側 open_file コマンドの戻り値。
 * TSV パース結果を表す。
 */
export interface ParsedFile {
  /** カラムヘッダー（1行目） */
  headers: string[];
  /** 行データ（各行は文字列の配列、ヘッダー行を除く） */
  rows: string[][];
  /** 検出された文字コード ("UTF-8", "Shift_JIS" など) */
  encoding: string;
  /** ファイルの絶対パス */
  path: string;
  /** 総行数（ヘッダー除く） */
  row_count: number;
  /** カラム数 */
  column_count: number;
  /** 改行コード ("LF" or "CRLF") */
  line_ending: string;
}

/** セル編集・行追加・行削除の操作を表す共用体型。Undo/Redo で使用。 */
export type EditOp =
  | {
      type: "cell";
      rowIndex: number;
      colIndex: number;
      oldValue: string;
      newValue: string;
    }
  | { type: "addRow"; rowIndex: number; row: string[] }
  | { type: "deleteRow"; rowIndex: number; row: string[] };

/** 閲覧モード用メタデータ。Rust 側で全行を保持し、ヘッダー等の情報のみ返す。 */
export interface FileMetadata {
  headers: string[];
  encoding: string;
  path: string;
  row_count: number;
  column_count: number;
  line_ending: string;
}

/** get_rows の戻り値 */
export interface RowsResult {
  rows: string[][];
  last_row: number;
}

/** AG Grid ソートモデルの1項目 */
export interface SortItem {
  colId: string;
  sort: "asc" | "desc";
}

/** AG Grid フィルタモデルの1項目 */
export interface FilterItem {
  filterType: string;
  type: string;
  filter: string;
}

/** トーストの種別 */
export type ToastType = "success" | "error" | "warning" | "info";

/** トースト1件の状態 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** 表示時間（ms）。0 = 手動で閉じるまで表示 */
  duration: number;
}

/** タブ1つ分の状態。ファイル・編集状態・Undo 履歴を保持する。 */
export interface TabState {
  id: string;
  /** 常に存在するメタ情報 */
  fileMeta: FileMetadata;
  /** 編集モード時のみ: 原本データ */
  file: ParsedFile | null;
  /** 編集モード時のみ: 作業用行データ */
  rows: string[][] | null;
  searchQuery: string;
  mode: "view" | "edit";
  dirty: boolean;
  undoStack: EditOp[];
  redoStack: EditOp[];
  /** 未保存の変更があるセル。キーは "rowIndex:colIndex" 形式。 */
  dirtyCells: Set<string>;
}

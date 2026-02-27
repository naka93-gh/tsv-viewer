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

/** タブ1つ分の状態。ファイル・編集状態・Undo 履歴を保持する。 */
export interface TabState {
  id: string;
  file: ParsedFile;
  rows: string[][];
  searchQuery: string;
  mode: "view" | "edit";
  dirty: boolean;
  undoStack: EditOp[];
  redoStack: EditOp[];
  /** 未保存の変更があるセル。キーは "rowIndex:colIndex" 形式。 */
  dirtyCells: Set<string>;
}

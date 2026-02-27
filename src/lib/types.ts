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

/** タブ1つ分の状態。ファイルと検索クエリを保持する。 */
export interface TabState {
  id: string;
  file: ParsedFile;
  searchQuery: string;
}

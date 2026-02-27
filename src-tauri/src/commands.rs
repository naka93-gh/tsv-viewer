use crate::encoding;
use crate::parser::{self, ParsedFile};
use std::fs;

/// ファイルを読み込み、文字コード判定・TSV パースを行って返す。
///
/// フロントエンドから invoke("open_file", { path }) で呼び出される。
/// 処理フロー: ファイル読込 → 文字コード判定・デコード → TSV パース
#[tauri::command]
pub fn open_file(path: String) -> Result<ParsedFile, String> {
    let bytes = fs::read(&path).map_err(|e| format!("ファイルの読み込みに失敗: {e}"))?;
    let (text, enc) = encoding::detect_and_decode(&bytes);
    parser::parse_tsv(&text, &path, &enc)
}

use crate::encoding;
use crate::parser::{self, ParsedFile};
use std::fs;

/// ファイルを読み込み、文字コード判定・TSV パースを行って返す。
#[tauri::command]
pub fn open_file(path: String) -> Result<ParsedFile, String> {
    let bytes = fs::read(&path).map_err(|e| format!("ファイルの読み込みに失敗: {e}"))?;
    let (text, enc) = encoding::detect_and_decode(&bytes);
    parser::parse_tsv(&text, &path, &enc)
}

/// ヘッダーと行データを TSV 形式で指定パスに保存する。
/// 元の文字コードを維持して書き出す。
#[tauri::command]
pub fn save_file(
    path: String,
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    encoding: String,
) -> Result<(), String> {
    let mut lines: Vec<String> = Vec::with_capacity(rows.len() + 1);
    lines.push(headers.join("\t"));
    for row in &rows {
        lines.push(row.join("\t"));
    }
    let text = lines.join("\n");

    let bytes = encoding::encode(&text, &encoding)?;
    fs::write(&path, bytes).map_err(|e| format!("ファイルの保存に失敗: {e}"))
}

use serde::{Deserialize, Serialize};

/// TSV ファイルのパース結果。フロントエンドに JSON として返される。
#[derive(Debug, Serialize, Deserialize)]
pub struct ParsedFile {
    /// カラムヘッダー（1行目）
    pub headers: Vec<String>,
    /// 行データ（各行は文字列の配列、ヘッダー行を除く）
    pub rows: Vec<Vec<String>>,
    /// 検出された文字コード ("UTF-8", "Shift_JIS" など)
    pub encoding: String,
    /// ファイルの絶対パス
    pub path: String,
    /// 総行数（ヘッダー除く）
    pub row_count: usize,
    /// カラム数
    pub column_count: usize,
}

/// TSV テキストをパースして ParsedFile を返す。
///
/// csv クレートをタブ区切りモードで使用。
/// flexible(true) により、カラム数が行ごとに異なっていてもエラーにしない。
pub fn parse_tsv(text: &str, path: &str, encoding: &str) -> Result<ParsedFile, String> {
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .has_headers(true)
        .flexible(true)
        .from_reader(text.as_bytes());

    // 1行目をヘッダーとして取得
    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| format!("ヘッダーの読み取りに失敗: {e}"))?
        .iter()
        .map(|h| h.to_string())
        .collect();

    let column_count = headers.len();

    // 2行目以降をデータ行として収集
    let mut rows: Vec<Vec<String>> = Vec::new();
    for result in reader.records() {
        let record = result.map_err(|e| format!("行の読み取りに失敗: {e}"))?;
        let row: Vec<String> = record.iter().map(|f| f.to_string()).collect();
        rows.push(row);
    }

    let row_count = rows.len();

    Ok(ParsedFile {
        headers,
        rows,
        encoding: encoding.to_string(),
        path: path.to_string(),
        row_count,
        column_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_basic_tsv() {
        let text = "名前\t年齢\t都市\n田中\t30\t東京\n鈴木\t25\t大阪";
        let result = parse_tsv(text, "/test.tsv", "UTF-8").unwrap();
        assert_eq!(result.headers, vec!["名前", "年齢", "都市"]);
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.row_count, 2);
        assert_eq!(result.column_count, 3);
        assert_eq!(result.rows[0], vec!["田中", "30", "東京"]);
    }
}

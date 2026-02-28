use chardetng::EncodingDetector;

/// バイト列から文字コードを自動判定し、UTF-8 文字列にデコードする。
///
/// 戻り値: (デコード済みテキスト, 検出されたエンコーディング名)
pub fn detect_and_decode(bytes: &[u8]) -> (String, String) {
    // BOM (Byte Order Mark) 付き UTF-8 は BOM を除去してそのまま返す
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        let text = String::from_utf8_lossy(&bytes[3..]).into_owned();
        return (text, "UTF-8".to_string());
    }

    // chardetng でバイト列全体を解析し、最も確からしいエンコーディングを推定
    let mut detector = EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);

    // encoding_rs で推定エンコーディングから UTF-8 にデコード
    let (decoded, _, _) = encoding.decode(bytes);
    let encoding_name = encoding.name().to_string();

    (decoded.into_owned(), encoding_name)
}

/// テキストの改行コードを検出する。CRLF を含めば "CRLF"、そうでなければ "LF"。
pub fn detect_line_ending(text: &str) -> &'static str {
    if text.contains("\r\n") {
        "CRLF"
    } else {
        "LF"
    }
}

/// UTF-8 テキストを指定エンコーディングにエンコードしてバイト列を返す。
pub fn encode(text: &str, encoding_name: &str) -> Result<Vec<u8>, String> {
    let encoding = encoding_rs::Encoding::for_label(encoding_name.as_bytes())
        .ok_or_else(|| format!("未対応のエンコーディング: {encoding_name}"))?;

    // UTF-8 はそのまま返す
    if encoding == encoding_rs::UTF_8 {
        return Ok(text.as_bytes().to_vec());
    }

    let (encoded, _, had_errors) = encoding.encode(text);
    if had_errors {
        return Err(format!(
            "{encoding_name} でエンコードできない文字が含まれています"
        ));
    }
    Ok(encoded.into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_utf8() {
        let bytes = "ヘッダ1\tヘッダ2\n値1\t値2".as_bytes();
        let (text, enc) = detect_and_decode(bytes);
        assert_eq!(enc, "UTF-8");
        assert!(text.contains("ヘッダ1"));
    }

    #[test]
    fn decode_utf8_bom() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("hello\tworld".as_bytes());
        let (text, enc) = detect_and_decode(&bytes);
        assert_eq!(enc, "UTF-8");
        assert_eq!(text, "hello\tworld");
    }

    #[test]
    fn encode_utf8() {
        let result = encode("hello\tworld", "UTF-8").unwrap();
        assert_eq!(result, b"hello\tworld");
    }

    #[test]
    fn encode_shift_jis() {
        let result = encode("あ", "Shift_JIS").unwrap();
        assert_eq!(result, vec![0x82, 0xA0]);
    }

    #[test]
    fn encode_unknown_encoding() {
        let result = encode("test", "UNKNOWN-999");
        assert!(result.is_err());
    }

    #[test]
    fn detect_lf() {
        assert_eq!(detect_line_ending("a\nb\nc"), "LF");
    }

    #[test]
    fn detect_crlf() {
        assert_eq!(detect_line_ending("a\r\nb\r\nc"), "CRLF");
    }

    #[test]
    fn detect_empty() {
        assert_eq!(detect_line_ending("no newline"), "LF");
    }
}

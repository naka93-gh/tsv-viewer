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
}

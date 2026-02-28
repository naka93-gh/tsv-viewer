/** キーボードショートカットの登録・ディスパッチを管理する */

type ShortcutHandler = () => void;

/** KeyboardEvent を正規化されたコンボ文字列に変換する。Mod は Ctrl/Cmd を吸収。 */
export function toCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Mod");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  // 1文字キーは小文字に正規化し、Shift は修飾キー部分で判定する
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  parts.push(key);
  return parts.join("+");
}

export interface ShortcutManager {
  register(combo: string, handler: ShortcutHandler): void;
  handle(e: KeyboardEvent): void;
}

/** ショートカットマネージャーを生成する */
export function createShortcutManager(): ShortcutManager {
  const map = new Map<string, ShortcutHandler>();

  return {
    register(combo, handler) {
      map.set(combo, handler);
    },
    handle(e) {
      const combo = toCombo(e);
      const handler = map.get(combo);
      if (handler) {
        e.preventDefault();
        handler();
      }
    },
  };
}

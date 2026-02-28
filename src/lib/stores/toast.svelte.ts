/** トースト通知とダイアログの管理 */
import type { Toast, ToastType } from "$lib/types";
import { message } from "@tauri-apps/plugin-dialog";

const MAX_TOASTS = 5;

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 0,
};

class ToastStore {
  toasts = $state<Toast[]>([]);

  /** トーストを追加し、ID を返す */
  add(type: ToastType, msg: string, duration?: number): string {
    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      type,
      message: msg,
      duration: duration ?? DEFAULT_DURATION[type],
    };

    this.toasts.push(toast);

    // 最大件数を超えたら古いものから削除
    while (this.toasts.length > MAX_TOASTS) {
      this.toasts.shift();
    }

    // 自動消去
    if (toast.duration > 0) {
      setTimeout(() => this.remove(id), toast.duration);
    }

    return id;
  }

  /** 指定 ID のトーストを削除する */
  remove(id: string): void {
    const index = this.toasts.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.toasts.splice(index, 1);
    }
  }

  success(msg: string): string {
    return this.add("success", msg);
  }

  error(msg: string): string {
    return this.add("error", msg);
  }

  warning(msg: string): string {
    return this.add("warning", msg);
  }

  info(msg: string): string {
    return this.add("info", msg);
  }
}

export const toastStore = new ToastStore();

/** 致命的エラー用のダイアログを表示する */
export async function showErrorDialog(
  title: string,
  msg: string,
): Promise<void> {
  await message(msg, { title, kind: "error" });
}

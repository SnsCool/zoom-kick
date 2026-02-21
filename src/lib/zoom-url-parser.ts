// src/lib/zoom-url-parser.ts

/**
 * Zoom URLまたはID文字列を解析し、標準化されたIDを返す
 *
 * @param input - Zoom URL、会議ID (数字のみ)、またはハイフン付きIDの文字列
 * @returns 解析結果。成功時は { webinarId: string }、失敗時は { webinarId: null, error: string }
 */
export function parseZoomUrl(
  input: string
): { webinarId: string | null; error?: string } {
  if (!input || input.trim().length === 0) {
    return { webinarId: null, error: '入力が空です' };
  }

  const trimmed = input.trim();

  // URL形式かどうかを先にチェック（try-catch に頼らない）
  if (/^https?:\/\//.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { webinarId: null, error: '無効なURL形式です' };
    }

    // Zoom ドメインかチェック（evilzoom.us 等を排除）
    if (url.hostname !== 'zoom.us' && !url.hostname.endsWith('.zoom.us')) {
      return { webinarId: null, error: 'Zoom以外のURLです' };
    }

    // URLパスからID部分を抽出
    // /j/ID (ミーティング), /w/ID (ウェビナー), /wc/join/ID (参加リンク)
    const zoomPathRegex = /^\/?(?:j|w|wc\/join)\/?(\d{9,11})/;
    const match = url.pathname.match(zoomPathRegex);

    if (match && match[1]) {
      return { webinarId: match[1] };
    }

    return { webinarId: null, error: 'URLからZoom IDを検出できませんでした' };
  }

  // URLではない場合、生のIDとして処理（ハイフン除去）
  const normalizedId = trimmed.replace(/-/g, '');
  if (isValidZoomId(normalizedId)) {
    return { webinarId: normalizedId };
  }

  return { webinarId: null, error: '有効なZoom IDまたはURLではありません' };
}

/**
 * Zoom IDとして有効かどうかを簡易チェック（9〜11桁の数字）
 */
export function isValidZoomId(id: string): boolean {
  return /^\d{9,11}$/.test(id);
}

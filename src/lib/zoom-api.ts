// src/lib/zoom-api.ts - Zoom Server-to-Server OAuth + REST API クライアント

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Server-to-Server OAuth でアクセストークンを取得（キャッシュ付き）
 */
export async function getAccessToken(): Promise<string> {
  // キャッシュが有効ならそのまま返す（有効期限の5分前にリフレッシュ）
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('[ZoomAPI] ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET が未設定');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${accountId}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[ZoomAPI] Token取得失敗: ${response.status} ${errorText}`);
  }

  const data: TokenResponse = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  console.log('[ZoomAPI] アクセストークン取得成功');
  return cachedToken;
}

/**
 * Zoom REST API を呼び出す汎用関数
 */
async function zoomApiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const token = await getAccessToken();
  const url = `https://api.zoom.us/v2${path}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return response;
}

/**
 * ウェビナーのチャットメッセージを削除
 */
export async function deleteChatMessage(
  meetingId: string,
  messageId: string
): Promise<boolean> {
  try {
    // ウェビナー用エンドポイント
    let response = await zoomApiRequest(
      'DELETE',
      `/live_meetings/${meetingId}/chat/messages/${messageId}`
    );

    if (response.status === 404) {
      // フォールバック: 別エンドポイント
      response = await zoomApiRequest(
        'DELETE',
        `/live_webinars/${meetingId}/chat/messages/${messageId}`
      );
    }

    if (response.ok || response.status === 204) {
      console.log(`[ZoomAPI] メッセージ削除成功: ${messageId}`);
      return true;
    }

    const errorText = await response.text();
    console.error(`[ZoomAPI] メッセージ削除失敗: ${response.status} ${errorText}`);
    return false;
  } catch (error) {
    console.error('[ZoomAPI] メッセージ削除エラー:', error);
    return false;
  }
}

/**
 * ウェビナーから参加者を退出させる
 */
export async function removeParticipant(
  meetingId: string,
  participantId: string
): Promise<boolean> {
  try {
    let response = await zoomApiRequest(
      'PUT',
      `/live_meetings/${meetingId}/participants/${participantId}/status`,
      { action: 'remove' }
    );

    if (response.status === 404) {
      response = await zoomApiRequest(
        'PUT',
        `/live_webinars/${meetingId}/participants/${participantId}/status`,
        { action: 'remove' }
      );
    }

    if (response.ok || response.status === 204) {
      console.log(`[ZoomAPI] 参加者退出成功: ${participantId}`);
      return true;
    }

    const errorText = await response.text();
    console.error(`[ZoomAPI] 参加者退出失敗: ${response.status} ${errorText}`);
    return false;
  } catch (error) {
    console.error('[ZoomAPI] 参加者退出エラー:', error);
    return false;
  }
}

/**
 * ウェビナーの参加者リストを取得
 */
export async function getParticipants(
  meetingId: string
): Promise<Array<{ id: string; user_name: string; email: string }>> {
  try {
    let response = await zoomApiRequest(
      'GET',
      `/live_meetings/${meetingId}/participants`
    );

    if (response.status === 404) {
      response = await zoomApiRequest(
        'GET',
        `/webinars/${meetingId}/participants`
      );
    }

    if (!response.ok) {
      console.error(`[ZoomAPI] 参加者取得失敗: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.participants || [];
  } catch (error) {
    console.error('[ZoomAPI] 参加者取得エラー:', error);
    return [];
  }
}

/**
 * トークンキャッシュをクリア（テスト・リセット用）
 */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

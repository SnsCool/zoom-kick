// src/lib/zoom-websocket.ts - Zoom WebSocket クライアント（リアルタイムイベント受信）

import WebSocket from 'ws';
import { getAccessToken } from './zoom-api';

export interface ZoomChatEvent {
  event: string;
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      participant: {
        user_id: string;
        user_name: string;
        id: string;
        email: string;
      };
      message?: {
        id: string;
        message: string;
        sender: string;
        date_time: string;
        type: string;
      };
      // 直接メッセージが来るパターン
      message_content?: string;
    };
  };
}

export interface ZoomParticipantEvent {
  event: string;
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      participant: {
        user_id: string;
        user_name: string;
        id: string;
        email: string;
        join_time?: string;
      };
    };
  };
}

type ChatMessageHandler = (event: ZoomChatEvent) => void;
type ParticipantHandler = (event: ZoomParticipantEvent) => void;

export class ZoomWebSocketClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private shouldReconnect = true;

  private onChatMessage: ChatMessageHandler | null = null;
  private onParticipantJoined: ParticipantHandler | null = null;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  /**
   * WebSocket に接続（OAuth トークンをURLパラメータで渡して認証）
   */
  async connect(): Promise<void> {
    // トークン取得
    const token = await getAccessToken();
    const separator = this.wsUrl.includes('?') ? '&' : '?';
    const authedUrl = `${this.wsUrl}${separator}access_token=${token}`;

    return new Promise((resolve, reject) => {
      let settled = false;

      try {
        console.log('[ZoomWS] 接続中...');
        this.ws = new WebSocket(authedUrl);

        this.ws.on('open', () => {
          console.log('[ZoomWS] TCP接続成功、認証待ち...');
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          // 最初の build_connection メッセージで resolve/reject
          if (!settled) {
            try {
              const parsed = JSON.parse(data.toString());
              if (parsed.module === 'build_connection') {
                settled = true;
                if (parsed.success === true) {
                  resolve();
                } else {
                  reject(new Error(`WebSocket認証失敗: ${parsed.content}`));
                  return;
                }
              }
            } catch { /* handleMessage で処理 */ }
          }
          this.handleMessage(data);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          console.log(`[ZoomWS] 接続切断: ${code} ${reason.toString()}`);
          this.isConnected = false;
          this.stopHeartbeat();

          if (!settled) {
            settled = true;
            reject(new Error(`WebSocket切断: ${code}`));
          }

          if (this.shouldReconnect) {
            this.attemptReconnect();
          }
        });

        this.ws.on('error', (error: Error) => {
          console.error('[ZoomWS] エラー:', error.message);
          if (!settled) {
            settled = true;
            reject(error);
          }
        });

        this.ws.on('ping', () => {
          this.ws?.pong();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 切断
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    console.log('[ZoomWS] 切断完了');
  }

  /**
   * チャットメッセージハンドラを登録
   */
  onChat(handler: ChatMessageHandler): void {
    this.onChatMessage = handler;
  }

  /**
   * 参加者参加ハンドラを登録
   */
  onParticipant(handler: ParticipantHandler): void {
    this.onParticipantJoined = handler;
  }

  /**
   * 接続状態を取得
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const raw = data.toString();
      let parsed: Record<string, unknown>;

      try {
        parsed = JSON.parse(raw);
      } catch {
        console.log('[ZoomWS] 非JSONメッセージ:', raw.substring(0, 200));
        return;
      }

      // Zoom WebSocket のメッセージフォーマット
      // パターン1: { module: "message", content: "{...}" }
      // パターン2: { event: "...", payload: {...} }
      // パターン3: { module: "heartbeat" }

      // 接続確認メッセージ
      if (parsed.module === 'build_connection') {
        if (parsed.success === true) {
          console.log('[ZoomWS] 認証成功 - イベント受信待機中');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
        } else {
          console.error('[ZoomWS] 認証失敗:', parsed.content);
        }
        return;
      }

      if (parsed.module === 'heartbeat') {
        this.ws?.send(JSON.stringify({ module: 'heartbeat' }));
        return;
      }

      let event: Record<string, unknown>;

      if (parsed.module === 'message' && typeof parsed.content === 'string') {
        // content が JSON 文字列の場合
        event = JSON.parse(parsed.content);
      } else if (parsed.module === 'message' && typeof parsed.content === 'object') {
        // content がオブジェクトの場合
        event = parsed.content as Record<string, unknown>;
      } else if (parsed.event) {
        // 直接イベント形式
        event = parsed;
      } else {
        console.log('[ZoomWS] 未知のメッセージ形式:', JSON.stringify(parsed).substring(0, 300));
        return;
      }

      const eventType = event.event as string;

      if (!eventType) {
        console.log('[ZoomWS] イベントタイプなし:', JSON.stringify(event).substring(0, 300));
        return;
      }

      console.log(`[ZoomWS] イベント受信: ${eventType}`);

      // チャットメッセージイベント
      if (
        eventType.includes('chat_message') ||
        eventType.includes('chat.message')
      ) {
        if (this.onChatMessage) {
          this.onChatMessage(event as unknown as ZoomChatEvent);
        }
        return;
      }

      // 参加者参加イベント
      if (
        eventType.includes('participant_joined') ||
        eventType.includes('participant.joined')
      ) {
        if (this.onParticipantJoined) {
          this.onParticipantJoined(event as unknown as ZoomParticipantEvent);
        }
        return;
      }

    } catch (error) {
      console.error('[ZoomWS] メッセージ処理エラー:', error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.send(JSON.stringify({ module: 'heartbeat' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ZoomWS] 最大再接続回数に達しました');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[ZoomWS] ${delay}ms 後に再接続 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('[ZoomWS] 再接続失敗:', error);
      }
    }, delay);
  }
}

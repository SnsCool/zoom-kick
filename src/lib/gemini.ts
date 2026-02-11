import { ModerationResult } from '@/types';

// 型定義
interface GeminiPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiPart[];
}

interface GeminiGenerationConfig {
  temperature: number;
  maxOutputTokens: number;
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  generationConfig: GeminiGenerationConfig;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code: number;
    message: string;
  };
}

export async function moderateWithAI(
  message: string,
  username: string,
  context: string[]
): Promise<ModerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[AI] API Key is missing');
    return { score: 0.0, category: 'clean', reason: 'AI設定エラー' };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const prompt = `あなたはZoomウェビナーのチャットモデレーターです。
以下のメッセージを分析し、JSON形式のみで判定結果を返してください。
余計な説明は不要です。JSONのみ返答してください。

判定基準:
- 誹謗中傷、罵倒、人格攻撃 → hate (0.8〜1.0)
- スパム、宣伝、無関係なURL → spam (0.8〜1.0)
- 荒らし行為（同じ内容の連投、意味不明な文字列の連投）→ troll (0.7〜0.9)
- 文脈を考慮した嫌がらせ（皮肉、当てこすり、嘲笑）→ harassment (0.5〜0.8)
- 問題なし → clean (0.0〜0.3)

注意:
- 日本語のスラングや略語にも対応すること
- 「w」「草」などの笑い表現自体は問題なし
- 単なる批判や意見と、誹謗中傷は区別すること
- 文脈 (context) を考慮して判定すること

メッセージ: "${message}"
送信者: "${username}"
直近のチャット文脈: ${JSON.stringify(context)}

JSON形式:
{"score": 0.0〜1.0, "category": "clean|hate|spam|harassment|troll", "reason": "判定理由を日本語で簡潔に"}`;

  const requestBody: GeminiRequestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
  };

  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // 429 Too Many Requests の場合
      if (response.status === 429) {
        if (retries < maxRetries) {
          console.log(`[AI] Rate limit hit (429), waiting 1s... Retry ${retries + 1}/${maxRetries}`);
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } else {
          console.warn('[AI] Max retries reached for 429.');
          return { score: 0.0, category: 'clean', reason: 'APIリクエスト上限超過' };
        }
      }

      if (!response.ok) {
        console.error(`[AI] API Error: ${response.status} ${response.statusText}`);
        return { score: 0.0, category: 'clean', reason: 'AI判定エラー' };
      }

      const data: GeminiResponse = await response.json();
      
      if (data.error) {
        console.error(`[AI] API Logic Error: ${data.error.message}`);
        return { score: 0.0, category: 'clean', reason: 'AI判定エラー' };
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[AI] Raw response:', rawText);

      // JSON抽出 (JSONマーカーで囲まれている前提だが、全体がJSONの場合もあるため正規表現で抽出)
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error('[AI] JSON parse failed: No JSON object found in response.');
        return { score: 0.0, category: 'clean', reason: 'AI判定エラー' };
      }

      const jsonStr = match[0];
      const result = JSON.parse(jsonStr);

      // バリデーション（簡易）
      if (typeof result.score === 'number' && result.category && result.reason) {
        return {
          score: result.score,
          category: result.category,
          reason: result.reason
        };
      } else {
        console.error('[AI] Invalid JSON structure:', result);
        return { score: 0.0, category: 'clean', reason: 'AI判定エラー' };
      }

    } catch (error) {
      console.error('[AI] Fetch or parsing error:', error);
      return { score: 0.0, category: 'clean', reason: 'AI判定エラー' };
    }
  }

  return { score: 0.0, category: 'clean', reason: 'AI判定エラー' };
}

import { NextResponse } from 'next/server'
import { isMockMode, mockStore } from '@/lib/mock-data'
import { supabaseAdmin } from '@/lib/supabase'
import { ZoomModBot } from '@/bot/worker'
import { getBotInstance, setBotInstance } from '@/bot/instance'
import { BotConfig, NgWord, BannedUser } from '@/types'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { webinarId, webinarName } = body

    if (!webinarId || !webinarName) {
      return NextResponse.json({ error: 'webinarId and webinarName are required' }, { status: 400 })
    }

    // モックモード: Puppeteer/Zoom不要でBotをシミュレーション
    if (isMockMode()) {
      const result = mockStore.startBot(webinarId, webinarName)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      console.log(`[Mock] Bot started for webinar: ${webinarId} (${webinarName})`)
      return NextResponse.json(
        { status: 'started', message: '[Mock] Bot起動を開始しました' },
        { status: 200 }
      )
    }

    // 1. 既存のBotインスタンスが実行中ならエラー
    if (getBotInstance()) {
      return NextResponse.json({ error: 'Bot is already running' }, { status: 400 })
    }

    // 2. Supabaseから ng_words テーブルの全データを取得
    const { data: ngWordsData, error: ngWordsError } = await supabaseAdmin
      .from('ng_words')
      .select('*')

    if (ngWordsError) {
      console.error('Failed to fetch ng_words:', ngWordsError)
      throw new Error('Failed to fetch ng_words')
    }

    // 3. Supabaseから blacklist テーブルの is_active=true のデータを取得
    const { data: bannedUsersData, error: bannedUsersError } = await supabaseAdmin
      .from('blacklist')
      .select('*')
      .eq('is_active', true)

    if (bannedUsersError) {
      console.error('Failed to fetch blacklist:', bannedUsersError)
      throw new Error('Failed to fetch blacklist')
    }

    // 4. Supabaseから bot_settings テーブルの設定を取得（Key-Value形式）
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('bot_settings')
      .select('key, value')

    if (settingsError) {
      console.error('Failed to fetch bot_settings:', settingsError)
      throw new Error('Failed to fetch bot_settings')
    }

    // Key-Value → オブジェクトに変換
    const settings: Record<string, { value: number | boolean }> = {}
    for (const row of settingsData || []) {
      settings[row.key] = row.value
    }

    // 5. BotConfig を組み立て
    const config: BotConfig = {
      webinarId,
      webinarName,
      aiThreshold: settings.ai_threshold?.value as number ?? 0.7,
      autoDelete: settings.auto_delete?.value as boolean ?? true,
      autoKick: settings.auto_kick?.value as boolean ?? true,
      blockReentry: settings.block_reentry?.value as boolean ?? true,
      sheetsSync: settings.sheets_sync?.value as boolean ?? true,
      ngWords: (ngWordsData as NgWord[]) || [],
      bannedUsers: (bannedUsersData as BannedUser[]) || [],
    }

    // 6. ZoomModBot インスタンスを作成
    const bot = new ZoomModBot(config)

    // 7. setBotInstance() で保存
    setBotInstance(bot)

    // 8. bot.start() を await せずバックグラウンド実行
    void bot.start().catch((err) => {
      console.error('Bot execution failed:', err)
      setBotInstance(null)
    })

    // 9. 現在のウェビナー情報を bot_settings に保存（Key-Value形式）
    const { error: updateError } = await supabaseAdmin
      .from('bot_settings')
      .upsert(
        { key: 'current_webinar', value: { webinar_id: webinarId, webinar_name: webinarName } },
        { onConflict: 'key' }
      )

    if (updateError) {
      console.error('Failed to update bot_settings:', updateError)
    }

    // 10. 200 レスポンス
    return NextResponse.json(
      { status: 'started', message: 'Bot起動を開始しました' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error in /api/bot/start:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

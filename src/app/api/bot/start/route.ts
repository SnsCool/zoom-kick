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

    // 4. Supabaseから bot_settings テーブルの設定を取得
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('bot_settings')
      .select('*')
      .limit(1)
      .single()

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Failed to fetch bot_settings:', settingsError)
      throw new Error('Failed to fetch bot_settings')
    }

    const settings = settingsData

    // 5. BotConfig を組み立て
    const config: BotConfig = {
      zoomEmail: process.env.ZOOM_EMAIL || '',
      zoomPassword: process.env.ZOOM_PASSWORD || '',
      webinarId,
      webinarName,
      aiThreshold: settings?.ai_threshold ?? 0.7,
      autoDelete: settings?.auto_delete ?? true,
      autoKick: settings?.auto_kick ?? true,
      blockReentry: settings?.block_reentry ?? true,
      sheetsSync: settings?.sheets_sync ?? true,
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

    // 9. webinar 設定を bot_settings に保存
    const { error: updateError } = await supabaseAdmin
      .from('bot_settings')
      .update({ current_webinar_id: webinarId, current_webinar_name: webinarName })
      .neq('id', 0)

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

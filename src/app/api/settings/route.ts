import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isMockMode, mockStore } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({ settings: mockStore.getSettings() }, { status: 200 })
  }

  try {
    const { data, error } = await supabaseAdmin.from('bot_settings').select('*')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 設定をキーと値のオブジェクトに変換
    const transformedData: Record<string, unknown> = {}
    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (item.key) {
          transformedData[item.key] = item.value
        }
      })
    }

    return NextResponse.json({ settings: transformedData }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (isMockMode()) {
      mockStore.updateSetting(key, value)
      return NextResponse.json({ message: '設定を更新しました' }, { status: 200 })
    }

    const { error } = await supabaseAdmin
      .from('bot_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: '設定を更新しました' }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isMockMode, mockStore } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({ blacklist: mockStore.getBlacklist() }, { status: 200 })
  }

  const { data, error } = await supabaseAdmin
    .from('blacklist')
    .select('*')
    .order('banned_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ blacklist: data }, { status: 200 })
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    zoom_username,
    zoom_email,
    reason,
    ban_type,
    expires_at,
    webinar_id,
    webinar_name,
  } = body

  if (!zoom_username || !reason) {
    return NextResponse.json(
      { error: 'zoom_username と reason は必須です' },
      { status: 400 }
    )
  }

  if (isMockMode()) {
    const entry = mockStore.addBlacklist({
      zoom_username,
      zoom_email: zoom_email || null,
      reason,
      ban_type: ban_type || 'permanent',
      expires_at: expires_at || null,
      webinar_id: webinar_id || null,
      webinar_name: webinar_name || null,
    })
    return NextResponse.json({ entry }, { status: 201 })
  }

  const { data, error } = await supabaseAdmin
    .from('blacklist')
    .insert({
      zoom_username,
      zoom_email: zoom_email || null,
      reason,
      ban_type: ban_type || 'permanent',
      expires_at: expires_at || null,
      webinar_id: webinar_id || null,
      webinar_name: webinar_name || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const body = await request.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'id は必須です' }, { status: 400 })
  }

  if (isMockMode()) {
    mockStore.deactivateBlacklist(id)
    return NextResponse.json({ message: 'BAN解除しました' }, { status: 200 })
  }

  const { error } = await supabaseAdmin
    .from('blacklist')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'BAN解除しました' }, { status: 200 })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const { id, ban_type, expires_at } = body

  if (!id || !ban_type) {
    return NextResponse.json(
      { error: 'id と ban_type は必須です' },
      { status: 400 }
    )
  }

  if (isMockMode()) {
    mockStore.updateBlacklist(id, { ban_type, expires_at: expires_at || null })
    return NextResponse.json({ message: '更新しました' }, { status: 200 })
  }

  const { error } = await supabaseAdmin
    .from('blacklist')
    .update({ ban_type, expires_at: expires_at || null })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: '更新しました' }, { status: 200 })
}

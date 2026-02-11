'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Stats = {
  processed: number
  banned: number
  deleted: number
  passed: number
}

type BotStatus = {
  is_running: boolean
  webinar_id: string | null
  started_at: string | null
}

type Log = {
  id: number
  created_at: string
  username: string
  message: string
  action: 'kicked' | 'deleted' | 'passed' | 're-blocked' | string
  method: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ processed: 0, banned: 0, deleted: 0, passed: 0 })
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [logs, setLogs] = useState<Log[]>([])

  // 統計データの取得
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/logs')
      if (res.ok) {
        const data = await res.json()
        // APIの仕様に合わせて調整が必要ですが、ここでは仮の構造とします
        setStats({
          processed: data.total || 0,
          banned: data.banned || 0,
          deleted: data.deleted || 0,
          passed: data.passed || 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  // Botステータスの取得
  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot/status')
      if (res.ok) {
        const data = await res.json()
        setBotStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch bot status:', error)
    }
  }

  // 初期ログの取得（最新10件）
  const fetchInitialLogs = async () => {
    try {
      const res = await fetch('/api/logs?limit=10')
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  useEffect(() => {
    // 初期データロード
    fetchStats()
    fetchBotStatus()
    fetchInitialLogs()

    // Botステータスのポーリング（10秒間隔）
    const statusInterval = setInterval(fetchBotStatus, 10000)

    // Supabase Realtime の設定
    const channel = supabase
      .channel('public:mod_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mod_logs',
        },
        (payload) => {
          const newLog = payload.new as Log
          setLogs((prev) => [newLog, ...prev].slice(0, 10))
          
          // 統計もリアルタイムに更新
          setStats((prev) => {
            const newStats = { ...prev, processed: prev.processed + 1 }
            if (newLog.action === 'kicked') newStats.banned += 1
            if (newLog.action === 'deleted') newStats.deleted += 1
            if (newLog.action === 'passed') newStats.passed += 1
            return newStats
          })
        }
      )
      .subscribe()

    return () => {
      clearInterval(statusInterval)
      supabase.removeChannel(channel)
    }
  }, [])

  const getActionColor = (action: string) => {
    switch (action) {
      case 'kicked': return 'text-red-400'
      case 'deleted': return 'text-yellow-400'
      case 'passed': return 'text-green-400'
      case 're-blocked': return 'text-purple-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-black text-white">
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] rounded-lg p-4 border border-gray-800">
          <div className="text-gray-400 text-sm">処理済みメッセージ数</div>
          <div className="text-2xl font-bold text-white">{stats.processed}</div>
        </div>
        <div className="bg-red-900/50 rounded-lg p-4 border border-red-800">
          <div className="text-red-200 text-sm">BAN件数</div>
          <div className="text-2xl font-bold text-white">{stats.banned}</div>
        </div>
        <div className="bg-yellow-900/50 rounded-lg p-4 border border-yellow-800">
          <div className="text-yellow-200 text-sm">削除件数</div>
          <div className="text-2xl font-bold text-white">{stats.deleted}</div>
        </div>
        <div className="bg-green-900/50 rounded-lg p-4 border border-green-800">
          <div className="text-green-200 text-sm">パス件数</div>
          <div className="text-2xl font-bold text-white">{stats.passed}</div>
        </div>
      </div>

      {/* Bot状態カード */}
      <div className="bg-[#111827] rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-bold mb-4 text-white">Bot 状態</h2>
        {botStatus ? (
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${botStatus.is_running ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
              <span className="text-white font-medium">
                {botStatus.is_running ? '稼働中' : '停止中'}
              </span>
            </div>
            <div className="text-gray-300">
              <span className="text-gray-500">ウェビナーID:</span> {botStatus.webinar_id || '-'}
            </div>
            <div className="text-gray-300">
              <span className="text-gray-500">開始時刻:</span> {botStatus.started_at ? new Date(botStatus.started_at).toLocaleString() : '-'}
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Loading status...</div>
        )}
      </div>

      {/* リアルタイムログ */}
      <div className="bg-[#111827] rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-bold mb-4 text-white">リアルタイムログ (最新10件)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50">
              <tr>
                <th className="px-4 py-2">タイムスタンプ</th>
                <th className="px-4 py-2">ユーザー名</th>
                <th className="px-4 py-2">メッセージ</th>
                <th className="px-4 py-2">アクション</th>
                <th className="px-4 py-2">検出方法</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="px-4 py-2 text-gray-300 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 text-white">{log.username}</td>
                  <td className="px-4 py-2 text-gray-400 truncate max-w-xs">
                    {log.message.length > 30 ? `${log.message.substring(0, 30)}...` : log.message}
                  </td>
                  <td className={`px-4 py-2 font-medium ${getActionColor(log.action)}`}>
                    {log.action}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{log.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <div className="text-center text-gray-500 py-4">ログがありません</div>
          )}
        </div>
      </div>
    </div>
  )
}
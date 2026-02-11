'use client'

import { useState, useEffect, useCallback } from 'react'

// 型定義
type Action = 'deleted' | 'kicked' | 'warned' | 'passed' | 're-blocked' | 'all'
type Method = 'ngword' | 'ai' | 'blacklist'

interface Log {
  id: number
  timestamp: string
  username: string
  message: string
  action: 'deleted' | 'kicked' | 'warned' | 'passed' | 're-blocked'
  method: Method
  aiScore?: number | null
  aiReason?: string | null
  matchNgWord?: string | null
}

interface ApiResponse {
  logs: Log[]
  totalPages: number
  currentPage: number
}

export default function LogTable() {
  const [logs, setLogs] = useState<Log[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Action>('all')

  // ログ取得関数
  const fetchLogs = useCallback(async (page: number, actionFilter: Action) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      })
      
      if (actionFilter !== 'all') {
        params.append('action', actionFilter)
      }

      const res = await fetch(`/api/logs?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch logs')
      
      const data: ApiResponse = await res.json()
      setLogs(data.logs)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 初回読み込み
  useEffect(() => {
    fetchLogs(currentPage, filter)
  }, [currentPage, filter, fetchLogs])

  // アクションバッジのスタイル
  const getActionBadge = (action: Log['action']) => {
    const styles = {
      deleted: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30',
      kicked: 'bg-red-500/20 text-red-500 border border-red-500/30',
      passed: 'bg-green-500/20 text-green-500 border border-green-500/30',
      're-blocked': 'bg-purple-500/20 text-purple-500 border border-purple-500/30',
      warned: 'bg-orange-500/20 text-orange-500 border border-orange-500/30',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${styles[action]}`}>
        {action}
      </span>
    )
  }

  // 検出方法バッジのスタイル
  const getMethodBadge = (method: Method) => {
    const styles = {
      ngword: 'bg-red-500/10 text-red-400 border border-red-500/20',
      ai: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      blacklist: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${styles[method]}`}>
        {method}
      </span>
    )
  }

  return (
    <div className="w-full bg-[#111827] p-4 rounded-lg border border-gray-800">
      
      {/* フィルター */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {(['all', 'deleted', 'kicked', 'warned', 'passed', 're-blocked'] as Action[]).map((action) => (
          <button
            key={action}
            onClick={() => {
              setFilter(action)
              setCurrentPage(1)
            }}
            className={`px-3 py-1 text-sm rounded capitalize transition-colors ${
              filter === action
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {action}
          </button>
        ))}
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-3 text-gray-400 uppercase text-xs font-medium">日時</th>
              <th className="p-3 text-gray-400 uppercase text-xs font-medium">ユーザー名</th>
              <th className="p-3 text-gray-400 uppercase text-xs font-medium">メッセージ</th>
              <th className="p-3 text-gray-400 uppercase text-xs font-medium">アクション</th>
              <th className="p-3 text-gray-400 uppercase text-xs font-medium">検出方法</th>
              <th className="p-3 text-gray-400 uppercase text-xs font-medium">AIスコア</th>
              <th className="p-3 text-gray-400 uppercase text-xs font-medium">AI理由</th>
              <th className="p-3 text-gray-400 uppercase text-xs font-medium">マッチNGワード</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  No logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/50 border-b border-gray-800 transition-colors">
                  <td className="p-3 text-gray-400 whitespace-nowrap">{log.timestamp}</td>
                  <td className="p-3 font-medium">{log.username}</td>
                  <td className="p-3 text-gray-300 truncate max-w-xs">{log.message}</td>
                  <td className="p-3">{getActionBadge(log.action)}</td>
                  <td className="p-3">{getMethodBadge(log.method)}</td>
                  <td className="p-3">
                    {log.aiScore !== null && log.aiScore !== undefined ? `${log.aiScore}%` : '-'}
                  </td>
                  <td className="p-3 text-xs text-gray-500 truncate max-w-xs">
                    {log.aiReason || '-'}
                  </td>
                  <td className="p-3 text-xs text-red-400 font-mono">
                    {log.matchNgWord || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          前へ
        </button>
        
        <span className="text-gray-400 text-sm">
          Page {currentPage} / {totalPages}
        </span>
        
        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages || totalPages === 0}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          次へ
        </button>
      </div>
    </div>
  )
}
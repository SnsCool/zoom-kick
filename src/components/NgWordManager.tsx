'use client'

import { useState, useEffect, useCallback } from 'react'

// 型定義
type Category = 'general' | 'hate' | 'spam' | 'custom'
type Priority = 'low' | 'medium' | 'high'

interface NgWord {
  id: string
  word: string
  category: Category
  priority: Priority
  isRegex: boolean
  createdAt: string
}

// カテゴリ表示用のマッピング
const categoryLabels: Record<Category, string> = {
  general: '一般',
  hate: 'ヘイト',
  spam: 'スパム',
  custom: 'カスタム'
}

const categoryBadgeColors: Record<Category, string> = {
  general: 'bg-gray-700 text-gray-300',
  hate: 'bg-red-900/50 text-red-400 border border-red-800',
  spam: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  custom: 'bg-blue-900/50 text-blue-400 border border-blue-800'
}

const priorityBadgeColors: Record<Priority, string> = {
  high: 'bg-red-600 text-white',
  medium: 'bg-yellow-600 text-white',
  low: 'bg-green-600 text-white'
}

const priorityLabels: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低'
}

export default function NgWordManager() {
  const [words, setWords] = useState<NgWord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // フォーム状態
  const [newWord, setNewWord] = useState('')
  const [category, setCategory] = useState<Category>('general')
  const [priority, setPriority] = useState<Priority>('medium')
  const [isRegex, setIsRegex] = useState(false)

  // NGワード一覧を取得
  const fetchWords = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ng-words')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setWords(data)
    } catch (err) {
      setError('NGワードの取得に失敗しました')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  // NGワードを追加
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWord.trim()) return

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ng-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: newWord,
          category,
          priority,
          isRegex
        })
      })

      if (!res.ok) throw new Error('Failed to add')
      await fetchWords() // 再取得
      setNewWord('')
      setCategory('general')
      setPriority('medium')
      setIsRegex(false)
    } catch (err) {
      setError('NGワードの追加に失敗しました')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // NGワードを削除
  const handleDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ng-words?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete')
      await fetchWords() // 再取得
    } catch (err) {
      setError('NGワードの削除に失敗しました')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 追加フォームセクション */}
      <div className="bg-[#111827] rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">NGワード追加</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* ワード入力 */}
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-400 mb-1">ワード <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="NGワードを入力..."
              required
            />
          </div>

          {/* カテゴリ選択 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-1">カテゴリ</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none"
            >
              <option value="general">一般</option>
              <option value="hate">ヘイト</option>
              <option value="spam">スパム</option>
              <option value="custom">カスタム</option>
            </select>
          </div>

          {/* 重要度選択 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-1">重要度</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>

          {/* 正規表現フラグ */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-1">オプション</label>
            <label className="flex items-center space-x-2 cursor-pointer bg-gray-800 border border-gray-700 rounded px-3 py-2 hover:border-gray-600 transition">
              <input
                type="checkbox"
                checked={isRegex}
                onChange={(e) => setIsRegex(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded bg-gray-700 border-gray-600 focus:ring-offset-gray-900"
              />
              <span className="text-sm text-gray-300 select-none">正規表現</span>
            </label>
          </div>

          {/* 追加ボタン */}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isLoading || !newWord.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              追加
            </button>
          </div>
        </form>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 一覧テーブルセクション */}
      <div className="bg-[#111827] rounded-lg p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">NGワード一覧</h2>
          <button
            onClick={fetchWords}
            className="text-sm text-gray-400 hover:text-white underline"
          >
            更新
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-800/50 text-gray-200 uppercase font-medium text-xs">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">ワード</th>
                <th className="px-4 py-3">カテゴリ</th>
                <th className="px-4 py-3">重要度</th>
                <th className="px-4 py-3">正規表現</th>
                <th className="px-4 py-3">追加日時</th>
                <th className="px-4 py-3 text-right rounded-r-lg">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading && words.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    読み込み中...
                  </td>
                </tr>
              ) : words.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    登録されているNGワードはありません
                  </td>
                </tr>
              ) : (
                words.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 font-mono text-white">
                      {item.word}
                      {item.isRegex && <span className="ml-1 text-xs text-blue-400">.*</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${categoryBadgeColors[item.category]}`}>
                        {categoryLabels[item.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${priorityBadgeColors[item.priority]}`}>
                        {priorityLabels[item.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.isRegex ? (
                        <span className="text-blue-400">●</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {new Date(item.createdAt).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="bg-red-600/20 text-red-400 hover:bg-red-600/40 px-3 py-1 rounded text-xs font-medium transition"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
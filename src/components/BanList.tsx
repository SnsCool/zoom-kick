'use client'

import { useState, useEffect, useCallback } from 'react'

type BanType = 'permanent' | 'temporary'

interface BanEntry {
  id: string
  username: string
  email?: string
  reason: string
  bannedAt: string
  type: BanType
  expiresAt?: string
  webinar: string
  sheetsSync: boolean
}

const BanList = () => {
  const [bans, setBans] = useState<BanEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    reason: '',
    type: 'temporary' as BanType
  })

  // Fetch Bans
  const fetchBans = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/blacklist')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setBans(data)
    } catch (err) {
      setError('Error loading ban list')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBans()
  }, [fetchBans])

  // Add Ban
  const handleAddBan = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (!res.ok) throw new Error('Failed to add ban')
      await fetchBans()
      setIsFormOpen(false)
      // Reset form
      setFormData({ username: '', email: '', reason: '', type: 'temporary' })
    } catch (err) {
      console.error(err)
      alert('Failed to add user to ban list')
    }
  }

  // Remove Ban
  const handleUnban = async (id: string) => {
    if (!confirm('Are you sure you want to unban this user?')) return
    try {
      const res = await fetch('/api/blacklist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!res.ok) throw new Error('Failed to remove ban')
      await fetchBans()
    } catch (err) {
      console.error(err)
      alert('Failed to remove ban')
    }
  }

  // Update Ban Type
  const handleTypeChange = async (id: string, newType: BanType) => {
    try {
      const res = await fetch('/api/blacklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: newType })
      })
      if (!res.ok) throw new Error('Failed to update ban')
      await fetchBans()
    } catch (err) {
      console.error(err)
      alert('Failed to update ban type')
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="bg-[#111827] rounded-lg p-6 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">BAN管理リスト</h1>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors"
        >
          {isFormOpen ? 'フォームを閉じる' : 'BAN追加'}
        </button>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Add Ban Form */}
      {isFormOpen && (
        <div className="mb-8 bg-[#1f2937] p-6 rounded-lg border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-600 pb-2">新規BAN追加</h2>
          <form onSubmit={handleAddBan} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">ユーザー名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="例: user123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">メールアドレス</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="例: user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">理由 <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="例: スパム行為"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">BAN種別</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as BanType })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="temporary">一時BAN</option>
                <option value="permanent">永久BAN</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-medium transition-colors">
                追加する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700 text-sm uppercase">
              <th className="p-4 font-medium">ユーザー名</th>
              <th className="p-4 font-medium">メール</th>
              <th className="p-4 font-medium">理由</th>
              <th className="p-4 font-medium">BAN日時</th>
              <th className="p-4 font-medium">種別</th>
              <th className="p-4 font-medium">有効期限</th>
              <th className="p-4 font-medium">ウェビナー</th>
              <th className="p-4 font-medium">Sheets同期</th>
              <th className="p-4 font-medium">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  読み込み中...
                </td>
              </tr>
            ) : bans.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  データがありません
                </td>
              </tr>
            ) : (
              bans.map((ban) => (
                <tr key={ban.id} className="hover:bg-[#1f2937] transition-colors">
                  <td className="p-4 font-medium text-white">{ban.username}</td>
                  <td className="p-4 text-gray-300">{ban.email || '-'}</td>
                  <td className="p-4 text-gray-300">{ban.reason}</td>
                  <td className="p-4 text-gray-400 text-sm whitespace-nowrap">{formatDate(ban.bannedAt)}</td>
                  <td className="p-4">
                    <button
                      onClick={() => handleTypeChange(ban.id, ban.type === 'permanent' ? 'temporary' : 'permanent')}
                      className={`px-2 py-1 rounded text-xs font-semibold uppercase cursor-pointer transition-opacity hover:opacity-80 ${
                        ban.type === 'permanent'
                          ? 'bg-red-900 text-red-200 border border-red-700'
                          : 'bg-yellow-900 text-yellow-200 border border-yellow-700'
                      }`}
                    >
                      {ban.type === 'permanent' ? 'Permanent' : 'Temporary'}
                    </button>
                  </td>
                  <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                    {ban.type === 'temporary' ? formatDate(ban.expiresAt || '') : 'なし'}
                  </td>
                  <td className="p-4 text-gray-300 text-sm">{ban.webinar}</td>
                  <td className="p-4 text-gray-300 text-sm">
                    {ban.sheetsSync ? (
                      <span className="text-green-400">✔ 完了</span>
                    ) : (
                      <span className="text-yellow-500">⟳ 未同期</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleUnban(ban.id)}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      解除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BanList
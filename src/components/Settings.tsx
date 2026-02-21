'use client'

import { useState, useEffect } from 'react'

interface SettingsData {
  ai_threshold: number
  auto_delete: boolean
  auto_kick: boolean
  block_reentry: boolean
  sheets_sync: boolean
}

const Settings = () => {
  const [settings, setSettings] = useState<SettingsData>({
    ai_threshold: 0.5,
    auto_delete: false,
    auto_kick: false,
    block_reentry: false,
    sheets_sync: false,
  })
  const [isToastVisible, setIsToastVisible] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          const s = data.settings || {}
          setSettings({
            ai_threshold: s.ai_threshold?.value ?? 0.7,
            auto_delete: s.auto_delete?.value ?? true,
            auto_kick: s.auto_kick?.value ?? true,
            block_reentry: s.block_reentry?.value ?? true,
            sheets_sync: s.sheets_sync?.value ?? true,
          })
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    try {
      const entries = Object.entries(settings)
      const results = await Promise.all(
        entries.map(([key, value]) =>
          fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: { value } }),
          })
        )
      )

      if (results.every((r) => r.ok)) {
        setIsToastVisible(true)
        setTimeout(() => {
          setIsToastVisible(false)
        }, 3000)
      } else {
        console.error('Failed to save some settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  const ToggleSwitch = ({ enabled, onChange, label, description }: { enabled: boolean, onChange: (enabled: boolean) => void, label: string, description: string }) => (
    <div className="flex items-center justify-between mb-6">
      <div className="pr-4">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-gray-400 mt-1">{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${enabled ? 'bg-blue-600' : 'bg-gray-600'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#111827] rounded-lg p-6 border border-gray-800 relative">
        <h1 className="text-xl font-bold text-white mb-6">設定</h1>

        {/* AI Threshold Slider */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <label className="block text-sm font-medium text-white">AI閾値</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={settings.ai_threshold}
                onChange={(e) => setSettings({ ...settings, ai_threshold: parseFloat(e.target.value) })}
                className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-right text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.ai_threshold}
            onChange={(e) => setSettings({ ...settings, ai_threshold: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <p className="text-xs text-gray-400 mt-2">AI判定の信頼度しきい値を設定します（0.0〜1.0）。</p>
        </div>

        <div className="border-t border-gray-800 my-6"></div>

        {/* Toggles */}
        <div className="space-y-2">
          <ToggleSwitch
            label="自動削除"
            description="条件を満たしたメッセージを自動的に削除します"
            enabled={settings.auto_delete}
            onChange={(value) => setSettings({ ...settings, auto_delete: value })}
          />
          <ToggleSwitch
            label="自動退出"
            description="違反ユーザーをボイスチャンネルから退出させます"
            enabled={settings.auto_kick}
            onChange={(value) => setSettings({ ...settings, auto_kick: value })}
          />
          <ToggleSwitch
            label="再入室ブロック"
            description="退出させられたユーザーの再入室を禁止します"
            enabled={settings.block_reentry}
            onChange={(value) => setSettings({ ...settings, block_reentry: value })}
          />
          <ToggleSwitch
            label="Sheets連携"
            description="Google スプレッドシートにログを同期します"
            enabled={settings.sheets_sync}
            onChange={(value) => setSettings({ ...settings, sheets_sync: value })}
          />
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-6 rounded transition-colors duration-200"
          >
            保存
          </button>
        </div>

        {/* Toast */}
        {isToastVisible && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-[fadeIn_0.3s_ease-out]">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm">保存しました</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings
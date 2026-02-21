'use client'

import { useState, useEffect } from 'react';
import { parseZoomUrl, isValidZoomId } from '@/lib/zoom-url-parser';

type BotStatus = {
  isRunning: boolean;
  processedCount: number;
  startedAt: string | null;
  webinarId: string | null;
  webinarName: string | null;
};

type InputMode = 'url' | 'id';

export default function BotControl() {
  const [status, setStatus] = useState<BotStatus>({
    isRunning: false,
    processedCount: 0,
    startedAt: null,
    webinarId: null,
    webinarName: null,
  });

  // Input Mode State
  const [inputMode, setInputMode] = useState<InputMode>('url');

  // Form state
  const [inputWebinarUrl, setInputWebinarUrl] = useState('');
  const [inputWebinarId, setInputWebinarId] = useState('');
  const [inputWebinarName, setInputWebinarName] = useState('');

  // Loading states for buttons
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Polling function
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch bot status', error);
    }
  };

  // Polling effect
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Start Bot Handler
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalWebinarId: string | null = null;

    if (inputMode === 'url') {
      const trimmedUrl = inputWebinarUrl.trim();
      if (!trimmedUrl) return;
      const result = parseZoomUrl(trimmedUrl);
      if (!result.webinarId) {
        alert(result.error || 'URLの解析に失敗しました');
        return;
      }
      finalWebinarId = result.webinarId;
    } else {
      if (!inputWebinarId) return;
      finalWebinarId = inputWebinarId.replace(/-/g, '').trim();
      if (!isValidZoomId(finalWebinarId)) {
        alert('有効なZoom IDではありません（9〜11桁の数字）');
        return;
      }
    }

    if (!finalWebinarId) return;

    setIsStarting(true);
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webinarId: finalWebinarId,
          webinarName: inputWebinarName,
        }),
      });
      if (res.ok) {
        fetchStatus();
        setInputWebinarUrl('');
        setInputWebinarId('');
        setInputWebinarName('');
      } else {
        alert('起動に失敗しました');
      }
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました');
    } finally {
      setIsStarting(false);
    }
  };

  // Stop Bot Handler
  const handleStop = async () => {
    if (!confirm('Botを停止してもよろしいですか？')) return;

    setIsStopping(true);
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      if (res.ok) {
        fetchStatus();
      } else {
        alert('停止に失敗しました');
      }
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました');
    } finally {
      setIsStopping(false);
    }
  };

  // URL解析結果のプレビュー
  const urlParseResult = inputMode === 'url' && inputWebinarUrl ? parseZoomUrl(inputWebinarUrl) : null;

  return (
    <div className="bg-[#111827] rounded-lg p-6 border border-gray-800 shadow-xl max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Bot コントロールパネル</h2>
        <div className="flex items-center gap-3">
            {status.isRunning ? (
                <>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-green-400 font-medium">稼働中</span>
                </>
            ) : (
                <>
                    <span className="h-3 w-3 rounded-full bg-gray-500"></span>
                    <span className="text-gray-400 font-medium">停止中</span>
                </>
            )}
        </div>
      </div>

      {/* Status Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800/50 p-4 rounded border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">現在のウェビナー</p>
            <p className="text-white font-semibold truncate" title={status.webinarName || undefined}>
                {status.webinarName || 'なし'}
                {status.webinarId && <span className="text-gray-500 text-sm ml-2">(ID: {status.webinarId})</span>}
            </p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">処理済みメッセージ数</p>
            <p className="text-white font-semibold text-xl">{status.processedCount.toLocaleString()}</p>
        </div>
        {status.startedAt && (
            <div className="bg-gray-800/50 p-4 rounded border border-gray-700">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">起動時刻</p>
                <p className="text-white font-medium">{new Date(status.startedAt).toLocaleString('ja-JP')}</p>
            </div>
        )}
      </div>

      <hr className="border-gray-800 mb-8" />

      {/* Start Form */}
      <form onSubmit={handleStart} className="mb-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Bot起動
        </h3>

        {/* Mode Switcher */}
        <div className="flex bg-gray-900 rounded-lg p-1 mb-6 border border-gray-800">
            <button
                type="button"
                onClick={() => setInputMode('url')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    inputMode === 'url'
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                disabled={status.isRunning || isStarting}
            >
                URLから起動
            </button>
            <button
                type="button"
                onClick={() => setInputMode('id')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    inputMode === 'id'
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                disabled={status.isRunning || isStarting}
            >
                IDを直接入力
            </button>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                {inputMode === 'url' ? (
                    <>
                        <label className="block text-gray-400 text-sm font-medium mb-2">Zoom URL <span className="text-red-500">*</span></label>
                        <textarea
                            value={inputWebinarUrl}
                            onChange={(e) => setInputWebinarUrl(e.target.value)}
                            className="w-full h-24 bg-gray-800 border border-gray-700 rounded p-2.5 text-white focus:ring-2 focus:ring-green-600 focus:border-transparent outline-none transition resize-none"
                            placeholder="https://zoom.us/j/123456789..."
                            disabled={status.isRunning || isStarting}
                        />
                        {inputWebinarUrl && (
                            <div className="mt-2 min-h-[20px]">
                                {urlParseResult?.webinarId ? (
                                    <p className="text-green-400 text-xs flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        抽出されたID: <span className="font-mono font-bold">{urlParseResult.webinarId}</span>
                                    </p>
                                ) : (
                                    <p className="text-red-400 text-xs flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        {urlParseResult?.error || 'IDを検出できません'}
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <label className="block text-gray-400 text-sm font-medium mb-2">ウェビナーID <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={inputWebinarId}
                            onChange={(e) => setInputWebinarId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded p-2.5 text-white focus:ring-2 focus:ring-green-600 focus:border-transparent outline-none transition"
                            placeholder="例: 123-456-789"
                            disabled={status.isRunning || isStarting}
                            required
                        />
                        <p className="text-gray-500 text-xs mt-1">ハイフンあり・なし両方対応</p>
                    </>
                )}
            </div>

            <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">ウェビナー名</label>
                <input
                    type="text"
                    value={inputWebinarName}
                    onChange={(e) => setInputWebinarName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2.5 text-white focus:ring-2 focus:ring-green-600 focus:border-transparent outline-none transition"
                    placeholder="例: React勉強会 Vol.1"
                    disabled={status.isRunning || isStarting}
                />
            </div>
        </div>

        <div className="mt-4 text-right">
            <button
                type="submit"
                disabled={status.isRunning || isStarting || (inputMode === 'url' && !urlParseResult?.webinarId)}
                className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-6 rounded shadow-lg shadow-green-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
            >
                {isStarting ? '起動中...' : '起動'}
            </button>
        </div>
      </form>

      {/* Stop Controls */}
      <div>
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path></svg>
            Bot停止
        </h3>
        <div className="flex items-center justify-between bg-gray-800/30 p-4 rounded border border-gray-700/50">
            <span className="text-gray-400 text-sm">Botを停止するには、以下のボタンをクリックしてください。</span>
            <button
                onClick={handleStop}
                disabled={!status.isRunning || isStopping}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-6 rounded shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-4 transform active:scale-95"
            >
                {isStopping ? '停止中...' : '停止'}
            </button>
        </div>
      </div>
    </div>
  );
}

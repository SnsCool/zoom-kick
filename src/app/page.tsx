'use client';

import { useState, useEffect } from 'react';
import Dashboard from '@/components/Dashboard';
import LogTable from '@/components/LogTable';
import BanList from '@/components/BanList';
import NgWordManager from '@/components/NgWordManager';
import BotControl from '@/components/BotControl';
import Settings from '@/components/Settings';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('auth', 'true');
      } else {
        alert('パスワードが違います');
      }
    } catch (error) {
      console.error(error);
      alert('認証エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setIsAuthenticated(false);
    setPassword('');
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F19] text-white">
        <div className="p-8 bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 text-gray-900 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded font-bold transition duration-200 disabled:opacity-50"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'ダッシュボード' },
    { id: 'logs', label: 'ログ' },
    { id: 'ban', label: 'BAN管理' },
    { id: 'ngword', label: 'NGワード' },
    { id: 'bot', label: 'BOT操作' },
    { id: 'settings', label: '設定' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'logs':
        return <LogTable />;
      case 'ban':
        return <BanList />;
      case 'ngword':
        return <NgWordManager />;
      case 'bot':
        return <BotControl />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-200">
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shadow-md">
        <h1 className="text-xl font-bold text-white tracking-wide">
          Zoom Moderation Bot
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        >
          ログアウト
        </button>
      </header>

      <div className="flex flex-col md:flex-row max-w-7xl mx-auto">
        <nav className="w-full md:w-64 bg-gray-900 md:min-h-[calc(100vh-73px)] border-r border-gray-800 flex-shrink-0">
          <ul className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible p-2 space-x-2 md:space-x-0 md:space-y-2">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-md transition-colors whitespace-nowrap text-sm font-medium
                    ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-6 overflow-x-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
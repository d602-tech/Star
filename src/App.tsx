import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, LogOut, CheckCircle, Image as ImageIcon } from 'lucide-react';

const GAS_APP_URL = (import.meta as any).env.VITE_GAS_URL || "https://script.google.com/macros/s/AKfycbw7uChOFkNVUdNMYEG4jAlNUEg8gSoDb3zUgS2WjQX37vFqvmdHmdbTOQEaKwiRRxpu/exec";

// --- Token 工具 ---
const getAdminToken = () => sessionStorage.getItem('adminToken');
const setAdminToken = (t: string) => sessionStorage.setItem('adminToken', t);
const clearAdminToken = () => sessionStorage.removeItem('adminToken');
const getSessionToken = () => sessionStorage.getItem('sessionToken');
const setSessionToken = (t: string) => sessionStorage.setItem('sessionToken', t);
const clearSessionToken = () => sessionStorage.removeItem('sessionToken');

// --- API 呼叫模組 ---
async function apiCall(action: string, params: any = {}) {
  try {
    const res = await fetch(GAS_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...params })
    });
    const data = await res.json();
    if (data && typeof data.success !== 'undefined' && !data.success) {
      throw new Error(data.error || data.message || 'API 操作失敗');
    }
    return data;
  } catch (err: any) {
    console.error("API call error:", err);
    alert("連線或伺服器錯誤: " + err.message);
    return null;
  }
}

const Loading = () => (
  <div className="py-20 text-center">
    <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
    <p className="text-gray-500 font-medium">載入中，請稍候...</p>
  </div>
);

export default function App() {
  const [view, setView] = useState('gateway'); // gateway, adminLogin, voterLogin, adminPanel, voterPanel
  const [currentUser, setCurrentUser] = useState<any>(null);

  if (view === 'gateway') return <Gateway setView={setView} />;
  if (view === 'adminLogin') return <AdminLogin setView={setView} />;
  if (view === 'voterLogin') return <VoterLogin setView={setView} onLogin={(user: any) => { setCurrentUser(user); setView('voterPanel'); }} />;
  if (view === 'adminPanel') return <AdminPanel setView={setView} />;
  if (view === 'voterPanel') return <VoterPanel setView={setView} user={currentUser} onLogout={() => { setCurrentUser(null); setView('gateway'); }} />;
  return null;
}

function Gateway({ setView }: { setView: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="bg-white/85 backdrop-blur-md p-10 rounded-2xl shadow-xl w-full max-w-lg text-center animate-in fade-in slide-in-from-bottom-2 duration-400">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">114年度優良事蹟評選系統</h1>
        <p className="text-gray-500 mb-8">請選擇登入身分進入系統</p>
        <div className="space-y-4">
          <button onClick={() => setView('voterLogin')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl shadow-md transition-all text-lg">
            評選委員入口
          </button>
          <button onClick={() => setView('adminLogin')} className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-4 rounded-xl shadow-sm transition-all text-lg">
            系統管理員後台
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ setView }: { setView: (v: string) => void }) {
  const [acc, setAcc] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await apiCall('adminLogin', { acc, pwd });
    setLoading(false);
    if (res?.success) {
      setAdminToken(res.adminToken);
      setView('adminPanel');
    } else {
      setErr(res?.message || '帳號或密碼錯誤');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
      <form className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm animate-in fade-in duration-400" onSubmit={handleLogin}>
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">管理員登入</h2>
        {err && <div className="bg-red-100 text-red-600 p-3 rounded mb-4 text-sm">{err}</div>}
        <input type="text" placeholder="帳號" className="w-full border p-3 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none" value={acc} onChange={e => setAcc(e.target.value)} required />
        <input type="password" placeholder="密碼" className="w-full border p-3 rounded mb-6 focus:ring-2 focus:ring-blue-500 outline-none" value={pwd} onChange={e => setPwd(e.target.value)} required />
        <button type="submit" disabled={loading} className="w-full bg-gray-800 hover:bg-black text-white py-3 rounded font-bold transition disabled:opacity-50">
          {loading ? '驗證中...' : '登入管理後台'}
        </button>
        <button type="button" onClick={() => setView('gateway')} className="w-full text-center text-sm text-gray-500 mt-4 hover:underline">返回首頁</button>
      </form>
    </div>
  );
}

function VoterLogin({ setView, onLogin }: { setView: (v: string) => void, onLogin: (u: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [committees, setCommittees] = useState<any[]>([]);
  const [step, setStep] = useState(0); // 0: 共同密碼, 1: 部門, 2: 姓名, 3: 密碼
  const [sharedPwd, setSharedPwd] = useState('');
  const [dept, setDept] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const getDeptIcon = (deptName: string) => {
    if (deptName.includes('工安') || deptName.includes('安全')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>;
    if (deptName.includes('工程') || deptName.includes('機電')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
    if (deptName.includes('行政') || deptName.includes('管理')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>;
    if (deptName.includes('業務') || deptName.includes('行銷')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>;
    if (deptName.includes('生產') || deptName.includes('製造')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>;
    if (deptName.includes('品保') || deptName.includes('檢驗')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
    return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
  };

  useEffect(() => {
    apiCall('getCommittees').then(res => {
      if (res) setCommittees(res);
      setLoading(false);
    });
  }, []);

  const departments = useMemo(() => [...new Set(committees.map(c => c['部門']))], [committees]);
  const availableNames = useMemo(() => committees.filter(c => c['部門'] === dept).map(c => c['委員姓名']), [dept, committees]);

  const handleSharedPwdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sharedPwd === '0505') {
      setErr('');
      setStep(1);
    } else {
      setErr('系統進入密碼錯誤，請重新輸入。');
      setSharedPwd('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await apiCall('login', { name, login_code: code });
    setLoading(false);
    if (res?.success) {
      setSessionToken(res.sessionToken);
      onLogin(res.committee);
    } else {
      setErr(res?.message || '登入失敗');
    }
  };

  if (loading && committees.length === 0) return <Loading />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50 p-4 md:p-6">
      <div className="bg-white p-6 md:p-10 rounded-3xl shadow-2xl w-full max-w-2xl animate-in fade-in duration-400 overflow-hidden relative">
        <button onClick={() => setView('gateway')} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 font-bold transition">✕ 關閉</button>
        <h2 className="text-3xl font-extrabold text-center mb-2 text-blue-900 tracking-wide">評選委員登入</h2>
        <p className="text-center text-blue-600/80 font-medium mb-8">
          {step === 0 && '請輸入進入評選系統的密碼'}
          {step === 1 && '請選擇您所屬的部門'}
          {step === 2 && '請點選您的姓名'}
          {step === 3 && '請完成身分驗證'}
        </p>

        {err && <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl mb-6 text-sm font-bold text-center shadow-sm">{err}</div>}

        {step === 0 && (
          <form onSubmit={handleSharedPwdSubmit} className="max-w-sm mx-auto">
            <div className="mb-8">
              <label className="block text-gray-700 text-sm font-bold mb-3 text-center">請輸入系統進入密碼</label>
              <input
                type="password"
                placeholder="請輸入密碼"
                className="w-full border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 p-4 rounded-xl text-center text-xl tracking-widest transition bg-white outline-none"
                value={sharedPwd}
                onChange={e => setSharedPwd(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
              確認進入
            </button>
          </form>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {departments.map(d => (
              <button
                key={d}
                onClick={() => { setDept(d); setStep(2); setErr(''); }}
                className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-white to-blue-50 border-2 border-blue-100 hover:border-blue-400 hover:shadow-lg rounded-2xl transition-all transform hover:-translate-y-1 group"
              >
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  {getDeptIcon(d)}
                </div>
                <span className="font-bold text-gray-700 group-hover:text-blue-900 text-lg">{d}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <button onClick={() => { setStep(1); setDept(''); setErr(''); }} className="mb-6 text-sm text-blue-500 hover:text-blue-700 font-bold flex items-center transition">
              ← 返回部門列表
            </button>
            <div className="text-sm font-bold text-gray-400 mb-3 ml-1">目前部門：<span className="text-blue-800">{dept}</span></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {availableNames.map(n => (
                <button
                  key={n}
                  onClick={() => { setName(n); setStep(3); setErr(''); }}
                  className="p-5 bg-white border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/50 rounded-2xl shadow-sm hover:shadow-md transition-all text-center group"
                >
                  <div className="font-black text-gray-800 text-xl group-hover:text-blue-700">{n}</div>
                  <div className="text-xs text-gray-400 mt-1 font-medium">委員</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleLogin} className="max-w-sm mx-auto">
            <button type="button" onClick={() => { setStep(2); setName(''); setCode(''); setErr(''); }} className="mb-6 text-sm text-blue-500 hover:text-blue-700 font-bold flex items-center transition">
              ← 重新選擇姓名
            </button>
            <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl mb-6 text-center shadow-inner">
              <div className="text-gray-500 text-sm font-bold mb-1">{dept}</div>
              <div className="text-3xl font-black text-gray-800">{name}</div>
            </div>
            <div className="mb-8">
              <label className="block text-gray-700 text-sm font-bold mb-3 text-center">請輸入 4 碼登入代號<br /><span className="text-xs text-blue-600 font-normal">(即您的姓名代號/員工編號末四碼)</span></label>
              <input
                type="password"
                placeholder="例如: 1234"
                className="w-full border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 p-4 rounded-xl text-center text-3xl font-mono tracking-[0.5em] transition bg-white outline-none"
                value={code}
                onChange={e => setCode(e.target.value)}
                maxLength={4}
                required
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50">
              {loading ? '身分驗證中...' : '確認登入並開始評選'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AdminPanel({ setView }: { setView: (v: string) => void }) {
  const [tab, setTab] = useState('results');

  const handleLogout = async () => {
    const token = getAdminToken();
    if (token) await apiCall('adminLogout', { adminToken: token });
    clearAdminToken();
    setView('gateway');
  };

  return (
    <div className="min-h-screen bg-gray-100 animate-in fade-in duration-400">
      <nav className="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-16">
          <div className="flex flex-col">
            <div className="font-bold text-xl tracking-wider">管理員後台</div>
            <div className="text-[10px] text-blue-300 font-mono -mt-1">v2.3 典禮優化版</div>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setTab('results')} className={`px-4 py-2 rounded-md font-medium transition ${tab === 'results' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>排行榜</button>
            <button onClick={() => setTab('votingStatus')} className={`px-4 py-2 rounded-md font-medium transition ${tab === 'votingStatus' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>投票狀況</button>
            <button onClick={() => setTab('candidates')} className={`px-4 py-2 rounded-md font-medium transition ${tab === 'candidates' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>候選人管理</button>
            <button onClick={() => setTab('committees')} className={`px-4 py-2 rounded-md font-medium transition ${tab === 'committees' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>委員管理</button>
            <button onClick={handleLogout} className="px-4 py-2 rounded-md font-medium bg-red-600 hover:bg-red-700 transition ml-4">登出</button>
          </div>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {tab === 'results' && <AdminResults />}
        {tab === 'votingStatus' && <AdminVotingStatus />}
        {tab === 'candidates' && <AdminCandidates />}
        {tab === 'committees' && <AdminCommittees />}
      </div>
    </div>
  );
}

function AdminResults() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadResults = () => {
    setLoading(true);
    apiCall('getResults', { adminToken: getAdminToken() }).then(res => {
      if (res) {
        setResults(res);
        if (res.length > 0) {
          if (!audioRef.current) {
            audioRef.current = new Audio('./music.mp3');
            audioRef.current.loop = true;
            audioRef.current.volume = 0.6;
          }
          if (isPlaying) {
            audioRef.current.play().catch(e => {
              console.log('Audio auto-play blocked:', e);
              setIsPlaying(false);
            });
          }
          confetti({ particleCount: 300, spread: 120, origin: { y: 0.6 } });
          setTimeout(() => confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } }), 1500);
          setTimeout(() => confetti({ particleCount: 150, spread: 80, origin: { y: 0.8 } }), 3500);
        }
      }
      setLoading(false);
    });
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(e => console.log('Play blocked', e));
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    loadResults();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (loading) return <Loading />;

  const top3 = results.slice(0, 3);
  const others = results.slice(3);

  return (
    <div className="animate-in fade-in duration-400 bg-gradient-to-b from-gray-900 via-gray-800 to-black min-h-[80vh] rounded-3xl p-6 md:p-12 relative overflow-hidden shadow-2xl border border-gray-700">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-6">
        <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 tracking-widest pl-4 border-l-8 border-yellow-500">🏆 評選總排行榜</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleMusic}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold shadow-lg transition-all duration-300 border-2 ${isPlaying ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse' : 'bg-gray-800 text-yellow-500 border-gray-600'}`}
          >
            {isPlaying ? <span>🎵 頒獎音樂播放中</span> : <span>🔇 音樂已暫停</span>}
          </button>
          <button onClick={loadResults} className="text-gray-300 hover:text-white bg-gray-800/80 px-6 py-2 rounded-lg border border-gray-600 backdrop-blur-md shadow-lg transition font-bold">重新整理</button>
        </div>
      </div>

      {top3.length > 0 && (
        <div className="flex flex-col md:flex-row justify-center items-end min-h-[450px] mb-16 space-y-8 md:space-y-0 md:space-x-8 px-4">
          {top3[1] && <div className="flex flex-col items-center w-full md:w-64 order-2 md:order-1">
            <div className="mb-4 relative">
              {top3[1].image_url ? <img src={top3[1].image_url} className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-[6px] border-gray-300 shadow-xl" alt={top3[1].name} /> : <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-gray-200 border-[6px] border-gray-300 flex items-center justify-center text-gray-400 text-3xl font-bold">?</div>}
              <div className="absolute top-[-20px] left-[-20px] bg-gradient-to-r from-gray-400 to-gray-200 text-gray-900 font-black text-sm px-4 py-1 rounded shadow-lg transform -rotate-12 z-20">🥈 亞軍</div>
            </div>
            <div className="bg-gray-800/60 backdrop-blur-md text-white rounded-xl p-4 w-full text-center border border-gray-600 shadow-xl mb-4">
              <div className="text-2xl font-black mb-1">{top3[1].name}</div>
              <div className="text-sm text-gray-400 mb-2">{top3[1].department} / {top3[1].totalScore}分</div>
              <div className="bg-red-700 text-white font-bold text-sm px-3 py-1.5 rounded-md border border-red-500">獎金 1000 元</div>
            </div>
            <div className="w-full bg-gradient-to-t from-gray-500 to-gray-300 rounded-t-lg flex flex-col items-center justify-end text-white pb-6 min-h-[220px] border-t-8 border-gray-200">
              <span className="font-black text-6xl text-gray-800 opacity-80">2</span>
            </div>
          </div>}
          {top3[0] && <div className="flex flex-col items-center w-full md:w-80 order-1 md:order-2">
            <div className="mb-4 relative">
              <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 text-7xl z-30">👑</div>
              {top3[0].image_url ? <img src={top3[0].image_url} className="w-36 h-36 md:w-48 md:h-48 rounded-full object-cover border-[8px] border-yellow-400 shadow-2xl relative z-20" alt={top3[0].name} /> : <div className="w-36 h-36 md:w-48 md:h-48 rounded-full bg-gray-200 border-[8px] border-yellow-400 flex items-center justify-center text-gray-400 text-4xl font-bold z-20">?</div>}
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black font-black text-lg px-8 py-1.5 rounded-full shadow-lg whitespace-nowrap z-30 border border-yellow-200">🥇 冠軍</div>
            </div>
            <div className="bg-gray-800/80 backdrop-blur-md text-white rounded-2xl p-5 w-[110%] text-center border border-yellow-500/50 shadow-2xl mb-4 mt-2 relative z-20">
              <div className="text-3xl font-black text-yellow-400 mb-1">{top3[0].name}</div>
              <div className="text-base text-gray-300 mb-3">{top3[0].department} / <span className="text-yellow-400 font-bold">{top3[0].totalScore}分</span></div>
              <div className="bg-gradient-to-r from-red-600 to-red-800 text-yellow-100 font-black text-lg px-4 py-2 rounded-lg border border-red-500">獎金 2000 元</div>
            </div>
            <div className="w-full bg-gradient-to-t from-yellow-600 via-yellow-500 to-yellow-300 rounded-t-xl flex flex-col items-center justify-end text-white pb-8 min-h-[280px] border-t-8 border-yellow-200">
              <span className="font-black text-8xl text-yellow-900 opacity-90">1</span>
            </div>
          </div>}
          {top3[2] && <div className="flex flex-col items-center w-full md:w-64 order-3 md:order-3">
            <div className="mb-4 relative">
              {top3[2].image_url ? <img src={top3[2].image_url} className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-[6px] border-orange-400 shadow-xl" alt={top3[2].name} /> : <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-gray-200 border-[6px] border-orange-400 flex items-center justify-center text-gray-400 text-3xl font-bold">?</div>}
              <div className="absolute top-[-20px] right-[-20px] bg-orange-400 text-orange-900 font-black text-sm px-4 py-1 rounded shadow-lg transform rotate-12 z-20">🥉 季軍</div>
            </div>
            <div className="bg-gray-800/60 backdrop-blur-md text-white rounded-xl p-4 w-full text-center border border-orange-500/30 shadow-xl mb-4">
              <div className="text-2xl font-black text-orange-300 mb-1">{top3[2].name}</div>
              <div className="text-sm text-gray-400 mb-2">{top3[2].department} / {top3[2].totalScore}分</div>
              <div className="bg-red-700 text-white font-bold text-sm px-3 py-1.5 rounded-md border border-red-500">獎金 500 元</div>
            </div>
            <div className="w-full bg-gradient-to-t from-orange-700 to-orange-400 rounded-t-lg flex flex-col items-center justify-end text-white pb-6 min-h-[190px] border-t-8 border-orange-200">
              <span className="font-black text-5xl text-orange-900 opacity-80">3</span>
            </div>
          </div>}
        </div>
      )}

      {others.length > 0 && <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-600 mt-12">
        <div className="bg-gray-800 px-8 py-4 border-b border-gray-600 flex justify-between items-center text-gray-200 font-bold">其他名次</div>
        <div className="overflow-x-auto bg-[#fdfbfb]">
          <table className="min-w-full divide-y divide-gray-300 text-left">
            <thead className="bg-[#f0ece9] border-b-2 border-[#d5cec8]">
              <tr>
                <th className="px-8 py-4 font-black">名次</th>
                <th className="px-8 py-4 font-black text-center">照片</th>
                <th className="px-8 py-4 font-black">部門 / 姓名</th>
                <th className="px-8 py-4 font-black">總得分</th>
                <th className="px-8 py-4 font-black">得票狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {others.map((r, i) => (
                <tr key={r.id} className="hover:bg-white/70 transition-colors">
                  <td className="px-8 py-6 font-black text-xl">第 <span className={i < 3 ? "text-4xl text-yellow-600 font-black" : "text-2xl font-black"}>{i + 4}</span> 名</td>
                  <td className="px-8 py-6 text-center">
                    {r.image_url ? <img src={r.image_url} className={`${i < 3 ? "w-32 h-32 mx-auto" : "w-16 h-16 mx-auto"} rounded-2xl object-cover border-4 border-[#d5cec8] shadow-md`} alt={r.name} /> : <div className={`${i < 3 ? "w-32 h-32 mx-auto" : "w-16 h-16 mx-auto"} rounded-2xl bg-[#f0ece9] border-4 border-[#d5cec8] flex items-center justify-center text-gray-400`}>無</div>}
                  </td>
                  <td className="px-8 py-5">
                    <div className="font-black text-gray-900 text-xl">{r.name}</div>
                    <div className="text-gray-600 text-sm">{r.department}</div>
                  </td>
                  <td className="px-8 py-5 font-black text-blue-800 text-2xl">{r.totalScore}</td>
                  <td className="px-8 py-5">
                    <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full">獲得 {r.voteCount} 票</span>
                    <div className="text-xs text-gray-500 mt-1">平均: {r.average}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}

function AdminVotingStatus() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);

  const loadData = () => { setLoading(true); apiCall('getVotingStatus', { adminToken: getAdminToken() }).then(res => { if (res) setData(res); setLoading(false); }); };
  useEffect(() => { loadData(); }, []);

  if (loading) return <Loading />;
  const voted = data.filter(d => d.hasVoted);
  const notVoted = data.filter(d => !d.hasVoted);

  return (
    <div className="animate-in fade-in duration-400 bg-white p-6 md:p-10 rounded-2xl shadow-lg border border-gray-200">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">📊 委員投票狀況監控</h2>
          <p className="text-gray-500">即時掌握每位委員的投票進度</p>
        </div>
        <button onClick={loadData} className="mt-4 md:mt-0 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold border border-blue-200">🔄 重新整理</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 text-center"><div className="text-blue-800 font-bold mb-2">總委員數</div><div className="text-5xl font-black text-blue-700">{data.length}</div></div>
        <div className="bg-green-50 p-6 rounded-xl border border-green-200 text-center"><div className="text-green-800 font-bold mb-2">✅ 已完成</div><div className="text-5xl font-black text-green-700">{voted.length}</div></div>
        <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center"><div className="text-red-800 font-bold mb-2">⏳ 尚未投票</div><div className="text-5xl font-black text-red-700">{notVoted.length}</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <div className="bg-red-50 px-6 py-4 border-b border-red-100 font-bold text-red-600">⏳ 催票名單 ({notVoted.length})</div>
          <div className="p-6 space-y-3">
            {notVoted.map(c => <div key={c.id} className="p-4 border-2 border-red-50 rounded-lg flex justify-between items-center"><div className="flex flex-col"><span className="text-sm text-gray-500">{c.department}</span><span className="text-xl font-black">{c.name}</span></div><span className="bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full font-bold">未投票</span></div>)}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <div className="bg-green-50 px-6 py-4 border-b border-green-100 font-bold text-green-600">✅ 已投票 ({voted.length})</div>
          <div className="p-6 space-y-3">
            {voted.map(c => <div key={c.id} onClick={() => setSelectedVoter(c)} className="p-4 border-2 border-green-50 rounded-lg flex justify-between items-center cursor-pointer hover:border-green-400 transition transform hover:scale-[1.02]"><div className="flex flex-col"><span className="text-sm text-gray-500">{c.department}</span><span className="text-xl font-black">{c.name}</span></div><span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-bold">點擊看明細 ➔</span></div>)}
          </div>
        </div>
      </div>

      {selectedVoter && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSelectedVoter(null)}>
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="bg-green-600 px-6 py-4 flex justify-between items-center text-white"><h3 className="text-xl font-black">{selectedVoter.name} 的明細</h3><button onClick={() => setSelectedVoter(null)} className="font-bold">✕</button></div>
          <div className="p-6 overflow-y-auto bg-gray-50 space-y-3">
            {selectedVoter.voteDetails?.map((vd: any, i: number) => <div key={i} className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-xl font-bold text-gray-800"><span>{i + 1}. {vd.candidateName}</span><span className="text-green-700 text-xl">{vd.score}分</span></div>)}
          </div>
        </div>
      </div>}
    </div>
  );
}

function AdminCandidates() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => { setLoading(true); apiCall('getCandidates').then(res => { if (res) setData(res); setLoading(false); }); };
  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除？這將同步刪除所有該候選人的歷史得票！')) return;
    const res = await apiCall('deleteCandidate', { id, adminToken: getAdminToken() });
    if (res?.success) { alert('已刪除'); loadData(); }
  };

  const handleAdd = async () => {
    const dept = prompt('部門:'); if (!dept) return;
    const name = prompt('姓名:'); if (!name) return;
    const desc = prompt('事蹟簡介:'); if (!desc) return;
    const res = await apiCall('addCandidate', { department: dept, name, description: desc, adminToken: getAdminToken() });
    if (res?.success) loadData();
  };

  const handleUploadImage = async (id: number) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: any) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX = 800; let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
          else { if (h > MAX) { w *= MAX / h; h = MAX; } }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
          setLoading(true);
          const res = await apiCall('uploadImage', { id, image_url: canvas.toDataURL('image/jpeg', 0.8), adminToken: getAdminToken() });
          if (res?.success) { alert('成功'); loadData(); } else setLoading(false);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  if (loading) return <Loading />;
  return (
    <div className="animate-in fade-in duration-400">
      <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-bold">候選人管理</h2><button onClick={handleAdd} className="bg-green-600 text-white px-4 py-2 rounded font-bold">+ 新增</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map(c => <div key={c.id} className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <button onClick={() => handleDelete(c.id)} className="float-right text-red-500 font-bold text-xs bg-red-50 px-2 py-1 rounded">刪除</button>
          <div onClick={() => handleUploadImage(c.id)} className="w-full h-48 bg-gray-50 rounded-lg mb-4 flex items-center justify-center cursor-pointer border border-dashed border-gray-300 overflow-hidden">
            {c.image_url ? <img src={c.image_url} className="w-full h-full object-cover" /> : <span className="text-gray-400">+ 圖片</span>}
          </div>
          <div className="text-sm font-bold text-blue-600">{c.department}</div><div className="text-xl font-black mb-2">{c.name}</div><p className="text-gray-500 text-sm h-20 overflow-y-auto whitespace-pre-wrap">{c.description}</p>
        </div>)}
      </div>
    </div>
  );
}

function AdminCommittees() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const loadData = () => { setLoading(true); apiCall('getCommittees').then(res => { if (res) setData(res); setLoading(false); }); };
  useEffect(() => { loadData(); }, []);
  const handleDelete = async (id: number) => { if (confirm('確認？')) { const res = await apiCall('deleteCommittee', { id, adminToken: getAdminToken() }); if (res?.success) loadData(); } };
  if (loading) return <Loading />;
  return (
    <div className="bg-white p-6 rounded-xl shadow border animate-in fade-in duration-400">
      <h2 className="text-2xl font-bold mb-6">委員名單</h2>
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b"><tr><th className="p-4">部門</th><th className="p-4">姓名</th><th className="p-4">狀態</th><th className="p-4">操作</th></tr></thead>
        <tbody className="divide-y">{data.map(c => <tr key={c.id}><td className="p-4">{c.department}</td><td className="p-4">{c.name}</td><td className="p-4 text-green-600 font-bold">✔ 設定</td><td className="p-4"><button onClick={() => handleDelete(c.id)} className="text-red-500 font-bold">刪除</button></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function VoterPanel({ user, onLogout }: { user: any, onLogout: any, setView: any }) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [scores, setScores] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    Promise.all([apiCall('getCandidates', { noImage: true }), apiCall('getVotes', { sessionToken: getSessionToken() })]).then(([c, v]) => {
      if (c) setCandidates(c);
      if (v && Array.isArray(v)) {
        const init: any = {};
        v.forEach(x => { const id = x.candidate_id || x.candidateId; if (id) init[id] = Number(x.score); });
        setScores(init);
      }
      setLoading(false);
      apiCall('getCandidates').then(f => { if (f) setCandidates(f); });
    });
  }, []);

  const handleScoreChange = (id: number, val: number) => setScores((p: any) => ({ ...p, [id]: val }));
  const handlePreSubmit = () => { if (candidates.some(c => !scores[c.id])) { alert('請全數評分'); return; } setShowConfirm(true); };
  const handleSubmit = async () => {
    setSaving(true);
    const votes = candidates.map(c => ({ candidateId: c.id, score: scores[c.id] }));
    const res = await apiCall('vote', { sessionToken: getSessionToken(), votes });
    setSaving(false);
    if (res?.success) { setShowConfirm(false); confetti(); alert('成功'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50 pb-32 animate-in fade-in duration-400">
      <div className="bg-blue-600 text-white shadow-md sticky top-0 z-40 px-4 py-4 flex justify-between items-center"><div className="font-bold">評選區 ({user.name})</div><button onClick={onLogout} className="bg-blue-800 px-3 py-1 rounded text-sm font-bold">登出</button></div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {candidates.map(c => (
          <div key={c.id} id={`cand-${c.id}`} className="bg-white rounded-2xl shadow-sm border p-6 flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-48 h-48 md:h-full bg-gray-100 rounded-xl overflow-hidden">{c.image_url ? <img src={c.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300">無圖</div>}</div>
            <div className="flex-grow flex flex-col justify-between">
              <div><div className="text-blue-600 font-bold">{c.department}</div><div className="text-2xl font-black mb-2">{c.name}</div><p className="text-gray-600 whitespace-pre-wrap text-sm">{c.description}</p></div>
              <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between mt-4">
                <span className="font-bold">評分：</span>
                <div className="flex gap-2">{[1, 2, 3, 4, 5].map(s => <button key={s} onClick={() => handleScoreChange(c.id, s)} className={`w-10 h-10 rounded-full font-bold transition ${scores[c.id] === s ? 'bg-yellow-400 text-white ring-4 ring-yellow-100' : 'bg-white border text-gray-400'}`}>{s}</button>)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 z-50 shadow-2xl flex justify-between items-center max-w-4xl mx-auto left-1/2 -translate-x-1/2 px-8">
        <div className="font-bold text-blue-600">已評分: {Object.keys(scores).filter(k => scores[k]).length} / {candidates.length}</div>
        <button onClick={handlePreSubmit} disabled={saving} className="bg-green-600 text-white font-black py-3 px-12 rounded-full text-lg shadow-lg">送出</button>
      </div>
      {showConfirm && <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <div className="bg-blue-600 p-5 text-white font-black text-2xl">確認評分</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {candidates.map((c, i) => <div key={c.id} className="flex justify-between border-b py-2"><span className="font-bold">{i + 1}. {c.name}</span><span className="text-blue-600 font-black text-xl">{scores[c.id]}分</span></div>)}
          </div>
          <div className="p-4 bg-gray-50 flex gap-4"><button onClick={() => setShowConfirm(false)} className="flex-1 bg-white border font-bold py-3 rounded-xl">返回</button><button onClick={handleSubmit} disabled={saving} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl">確認送出</button></div>
        </div>
      </div>}
    </div>
  );
}

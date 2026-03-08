import React, { useState, useEffect, useRef } from 'react';
import { LogIn, Trophy, LogOut, CheckCircle, Upload, Image as ImageIcon, Users, UserPlus, Edit2, Trash2, Plus, Crown, Medal, Award, Star } from 'lucide-react';
import confetti from 'canvas-confetti';

type Committee = {
  id: number;
  department: string;
  name: string;
  login_code: string;
};

type Candidate = {
  id: number;
  department: string;
  name: string;
  description: string;
  image_url: string | null;
};

type Result = {
  id: number;
  department: string;
  name: string;
  description: string;
  image_url: string | null;
  total_score: number;
  vote_count: number;
};

const GAS_URL = (import.meta as any).env.VITE_GAS_URL || '';

export default function App() {
  const [systemAuth, setSystemAuth] = useState<'admin' | 'voter' | null>(null);
  const [user, setUser] = useState<Committee | null>(null);
  const [view, setView] = useState<'vote' | 'results' | 'admin_candidates' | 'admin_committees' | ''>('');

  useEffect(() => {
    const savedAuth = localStorage.getItem('system_auth');
    const savedUser = localStorage.getItem('committee_user');

    if (savedAuth === 'admin') {
      setSystemAuth('admin');
      setUser({ id: 0, department: '系統', name: '管理員', login_code: 'ADMIN' });
      setView('results');
    } else if (savedAuth === 'voter' && savedUser) {
      setSystemAuth('voter');
      setUser(JSON.parse(savedUser));
      setView('vote');
    }
  }, []);

  const handleSystemAuth = (role: 'admin' | 'voter') => {
    setSystemAuth(role);
    if (role === 'admin') {
      const adminUser = { id: 0, department: '系統', name: '管理員', login_code: 'ADMIN' };
      setUser(adminUser);
      localStorage.setItem('system_auth', 'admin');
      setView('results');
    }
  };

  const handleVoterLogin = (committee: Committee) => {
    setUser(committee);
    localStorage.setItem('system_auth', 'voter');
    localStorage.setItem('committee_user', JSON.stringify(committee));
    setView('vote');
  };

  const handleLogout = () => {
    setUser(null);
    setSystemAuth(null);
    localStorage.removeItem('system_auth');
    localStorage.removeItem('committee_user');
    setView('');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-emerald-600 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-300" />
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">114年度從業人員安全衛生優良事蹟評選</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-emerald-700 px-2 py-0.5 rounded text-emerald-100 font-mono">v2.3</span>
                <span className="text-xs text-emerald-200 cursor-help" title="v2.3 更新：支援頒獎音樂播放與成績版面優化">版本說明</span>
              </div>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <span className="bg-emerald-700 px-3 py-1 rounded-full text-sm font-medium border border-emerald-500 shadow-inner">
                {user.login_code === 'ADMIN' ? '管理員' : '委員'}：{user.name}
              </span>

              {user.login_code === 'ADMIN' && (
                <>
                  <button
                    onClick={() => setView('admin_committees')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === 'admin_committees' ? 'bg-emerald-800 text-white shadow-inner' : 'hover:bg-emerald-500'}`}
                  >
                    委員管理
                  </button>
                  <button
                    onClick={() => setView('admin_candidates')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === 'admin_candidates' ? 'bg-emerald-800 text-white shadow-inner' : 'hover:bg-emerald-500'}`}
                  >
                    候選人管理
                  </button>
                  <button
                    onClick={() => setView('results')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === 'results' ? 'bg-emerald-800 text-white shadow-inner' : 'hover:bg-emerald-500'}`}
                  >
                    總評選結果
                  </button>
                </>
              )}

              {user.login_code !== 'ADMIN' && (
                <button
                  onClick={() => setView('vote')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === 'vote' ? 'bg-emerald-800 text-white shadow-inner' : 'hover:bg-emerald-500'}`}
                >
                  評選 / 我的紀錄
                </button>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-emerald-100 hover:text-white transition-colors text-sm font-medium ml-2"
              >
                <LogOut className="w-4 h-4" />
                登出
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!systemAuth && <SystemLogin onAuth={handleSystemAuth} />}
        {systemAuth === 'voter' && !user && <VoterVerification onLogin={handleVoterLogin} onBack={() => setSystemAuth(null)} />}
        {user && view === 'vote' && <Evaluation user={user} />}
        {user?.login_code === 'ADMIN' && view === 'results' && <Results />}
        {user?.login_code === 'ADMIN' && view === 'admin_candidates' && <AdminCandidates />}
        {user?.login_code === 'ADMIN' && view === 'admin_committees' && <AdminCommittees />}
      </main>
    </div>
  );
}

function SystemLogin({ onAuth }: { onAuth: (role: 'admin' | 'voter') => void }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (account === 'admin' && password === 'ad') {
      onAuth('admin');
    } else if (account === 'vote' && password === '0505') {
      onAuth('voter');
    } else {
      setError('系統帳號或密碼錯誤');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">系統登入</h2>
        <p className="text-slate-500 mt-2">請輸入系統存取帳號與密碼</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">帳號</label>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">密碼</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">{error}</p>}
        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors text-lg">
          進入系統
        </button>
      </form>
    </div>
  );
}

function VoterVerification({ onLogin, onBack }: { onLogin: (user: Committee) => void, onBack: () => void }) {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${GAS_URL}?action=getCommittees`)
      .then(res => res.json())
      .then(data => {
        const validCommittees = data.filter((c: Committee) => c.login_code !== 'ADMIN');
        setCommittees(validCommittees);

        const depts = Array.from(new Set(validCommittees.map((c: Committee) => c.department).filter(Boolean))) as string[];
        setDepartments(depts);

        if (depts.length > 0) {
          setSelectedDept(depts[0]);
          const firstDeptUsers = validCommittees.filter((c: Committee) => c.department === depts[0]);
          if (firstDeptUsers.length > 0) setSelectedName(firstDeptUsers[0].name);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('無法連線到伺服器，請檢查 GAS URL 是否正確。');
        setLoading(false);
      });
  }, []);

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dept = e.target.value;
    setSelectedDept(dept);
    const deptUsers = committees.filter(c => c.department === dept);
    if (deptUsers.length > 0) setSelectedName(deptUsers[0].name);
    else setSelectedName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', name: selectedName, login_code: code })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          onLogin(data.committee);
        } else {
          setError(data.message || '姓名代號錯誤，請重新輸入。');
        }
      })
      .catch(() => setError('驗證發生錯誤'));
  };

  if (loading) return <div className="text-center py-12 text-slate-500">載入委員資料中...</div>;

  const currentDeptUsers = committees.filter(c => c.department === selectedDept);

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative">
      <button onClick={onBack} className="absolute top-6 left-6 text-slate-400 hover:text-slate-600">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
      </button>

      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">委員身分確認</h2>
        <p className="text-slate-500 mt-2">請選擇您的部門與姓名，並輸入代號</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">部門</label>
          <select
            value={selectedDept}
            onChange={handleDeptChange}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
          >
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">委員姓名</label>
          <select
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
          >
            {currentDeptUsers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">姓名代號</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
            placeholder="請輸入您的專屬數字代號"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors text-lg mt-2">
          確認身分並開始投票
        </button>
      </form>
    </div>
  );
}

function AdminCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ department: '', name: '', description: '' });
  const [isAdding, setIsAdding] = useState(false);

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`${GAS_URL}?action=getCandidates`);
      const data = await res.json();
      setCandidates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleImageUpload = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('圖片檔案過大，請上傳小於 1MB 的圖片。');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result;
      try {
        const res = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'uploadImage', id, image_url: base64String })
        });
        const data = await res.json();
        if (data.success) {
          fetchCandidates();
        } else {
          alert('上傳失敗');
        }
      } catch (err) {
        console.error(err);
        alert('發生錯誤');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (id: number | null) => {
    if (!editForm.name || !editForm.department || !editForm.description) {
      alert('請填寫完整資訊');
      return;
    }

    try {
      const action = id ? 'updateCandidate' : 'addCandidate';

      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, ...editForm })
      });

      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        setIsAdding(false);
        setEditForm({ department: '', name: '', description: '' });
        fetchCandidates();
      } else {
        alert(data.message || '儲存失敗');
      }
    } catch (err) {
      console.error(err);
      alert('發生錯誤');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此候選人嗎？相關的投票紀錄也會受到影響。')) return;
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteCandidate', id })
      });
      const data = await res.json();
      if (data.success) {
        fetchCandidates();
      } else {
        alert(data.message || '刪除失敗');
      }
    } catch (err) {
      console.error(err);
      alert('發生錯誤');
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">載入中...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">候選人管理</h2>
          <p className="text-slate-500 mt-1">管理員可在此新增、修改、刪除候選人，以及上傳照片。</p>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setEditForm({ department: '', name: '', description: '' });
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          新增候選人
        </button>
      </div>

      <div className="space-y-6">
        {isAdding && (
          <div className="bg-emerald-50 p-6 rounded-2xl shadow-sm border border-emerald-100">
            <h3 className="font-bold text-emerald-800 mb-4">新增候選人</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">部門</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="例如：生產部"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="輸入姓名"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">優良事蹟簡介</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                placeholder="描述該候選人的優良事蹟..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded transition-colors">取消</button>
              <button onClick={() => handleSave(null)} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded transition-colors">儲存</button>
            </div>
          </div>
        )}

        {candidates.map(candidate => (
          <div key={candidate.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-32 h-48 md:h-32 flex-shrink-0 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative group">
              {candidate.image_url ? (
                <img src={candidate.image_url} alt={candidate.name} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-10 h-10 text-slate-300" />
              )}
              <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">上傳圖片</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(candidate.id, e)}
                />
              </label>
            </div>

            <div className="flex-1 w-full">
              {editingId === candidate.id ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full sm:w-1/3 px-3 py-1.5 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="部門"
                    />
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full sm:w-2/3 px-3 py-1.5 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="姓名"
                    />
                  </div>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                    placeholder="優良事蹟簡介"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded text-sm transition-colors">取消</button>
                    <button onClick={() => handleSave(candidate.id)} className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-sm transition-colors">儲存</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                        #{candidate.id}
                      </span>
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        {candidate.department}
                      </span>
                      <h3 className="text-xl font-bold text-slate-800">{candidate.name}</h3>
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => {
                          setEditingId(candidate.id);
                          setEditForm({ department: candidate.department, name: candidate.name, description: candidate.description });
                          setIsAdding(false);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="編輯"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(candidate.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                    {candidate.description}
                  </p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Evaluation({ user }: { user: Committee }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [candRes, voteRes] = await Promise.all([
          fetch(`${GAS_URL}?action=getCandidates`),
          fetch(`${GAS_URL}?action=getVotes&committee_code=${user.login_code}`)
        ]);

        const candData = await candRes.json();
        const voteData = await voteRes.json();

        setCandidates(candData);

        const initialScores: Record<number, number> = {};
        voteData.forEach((v: any) => {
          initialScores[v.candidate_id] = v.score;
        });
        setScores(initialScores);
        if (voteData.length > 0) {
          setHasVoted(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.login_code]);

  const handleScoreChange = (candidateId: number, score: number) => {
    setScores(prev => ({ ...prev, [candidateId]: score }));
    setSuccess(false);
  };

  const handlePreSubmit = () => {
    if (Object.keys(scores).length !== candidates.length) {
      alert('請為所有候選人評分！');
      return;
    }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const votes = Object.entries(scores).map(([candidateId, score]) => ({
        candidateId: parseInt(candidateId),
        score
      }));

      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', committee_code: user.login_code, votes })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setHasVoted(true);
        setShowConfirm(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(data.message || '提交失敗');
      }
    } catch (err) {
      console.error(err);
      alert('發生錯誤');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">載入中...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">候選人評選</h2>
          <p className="text-slate-500 mt-1">請針對每位候選人的優良事蹟給予 1 到 5 分的評價（5分為最高）。</p>
        </div>
        <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg font-medium w-full sm:w-auto text-center">
          已評分: {Object.keys(scores).length} / {candidates.length}
        </div>
      </div>

      {hasVoted && !success && (
        <div className="mb-8 bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <CheckCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-bold">您已完成投票！</p>
            <p className="text-sm">如需修改，請重新調整下方分數並點擊「更新評分結果」。</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-8 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <CheckCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-bold">評分提交成功！</p>
            <p className="text-sm">感謝您的參與，您的評分已記錄至系統中。</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {candidates.map(candidate => (
          <div key={candidate.id} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 md:gap-6 items-stretch">
            {/* Candidate Info Section */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="w-full sm:w-32 h-48 sm:h-32 flex-shrink-0 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                {candidate.image_url ? (
                  <img src={candidate.image_url} alt={candidate.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                    #{candidate.id}
                  </span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                    {candidate.department}
                  </span>
                  <h3 className="text-xl font-bold text-slate-800">{candidate.name}</h3>
                </div>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-100 text-sm md:text-base whitespace-pre-wrap">
                  {candidate.description}
                </p>
              </div>
            </div>

            {/* Score Selection Section (RWD Optimized) */}
            <div className="w-full md:w-64 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 mt-2 md:mt-0">
              <p className="text-sm font-bold text-slate-500 mb-3 text-center md:text-left">請選擇評分 (1-5)</p>
              <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5].map(score => {
                  const isActive = scores[candidate.id] === score;
                  let baseClass = 'flex-1 aspect-square md:aspect-auto md:h-12 rounded-xl font-bold transition-all flex items-center justify-center text-lg md:text-base ';
                  let colorClass = '';

                  if (isActive) {
                    if (score === 5) colorClass = 'bg-amber-500 text-white shadow-lg ring-4 ring-amber-200 transform scale-110 z-10';
                    else if (score === 4) colorClass = 'bg-emerald-500 text-white shadow-md transform scale-105';
                    else if (score === 3) colorClass = 'bg-blue-500 text-white shadow-md transform scale-105';
                    else colorClass = 'bg-slate-600 text-white shadow-md transform scale-105';
                  } else {
                    if (score === 5) colorClass = 'bg-amber-50 text-amber-600 border-2 border-amber-200 hover:bg-amber-100';
                    else colorClass = 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                  }

                  return (
                    <button
                      key={score}
                      onClick={() => handleScoreChange(candidate.id, score)}
                      className={baseClass + colorClass}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-2 px-1">
                <span>較低</span>
                <span className="text-amber-500 font-bold">最高分</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex justify-end">
        <button
          onClick={handlePreSubmit}
          disabled={submitting}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold py-4 px-12 rounded-xl shadow-md transition-colors text-lg flex items-center justify-center gap-2"
        >
          {submitting ? '處理中...' : (hasVoted ? '更新評分結果' : '確認提交評分')}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl scale-in-center">
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/80 rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                確認您的評分
              </h3>
              <p className="text-sm text-slate-500 mt-2">請再次確認您給予各候選人的分數，送出後即完成投票。</p>
            </div>

            <div className="px-5 sm:px-6 py-4 overflow-y-auto flex-1 bg-white stylish-scrollbar">
              <ul className="space-y-3">
                {candidates.map((candidate, index) => (
                  <li key={candidate.id} className="flex justify-between items-center p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{candidate.name}</span>
                        <span className="text-[10px] text-slate-500">{candidate.department}</span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black ${scores[candidate.id] >= 4 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {scores[candidate.id]}
                      </span>
                      <span className="text-sm text-slate-500 font-medium">分</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/80 rounded-b-2xl flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                返回修改
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? '送出中...' : '確認投下神聖的一票'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Results() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`${GAS_URL}?action=getResults`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  useEffect(() => {
    if (!loading && results.length > 0) {
      if (audioRef.current && isPlaying) {
        audioRef.current.volume = 0.5;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log("Auto-play was prevented by browser. User interaction is needed.", error);
            setIsPlaying(false);
          });
        }
      }

      // Trigger Confetti after 1st place pops up (approx 1.5s)
      setTimeout(() => {
        const duration = 3000;
        const end = Date.now() + duration;
        const frame = () => {
          confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ffc107', '#198754', '#0dcaf0', '#dc3545'] });
          confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ffc107', '#198754', '#0dcaf0', '#dc3545'] });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      }, 1500);
    }
  }, [loading, results.length]);

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.log('Play blocked', e));
    }
    setIsPlaying(!isPlaying);
  };

  if (loading) return <div className="text-center py-12 text-slate-500">載入中...</div>;

  const top3 = results.slice(0, 3);
  const others = results.slice(3);

  // Reorder for podium: 2nd, 1st, 3rd
  const podiumOrder = [
    { ...top3[1], rank: 2, color: 'bg-slate-200', border: 'border-slate-300', text: 'text-slate-700', height: 'h-40 md:h-48', icon: <Medal className="w-8 h-8 text-slate-500 mb-2" />, animation: 'delay-2nd' },
    { ...top3[0], rank: 1, color: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800', height: 'h-52 md:h-64', icon: <Crown className="w-10 h-10 text-yellow-500 mb-2" />, animation: 'delay-1st glow-effect' },
    { ...top3[2], rank: 3, color: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', height: 'h-32 md:h-36', icon: <Medal className="w-8 h-8 text-orange-500 mb-2" />, animation: 'delay-3rd' }
  ].filter(item => item.id !== undefined);

  return (
    <div className="max-w-5xl mx-auto">
      <style>{`
        @keyframes popUp {
          0% { transform: translateY(150px) scale(0.8); opacity: 0; }
          70% { transform: translateY(-15px) scale(1.05); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .delay-1st { animation: popUp 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.5s forwards; opacity: 0; }
        .delay-2nd { animation: popUp 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.8s forwards; opacity: 0; }
        .delay-3rd { animation: popUp 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s forwards; opacity: 0; }
        
        @keyframes glow {
          0% { box-shadow: 0 0 5px rgba(255, 193, 7, 0.5); }
          50% { box-shadow: 0 0 20px rgba(255, 193, 7, 0.8), 0 0 30px rgba(255, 193, 7, 0.6); }
          100% { box-shadow: 0 0 5px rgba(255, 193, 7, 0.5); }
        }
        .glow-effect .podium-avatar-container { animation: glow 2s infinite; border-radius: 50%; }
      `}</style>

      {/* Floating Music Control - Sticky position for better visibility */}
      <div className="fixed top-24 right-4 sm:right-6 md:right-10 z-[60]">
        <button
          onClick={toggleMusic}
          className={`group flex items-center gap-2 p-2 sm:p-3 rounded-full shadow-xl transition-all duration-300 border-2 ${isPlaying
            ? 'bg-emerald-500 text-white border-emerald-400 animate-pulse'
            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          title={isPlaying ? '暫停音樂' : '播放音樂'}
        >
          {isPlaying ? (
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
              <span className="text-xs font-bold pr-1 hidden sm:inline">音樂播放中</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
              <span className="text-xs font-bold pr-1 hidden sm:inline">點擊播放音樂</span>
            </div>
          )}
        </button>
      </div>

      <div className="mb-12 text-center relative">
        <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 mb-4 flex items-center justify-center gap-3">
          <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-500" />
          評選結果排行榜
          <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-500" />
        </h2>
        <p className="text-slate-500 text-base md:text-lg">榮耀時刻！感謝所有同仁對安全衛生的貢獻</p>
      </div>

      {/* Background Music Audio Element - Using Google Drive Direct Link */}
      <audio
        ref={audioRef}
        loop
        src="https://docs.google.com/uc?export=download&id=17MYcOotHEa80azLHazjBUdaKUt3mLtKp"
      />

      {/* Podium Section */}
      {podiumOrder.length > 0 && (
        <div className="flex justify-center items-end gap-2 md:gap-6 mb-16 mt-8 px-2 overflow-hidden pb-4">
          {podiumOrder.map((cand) => (
            <div key={cand.id} className={`flex flex-col items-center w-1/3 max-w-[200px] ${cand.animation}`}>
              {/* Avatar & Info */}
              <div className="flex flex-col items-center mb-4 text-center z-10 relative">
                <div className={`podium-avatar-container w-16 h-16 md:w-28 md:h-28 rounded-full border-4 ${cand.border} overflow-hidden bg-white shadow-lg mb-3 relative`}>
                  {cand.image_url ? (
                    <img src={cand.image_url} alt={cand.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      <ImageIcon className="w-8 h-8 md:w-10 md:h-10 text-slate-300" />
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 md:w-8 md:h-8 rounded-full ${cand.color} border-2 border-white flex items-center justify-center font-bold shadow-sm text-xs md:text-base`}>
                    {cand.rank}
                  </div>
                </div>
                <h3 className="font-bold text-sm md:text-lg text-slate-800 line-clamp-1">{cand.name}</h3>
                <p className="text-[10px] md:text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full mt-1 line-clamp-1">{cand.department}</p>
                <div className="mt-2 font-black text-lg md:text-2xl text-emerald-600">{cand.total_score} <span className="text-[10px] md:text-sm font-normal text-slate-500">分</span></div>
              </div>

              {/* Podium Block */}
              <div className={`w-full ${cand.height} ${cand.color} border-t-4 ${cand.border} rounded-t-xl shadow-inner flex flex-col items-center justify-start pt-4 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-white/20"></div>
                {cand.icon}
                <span className={`font-black text-3xl md:text-4xl opacity-20 ${cand.text}`}>{cand.rank}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Others List */}
      {others.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 px-4 md:px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-slate-500" />
            <h3 className="font-bold text-slate-700">優良事蹟獎</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {others.map((result, index) => (
              <div key={result.id} className="p-4 md:p-6 flex items-center gap-3 md:gap-6 hover:bg-slate-50 transition-colors">
                <div className="w-6 md:w-10 text-center font-bold text-slate-400 text-base md:text-lg">
                  {index + 4}
                </div>
                {result.image_url ? (
                  <img src={result.image_url} alt={result.name} className="w-10 h-10 md:w-16 md:h-16 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm flex-shrink-0">
                    <ImageIcon className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-bold text-slate-800 text-base md:text-lg truncate">{result.name}</h4>
                    <span className="text-[10px] md:text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">{result.department}</span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-500 line-clamp-1 md:line-clamp-2">{result.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-lg md:text-xl text-emerald-600">{result.total_score}</div>
                  <div className="text-[10px] md:text-xs text-slate-400">{result.vote_count} 票</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminCommittees() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ department: '', name: '', login_code: '' });
  const [isAdding, setIsAdding] = useState(false);

  const fetchCommittees = async () => {
    try {
      const res = await fetch(`${GAS_URL}?action=getCommittees`);
      const data = await res.json();
      setCommittees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommittees();
  }, []);

  const handleSave = async (id: number | null) => {
    if (!editForm.name || !editForm.login_code) {
      alert('姓名與代號不可為空');
      return;
    }

    try {
      const action = id ? 'updateCommittee' : 'addCommittee';

      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, ...editForm })
      });

      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        setIsAdding(false);
        setEditForm({ name: '', login_code: '' });
        fetchCommittees();
      } else {
        alert(data.message || '儲存失敗');
      }
    } catch (err) {
      console.error(err);
      alert('發生錯誤');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此委員嗎？')) return;
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteCommittee', id })
      });
      const data = await res.json();
      if (data.success) {
        fetchCommittees();
      } else {
        alert(data.message || '刪除失敗');
      }
    } catch (err) {
      console.error(err);
      alert('發生錯誤');
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">載入中...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            委員管理
          </h2>
          <p className="text-slate-500 mt-1">管理員可在此新增、修改或刪除評選委員。</p>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setEditForm({ department: '', name: '', login_code: '' });
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
        >
          <UserPlus className="w-4 h-4" />
          新增委員
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="py-4 px-6 font-semibold text-slate-600">委員ID</th>
                <th className="py-4 px-6 font-semibold text-slate-600">部門</th>
                <th className="py-4 px-6 font-semibold text-slate-600">委員姓名</th>
                <th className="py-4 px-6 font-semibold text-slate-600">登入代號(密碼)</th>
                <th className="py-4 px-6 font-semibold text-slate-600 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {isAdding && (
                <tr className="border-b border-slate-50 bg-emerald-50/50">
                  <td className="py-4 px-6 text-slate-400">新增</td>
                  <td className="py-4 px-6">
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="輸入部門"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="輸入姓名"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      value={editForm.login_code}
                      onChange={e => setEditForm({ ...editForm, login_code: e.target.value })}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="輸入數字代號"
                    />
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <button onClick={() => handleSave(null)} className="text-emerald-600 hover:text-emerald-800 font-medium mr-3">儲存</button>
                    <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-slate-700 font-medium">取消</button>
                  </td>
                </tr>
              )}
              {committees.map((committee) => (
                <tr key={committee.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 text-slate-500">#{committee.id}</td>
                  <td className="py-4 px-6">
                    {editingId === committee.id ? (
                      <input
                        type="text"
                        value={editForm.department}
                        onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                        className="w-full px-3 py-1.5 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    ) : (
                      <span className="text-slate-600">{committee.department}</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {editingId === committee.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    ) : (
                      <span className="font-medium text-slate-800">{committee.name}</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {editingId === committee.id ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        value={editForm.login_code}
                        onChange={e => setEditForm({ ...editForm, login_code: e.target.value })}
                        className="w-full px-3 py-1.5 rounded border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    ) : (
                      <span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded text-sm">{committee.login_code}</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    {editingId === committee.id ? (
                      <>
                        <button onClick={() => handleSave(committee.id)} className="text-emerald-600 hover:text-emerald-800 font-medium mr-3">儲存</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-700 font-medium">取消</button>
                      </>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingId(committee.id);
                            setEditForm({ department: committee.department || '', name: committee.name, login_code: committee.login_code });
                            setIsAdding(false);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="編輯"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {committee.login_code !== 'ADMIN' && (
                          <button
                            onClick={() => handleDelete(committee.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import './Admin.css';

const PROD_BACKEND = "https://bafly-ej4m.onrender.com";
const API_URL =
  window.location.hostname === "localhost"
    ? ""
    : window.location.hostname === "bafly.net" || window.location.hostname.endsWith(".netlify.app")
      ? PROD_BACKEND
      : import.meta.env.VITE_API_URL || PROD_BACKEND;

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDuration = (s) => { if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s / 60); return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`; };

const BAN_DURATIONS = [
  { label: '1 Dia', days: 1 },
  { label: '7 Dias', days: 7 },
  { label: '30 Dias', days: 30 },
  { label: 'Permanente', days: null },
];

const expiresAt = (days) => days ? new Date(Date.now() + days * 86400000).toISOString() : null;

const Admin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('admin_token'));
  const [tab, setTab] = useState('dashboard');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard
  const [stats, setStats] = useState({ sessionsToday: 0, onlineNow: 0, pendingReports: 0, avgSessionTime: 0 });
  const [dailyStats, setDailyStats] = useState([]);

  // Reports
  const [reports, setReports] = useState([]);
  const [banDurations, setBanDurations] = useState({});

  // Users
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);

  // Bans
  const [bans, setBans] = useState([]);

  const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_token')}` });

  const logout = () => { localStorage.removeItem('admin_token'); setIsLoggedIn(false); };

  const checkAuth = (res) => { if (res.status === 401 || res.status === 403) { logout(); return false; } return true; };

  const fetchDashboard = useCallback(async () => {
    try {
      const [sRes, dRes] = await Promise.all([
        fetch(`${API_URL}/api/stats/summary`, { headers: auth() }),
        fetch(`${API_URL}/api/stats/daily`, { headers: auth() }),
      ]);
      if (!checkAuth(sRes)) return;
      if (sRes.ok) setStats(await sRes.json());
      if (dRes.ok) setDailyStats(await dRes.json());
    } catch {}
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports/pending`, { headers: auth() });
      if (!checkAuth(res)) return;
      if (res.ok) setReports(await res.json());
    } catch {}
  }, []);

  const fetchUsers = useCallback(async (search = '', page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users?search=${encodeURIComponent(search)}&page=${page}`, { headers: auth() });
      if (!checkAuth(res)) return;
      if (res.ok) { const d = await res.json(); setUsers(d.users); setUserTotal(d.total); }
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchBans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/bans`, { headers: auth() });
      if (!checkAuth(res)) return;
      if (res.ok) setBans(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchDashboard();
    fetchReports();
    const iv = setInterval(() => { fetchDashboard(); fetchReports(); }, 30000);
    return () => clearInterval(iv);
  }, [isLoggedIn, fetchDashboard, fetchReports]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (tab === 'users') fetchUsers(userSearch, userPage);
    if (tab === 'bans') fetchBans();
  }, [tab, isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (res.ok && data.token && data.user?.role === 'admin') {
        localStorage.setItem('admin_token', data.token);
        setIsLoggedIn(true);
      } else {
        setLoginError('Credenciais inválidas ou sem permissão admin.');
      }
    } catch { setLoginError('Erro de ligação ao servidor.'); }
  };

  const dismissReport = async (id) => {
    await fetch(`${API_URL}/api/reports/dismiss/${id}`, { method: 'POST', headers: auth() });
    fetchReports(); fetchDashboard();
  };

  const banUser = async (userId, reportId, days) => {
    await fetch(`${API_URL}/api/reports/ban`, {
      method: 'POST', headers: auth(),
      body: JSON.stringify({ user_id: userId, reason: 'Violação dos termos de serviço', expires_at: expiresAt(days) })
    });
    if (reportId) await fetch(`${API_URL}/api/reports/dismiss/${reportId}`, { method: 'POST', headers: auth() });
    fetchReports(); fetchDashboard();
    if (tab === 'users') fetchUsers(userSearch, userPage);
    if (tab === 'bans') fetchBans();
  };

  const unbanUser = async (userId) => {
    await fetch(`${API_URL}/api/admin/unban/${userId}`, { method: 'POST', headers: auth() });
    fetchBans(); fetchDashboard();
    if (tab === 'users') fetchUsers(userSearch, userPage);
  };

  const handleUserSearch = (e) => {
    e.preventDefault();
    setUserPage(1);
    fetchUsers(userSearch, 1);
  };

  // Chart
  const chartData = [...(dailyStats || [])].reverse().map(d => ({ label: new Date(d.date).toLocaleDateString('pt-PT', { weekday: 'short' }), value: Number(d.total_sessions) || 0 }));
  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  if (!isLoggedIn) {
    return (
      <div className="adm-login-page">
        <div className="adm-login-card">
          <div className="adm-logo"><span className="logo-ba">BA</span><span className="logo-fly">FLY</span></div>
          <p className="adm-login-sub">Painel de Administração</p>
          {loginError && <div className="adm-error">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <input type="text" placeholder="Utilizador" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            <button type="submit">ENTRAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-root">
      {/* Header */}
      <header className="adm-header">
        <div className="adm-header-logo"><span className="logo-ba">BA</span><span className="logo-fly">FLY</span><span className="adm-badge">ADMIN</span></div>
        <button className="adm-logout" onClick={logout}>Sair</button>
      </header>

      {/* Tab bar */}
      <nav className="adm-tabs">
        {[
          { id: 'dashboard', icon: '▦', label: 'Dashboard' },
          { id: 'reports', icon: '⚑', label: `Denúncias${reports.length > 0 ? ` (${reports.length})` : ''}` },
          { id: 'users', icon: '◉', label: 'Utilizadores' },
          { id: 'bans', icon: '⊘', label: 'Bans' },
        ].map(t => (
          <button key={t.id} className={`adm-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="adm-tab-icon">{t.icon}</span>
            <span className="adm-tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="adm-main">

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div className="adm-section">
            <div className="adm-stats-grid">
              <div className="adm-stat-card blue">
                <span className="adm-stat-label">Sessões Hoje</span>
                <span className="adm-stat-val">{stats.sessionsToday ?? 0}</span>
              </div>
              <div className="adm-stat-card green">
                <span className="adm-stat-label">Online Agora</span>
                <span className="adm-stat-val">{stats.onlineNow ?? 0}</span>
              </div>
              <div className="adm-stat-card red">
                <span className="adm-stat-label">Reports Pendentes</span>
                <span className="adm-stat-val">{stats.pendingReports ?? 0}</span>
              </div>
              <div className="adm-stat-card yellow">
                <span className="adm-stat-label">Tempo Médio</span>
                <span className="adm-stat-val">{fmtDuration(stats.avgSessionTime)}</span>
              </div>
            </div>
            <div className="adm-card">
              <h3>Sessões — Últimos 7 Dias</h3>
              <div className="adm-chart">
                {chartData.length > 0 ? chartData.map((d, i) => (
                  <div key={i} className="adm-bar-wrap">
                    <span className="adm-bar-val">{d.value}</span>
                    <div className="adm-bar" style={{ height: `${Math.round((d.value / maxVal) * 100)}%` }} />
                    <span className="adm-bar-lbl">{d.label}</span>
                  </div>
                )) : <p className="adm-empty">Sem dados ainda.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── DENÚNCIAS ── */}
        {tab === 'reports' && (
          <div className="adm-section">
            <div className="adm-section-header">
              <h2>Denúncias Pendentes</h2>
              <button className="adm-refresh" onClick={fetchReports}>↺ Atualizar</button>
            </div>
            {reports.length === 0 ? (
              <div className="adm-card adm-empty">Nenhuma denúncia pendente.</div>
            ) : reports.map(r => (
              <div key={r.id} className="adm-report-card">
                <div className="adm-report-meta">
                  <span className="adm-report-id">#{r.id}</span>
                  <span className="adm-report-date">{fmtDate(r.created_at)}</span>
                </div>
                <div className="adm-report-row">
                  <div className="adm-report-field">
                    <label>Denunciado</label>
                    <strong>{r.reported_name || r.reported_id}</strong>
                    {r.reported_email && <span className="adm-report-email">{r.reported_email}</span>}
                  </div>
                  <div className="adm-report-field">
                    <label>Denunciante</label>
                    <span>{r.reporter_name || r.reporter_id || '—'}</span>
                  </div>
                </div>
                <div className="adm-report-row">
                  <div className="adm-report-field">
                    <label>Motivo</label>
                    <span className="adm-reason-tag">{r.reason}</span>
                  </div>
                  {r.description && (
                    <div className="adm-report-field">
                      <label>Descrição</label>
                      <span>{r.description}</span>
                    </div>
                  )}
                </div>
                {r.screenshot && (
                  <div className="adm-report-screenshot">
                    <label>Captura de ecrã</label>
                    <a href={r.screenshot} target="_blank" rel="noopener noreferrer">
                      <img src={r.screenshot} alt="Captura" className="adm-screenshot-thumb" />
                      <span className="adm-screenshot-hint">Clica para ver em tamanho real</span>
                    </a>
                  </div>
                )}
                <div className="adm-report-actions">
                  <button className="adm-btn-dismiss" onClick={() => dismissReport(r.id)}>Dispensar</button>
                  <div className="adm-ban-group">
                    {BAN_DURATIONS.map(({ label, days }) => (
                      <button key={label} className="adm-btn-ban" onClick={() => { if (window.confirm(`Banir "${r.reported_name || r.reported_id}" — ${label}?`)) banUser(r.reported_id, r.id, days); }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── UTILIZADORES ── */}
        {tab === 'users' && (
          <div className="adm-section">
            <div className="adm-section-header">
              <h2>Utilizadores <span className="adm-count">({userTotal})</span></h2>
            </div>
            <form className="adm-search-form" onSubmit={handleUserSearch}>
              <input
                type="search"
                placeholder="Pesquisar por nome ou email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
              <button type="submit">Pesquisar</button>
            </form>
            {loading ? <div className="adm-empty">A carregar...</div> : (
              <div className="adm-users-list">
                {users.length === 0 && <div className="adm-card adm-empty">Nenhum utilizador encontrado.</div>}
                {users.map(u => (
                  <div key={u.id} className={`adm-user-card${u.ban_id ? ' banned' : ''}`}>
                    <div className="adm-user-main">
                      <div className="adm-user-info">
                        <strong className="adm-user-name">{u.username}</strong>
                        {u.ban_id && <span className="adm-banned-tag">BANIDO</span>}
                        <span className="adm-user-meta">{u.provider || 'email'} {u.country ? `· ${u.country}` : ''}</span>
                        {u.email && <span className="adm-user-email">{u.email}</span>}
                        <span className="adm-user-date">Desde {fmtDate(u.created_at)}</span>
                      </div>
                      <div className="adm-user-actions">
                        {u.ban_id ? (
                          <button className="adm-btn-unban" onClick={() => { if (window.confirm(`Desbanir "${u.username}"?`)) unbanUser(u.id); }}>
                            Desbanir
                          </button>
                        ) : (
                          <div className="adm-ban-group">
                            {BAN_DURATIONS.map(({ label, days }) => (
                              <button key={label} className="adm-btn-ban sm" onClick={() => { if (window.confirm(`Banir "${u.username}" — ${label}?`)) banUser(u.id, null, days); }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {u.ban_id && (
                      <div className="adm-ban-info">
                        Banido até: {u.ban_expires ? fmtDate(u.ban_expires) : 'Permanente'} · {u.ban_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {userTotal > 25 && (
              <div className="adm-pagination">
                <button disabled={userPage <= 1} onClick={() => { const p = userPage - 1; setUserPage(p); fetchUsers(userSearch, p); }}>‹ Anterior</button>
                <span>Pág {userPage} / {Math.ceil(userTotal / 25)}</span>
                <button disabled={userPage >= Math.ceil(userTotal / 25)} onClick={() => { const p = userPage + 1; setUserPage(p); fetchUsers(userSearch, p); }}>Próximo ›</button>
              </div>
            )}
          </div>
        )}

        {/* ── BANS ── */}
        {tab === 'bans' && (
          <div className="adm-section">
            <div className="adm-section-header">
              <h2>Bans Ativos <span className="adm-count">({bans.length})</span></h2>
              <button className="adm-refresh" onClick={fetchBans}>↺ Atualizar</button>
            </div>
            {bans.length === 0 ? (
              <div className="adm-card adm-empty">Nenhum ban ativo.</div>
            ) : bans.map(b => (
              <div key={b.id} className="adm-ban-card">
                <div className="adm-ban-main">
                  <div className="adm-ban-user">
                    <strong>{b.username || b.user_id}</strong>
                    {b.email && <span className="adm-user-email">{b.email}</span>}
                    <span className="adm-ban-reason">{b.reason}</span>
                    <span className="adm-ban-expires">
                      {b.expires_at ? `Expira: ${fmtDate(b.expires_at)}` : 'Permanente'}
                    </span>
                    <span className="adm-user-date">Banido em: {fmtDate(b.created_at)}</span>
                  </div>
                  <button className="adm-btn-unban" onClick={() => { if (window.confirm(`Desbanir "${b.username}"?`)) unbanUser(b.user_id); }}>
                    Desbanir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
};

export default Admin;

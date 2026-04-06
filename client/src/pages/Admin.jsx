import React, { useState, useEffect, useCallback } from 'react';
import './Admin.css';

const PROD_BACKEND = "https://bafly-server-production-49a3.up.railway.app";
const API_URL =
  window.location.hostname === "localhost"
    ? ""
    : window.location.hostname === "bafly.net" || window.location.hostname.endsWith(".netlify.app")
      ? PROD_BACKEND
      : import.meta.env.VITE_API_URL || PROD_BACKEND;

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const Admin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('admin_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [stats, setStats] = useState({ sessionsToday: 0, onlineNow: 0, pendingReports: 0, avgSessionTime: 0 });
  const [reports, setReports] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(false);

  const authHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, reportsRes, dailyRes] = await Promise.all([
        fetch(`${API_URL}/api/stats/summary`, { headers: authHeader() }),
        fetch(`${API_URL}/api/reports/pending`, { headers: authHeader() }),
        fetch(`${API_URL}/api/stats/daily`, { headers: authHeader() }),
      ]);

      if (statsRes.status === 401 || statsRes.status === 403) {
        localStorage.removeItem('admin_token');
        setIsLoggedIn(false);
        return;
      }

      if (statsRes.ok) setStats(await statsRes.json());
      if (reportsRes.ok) setReports(await reportsRes.json());
      if (dailyRes.ok) setDailyStats(await dailyRes.json());
    } catch (err) {
      console.error('Fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, fetchDashboardData]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token && data.user?.role === 'admin') {
        localStorage.setItem('admin_token', data.token);
        setIsLoggedIn(true);
      } else {
        setLoginError('Credenciais inválidas ou sem permissão de admin.');
      }
    } catch (err) {
      setLoginError('Erro de ligação ao servidor.');
    }
  };

  const handleDismiss = async (id) => {
    try {
      await fetch(`${API_URL}/api/reports/dismiss/${id}`, { method: 'POST', headers: authHeader() });
      fetchDashboardData();
    } catch (err) {
      console.error('Dismiss failed', err);
    }
  };

  const handleBan = async (userId) => {
    if (!window.confirm('Tens a certeza que queres banir este utilizador por 7 dias?')) return;
    try {
      await fetch(`${API_URL}/api/reports/ban`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          user_id: userId,
          reason: 'Violação dos termos de serviço',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
      });
      fetchDashboardData();
    } catch (err) {
      console.error('Ban failed', err);
    }
  };

  // Gráfico com dados reais
  const chartData = dailyStats.length > 0
    ? [...dailyStats].reverse().map(d => ({
        label: new Date(d.date).toLocaleDateString('pt-PT', { weekday: 'short' }),
        value: Number(d.total_sessions) || 0
      }))
    : [];
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.value), 1) : 1;

  if (!isLoggedIn) {
    return (
      <div className="admin-login-page">
        <div className="login-card">
          <div className="admin-logo">
            <span className="logo-ba">BA</span><span className="logo-fly">FLY</span>
          </div>
          <h2>Painel de Administração</h2>
          {loginError && <div className="login-error">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Utilizador"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="submit">ENTRAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-logo-small">
          <span className="logo-ba">BA</span><span className="logo-fly">FLY</span>
          <span className="admin-badge">ADMIN</span>
        </div>
        <div className="admin-header-right">
          {loading && <span className="admin-loading">A atualizar...</span>}
          <button onClick={() => { localStorage.removeItem('admin_token'); setIsLoggedIn(false); }}>Sair</button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <label>Sessões hoje</label>
          <div className="value">{stats.sessionsToday ?? 0}</div>
        </div>
        <div className="stat-card online">
          <label>Online agora</label>
          <div className="value">{stats.onlineNow ?? 0}</div>
        </div>
        <div className="stat-card reports">
          <label>Reports pendentes</label>
          <div className="value">{stats.pendingReports ?? 0}</div>
        </div>
        <div className="stat-card time">
          <label>Tempo médio de sessão</label>
          <div className="value">{formatDuration(stats.avgSessionTime)}</div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="section">
          <h3>Reports Pendentes</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Utilizador Reportado</th>
                <th>Motivo</th>
                <th>Descrição</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.id}>
                  <td>{report.id}</td>
                  <td><code>{report.reported_id}</code></td>
                  <td>{report.reason}</td>
                  <td>{report.description || '—'}</td>
                  <td>{new Date(report.created_at).toLocaleDateString('pt-PT')}</td>
                  <td>
                    <button className="btn-dismiss" onClick={() => handleDismiss(report.id)}>Dispensar</button>
                    <button className="btn-ban" onClick={() => handleBan(report.reported_id)}>Banir 7d</button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-table">Sem reports pendentes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="section">
          <h3>Sessões — Últimos 7 dias</h3>
          <div className="bar-chart">
            {chartData.length > 0 ? chartData.map((d, i) => (
              <div key={i} className="bar-wrapper">
                <div className="bar-value">{d.value}</div>
                <div className="bar" style={{ height: `${Math.round((d.value / maxVal) * 100)}%` }}></div>
                <span className="bar-label">{d.label}</span>
              </div>
            )) : (
              <p style={{ color: '#555', textAlign: 'center', width: '100%', paddingTop: '40px' }}>
                Sem dados ainda. Os dados aparecem após sessões completadas.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;

import React, { useState, useEffect } from 'react';
import './Admin.css';

const Admin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState({
    sessionsToday: 0,
    onlineNow: 0,
    pendingReports: 0,
    avgSessionTime: '00:00'
  });
  const [reports, setReports] = useState([]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem('admin_token', token);
        setIsLoggedIn(true);
        fetchDashboardData();
      } else {
        alert('Invalid credentials');
      }
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch('/api/stats/summary');
      const statsData = await statsRes.json();
      setStats(statsData);

      const reportsRes = await fetch('/api/reports/pending');
      const reportsData = await reportsRes.json();
      setReports(reportsData);
    } catch (err) {
      console.error("Fetch failed", err);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await fetch(`/api/reports/dismiss/${id}`, { method: 'POST' });
      fetchDashboardData();
    } catch (err) {
      console.error("Dismiss failed", err);
    }
  };

  const handleBan = async (userId) => {
    try {
      await fetch('/api/reports/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          reason: 'Banned by Admin',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })
      });
      fetchDashboardData();
    } catch (err) {
      console.error("Ban failed", err);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="admin-login-page">
        <div className="login-card">
          <h2>BAFLY ADMIN</h2>
          <form onSubmit={handleLogin}>
            <input 
              type="text" 
              placeholder="Username" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
            <button type="submit">LOGIN</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Dashboard</h1>
        <button onClick={() => { localStorage.removeItem('admin_token'); setIsLoggedIn(false); }}>LOGOUT</button>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <label>Total de sessões hoje</label>
          <div className="value">{stats.sessionsToday}</div>
        </div>
        <div className="stat-card online">
          <label>Utilizadores online agora</label>
          <div className="value">{stats.onlineNow}</div>
        </div>
        <div className="stat-card reports">
          <label>Reports pendentes</label>
          <div className="value">{stats.pendingReports}</div>
        </div>
        <div className="stat-card time">
          <label>Tempo médio de sessão</label>
          <div className="value">{stats.avgSessionTime}</div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="section">
          <h3>Reports Recentes</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Reported ID</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.id}>
                  <td>{report.id}</td>
                  <td>{report.reported_id}</td>
                  <td>{report.reason}</td>
                  <td>
                    <button className="btn-dismiss" onClick={() => handleDismiss(report.id)}>Dispensar</button>
                    <button className="btn-ban" onClick={() => handleBan(report.reported_id)}>Banir</button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px', color: '#666'}}>Sem reports pendentes</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="section">
          <h3>Estatísticas (Últimos 7 dias)</h3>
          <div className="stats-chart-placeholder">
            {/* Simple CSS Bar Chart would go here */}
            <div className="bar-chart">
              {[65, 40, 80, 50, 90, 30, 70].map((h, i) => (
                <div key={i} className="bar-wrapper">
                  <div className="bar" style={{height: `${h}%`}}></div>
                  <span className="bar-label">D{i+1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;

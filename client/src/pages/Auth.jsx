import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Auth.css';

const PROD_BACKEND = "https://bafly-ej4m.onrender.com";
const API_URL =
  window.location.hostname === "localhost"
    ? ""
    : window.location.hostname === "bafly.net" || window.location.hostname.endsWith(".netlify.app")
      ? PROD_BACKEND
      : import.meta.env.VITE_API_URL || PROD_BACKEND;

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'login';

  useEffect(() => {
    // Clear messages when switching modes
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
  }, [mode]);

  useEffect(() => {
    const token = params.get('token');
    if (!token) return;
    localStorage.setItem('auth_token', token);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.user) {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
      } catch {}
      navigate('/');
    })();
  }, [location.search, navigate, params]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const endpoint = mode === 'register' ? `${API_URL}/api/auth/register` : `${API_URL}/api/auth/login`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ocorreu um erro. Tente novamente.');
      }

      if (mode === 'register') {
        // Master logic: Redirect to login after registration
        setSuccess('Conta criada com sucesso! Por favor, faz login com os teus dados.');
        setUsername(''); 
        setPassword('');
        // Smooth transition to login mode
        setTimeout(() => navigate('/auth?mode=login'), 2500);
      } else {
        // Login successful
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          if (data.user) {
            localStorage.setItem('auth_user', JSON.stringify(data.user));
          }
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Se há token OAuth no URL, mostra só ecrã de carregamento
  if (params.get('token')) {
    return (
      <div className="auth-page">
        <div style={{ textAlign: 'center', color: '#00ff88' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>
            <span style={{ fontWeight: 900 }}>BA</span><span style={{ color: '#fff', fontWeight: 900 }}>FLY</span>
          </div>
          <div style={{ color: '#a0a0a0', fontSize: '0.95rem' }}>A entrar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" onClick={() => navigate('/')}>
            <span className="logo-ba">BA</span>
            <span className="logo-fly">FLY</span>
          </div>
        </div>

        <h2 className="auth-title">
          {mode === 'register' ? 'Criar Conta' : 'Fazer Login'}
        </h2>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Utilizador
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="O teu utilizador"
              required
              minLength={3}
              autoComplete="username"
            />
          </label>

          <label>
            Palavra-passe
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'A processar...' : (mode === 'register' ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'register' ? (
            <>Já tem conta? <span onClick={() => navigate('/auth?mode=login')}>Fazer Login</span></>
          ) : (
            <>Não tem conta? <span onClick={() => navigate('/auth?mode=register')}>Criar Conta</span></>
          )}
        </div>

        <button className="auth-back" type="button" onClick={() => navigate('/')}>Voltar à Página Inicial</button>
      </div>
    </div>
  );
};

export default Auth;

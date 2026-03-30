import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Auth.css';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (!token) return;
    localStorage.setItem('auth_token', token);
    params.delete('token');
    const nextQuery = params.toString();
    window.history.replaceState({}, '', `/auth${nextQuery ? `?${nextQuery}` : ''}`);
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.user) {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
      } catch {}
      navigate('/');
    })();
  }, [location.search, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" onClick={() => navigate('/')}>
            <span className="logo-ba">BA</span>
            <span className="logo-fly">FLY</span>
          </div>
        </div>

        

        <button className="auth-back" type="button" onClick={() => navigate('/')}>Voltar</button>
      </div>
    </div>
  );
};

export default Auth;

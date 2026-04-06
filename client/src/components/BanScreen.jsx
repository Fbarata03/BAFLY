import React, { useState, useEffect } from 'react';
import './BanScreen.css';

const pad = (n) => String(n).padStart(2, '0');

const formatCountdown = (ms) => {
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(mins)}m`;
  if (hours > 0) return `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
  return `${pad(mins)}m ${pad(secs)}s`;
};

const BanScreen = ({ reason, expiresAt, onContinue }) => {
  const isPermanent = !expiresAt;
  const expireTs = expiresAt ? new Date(expiresAt).getTime() : null;

  const [remaining, setRemaining] = useState(() => expireTs ? Math.max(0, expireTs - Date.now()) : null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (isPermanent) return;
    const iv = setInterval(() => {
      const left = Math.max(0, expireTs - Date.now());
      setRemaining(left);
      if (left === 0) { setExpired(true); clearInterval(iv); }
    }, 1000);
    return () => clearInterval(iv);
  }, [expireTs, isPermanent]);

  return (
    <div className="ban-screen">
      <div className="ban-card">
        <div className="ban-logo">
          <span className="logo-ba">BA</span><span className="logo-fly">FLY</span>
        </div>

        <div className="ban-icon">⊘</div>

        {expired ? (
          <>
            <h2 className="ban-title restored">Acesso Restaurado</h2>
            <p className="ban-desc">A tua suspensão terminou. Podes voltar a usar o BAFLY.</p>
            <button className="ban-continue-btn" onClick={onContinue}>Continuar</button>
          </>
        ) : (
          <>
            <h2 className="ban-title">Conta Suspensa</h2>
            <p className="ban-reason">{reason || 'Violação dos termos de serviço'}</p>

            {isPermanent ? (
              <div className="ban-permanent">Esta suspensão é permanente.</div>
            ) : (
              <div className="ban-countdown-wrap">
                <p className="ban-countdown-label">Acesso restabelecido em</p>
                <div className="ban-countdown">{formatCountdown(remaining)}</div>
                <p className="ban-countdown-date">
                  {new Date(expiresAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}

            <p className="ban-appeal">
              Se acreditas que isto é um erro, contacta o suporte.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default BanScreen;

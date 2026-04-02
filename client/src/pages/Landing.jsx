import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import OnlineBadge from '../components/OnlineBadge';
import './Landing.css';

const DEFAULT_COUNTRY_OPTIONS = [
  { value: 'Any', label: 'Qualquer', flag: null },
  { value: 'PT', label: 'Portugal', flag: 'PT' },
  { value: 'BR', label: 'Brasil', flag: 'BR' },
  { value: 'AO', label: 'Angola', flag: 'AO' },
  { value: 'MZ', label: 'Moçambique', flag: 'MZ' },
  { value: 'CV', label: 'Cabo Verde', flag: 'CV' },
  { value: 'GW', label: 'Guiné-Bissau', flag: 'GW' },
  { value: 'ST', label: 'São Tomé e Príncipe', flag: 'ST' },
  { value: 'TL', label: 'Timor‑Leste', flag: 'TL' },
  { value: 'GQ', label: 'Guiné Equatorial', flag: 'GQ' },
  { value: 'MO', label: 'Macau', flag: 'MO' },
];

const flagUrl = (code) => `https://flagcdn.com/24x18/${String(code).toLowerCase()}.png`;

const Landing = () => {
  const [gender, setGender] = useState('Any');
  const [country, setCountry] = useState('Any');
  const [countryOptions, setCountryOptions] = useState(DEFAULT_COUNTRY_OPTIONS);
  const [localCountryCode, setLocalCountryCode] = useState(null);
  const [localCountryName, setLocalCountryName] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryRef = useRef(null);
  const countryTouchedRef = useRef(false);
  const [simple, setSimple] = useState(!localStorage.getItem('auth_token') && !localStorage.getItem('auth_user'));
  const [legalOpen, setLegalOpen] = useState(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [currentCameraId, setCurrentCameraId] = useState(null);

  useEffect(() => {
    // Check for multiple cameras
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    });

    socket.connect();
    socket.on('online_count', (count) => setOnlineCount(count));
    
    const token = localStorage.getItem('auth_token');
    const u = localStorage.getItem('auth_user');
    
    if (u) {
      try { 
        setUser(JSON.parse(u)); 
        setSimple(false); // If user exists, show full landing
      } catch {}
    } else if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json().catch(() => ({})))
        .then(d => { 
          if (d?.user) { 
            localStorage.setItem('auth_user', JSON.stringify(d.user)); 
            setUser(d.user);
            setSimple(false); // If user exists, show full landing
          } 
        })
        .catch(() => {});
    }

    return () => {
      socket.off('online_count');
    };
  }, []);

  // Get camera preview only when NOT in simple auth mode
  useEffect(() => {
    if (simple) return;

    const startPreview = async (deviceId = null) => {
      try {
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
          alert("ERRO DE SEGURANÇA: O browser bloqueia a câmara em IPs de rede sem HTTPS. \n\nSoluções:\n1. Usa 'http://localhost:5173' no teu PC.\n2. Se queres testar noutro dispositivo via rede, tens de ativar um flag no Chrome (ver instruções no chat).");
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("O teu navegador não suporta acesso à câmara ou estás num contexto inseguro.");
          return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Master Logic: Try to find a non-virtual camera if no deviceId is provided
        let targetDeviceId = deviceId;
        if (!targetDeviceId && videoDevices.length > 0) {
          const realCamera = videoDevices.find(d => 
            !d.label.toLowerCase().includes('virtual') && 
            !d.label.toLowerCase().includes('obs') &&
            !d.label.toLowerCase().includes('utility')
          );
          if (realCamera) {
            targetDeviceId = realCamera.deviceId;
          }
        }

        // Clean up previous stream if switching
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        const constraints = {
          video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : { facingMode: 'user' },
          audio: true,
        };

        let userStream;
        try {
          userStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (innerErr) {
          console.warn("Preferred constraints failed, trying generic:", innerErr);
          userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }

        streamRef.current = userStream;

        // Save current device ID
        const videoTrack = userStream.getVideoTracks()[0];
        if (videoTrack) {
          setCurrentCameraId(videoTrack.getSettings().deviceId);
        }
        
        // Wait for next tick to ensure videoRef is attached
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = userStream;
          }
        }, 100);
      } catch (err) {
        console.error("Camera error:", err);
        if (err.name === 'NotAllowedError') {
          alert("Permissão de câmara negada. Por favor, ativa a câmara nas definições do browser.");
        } else if (err.name === 'NotFoundError') {
          alert("Nenhuma câmara encontrada no dispositivo.");
        } else if (err.name === 'NotReadableError') {
          alert("A câmara não conseguiu iniciar (normalmente está a ser usada por outra app/tab). Fecha Zoom/Teams/Meet, outras tabs com câmara, e tenta novamente.");
        } else {
          alert("Erro ao aceder à câmara: " + err.message);
        }
      }
    };

    startPreview();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [simple]);

  useEffect(() => {
    fetch('https://flagcdn.com/en/codes.json')
      .then((r) => r.json())
      .then((data) => {
        const entries = Object.entries(data || {});
        const countries = entries
          .filter(([code]) => typeof code === 'string' && code.length === 2)
          .map(([code, name]) => ({
            value: code.toUpperCase(),
            label: String(name),
            flag: code.toUpperCase(),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }));

        setCountryOptions([{ value: 'Any', label: 'Qualquer', flag: null }, ...countries]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/geo/me')
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        const code = d?.countryCode ? String(d.countryCode).toUpperCase() : null;
        const name = d?.countryName ? String(d.countryName) : null;
        if (code) setLocalCountryCode(code);
        if (name) setLocalCountryName(name);
        if (code && !countryTouchedRef.current && country === 'Any') setCountry(code);
      })
      .catch(() => {});
  }, [country]);

  useEffect(() => {
    const onDown = (e) => {
      if (!countryRef.current) return;
      if (!countryRef.current.contains(e.target)) setIsCountryOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const handleSwitchCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length > 1) {
        const currentIndex = videoDevices.findIndex(d => d.deviceId === currentCameraId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        const nextDeviceId = videoDevices[nextIndex].deviceId;
        
        // Clean up previous stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        const constraints = {
          video: { deviceId: { exact: nextDeviceId } },
          audio: true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCurrentCameraId(nextDeviceId);
      }
    } catch (err) {
      console.error("Error switching camera:", err);
      alert("Não foi possível trocar a câmara: " + err.message);
    }
  };

  const handleStart = async () => {
    try {
      if (simple) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("O teu navegador não suporta acesso à câmara.");
          return;
        }
        const permStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        permStream.getTracks().forEach((t) => t.stop());
      }
    } catch (err) {
      alert("Ativa a câmara para começar.");
      return;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // Store filters in sessionStorage for Chat page
    sessionStorage.setItem('chat_filters', JSON.stringify({ gender, country }));
    navigate('/chat');
  };

  if (simple) {
    return (
      <div className="landing-auth">
        <div className="hero-card">
          <div className="logo-circle">
            <div className="logo-mark">
              <span className="logo-ba">BA</span>
              <span className="logo-fly">FLY</span>
            </div>
          </div>
          <h2 className="hero-title">Benvindo ao BAFLY</h2>
          <div className="hero-sub">MEET STRANGERS · NO LIMITS</div>
          
          <div className="online-pill">
            <span className="online-dot"></span>
            {onlineCount.toLocaleString()} online agora
          </div>
          
          <div className="auth-actions">
            <button className="btn primary" onClick={() => setSimple(false)}>
              Começar Agora
            </button>
            <button className="btn outline" onClick={() => navigate('/auth?mode=register')}>
              Criar Conta Grátis
            </button>
          </div>
          
          <div className="auth-footer">
            Já tens uma conta? <span className="login-link" onClick={() => navigate('/auth?mode=login')}>Entrar</span>
          </div>

          <div className="age-note">🔞 APENAS PARA MAIORES DE 18 ANOS</div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="logo">
          <span className="logo-ba">BA</span>
          <span className="logo-fly">FLY</span>
        </div>
        {user ? (
          <div className="auth-link">
            <span style={{marginRight: 10}}>Olá, {user.displayName || user.username}</span>
            <button
              onClick={() => { 
                localStorage.removeItem('auth_token'); 
                localStorage.removeItem('auth_user'); 
                setSimple(true);
                setUser(null);
                navigate('/'); 
              }}
              style={{background:'transparent', color:'var(--text-gray)', border:'1px solid rgba(255,255,255,0.25)', padding:'6px 10px', cursor:'pointer'}}
            >
              Sair
            </button>
          </div>
        ) : (
          <div className="auth-link" onClick={() => navigate('/auth')}>Entrar / Registar</div>
        )}
      </header>

      <main className="landing-main">
        <h1 className="tagline">Meet strangers. No filters. Just vibes.</h1>
        <OnlineBadge count={onlineCount} />

        <div className="filters-container">
          <div className="filter-group">
            <label>Género</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="Any">Qualquer</option>
              <option value="Male">Masculino</option>
              <option value="Female">Feminino</option>
            </select>
          </div>

          <div className="filter-group">
            <label>País</label>
            <div className="country-select" ref={countryRef}>
              <button
                type="button"
                className="country-trigger"
                onClick={() => setIsCountryOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={isCountryOpen}
              >
                {(() => {
                  const selected = countryOptions.find((o) => o.value === country) || countryOptions[0];
                  return (
                    <>
                      {selected.flag ? (
                        <img className="country-flag" src={flagUrl(selected.flag)} alt={selected.flag} />
                      ) : (
                        <span className="country-globe">{'\u{1F30D}'}</span>
                      )}
                      <span className="country-label">{selected.label}</span>
                    </>
                  );
                })()}
                <span className="country-caret">▾</span>
              </button>
              {isCountryOpen && (
                <div className="country-menu" role="listbox">
                  {countryOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={opt.value === country ? 'country-option active' : 'country-option'}
                      onClick={() => {
                        countryTouchedRef.current = true;
                        setCountry(opt.value);
                        setIsCountryOpen(false);
                      }}
                      role="option"
                      aria-selected={opt.value === country}
                    >
                      {opt.flag ? (
                        <img className="country-flag" src={flagUrl(opt.flag)} alt={opt.flag} />
                      ) : (
                        <span className="country-globe">{'\u{1F30D}'}</span>
                      )}
                      <span className="country-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {localCountryCode ? (
          <div style={{ color: 'var(--text-gray)', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem' }}>
            O teu país: {localCountryName || localCountryCode} ({localCountryCode})
          </div>
        ) : null}

        <button className="start-btn" onClick={handleStart}>
          ▶ Start
        </button>

        <div className="features">
          <span>Anónimo</span> · <span>Sem registo</span> · <span>Grátis</span> · <span>Worldwide</span>
        </div>
      </main>

      <div className="preview-container">
        <video ref={videoRef} autoPlay muted playsInline />
        <div className="preview-label">A TUA CÂMARA</div>
      </div>
    </div>
  );
};

export default Landing;

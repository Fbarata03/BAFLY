import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import OnlineBadge from '../components/OnlineBadge';
import BanScreen from '../components/BanScreen';
import './Landing.css';

const PROD_BACKEND = "https://bafly-ej4m.onrender.com";
const API_URL =
  window.location.hostname === "localhost"
    ? ""
    : window.location.hostname === "bafly.net" || window.location.hostname === "www.bafly.net" || window.location.hostname.endsWith(".netlify.app") || window.location.hostname.endsWith(".github.io")
      ? PROD_BACKEND
      : import.meta.env.VITE_API_URL || PROD_BACKEND;

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

const CATCHLINES = {
  pt: 'O próximo clique pode mudar tudo.',
  es: 'El próximo clic puede cambiarlo todo.',
  fr: 'Le prochain clic peut tout changer.',
  de: 'Der nächste Klick kann alles verändern.',
  it: 'Il prossimo clic può cambiare tutto.',
  ru: 'Следующий клик может изменить всё.',
  ar: 'النقرة التالية قد تغيّر كل شيء.',
  ja: '次のクリックがすべてを変えるかもしれない。',
  ko: '다음 클릭이 모든 것을 바꿀 수 있다.',
  zh: '下一次点击，可能改变一切。',
  tr: 'Bir sonraki tıklama her şeyi değiştirebilir.',
  pl: 'Następne kliknięcie może zmienić wszystko.',
  nl: 'De volgende klik kan alles veranderen.',
  hi: 'अगला क्लिक सब कुछ बदल सकता है।',
  en: 'The next click might change everything.',
};

const getCatchline = (cc) => {
  if (!cc) return CATCHLINES.en;
  if (PT_COUNTRIES && PT_COUNTRIES.has(cc)) return CATCHLINES.pt;
  if (ES_COUNTRIES && ES_COUNTRIES.has(cc)) return CATCHLINES.es;
  if (FR_COUNTRIES && FR_COUNTRIES.has(cc)) return CATCHLINES.fr;
  if (DE_COUNTRIES && DE_COUNTRIES.has(cc)) return CATCHLINES.de;
  if (IT_COUNTRIES && IT_COUNTRIES.has(cc)) return CATCHLINES.it;
  if (RU_COUNTRIES && RU_COUNTRIES.has(cc)) return CATCHLINES.ru;
  if (AR_COUNTRIES && AR_COUNTRIES.has(cc)) return CATCHLINES.ar;
  if (JA_COUNTRIES && JA_COUNTRIES.has(cc)) return CATCHLINES.ja;
  if (KO_COUNTRIES && KO_COUNTRIES.has(cc)) return CATCHLINES.ko;
  if (ZH_COUNTRIES && ZH_COUNTRIES.has(cc)) return CATCHLINES.zh;
  if (TR_COUNTRIES && TR_COUNTRIES.has(cc)) return CATCHLINES.tr;
  if (PL_COUNTRIES && PL_COUNTRIES.has(cc)) return CATCHLINES.pl;
  if (NL_COUNTRIES && NL_COUNTRIES.has(cc)) return CATCHLINES.nl;
  if (HI_COUNTRIES && HI_COUNTRIES.has(cc)) return CATCHLINES.hi;
  return CATCHLINES.en;
};

const TAGLINES = {
  pt: ['Encontra estranhos.', 'Sem filtros.', 'Só vibes.'],
  es: ['Conoce extraños.', 'Sin filtros.', 'Solo vibras.'],
  fr: ['Rencontre des inconnus.', 'Sans filtres.', 'Juste des vibes.'],
  de: ['Triff Fremde.', 'Keine Filter.', 'Einfach Vibes.'],
  it: ['Incontra sconosciuti.', 'Nessun filtro.', 'Solo vibes.'],
  ru: ['Знакомься.', 'Без фильтров.', 'Только вайбы.'],
  ar: ['قابل غرباء.', 'بلا فلاتر.', 'فقط الأجواء.'],
  ja: ['見知らぬ人に会おう。', 'フィルターなし。', 'ただのバイブス。'],
  ko: ['낯선 사람을 만나세요.', '필터 없음.', '그냥 바이브.'],
  zh: ['遇见陌生人。', '无滤镜。', '纯粹氛围。'],
  tr: ['Yabancılarla tanış.', 'Filtre yok.', 'Sadece vibe.'],
  pl: ['Poznaj nieznajomych.', 'Bez filtrów.', 'Tylko wibracje.'],
  nl: ['Ontmoet vreemden.', 'Geen filters.', 'Gewoon vibes.'],
  hi: ['अजनबियों से मिलो.', 'कोई फिल्टर नहीं.', 'बस वाइब्स.'],
  en: ['Meet strangers.', 'No filters.', 'Just vibes.'],
};
const PT_COUNTRIES = new Set(['PT','BR','AO','MZ','CV','GW','ST','TL','GQ','MO']);
const ES_COUNTRIES = new Set(['ES','MX','AR','CO','CL','PE','VE','EC','BO','PY','UY','CR','PA','DO','HN','GT','SV','NI','CU','PR']);
const FR_COUNTRIES = new Set(['FR','BE','CH','SN','CI','CM','ML','BF','NE','TG','BJ','GN','CD','CG','MG','DZ','TN','MA']);
const DE_COUNTRIES = new Set(['DE','AT','LI']);
const IT_COUNTRIES = new Set(['IT','SM']);
const RU_COUNTRIES = new Set(['RU','BY','KZ']);
const AR_COUNTRIES = new Set(['SA','AE','EG','IQ','SY','JO','LB','KW','QA','BH','OM','YE','LY','SD']);
const JA_COUNTRIES = new Set(['JP']);
const KO_COUNTRIES = new Set(['KR']);
const ZH_COUNTRIES = new Set(['CN','TW','HK','SG']);
const TR_COUNTRIES = new Set(['TR']);
const PL_COUNTRIES = new Set(['PL']);
const NL_COUNTRIES = new Set(['NL']);
const HI_COUNTRIES = new Set(['IN']);

const getBrowserCountryCode = () => {
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('pt')) return 'PT';
  if (lang.startsWith('es')) return 'ES';
  if (lang.startsWith('fr')) return 'FR';
  if (lang.startsWith('de')) return 'DE';
  if (lang.startsWith('it')) return 'IT';
  if (lang.startsWith('ru')) return 'RU';
  if (lang.startsWith('ar')) return 'SA';
  if (lang.startsWith('ja')) return 'JP';
  if (lang.startsWith('ko')) return 'KR';
  if (lang.startsWith('zh')) return 'CN';
  if (lang.startsWith('tr')) return 'TR';
  if (lang.startsWith('pl')) return 'PL';
  if (lang.startsWith('nl')) return 'NL';
  if (lang.startsWith('hi')) return 'IN';
  return null;
};

const getTaglineLines = (cc) => {
  if (!cc) return TAGLINES.en;
  if (PT_COUNTRIES.has(cc)) return TAGLINES.pt;
  if (ES_COUNTRIES.has(cc)) return TAGLINES.es;
  if (FR_COUNTRIES.has(cc)) return TAGLINES.fr;
  if (DE_COUNTRIES.has(cc)) return TAGLINES.de;
  if (IT_COUNTRIES.has(cc)) return TAGLINES.it;
  if (RU_COUNTRIES.has(cc)) return TAGLINES.ru;
  if (AR_COUNTRIES.has(cc)) return TAGLINES.ar;
  if (JA_COUNTRIES.has(cc)) return TAGLINES.ja;
  if (KO_COUNTRIES.has(cc)) return TAGLINES.ko;
  if (ZH_COUNTRIES.has(cc)) return TAGLINES.zh;
  if (TR_COUNTRIES.has(cc)) return TAGLINES.tr;
  if (PL_COUNTRIES.has(cc)) return TAGLINES.pl;
  if (NL_COUNTRIES.has(cc)) return TAGLINES.nl;
  if (HI_COUNTRIES.has(cc)) return TAGLINES.hi;
  return TAGLINES.en;
};

const LETTER_STAGGER = 0.038;
const LINE_START_STAGGER = 0.32;

const AnimatedTagline = ({ lines }) => (
  <h1 className="tagline">
    {lines.map((line, lineIdx) => {
      const lineBaseDelay = 0.1 + lineIdx * LINE_START_STAGGER;
      return (
        <span key={`${line}-${lineIdx}`} className="tagline-line">
          {line.split('').map((char, charIdx) => (
            <span
              key={charIdx}
              className="letter-span"
              style={{ animationDelay: `${lineBaseDelay + charIdx * LETTER_STAGGER}s` }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </span>
      );
    })}
  </h1>
);

const Landing = () => {
  const [gender, setGender] = useState('Any');
  const [country, setCountry] = useState('Any');
  const [countryOptions, setCountryOptions] = useState(DEFAULT_COUNTRY_OPTIONS);
  const [localCountryCode, setLocalCountryCode] = useState(getBrowserCountryCode);
  const [localCountryName, setLocalCountryName] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryRef = useRef(null);
  const countryTouchedRef = useRef(false);
  const [simple, setSimple] = useState(!localStorage.getItem('auth_token') && !localStorage.getItem('auth_user'));
  const [banInfo, setBanInfo] = useState(null);

  useEffect(() => {
    socket.on('online_count', (count) => setOnlineCount(count));
    socket.on('status', (s) => {
      if (s && typeof s.onlineCount === 'number') setOnlineCount(s.onlineCount);
      if (s && typeof s.queueSize === 'number') setQueueCount(s.queueSize);
    });
    const onConnect = () => socket.emit('get_online_count');
    socket.on('connect', onConnect);
    socket.connect();
    
    const token = localStorage.getItem('auth_token');
    const u = localStorage.getItem('auth_user');
    
    if (u) {
      try { 
        setUser(JSON.parse(u)); 
        setSimple(false); // If user exists, show full landing
      } catch {}
    } else if (token) {
      fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
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

    // Verificar se utilizador está banido
    fetch(`${API_URL}/api/auth/ban-check`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.json().catch(() => ({})))
      .then(d => { if (d?.banned) setBanInfo({ reason: d.reason, expires_at: d.expires_at }); })
      .catch(() => {});

    return () => {
      socket.off('online_count');
      socket.off('status');
      socket.off('connect', onConnect);
    };
  }, []);

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
    fetch(`${API_URL}/api/geo/me`)
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
    // Store filters in sessionStorage for Chat page
    sessionStorage.setItem('chat_filters', JSON.stringify({ gender, country }));
    navigate('/chat');
  };

  if (banInfo) {
    return <BanScreen reason={banInfo.reason} expiresAt={banInfo.expires_at} onContinue={() => setBanInfo(null)} />;
  }

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
          <h2 className="hero-title">Bem-vindo ao BAFLY</h2>
          <div className="hero-sub">MEET STRANGERS - NO LIMITS</div>

          <div className="online-pill">
            <span className="online-dot"></span>
            {onlineCount > 0 ? onlineCount.toLocaleString() : '–'} Conectados Agora
          </div>

          <div className="auth-actions">
            <button
              className="btn-fb"
              onClick={() => { window.location.href = `${API_URL}/api/auth/facebook/start`; }}
            >
              <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
              Continuar com Facebook
            </button>

            <button
              className="btn-google"
              onClick={() => { window.location.href = `${API_URL}/api/auth/google/start`; }}
            >
              <svg className="btn-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar com Google
            </button>

            <button
              className="btn-criar"
              onClick={() => navigate('/auth?mode=register')}
            >
              <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor" style={{opacity:0.85}}>
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                <path d="M20 8h-2V6h-2v2h-2v2h2v2h2v-2h2z"/>
              </svg>
              Criar conta
            </button>
          </div>

          <div className="auth-footer-note">
            <span className="age-badge">16+</span>
            Apenas para maiores de 16 anos
          </div>
          <div className="auth-legal">
            <span onClick={() => navigate('/termos')} className="legal-link">Termos de Serviço</span>
            {' | '}
            <span onClick={() => navigate('/privacidade')} className="legal-link">Privacidade</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page">
      <img src="/landing-cover.png" className="landing-bg-img" alt="" aria-hidden="true" />
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
          <div />
        )}
      </header>

      <main className="landing-main">
        <AnimatedTagline lines={getTaglineLines(localCountryCode)} />
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
        <p className="catchline">{getCatchline(localCountryCode)}</p>

        <button className="start-btn" onClick={handleStart}>
          ▶ Start
        </button>

      </main>
    </div>
  );
};

export default Landing;

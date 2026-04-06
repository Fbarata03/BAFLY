# BAFLY — Chat de Vídeo com Estranhos

Site em produção: **[bafly.net](https://bafly.net)**

Chat de vídeo em tempo real com estranhos de todo o mundo. Anónimo, sem registo obrigatório e completamente grátis.

---

## Funcionalidades

- Videochat P2P em tempo real (WebRTC + Socket.IO)
- Chat de texto durante a chamada
- Matchmaking com filtros de género e país
- Detecção automática de país e idioma do utilizador
- Tagline traduzida automaticamente em 14 idiomas
- Login com Google e Facebook (OAuth)
- Registo com email/password
- Controlo de câmara, microfone e troca de câmara (mobile)
- Interface mobile-first com suporte a safe-area (iPhone/Android)
- PiP arrastável no mobile (vídeo local)
- Report de utilizadores com captura de ecrã automática
- Ecrã de ban com contagem decrescente e restauro automático
- SEO completo (meta tags, Open Graph, sitemap, robots.txt, JSON-LD)

## Painel de Administração

Acessível em `/admin` — apenas para a conta admin.

- Dashboard com estatísticas em tempo real (sessões, online, reports, tempo médio)
- Gráfico de sessões dos últimos 7 dias
- Gestão de denúncias com captura de ecrã do momento da denúncia
- Banir utilizadores por 1 dia, 7 dias, 30 dias ou permanente
- Lista de utilizadores com pesquisa e paginação
- Gestão de bans ativos com opção de desbanir
- Limpeza automática diária da base de dados

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite |
| Realtime | Socket.IO + WebRTC (P2P) |
| Backend | Node.js + Express |
| Base de Dados | MySQL (mysql2) |
| Hosting Frontend | Netlify |
| Hosting Backend | Railway |

## Estrutura

```
client/          — Frontend React
  src/
    pages/       — Landing, Chat, Admin, Auth, Legal
    components/  — VideoGrid, Controls, ChatBox, ReportModal, BanScreen, OnlineBadge
  public/        — favicon, robots.txt, sitemap.xml, site.webmanifest

server/          — Backend Node.js
  routes/        — auth, reports, stats, admin
  middleware/    — requireAdmin, checkBan
  cleanup.js     — Limpeza automática diária da DB
  init_db.js     — Inicialização das tabelas MySQL
```

## Variáveis de Ambiente (Railway — servidor)

```
DATABASE_URL        = URL completa do MySQL Railway
JWT_SECRET          = chave secreta para tokens JWT
ADMIN_USERNAME      = Fbarata03
ADMIN_PASSWORD      = (password do painel admin)
GOOGLE_CLIENT_ID    = (OAuth Google)
GOOGLE_CLIENT_SECRET= (OAuth Google)
GOOGLE_REDIRECT_URI = https://bafly-server-production-49a3.up.railway.app/api/auth/google/callback
FACEBOOK_APP_ID     = (OAuth Facebook)
FACEBOOK_APP_SECRET = (OAuth Facebook)
FACEBOOK_REDIRECT_URI = https://bafly-server-production-49a3.up.railway.app/api/auth/facebook/callback
CLIENT_BASE_URL     = https://bafly.net
```

## Como correr localmente

**Backend**
```bash
cd server
npm install
npm run dev
```

**Frontend**
```bash
cd client
npm install
npm run dev
```

Abrir em: `http://localhost:5173`

## Limpeza Automática da Base de Dados

Corre todos os dias automaticamente:

| O que limpa | Quando |
|---|---|
| Screenshots de reports resolvidos | Após 7 dias |
| Reports antigos resolvidos | Após 6 meses |
| Sessões antigas | Após 90 dias |
| Stats diárias antigas | Após 1 ano |
| Bans expirados | Após 30 dias do fim |

**Nunca apaga utilizadores nem bans ativos.**

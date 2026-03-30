# BAFLY

BAFLY é uma aplicação de videochat em tempo real (estilo “random chat”), com chat de texto, controlo de câmara/microfone e sistema de reports/admin.

## Stack
- **Frontend:** React + Vite
- **Realtime:** Socket.IO + WebRTC (P2P)
- **Backend:** Node.js + Express
- **Base de Dados:** MySQL (mysql2)

## Requisitos
- Node.js (recomendado LTS)
- MySQL a correr localmente

## Estrutura do projeto
- `client/` — frontend (Vite + React)
- `server/` — backend (Express + Socket.IO)

## Configuração

### 1) Base de Dados (MySQL)
Cria uma base de dados e configura as credenciais no `.env` do servidor.

### 2) Variáveis de ambiente

#### `server/.env` (exemplo)


#### `client/.env` (exemplo)


## Como correr localmente

### Backend
```powershell
cd server
npm install
npm run dev
```

O servidor inicia em `http://localhost:3001`.

### Frontend
```powershell
cd client
npm install
npm run dev
```

O frontend inicia em `http://localhost:5173`.

## Funcionalidades
- Matchmaking (fila) e ligação por WebRTC
- Video + áudio (getUserMedia)
- Chat de texto
- Botões: mute, desligar câmara, next, stop
- Reports
- Página de admin

## Notas
- Em ambiente local, alguns browsers/OS podem ter limitações com emojis de bandeiras em selects; o projeto usa bandeiras por imagem quando necessário.
- O acesso à câmara pode falhar se estiver a ser usada por outra app (Zoom/Teams/Meet).

## Licença
Projeto pessoal/experimental.

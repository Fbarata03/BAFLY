# BAFLY

BAFLY é uma aplicação de videochat em tempo real (estilo “random chat”), com chat de texto, controlo de câmara/microfone e sistema de reports/admin.

## Stack
- Frontend: React + Vite
- Realtime: Socket.IO + WebRTC (P2P)
- Backend: Node.js + Express
- Base de Dados: MySQL (mysql2)

## Estrutura
- client/ — frontend
- server/ — backend

## Requisitos
- Node.js (recomendado LTS)
- MySQL a correr localmente

## Variáveis de ambiente
Cria os ficheiros `.env` abaixo (não são versionados por segurança).

server/.env (exemplo)
- PORT=3001
- DB_HOST=localhost
- DB_PORT=3306
- DB_USER=root
- DB_PASS=root
- DB_NAME=bafly
- ADMIN_PASSWORD=define_uma_password_forte
- JWT_SECRET=define_um_segredo_forte

client/.env (exemplo)
- VITE_SOCKET_URL=http://localhost:3001

## Como correr localmente
Backend
- cd server
- npm install
- npm run dev

Frontend
- cd client
- npm install
- npm run dev

Abrir
- http://localhost:5173

## Funcionalidades
- Matchmaking + videochat (WebRTC)
- Chat de texto
- Controlo de áudio/vídeo + trocar câmara (mobile)
- Reports e painel admin

## Notas
- Em mobile, o layout usa safe-area + 100dvh para encaixar bem no ecrã (iPhone/Android).

import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import Legal from './pages/Legal';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/termos" element={<Legal />} />
        <Route path="/privacidade" element={<Legal />} />
      </Routes>
    </div>
  );
}

export default App;

import React, { useState } from 'react';
import { socket } from '../socket';
import './ReportModal.css';

const PROD_BACKEND = "https://bafly-ej4m.onrender.com";
const API_URL =
  window.location.hostname === "localhost"
    ? ""
    : window.location.hostname === "bafly.net" || window.location.hostname.endsWith(".netlify.app")
      ? PROD_BACKEND
      : import.meta.env.VITE_API_URL || PROD_BACKEND;

const ReportModal = ({ onClose, reportedId, screenshot }) => {
  const [reason, setReason] = useState('Spam');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = [
    'Spam', 'Nudez', 'Assédio', 'Discurso de ódio', 'Menor de idade', 'Outro'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportedId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reported_id: reportedId,
          reason,
          description,
          reporter_id: socket.id,
          screenshot: screenshot || null
        })
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(onClose, 2000);
      }
    } catch (err) {
      console.error("Report failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {submitted ? (
          <div className="success-message">
            <span className="success-icon">✓</span>
            <p>Report enviado, obrigado!</p>
          </div>
        ) : (
          <>
            <h3>Denunciar Utilizador</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Motivo</label>
                <div className="reasons-grid">
                  {reasons.map(r => (
                    <button 
                      key={r}
                      type="button"
                      className={`reason-btn ${reason === r ? 'active' : ''}`}
                      onClick={() => setReason(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Descrição (opcional)</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Mais detalhes..."
                />
              </div>

              {screenshot && (
                <div className="form-group">
                  <label>Captura de ecrã</label>
                  <img src={screenshot} alt="Captura" style={{ width: '100%', borderRadius: 8, maxHeight: 160, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={onClose}>Cancelar</button>
                <button type="submit" className="submit-btn" disabled={isSubmitting || !reportedId}>
                  {isSubmitting ? 'Enviando...' : 'Enviar Report'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;

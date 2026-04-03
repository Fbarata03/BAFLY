import React, { useState, useEffect, useRef } from 'react';
import './ChatBox.css';

const ChatBox = ({ messages, onSendMessage, disabled, onClose, showClose, isOpen }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className={`chat-sidebar${isOpen ? ' chat-open' : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className="chat-sidebar-header">
        <div className="chat-sidebar-icon">
           <span className="material-icons">chat_bubble_outline</span>
        </div>
        <div className="chat-sidebar-info">
          <h3>Chat</h3>
          <p>Online</p>
        </div>
        {showClose ? (
          <button type="button" className="chat-close-btn" onClick={onClose} aria-label="Fechar chat">
            <span className="material-icons">close</span>
          </button>
        ) : null}
      </div>

      <div className="chat-messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`msg-wrapper ${msg.type}`}>
            {msg.type === 'system' ? (
              <div className="msg-system">{msg.text}</div>
            ) : (
              <div className={`msg-bubble ${msg.type}`}>
                {msg.text}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={disabled ? "Aguarda..." : "Escreve uma mensagem..."}
          disabled={disabled}
        />
        <button type="submit" className="send-btn" disabled={disabled || !inputValue.trim()}>
          <span className="material-icons">send</span>
        </button>
      </form>
    </div>
  );
};

export default ChatBox;

import React, { useState, useEffect, useRef } from 'react';
import './ChatBox.css';

const ChatBox = ({ messages, onSendMessage, disabled }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim() && !disabled) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className={`chat-sidebar ${disabled ? 'disabled' : ''}`}>
      <div className="messages-list">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-item ${msg.type}`}>
            {msg.type === 'system' ? (
              <span className="system-msg"><i>{msg.text}</i></span>
            ) : (
              <div className="msg-bubble">{msg.text}</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={disabled ? "Waiting for stranger..." : "Type a message..."}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !inputText.trim()}>➤</button>
      </form>
    </div>
  );
};

export default ChatBox;

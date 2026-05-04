import { useState, useEffect, useRef } from "react";
import ChatWindow from "./components/ChatWindow.jsx";
import InputBar from "./components/InputBar.jsx";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "";
const API_KEY = import.meta.env.VITE_API_KEY || "";
const AUTH_HEADER = { "X-API-Key": API_KEY };

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/session`, { method: "POST", headers: AUTH_HEADER })
      .then((r) => r.json())
      .then((data) => setSessionId(data.session_id));
  }, []);

  async function sendMessage(text) {
    if (!sessionId || streaming) return;

    const userMsg = { role: "user", content: text };
    const assistantMsg = { role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADER },
      body: JSON.stringify({ session_id: sessionId, message: text }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = JSON.parse(line.slice(6));
        if (payload.error) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: `Error: ${payload.error}`,
              error: true,
            };
            return updated;
          });
          break;
        }
        if (payload.token) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + payload.token,
            };
            return updated;
          });
        }
      }
    }

    setStreaming(false);
  }

  async function clearChat() {
    if (!sessionId) return;
    await fetch(`${API_BASE}/api/session/${sessionId}`, { method: "DELETE", headers: AUTH_HEADER });
    setMessages([]);
  }

  return (
    <div className="app">
      <header className="header">
        <span className="header-title">OSS Chatbot</span>
        <span className="header-model">gemma3:1b via Ollama</span>
        <button className="clear-btn" onClick={clearChat} disabled={streaming}>
          Clear
        </button>
      </header>
      <ChatWindow messages={messages} streaming={streaming} />
      <InputBar onSend={sendMessage} disabled={!sessionId || streaming} />
    </div>
  );
}

import "./Message.css";

export default function Message({ role, content, error, isStreaming }) {
  return (
    <div className={`message message--${role}${error ? " message--error" : ""}`}>
      <div className="message-label">{role === "user" ? "You" : "Assistant"}</div>
      <div className="message-bubble">
        <span className="message-text">{content}</span>
        {isStreaming && <span className="cursor" />}
      </div>
    </div>
  );
}

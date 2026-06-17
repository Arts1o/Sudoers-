'use client';

import { useRef, useState } from 'react';

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  tools?: string[];
}

export default function Home() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const history: UiMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '', tools: [] }]);
    setInput('');
    setBusy(true);
    scrollToBottom();

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Erreur serveur (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const patchLast = (fn: (m: UiMessage) => UiMessage) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = fn(next[next.length - 1]);
          return next;
        });

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === 'text') {
            patchLast((m) => ({ ...m, content: m.content + evt.text }));
          } else if (evt.type === 'tool') {
            patchLast((m) => ({ ...m, tools: [...(m.tools ?? []), evt.name] }));
          } else if (evt.type === 'error') {
            patchLast((m) => ({
              ...m,
              content: m.content + `\n\n⚠️ ${evt.message}`,
            }));
          }
          scrollToBottom();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: next[next.length - 1].content + `\n\n⚠️ ${msg}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎓 Edu-Agent</h1>
        <p>IA agentique au service de l'éducation — base de hackathon</p>
      </header>

      <div className="messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty">
            Posez une question, ou essayez :
            <ul>
              <li>« Crée-moi un plan de révision sur les fractions, niveau collège »</li>
              <li>« Explique la photosynthèse à un·e élève de CM2 »</li>
              <li>« Quelles sont les nouveautés du programme de SVT 2025 ? »</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="role">{m.role === 'user' ? 'Vous' : 'Agent'}</div>
            {m.tools && m.tools.length > 0 && (
              <div>
                {m.tools.map((t, j) => (
                  <span key={j} className="tool-chip">
                    🔧 {t}
                  </span>
                ))}
              </div>
            )}
            <div className="bubble">{m.content || (busy ? '…' : '')}</div>
          </div>
        ))}
      </div>

      <div className="composer">
        <textarea
          rows={2}
          value={input}
          placeholder="Écrivez votre message… (Entrée pour envoyer, Maj+Entrée pour un saut de ligne)"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
        />
        <button onClick={send} disabled={busy || !input.trim()}>
          {busy ? '…' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
}

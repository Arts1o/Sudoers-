'use client';

import { useEffect, useRef, useState } from 'react';
import { ageById } from '@/lib/story/catalog';
import type { StudioContext } from './StoryStudio';
import {
  Lantern,
  filesToAttachments,
  type ApiMessage,
  type PendingAtt,
  type UiMessage,
} from './chat-parts';

export default function Chat({ ctx, onBack }: { ctx: StudioContext; onBack: () => void }) {
  const ageLabel = ageById(ctx.age)?.label ?? ctx.age;
  const notion = ctx.picks.theme;

  const greeting =
    `Tu as aimé l’histoire « ${ctx.story.titre} » ? 🌟 ` +
    `Maintenant on peut creuser ${notion} ensemble. ` +
    `Pose-moi une question, demande un petit exercice, ou montre-moi un dessin / une photo 🖼️ — je m’adapte !`;

  const sessionContext =
    `Profil de l'enfant : tranche d'âge ${ageLabel}. ` +
    `Il vient de lire une histoire intitulée « ${ctx.story.titre} » ` +
    `(lieu : ${ctx.picks.lieu} ; personnage : ${ctx.picks.personnage} ; objet : ${ctx.picks.objet}) ` +
    `dont le but est d'enseigner la notion : ${notion}. ` +
    (ctx.story.lecon ? `Leçon visée : ${ctx.story.lecon} ` : '') +
    `Continue à l'accompagner sur cette notion, en adaptant ton langage à son âge.`;

  const [messages, setMessages] = useState<UiMessage[]>([{ role: 'assistant', content: greeting }]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingAtt[]>([]);
  const [busy, setBusy] = useState(false);

  const apiRef = useRef<ApiMessage[]>([{ role: 'assistant', content: greeting }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () =>
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
    );

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const suggestions = [
    `Explique-moi ${notion} simplement`,
    'Donne-moi un petit exercice',
    'Raconte une autre histoire sur ce thème',
  ];

  async function onPick(files: FileList | null, kind: 'image' | 'file') {
    if (!files) return;
    const next = await filesToAttachments(files, kind);
    if (next.length) setPending((p) => [...p, ...next]);
  }

  async function send(forced?: string) {
    const text = (forced ?? input).trim();
    if ((!text && pending.length === 0) || busy) return;

    const atts = pending;
    const blocks = [...atts.map((a) => a.block)];
    if (text) blocks.push({ type: 'text', text });

    const userApi: ApiMessage = { role: 'user', content: blocks };
    const nextApi = [...apiRef.current, userApi];
    apiRef.current = nextApi;

    setMessages((m) => [
      ...m,
      { role: 'user', content: text || (atts.length ? 'Regarde ça 👀' : ''), attachments: atts.map((a) => a.ui) },
      { role: 'assistant', content: '', tools: [], streaming: true },
    ]);
    setInput('');
    setPending([]);
    setBusy(true);
    scrollToBottom();

    const patchLast = (fn: (m: UiMessage) => UiMessage) =>
      setMessages((prev) => {
        const out = [...prev];
        out[out.length - 1] = fn(out[out.length - 1]);
        return out;
      });

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextApi, context: sessionContext }),
      });
      if (!res.ok || !res.body) throw new Error(`Erreur serveur (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === 'text') {
            full += evt.text;
            patchLast((m) => ({ ...m, content: m.content + evt.text }));
          } else if (evt.type === 'tool') {
            patchLast((m) => ({ ...m, tools: [...(m.tools ?? []), evt.name] }));
          } else if (evt.type === 'error') {
            full += `\n\n⚠️ ${evt.message}`;
            patchLast((m) => ({ ...m, content: m.content + `\n\n⚠️ ${evt.message}` }));
          }
          scrollToBottom();
        }
      }
      apiRef.current = [...nextApi, { role: 'assistant', content: full }];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patchLast((m) => ({ ...m, content: m.content + `\n\n⚠️ ${msg}` }));
    } finally {
      patchLast((m) => ({ ...m, streaming: false }));
      setBusy(false);
      scrollToBottom();
    }
  }

  const canSend = (input.trim().length > 0 || pending.length > 0) && !busy;

  return (
    <div className="chat">
      <header className="chat-head">
        <button className="chat-back" type="button" onClick={onBack}>
          ← Histoire
        </button>
        <span className="lantern" aria-hidden="true">
          <Lantern size={40} />
        </span>
        <div className="chat-who">
          <b>Lumi</b>
          <small>● là pour t’aider</small>
        </div>
        <div className="ctx-chip" title={`${ageLabel} · ${notion}`}>
          <span>
            {ageLabel} · {notion}
          </span>
        </div>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`c-row ${m.role === 'user' ? 'user' : 'bot'}`}>
            {m.role === 'assistant' && (
              <span className="c-av" aria-hidden="true">
                <Lantern size={34} />
              </span>
            )}
            <div className="c-col">
              {m.tools && m.tools.length > 0 && (
                <div className="c-tools">
                  {m.tools.map((t, j) => (
                    <span key={j} className="tool-chip">
                      🔧 {t}
                    </span>
                  ))}
                </div>
              )}
              {m.streaming && !m.content ? (
                <div className="c-bubble typing">
                  <span className="d" />
                  <span className="d" />
                  <span className="d" />
                </div>
              ) : (
                <div className="c-bubble">
                  {m.content}
                  {m.attachments?.map((a, k) =>
                    a.kind === 'image' && a.url ? (
                      <img key={k} className="c-img" src={a.url} alt={a.name} />
                    ) : (
                      <span key={k} className="c-att">
                        📎 {a.name}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!busy && (
        <div className="suggest">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="composer-wrap">
        <div className="composer">
          {pending.length > 0 && (
            <div className="att-preview">
              {pending.map((a, i) => (
                <span key={i} className="att-tag">
                  {a.ui.kind === 'image' && a.ui.url ? <img src={a.ui.url} alt="" /> : <span>📄</span>}
                  {a.ui.name}
                  <button
                    className="rm"
                    type="button"
                    aria-label="Retirer"
                    onClick={() => setPending((p) => p.filter((_, k) => k !== i))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="composer-row">
            <button
              className="tool-btn"
              type="button"
              title="Joindre un fichier"
              aria-label="Joindre un fichier"
              onClick={() => fileRef.current?.click()}
            >
              📎
            </button>
            <button
              className="tool-btn"
              type="button"
              title="Joindre une image"
              aria-label="Joindre une image"
              onClick={() => imgRef.current?.click()}
            >
              🖼️
            </button>
            <textarea
              className="c-input"
              rows={1}
              value={input}
              placeholder="Pose ta question à Lumi…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) send();
                }
              }}
            />
            <button
              className="send"
              type="button"
              disabled={!canSend}
              onClick={() => send()}
              aria-label="Envoyer"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 12L20 4l-3.5 16-4.5-6-5-1.5z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          void onPick(e.target.files, 'file');
          e.target.value = '';
        }}
      />
      <input
        ref={imgRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          void onPick(e.target.files, 'image');
          e.target.value = '';
        }}
      />
    </div>
  );
}

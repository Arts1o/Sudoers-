'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AGES,
  CATS,
  CAT_ORDER,
  DEFAULT_AGE,
  DEFAULT_PICKS,
  LOADING_LINES,
  ageById,
  type AgeId,
  type CatKey,
  type Picks,
  type Story,
} from '@/lib/story/catalog';

export interface StudioContext {
  age: AgeId;
  picks: Picks;
  story: Story;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function StoryStudio({
  onContinue,
}: {
  onContinue: (ctx: StudioContext) => void;
}) {
  const [age, setAge] = useState<AgeId>(DEFAULT_AGE);
  const [picks, setPicks] = useState<Picks>(DEFAULT_PICKS);
  const [status, setStatus] = useState<Status>('idle');
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState('');
  const [loadIdx, setLoadIdx] = useState(0);
  const storyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (status !== 'loading') return;
    setLoadIdx(0);
    const t = setInterval(() => setLoadIdx((i) => (i + 1) % LOADING_LINES.length), 1400);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status === 'done' && storyRef.current) {
      storyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [status, story]);

  const setPick = (cat: CatKey, val: string) => setPicks((p) => ({ ...p, [cat]: val }));

  const surprise = () => {
    setStory(null);
    setStatus('idle');
    setAge(AGES[Math.floor(Math.random() * AGES.length)].id);
    const next = { ...DEFAULT_PICKS };
    CAT_ORDER.forEach((c) => {
      const o = CATS[c].options;
      next[c] = o[Math.floor(Math.random() * o.length)];
    });
    setPicks(next);
  };

  const ready = Boolean(
    age && picks.lieu.trim() && picks.personnage.trim() && picks.objet.trim() && picks.theme.trim(),
  );

  async function generate() {
    if (!ready || status === 'loading') return;
    setStatus('loading');
    setError('');
    setStory(null);
    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age, ...picks }),
      });
      const data = await res.json();
      if (data.ok && data.story) {
        setStory(data.story as Story);
        setStatus('done');
      } else {
        setError(data.message || "La création de l'histoire n'a pas abouti.");
        setStatus('error');
      }
    } catch {
      setError('La création de l’histoire a échoué. Vérifie ta connexion, puis réessaie.');
      setStatus('error');
    }
  }

  const ageLabel = ageById(age)?.label ?? age;
  const recap = ready
    ? `${picks.personnage}, dans ${picks.lieu}, avec ${picks.objet} — pour découvrir ${picks.theme}.`
    : 'Choisis un ingrédient dans chaque catégorie.';

  return (
    <div className="fab-root">
      <div className="fab-glow" aria-hidden="true" />
      <div className="fab-stars" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className={'st st' + i} />
        ))}
      </div>

      <main className="fab-wrap">
        <header className="fab-head">
          <div className="fab-eyebrow">✦ Fabrique à histoires</div>
          <h1 className="fab-h1">
            Compose un conte,
            <br />
            et apprends en chemin.
          </h1>
          <p className="fab-lede">
            Choisis l’âge, le décor, le héros, un objet et une notion à découvrir. L’histoire
            s’écrit pour toi — puis tu pourras continuer avec Lumi.
          </p>
        </header>

        {/* ÂGE */}
        <section className="fab-block">
          <div className="fab-label">
            <span className="dot" />
            <span className="num">00</span> Pour quel âge&nbsp;?
          </div>
          <div className="age-grid">
            {AGES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAge(a.id)}
                aria-pressed={age === a.id}
                className={'age' + (age === a.id ? ' on' : '')}
              >
                <span className="age-num">{a.label}</span>
                <span className="age-sub">{a.sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* INGRÉDIENTS */}
        {CAT_ORDER.map((cat) => {
          const c = CATS[cat];
          return (
            <section className={`fab-block cat--${cat}`} key={cat}>
              <div className="fab-label">
                <span className="dot" />
                <span className="num">{c.n}</span> {c.titre}
              </div>
              <div className="chips">
                {c.options.map((opt) => {
                  const on = picks[cat] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPick(cat, opt)}
                      aria-pressed={on}
                      className={'chip' + (on ? ' on' : '')}
                    >
                      {on && <span className="tick">✓</span>}
                      {opt}
                    </button>
                  );
                })}
                <input
                  className="chip chip-input"
                  placeholder={c.placeholder}
                  value={c.options.includes(picks[cat]) ? '' : picks[cat]}
                  onChange={(e) => setPick(cat, e.target.value)}
                />
              </div>
            </section>
          );
        })}

        {/* RECAP + ACTIONS */}
        <div className="fab-recap">
          <span className="recap-tag">Pour les {ageLabel} :</span> {recap}
        </div>

        <div className="fab-actions">
          <button
            type="button"
            className="cta"
            onClick={generate}
            disabled={!ready || status === 'loading'}
          >
            {status === 'loading' ? (
              <span className="cta-load">
                <span className="spin" /> {LOADING_LINES[loadIdx]}
              </span>
            ) : (
              <>✦ Composer l’histoire</>
            )}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={surprise}
            disabled={status === 'loading'}
            title="Tout choisir au hasard"
          >
            🎲 Surprends-moi
          </button>
        </div>

        {status === 'error' && (
          <div className="fab-error">
            {error}{' '}
            <button className="retry" type="button" onClick={generate}>
              Réessayer
            </button>
          </div>
        )}

        {/* HISTOIRE */}
        {status === 'done' && story && (
          <article className="story" ref={storyRef}>
            <div className="story-band" aria-hidden="true" />
            <div className="story-kicker">Une histoire pour les {ageLabel}</div>
            <h2 className="story-title">{story.titre}</h2>
            <div className="story-body">
              {story.paragraphes.map((p, i) => (
                <p key={i} className={i === 0 ? 'story-p dropcap' : 'story-p'}>
                  {p}
                </p>
              ))}
            </div>

            {story.lecon && (
              <div className="lesson">
                <div className="lesson-label">Ce que tu as appris</div>
                <p>{story.lecon}</p>
              </div>
            )}

            <div className="story-foot">
              <button
                className="ghost sm"
                type="button"
                onClick={generate}
                disabled={status !== 'done'}
              >
                ↻ Une autre histoire
              </button>
              <button
                className="ghost sm"
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                ✎ Changer les ingrédients
              </button>
              <button
                className="cta sm"
                type="button"
                onClick={() => onContinue({ age, picks, story })}
              >
                💬 Continuer avec Lumi
              </button>
            </div>
          </article>
        )}

        <footer className="fab-foot">
          Chaque histoire est écrite à la demande — relance pour en obtenir une nouvelle.
        </footer>
      </main>
    </div>
  );
}

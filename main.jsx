import React, { useState, useEffect, useRef } from "react";

/*  Fabrique à histoires
    Une interface qui compose une histoire éducative sur mesure pour un enfant :
    âge → lieu → personnage → objet → notion à apprendre, puis Claude écrit le récit.
    Direction visuelle : « histoire du soir sous la lampe » — nuit indigo, lueur d'ambre,
    page de conte en parchemin avec lettrine. */

const AGES = [
  { id: "4-6",  label: "4–6 ans",  sub: "Tout-petits",
    guidance: "Phrases très courtes et simples, beaucoup de répétitions et de sons rigolos, 4 à 5 petits paragraphes, ton chaleureux et rassurant. Le concept est abordé de façon très concrète et imagée, sans aucun vocabulaire technique." },
  { id: "7-9",  label: "7–9 ans",  sub: "Primaire",
    guidance: "Phrases simples mais variées, un peu de dialogue, 5 à 6 paragraphes, une petite énigme à résoudre. Le concept est expliqué avec une image concrète et un exemple facile." },
  { id: "10-12", label: "10–12 ans", sub: "Collège",
    guidance: "Vocabulaire plus riche, intrigue avec un rebondissement, 6 à 7 paragraphes, le personnage raisonne à voix haute. Le concept est présenté avec ses idées clés et un exemple chiffré simple." },
  { id: "13-16", label: "13–16 ans", sub: "Ados",
    guidance: "Récit plus mature avec de vrais enjeux et de la tension, 6 à 8 paragraphes. Le concept est expliqué avec précision : énoncé, conditions d'application et un exemple concret travaillé." },
];

const CATS = {
  lieu:       { n: "01", titre: "Le lieu",        color: "var(--teal)",   placeholder: "Autre lieu…",
                options: ["une forêt enchantée","un château fort","une plage déserte","l'espace","une ville futuriste","une ferme","le fond de l'océan","une montagne enneigée"] },
  personnage: { n: "02", titre: "Le personnage",  color: "var(--rose)",   placeholder: "Autre personnage…",
                options: ["un petit dragon","une princesse intrépide","un robot curieux","une exploratrice","un chat parlant","un jeune magicien","une astronaute","un renard malin"] },
  objet:      { n: "03", titre: "L'objet",         color: "var(--amber)",  placeholder: "Autre objet…",
                options: ["une clé dorée","un télescope","une carte au trésor","une boussole magique","un grand miroir","une longue corde","une lanterne","un carnet de croquis"] },
  theme:      { n: "04", titre: "La notion à apprendre", color: "var(--violet)", placeholder: "Autre notion…",
                options: ["le théorème de Thalès","le théorème de Pythagore","les fractions","le cycle de l'eau","la photosynthèse","la gravité","les fuseaux horaires","la symétrie","les nombres premiers","le système solaire"] },
};

const LOADING_LINES = [
  "On allume la lanterne…",
  "On choisit les mots justes…",
  "On installe le décor…",
  "Il était une fois…",
];

/*  Lecture à voix haute (ElevenLabs text-to-speech).
    ⚠️ SÉCURITÉ : cette app est 100 % côté navigateur. La clé ci-dessous est donc
    visible par quiconque ouvre la page. Pour la production, déplace l'appel
    ElevenLabs derrière un petit backend/proxy et NE LIVRE PAS la clé au client.
    En attendant, on lit la clé depuis une variable d'env (VITE_ELEVENLABS_API_KEY)
    si elle existe, sinon on retombe sur la valeur en dur. */
const ELEVENLABS_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_ELEVENLABS_API_KEY) ||
  "sk_bea5c035f228b65a2ad6aa45238b225a1c37594ad4742828";
const ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // « Sarah » — voix douce, dispo en plan gratuit
const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"; // multilingue, bon rendu en français

export default function App() {
  const [age, setAge] = useState("7-9");
  const [picks, setPicks] = useState({
    lieu: "une forêt enchantée",
    personnage: "un petit dragon",
    objet: "une clé dorée",
    theme: "le théorème de Thalès",
  });
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [story, setStory] = useState(null);
  const [error, setError] = useState("");
  const [loadIdx, setLoadIdx] = useState(0);
  const storyRef = useRef(null);

  // Lecture à voix haute
  const [audioStatus, setAudioStatus] = useState("idle"); // idle | loading | ready | error
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioError, setAudioError] = useState("");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  // Polices
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Nunito:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(l);
    return () => { try { document.head.removeChild(l); } catch (_) {} };
  }, []);

  // Messages de chargement qui défilent
  useEffect(() => {
    if (status !== "loading") return;
    setLoadIdx(0);
    const t = setInterval(() => setLoadIdx(i => (i + 1) % LOADING_LINES.length), 1400);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status === "done" && storyRef.current) {
      storyRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status, story]);

  // Dès que l'audio est prêt, on tente la lecture (le navigateur peut la bloquer ;
  // l'utilisateur garde alors le bouton « Écouter »).
  useEffect(() => {
    if (audioStatus === "ready" && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [audioStatus, audioUrl]);

  // Libère le blob audio précédent quand il change, et au démontage.
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  const setPick = (cat, val) => setPicks(p => ({ ...p, [cat]: val }));

  const surprise = () => {
    setStory(null);
    setStatus("idle");
    resetAudio();
    setAge(AGES[Math.floor(Math.random() * AGES.length)].id);
    const next = {};
    Object.keys(CATS).forEach(c => {
      const o = CATS[c].options;
      next[c] = o[Math.floor(Math.random() * o.length)];
    });
    setPicks(next);
  };

  const ready = age && picks.lieu && picks.personnage && picks.objet && picks.theme;

  async function generate() {
    if (!ready || status === "loading") return;
    setStatus("loading");
    setError("");
    setStory(null);
    resetAudio();

    const a = AGES.find(x => x.id === age);
    const system =
      "Tu es un conteur francophone spécialisé dans les histoires éducatives pour enfants. " +
      "Tu écris des récits captivants qui enseignent une notion de manière naturelle, jamais comme un cours plaqué. " +
      "Tu réponds toujours et uniquement en JSON valide.";

    const user =
`Écris une histoire originale en français pour un enfant de la tranche d'âge « ${a.label} ».

Ingrédients imposés, à intégrer de façon centrale :
- Lieu : ${picks.lieu}
- Personnage principal : ${picks.personnage}
- Objet important : ${picks.objet}
- Notion à enseigner : ${picks.theme}

Consignes :
- Le personnage doit découvrir ou utiliser la notion (${picks.theme}) pour résoudre un problème concret de l'intrigue.
- Donne un titre évocateur.
- Adaptation à l'âge : ${a.guidance}
- Le champ "lecon" explique clairement la notion pour cet âge (2 à 4 phrases), avec un exemple si pertinent.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises Markdown, au format exact :
{"titre": "…", "paragraphes": ["…", "…"], "lecon": "…"}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const text = (data.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n")
        .trim();
      const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      let parsed = null;
      try { parsed = JSON.parse(clean); } catch (_) { parsed = null; }
      let built;
      if (parsed && Array.isArray(parsed.paragraphes) && parsed.paragraphes.length) {
        built = {
          titre: parsed.titre || "Ton histoire",
          paragraphes: parsed.paragraphes.filter(Boolean),
          lecon: parsed.lecon || "",
        };
      } else {
        const paras = clean.split(/\n\n+/).filter(Boolean);
        built = { titre: "Ton histoire", paragraphes: paras.length ? paras : [clean], lecon: "" };
      }
      setStory(built);
      setStatus("done");
      // L'histoire est écrite : on lance la lecture à voix haute.
      narrate(built);
    } catch (e) {
      setStatus("error");
      setError("La création de l'histoire n'a pas abouti. Vérifie ta connexion, puis réessaie.");
    }
  }

  function resetAudio() {
    setAudioStatus("idle");
    setAudioUrl(null); // l'effet de nettoyage révoque l'ancien blob
    setAudioError("");
    setPlaying(false);
  }

  // Envoie le texte de l'histoire à ElevenLabs et récupère un MP3 à lire.
  async function narrate(s) {
    if (!s) return;
    setAudioStatus("loading");
    setAudioError("");
    setPlaying(false);

    const text = [
      s.titre,
      ...s.paragraphes,
      s.lecon ? "Ce que tu as appris : " + s.lecon : "",
    ].filter(Boolean).join("\n\n");

    try {
      const res = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/" + ELEVENLABS_VOICE_ID,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: ELEVENLABS_MODEL_ID,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.15,
              use_speaker_boost: true,
            },
          }),
        }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      setAudioStatus("ready");
    } catch (e) {
      setAudioStatus("error");
      setAudioError("La lecture à voix haute n'a pas pu être générée.");
    }
  }

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const recap = ready
    ? `${picks.personnage}, dans ${picks.lieu}, avec ${picks.objet} — pour découvrir ${picks.theme}.`
    : "Choisis un ingrédient dans chaque catégorie.";

  return (
    <div className="fab-root">
      <style>{CSS}</style>
      <div className="fab-glow" aria-hidden="true" />
      <div className="fab-stars" aria-hidden="true">
        {[...Array(7)].map((_, i) => <span key={i} className={"st st" + i} />)}
      </div>

      <main className="fab-wrap">
        <header className="fab-head">
          <div className="fab-eyebrow">✦ Fabrique à histoires</div>
          <h1 className="fab-h1">Compose un conte,<br />et apprends en chemin.</h1>
          <p className="fab-lede">
            Choisis l'âge, le décor, le héros, un objet et une notion à découvrir.
            L'histoire s'écrit pour toi, à voix haute.
          </p>
        </header>

        {/* ÂGE */}
        <section className="fab-block">
          <div className="fab-label"><span className="dot" style={{ background: "var(--gold)" }} /><span className="num">00</span> Pour quel âge&nbsp;?</div>
          <div className="age-grid">
            {AGES.map(a => (
              <button
                key={a.id}
                onClick={() => setAge(a.id)}
                aria-pressed={age === a.id}
                className={"age" + (age === a.id ? " on" : "")}
              >
                <span className="age-num">{a.label}</span>
                <span className="age-sub">{a.sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* INGREDIENTS */}
        {Object.entries(CATS).map(([cat, c]) => (
          <section className="fab-block" key={cat}>
            <div className="fab-label">
              <span className="dot" style={{ background: c.color }} />
              <span className="num">{c.n}</span> {c.titre}
            </div>
            <div className="chips">
              {c.options.map(opt => {
                const on = picks[cat] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setPick(cat, opt)}
                    aria-pressed={on}
                    className={"chip" + (on ? " on" : "")}
                    style={on ? { borderColor: c.color, background: tint(c.color), color: "var(--cream)" } : undefined}
                  >
                    {on && <span className="tick" style={{ color: c.color }}>✓</span>}
                    {opt}
                  </button>
                );
              })}
              <input
                className="chip chip-input"
                placeholder={c.placeholder}
                value={c.options.includes(picks[cat]) ? "" : picks[cat]}
                onChange={e => setPick(cat, e.target.value)}
              />
            </div>
          </section>
        ))}

        {/* RECAP + ACTIONS */}
        <div className="fab-recap">
          <span className="recap-tag">Pour les {AGES.find(a => a.id === age)?.label} :</span> {recap}
        </div>

        <div className="fab-actions">
          <button className="cta" onClick={generate} disabled={!ready || status === "loading"}>
            {status === "loading"
              ? <span className="cta-load"><span className="spin" /> {LOADING_LINES[loadIdx]}</span>
              : <>✦ Composer l'histoire</>}
          </button>
          <button className="ghost" onClick={surprise} disabled={status === "loading"} title="Tout choisir au hasard">
            🎲 Surprends-moi
          </button>
        </div>

        {/* ERREUR */}
        {status === "error" && (
          <div className="fab-error">
            {error} <button className="retry" onClick={generate}>Réessayer</button>
          </div>
        )}

        {/* HISTOIRE */}
        {status === "done" && story && (
          <article className="story" ref={storyRef}>
            <div className="story-band" aria-hidden="true" />
            <div className="story-kicker">Une histoire pour les {AGES.find(a => a.id === age)?.label}</div>
            <h2 className="story-title">{story.titre}</h2>

            {audioStatus !== "idle" && (
              <div className="narration">
                {audioStatus === "loading" && (
                  <span className="narr-load">
                    <span className="spin spin-dark" /> On prête une voix à l'histoire…
                  </span>
                )}
                {audioStatus === "ready" && audioUrl && (
                  <>
                    <button className="narr-play" onClick={togglePlay}>
                      {playing ? "❚❚ Pause" : "▶ Écouter l'histoire"}
                    </button>
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      preload="auto"
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onEnded={() => setPlaying(false)}
                    />
                    <span className="narr-hint">Lecture par ElevenLabs</span>
                  </>
                )}
                {audioStatus === "error" && (
                  <span className="narr-err">
                    {audioError}{" "}
                    <button className="retry" onClick={() => narrate(story)}>Réessayer</button>
                  </span>
                )}
              </div>
            )}

            <div className="story-body">
              {story.paragraphes.map((p, i) => (
                <p key={i} className={i === 0 ? "story-p dropcap" : "story-p"}>{p}</p>
              ))}
            </div>

            {story.lecon && (
              <div className="lesson">
                <div className="lesson-label">Ce que tu as appris</div>
                <p>{story.lecon}</p>
              </div>
            )}

            <div className="story-foot">
              <button className="ghost sm" onClick={generate} disabled={status === "loading"}>↻ Une autre histoire</button>
              <button className="ghost sm" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>✎ Changer les ingrédients</button>
            </div>
          </article>
        )}

        <footer className="fab-foot">Chaque histoire est écrite à la demande — relance pour en obtenir une nouvelle.</footer>
      </main>
    </div>
  );
}

/* fond teinté très léger pour une puce active */
function tint(varColor) {
  const map = {
    "var(--teal)": "rgba(63,168,155,0.16)",
    "var(--rose)": "rgba(212,105,154,0.16)",
    "var(--amber)": "rgba(224,169,43,0.16)",
    "var(--violet)": "rgba(138,111,209,0.16)",
  };
  return map[varColor] || "rgba(255,255,255,0.1)";
}

const CSS = `
:root{
  --indigo:#1F1838; --indigo-2:#2A1F45; --plum:#382252;
  --paper:#FBF4E6; --paper-2:#FDF9F0;
  --ink:#2A2347; --ink-soft:#5C5478;
  --cream:#F3EBDD; --muted:#B7ABD2;
  --gold:#F2A93B; --gold-deep:#E0852A; --gold-soft:#F6C66B;
  --teal:#3FA89B; --rose:#D4699A; --violet:#9B7FE0; --amber:#E0A92B;
  --line:rgba(243,235,221,0.13);
}
*{box-sizing:border-box}
.fab-root{
  position:relative; min-height:100%; width:100%;
  font-family:'Nunito',system-ui,sans-serif; color:var(--cream);
  background:
    radial-gradient(120% 80% at 50% -10%, #3a2459 0%, transparent 55%),
    linear-gradient(165deg, var(--indigo) 0%, var(--indigo-2) 55%, #241640 100%);
  overflow:hidden;
}
.fab-glow{position:absolute; top:-160px; left:50%; transform:translateX(-50%);
  width:560px; height:360px; border-radius:50%;
  background:radial-gradient(closest-side, rgba(242,169,59,0.22), transparent 70%);
  filter:blur(8px); pointer-events:none;}
.fab-stars .st{position:absolute; width:3px; height:3px; border-radius:50%;
  background:var(--gold-soft); opacity:.5; animation:tw 4s ease-in-out infinite;}
.st0{top:9%;left:14%}.st1{top:16%;left:82%;animation-delay:.6s}.st2{top:26%;left:46%;animation-delay:1.4s}
.st3{top:7%;left:62%;animation-delay:2s}.st4{top:21%;left:28%;animation-delay:1s}
.st5{top:33%;left:9%;animation-delay:2.6s}.st6{top:12%;left:38%;animation-delay:3.2s}
@keyframes tw{0%,100%{opacity:.18;transform:scale(.8)}50%{opacity:.85;transform:scale(1.25)}}

.fab-wrap{position:relative; max-width:760px; margin:0 auto; padding:54px 22px 64px;}

.fab-head{text-align:center; margin-bottom:38px;}
.fab-eyebrow{font-weight:700; letter-spacing:.14em; text-transform:uppercase;
  font-size:12.5px; color:var(--gold-soft); margin-bottom:16px;}
.fab-h1{font-family:'Fraunces',Georgia,serif; font-weight:600; line-height:1.04;
  font-size:clamp(34px,6.4vw,52px); margin:0 0 14px; color:#FCF6EA;
  letter-spacing:-.01em; text-wrap:balance;}
.fab-lede{max-width:430px; margin:0 auto; color:var(--muted);
  font-size:16px; line-height:1.55;}

.fab-block{margin:0 0 26px;}
.fab-label{display:flex; align-items:center; gap:9px; font-weight:700;
  font-size:14px; letter-spacing:.02em; color:var(--cream); margin-bottom:13px;}
.fab-label .dot{width:8px; height:8px; border-radius:50%; box-shadow:0 0 10px currentColor;}
.fab-label .num{font-family:'Fraunces',serif; font-weight:600; color:var(--muted);
  font-size:13px; opacity:.75; margin-right:1px;}

.age-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:10px;}
.age{appearance:none; cursor:pointer; text-align:left; border-radius:15px;
  padding:15px 14px; background:rgba(255,255,255,0.045);
  border:1.5px solid var(--line); color:var(--cream);
  display:flex; flex-direction:column; gap:3px; transition:transform .15s, border-color .15s, background .15s;}
.age:hover{background:rgba(255,255,255,0.08); transform:translateY(-2px);}
.age-num{font-family:'Fraunces',serif; font-weight:600; font-size:18px; line-height:1;}
.age-sub{font-size:12px; color:var(--muted); font-weight:600;}
.age.on{border-color:var(--gold); background:linear-gradient(180deg, rgba(242,169,59,0.18), rgba(242,169,59,0.07));
  box-shadow:0 6px 24px -10px rgba(242,169,59,.6);}
.age.on .age-num{color:var(--gold-soft);}

.chips{display:flex; flex-wrap:wrap; gap:9px;}
.chip{appearance:none; cursor:pointer; font:inherit; font-size:14px; font-weight:600;
  padding:9px 15px; border-radius:999px; background:rgba(255,255,255,0.05);
  border:1.5px solid var(--line); color:var(--cream);
  display:inline-flex; align-items:center; gap:6px; transition:transform .14s, background .14s, border-color .14s;}
.chip:hover{background:rgba(255,255,255,0.1); transform:translateY(-1px);}
.chip .tick{font-weight:800; font-size:12px;}
.chip-input{min-width:130px; color:var(--cream); cursor:text;}
.chip-input::placeholder{color:rgba(183,171,210,0.7);}
.chip-input:focus{outline:none; border-color:var(--gold-soft); background:rgba(255,255,255,0.09);}

.fab-recap{margin:30px 0 18px; padding:14px 18px; border-radius:14px;
  background:rgba(255,255,255,0.04); border:1px solid var(--line);
  color:var(--cream); font-size:15px; line-height:1.5; text-align:center;}
.recap-tag{color:var(--gold-soft); font-weight:800;}

.fab-actions{display:flex; gap:12px; flex-wrap:wrap; justify-content:center; align-items:center;}
.cta{appearance:none; cursor:pointer; font:inherit; font-weight:800; font-size:17px;
  color:#2A1A05; padding:16px 30px; border-radius:999px; border:none;
  background:linear-gradient(180deg, var(--gold-soft), var(--gold) 55%, var(--gold-deep));
  box-shadow:0 14px 36px -12px rgba(242,169,59,.8), inset 0 1px 0 rgba(255,255,255,.4);
  transition:transform .15s, box-shadow .15s; letter-spacing:.01em;}
.cta:hover:not(:disabled){transform:translateY(-2px); box-shadow:0 20px 46px -14px rgba(242,169,59,.95);}
.cta:active:not(:disabled){transform:translateY(0);}
.cta:disabled{opacity:.55; cursor:not-allowed;}
.cta-load{display:inline-flex; align-items:center; gap:10px;}
.spin{width:15px; height:15px; border-radius:50%; border:2.5px solid rgba(42,26,5,.3);
  border-top-color:#2A1A05; display:inline-block; animation:sp .7s linear infinite;}
@keyframes sp{to{transform:rotate(360deg)}}
.ghost{appearance:none; cursor:pointer; font:inherit; font-weight:700; font-size:15px;
  color:var(--cream); padding:14px 20px; border-radius:999px;
  background:transparent; border:1.5px solid var(--line); transition:background .15s, border-color .15s;}
.ghost:hover:not(:disabled){background:rgba(255,255,255,0.08); border-color:var(--muted);}
.ghost:disabled{opacity:.5; cursor:not-allowed;}
.ghost.sm{font-size:13.5px; padding:10px 16px;}

.fab-error{margin-top:20px; padding:14px 18px; border-radius:13px;
  background:rgba(212,105,154,0.12); border:1px solid rgba(212,105,154,.4);
  color:#F7DCEA; font-size:15px; text-align:center;}
.retry{margin-left:8px; font:inherit; font-weight:800; color:var(--gold-soft);
  background:none; border:none; cursor:pointer; text-decoration:underline;}

/* PAGE DE CONTE */
.story{position:relative; margin-top:44px; background:linear-gradient(180deg, var(--paper-2), var(--paper));
  color:var(--ink); border-radius:22px; padding:40px clamp(24px,5vw,52px) 36px;
  box-shadow:0 40px 90px -36px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.7);
  animation:rise .55s cubic-bezier(.2,.7,.2,1) both; overflow:hidden;}
.story-band{position:absolute; top:0; left:0; right:0; height:6px;
  background:linear-gradient(90deg, var(--gold-deep), var(--gold), var(--gold-soft));}
@keyframes rise{from{opacity:0; transform:translateY(20px)}to{opacity:1; transform:none}}
.story-kicker{font-weight:800; letter-spacing:.1em; text-transform:uppercase;
  font-size:11.5px; color:var(--gold-deep); margin-bottom:8px;}
.story-title{font-family:'Fraunces',Georgia,serif; font-weight:600;
  font-size:clamp(27px,4.6vw,38px); line-height:1.08; margin:0 0 22px;
  color:var(--ink); letter-spacing:-.01em; text-wrap:balance;}
.story-body{font-size:17px; line-height:1.78; color:#352E52;}
.story-p{margin:0 0 16px;}
.dropcap::first-letter{font-family:'Fraunces',Georgia,serif; font-weight:700;
  float:left; font-size:64px; line-height:.82; padding:6px 12px 0 0;
  color:var(--gold-deep);}
.lesson{margin-top:26px; padding:18px 20px; border-radius:14px;
  background:linear-gradient(180deg, rgba(242,169,59,.12), rgba(242,169,59,.06));
  border-left:4px solid var(--gold);}
.lesson-label{font-weight:800; letter-spacing:.04em; font-size:12.5px;
  text-transform:uppercase; color:var(--gold-deep); margin-bottom:6px;}
.lesson p{margin:0; font-size:15.5px; line-height:1.65; color:#3D3558;}
/* Barre de lecture à voix haute */
.narration{display:flex; align-items:center; flex-wrap:wrap; gap:12px;
  margin:0 0 26px; padding:13px 16px; border-radius:13px;
  background:linear-gradient(180deg, rgba(155,127,224,.12), rgba(155,127,224,.05));
  border:1px solid rgba(155,127,224,.28);}
.narr-load{display:inline-flex; align-items:center; gap:9px;
  font-weight:700; font-size:14.5px; color:var(--violet);}
.narr-play{appearance:none; cursor:pointer; font:inherit; font-weight:800; font-size:15px;
  color:#fff; padding:10px 20px; border-radius:999px; border:none;
  background:linear-gradient(180deg, #a98fe6, var(--violet) 60%, #7a5fd0);
  box-shadow:0 10px 26px -12px rgba(138,111,209,.9), inset 0 1px 0 rgba(255,255,255,.35);
  transition:transform .15s, box-shadow .15s;}
.narr-play:hover{transform:translateY(-2px); box-shadow:0 16px 34px -14px rgba(138,111,209,1);}
.narr-play:active{transform:translateY(0);}
.narr-hint{font-size:12.5px; font-weight:700; color:var(--ink-soft); opacity:.8;}
.narr-err{font-size:14.5px; color:#9b3d6e; font-weight:600;}
.narr-err .retry{color:var(--violet);}
.spin-dark{border-color:rgba(138,111,209,.3); border-top-color:var(--violet);}

.story-foot{display:flex; gap:10px; flex-wrap:wrap; margin-top:26px;
  padding-top:20px; border-top:1px solid rgba(42,35,71,.12);}
.story-foot .ghost{color:var(--ink); border-color:rgba(42,35,71,.18);}
.story-foot .ghost:hover{background:rgba(42,35,71,.06); border-color:rgba(42,35,71,.3);}

.fab-foot{text-align:center; margin-top:40px; color:var(--muted);
  font-size:13px; opacity:.8;}

@media (max-width:560px){
  .age-grid{grid-template-columns:repeat(2,1fr);}
  .fab-actions{flex-direction:column;}
  .fab-actions .cta,.fab-actions .ghost{width:100%; text-align:center; justify-content:center;}
}
:focus-visible{outline:2.5px solid var(--gold-soft); outline-offset:2px; border-radius:4px;}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important; transition:none!important;}
}
`;

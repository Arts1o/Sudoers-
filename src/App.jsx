import React, { useState, useEffect, useRef } from "react";

// Minimalized App wrapper using the original UI logic
export default function App() {
  const [age, setAge] = useState("7-9");
  const [story, setStory] = useState(null);
  const storyRef = useRef(null);

  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [story])

  const generate = async () => {
    setStory({ titre: 'Histoire de démonstration', paragraphes: ['Ceci est une histoire de démonstration.'], lecon: 'Exemple.' })
  }

  return (
    <div style={{ padding: 24, fontFamily: 'Nunito, system-ui, sans-serif' }}>
      <h1>Fabrique à histoires (local)</h1>
      <p>Âge sélectionné : {age}</p>
      <button onClick={() => setAge('4-6')}>4–6 ans</button>
      <button onClick={() => setAge('7-9')}>7–9 ans</button>
      <div style={{ marginTop: 12 }}>
        <button onClick={generate}>Composer l'histoire (démo)</button>
      </div>

      {story && (
        <article ref={storyRef} style={{ marginTop: 18 }}>
          <h2>{story.titre}</h2>
          {story.paragraphes.map((p, i) => <p key={i}>{p}</p>)}
          <div><strong>Leçon :</strong> {story.lecon}</div>
        </article>
      )}
    </div>
  )
}

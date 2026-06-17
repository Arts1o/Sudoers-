'use client';

import { useState } from 'react';
import StoryStudio, { type StudioContext } from '@/components/StoryStudio';
import Chat from '@/components/Chat';

export default function Home() {
  const [ctx, setCtx] = useState<StudioContext | null>(null);

  // Tant qu'on n'a pas « continué avec Lumi », on reste dans le studio.
  if (!ctx) {
    return <StoryStudio onContinue={setCtx} />;
  }
  return <Chat ctx={ctx} onBack={() => setCtx(null)} />;
}

'use client';

/* Types, helpers et mascotte pour l'écran de chat (extraits pour garder
   Chat.tsx lisible). */

export type Role = 'user' | 'assistant';

export interface UiAttachment {
  kind: 'image' | 'file';
  name: string;
  url?: string; // data URL pour l'aperçu image
}

export interface UiMessage {
  role: Role;
  content: string;
  attachments?: UiAttachment[];
  tools?: string[];
  streaming?: boolean;
}

export type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: string; data: string };
      title: string;
    };

export interface ApiMessage {
  role: Role;
  content: string | Block[];
}

export interface PendingAtt {
  ui: UiAttachment;
  block: Block;
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT_BYTES = 4 * 1024 * 1024;

export function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/** Convertit une liste de fichiers en pièces jointes (UI + bloc API). */
export async function filesToAttachments(
  files: FileList,
  kind: 'image' | 'file',
): Promise<PendingAtt[]> {
  const next: PendingAtt[] = [];
  for (const file of Array.from(files)) {
    try {
      if (kind === 'image' || file.type.startsWith('image/')) {
        if (file.size > MAX_IMAGE_BYTES) continue;
        const dataUrl = await readAsDataURL(file);
        const data = dataUrl.split(',')[1] ?? '';
        next.push({
          ui: { kind: 'image', name: file.name, url: dataUrl },
          block: {
            type: 'image',
            source: { type: 'base64', media_type: file.type || 'image/png', data },
          },
        });
      } else if (file.type === 'application/pdf') {
        if (file.size > MAX_IMAGE_BYTES) continue;
        const dataUrl = await readAsDataURL(file);
        const data = dataUrl.split(',')[1] ?? '';
        next.push({
          ui: { kind: 'file', name: file.name },
          block: {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data },
            title: file.name,
          },
        });
      } else {
        if (file.size > MAX_TEXT_BYTES) continue;
        const text = await readAsText(file);
        next.push({
          ui: { kind: 'file', name: file.name },
          block: { type: 'text', text: `Contenu du fichier « ${file.name} » :\n\n${text}` },
        });
      }
    } catch {
      /* fichier illisible : ignoré */
    }
  }
  return next;
}

/** Mascotte « Lumi » : une lanterne dorée souriante. */
export function Lantern({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Lumi">
      <defs>
        <radialGradient id="lum" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#FFF1C2" />
          <stop offset="55%" stopColor="#F6C66B" />
          <stop offset="100%" stopColor="#E0852A" />
        </radialGradient>
      </defs>
      <ellipse cx="24" cy="44" rx="13" ry="3" fill="#000" opacity="0.18" />
      <rect x="21" y="4" width="6" height="4" rx="2" fill="#E0852A" />
      <path d="M24 7c8 0 13 6 13 15 0 7-5 14-13 14S11 29 11 22C11 13 16 7 24 7z" fill="url(#lum)" />
      <circle cx="19.5" cy="21" r="2.6" fill="#2A2347" />
      <circle cx="28.5" cy="21" r="2.6" fill="#2A2347" />
      <circle cx="20.4" cy="20.2" r="0.8" fill="#fff" />
      <circle cx="29.4" cy="20.2" r="0.8" fill="#fff" />
      <path d="M19 26q5 4 10 0" stroke="#2A2347" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="15" cy="25" r="2.4" fill="#FF8FB1" opacity="0.5" />
      <circle cx="33" cy="25" r="2.4" fill="#FF8FB1" opacity="0.5" />
    </svg>
  );
}

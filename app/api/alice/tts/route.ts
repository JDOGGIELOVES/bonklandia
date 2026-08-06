import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

/**
 * Same-origin TTS proxy.
 * In-app browsers (Solflare) and autoplay policies need audio from our domain
 * after a user tap. Upstream: Google Translate TTS (no key; reliable from edge).
 * StreamElements is tried first when available; many cloud IPs get 401.
 */

const ALLOWED_VOICES = new Set([
  'Brian',
  'Amy',
  'Emma',
  'Joey',
  'Justin',
  'Matthew',
  'Salli',
  'Russell',
  'Geraint',
  'Nicole',
  'Raveena',
]);

/** Map Polly-style names to a Google TTS language / accent. */
const VOICE_LANG: Record<string, string> = {
  Brian: 'en-GB',
  Amy: 'en-GB',
  Emma: 'en-GB',
  Joey: 'en-US',
  Justin: 'en-US',
  Matthew: 'en-US',
  Salli: 'en-US',
  Russell: 'en-AU',
  Geraint: 'en-GB',
  Nicole: 'en-AU',
  Raveena: 'en-IN',
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchStreamElements(text: string, voice: string): Promise<ArrayBuffer | null> {
  const upstream = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(upstream, {
      headers: {
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        'User-Agent': BROWSER_UA,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return buf.byteLength ? buf : null;
  } catch {
    return null;
  }
}

async function fetchGoogleTts(text: string, lang: string): Promise<ArrayBuffer | null> {
  // Google TTS hard-caps ~200 chars; entity lines are short.
  const q = text.slice(0, 200);
  const upstream = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(upstream, {
      headers: {
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        'User-Agent': BROWSER_UA,
        Referer: 'https://translate.google.com/',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return buf.byteLength ? buf : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = checkRateLimit(`alice-tts:ip:${ip}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawText = (searchParams.get('text') ?? '').trim().slice(0, 280);
  if (!rawText) {
    return NextResponse.json({ error: 'Missing text.' }, { status: 400 });
  }

  let voice = (searchParams.get('voice') ?? 'Brian').trim();
  if (!ALLOWED_VOICES.has(voice)) voice = 'Brian';
  const lang = VOICE_LANG[voice] || 'en-US';

  // Prefer SE Polly voices when the edge can reach them; else Google.
  const se = await fetchStreamElements(rawText, voice);
  const buf = se ?? (await fetchGoogleTts(rawText, lang));

  if (!buf) {
    return NextResponse.json(
      { error: 'Voice service unavailable. Try again in a moment.' },
      { status: 502 },
    );
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Length': String(buf.byteLength),
    },
  });
}

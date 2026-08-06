import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

/**
 * Same-origin TTS proxy.
 * In-app browsers (Solflare) and some Chrome policies block third-party audio hosts;
 * playing /api/alice/tts from our domain works with a user tap.
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

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = checkRateLimit(`alice-tts:ip:${ip}`, 40, 60 * 60 * 1000);
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

  const upstream = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(rawText)}`;

  try {
    const res = await fetch(upstream, {
      headers: {
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        'User-Agent': 'BonklandiaAliceTTS/1.0',
      },
      // TTS is public; no cookies
      cache: 'force-cache',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Voice service unavailable (${res.status}).` },
        { status: 502 },
      );
    }

    const buf = await res.arrayBuffer();
    if (!buf.byteLength) {
      return NextResponse.json({ error: 'Empty voice response.' }, { status: 502 });
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Length': String(buf.byteLength),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach voice service. Check network and try again.' },
      { status: 502 },
    );
  }
}

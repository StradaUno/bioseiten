import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* Kontaktformular -> contact_submissions. Derzeit von keiner Seite genutzt (der
   Kontakt-Knopf ist ein mailto auf office@viuno.de), aber erreichbar. Deshalb seit
   dem Launch-Check (15.09.2026): Honeypot, Rate-Limit je Adresse und harte Laengen,
   damit die Tabelle nicht von aussen vollgeschrieben werden kann. */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* Rate-Limit im Speicher der Instanz: nicht perfekt (mehrere Instanzen sehen sich
   nicht), aber ein Bot, der dieselbe Instanz trifft, kommt nicht weit. */
const rateMap = new Map<string, number[]>();
const MAX_PER_HOUR = 3;
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) || []).filter((t) => t > now - 3_600_000);
  if (timestamps.length >= MAX_PER_HOUR) return true;
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

function antwort(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normalizeHandle(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@+/, "").slice(0, 100);
}

function validateEmail(email: string): boolean {
  // Keine Zeilenumbrueche, kein Header-Injection-Spielraum, gaengige Form.
  return email.length <= 320 && !/[\r\n]/.test(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return antwort({ success: false, error: "Method not allowed" }, 405);

  try {
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) return antwort({ success: false, error: "Zu viele Anfragen. Bitte später erneut." }, 429);

    const body = await req.json();

    /* Honeypot: das Feld "firma" ist im Formular unsichtbar. Fuellt es jemand,
       ist es ein Bot -- er bekommt ein freundliches Ja und nichts wird gespeichert. */
    if (body.firma) return antwort({ success: true });

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const message = String(body.message ?? "").trim();
    const instagram_handle = normalizeHandle(body.instagram_handle);
    const tiktok_handle = normalizeHandle(body.tiktok_handle);
    const website_url = body.website_url ? String(body.website_url).trim().slice(0, 500) : null;
    const source = body.source ? String(body.source).slice(0, 100) : "landing-page";

    if (!name || name.length < 2 || name.length > 200 || /[\r\n]/.test(name)) {
      return antwort({ success: false, error: "Bitte gib deinen Namen ein." }, 400);
    }
    if (!email || !validateEmail(email)) {
      return antwort({ success: false, error: "Bitte gib eine gültige E-Mail-Adresse ein." }, 400);
    }
    if (!message || message.length < 5 || message.length > 5000) {
      return antwort({ success: false, error: "Bitte schreib kurz worum es geht." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { error } = await supabase.from("contact_submissions").insert({
      name: name.slice(0, 200),
      email,
      message: message.slice(0, 5000),
      instagram_handle,
      tiktok_handle,
      website_url,
      source,
    });

    if (error) {
      console.error("Insert error:", error);
      return antwort({ success: false, error: "Speichern fehlgeschlagen." }, 500);
    }
    return antwort({ success: true });
  } catch (err) {
    console.error("Function error:", err);
    return antwort({ success: false, error: "Ungültige Anfrage." }, 400);
  }
});

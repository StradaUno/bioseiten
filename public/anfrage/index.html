<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kooperation anfragen</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: white; border-radius: 24px; padding: 40px; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .creator-header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #f0f0f0; }
    .creator-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: #e0e0e0; }
    .creator-name { font-size: 18px; font-weight: 700; color: #111; }
    .creator-sub { font-size: 13px; color: #888; margin-top: 2px; }
    h2 { font-size: 20px; font-weight: 700; margin-bottom: 6px; color: #111; }
    .subtitle { font-size: 14px; color: #888; margin-bottom: 28px; }
    .field { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #444; margin-bottom: 6px; }
    input, textarea, select { width: 100%; padding: 12px 14px; border: 1.5px solid #e5e5e5; border-radius: 10px; font-size: 15px; font-family: inherit; color: #111; background: white; transition: border-color 0.2s; outline: none; }
    input:focus, textarea:focus, select:focus { border-color: #111; }
    textarea { resize: vertical; min-height: 100px; }
    .budget-row { display: flex; gap: 10px; }
    .budget-row input { flex: 1; }
    .budget-row select { width: 80px; flex-shrink: 0; }
    .submit-btn { width: 100%; padding: 16px; background: #111; color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    .submit-btn:hover { background: #333; }
    .submit-btn:disabled { background: #ccc; cursor: not-allowed; }
    .success { display: none; text-align: center; padding: 40px 20px; }
    .success-icon { font-size: 48px; margin-bottom: 16px; }
    .success h3 { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #111; }
    .success p { color: #888; font-size: 14px; }
    .error-msg { background: #fff0f0; color: #cc0000; padding: 12px 14px; border-radius: 10px; font-size: 14px; margin-bottom: 16px; display: none; }
    .loading { text-align: center; padding: 60px 0; color: #888; }
    .required { color: #cc0000; }
  </style>
</head>
<body>
  <div class="card">

    <div class="loading" id="loading">
      <p>Lade Creator-Profil…</p>
    </div>

    <div id="form-wrapper" style="display:none">
      <div class="creator-header">
        <img id="creator-avatar" class="creator-avatar" src="" alt="">
        <div>
          <div class="creator-name" id="creator-name">–</div>
          <div class="creator-sub" id="creator-sub">Creator</div>
        </div>
      </div>

      <h2>Kooperation anfragen</h2>
      <p class="subtitle">Fülle das Formular aus – der Creator meldet sich bei dir.</p>

      <div class="error-msg" id="error-msg"></div>

      <div class="field">
        <label>Dein Name <span class="required">*</span></label>
        <input type="text" id="sender_name" placeholder="Max Mustermann">
      </div>

      <div class="field">
        <label>Deine E-Mail <span class="required">*</span></label>
        <input type="email" id="sender_email" placeholder="max@firma.de">
      </div>

      <div class="field">
        <label>Unternehmen / Marke</label>
        <input type="text" id="company" placeholder="Muster GmbH">
      </div>

      <div class="field">
        <label>Was planst du? <span class="required">*</span></label>
        <textarea id="message" placeholder="Beschreibe kurz dein Produkt, die gewünschte Kooperation und den Zeitraum…"></textarea>
      </div>

      <div class="field">
        <label>Budget (optional)</label>
        <div class="budget-row">
          <input type="number" id="budget" placeholder="500" min="0">
          <select id="currency">
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="CHF">CHF</option>
          </select>
        </div>
      </div>

      <button class="submit-btn" id="submit-btn" onclick="submitForm()">
        Anfrage senden
      </button>
    </div>

    <div class="success" id="success">
      <div class="success-icon">✓</div>
      <h3>Anfrage gesendet!</h3>
      <p>Der Creator wurde benachrichtigt und meldet sich in Kürze bei dir.</p>
    </div>

  </div>

  <script>
    const SUPABASE_URL = 'https://bzejndghppuipnedasuv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZWpuZGdocHB1aXBuZWRhc3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTMxOTcsImV4cCI6MjA4OTIyOTE5N30.TShH1cIABQCtKgLkhCS9ymUJ36ZUYnlvCnGTok6EKTo';

    let creatorId = null;
    let bioPageId = null;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('creator');

    async function supabaseFetch(path, options = {}) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    async function loadCreator() {
      if (!slug) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('form-wrapper').style.display = 'block';
        showError('Kein Creator-Link angegeben.');
        return;
      }

      try {
        const users = await supabaseFetch(
          `users?bio_page_slug=eq.${encodeURIComponent(slug)}&select=id,full_name,profile_image_url,niche`
        );

        if (!users.length) throw new Error('Nicht gefunden');
        const user = users[0];
        creatorId = user.id;

        const bioPages = await supabaseFetch(
          `bio_pages?user_id=eq.${user.id}&is_active=eq.true&select=id`
        );
        if (!bioPages.length) throw new Error('Bio-Page nicht aktiv');
        bioPageId = bioPages[0].id;

        document.getElementById('creator-name').textContent = user.full_name || 'Creator';
        document.getElementById('creator-sub').textContent = user.niche || 'Creator';
        if (user.profile_image_url) {
          document.getElementById('creator-avatar').src = user.profile_image_url;
        }

        document.getElementById('loading').style.display = 'none';
        document.getElementById('form-wrapper').style.display = 'block';

      } catch (err) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('form-wrapper').style.display = 'block';
        showError('Dieser Creator-Link ist nicht mehr aktiv.');
      }
    }

    async function submitForm() {
      const name = document.getElementById('sender_name').value.trim();
      const email = document.getElementById('sender_email').value.trim();
      const message = document.getElementById('message').value.trim();
      const budget = document.getElementById('budget').value;
      const company = document.getElementById('company').value.trim();

      if (!name || !email || !message) {
        showError('Bitte fülle alle Pflichtfelder aus.');
        return;
      }
      if (!email.includes('@')) {
        showError('Bitte gib eine gültige E-Mail-Adresse ein.');
        return;
      }
      if (!creatorId || !bioPageId) {
        showError('Creator konnte nicht geladen werden.');
        return;
      }

      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.textContent = 'Wird gesendet…';
      hideError();

      try {
        await supabaseFetch('collab_requests', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            bio_page_id: bioPageId,
            creator_id: creatorId,
            sender_name: name,
            sender_email: email,
            message: company ? `[${company}] ${message}` : message,
            budget: budget ? parseFloat(budget) : null,
            status: 'new'
          })
        });

        document.getElementById('form-wrapper').style.display = 'none';
        document.getElementById('success').style.display = 'block';

      } catch (err) {
        showError('Fehler beim Senden. Bitte versuche es erneut.');
        btn.disabled = false;
        btn.textContent = 'Anfrage senden';
      }
    }

    function showError(msg) {
      const el = document.getElementById('error-msg');
      el.textContent = msg;
      el.style.display = 'block';
    }

    function hideError() {
      document.getElementById('error-msg').style.display = 'none';
    }

    loadCreator();
  </script>
</body>
</html>

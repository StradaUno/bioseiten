/**
 * viuno · sidebar.js
 * Zentrale Sidebar-Komponente für alle Seiten.
 * Einbinden mit: <script src="/sidebar.js"></script>
 * Aktive Seite wird automatisch erkannt über window.location.pathname.
 * Avatar + User-E-Mail werden über Supabase Session befüllt.
 *
 * Voraussetzungen:
 *  - Supabase Client muss als `window.sb` oder `window.supabase` verfügbar sein
 *    ODER die Seite übergibt eine Session via window.sidebarSession = session
 *  - Im <body> muss ein <div id="sidebar-root"></div> vorhanden sein
 *  - CSS-Variablen aus dem Seiten-Theme werden genutzt (--bg, --surface, etc.)
 */

(function() {
  'use strict';

  // ── NAV STRUCTURE ──────────────────────────────────────────────────────────
  const NAV = [
    {
      section: 'Übersicht',
      items: [
        {
          label: 'Dashboard',
          href: '/dashboard',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
        },
        {
          label: 'Daily Digest',
          href: '/digest',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`
        }
      ]
    },
    {
      section: 'Creator',
      items: [
        {
          label: 'Analytics',
          href: '/analytics',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
        },
        {
          label: 'Trends',
          href: '/trends',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`
        }
      ]
    },
    {
      section: 'Business',
      items: [
        {
          label: 'Anfragen',
          href: '/requests',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
        },
        {
          label: 'BioLink',
          href: '/biolink',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
        },
        {
          label: 'Media Kit',
          href: '/mediakit',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
        },
        {
          label: 'Extras',
          href: '/extras',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
        }
      ]
    },
    {
      section: 'Konto',
      items: [
        {
          label: 'Profil',
          href: '/profile',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
        }
      ]
    }
  ];

  // ── CSS ────────────────────────────────────────────────────────────────────
  const CSS = `
    .sb-overlay{position:fixed;inset:0;background:rgba(0,0,0,0);z-index:80;pointer-events:none;transition:background .25s}
    .sb-overlay.open{background:rgba(0,0,0,.35);pointer-events:auto}
    .sb-sidebar{position:fixed;top:0;left:0;bottom:0;width:272px;background:var(--surface,#fff);z-index:90;transform:translateX(-100%);transition:transform .28s cubic-bezier(.32,.72,0,1);display:flex;flex-direction:column;box-shadow:4px 0 24px rgba(0,0,0,.08)}
    .sb-sidebar.open{transform:translateX(0)}
    .sb-header{padding:20px 20px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border,rgba(0,0,0,.08))}
    .sb-logo{display:flex;align-items:center;gap:8px}
    .sb-logo-mark{width:28px;height:28px;border-radius:7px;background:var(--text,#111);color:white;display:grid;place-items:center;font-size:12px;font-weight:700;font-family:inherit}
    .sb-logo-text{font-size:16px;font-weight:700;letter-spacing:-.03em;color:var(--text,#111)}
    .sb-close{width:32px;height:32px;border-radius:99px;background:var(--surface2,#f0efed);border:none;cursor:pointer;display:grid;place-items:center;font-size:18px;color:var(--muted,#7a7975);line-height:1;font-family:inherit}
    .sb-nav{flex:1;padding:10px;overflow-y:auto}
    .sb-section{font-size:10px;font-weight:700;color:var(--subtle,#b0afa9);text-transform:uppercase;letter-spacing:.08em;padding:12px 10px 4px}
    .sb-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;text-decoration:none;color:var(--muted,#7a7975);font-size:13px;font-weight:500;transition:all .15s;margin-bottom:2px;cursor:pointer}
    .sb-item:hover{background:var(--surface2,#f0efed);color:var(--text,#111)}
    .sb-item.active{background:var(--text,#111);color:white}
    .sb-item svg{flex-shrink:0}
    .sb-pro-badge{display:inline-flex;align-items:center;gap:4px;background:var(--text,#111);color:white;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:.04em;margin-left:auto;flex-shrink:0}
    .sb-item.active .sb-pro-badge{background:rgba(255,255,255,.25);color:white}
    .sb-extras-hint{font-size:11px;color:var(--subtle,#b0afa9);padding:6px 12px 10px;line-height:1.4}
    .sb-footer{padding:14px 16px;border-top:1px solid var(--border,rgba(0,0,0,.08))}
    .sb-pro-banner{background:var(--text,#111);border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px}
    .sb-pro-icon{font-size:18px;flex-shrink:0}
    .sb-pro-text{flex:1;min-width:0}
    .sb-pro-title{font-size:12px;font-weight:700;color:white;margin-bottom:1px}
    .sb-pro-sub{font-size:10px;color:rgba(255,255,255,.55);line-height:1.3}
    .sb-user{font-size:12px;color:var(--muted,#7a7975);margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sb-logout{width:100%;padding:10px;border-radius:8px;background:var(--surface2,#f0efed);border:1px solid var(--border-strong,rgba(0,0,0,.13));font-family:inherit;font-size:13px;font-weight:500;color:var(--text,#111);cursor:pointer;transition:background .15s;margin-bottom:10px}
    .sb-logout:hover{background:var(--border,rgba(0,0,0,.08))}
    .sb-legal{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
    .sb-legal a{font-size:11px;color:var(--subtle,#b0afa9);text-decoration:none;transition:color .15s}
    .sb-legal a:hover{color:var(--muted,#7a7975)}
    .sb-legal span{font-size:11px;color:var(--subtle,#b0afa9)}
  `;

  // ── HELPERS ────────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function getActivePath() {
    return window.location.pathname.replace(/\/$/, '') || '/';
  }

  function isActive(href) {
    const current = getActivePath();
    // Exact match or sub-path match for non-root pages
    return current === href || (href !== '/' && current.startsWith(href));
  }

  // ── INJECT CSS ─────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('viuno-sidebar-css')) return;
    const style = document.createElement('style');
    style.id = 'viuno-sidebar-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ── BUILD HTML ─────────────────────────────────────────────────────────────
  function buildSidebarHTML() {
    let navHTML = '';
    for (const group of NAV) {
      navHTML += `<div class="sb-section">${escHtml(group.section)}</div>`;
      for (const item of group.items) {
        const active = isActive(item.href) ? ' active' : '';
        const proBadge = item.href === '/extras'
          ? `<span class="sb-pro-badge">✦ viuno Pro</span>`
          : '';
        navHTML += `
          <a class="sb-item${active}" href="${escHtml(item.href)}">
            ${item.icon}
            ${escHtml(item.label)}
            ${proBadge}
          </a>`;
      }
    }

    return `
      <div class="sb-overlay" id="sb-overlay" onclick="closeSidebar()"></div>
      <div class="sb-sidebar" id="sb-sidebar">
        <div class="sb-header">
          <div class="sb-logo">
            <div class="sb-logo-mark">v</div>
            <div class="sb-logo-text">viuno</div>
          </div>
          <button class="sb-close" onclick="closeSidebar()">✕</button>
        </div>
        <nav class="sb-nav">${navHTML}</nav>
        <div class="sb-footer">
          <div class="sb-pro-banner" id="sb-pro-banner" style="display:none">
            <div class="sb-pro-icon">⭐</div>
            <div class="sb-pro-text">
              <div class="sb-pro-title">viuno Pro</div>
              <div class="sb-pro-sub">Managed Creator · Exklusive Features</div>
            </div>
          </div>
          <div class="sb-user" id="sb-user-email"></div>
          <button class="sb-logout" onclick="sidebarLogout()">Abmelden</button>
          <div class="sb-legal">
            <a href="/legal#impressum">Impressum</a>
            <span>·</span>
            <a href="/legal#datenschutz">Datenschutz</a>
            <span>·</span>
            <a href="/legal#agb">AGB</a>
          </div>
        </div>
      </div>`;
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  function render() {
    // Prefer dedicated root, fallback to body prepend
    let root = document.getElementById('sidebar-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'sidebar-root';
      document.body.insertBefore(root, document.body.firstChild);
    }
    root.innerHTML = buildSidebarHTML();
  }

  // ── FILL USER INFO ─────────────────────────────────────────────────────────
  async function fillUser() {
    const emailEl = document.getElementById('sb-user-email');
    const proBanner = document.getElementById('sb-pro-banner');

    // Try to get session from global sb / supabase client or window.sidebarSession
    let session = window.sidebarSession || null;

    if (!session) {
      const client = window.sb || window.supabase;
      if (client) {
        try {
          const { data } = await client.auth.getSession();
          session = data?.session || null;
        } catch(_) {}
      }
    }

    if (!session) return;

    if (emailEl) emailEl.textContent = session.user?.email || '';

    // Check if user is Pro (managed creator)
    const client = window.sb || window.supabase;
    if (client && proBanner) {
      try {
        const { data: profile } = await client
          .from('users')
          .select('subscription_type')
          .eq('id', session.user.id)
          .single();
        if (profile?.subscription_type === 'pro') {
          proBanner.style.display = 'flex';
        }
      } catch(_) {}
    }
  }

  // ── GLOBAL FUNCTIONS ───────────────────────────────────────────────────────
  window.openSidebar = function() {
    document.getElementById('sb-sidebar')?.classList.add('open');
    document.getElementById('sb-overlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeSidebar = function() {
    document.getElementById('sb-sidebar')?.classList.remove('open');
    document.getElementById('sb-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  };

  window.sidebarLogout = async function() {
    const client = window.sb || window.supabase;
    if (client) {
      try { await client.auth.signOut(); } catch(_) {}
    }
    location.replace('https://viuno.de');
  };

  // Backwards compat — some pages call logout() directly
  if (!window.logout) {
    window.logout = window.sidebarLogout;
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
    render();
    fillUser();
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// Blackjack Play — scripts communs du site : menu, galerie, détection du système, sommaire.
(function () {
  const LANG = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const TXT = {
    fr: { you: 'Ton système', dlFor: 'Télécharger pour ', addHome: 'Ajouter à l\'écran d\'accueil', dlPage: '/telecharger', thanks: '/merci' },
    en: { you: 'Your system', dlFor: 'Download for ', addHome: 'Add to home screen', dlPage: '/en/download', thanks: '/en/thanks' },
  }[LANG];

  // Langue : choix mémorisé via les drapeaux, sinon langue du navigateur (jamais pour les robots d'indexation)
  document.querySelectorAll('[data-setlang]').forEach((a) => a.addEventListener('click', () => {
    try { localStorage.setItem('bp.lang', a.dataset.setlang); } catch { /* ignoré */ }
  }));
  try {
    const bot = /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent);
    let saved = localStorage.getItem('bp.lang');
    if (!saved && !bot) {
      const prefs = (navigator.languages || [navigator.language || 'fr']).map((l) => l.toLowerCase());
      saved = prefs.find((l) => l.startsWith('fr') || l.startsWith('en'))?.slice(0, 2) || (prefs[0].startsWith('fr') ? 'fr' : 'en');
      localStorage.setItem('bp.lang', saved);
      const alt = document.body.dataset.alt;
      if (saved !== LANG && alt && !sessionStorage.getItem('bp.redirected')) {
        sessionStorage.setItem('bp.redirected', '1');
        location.replace(alt + location.search + location.hash);
        return;
      }
    }
  } catch { /* stockage indisponible : on reste sur la page */ }
  // Menu mobile
  const head = document.querySelector('.site-head');
  const menuBtn = document.querySelector('.menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', () => {
    const open = head.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  // Système d'exploitation du visiteur
  const ua = navigator.userAgent;
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  let os = null;
  if (/android|iphone|ipad|ipod/i.test(ua)) os = 'mobile';
  else if (/win/i.test(platform) || /windows/i.test(ua)) os = 'windows';
  else if (/mac/i.test(platform)) os = 'mac';
  else if (/linux|x11/i.test(platform + ua)) os = 'linux';
  const OS_NAME = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

  const card = os && document.querySelector(`.dl-card[data-os="${os}"]`);
  if (card) {
    card.classList.add('current');
    const tag = document.createElement('span');
    tag.className = 'you';
    tag.textContent = TXT.you;
    card.prepend(tag);
  }
  const osBtn = document.querySelector('[data-os-btn]');
  if (osBtn) {
    const label = osBtn.querySelector('[data-os-label]');
    if (OS_NAME[os]) { label.textContent = TXT.dlFor + OS_NAME[os]; osBtn.href = TXT.dlPage + '#' + os; }
    else if (os === 'mobile') { label.textContent = TXT.addHome; osBtn.href = TXT.dlPage; }
  }

  // Liens de téléchargement : adresse définitive lue dans downloads.json
  const dls = document.querySelectorAll('[data-dl]');
  if (dls.length) {
    fetch('/assets/downloads.json').then((r) => r.json()).then((cfg) => {
      dls.forEach((a) => {
        const f = cfg.files[a.dataset.dl];
        if (f) a.href = cfg.base + f.file;
      });
    }).catch(() => {});
  }

  // Galerie en grand
  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    const items = [...gallery.querySelectorAll('a')];
    let idx = 0, box = null;
    const show = (i) => {
      idx = (i + items.length) % items.length;
      const a = items[idx];
      box.querySelector('img').src = a.href;
      box.querySelector('img').alt = a.querySelector('img').alt;
      box.querySelector('p').textContent = a.querySelector('figcaption')?.textContent || '';
    };
    const close = () => { box?.remove(); box = null; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    };
    items.forEach((a, i) => a.addEventListener('click', (e) => {
      e.preventDefault();
      box = document.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Image du jeu');
      box.innerHTML = '<div><img alt=""><p></p></div><button class="lb-close" aria-label="Fermer">×</button><button class="lb-prev" aria-label="Précédente">‹</button><button class="lb-next" aria-label="Suivante">›</button>';
      box.addEventListener('click', (ev) => { if (ev.target === box) close(); });
      box.querySelector('.lb-close').onclick = close;
      box.querySelector('.lb-prev').onclick = () => show(idx - 1);
      box.querySelector('.lb-next').onclick = () => show(idx + 1);
      document.body.append(box);
      document.addEventListener('keydown', onKey);
      show(i);
    }));
  }

  // Sommaire : section en cours
  const toc = document.querySelectorAll('.toc a[href^="#"]');
  if (toc.length && 'IntersectionObserver' in window) {
    const map = new Map([...toc].map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          toc.forEach((a) => a.classList.remove('on'));
          map.get(en.target.id)?.classList.add('on');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // Compteurs anonymes : clics de téléchargement et liens de partage ?ref=
  const send = (events) => {
    if (!/(^|\.)blackjack-play\.app$|pages\.dev$/.test(location.hostname)) return;
    try { if (navigator.webdriver || localStorage.getItem('bp.notrack') === '1') return; } catch { /* ignoré */ }
    if (window.bpSend) return window.bpSend(events);
    const body = JSON.stringify({ src: 'web', events });
    try { navigator.sendBeacon('/api/e', new Blob([body], { type: 'text/plain' })); } catch { /* ignoré */ }
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-dl]');
    if (!a) return;
    send([{ e: 'dl', p: a.dataset.dl }]);
    // Page « Merci » : le téléchargement démarre et les étapes d'installation s'affichent
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      location.href = TXT.thanks + '?f=' + encodeURIComponent(a.dataset.dl);
    }
  });
  const qs = new URLSearchParams(location.search);
  const ref = qs.get('ref') || qs.get('utm_source');
  if (ref) {
    const clean = ref.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    let seen = false;
    try { seen = sessionStorage.getItem('bp.ref') === clean; sessionStorage.setItem('bp.ref', clean); } catch { /* ignoré */ }
    if (clean && !seen) send([{ e: 'ref', p: clean }]);
    history.replaceState(null, '', location.pathname + location.hash);
  }

  // Hors ligne (PWA)
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();

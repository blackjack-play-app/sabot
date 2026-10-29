// Mesure d'audience : Cloudflare Web Analytics (sans cookies) + compteur maison (visiteurs uniques, présence en direct).
// Non chargée sur les appareils du créateur (?notrack=1 ou tableau de bord ouvert) ni pour les navigateurs pilotés par un robot.
(() => {
  try {
    const nt = new URLSearchParams(location.search).get('notrack');
    if (nt === '1') localStorage.setItem('bp.notrack', '1');
    if (nt === '0') localStorage.removeItem('bp.notrack');
    if (localStorage.getItem('bp.notrack') === '1') return;
  } catch { /* stockage indisponible : on mesure quand même */ }
  if (navigator.webdriver || !/(^|\.)blackjack-play\.app$/.test(location.hostname)) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', '{"token":"4cfd96d579a146f698ed615169ad17b1"}');
  document.head.append(s);
  // Site d'où vient le visiteur (seulement le nom de domaine, et seulement s'il est extérieur)
  let r = '';
  try { const h = new URL(document.referrer).hostname; if (!/blackjack-play\.app$/.test(h)) r = h; } catch { /* arrivée directe */ }
  const send = (events) => {
    try { navigator.sendBeacon('/api/e', new Blob([JSON.stringify({ src: 'web', r, events })], { type: 'text/plain' })); } catch { /* ignoré */ }
  };
  window.bpSend = send;
  const p = location.pathname.toLowerCase().slice(0, 60);
  send([{ e: 'view', p }]);
  // « Toujours là » chaque minute tant que la page est visible (30 min max) ; la page du jeu envoie le sien
  if (p.startsWith('/game')) return;
  let n = 0;
  const t = setInterval(() => {
    if (document.hidden) return;
    if (++n > 30) { clearInterval(t); return; }
    send([{ e: 'ping', p }]);
  }, 60000);
})();

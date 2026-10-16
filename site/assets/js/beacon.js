// Mesure d'audience Cloudflare Web Analytics (sans cookies).
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
  // Page vue pour la carte et le direct du tableau de bord (ville approximative côté serveur, rien d'autre)
  try {
    const body = JSON.stringify({ src: 'web', events: [{ e: 'view', p: location.pathname.toLowerCase().slice(0, 60) }] });
    navigator.sendBeacon('/api/e', new Blob([body], { type: 'text/plain' }));
  } catch { /* ignoré */ }
})();

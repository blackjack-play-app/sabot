// Sabot — scripts communs du site : menu, galerie, détection du système, sommaire.
(function () {
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
    tag.textContent = 'Ton système';
    card.prepend(tag);
  }
  const osBtn = document.querySelector('[data-os-btn]');
  if (osBtn) {
    const label = osBtn.querySelector('[data-os-label]');
    if (OS_NAME[os]) { label.textContent = 'Télécharger pour ' + OS_NAME[os]; osBtn.href = '/telecharger#' + os; }
    else if (os === 'mobile') { label.textContent = 'Ajouter à l\'écran d\'accueil'; osBtn.href = '/telecharger'; }
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

  // Hors ligne (PWA)
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();

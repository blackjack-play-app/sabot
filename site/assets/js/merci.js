// Page « Merci » : lance le téléchargement choisi et affiche les étapes d'installation.
(async () => {
  const key = new URLSearchParams(location.search).get('f') || 'win';
  const os = /^win/.test(key) ? 'windows' : /^mac/.test(key) ? 'mac' : 'linux';
  const NAMES = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
  const EN = document.documentElement.lang === 'en';
  let file = null, url = document.documentElement.lang === 'en' ? '/en/download' : '/telecharger';
  try {
    const cfg = await (await fetch('/assets/downloads.json')).json();
    file = cfg.files[key] || cfg.files.win;
    url = cfg.base + file.file;
  } catch { /* hors ligne */ }
  document.getElementById('dl-kicker').textContent = 'Blackjack Play ' + (EN ? 'for ' : 'pour ') + NAMES[os];
  document.getElementById('dl-file').textContent = file ? `${EN ? file.labelEn : file.label} · ${file.file} · ${EN ? file.sizeEn : file.size}` : (EN ? 'File not available right now.' : 'Fichier indisponible pour le moment.');
  const tpl = document.getElementById('tpl-' + os);
  if (tpl) document.getElementById('steps').append(tpl.content.cloneNode(true));
  const start = () => { if (file) location.href = url; };
  document.getElementById('dl-retry').addEventListener('click', (e) => { e.preventDefault(); start(); });
  setTimeout(start, 700);
})();

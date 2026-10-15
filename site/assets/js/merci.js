// Page « Merci » : lance le téléchargement choisi et affiche les étapes d'installation.
(async () => {
  const key = new URLSearchParams(location.search).get('f') || 'win';
  const os = /^win/.test(key) ? 'windows' : /^mac/.test(key) ? 'mac' : 'linux';
  const NAMES = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
  let file = null, url = '/telecharger';
  try {
    const cfg = await (await fetch('/assets/downloads.json')).json();
    file = cfg.files[key] || cfg.files.win;
    url = cfg.base + file.file;
  } catch { /* hors ligne */ }
  document.getElementById('dl-kicker').textContent = 'Blackjack Play pour ' + NAMES[os];
  document.getElementById('dl-file').textContent = file ? `${file.label} · ${file.file} · ${file.size}` : 'Fichier indisponible pour le moment.';
  const tpl = document.getElementById('tpl-' + os);
  if (tpl) document.getElementById('steps').append(tpl.content.cloneNode(true));
  const start = () => { if (file) location.href = url; };
  document.getElementById('dl-retry').addEventListener('click', (e) => { e.preventDefault(); start(); });
  setTimeout(start, 700);
})();

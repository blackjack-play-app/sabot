# Génère « Blackjack Play - Mon guide.html » sur le Bureau (contient le lien privé du tableau de bord).
import html, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
env = dict(l.split('=', 1) for l in (root / '.env.local').read_text(encoding='utf8').splitlines() if '=' in l and not l.startswith('#'))
dash = f"https://blackjack-play.app/tableau/#cle={env['DASH_KEY']}"
envpath = r'C:\Users\Administrateur\Sabot\.env.local'
projpath = r'C:\Users\Administrateur\Sabot'

refs = [('WhatsApp', 'whatsapp'), ('Snapchat', 'snap'), ('Instagram', 'insta'), ('TikTok', 'tiktok'), ('Discord', 'discord')]
ref_rows = ''.join(f'<tr><th>{n}</th><td><code>https://blackjack-play.app/?ref={k}</code></td></tr>' for n, k in refs)

page = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blackjack Play — Mon guide</title>
<style>
body{{margin:0;background:#0d0b09;color:#efe6d2;font:16px/1.6 'Segoe UI',system-ui,sans-serif}}
.w{{max-width:860px;margin:0 auto;padding:40px 22px 80px}}
h1{{font-family:Georgia,serif;font-size:40px;margin:0 0 6px}} h2{{font-family:Georgia,serif;font-size:26px;margin:40px 0 10px;color:#e5c677}}
p,li{{color:#cfc4ad}} a{{color:#e5c677}} code{{background:#1d1813;padding:2px 6px;border-radius:5px;color:#efe6d2}}
.card{{background:#15110d;border:1px solid #3a3024;border-radius:12px;padding:16px 18px;margin:12px 0}}
.warn{{border-left:4px solid #c4453a}} .ok{{border-left:4px solid #55b57f}}
table{{width:100%;border-collapse:collapse}} td,th{{text-align:left;padding:8px;border-bottom:1px solid #2a231c;vertical-align:top}} th{{color:#887c6c;font-weight:500;width:180px}}
.k{{font-family:Consolas,monospace;word-break:break-all}}
</style></head><body><div class="w">
<h1>Blackjack Play</h1><p>Ton guide personnel. Garde-le pour toi : il contient ton lien privé.</p>

<h2>Tes liens</h2>
<div class="card"><table>
<tr><th>Site</th><td><a href="https://blackjack-play.app">https://blackjack-play.app</a></td></tr>
<tr><th>Jouer en ligne</th><td><a href="https://blackjack-play.app/game/">https://blackjack-play.app/game/</a></td></tr>
<tr><th>Téléchargements</th><td><a href="https://blackjack-play.app/telecharger">https://blackjack-play.app/telecharger</a></td></tr>
<tr><th>Code et versions</th><td><a href="https://github.com/blackjack-play-app/sabot/releases">github.com/blackjack-play-app/sabot</a></td></tr>
</table></div>

<h2>Ton tableau de bord privé</h2>
<div class="card warn"><p><b>Lien secret — ne le partage avec personne :</b></p><p class="k"><a href="{dash}">{html.escape(dash)}</a></p>
<p>Ouvre-le une fois sur ton téléphone et une fois sur ton PC : la clé reste ensuite mémorisée sur l'appareil, et tu pourras aller directement sur <code>blackjack-play.app/tableau</code>. Cette page n'est ni dans le menu, ni sur Google.</p></div>
<p>Tu y trouves : les visiteurs par jour, d'où ils viennent (Google, Bing, lien partagé…), leur pays, s'ils sont sur téléphone ou ordinateur, les pages vues, les parties lancées, les donnes jouées, les exercices, les clics et les téléchargements par système.</p>
<p>Vue officielle de Cloudflare : <a href="https://dash.cloudflare.com">dash.cloudflare.com</a> → <b>Analytics &amp; Logs → Web Analytics</b> → blackjack-play.app.</p>

<h2>Savoir si les visiteurs viennent de tes amis</h2>
<p>Partage ces liens « suivis » : chacun est compté à part dans le tableau de bord (rubrique <i>Liens de partage suivis</i>).</p>
<div class="card"><table>{ref_rows}</table></div>
<p>Tu peux en créer d'autres depuis le tableau de bord, par exemple <code>?ref=lucas</code> pour un ami précis.</p>

<h2>Le référencement Google</h2>
<div class="card ok"><p><b>Déjà fait :</b> 11 pages optimisées (jeu gratuit, règles, stratégie de base, compter les cartes, simulateur…), titres et descriptions travaillés, données structurées (jeu, FAQ, articles), plan du site <code>sitemap.xml</code>, site rapide et adapté au mobile, signalement automatique à Bing, Yahoo, DuckDuckGo, Yandex et Ecosia (IndexNow).</p></div>
<p><b>À faire une seule fois, par toi (5 minutes) : Google Search Console</b></p>
<ol>
<li>Va sur <a href="https://search.google.com/search-console">search.google.com/search-console</a> avec ton compte Google.</li>
<li>Choisis <b>Domaine</b> et tape <code>blackjack-play.app</code>.</li>
<li>Google affiche un code qui commence par <code>google-site-verification=…</code> : <b>copie-le et envoie-le moi</b>. Je l'ajoute dans les DNS et je valide.</li>
<li>J'envoie ensuite le plan du site à Google. Tu verras dans Search Console les mots tapés sur Google pour arriver chez toi.</li>
</ol>
<p>Sois patient : Google met en général quelques jours à quelques semaines pour afficher un nouveau site, puis plusieurs mois pour bien le classer. Ce qui accélère le plus, ce sont les liens vers ton site : Reddit, forums de blackjack, Discord, vidéos YouTube ou TikTok du jeu.</p>

<h2>Sécurité</h2>
<div class="card warn"><p>Tes clés GitHub et Cloudflare sont rangées uniquement dans <code>{envpath}</code>, qui n'est jamais publié. Comme elles ont été collées dans la conversation, il est conseillé de les <b>régénérer</b> un jour (GitHub → Settings → Developer settings ; Cloudflare → Account API tokens) et de me donner les nouvelles. Ne partage jamais ce fichier.</p></div>

<h2>Prochaines étapes possibles</h2>
<table>
<tr><th>Google Play (Android)</th><td>Compte développeur à environ 25 $, payé une fois. Je transforme le site en application.</td></tr>
<tr><th>Steam</th><td>Environ 100 $ par jeu (remboursés après environ 1 000 $ de ventes). La version Windows est prête.</td></tr>
<tr><th>Apple App Store</th><td>Environ 99 $ par an.</td></tr>
<tr><th>Signature Windows</th><td>Supprime l'avertissement « Windows a protégé votre ordinateur ». Il faut un certificat de signature : environ 10 $ par mois via Microsoft Azure, plus cher ailleurs.</td></tr>
<tr><th>Version anglaise</th><td>Elle élargit fortement le public (recherches « blackjack trainer », « free blackjack game »).</td></tr>
</table>
<p style="margin-top:30px;color:#887c6c">Pour toute modification, demande-la simplement dans Claude Code. Le projet est dans <code>{projpath}</code>.</p>
</div></body></html>"""

out = pathlib.Path(r'C:\Users\Administrateur\Desktop\Blackjack Play - Mon guide.html')
out.write_text(page, encoding='utf8')
print('ok', out)

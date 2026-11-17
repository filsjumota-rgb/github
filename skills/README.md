# 3 skills Claude à installer en premier – Jumota Agency (9:16)

Film en code : `film.js` dessine chaque image à partir du temps (`window.seek(t)`), calé mot par mot sur `timeline.json`.

Refaire la vidéo depuis la racine du dépôt (`<skill>` = dossier du skill motion-reel) :

```
python3 skills/tools/timeline.py                                  # minutage (voix off si les 7 prises sont dans audio/vo/)
node <skill>/scripts/render.mjs --film skills --format 9x16 --video-only
node <skill>/scripts/render.mjs --film skills --format 9x16 --hits
node <skill>/scripts/sfx.mjs skills && node <skill>/scripts/mix.mjs skills
```

Texte et mots-clés : `tools/script.json` (mots-clés entre `*astérisques*`). Découpage : `docs/shotlist.md`.
Sous-titres : `docs/sous-titres.srt`.

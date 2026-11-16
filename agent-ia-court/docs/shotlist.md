# « C'est quoi un agent IA ? » – versions avec voix off

Voix off : Sébastien (ElevenLabs, eleven_v4), voix masculine française. Prises dans `audio/vo/` (L = version longue, S = Short).
Un seul film (`agent-ia-90/film.js`) pour deux montages :

| Montage | Dossier | Durée | Voix |
|---------|---------|-------|------|
| 1 min 30 | `agent-ia-90/` | 90 s | L01–L12 |
| Short | `agent-ia-court/` | 55,5 s | S01–S11 + L08, L12 |

`tools/timeline.py long|short` monte la voix (`audio/vo.wav`), écrit `timeline.json` (début de chaque scène,
minutage de chaque mot) et les sous-titres `docs/sous-titres.srt`. Chaque animation part sur le mot prononcé ;
chaque coupe tombe sur un temps de la musique (120 BPM).

Ajouts de la version 1 min 30 par rapport au Short :
- accroche : bulles « tout le monde en parle », pastille « 90 SECONDES » avec chrono ;
- robot : il marche puis dit « Bonjour, humain. » avant d'être rayé ;
- tout seul : comparaison ChatGPT (« Tu demandes, il répond. ») / Agent IA (« Il agit, même sans toi. ») ;
- mission : étiquettes « claire » (cochée) / « floue » (barrée) ;
- horaire : « Ou à chaque nouveau mail » + badge mail sur l'horloge ;
- outils : l'agent apparaît sur « ses mains », les liens se coupent sur « sans outils » ;
- règle d'or : « Relis toujours avant d'envoyer. » ;
- abonnement : « pas à pas ».

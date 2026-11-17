# 3 skills Claude à installer en premier – Jumota Agency : découpage
1 min 34 · 9:16 1080×1920 (Reels / Shorts / TikTok) · 60 i/s · sans musique de fond : effets sonores seuls, calés sur une grille de 120 BPM (1 temps = 0,5 s)
Style repris de la vidéo de référence (genre, mise en page, rythme), avec l'identité Jumota : bleu nuit, bleu électrique,
cyan, halo violet, orange pour les alertes ; Montserrat (titres), Inter (texte), JetBrains Mono (console).
Minutage de chaque mot : `timeline.json`, généré par `tools/timeline.py` à partir de `tools/script.json`.

Cadre fixe sur toute la vidéo :
- **Haut** : compteur de chapitre « 03 / 07 · SKILL 1 », barre de progression en 7 segments, logo J.
- **Sous-titres** : le morceau de phrase en cours, mot par mot ; mots-clés en blanc gras, soulignés en dégradé, une étincelle.
- **Scène** : l'illustration du chapitre.
- **Console Jumota** : lignes de log tapées en direct, calées sur la voix (`✓`, `!`, `>`).
- Bas de l'écran laissé libre pour l'interface des plateformes.

| # | Temps | Chapitre | À l'écran | Sons |
|---|-------|----------|-----------|------|
| 1 | 0:00–0:08,5 | L'accroche | Zoom avant, « 3 » géant en dégradé néon, SKILLS / CLAUDE / À INSTALLER, cadre orange EN PREMIER, « GUIDE DÉBUTANT · GRATUIT » ; jauge « POTENTIEL UTILISÉ » bloquée à 20 % | impact, choc, boing |
| 2 | 0:08,5–0:21 | C'est quoi une skill | Dossier `humanizer/SKILL.md` qui se branche sur un bloc « Claude » ; pastille UNE TÂCHE PRÉCISE ; 3 résultats identiques cochés ; carte « 3 SKILLS À INSTALLER EN PREMIER » qui se remplit, jauge BASIQUE → UTILE | choc, pops, cloche |
| 3 | 0:21–0:36 | Skill 1 – Humanizer | Badge 1/3, titre HUMANIZER ; brouillon IA avec tics surlignés, « TON : ROBOT 92 % », barré ; version humanisée tapée, « TON : NATUREL », « ÉCRIT PAR TOI » ; pastilles POSTS · E-MAILS · LÉGENDES | choc, balayage, frappe, cloche |
| 4 | 0:36–0:52,5 | Skill 2 – Skills documents | « AVANT : DU TEXTE » barré ; fichiers DOCX, PDF, PPTX, XLSX qui tombent un par un ; bouton PRÊTS À TÉLÉCHARGER | pops montants, pièces |
| 5 | 0:52,5–1:06,5 | Skill 3 – Skill Creator | Même tâche « Notes → récap client » ×1 ×2 ×3 ; « Décris la tâche une fois » tapé ; dossier `recap-hebdo/SKILL.md` + bouton « Récap hebdo » cliqué 3 fois, RÉUTILISABLE À VOLONTÉ | toc ×3, frappe, clics |
| 6 | 1:06,5–1:21,5 | Activation | Claude.ai : Paramètres › Capacités › Skills + interrupteur ; Claude Code : `~/.claude/skills/humanizer/` ; bouclier RÈGLE D'OR + 3 coches (sources fiables, lis le SKILL.md, puis active) | tic, frappe, impact, cloches |
| 7 | 1:21,5–1:34,5 | Le guide | Couverture du PDF gratuit + tampon GRATUIT ; « Écris GUIDE en commentaire et je t'envoie le PDF complet » : commentaire « GUIDE » tapé, PDF ENVOYÉ ; carte de fin : logo Jumota Agency, bouton ABONNE-TOI cliqué | choc, frappe, cloche, impact |

Transitions : glissé horizontal entre chapitres, la scène suivante entre déjà composée (jamais d'image vide sur la coupe).

## Voix off
La voix prévue est ElevenLabs « Antinéa » (eleven_v4), comme pour la vidéo Facebook. Une seule prise a pu être générée
(`audio/vo/s01.mp3`) : le compte n'avait plus assez de crédits. La version livrée est donc **sans voix**, minutée sur un rythme
de lecture (sous-titres lisibles). Pour ajouter la voix :
1. Générer les 6 prises restantes avec les textes de `tools/script.json` → `audio/vo/s02.mp3` … `s07.mp3`
   (texte lu tel quel, sauf « Claude.ai » écrit « Claude point A I » pour la prononciation).
2. `python3 skills/tools/timeline.py` : tout se recale automatiquement sur la voix (scènes, mots, console, sons) et `audio/vo.wav` est créé.
3. Rendu + sons + mixage, comme décrit dans le README du dossier.

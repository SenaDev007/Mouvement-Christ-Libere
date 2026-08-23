# -*- coding: utf-8 -*-
"""
Sections du cahier des charges — Méga-plateforme du Royaume Yeshoua
Contenu détaillé de toutes les parties (I à XI + Conclusion).
"""

from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import Spacer, PageBreak, HRFlowable, KeepTogether

def add_all_sections(story, g):
    """Ajoute toutes les sections au story."""
    P = g['P']; H1 = g['H1']; H2 = g['H2']; H3 = g['H3']
    Bullet = g['Bullet']; Divider = g['Divider']
    CalloutBox = g['CalloutBox']; make_table = g['make_table']
    S_BODY = g['S_BODY']; S_BODY_NOINDENT = g['S_BODY_NOINDENT']
    S_LEAD = g['S_LEAD']; S_QUOTE = g['S_QUOTE']
    Spacer = g['Spacer']; PageBreak = g['PageBreak']
    HRFlowable = g['HRFlowable']; KeepTogether = g['KeepTogether']
    DIVIDER = g['DIVIDER']
    ACCENT_GOLD = g['ACCENT_GOLD']
    ParagraphStyle = g['ParagraphStyle']
    Paragraph = g['Paragraph']

    # =====================================================================
    # PARTIE I — VISION & FONDATIONS SPIRITUELLES
    # =====================================================================
    story.extend(H1('Vision & Fondations spirituelles', 'PARTIE I'))
    story.append(P(
        'Avant de décrire des fonctionnalités, il faut poser le socle spirituel qui légitime '
        'l\'existence même de cette plateforme. Sans ce socle, le projet ne serait qu\'une '
        'énième application web. Avec lui, il devient une infrastructure de Royaume, '
        'c\'est-à-dire un outil au service d\'une mission prophétique précise : rassembler, '
        'instruire, préserver, et préparer.', S_LEAD))

    story.append(H2('1. Contexte et mission'))
    story.append(P(
        'La servante Afrika Alkebulane Pamela Dali, communément désignée par son prénom PAM, '
        'est présentée par ses proches comme une figure contemporaine du patriarche Hénoch. '
        'Elle aurait vécu, et continuerait de vivre au quotidien, des expériences spirituelles '
        'inédites : enlèvements au ciel, visites célestes, instructions directes du Seigneur '
        'Yeshoua. L\'ensemble de ces expériences est, selon ses témoignages, strictement '
        'conforme à la Parole de Dieu. Son époux, le Pasteur Kongo, partage lui aussi de '
        'nombreuses expériences spirituelles et exerce un ministère pastoral complémentaire. '
        'Le couple forme ainsi une double autorité spirituelle qu\'il s\'agit de servir '
        'numériquement.'))
    story.append(P(
        'Le contexte actuel est marqué par une tension croissante entre les contenus '
        'spirituels et les grandes plateformes grand public. YouTube, Facebook, TikTok '
        'appliquent des politiques de modération de plus en plus agressives, incluant le '
        'shadowban, la démonétisation, la suppression arbitraire et la fermeture de comptes. '
        'Les groupes WhatsApp, largement utilisés par PAM pour coordonner des cercles restreints '
        'de pasteurs, atteignent leurs limites : pas d\'archive persistante, pas de hiérarchie '
        'fine de rôles, pas de chiffrement de bout en bout sur les groupes, dépendance totale '
        'à un acteur tiers. La mission du projet est donc triple : centraliser, sécuriser, '
        'et rayonner.'))
    story.append(P(
        'Centraliser, en réunissant sur un seul espace toutes les expressions du ministère '
        '(biographie, témoignages, vidéos, enseignements, canaux de discussion, appels). '
        'Sécuriser, par un hébergement souverain, un chiffrement de bout en bout, et une '
        'architecture résiliente capable de survivre à des vagues de censure coordonnée. '
        'Rayonner, en multipliant les canaux de diffusion automatique vers les plateformes '
        'grand public, tout en gardant le site comme source de vérité et comme refuge '
        'durable — à l\'image de ce qu\'Odysee a su construire face à YouTube.'))

    story.append(H2('2. Vision spirituelle — Hénoch, le chofar, le rassemblement'))
    story.append(P(
        'La figure d\'Hénoch est centrale dans la compréhension du ministère de PAM. '
        'Genèse 5:24 déclare : « Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu '
        'le prit. » Hébreux 11:5 ajoute qu\'« Hénoch fut enlevé afin d\'échapper à la mort, '
        'et il ne fut plus retrouvé, parce que Dieu l\'avait enlevé ; car avant son enlèvement '
        'il avait reçu le témoignage qu\'il était agréable à Dieu. » Le livre d\'Hénoch '
        '(Jude 14-15) précise qu\'il prophétisa. Le ministère contemporain de PAM, tel que '
        'rapporté, s\'inscrit dans cette lignée : marche intime avec Dieu, enlèvements '
        'récurrents, instructions reçues et transmises, témoignage rendu.'))
    story.append(P(
        'Cette vision n\'est pas anecdotique. Elle porte une responsabilité eschatologique. '
        'La plateforme doit être pensée comme un instrument de rassemblement des fils '
        'd\'Israël dispersés — ces Israélites éparpillés parmi les nations, dont la '
        'réunification est un signe des temps prophétique (Ésaïe 11:12, Ézéchiel 37). '
        'Elle prépare activement le retour du Maître Yeshoua, dont l\'avènement sera annoncé '
        'par le son du chofar (1 Thessaloniciens 4:16, 1 Corinthiens 15:52). La plateforme '
        'n\'est donc pas un outil marketing : elle est un outil de préparation épousiale et '
        'gouvernementale pour le Royaume à venir.'))
    story.append(CalloutBox(
        'Principe cardinal n°1',
        'Toute décision technique, toute fonctionnalité, tout design doit pouvoir être évalué '
        'à l\'aune d\'une seule question : « Cela sert-il le rassemblement des saints et la '
        'préparation du retour de Yeshoua ? » Si la réponse est non, la fonctionnalité est '
        'rejetée, même si elle est techniquement séduisante.'))

    story.append(H2('3. Objectifs stratégiques'))
    story.append(P(
        'Les objectifs stratégiques du projet se déclinent en sept axes complémentaires, '
        'chacun portant une dimension spécifique de la vision. Ces axes guideront toutes '
        'les décisions de conception et de priorisation tout au long du projet.'))
    story.append(Bullet(
        '<b>Centralisation</b> — Réunir sur un domaine unique la biographie, les témoignages, '
        'les vidéos, les enseignements, les canaux sociaux et les appels des deux serviteurs.'))
    story.append(Bullet(
        '<b>Automatisation</b> — Permettre qu\'un live lancé depuis le site soit simultanément '
        'diffusé sur YouTube, Facebook, TikTok et Odysee, sans manipulation manuelle.'))
    story.append(Bullet(
        '<b>Souveraineté numérique</b> — Héberger sur une infrastructure indépendante des GAFAM, '
        'dans des juridictions résistantes à la censure occidentale, avec sauvegardes '
        'géo-distribuées.'))
    story.append(Bullet(
        '<b>Résilience anti-censure</b> — Garantir que les contenus restent accessibles même '
        'en cas de shadowban, de suppression par les plateformes tierces, ou d\'attaque '
        'coordonnée contre le site.'))
    story.append(Bullet(
        '<b>Communauté sécurisée</b> — Offrir un média social intégré inspiré de Discord et '
        'Telegram, avec chiffrement de bout en bout, hiérarchie de rôles, et capacité illimitée '
        'de création de canaux et de groupes.'))
    story.append(Bullet(
        '<b>Sainteté et conformité biblique</b> — Soumettre chaque fonctionnalité au test de la '
        'Parole, éviter toute dimension ésotérique ou occulte, maintenir la transparence et '
        'la vérité.'))
    story.append(Bullet(
        '<b>Excellence technique</b> — Bâtir une plateforme d\'une qualité d\'expérience '
        'comparable aux meilleurs produits du marché (YouTube, Telegram, Discord), car la '
        'Parole mérite une offrande de qualité, non du reste.'))

    story.append(H2('4. Publics cibles'))
    story.append(P(
        'La plateforme s\'adresse à plusieurs publics distincts, dont les besoins et les '
        'niveaux d\'engagement diffèrent. La conception doit prendre en compte cette '
        'diversité dès la phase de réflexion UX, afin que chaque profil trouve un parcours '
        'clair et adapté. Une hiérarchie implicite de maturité spirituelle et de '
        'responsabilité guide la définition des espaces accessibles à chacun.'))
    story.append(make_table(
        ['Profil', 'Description', 'Besoins prioritaires'],
        [
            ['Disciple engagé', 'Croyant actif, follower régulier des enseignements de PAM',
             'Accès aux enseignements, alertes lives, participation aux canaux'],
            ['Pasteur affilié', 'Ministre en relation avec PAM, membre de cercles restreints',
             'Canaux privés pasteurs, appels, ressources liturgiques'],
            ['Nouveau croyant Yeshoua', 'Personne récemment convertie ou en recherche',
             'Parcours d\'accueil, biographies, enseignements fondamentaux'],
            ['Chercheur spirituel', 'Visiteur non engagé, curieux des expériences de PAM',
             'Témoignages publics, vidéos accessibles sans inscription'],
            ['Fils d\'Israël dispersé', 'Croyant des nations en quête de son identité israélite',
             'Carte des dispersés, contenu en plusieurs langues, communauté'],
            ['Modérateur / Animateur', 'Bénévole ou ministre délégué par PAM',
             'Outils de modération, signalements, statistiques communautaires'],
        ],
        col_widths=[3.8*cm, 6*cm, 6.2*cm]))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE II — IDENTITÉ & POSITIONNEMENT
    # =====================================================================
    story.extend(H1('Identité & Positionnement', 'PARTIE II'))
    story.append(P(
        'L\'identité de la plateforme repose sur une intuition structurelle forte : il ne '
        's\'agit pas d\'un site personnel unique, mais d\'un écosystème en miroir abritant '
        'deux serviteurs distincts, unis par le mariage et la mission, mais séparés dans '
        'leur expression publique. Cette dualité doit être lisible dès la page d\'accueil '
        'et préservée dans toutes les sections.', S_LEAD))

    story.append(H2('5. Positionnement — Deux serviteurs, une vision'))
    story.append(P(
        'PAM (Afrika Alkebulane Pamela Dali) et le Pasteur Kongo sont deux personnalités '
        'spirituelles à part entière. Chacun a son histoire, ses expériences, son style '
        'd\'enseignement, son audience. La plateforme ne doit ni fusionner leurs identités '
        'ni les séparer au point de créer deux sites parallèles. La solution retenue est '
        'celle d\'un écosystème unique avec un switcher d\'identité permanent en haut de '
        'page, à l\'image de ce que font certains médias groupant plusieurs marques '
        'éditoriales sous un même domaine.'))
    story.append(P(
        'Concrètement, lorsqu\'un internaute arrive sur le site, il voit par défaut la '
        'présentation de PAM (servante principale). Un sélecteur en haut — sous forme de '
        'deux portraits cliquables ou d\'un toggle élégant — permet de basculer vers '
        'l\'univers du Pasteur Kongo. Toute la navigation s\'adapte alors : biographie, '
        'vidéos, enseignements, canaux, agenda. L\'internaute peut à tout moment revenir '
        'à l\'autre serviteur. Cette mécanique est simple pour l\'utilisateur mais exige '
        'une discipline rigoureuse côté modèle de données : tout contenu appartient à un '
        'serviteur (PAM, Kongo, ou « Commun » pour les contenus conjoints comme les '
        'déclarations officielles du couple).'))

    story.append(H2('6. Architecture en miroir — Structure identique, contenus séparés'))
    story.append(P(
        'Les deux univers (PAM et Pasteur Kongo) partagent exactement la même structure '
        'de navigation et le même design. Cette symétrie est essentielle : elle garantit '
        'une équité de traitement entre les deux serviteurs et simplifie la maintenance '
        'technique. Les rubriques communes sont les suivantes.'))
    story.append(make_table(
        ['Rubrique', 'PAM', 'Pasteur Kongo'],
        [
            ['Biographie', 'Parcours de vie, conversion, appel', 'Parcours de vie, ministère pastoral'],
            ['Témoignages', 'Expériences spirituelles, enlèvements', 'Visions, paroles reçues'],
            ['Vidéos', 'Lives, enseignements vidéo, captures', 'Lives, prédications, partages'],
            ['Enseignements', 'Articles, études, PDF', 'Articles, prédications écrites'],
            ['Canaux sociaux', 'Canaux animés par PAM', 'Canaux animés par le Pasteur'],
            ['Appels / Contact', 'Demande d\'appel, messagerie', 'Demande d\'appel, messagerie'],
            ['Agenda', 'Lives prévus, rendez-vous spirituels', 'Lives prévus, rendez-vous pastoraux'],
        ],
        col_widths=[4*cm, 6*cm, 6*cm]))
    story.append(P(
        'Au-delà de ces rubriques, des espaces « Communs » existent : la page d\'accueil '
        'générale (qui présente le couple et la vision), les déclarations officielles '
        'conjointes, les enseignements bibliques partagés (par exemple sur les fêtes '
        'hébraïques), et le média social intégré qui, lui, est unique pour toute la '
        'communauté mais avec des canaux potentiellement rattachés à l\'un ou l\'autre '
        'serviteur.'))

    story.append(H2('7. Direction visuelle — Élégance sacrée'))
    story.append(P(
        'La direction visuelle proposée s\'éloigne volontairement des codes habituels des '
        'sites évangéliques grand public, souvent saturés d\'images, de couleurs vives et '
        'd\'effets tape-à-l\'œil. Le parti pris est inverse : élégance, sobriété, profondeur. '
        'L\'objectif est de faire ressentir à l\'internaute, dès la première seconde, qu\'il '
        'entre dans un espace différent — un espace qui honore la majesté de Dieu sans '
        'tomber dans la séduction sensorielle.'))
    story.append(P(
        'Trois concepts visuels sont proposés pour exploration en phase de design. Le '
        'choix définitif sera arrêté en concertation avec PAM et le Pasteur Kongo.'))
    story.append(Bullet(
        '<b>Concept A — Élégance sacrée</b> : Bleu nuit profond (#0B1F3A) + or sacré '
        '(#C9A227) + ivoire (#FAF7F0). Typographie serif (Cormorant Garamond pour titres, '
        'Inter pour le corps). Références hébraïques subtiles (menorah stylisée, chofar '
        'dessiné au trait, étoile de David discrète). Ambiance feutrée, contemplative.'))
    story.append(Bullet(
        '<b>Concept B — Prophétique sombre</b> : Noir profond + bordeaux + or ancien. '
        'Typographies contrastées (Playfair Display + Source Sans). Ambiance dramatique, '
        'solennelle. Convient à un ton prophétique engagé.'))
    story.append(Bullet(
        '<b>Concept C — Alkebulan moderne</b> : Tons terre (ocre, terracotta, ivoire) + '
        'indigo. Typographie moderne (Manrope + Source Serif). Clin d\'œil à l\'Afrique '
        'et à Israël, à l\'identité « Alkebulan » de PAM.'))
    story.append(P(
        'Quel que soit le concept retenu, plusieurs principes sont non négociables : '
        'lisibilité sur mobile (la majorité du trafic viendra de smartphones), accessibilité '
        'AA minimum, temps de chargement inférieur à 2 secondes, absence de pop-ups '
        'intrusifs, et cohérence chromatique stricte (pas plus de 3 couleurs dominantes).'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE III — FONCTIONNALITÉS PORTEUSES
    # =====================================================================
    story.extend(H1('Fonctionnalités porteuses', 'PARTIE III'))
    story.append(P(
        'Cette partie décrit les fonctionnalités directement issues du brief initial. '
        'Elles constituent le cœur fonctionnel du projet, autour duquel les innovations '
        '« waouh » (Partie VI) viendront s\'greffer.', S_LEAD))

    story.append(H2('8. Biographies & témoignages'))
    story.append(P(
        'La section biographie n\'est pas une simple page « à propos ». Elle est une '
        'chronologie vivante du parcours spirituel de chaque serviteur. Pour PAM, elle '
        'doit pouvoir présenter, dans l\'ordre chronologique, les étapes marquantes de '
        'sa vie : conversion, premier appel, premières visions, premiers enlèvements, '
        'messages reçus du Seigneur, évolutions du ministère. Chaque étape peut être '
        'enrichie d\'un récit textuel, de photos, de vidéos, et de références bibliques '
        'cliquables. Le lecteur peut naviguer librement dans la chronologie ou suivre '
        'un parcours guidé.'))
    story.append(P(
        'Les témoignages constituent une catégorie distincte. Il s\'agit des récits '
        'détaillés des expériences spirituelles vécues par PAM — enlèvements au ciel, '
        'visites célestes, dialogues avec le Seigneur Yeshoua, visions prophétiques. '
        'Chaque témoignage doit pouvoir être présenté dans un format long (article '
        'structuré avec sous-titres), avec une version courte résumée, et éventuellement '
        'une version vidéo ou audio. La conformité biblique de chaque témoignage doit '
        'être vérifiée et, lorsque pertinent, des renvois vers les versets concernés '
        'doivent être proposés. Cela suppose une fonctionnalité de « Bible interconnectée » '
        'décrite en Partie VI.'))
    story.append(P(
        'Les internautes authentifiés peuvent marquer des témoignages comme « lus », les '
        'ajouter à leurs favoris, et recevoir des notifications lorsque de nouveaux '
        'témoignages sont publiés. Une fonction de partage discret (sans traqueurs '
        'externes) permet de diffuser un témoignage vers une personne précise.'))

    story.append(H2('9. Plateforme vidéo — Interface de type YouTube'))
    story.append(P(
        'La plateforme vidéo intégrée au site doit offrir une expérience comparable à '
        'celle de YouTube, tant en lecture qu\'en gestion. L\'objectif est que PAM, le '
        'Pasteur Kongo, et toute personne autorisée, puissent uploader, programmer, et '
        'lancer des lives directement depuis le site, sans dépendre d\'une plateforme '
        'tierce. L\'interface de lecture doit être immédiatement familière à tout '
        'internaute habitué à YouTube.'))
    story.append(H3('Lecteur vidéo'))
    story.append(Bullet('Player HTML5 adaptatif avec qualité auto (ABR — Adaptive Bitrate Streaming).'))
    story.append(Bullet('Support HLS et DASH pour la compatibilité multi-appareils.'))
    story.append(Bullet('Chapitrage des vidéos longues, avec liste des chapitres cliquables.'))
    story.append(Bullet('Vitesses de lecture (0.75x, 1x, 1.25x, 1.5x, 2x) pour l\'étude.'))
    story.append(Bullet('Sous-titres multilingues (cf. Partie VI — sous-titrage IA).'))
    story.append(Bullet('Capture d\'un extrait avec timestamp partageable (ex. « À 12:34 »).'))
    story.append(Bullet('Mode « focus » masquant les recommandations latérales pour l\'étude.'))
    story.append(H3('Gestion des vidéos'))
    story.append(Bullet('Upload par glisser-déposer, avec barre de progression et reprise sur coupure.'))
    story.append(Bullet('Champs : titre, description, catégorie, tags, miniature (générée ou uploadée).'))
    story.append(Bullet('Programmation de publication (date et heure).'))
    story.append(Bullet('Visibilité : publique, réservée aux inscrits, réservée à un cercle, privée.'))
    story.append(Bullet('Statistiques de vues, durée moyenne de visionnage, origine géographique agrégée.'))
    story.append(Bullet('Système de modération préalable des commentaires (validation par un modérateur).'))

    story.append(H2('10. Streaming multiplateforme automatisé'))
    story.append(P(
        'C\'est l\'une des fonctionnalités les plus stratégiques du projet. PAM et le '
        'Pasteur Kongo diffusent actuellement leurs lives de manière dispersée : parfois '
        'sur YouTube, parfois sur Facebook, parfois sur TikTok, rarement simultanément. '
        'Cela entraîne une fragmentation de l\'audience, une lourdeur opérationnelle, et '
        'une vulnérabilité majeure : si une plateforme supprime le compte, une partie de '
        'l\'audience est perdue. Le projet vise à inverser cette logique.'))
    story.append(P(
        'Le principe : le site devient le point d\'origine unique du live. Lorsque PAM '
        'ouvre un live depuis le site, un signal vidéo unique est envoyé vers un serveur '
        'RTMP central (par exemple Ant Media Server ou Wowza Streaming Engine). Ce serveur '
        'se charge de retransmettre le flux simultanément vers :'))
    story.append(Bullet('Le site lui-même (lecteur intégré, qualité maximale).'))
    story.append(Bullet('YouTube (via RTMP, sur la chaîne officielle de PAM).'))
    story.append(Bullet('Facebook (via Live API, sur la page officielle).'))
    story.append(Bullet('TikTok (via Live Studio API ou RTMP, selon disponibilité).'))
    story.append(Bullet('Odysee et/ou Rumble (redondance anti-censure).'))
    story.append(P(
        'Cette architecture présente trois avantages majeurs. Premièrement, l\'effort de '
        'production est unique : un seul stream entrant, géré par le site. Deuxièmement, '
        'l\'audience grand public est servie par les plateformes qu\'elle fréquente, mais '
        'le site reste la source officielle et durable. Troisièmement, si l\'une des '
        'plateformes décide de couper le flux (shadowban en cours de live, signalement '
        'abusif, panne), le live continue sur le site et sur les autres plateformes. La '
        'redondance est structurelle, non accidentelle.'))
    story.append(CalloutBox(
        'Archivage automatique — Principe clé',
        'Dès la fin d\'un live, la vidéo est automatiquement archivée sur le site en haute '
        'qualité, sans dépendre de l\'archive YouTube ou Facebook. Une copie chiffrée est '
        'également poussée vers un stockage secondaire (ex. Arweave ou Backblaze B2) afin '
        'de garantir la pérennité même en cas de compromission du site. Cette archive est '
        'immuable : aucun module de modération tiers ne peut la supprimer.'))

    story.append(H2('11. Espace enseignements textuels'))
    story.append(P(
        'À côté des vidéos, la plateforme doit héberger des enseignements textuels longs. '
        'Ce format reste indispensable pour plusieurs raisons : il permet une étude '
        'approfondie (le texte se prête à la méditation lente), il est plus facile à '
        'traduire que la vidéo, il consomme peu de bande passante (utile pour les '
        'croyants situés dans des zones à faible connexion), et il est plus résistant à '
        'la censure (un texte peut être copié et diffusé discrètement).'))
    story.append(P(
        'Chaque enseignement est un article structuré avec titre, chapô, sous-titres, '
        'corps de texte, références bibliques cliquables (renvoyant vers la Bible '
        'interconnectée intégrée), et éventuellement des images, tableaux ou PDF '
        'téléchargeables en annexe. Les enseignements sont classés par serviteur, par '
        'thème, par livre biblique, et par niveau de profondeur (découverte, '
        'intermédiaire, avancé). Une fonction de recherche plein texte est essentielle.'))
    story.append(P(
        'Les enseignements peuvent être exportés en PDF pour impression ou lecture '
        'hors-ligne, et un flux RSS permet à ceux qui le souhaitent d\'être notifiés '
        'des nouveautés via un lecteur RSS — un canal de distribution particulièrement '
        'résistant à la censure. Enfin, une fonction « envoi par email » permet de '
        'transmettre un enseignement à un proche sans dépendre d\'un réseau social.'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE IV — MÉDIA SOCIAL INTÉGRÉ
    # =====================================================================
    story.extend(H1('Média social intégré — Discord + Telegram hybrid', 'PARTIE IV'))
    story.append(P(
        'Le média social intégré est probablement la fonctionnalité la plus complexe et '
        'la plus structurante du projet. Il ne s\'agit pas d\'ajouter un module de '
        'commentaires ou un forum classique, mais de bâtir un véritable réseau social '
        'interne, inspiré des fonctionnalités les plus avancées de Discord et de Telegram, '
        'avec un niveau de sécurité élevé et une hiérarchie de rôles adaptée à un '
        'ministère spirituel.', S_LEAD))

    story.append(H2('12. Conception hybride — Le meilleur de Discord et Telegram'))
    story.append(P(
        'Discord et Telegram sont les deux plateformes de communication communautaire '
        'les plus abouties à ce jour. Discord excelle dans l\'organisation multi-canaux '
        '(serveurs thématiques, voix en temps réel, intégrations bots, rôles riches). '
        'Telegram excelle dans la messagerie chiffrée, les canaux de diffusion à grande '
        'échelle, les groupes massifs, et la légèreté d\'usage. Le média social intégré '
        'doit emprunter aux deux : la richesse structurelle de Discord et la fluidité '
        'chiffrée de Telegram.'))
    story.append(P(
        'Concrètement, l\'espace social est organisé en « communautés » (équivalent des '
        'serveurs Discord), chacune contenant des « canaux » (texte, voix, vidéo, '
        'annonce). PAM et le Pasteur Kongo sont super-administrateurs de toutes les '
        'communautés. Ils peuvent créer autant de communautés et de canaux qu\'ils le '
        'souhaitent. Des modérateurs peuvent être nommés par communauté ou par canal. '
        'Les membres peuvent appartenir à plusieurs communautés selon leur niveau '
        'd\'engagement et les autorisations qui leur sont accordées.'))

    story.append(H2('13. Canaux, groupes, et modération'))
    story.append(P(
        'La création de canaux doit être libre pour les super-administrateurs et '
        'strictement encadrée pour les autres rôles. Un canal peut être de plusieurs '
        'types, chacun avec ses spécificités techniques et ses règles de modération.'))
    story.append(make_table(
        ['Type de canal', 'Cas d\'usage', 'Capacité', 'Modération'],
        [
            ['Canal annonce', 'Diffusion unidirectionnelle (PAM → communauté)',
             'Illimitée', 'Lecture seule pour les membres'],
            ['Canal texte', 'Discussion ouverte',
             'Jusqu\'à 5 000', 'Modération a priori ou a posteriori'],
            ['Canal voix', 'Échanges audio en temps réel',
             'Jusqu\'à 100 simultanés', 'Pas de texte persistant'],
            ['Canal vidéo', 'Visioconférence, études bibliques',
             'Jusqu\'à 50 simultanés', 'Enregistrement optionnel'],
            ['Groupe restreint', 'Cercle de pasteurs, équipe de service',
             'Sur invitation', 'Accès contrôlé, contenu chiffré E2E'],
            ['Fil de discussion', 'Réponses organisées à un message',
             'Illimitée', 'Hérité du canal parent'],
            ['Sondage', 'Consultation de la communauté',
             'Illimitée', 'Résultats agrégés anonymement'],
        ],
        col_widths=[3.5*cm, 5*cm, 3*cm, 4.5*cm]))
    story.append(P(
        'La modération doit être à la fois efficace et transparente. Chaque action de '
        'modération (suppression de message, bannissement, mise en sourdine) est '
        'consignée dans un journal d\'audit consultable par les super-administrateurs. '
        'Les membres peuvent contester une action via une procédure d\'appel dédiée. '
        'Cette transparence est essentielle pour maintenir la confiance de la communauté '
        'et éviter les dérives autoritaires qui pourraient éloigner les croyants.'))

    story.append(H2('14. Messagerie chiffrée de bout en bout (E2E)'))
    story.append(P(
        'La messagerie directe (DM) et les groupes restreints doivent bénéficier d\'un '
        'chiffrement de bout en bout (End-to-End Encryption, E2EE). Cela signifie que '
        'même les administrateurs du serveur et les hébergeurs ne peuvent pas lire le '
        'contenu des messages — seuls l\'expéditeur et le destinataire en ont la clé. '
        'Cette exigence n\'est pas optionnelle : elle est de l\'ordre de la protection '
        'des ministres, des pasteurs affiliés, et des croyants situés dans des contextes '
        'sensibles (pays hostiles au christianisme, zones de persécution).'))
    story.append(P(
        'L\'implémentation technique s\'inspire du Signal Protocol, qui fait référence '
        'dans le domaine. Les fonctionnalités attendues sont les suivantes.'))
    story.append(Bullet('<b>Messages texte</b> : chiffrés E2E, avec accusé de lecture optionnel.'))
    story.append(Bullet('<b>Messages audio</b> : enregistrement intégré, envoi chiffré, lecture en streaming.'))
    story.append(Bullet('<b>Messages vidéo courts</b> : jusqu\'à 5 minutes, compression et chiffrement.'))
    story.append(Bullet('<b>Images et fichiers</b> : jusqu\'à 100 Mo par fichier, chiffrement côté client.'))
    story.append(Bullet('<b>Disparition programmée</b> : messages éphémères (24h, 7j, 30j, ou lecture unique).'))
    story.append(Bullet('<b>Sauvegarde chiffrée</b> : export local protégé par une passphrase mémorisée par l\'utilisateur.'))
    story.append(Bullet('<b>Vérification de sécurité</b> : QR code ou code numérique pour valider l\'identité d\'un correspondant.'))
    story.append(P(
        'Une attention particulière doit être portée à la gestion des clés. Les clés E2E '
        'sont stockées côté client, jamais côté serveur en clair. En cas de perte d\'un '
        'appareil, l\'utilisateur peut révoquer ses sessions actives depuis un appareil '
        'de confiance. Cette mécanique est invisible pour l\'utilisateur non technique, '
        'mais essentielle pour la sécurité réelle du système.'))

    story.append(H2('15. Appels audio et vidéo — Style Telegram / WhatsApp'))
    story.append(P(
        'La plateforme doit supporter les appels audio et vidéo, tant en mode 1-à-1 qu\'en '
        'mode groupe. L\'expérience utilisateur doit être comparable à celle de Telegram '
        'ou WhatsApp : sonnerie, interface d\'appel épurée, possibilité de mettre en '
        'haut-parleur, de couper le micro, de basculer entre audio et vidéo. Lorsqu\'un '
        'membre tente d\'appeler PAM ou le Pasteur Kongo et que ceux-ci ne sont pas '
        'disponibles, l\'appel doit sonner normalement côté destinataire (en notification '
        'silencieuse ou sonore selon les préférences) et, en cas d\'absence de réponse, '
        'laisser une trace dans l\'historique d\'appels en absence.'))
    story.append(P(
        'L\'historique d\'appels en absence est consultable par le destinataire à son '
        'retour, avec le nom de l\'appelant, l\'heure, et la possibilité de rappeler en '
        'un clic. Pour les appels de groupe (études bibliques, réunions de pasteurs), la '
        'capacité maximale recommandée est de 50 participants simultanés en vidéo, '
        'extensible à 200 en mode audio seul. La technologie sous-jacente est WebRTC '
        'pour la plupart des cas, complétée par LiveKit ou Jitsi pour les sessions '
        'multiples avancées.'))
    story.append(CalloutBox(
        'Appels d\'urgence spirituelle',
        'Un mécanisme d\'« appel d\'urgence » doit être prévu pour les situations où un '
        'membre traverse une crise grave (persécution, menace immédiate, décès imminent '
        'd\'un proche). Cet appel, signalé comme urgent, peut contourner le mode « ne pas '
        'dérangeur » de PAM ou du Pasteur Kongo, à condition d\'être validé au préalable '
        'par un modérateur de confiance. Cette fonctionnalité sert l\'équivalent '
        'numérique du devoir pastoral de veille.'))

    story.append(H2('16. Rôles et permissions'))
    story.append(P(
        'La hiérarchie des rôles doit être à la fois simple à comprendre et fine dans son '
        'application. Elle s\'inspire des modèles de Discord et de Slack, adaptés aux '
        'réalités d\'un ministère spirituel. Les rôles suivants sont proposés, du plus '
        'élevé au plus bas.'))
    story.append(make_table(
        ['Rôle', 'Détenteur', 'Permissions clés'],
        [
            ['Super-administrateur', 'PAM, Pasteur Kongo',
             'Contrôle total, création de communautés, nomination des modérateurs'],
            ['Administrateur', 'Délégués de confiance',
             'Gestion des canaux, modération, configuration'],
            ['Modérateur', 'Bénévoes validés',
             'Suppression de messages, mise en sourdine, signalements'],
            ['Animateur', 'Membres actifs',
             'Animation de canaux spécifiques, lancement de sondages'],
            ['Membre vérifié', 'Croyant authentifié',
             'Participation aux canaux publics, messagerie E2E, appels'],
            ['Membre', 'Inscrit de base',
             'Lecture des canaux publics, commentaires modérés'],
            ['Invité', 'Visiteur non inscrit',
             'Lecture seule des contenus publics'],
        ],
        col_widths=[3.8*cm, 4*cm, 8.2*cm]))
    story.append(P(
        'Au-delà de cette hiérarchie générale, des rôles spécifiques peuvent être créés '
        'par communauté ou par canal : par exemple, un canal « Pasteurs affiliés » '
        'pourrait définir un rôle « Pasteur » avec des permissions spécifiques (accès à '
        'des ressources liturgiques réservées, possibilité de lancer des lives en '
        'coordination avec PAM). Cette flexibilité est essentielle pour reproduire dans '
        'le numérique la diversité des ministères charnels.'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE V — ARCHITECTURE TECHNIQUE
    # =====================================================================
    story.extend(H1('Architecture technique', 'PARTIE V'))
    story.append(P(
        'Cette partie traduit les exigences fonctionnelles en choix d\'architecture. '
        'L\'approche retenue privilégie la souveraineté, la résilience, et la capacité '
        'd\'évolution. Elle n\'exclut pas les technologies grand public lorsque celles-ci '
        'servent la vision, mais refuse la dépendance exclusive à un acteur unique.',
        S_LEAD))

    story.append(H2('17. Stack technologique recommandé'))
    story.append(P(
        'La stack proposée vise un équilibre entre maturité des technologies, facilité de '
        'recrutement, et alignement avec les contraintes du projet. Elle n\'est pas '
        'dogmatique : des alternatives existent pour chaque brique, et le choix définitif '
        'se fera en concertation avec l\'équipe technique retenue.'))
    story.append(make_table(
        ['Couche', 'Technologie', 'Rationale'],
        [
            ['Frontend web', 'Next.js 14+ (React 18)', 'SSR/ISR, SEO, écosystème mature, PWA possible'],
            ['Frontend mobile', 'React Native (Expo)', 'Code partagé avec le web, déploiement iOS+Android'],
            ['Backend API', 'Node.js (NestJS) ou Go (Gin)', 'Performance, typage fort, écosystème streaming'],
            ['Base de données', 'PostgreSQL 16', 'Relationnel robuste, JSONB, recherche plein texte'],
            ['Cache / files', 'Redis 7', 'Sessions, files de messages, temps réel'],
            ['Stockage objets', 'MinIO ou Backblaze B2', 'Compatible S3, hébergement souverain possible'],
            ['Streaming live', 'Ant Media Server (Community)', 'RTMP entrant, HLS/DASH sortant, ABR'],
            ['Temps réel (chat)', 'Matrix Synapse ou Centrifugo', 'Fédération possible, E2E natif (Matrix)'],
            ['Appels A/V', 'LiveKit (WebRTC SFU)', 'Open source, scalable, qualité reconnue'],
            ['Sous-titrage IA', 'Whisper (OpenAI, local)', 'Multilingue, offline possible, pas de fuite'],
            ['CDN', 'Cloudflare (cache) + serveur miroir', 'Redondance géographique'],
            ['Reverse proxy', 'Caddy ou Nginx', 'TLS automatique, HTTP/3'],
            ['Monitoring', 'Grafana + Prometheus + Loki', 'Stack open source, alerting'],
        ],
        col_widths=[3.5*cm, 5*cm, 7.5*cm]))
    story.append(P(
        'Le choix de Matrix Synapse comme infrastructure de messagerie mérite une '
        'explication. Matrix est un protocole ouvert, décentralisé, qui supporte '
        'nativement le chiffrement E2E (Olm/Megolm) et la fédération. En s\'appuyant '
        'sur Matrix, la plateforme bénéficie d\'une base sécurisée éprouvée, sans '
        'réinventer la cryptographie. Cela permet également, à terme, d\'ouvrir des '
        'ponts avec d\'autres serveurs Matrix de confiance (par exemple des communautés '
        'satellites), tout en gardant la maîtrise du serveur principal.'))

    story.append(H2('18. Hébergement souverain — Stratégie multi-juridictionnelle'))
    story.append(P(
        'La question de l\'hébergement est centrale dans un projet qui se veut résistant '
        'à la censure. Trois approches sont envisageables, et la recommandation est de '
        'les combiner plutôt que de choisir l\'une d\'entre elles.'))
    story.append(P(
        '<b>Option A — Serveurs souverains en juridiction neutre.</b> Louer des serveurs '
        'dédiés dans des pays ayant une législation protectrice pour la liberté '
        'd\'expression religieuse : Suisse, Panama, Islande, ou certains pays '
        'd\'Europe orientale. Cette option donne un contrôle direct sur la machine, '
        'sans dépendre des politiques de modération d\'un cloud provider. Coût '
        'modéré (50 à 300 €/mois par serveur selon capacité), mais demande une '
        'compétence système interne.'))
    story.append(P(
        '<b>Option B — Décentralisation partielle.</b> Répliquer les contenus critiques '
        '(témoignages, enseignements, archives vidéo) sur des stockages décentralisés '
        'comme IPFS ou Arweave. Ces stockages sont immuables, non censurables, et '
        'survivent même à une suppression du serveur principal. Le site web reste '
        'l\'interface lisible, mais le contenu est ancré sur une couche indestructible. '
        'Coût variable selon le volume.'))
    story.append(P(
        '<b>Option C — Cloud hybride.</b> Utiliser un cloud provider (OVH, Hetzner, '
        'Scaleway) pour la souplesse opérationnelle, en gardant des sauvegardes '
        'chorégraphiées vers les options A et B. Cette option est pragmatique pour '
        'le démarrage, mais expose au risque de voir le compte suspendu si le '
        'provider cède à une pression politique.'))
    story.append(CalloutBox(
        'Recommandation hybride',
        'Combinaison A + B : serveur souverain principal (Suisse ou Panama) pour '
        'l\'application, base de données, et streaming ; réplication automatique des '
        'contenus durables (vidéos, enseignements, témoignages) sur Arweave pour '
        'immutabilité ; sauvegardes chiffrées quotidiennes vers un second serveur '
        'souverain dans une juridiction différente. Le nom de domaine principal '
        '(.com ou .org) est doublé d\'un domaine de secours (.eth ou .onion) activable '
        'en cas de saisie.'))

    story.append(H2('19. Streaming et CDN — Architecture multi-destination'))
    story.append(P(
        'L\'architecture de streaming doit permettre, à partir d\'une source unique, de '
        'nourrir simultanément le site web et les plateformes externes (YouTube, '
        'Facebook, TikTok, Odysee). Le schéma est le suivant.'))
    story.append(Bullet(
        '<b>Source</b> : PAM ou le Pasteur Kongo ouvre un live depuis le site via '
        'OBS Studio, Streamlabs, ou un encodeur matériel. Le flux est envoyé en RTMP '
        'vers le serveur de streaming central.'))
    story.append(Bullet(
        '<b>Serveur central</b> : Ant Media Server reçoit le flux, le transcode en '
        'plusieurs qualités (1080p, 720p, 480p, 240p) pour l\'ABR, et le redistribue.'))
    story.append(Bullet(
        '<b>Branchement site</b> : le flux HLS est servi au lecteur intégré du site, '
        'via le CDN Cloudflare pour la mise en cache et la scalabilité.'))
    story.append(Bullet(
        '<b>Branchement plateformes</b> : un module « restreamer » (FFmpeg ou service '
        'spécialisé) envoie une copie du flux RTMP vers YouTube, Facebook, TikTok, '
        'Odysee simultanément.'))
    story.append(Bullet(
        '<b>Archivage</b> : le flux est enregistré en continu sur le stockage objet '
        '(MinIO ou B2), et une fois le live terminé, le fichier final est traité '
        '(génération des qualités replay, chapitrage, miniature) puis publié '
        'automatiquement sur le site.'))
    story.append(Bullet(
        '<b>Rédondance</b> : un second serveur de streaming, dans une autre '
        'juridiction, peut prendre le relais en cas de panne du serveur principal. '
        'Le basculement est automatique via DNS.'))

    story.append(H2('20. Sécurité et chiffrement — Défense en profondeur'))
    story.append(P(
        'La sécurité de la plateforme doit être pensée en couches successives, chacune '
        'compensant les failles potentielles des autres. Aucune mesure isolée n\'est '
        'suffisante ; c\'est la combinaison qui crée la robustesse.'))
    story.append(make_table(
        ['Couche', 'Mesure', 'Détail'],
        [
            ['Transport', 'TLS 1.3 obligatoire', 'Pas de TLS 1.2 ou inférieur, HSTS preload'],
            ['Transport', 'HTTP/3 (QUIC)', 'Performance et résistance aux coupures'],
            ['Authentification', '2FA obligatoire (admins)', 'TOTP, pas de SMS (interceptable)'],
            ['Authentification', 'Limitation tentatives', 'Verrouillage progressif, CAPTCHA douce'],
            ['Application', 'CSP stricte', 'Pas de scripts inline, sources whitelistées'],
            ['Application', 'Audit logs complets', 'Toutes actions sensibles tracées'],
            ['Données au repos', 'Chiffrement disque (LUKS)', 'Base, stockage objet, sauvegardes'],
            ['Données au repos', 'E2E pour messages sensibles', 'Signal Protocol (via Matrix)'],
            ['Sauvegardes', 'Chiffrement côté client', 'Impossibilité de lire par l\'hébergeur'],
            ['Sauvegardes', 'Géo-distribution', '3 copies dans 3 juridictions distinctes'],
            ['Réseau', 'Firewall applicatif (WAF)', 'ModSecurity ou Cloudflare WAF'],
            ['Réseau', 'Anti-DDoS', 'Cloudflare ou service spécialisé (OVH)'],
            ['Réseau', 'Rate limiting', 'Par IP, par utilisateur, par endpoint'],
        ],
        col_widths=[3*cm, 4.5*cm, 8.5*cm]))

    story.append(H2('21. Modèle de données — Vue simplifiée'))
    story.append(P(
        'Le modèle de données doit refléter la double identité du projet (deux serviteurs, '
        'une communauté) et la diversité des types de contenus. Voici les entités '
        'principales, présentées de manière simplifiée.'))
    story.append(Bullet('<b>Servant</b> : PAM ou Kongo. Attributs : biographie, photo, identité visuelle.'))
    story.append(Bullet('<b>User</b> : tout internaute inscrit. Attributs : profil, rôles, communautés.'))
    story.append(Bullet('<b>Video</b> : vidéo uploadée ou issue d\'un live. Lien vers un Servant.'))
    story.append(Bullet('<b>LiveStream</b> : session de streaming en cours ou programmée.'))
    story.append(Bullet('<b>Teaching</b> : enseignement textuel. Lien vers un Servant.'))
    story.append(Bullet('<b>Testimony</b> : témoignage spirituel. Lien vers un Servant.'))
    story.append(Bullet('<b>Community</b> : communauté du média social (équivalent serveur Discord).'))
    story.append(Bullet('<b>Channel</b> : canal d\'une communauté (texte, voix, vidéo, annonce).'))
    story.append(Bullet('<b>Message</b> : message d\'un canal ou DM. Chiffré E2E si applicable.'))
    story.append(Bullet('<b>Call</b> : appel audio/vidéo (réalisé ou manqué).'))
    story.append(Bullet('<b>Role</b> : rôle d\'un User dans une Community ou un Channel.'))
    story.append(Bullet('<b>VerseRef</b> : référence biblique liée à un contenu (Bible interconnectée).'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE VI — INNOVATIONS "WAAOUH"
    # =====================================================================
    story.extend(H1('Innovations « waouh »', 'PARTIE VI'))
    story.append(P(
        'Au-delà des fonctionnalités directement issues du brief, plusieurs innovations '
        'peuvent donner au projet une dimension véritablement inédite. Ces innovations ne '
        'sont pas des gadgets : chacune répond à un besoin spirituel ou stratégique '
        'identifié. Elles constituent ensemble ce qui distinguera la plateforme de toute '
        'autre offre existante.', S_LEAD))

    story.append(H2('22. Bible interconnectée'))
    story.append(P(
        'L\'idée est d\'intégrer au site une Bible complète, navigable, et connectée à '
        'tous les contenus. Lorsque PAM cite un verset dans un enseignement, un '
        'témoignage, ou une vidéo, ce verset devient cliquable : au survol, une infobulle '
        'affiche le texte dans la version choisie par l\'utilisateur (Louis Segond, '
        'Ostervald, Darby, Segond 21, TOB, ou textes originaux hébreu/grec pour les '
        'étudiants avancés). Au clic, l\'utilisateur bascule vers la Bible intégrée, '
        'positionnée au chapitre et au verset concernés, avec le contexte environnant.'))
    story.append(P(
        'Cette interconnexion transforme la lecture en étude. Elle permet également de '
        'générer automatiquement des « index bibliques » : par exemple, tous les '
        'enseignements de PAM qui citent Ésaïe 53, ou toutes les vidéos qui mentionnent '
        'le livre d\'Hénoch. La recherche devient thématique et biblique, pas seulement '
        'lexicale. Les sources textuelles recommandées sont : la Bible Segond 21 '
        '(domaine public ou autorisation), la Louis Segond 1910 (domaine public), et '
        'pour les textes originaux, le Codex Leningradensis (Massorétique) et le '
        'Novum Testamentum Graece (Nestle-Aland).'))

    story.append(H2('23. Carte mondiale des dispersés d\'Israël'))
    story.append(P(
        'Cette fonctionnalité est l\'une des plus prophétiques du projet. Elle consiste '
        'à afficher une carte interactive du monde sur laquelle sont géolocalisés, de '
        'manière volontaire et anonymisée, les membres de la communauté qui se '
        'reconnaissent comme fils d\'Israël dispersés. L\'objectif est de rendre visible '
        'l\'accomplissement progressif de la promesse de rassemblement (Ésaïe 11:12, '
        'Ézéchiel 37:21-22) et de permettre aux croyants dispersés de prendre conscience '
        'de leur nombre et de leur répartition géographique.'))
    story.append(P(
        'La géolocalisation est strictement optionnelle et anonymisée : un membre peut '
        'indiquer sa ville ou sa région, mais pas son adresse précise. Les marqueurs '
        'sont agrégés par zone (pas de points individuels précis en dessous d\'un certain '
        'seuil, pour éviter toute identification). Les membres situés dans des pays '
        'hostiles au christianisme peuvent choisir de ne pas apparaître, ou d\'apparaître '
        'sous un pseudonyme. La carte peut être filtrée par langue, par date d\'arrivée '
        'dans la communauté, par niveau d\'engagement. Elle constitue un outil de '
        'visibilité et d\'encouragement, pas de surveillance.'))

    story.append(H2('24. Coffre-fort numérique immuable'))
    story.append(P(
        'Tous les contenus publiés par PAM et le Pasteur Kongo (témoignages, enseignements, '
        'vidéos, lives archivés) doivent être hachés et ancrés sur une blockchain '
        'publique, de préférence Arweave (qui offre un stockage permanent à coût unique) '
        'ou, à défaut, Bitcoin via OpenTimestamps. Cette ancre garantit que le contenu '
        'existe à une date donnée, sous une forme donnée, et qu\'aucune modification '
        'rétroactive n\'est possible sans être détectée. C\'est l\'équivalent numérique '
        'd\'un scellé notarial.'))
    story.append(P(
        'Cette fonctionnalité répond à deux menaces. Premièrement, la falsification : '
        'même si un attaquant compromise le site et tente de modifier un témoignage, '
        'l\'ancre blockchain permettra de prouver la version originale. Deuxièmement, '
        'la suppression : même si le site est censuré ou saisi, les contenus restent '
        'accessibles via Arweave, et une interface de secours (page miroir statique) '
        'peut être déployée rapidement pour les ré-afficher.'))
    story.append(CalloutBox(
        'Dead man\'s switch — Mécanisme d\'urgence',
        'Un mécanisme de « commutateur d\'homme mort » peut être prévu : si PAM et le '
        'Pasteur Kongo cessent tous deux de manifester leur présence sur la plateforme '
        'pendant une durée prédéfinie (par exemple 30 jours), un ensemble de contenus '
        'réservés est automatiquement publié. Cela peut concerner des témoignages '
        'sensibles mis en réserve, des instructions pour la communauté, ou des révélations '
        'destinées à paraître uniquement en cas de besoin extrême. Ce mécanisme est '
        'délicat à calibrer et devra faire l\'objet d\'une concertation spirituelle '
        'approfondie avant implémentation.'))

    story.append(H2('25. Sous-titrage IA multilingue'))
    story.append(P(
        'Pour que la Parole atteigne les dispersés d\'Israël partout où ils se trouvent, '
        'le multilinguisme est non négociable. PAM parle principalement en français, '
        'mais son audience potentielle s\'étend à tous les continents. Le sous-titrage '
        'automatique par IA (Whisper d\'OpenAI, exécutable en local sans fuite de '
        'données) permet de générer des sous-titres dans la langue source, puis de les '
        'traduire vers les langues cibles. Les langues prioritaires sont : français, '
        'anglais, espagnol, portugais, hébreu, amharique, lingala, swahili, arabe '
        '(pour les croyants issus de contextes musulmans).'))
    story.append(P(
        'Le sous-titrage IA n\'est pas parfait, surtout pour les contenus spirituels '
        'où le vocabulaire est spécifique. Une fonction de correction collaborative est '
        'donc prévue : les membres de la communauté peuvent proposer des corrections '
        'aux sous-titres générés, qui sont validées par des modérateurs. Cette '
        'approche permet d\'améliorer progressivement la qualité tout en engageant la '
        'communauté dans l\'effort de traduction — un ministère à part entière.'))

    story.append(H2('26. Application mobile native'))
    story.append(P(
        'Une application mobile native (iOS et Android) est indispensable pour plusieurs '
        'raisons : les notifications push (alertes de live, nouveaux enseignements), le '
        'mode hors-ligne (téléchargement de vidéos et d\'enseignements pour lecture sans '
        'connexion), l\'accès simplifié au média social intégré, et la fonction '
        'd\'appel direct. L\'application doit être conçue pour les contextes difficiles : '
        'faible connexion, appareils anciens, restrictions de batterie.'))
    story.append(P(
        'La technologie recommandée est React Native avec Expo, qui permet de partager '
        'l\'essentiel du code entre iOS et Android, et même avec le front-end web. La '
        'publication sur les stores Apple et Google Play pose cependant un risque : '
        'ces stores ont déjà démontré leur capacité à suspendre des applications '
        'religieuses jugées controversées. Une stratégie de contournement doit être '
        'prévue : distribution directe (APK signé) depuis le site pour Android, et '
        'éventuellement PWA installable pour contourner l\'App Store. La pérennité de '
        'l\'application ne doit pas dépendre exclusivement de la goodwill d\'Apple et '
        'de Google.'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE VII — SÉCURITÉ, RÉSILIENCE & ANTI-CENSURE
    # =====================================================================
    story.extend(H1('Sécurité, résilience et anti-censure', 'PARTIE VII'))
    story.append(P(
        'La résilience face à la censure est l\'un des motifs fondateurs du projet. Cette '
        'partie analyse les risques de manière systématique et propose des stratégies de '
        'mitigation pour chacun. L\'ambition n\'est pas seulement de résister à une '
        'vague de censure, mais de survivre à des scénarios adverses prolongés.',
        S_LEAD))

    story.append(H2('27. Analyse de risques — Matrice systématique'))
    story.append(P(
        'Les risques qui pèsent sur la plateforme peuvent être classés en six familles '
        'principales. Chaque famille appelle une stratégie de mitigation spécifique. '
        'L\'évaluation se fait sur deux axes : la probabilité d\'occurrence et l\'impact '
        'potentiel. Les risques les plus dangereux ne sont pas toujours les plus visibles.'))
    story.append(make_table(
        ['Risque', 'Probabilité', 'Impact', 'Mitigation'],
        [
            ['Shadowban YouTube/TikTok/FB', 'Élevée', 'Modéré',
             'Redondance multi-plateformes, site comme source principale'],
            ['Suppression de compte YouTube', 'Moyenne', 'Élevé',
             'Archivage local automatique, mirror Odysee/Rumble'],
            ['Saisie de nom de domaine', 'Faible', 'Très élevé',
             'Domaines de secours (.eth, .onion), DNS distribués'],
            [' Suspension serveur cloud', 'Moyenne', 'Élevé',
             'Hébergement multi-juridictionnel, bascule automatique'],
            ['Attaque DDoS', 'Élevée', 'Modéré',
             'Cloudflare anti-DDoS, capacité d\'absorption'],
            ['Compromission compte admin', 'Moyenne', 'Très élevé',
             '2FA obligatoire, détection d\'anomalies, audit logs'],
            ['Ingénierie sociale', 'Moyenne', 'Élevé',
             'Formation équipe, procédures de validation, whitelist contacts'],
            ['Exfiltration données membres', 'Faible', 'Très élevé',
             'Chiffrement au repos, E2E pour données sensibles, minimisation'],
            ['Infiltration communauté', 'Moyenne', 'Modéré',
             'Vérification progressive des membres, modération attentive'],
            ['Attente juridique (RGPD)', 'Faible', 'Modéré',
             'Conformité RGPD, DPO, registre des traitements'],
            ['Coupure Internet locale', 'Faible', 'Modéré',
             'App mobile mode offline, contenu téléchargeable'],
            ['Décès ou indisponibilité PAM', 'Faible', 'Très élevé',
             'Plan de continuité, délégation, dead man\'s switch'],
        ],
        col_widths=[4*cm, 2*cm, 2*cm, 8*cm]))

    story.append(H2('28. Stratégie anti-shadowban'))
    story.append(P(
        'Le shadowban est la pratique par laquelle une plateforme (YouTube, TikTok, '
        'Facebook) réduit silencieusement la visibilité d\'un compte sans le notifier. '
        'L\'auteur continue de publier, pensant être lu, mais son audience ne le voit '
        'plus. Cette pratique est particulièrement insidieuse car elle est difficile à '
        'détecter et à contester. La stratégie anti-shadowban repose sur trois piliers.'))
    story.append(P(
        '<b>Pilier 1 — Diversification native.</b> Les comptes officiels de PAM et du '
        'Pasteur Kongo sur YouTube, Facebook, TikTok, Odysee, Rumble, Telegram sont '
        'alimentés automatiquement depuis le site. Si l\'un est shadowbanné, les autres '
        'continuent de fonctionner. Une surveillance automatisée compare les statistiques '
        'de vues entre plateformes et détecte les chutes anormales qui signalent un '
        'shadowban probable.'))
    story.append(P(
        '<b>Pilier 2 — Indépendance du site.</b> Le site reste la source de vérité. '
        'Chaque vidéo publiée sur une plateforme externe contient, dans sa description '
        'ou sa narration, un appel à rejoindre le site pour ne rien manquer. L\'audience '
        'est progressivement éduquée à considérer le site comme le rendez-vous principal, '
        'et les plateformes externes comme des portes d\'entrée secondaires.'))
    story.append(P(
        '<b>Pilier 3 — Redirection automatique.</b> En cas de suppression confirmée d\'un '
        'compte externe, le site met à jour automatiquement les liens dans tous les '
        'contenus concernés, redirigeant les internautes vers la version hébergée '
        'localement. Un bandeau d\'information explique ce qui s\'est passé, sans '
        'polemique excessive, mais avec transparence. Cela renforce la crédibilité et '
        'l\'attachement de la communauté.'))

    story.append(H2('29. Plan de continuité — Bunker mode et bascule'))
    story.append(P(
        'Le plan de continuité décrit les procédures à suivre en cas d\'incident majeur. '
        'Il distingue plusieurs niveaux de gravité et prévoit, pour chacun, une réponse '
        'adaptée. L\'objectif est de minimiser le temps d\'indisponibilité et de '
        'préserver l\'intégrité des contenus, même dans les scénarios les plus sombres.'))
    story.append(Bullet(
        '<b>Niveau 1 — Panne temporaire</b> (serveur en panne, attaque DDoS modérée). '
        'Bascule automatique vers le serveur secondaire. Délai cible de récupération : '
        'moins de 5 minutes.'))
    story.append(Bullet(
        '<b>Niveau 2 — Attaque soutenue</b> (DDoS massif, tentative d\'intrusion). '
        'Activation du mode « bunker » : le site passe en lecture seule, les inscriptions '
        'et les publications sont suspendues, mais la lecture des contenus reste '
        'disponible. Cloudflare absorbe l\'attaque.'))
    story.append(Bullet(
        '<b>Niveau 3 — Saisie ou censure étatique</b>. Activation du domaine de secours '
        '(.eth, .onion), publication des coordonnées d\'accès sur les canaux résiduels '
        '(Odysee, Telegram), bascule vers un hébergeur dans une juridiction protégée.'))
    story.append(Bullet(
        '<b>Niveau 4 — Compromission grave</b> (serveur piraté, données fuities). Mise '
        'hors ligne immédiate, communication transparente à la communauté, restauration '
        'depuis les sauvegardes chiffrées les plus récentes, audit de sécurité complet '
        'avant remise en service.'))

    story.append(H2('30. Réseau Samuel — Messagerie de secours en mesh'))
    story.append(P(
        'Le « réseau Samuel » est une innovation proposée pour les scénarios extrêmes. '
        'Samuel, dans la Bible, est celui qui entend l\'appel de Dieu et prête sa voix. '
        'Le réseau Samuel est un système de messagerie de secours, intégré à '
        'l\'application mobile, capable de fonctionner même en cas d\'indisponibilité '
        'du serveur central. Il s\'appuie sur une topologie mesh : les téléphones '
        'proches communiquent directement entre eux via Bluetooth Low Energy ou Wi-Fi '
        'Direct, et les messages sont propagés de proche en proche jusqu\'à atteindre '
        'leur destinataire ou un nœud connecté à Internet.'))
    story.append(P(
        'Ce réseau ne remplace pas la messagerie principale, mais assure un canal '
        'minimal en cas de crise. Il peut transmettre des messages courts (urgence, '
        'consignes, prières) sans dépendre d\'aucune infrastructure externe. Cette '
        'fonctionnalité est complexe à développer et n\'est pas prioritaire en V1, '
        'mais figure dans la roadmap V3/V4 pour les communautés situées dans des zones '
        'à risque. Elle est l\'équivalent numérique du « réseau de maisons sûres » '
        'qu\'ont utilisé, à diverses époques, les croyants persécutés.'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE VIII — CONFORMITÉ, CADRE LÉGAL & ÉTHIQUE
    # =====================================================================
    story.extend(H1('Conformité, cadre légal et éthique', 'PARTIE VIII'))
    story.append(P(
        'Un projet de cette ambition ne peut pas faire l\'économie d\'une réflexion '
        'juridique et éthique solide. La souveraineté numérique n\'exempte pas du '
        'respect des lois applicables, et la dimension spirituelle n\'exempte pas '
        'd\'une déontologie de traitement des données personnelles. Cette partie pose '
        'les principes directeurs ; un juriste spécialisé devra être consulté pour '
        'valider les choix opérationnels.', S_LEAD))

    story.append(H2('31. RGPD et confidentialité'))
    story.append(P(
        'Si la plateforme est accessible depuis l\'Union européenne (ce qui sera le '
        'cas, ne serait-ce que pour les membres francophones d\'Europe), elle est '
        'soumise au RGPD. Cela impose plusieurs obligations : transparence sur les '
        'données collectées (politique de confidentialité claire), consentement '
        'explicite pour les données non strictement nécessaires, droit d\'accès et '
        'd\'effacement pour les utilisateurs, minimisation des données collectées, '
        'et déclaration d\'incident en cas de fuite.'))
    story.append(P(
        'L\'approche recommandée est double. D\'une part, appliquer le RGPD de manière '
        'stricte par défaut, même pour les utilisateurs hors UE — c\'est une garantie '
        'de qualité et de confiance. D\'autre part, héberger les données dans une '
        'juridiction compatible avec le RGPD (Suisse, par exemple, dont la loi suisse '
        'sur la protection des données est reconnue adéquate par la Commission '
        'européenne) ou, à défaut, mettre en place des garanties appropriées '
        '(clauses contractuelles types, règles d\'entreprise contraignantes). Un '
        'Délégué à la Protection des Données (DPO) doit être désigné, au moins '
        'externement, pour conseiller le projet.'))

    story.append(H2('32. Modération — Charte, signalement, transparence'))
    story.append(P(
        'La modération d\'une communauté spirituelle est délicate. Trop laxiste, elle '
        'laisse proliférer les contenus destructeurs (fausses doctrines, disputes '
        'stériles, insultes). Trop rigide, elle étouffe la liberté d\'expression et '
        'risque de blesser des croyants sincères. La charte de modération doit donc '
        'être claire, publique, et équilibrée. Elle encadre les comportements, pas '
        'les convictions.'))
    story.append(make_table(
        ['Catégorie', 'Exemples', 'Sanction'],
        [
            ['Respect des personnes', 'Insultes, menaces, harcèlement',
             'Avertissement → bannissement progressif'],
            ['Doctrines non bibliques', 'Prédication contraire à la Parole, hérésies',
             'Masquage → suppression si persistant'],
            ['Spam / promotion non autorisée', 'Publicité, sollicitations financières',
             'Suppression immédiate, bannissement'],
            ['Contenus illicites', 'Apologie du terrorisme, pédopornographie',
             'Suppression, signalement autorités'],
            ['Témoignages non vérifiés', 'Récits présentés comme prophétiques non confirmés',
             'Tag « à discerner », modération a priori'],
            ['Polémiques stériles', 'Disputes doctrinales agressives',
             'Invitation au dialogue privé, puis masquage'],
        ],
        col_widths=[4*cm, 6*cm, 6*cm]))
    story.append(P(
        'Chaque action de modération est consignée dans un journal d\'audit consultable '
        'par les super-administrateurs et, en version agrégée et anonymisée, par la '
        'communauté. Les membres peuvent contester une action via une procédure d\'appel. '
        'Cette transparence est essentielle pour maintenir la confiance et prévenir '
        'les dérives autoritaires. La modération n\'est pas un pouvoir, c\'est un '
        'service.'))

    story.append(H2('33. Droits audio et vidéo — Propriété spirituelle'))
    story.append(P(
        'Les contenus produits par PAM et le Pasteur Kongo (vidéos, enseignements, '
        'témoignages) leur appartiennent exclusivement. La plateforme ne revendique '
        'aucun droit de propriété sur ces contenus, contrairement à ce que font '
        'certaines plateformes grand public dans leurs conditions générales. Les '
        'utilisateurs qui accèdent aux contenus reçoivent une licence limitée, non '
        'exclusive, non transférable, pour un usage personnel et non commercial.'))
    story.append(P(
        'La réutilisation à des fins commerciales est strictement interdite sans '
        'autorisation écrite. La republication sur d\'autres plateformes est encadrée : '
        'autorisée pour les contenus publics si la source est citée et le lien vers le '
        'site original inclus ; interdite pour les contenus réservés aux inscrits ou '
        'aux cercles restreints. Une licence Creative Commons spécifique peut être '
        'rédigée pour formaliser ces conditions (par exemple, CC BY-NC-ND 4.0 adapté).'))

    story.append(H2('34. Protection des mineurs'))
    story.append(P(
        'La plateforme n\'est pas destinée aux mineurs, mais elle ne peut pas empêcher '
        'techniquement un mineur de s\'inscrire avec de fausses informations. Des '
        'garde-fous doivent donc être mis en place. Premièrement, l\'inscription requiert '
        'une déclaration sur l\'honneur d\'être majeur. Deuxièmement, les '
        'fonctionnalités sensibles (messagerie directe, appels, canaux privés) sont '
        'désactivées par défaut pour les comptes dont le comportement suggère un âge '
        'mineur (analyse heuristique, signalements). Troisièmement, un contrôle parental '
        'optionnel peut être proposé, permettant aux parents de lier le compte de leur '
        'enfant au leur et de limiter ses accès.'))
    story.append(P(
        'Tout signalement de contenu impliquant un mineur (ou pouvant nuire à un mineur) '
        'est traité en priorité absolue, avec un protocole de signalement aux autorités '
        'compétentes si la loi l\'exige. La plateforme collabore pleinement avec les '
        'autorités en matière de protection de l\'enfance, sans exception. Cette '
        'coopération n\'entre pas en conflit avec la souveraineté numérique du projet, '
        'car elle concerne des crimes qui sont également condamnés par la Parole.'))

    story.append(H2('35. Calendrier liturgique intégré'))
    story.append(P(
        'Une plateforme au service du rassemblement des fils d\'Israël ne peut pas '
        'ignorer le calendrier biblique. Les fêtes hébraïques (Pessah, Matsot, '
        'Shavouot, Yom Terouah, Yom Kippour, Soukkot) et les shabbats hebdomadaires '
        'doivent être visibles dans un calendrier intégré. Ce calendrier propose des '
        'rappels automatiques, des contenus associés (enseignements de PAM sur chaque '
        'fête, vidéos d\'archives), et des suggestions de lecture biblique.'))
    story.append(P(
        'Le calendrier liturgique n\'est pas une contrainte légale, mais une dimension '
        'spirituelle structurante. Il rappelle à la communauté que le temps n\'est pas '
        'neutre, que Dieu a institué des rendez-vous (les « mo\'adim »), et que la '
        'plateforme doit elle-même se soumettre à ce rythme plutôt que d\'imposer le '
        'rythme frénétique des réseaux sociaux grand public. Une option « repos '
        'shabbatique » peut même être proposée : suspension automatique des '
        'notifications pendant le shabbat, pour ceux qui le souhaitent.'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE IX — ROADMAP & PHASAGE
    # =====================================================================
    story.extend(H1('Roadmap et phasage', 'PARTIE IX'))
    story.append(P(
        'La roadmap proposée s\'étale sur 24 mois et découpe le projet en cinq phases '
        'successives, chacune apportant une valeur fonctionnelle complète. L\'approche '
        'est incrémentale : chaque phase produit une plateforme utilisable, sur laquelle '
        'la phase suivante s\'appuie. Cela permet de recueillir du feedback réel dès '
        'les premiers mois et d\'ajuster le tir avant d\'investir dans les '
        'fonctionnalités les plus complexes.', S_LEAD))

    story.append(H2('36. Découpage en cinq versions'))
    story.append(make_table(
        ['Phase', 'Durée', 'Livrables clés'],
        [
            ['MVP', 'Mois 0–4',
             'Site vitrine, biographies PAM & Pasteur Kongo, upload manuel de vidéos, espace enseignements basique, formulaire de contact'],
            ['V1 — Diffusion', 'Mois 4–8',
             'Streaming multiplateforme automatisé, lecteur vidéo avancé, archivage automatique, première version du média social (canaux texte, rôles de base)'],
            ['V2 — Communauté', 'Mois 8–14',
             'Média social complet (DMs E2E, appels audio/vidéo, groupes restreints), Bible interconnectée, calendrier liturgique, modération avancée'],
            ['V3 — Innovations', 'Mois 14–20',
             'Carte des dispersés, coffre-fort immuable (Arweave), sous-titrage IA multilingue, application mobile native (iOS+Android), dead man\'s switch'],
            ['V4 — Résilience', 'Mois 20–24',
             'Mode bunker, réseau Samuel (mesh), domaines de secours, audit sécurité complet, scale international, optimisations performance'],
        ],
        col_widths=[3.2*cm, 2.5*cm, 10.3*cm]))
    story.append(P(
        'Cette roadmap est ambitieuse mais réaliste, à condition que l\'équipe technique '
        'soit correctement dimensionnée et que les décisions spirituelles (validation '
        'des contenus, choix des pasteurs affiliés, calibration de la modération) '
        'avancent en parallèle sans bloquer le développement. Une coordination étroite '
        'entre l\'équipe spirituelle et l\'équipe technique est indispensable.'))

    story.append(H2('37. Estimations en hommes-jours'))
    story.append(P(
        'Les estimations ci-dessous sont indicatives et reposent sur une équipe '
        'expérimentée. Elles incluent le développement, les tests, la documentation, et '
        'la marge pour itérations. Elles excluent la production de contenu (vidéos, '
        'enseignements) qui reste à la charge de PAM et du Pasteur Kongo.'))
    story.append(make_table(
        ['Phase', 'Hommes-jours', 'Équipe recommandée'],
        [
            ['MVP', '60–80', '1 tech lead + 1 dev fullstack + 1 designer'],
            ['V1', '120–160', '+ 1 dev streaming + 1 community manager'],
            ['V2', '200–260', '+ 1 dev mobile + 1 expert sécurité'],
            ['V3', '180–240', 'Équipe complète stabilisée'],
            ['V4', '120–160', 'Équipe complète + audit externe'],
            ['Total', '680–900 HJ', 'Sur 24 mois'],
        ],
        col_widths=[2.8*cm, 3.5*cm, 9.7*cm]))

    story.append(H2('38. Équipe recommandée'))
    story.append(P(
        'L\'équipe idéale pour un projet de cette ampleur compte sept profils '
        'complémentaires. Tous ne sont pas nécessaires dès le démarrage ; ils peuvent '
        'être recrutés progressivement au fil des phases. La qualification spirituelle '
        'des membres de l\'équipe est aussi importante que leur qualification '
        'technique : un développeur qui ne comprend pas la vision produira un code '
        'correct mais sans âme.'))
    story.append(Bullet('<b>1 Tech Lead</b> — Pilote l\'architecture, coordonne l\'équipe, garantit la qualité technique.'))
    story.append(Bullet('<b>2 Développeurs fullstack</b> — Frontend Next.js + backend Node/Go + base de données.'))
    story.append(Bullet('<b>1 Développeur mobile</b> — React Native, publication stores, notifications push.'))
    story.append(Bullet('<b>1 Designer UX/UI</b> — Identité visuelle, parcours utilisateurs, accessibilité.'))
    story.append(Bullet('<b>1 Expert sécurité / infrastructure</b> — Hébergement souverain, chiffrement, anti-DDoS.'))
    story.append(Bullet('<b>1 Community manager / modérateur principal</b> — Animation, modération, support membres.'))
    story.append(Bullet('<b>1 Coordinateur spirituel</b> — Pont entre PAM/Pasteur Kongo et l\'équipe technique, validation des contenus.'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE X — BUDGET & MODÈLE DE FINANCEMENT
    # =====================================================================
    story.extend(H1('Budget et modèle de financement', 'PARTIE X'))
    story.append(P(
        'Le budget prévisionnel se décompose en coûts d\'investissement (développement '
        'initial) et coûts récurrents (hébergement, maintenance, bande passante). Il '
        'varie considérablement selon le niveau d\'ambition et la taille de '
        'l\'audience. Les chiffres ci-dessous sont des ordres de grandeur destinés à '
        'cadrer la réflexion, pas des devis fermes.', S_LEAD))

    story.append(H2('39. Modèle de coûts annuel récurrent'))
    story.append(make_table(
        ['Poste', 'Fourchette basse', 'Fourchette haute', 'Notes'],
        [
            ['Hébergement serveur souverain', '6 000 €/an', '18 000 €/an',
             '2 à 4 serveurs dédiés en juridictions neutres'],
            ['Bande passante streaming', '4 000 €/an', '40 000 €/an',
             'Variable selon audience live, ABR réduit le coût'],
            ['Stockage vidéos archivées', '1 200 €/an', '8 000 €/an',
             'Backblaze B2 ou MinIO, ~0,005 €/Go/mois'],
            ['Cloudflare / CDN', 'Gratuit', '2 400 €/an',
             'Plan gratuit suffisant au début, Pro/Business ensuite'],
            ['Stockage Arweave (ancrage)', '1 000 €/an', '5 000 €/an',
             'Coût unique par contenu, mais volume cumulé'],
            ['Services IA (Whisper local)', '0 €', '2 000 €/an',
             'GPU serveur pour transcodage, optionnel'],
            ['Noms de domaine et DNS', '200 €/an', '600 €/an',
             'Multi-domaines, DNS distribués'],
            ['Maintenance et support', '12 000 €/an', '40 000 €/an',
             'Temps partiel à temps plein selon échelle'],
            ['Audit sécurité annuel', '5 000 €/an', '15 000 €/an',
             'Pentest externe, recommandé'],
            ['Total (estimation)', '~30 000 €/an', '~130 000 €/an',
             'Selon taille de communauté'],
        ],
        col_widths=[4*cm, 2.8*cm, 2.8*cm, 6.4*cm]))
    story.append(P(
        'À ce budget opérationnel s\'ajoute le coût du développement initial, estimé '
        'entre 150 000 € et 400 000 € sur 24 mois selon le niveau d\'internalisation '
        '(équipe salariée vs prestataires) et la complexité des innovations V3/V4. '
        'Ce coût peut être réduit par le recours à des développeurs bénévoles '
        'engagés spirituellement, mais cela comporte des risques de qualité et de '
        'continuité qu\'il faut anticiper.'))

    story.append(H2('40. Sources de financement'))
    story.append(P(
        'Le financement du projet doit être pensé en cohérence avec sa nature '
        'spirituelle. Plusieurs sources sont envisageables, à combiner plutôt qu\'à '
        'opposer. La diversification des sources est elle-même un facteur de '
        'résilience : un projet qui dépend d\'un seul financeur est vulnérable à la '
        'pression de ce financeur.'))
    story.append(Bullet(
        '<b>Dîmes et offrandes via plateforme intégrée</b> — Un module de dons est '
        'intégré au site, permettant aux membres de contribuer financièrement. '
        'Transparence totale sur l\'usage des fonds (comptes publiés annuellement). '
        'Paiement par carte, virement, et crypto-monnaies (Bitcoin, Ethereum, stablecoins).'))
    story.append(Bullet(
        '<b>Mécènes privés</b> — Des croyants aisés, sensibles à la vision, peuvent '
        'soutenir le projet par des dons importants. Un comité de mécènes peut être '
        'constitué, sans que ces mécènes n\'aient de droit de regard éditorial sur '
        'les contenus.'))
    story.append(Bullet(
        '<b>Partenariats avec églises affiliées</b> — Des églises locales ou '
        'nationales qui se reconnaissent dans le ministère de PAM et du Pasteur Kongo '
        'peuvent contribuer sous forme de cotisations annuelles, en échange '
        'd\'avantages (accès à des ressources réservées, formation, représentation).'))
    story.append(Bullet(
        '<b>Vente de contenus premium</b> — Certains enseignements approfondis, '
        'formations bibliques, ou archives complètes peuvent être proposés contre '
        'paiement modéré, afin de financer le reste. À manier avec prudence pour ne '
        'pas transformer la plateforme en commerce.'))
    story.append(Bullet(
        '<b>Subventions et fonds de défense de la liberté religieuse</b> — Certaines '
        'organisations (Alliance Defending Freedom, etc.) soutiennent des projets '
        'de plateforme indépendante. À explorer avec discernement.'))

    story.append(H2('41. Indicateurs de succès'))
    story.append(P(
        'Le succès du projet ne se mesure pas uniquement en termes techniques ou '
        'financiers. Des indicateurs spirituels et communautaires doivent également '
        'être suivis, avec humilité — car le vrai fruit est spirituel et échappe en '
        'partie à la mesure. Les indicateurs suivants sont proposés comme points de '
        'repère, pas comme idoles.'))
    story.append(Bullet('<b>Croissance de la communauté</b> — Nombre de membres actifs mensuels, taux de rétention à 3 mois.'))
    story.append(Bullet('<b>Engagement spirituel</b> — Temps moyen de lecture des enseignements, participation aux lives.'))
    story.append(Bullet('<b>Résilience technique</b> — Disponibilité du site (cible : 99,9%), temps de récupération moyen.'))
    story.append(Bullet('<b>Indépendance financière</b> — Part du budget couverte par les dons communautaires vs mécènes.'))
    story.append(Bullet('<b>Résistance à la censure</b> — Nombre d\'incidents de shadowban/suppression, temps de rétablissement.'))
    story.append(Bullet('<b>Feedback qualitatif</b> — Témoignages de membres sur l\'impact spirituel de la plateforme.'))

    story.append(PageBreak())

    # =====================================================================
    # PARTIE XI — GAPS, COMPARAISON ÉSOTÉRIQUE & RECOMMANDATIONS
    # =====================================================================
    story.extend(H1('Gaps, comparaison ésotérique et recommandations', 'PARTIE XI'))
    story.append(P(
        'Cette partie est probablement la plus stratégique du document. Elle identifie '
        'les dimensions que le brief initial n\'a pas couvertes, compare le projet '
        'avec ce que préparent les groupes ésotériques pour le nouvel ordre mondial, '
        'et formule des recommandations finales. C\'est ici que se joue la différence '
        'entre une plateforme « comme les autres » et une infrastructure vraiment '
        'inédite, alignée sur le Royaume.', S_LEAD))

    story.append(H2('42. Gaps identifiés — Ce que le brief n\'a pas couvert'))
    story.append(P(
        'L\'analyse du brief initial révèle douze dimensions sous-estimées ou absentes, '
        'qu\'il est essentiel d\'intégrer pour que le projet soit réellement complet. '
        'Chacune de ces dimensions répond à un besoin réel, identifié par analogie avec '
        'd\'autres plateformes communautaires mature ou par anticipation de scénarios '
        'probables. Elles ne sont pas toutes prioritaires, mais aucune ne doit être '
        'ignorée.'))
    story.append(make_table(
        ['Gap', 'Description', 'Priorité'],
        [
            ['Multilingue intégral', 'Interface traduite (FR/EN/ES/PT/HE/AM/Lingala), pas seulement sous-titres',
             'Haute — V2'],
            ['SEO discret', 'Référencement naturel pour être trouvé sans attirer l\'hostilité',
             'Moyenne — V1'],
            ['Mode offline pour persécutés', 'Téléchargement complet enseignements/vidéos pour usage sans connexion',
             'Haute — V3'],
            ['Registre des baptêmes et témoignages membres', 'Espace où les membres peuvent enregistrer leur propre témoignage de conversion',
             'Moyenne — V2'],
            ['Chaîne d\'intercession', 'Module de demandes de prière, suivi des exaucements, mur d\'intercession',
             'Haute — V2'],
            ['Calendrier liturgique', 'Fêtes hébraïques, shabbat, rendez-vous prophétiques',
             'Moyenne — V2'],
            ['Tiers de membership', 'Public, inscrit, vérifié, disciple, pasteur — pas seulement binaire',
             'Haute — V1'],
            ['Vérification d\'identité sans KYC', 'Validation par parrainage, pas par pièce d\'identité',
             'Haute — V2'],
            ['Protection des mineurs', 'Contrôle parental, restriction fonctionnalités sensibles',
             'Haute — V1'],
            ['Protocole d\'escalade de crise', 'Procédure en cas de menace grave sur un membre (suicide, persécution)',
             'Haute — V2'],
            ['Journal d\'audit public', 'Transparence des actions de modération et de gouvernance',
             'Moyenne — V2'],
            ['Dead man\'s switch', 'Publication automatique de contenus réservés en cas d\'indisponibilité majeure',
             'Moyenne — V3'],
        ],
        col_widths=[4.2*cm, 8.5*cm, 3.3*cm]))

    story.append(H2('43. Comparaison avec les plateformes ésotériques'))
    story.append(P(
        'L\'utilisateur a explicitement demandé une comparaison avec ce que préparent '
        'les groupes ésotériques pour le nouvel ordre mondial. Cette comparaison n\'a '
        'pas pour but de susciter la fascination ni la peur, mais de comprendre les '
        'mécanismes utilisés par l\'adversaire afin d\'en proposer des contre-stratégies '
        'saintes. La connaissance des tactiques ennemies est biblique : « afin que '
        'Satan n\'eût pas l\'avantage sur nous, car nous n\'ignorons pas ses designs » '
        '(2 Corinthiens 2:11).'))
    story.append(make_table(
        ['Mécanisme ésotérique (NOM)', 'Contre-stratégie pour le Royaume'],
        [
            ['Hiérarchie initiatique à plusieurs niveaux, secret progressif',
             'Hiérarchie de service, transparence progressive basée sur la maturité, pas sur l\'initiation secrète'],
            ['Sync de masse à dates rituelles pour aligner les consciences',
             'Calendrier liturgique biblique, rassemblements spirituels alignés sur les mo\'adim divins, pas sur des dates occultes'],
            ['Rituels coordonnés via canaux fermés, langage codé',
             'Prières coordonnées via canaux ouverts, langage biblique clair, pas de ésotérisme lexical'],
            ['Archives secrètes accessibles seulement aux initiés',
             'Archives publiques immuables, ancrées sur blockchain, accessibles à tous les cherchants'],
            ['Infiltration des institutions et des médias',
             'Construction d\'institutions alternatives transparentes, refus de l\'infiltration mensongère'],
            ['Culte de la personnalité du leader, vénération',
             'Culte rendu à Dieu seul, les serviteurs restent des serviteurs, pas des gourous'],
            ['Promesse de pouvoir et d\'élévation personnelle',
             'Promesse de salut par la foi, service par amour, abaissement volontaire à l\'image du Maître'],
            ['Syncretisme religieux, fusion des croyances',
             'Fidélité exclusive à Yeshoua et à la Parole, refus des compromis doctrinaux'],
            ['Usage de symboles occultes et de mantras',
             'Usage de symboles bibliques (menorah, chofar) comme rappels, pas comme talismans'],
            ['Dépendance psychologique au groupe',
             'Encouragement à la relation personnelle avec Dieu, autonomie spirituelle du membre'],
        ],
        col_widths=[8*cm, 8*cm]))
    story.append(P(
        'Cette grille de lecture doit guider toutes les décisions de conception. À '
        'chaque fois qu\'une fonctionnalité risque de ressembler, même de loin, à un '
        'mécanisme ésotérique, il faut se poser la question : « Cette mécanique sert-elle '
        'la liberté spirituelle du membre, ou crée-t-elle une dépendance ? Est-elle '
        'transparente, ou repose-t-elle sur du secret ? Honore-t-elle Dieu, ou '
        'flatte-t-elle l\'ego d\'un leader ? » La frontière entre une communauté '
        'spirituelle saine et une secte est parfois ténue ; la vigilance est de mise '
        'dès la conception.'))

    story.append(H2('44. Recommandations finales — Sept principes cardinaux'))
    story.append(P(
        'Pour clore ce cahier des charges, sept principes cardinaux sont proposés '
        'comme boussole pour toutes les décisions à venir. Ces principes ne sont pas '
        'des règles techniques mais des engagements spirituels qui doivent guider '
        'l\'ensemble de l\'équipe, depuis le développeur jusqu\'au modérateur, en '
        'passant par les serviteurs eux-mêmes.'))
    story.append(Bullet(
        '<b>1. Soumission à la Parole.</b> Toute fonctionnalité, tout design, toute '
        'communication est évalué à l\'aune de la conformité biblique. En cas de doute, '
        'la Parole tranche.'))
    story.append(Bullet(
        '<b>2. Simplicité.</b> La complexité est l\'ennemie de la sainteté. Préférer '
        'trois fonctionnalités excellentes à dix fonctionnalités médiocres. Éviter la '
        'feature creep.'))
    story.append(Bullet(
        '<b>3. Résilience.</b> Bâtir pour durer, bâtir pour résister. Chaque composant '
        'doit pouvoir survivre à la défaillance d\'un autre. La redondance n\'est pas '
        'du gaspillage, c\'est de la sagesse.'))
    story.append(Bullet(
        '<b>4. Transparence.</b> Aucune décision cachée, aucun algorithme obscur, '
        'aucune modération arbitraire. La communauté mérite de comprendre comment '
        'fonctionne l\'outil qu\'elle utilise.'))
    story.append(Bullet(
        '<b>5. Sainteté.</b> La plateforme n\'est pas neutre. Elle est consacrée au '
        'Seigneur. Cela exclut tout contenu, toute publicité, tout partenriage qui '
        'compromettrait cette consécration.'))
    story.append(Bullet(
        '<b>6. Unité.</b> Servir le rassemblement des fils d\'Israël, pas la '
        'fragmentation. Éviter les querelles stériles, privilégier l\'édification '
        'commune, accueillir les brebis dispersées.'))
    story.append(Bullet(
        '<b>7. Excellence.</b> Offrir au Seigneur le meilleur de la technique, du '
        'design, de la sécurité. Ne pas se contenter du minimum viable quand il s\'agit '
        'du Royaume. L\'excellence est une forme de louange.'))

    story.append(PageBreak())

    # =====================================================================
    # CONCLUSION
    # =====================================================================
    story.extend(H1('Conclusion — Au son du chofar', 'CLÔTURE'))
    story.append(P(
        'Ce cahier des charges trace le contours d\'un projet qui dépasse largement le '
        'cadre d\'une application web classique. Il s\'agit de bâtir une infrastructure '
        'numérique au service d\'une mission prophétique : rassembler les fils d\'Israël '
        'dispersés, préserver les témoignages reçus du Seigneur, et préparer activement '
        'le retour du Maître Yeshoua au son du chofar. L\'enjeu n\'est pas technique, '
        'il est spirituel ; mais la dimension technique, si elle est traitée avec '
        'excellence et soumission, devient un acte d\'offrande agréable à Dieu.', S_LEAD))
    story.append(P(
        'Le projet est ambitieux. Il exigera une équipe compétente, un financement '
        'soutenu, et surtout une coordination étroite entre l\'équipe spirituelle et '
        'l\'équipe technique. Il exigera aussi de la patience : bâtir pour le Royaume '
        'n\'obéit pas aux rythmes frénétiques de la tech. Il exigera de la sagesse : '
        'toutes les fonctionnalités proposées dans ce cahier ne seront pas pertinentes '
        'au moment de les implémenter, et certaines évolueront. Le document doit rester '
        'vivant, révisé, ajusté en fonction des retours du Seigneur et de la communauté.'))
    story.append(P(
        'Les prochaines étapes immédiates sont les suivantes. Premièrement, validation '
        'spirituelle de ce cahier par PAM et le Pasteur Kongo : tout ce qui est proposé '
        'ici doit être reçu, testé dans la prière, et amendé si nécessaire. '
        'Deuxièmement, constitution de l\'équipe technique, en privilégiant des profils '
        'à la fois compétents et spirituellement alignés. Troisièmement, choix du '
        'design (parmi les trois concepts proposés) et de l\'hébergeur souverain. '
        'Quatrièmement, première réunion de lancement, avec acte de consécration du '
        'projet au Seigneur.'))
    story.append(P(
        'Que ce projet, s\'il est accompli, soit un instrument de rassemblement, '
        'd\'édification, et de préparation. Que les contenus qui y circulent '
        'honorèrent la vérité. Que les cœurs qui s\'y rencontrent soient disposés à '
        'entendre ce que l\'Esprit dit aux Églises. Et que, le jour où le chofar '
        'retentira, cette plateforme ait contribué, fût-ce modestement, à ce que le '
        'Royaume soit prêt à accueillir son Roi.'))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="40%", thickness=0.6, color=DIVIDER,
                            spaceBefore=8, spaceAfter=8, hAlign='CENTER'))
    story.append(Paragraph(
        '« Voici, je viens bientôt. Retiens ce que tu as, afin que personne ne prenne '
        'ta couronne. »', S_QUOTE))
    story.append(Paragraph('Apocalypse 3:11', ParagraphStyle(
        'RefQuote', fontName='Carlito', fontSize=9, textColor=ACCENT_GOLD,
        alignment=TA_CENTER, spaceBefore=2)))

# UPS Frontend

Interface web React + TypeScript + Tailwind pour piloter les APIs UPS via le projet
`ups-backend`. Reprend la charte et l'architecture Konitys (identique à `bornes_factory`).

Aucun identifiant UPS ici : le frontend n'appelle que le backend.

## Installation

```bash
npm install
cp .env.example .env
npm run dev
```

L'interface démarre sur `http://localhost:5173`.

> Le backend (`../ups-backend`) doit tourner en parallèle. Le badge dans la barre
> supérieure indique l'état de la connexion et de l'authentification UPS.

## Configuration (.env)

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL du backend (défaut `http://localhost:3000`) |
| `VITE_KEYCLOAK_URL` | Serveur Keycloak. **Laisser vide désactive l'authentification** (développement local) |
| `VITE_KEYCLOAK_REALM` | Realm Keycloak (défaut `konitys`) |
| `VITE_KEYCLOAK_CLIENT_ID` | Client Keycloak (défaut `ups-management`) |
| `VITE_PLATEFORM_URL` | Host plateforme exposant HeaderBar/Sidebar via Module Federation. Vide → composants locaux |
| `VITE_GOOGLE_MAPS_API_KEY` | Clé Google Places pour l'autocomplétion d'adresse. Vide → saisie manuelle |

### Autocomplétion d'adresse

Les champs « Adresse » utilisent Google Places : choisir une suggestion remplit
automatiquement la ville, l'état, le code postal et le pays.

La clé doit avoir l'API **Places** et l'API **Maps JavaScript** activées, ainsi que la
facturation configurée. Elle est visible dans le navigateur — **restreignez-la par
domaine** (HTTP referrers) dans la console Google Cloud. Sans clé, les champs restent
en saisie manuelle et la liste des points relais s'affiche sans carte : rien ne casse.

### Carnet d'adresses

Référentiel partagé par toute l'équipe : une adresse enregistrée par une personne
est aussitôt disponible pour les autres. Les groupes (« antennes », « partenaires »…)
servent à classer ; ils sont facultatifs.

Le sélecteur « Charger depuis le carnet » apparaît sur toutes les pages de saisie
d'adresse — Étiquettes, Tarifs, Délais, Enlèvement, et chaque ligne de l'envoi groupé.
Il **remplit** les champs sans les verrouiller : la correction manuelle reste possible,
comme avec l'autocomplétion Google.

| Comportement | Détail |
|---|---|
| Adresse par défaut | Pré-chargée à l'ouverture de la page Étiquettes |
| Tri | Défaut d'abord, puis les plus utilisées |
| Après un envoi réussi | Bouton « Enregistrer dans le carnet », nom pré-rempli |
| Import CSV | `nom;destinataire;adresse;ville;code_postal;pays;telephone;groupe` — les groupes absents sont créés |
| Carnet vide ou base absente | Le sélecteur disparaît : les pages restent utilisables |

### Types de colis

Le matériel expédié régulièrement (DS620, QW410, Magnets, bornes…) est enregistré
une fois avec son poids et ses dimensions, puis rechargé en un clic.

Le sélecteur « Charger un type de colis » apparaît sur **Étiquettes** et **Tarifs**
— les deux pages partagent le même éditeur de colis. Un champ quantité permet
d'ajouter plusieurs colis identiques d'un coup : trois bornes, une seule action.

| Comportement | Détail |
|---|---|
| Premier colis vierge | Remplacé par le type chargé, plutôt que de laisser un colis vide de 1 kg |
| Valeurs chargées | Modifiables : un cas particulier se corrige sans créer un type dédié |
| Envoi groupé | Colonne `type` du CSV : le poids est retrouvé côté backend |
| Catalogue vide ou base absente | Le sélecteur disparaît, les pages restent utilisables |

Le poids seul est obligatoire ; les dimensions sont facultatives, UPS ne les
prenant en compte que si les trois sont renseignées.

### Indicateurs chiffrés

Le **tableau de bord** affiche les chiffres clés des 30 derniers jours :
dépensé, nombre d'expéditions, coût moyen, envois en cours.

La page **Envois en cours** porte un panneau « Indicateurs », replié par défaut
— la page sert d'abord à retrouver un colis. Ouvert, il donne sur 7, 30, 90 jours
ou depuis le début :

- coût total et moyen, nombre d'expéditions et de colis
- délai moyen de livraison réel, calculé sur les envois livrés
- répartition du coût par service UPS, en barres
- coût quotidien, en histogramme

> **Un envoi multi-colis compte pour une expédition.** Le coût n'est pas
> multiplié par le nombre de colis, contrairement à ce qu'une somme naïve des
> lignes en base donnerait. Les expéditions annulées sont exclues des coûts.

Sans base de données, ces blocs disparaissent au lieu d'afficher des zéros
trompeurs. Aucune librairie de graphiques n'est utilisée : les barres sont en
CSS, ce qui évite une dépendance pour deux visualisations.

### Enlèvements rattachés aux étiquettes

La page **Enlèvement** comporte une section « Colis concernés », qui manquait :
les numéros de suivi n'étaient transmis à UPS d'aucune façon. Deux moyens de les
renseigner :

- **saisie manuelle** d'un numéro, avec avertissement si la longueur inhabituelle
- **recherche dans les étiquettes créées**, avec destinataire et date affichés pour
  ne pas confondre deux envois proches

Après création d'une étiquette, un bouton **« Prévoir un enlèvement »** ouvre la
page avec les numéros déjà rattachés.

> L'adresse d'enlèvement n'est **pas** pré-remplie depuis l'étiquette : c'est celle
> de l'expéditeur, d'où part le chauffeur, et non celle du destinataire. La
> pré-remplir depuis `shipTo` enverrait un chauffeur à la mauvaise adresse.

Maximum 30 colis par enlèvement — limite de l'API UPS. Sans base de données, la
recherche est indisponible mais la saisie manuelle reste utilisable.

### Impression des étiquettes

L'impression s'ouvre **automatiquement dès l'étiquette créée**, comme sur le site
UPS. La case « Ouvrir l'impression dès l'étiquette créée », dans les options
d'expédition, permet de s'en passer — le choix est retenu d'une session à l'autre.

Un bouton **Imprimer** est aussi disponible sur chaque étiquette créée et sur
chaque ligne de la page « Envois en cours », pour réimprimer plus tard.

| Format | Comportement |
|---|---|
| GIF, PDF | Impression directe, sans onglet ni fenêtre surgissante |
| ZPL, EPL, SPL | Téléchargement seul : ce sont des langages de commande pour imprimantes thermiques, illisibles par une imprimante bureautique |

Sur un envoi groupé, un bouton imprime **toutes les étiquettes du lot en une
seule boîte de dialogue**, une par page : enchaîner vingt dialogues n'aurait pas
d'intérêt.

L'étiquette est rendue dans une iframe masquée, donc rien à autoriser ni à
refermer. Si le navigateur refuse l'impression, l'étiquette reste téléchargeable.

### Timeline et Commandes

Trois notions distinctes, souvent confondues :

| Page | Répond à | Source |
|---|---|---|
| **Timeline** (`/activity`) | Qui, dans l'équipe, a fait quoi et quand | Journal applicatif |
| **Envois en cours** (`/shipments`) | Où en est ce colis chez UPS | APIs Tracking / QuantumView |
| **Commandes** (`/batches`) | Où en est ce lot d'envoi groupé | Agrégation des envois par lot |

La Timeline groupe les actions par jour (« Aujourd'hui », « Hier », puis la date),
avec l'auteur, l'heure, un lien vers l'objet concerné et un repli « Détails ».
Les filtres portent sur l'auteur, la famille d'action, la période et le texte.

L'auteur vient du jeton Keycloak vérifié côté backend. Sans `KEYCLOAK_URL` sur le
backend, les actions restent enregistrées mais s'affichent « Utilisateur inconnu ».

### Carte des points relais

Les résultats sont affichés sur une carte Google avec des marqueurs numérotés,
synchronisée avec la liste : survoler une ligne met son marqueur en avant et ouvre
son infobulle, cliquer un marqueur met la ligne en évidence. L'infobulle reprend
l'adresse, le téléphone, la distance, l'ID du point et les horaires.

En production, ces variables sont injectées **au démarrage du conteneur** :
les modifier ne demande pas de reconstruire l'image.

## Fonctionnalités

| Page | Route | Description |
|---|---|---|
| Tableau de bord | `/` | Accès rapide aux services et état de la connexion UPS |
| Suivi de colis | `/tracking` | Recherche par numéro 1Z… avec chronologie des événements |
| Tarifs | `/rating` | Comparaison des services UPS, multi-colis, tarifs négociés |
| Délais | `/transit-times` | Temps d'acheminement estimés par service |
| Étiquettes | `/shipping` | Création d'expédition, aperçu, téléchargement, annulation |
| Enlèvement | `/pickup` | Planification et annulation du passage d'un chauffeur |
| Points relais | `/locator` | Carte Google des UPS Access Points + liste synchronisée, horaires, ID copiable |
| Coûts à l'import | `/landed-cost` | Droits de douane, taxes et frais pour l'international |
| Documents douaniers | `/paperless` | Téléversement de factures commerciales dématérialisées |
| Carnet d'adresses | `/addresses` | Adresses réutilisables partagées, groupes, import CSV |
| Types de colis | `/package-types` | Matériel pré-enregistré : poids, dimensions, emballage |
| Timeline | `/activity` | Journal des actions de l'équipe, avec auteur, filtres et détails |
| Commandes | `/batches` | Lots d'envoi groupé : avancement, colis, coût total |

> Enlèvement, Coûts à l'import et Documents douaniers nécessitent `UPS_ACCOUNT_NUMBER`
> côté backend. Chaque API doit aussi être souscrite pour votre application sur
> developer.ups.com, sinon UPS renvoie l'erreur `250002`.

## Architecture

```
src/
├── main.tsx / App.tsx      Point d'entrée, routes, garde d'authentification
├── config/
│   ├── runtime.ts          Résolution runtime → build → repli
│   └── keycloak.ts         Instance Keycloak
├── contexts/AuthContext    Authentification et rafraîchissement du jeton
├── remoteLoader.ts         Module Federation (composants de la plateforme)
├── components/
│   ├── layout/AppLayout    Coquille : header + sidebar (remote ou local)
│   ├── Topbar / Sidebar    Composants locaux de repli
│   ├── BackendStatus       Indicateur de connexion
│   ├── PackagesEditor      Éditeur de colis partagé
│   └── ui/                 Button, Card, Field, Alert, Badge, PageHeader
├── pages/                  Une page par fonctionnalité
├── services/api.ts         Client HTTP (joint le jeton Keycloak)
└── types/ups.ts            Types des réponses backend
```

**Intégration Konitys.** Le header et la sidebar sont chargés depuis la plateforme via
Module Federation. Si elle est injoignable, un `RemoteErrorBoundary` bascule sur les
composants locaux — visuellement identiques, l'application reste utilisable.

## Prérequis Keycloak

Le client `ups-management` doit exister dans le realm `konitys`, avec l'URL du
frontend déclarée en *Valid Redirect URIs* et *Web Origins*.

## Build

```bash
npm run build      # typecheck (tsc -b) puis build Vite
npm run typecheck  # typecheck seul
npm run preview    # prévisualise le build
```

## Déploiement (Docker / Coolify)

```bash
docker build -t ups-frontend .
docker run -p 8080:80 -e VITE_API_URL=https://api-ups.mondomaine.fr ups-frontend
```

Sur Coolify : Build Pack **Dockerfile**, port `80`.

L'image est construite en deux étapes (Node pour le build, Nginx pour le service).
Les variables sont injectées au démarrage via `/config.js` — décochez
« Build Variable » dans Coolify pour qu'elles soient lues au runtime.

## Notes

- Les étiquettes arrivent en base64 : GIF et PDF sont prévisualisés, tous les formats
  (dont ZPL) sont téléchargeables.
- `@tanstack/react-query` gère le cache et les états de chargement/erreur.
- Le build échoue si le typecheck échoue — `tsc -b` s'exécute avant Vite.

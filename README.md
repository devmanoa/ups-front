# UPS Frontend

Interface web (Vite, JavaScript natif) pour piloter les APIs UPS via le projet `ups-backend`.

Aucun identifiant UPS ici : le frontend n'appelle que le backend.

## Installation

```bash
npm install
cp .env.example .env   # optionnel si le backend est sur localhost:3000
npm run dev
```

L'interface s'ouvre sur `http://localhost:5173`.

> Le backend (`../ups-backend`) doit tourner en parallèle. Le badge en haut à droite
> indique l'état de la connexion et de l'authentification UPS.

## Configuration (.env)

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL du backend (défaut `http://localhost:3000`) |

## Fonctionnalités

| Onglet | Description |
|---|---|
| **Suivi de colis** | Recherche par numéro 1Z… avec chronologie des événements |
| **Tarifs** | Comparaison des services UPS, multi-colis, tarifs négociés |
| **Points relais** | Recherche d'UPS Access Points, horaires et lien carte |
| **Validation d'adresse** | Normalisation et classification résidentiel/professionnel (US/PR) |
| **Étiquettes** | Création d'expédition, aperçu et téléchargement, annulation |

## Structure

```
src/
├── main.js              Onglets, routage par hash, badge de statut
├── styles.css           Styles (charte UPS)
├── lib/
│   ├── api.js           Client HTTP vers le backend
│   ├── ui.js            Helpers de rendu (échappement HTML, formats, formulaires)
│   └── packages.js      Éditeur de colis partagé Tarifs / Étiquettes
└── pages/               Une page par fonctionnalité
```

## Build

```bash
npm run build     # génère dist/
npm run preview   # prévisualise le build
```

## Notes

- Les données affichées proviennent de l'API UPS et sont échappées avant insertion HTML.
- Les étiquettes sont reçues en base64 : les GIF/PDF sont prévisualisés, tous les formats
  (y compris ZPL) sont téléchargeables.
- La navigation utilise le hash (`#tracking`, `#rating`, …), donc le bouton retour du
  navigateur fonctionne.

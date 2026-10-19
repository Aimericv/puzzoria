# Puzzoria

Puzzoria devient la marque publique des quatre langues : en-tête/pied de page, titres SEO, données structurées, cartes sociales, partages et fichiers de secours. « Puzz » rappelle les puzzles ; « oria » suggère un univers à explorer, sans enfermer le catalogue dans un seul jeu.

Le logo reprend le bleu #2149e7, des cases arrondies et une case jaune #f9d75c. Le symbole compact reste lisible comme favicon ; le nom conserve la typographie et le point bleu de l’interface.

- `public/puzzoria-logo.svg` : signature horizontale vectorielle.
- `public/puzzoria-symbol.svg` : symbole seul.
- `public/favicon.svg` : favicon.
- `src/components/brand-mark.tsx` : même symbole dans l’en-tête.

Les anciens noms techniques `dailygrid:*`, cookies de compte, chemin SQLite et projet/volumes Docker restent stables pour conserver les comptes, sauvegardes et parties existantes. Ils ne constituent plus le nom affiché au public.

Le domaine public n’est pas encore configuré. Choisir Puzzoria ne réserve pas puzzoria.com. Après acquisition/configuration HTTPS : renseigner `NEXT_PUBLIC_SITE_URL` et `AUTH_ORIGIN`, reconstruire, puis exécuter `npm run seo:check`. Aucune origine publique supposée n’est ajoutée au dépôt.

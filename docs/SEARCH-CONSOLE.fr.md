# Donner au collecteur l'accès Search Console

Ce guide prépare l'autorisation Google. Il ne crée pas de projet, ne branche
pas encore le collecteur et n'active aucun service payant. L'API Search Console
est [gratuite, avec quotas](https://developers.google.com/webmaster-tools/pricing).
Ne pas ouvrir d'essai payant, acheter de crédits, ni créer de clé privée JSON.

## 1. Préparer l'identité dédiée

1. Dans [Google Cloud Console](https://console.cloud.google.com/), créer ou
   sélectionner un projet dédié, par exemple `Puzzoria analytics`.
2. Dans **API et services → Bibliothèque**, activer **Google Search Console API**.
3. Dans **IAM et administration → Comptes de service → Créer un compte de
   service**, créer `puzzoria-stats-reader`. Laisser vides les rôles sur le projet
   et les accès facultatifs proposés à cette étape. L'autorisation sur les
   statistiques se donne dans Search Console, pas avec un rôle Owner/Editor.
4. Copier son adresse `...@...iam.gserviceaccount.com`.
5. Dans [Search Console](https://search.google.com/search-console), choisir la
   propriété Puzzoria, puis **Paramètres → Utilisateurs et autorisations →
   Ajouter un utilisateur**. Ajouter cette adresse avec **Accès limité**.
   Conserver le compte humain propriétaire. [Autorisations Google](https://support.google.com/webmasters/answer/7687615?hl=fr).

Noter l'ID du projet, son numéro, l'adresse du compte de service et l'identifiant
exact de propriété. Une propriété Domaine s'écrit `sc-domain:puzzoria.com` ;
une propriété Préfixe d'URL peut être `https://puzzoria.com/`. Ne pas deviner
laquelle est configurée. Ces identifiants peuvent être communiqués dans le chat :
ce ne sont ni des mots de passe ni des jetons.

## 2. Autoriser seulement le workflow GitHub de confiance

Utiliser la [fédération d'identité Google pour GitHub Actions](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines),
avec usurpation contrôlée du compte de service, pour obtenir des jetons courts.
Le propriétaire configure ceci une fois dans son projet Google ; ce n'est pas
un droit confié au modèle :

- Activer les API IAM, IAM Service Account Credentials et Security Token Service
  si la configuration de fédération le demande.
- Créer un pool `github-puzzoria` et un fournisseur OIDC `github`, émetteur
  `https://token.actions.githubusercontent.com`, avec l'audience par défaut.
- Mapper `google.subject` à `assertion.sub` et `attribute.repository_id` à
  `assertion.repository_id`.
- Ajouter cette condition au fournisseur (les IDs ci-dessous sont ceux du
  dépôt privé Puzzoria et de son propriétaire) :

```text
assertion.repository_id == '1426188364' &&
assertion.repository_owner_id == '103512403' &&
assertion.ref == 'refs/heads/main' &&
assertion.workflow_ref == 'Aimericv/puzzoria/.github/workflows/autonomy-agent.yml@refs/heads/main'
```

Accorder le rôle **Workload Identity User** sur ce seul compte de service au
principal du dépôt. Exemple à adapter et exécuter par le propriétaire avec
`gcloud` déjà connecté (par exemple dans Cloud Shell) :

```sh
gcloud iam service-accounts add-iam-policy-binding ADRESSE_DU_COMPTE_DE_SERVICE \
  --project=ID_DU_PROJET \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/NUMERO_DU_PROJET/locations/global/workloadIdentityPools/github-puzzoria/attribute.repository_id/1426188364"
```

Le futur collecteur de confiance utilisera `id-token: write`, ce fournisseur,
ce compte et le scope exact `https://www.googleapis.com/auth/webmasters.readonly`.
Le scope est documenté par [Google](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing).
Les branches de PR, forks et autres workflows ne doivent pas pouvoir obtenir
ces identifiants. Ne pas élargir la condition pour résoudre une erreur : vérifier
d'abord le dépôt, la référence, le nom du workflow et les droits de propriété.

## 3. Vérifier le raccordement avant de l'annoncer opérationnel

Le raccordement du collecteur Google reste à implémenter après obtention des
identifiants publics ci-dessus. Le test devra obtenir un jeton temporaire,
lister la propriété autorisée puis lire une courte période de performances
avec `webmasters.readonly`, sans imprimer le jeton. Une erreur d'autorisation
ou un rapport vide n'est pas une mesure de croissance.

Conserver les dates, le fuseau déclaré, la fraîcheur et les limites de couverture
des résultats. L'API Search Analytics ne garantit pas toutes les lignes de
requêtes/pages ; les totaux se collectent séparément des ventilations.
Les clics Google ne sont pas des comptes, appareils, sessions ou humains uniques.
Aucun jeton Google n'est fourni aux outils Codex ; ils ne reçoivent que les
rapports agrégés, comme pour les statistiques internes Puzzoria.

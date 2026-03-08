# 🎰 JP-LOTTERY — Guide de déploiement complet

## Fichiers du projet

```
jp-lottery/
├── index.html                            ← App parieurs
├── style.css                             ← Styles
├── app.js                                ← Logique Firebase parieurs
├── admin.html                            ← Panneau admin
├── scripts/
│   ├── validate-winners.js               ← Script de validation automatique
│   └── package.json
└── .github/
    └── workflows/
        └── validate-winners.yml          ← Cron GitHub Actions (GRATUIT)
```

**Aucune Cloud Function. Aucune carte bancaire. 100% gratuit.**

---

## Étape 1 — Créer le projet Firebase (Spark, gratuit)

1. [console.firebase.google.com](https://console.firebase.google.com) → Nouveau projet
2. Activer **Authentication** → Email/Password
3. Activer **Firestore Database** → mode production

---

## Étape 2 — Créer le compte admin

Firebase Console → Authentication → Users → **Ajouter un utilisateur** :
- Email : `admin@jplottery.com`
- Mot de passe : (choisissez)

---

## Étape 3 — Vos clés Firebase

Firebase Console → ⚙️ Paramètres → Vos applications → Web → Copier `firebaseConfig`

Remplacez dans **`app.js`** ET **`admin.html`** :

```js
const firebaseConfig = {
  apiKey:            "...",
  authDomain:        "VOTRE_PROJET.firebaseapp.com",
  projectId:         "VOTRE_PROJET",
  storageBucket:     "VOTRE_PROJET.appspot.com",
  messagingSenderId: "...",
  appId:             "..."
};
```

---

## Étape 4 — Règles Firestore

Firebase Console → Firestore → Onglet Règles → Copier-coller :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read, write: if request.auth.token.email == 'admin@jplottery.com';
    }
    match /tickets/{id} {
      allow create: if request.auth != null;
      allow read: if request.auth != null && (
        request.auth.uid == resource.data.uid ||
        request.auth.token.email == 'admin@jplottery.com'
      );
      allow update: if request.auth.token.email == 'admin@jplottery.com';
    }
    match /transactions/{id} {
      allow create: if request.auth != null;
      allow read: if request.auth != null && (
        request.auth.uid == resource.data.uid ||
        request.auth.token.email == 'admin@jplottery.com'
      );
    }
    match /lots/{id}        { allow read: if true; allow write: if request.auth.token.email == 'admin@jplottery.com'; }
    match /results/{id}     { allow read: if true; allow write: if request.auth.token.email == 'admin@jplottery.com'; }
    match /announces/{id}   { allow read: if true; allow write: if request.auth.token.email == 'admin@jplottery.com'; }
    match /gameConfigs/{id} { allow read: if true; allow write: if request.auth.token.email == 'admin@jplottery.com'; }
  }
}
```

---

## Étape 5 — GitHub Pages

```bash
git init
git add .
git commit -m "JP-Lottery v1"
git remote add origin https://github.com/VOTRE_USER/jp-lottery.git
git push -u origin main
```

GitHub → Settings → Pages → Source : **main / root** → Save

- App parieurs : `https://VOTRE_USER.github.io/jp-lottery/`
- Admin        : `https://VOTRE_USER.github.io/jp-lottery/admin.html`

---

## Étape 6 — GitHub Actions (validation automatique gratuite)

### 6a. Générer un compte de service Firebase

1. Firebase Console → ⚙️ Paramètres du projet → **Comptes de service**
2. **Générer une nouvelle clé privée** → télécharger le fichier JSON
3. Ouvrir le JSON — noter les 3 valeurs :
   - `project_id`
   - `client_email`
   - `private_key`

### 6b. Ajouter les secrets dans GitHub

GitHub → votre repo → **Settings → Secrets and variables → Actions → New repository secret**

| Nom du secret            | Valeur dans le JSON        |
|--------------------------|---------------------------|
| `FIREBASE_PROJECT_ID`    | valeur de `project_id`    |
| `FIREBASE_CLIENT_EMAIL`  | valeur de `client_email`  |
| `FIREBASE_PRIVATE_KEY`   | valeur de `private_key`   |

### 6c. Activer

Le workflow `.github/workflows/validate-winners.yml` est déjà dans le repo.
GitHub Actions s'active automatiquement au push.

---

## Comment ça fonctionne

```
Admin publie un résultat → Firestore /results/{id} [processed: false]
        ↓
GitHub Actions (cron horaire + aux heures de tirage)
        ↓
scripts/validate-winners.js
  ├── Lit résultats [processed: false]
  ├── Pour chaque résultat → tickets [status: pending] du même lotId
  ├── Compare numéros selon le type de pari
  ├── GAGNANT → status: "win" + gains += prize + transaction
  ├── PERDANT → status: "lose"
  └── result.processed = true
        ↓
app.js — onSnapshot reçoit la mise à jour en temps réel
  ├── Ticket win  → overlay 🏆 + montant
  └── Ticket lose → toast discret
```

**Délai max** : 60 min (cron horaire). Aux heures 18h-22h Lomé : max 5 min.

---

## Vérification manuelle

GitHub → votre repo → onglet **Actions** → **Validation automatique des gagnants** → **Run workflow**

Vous pouvez entrer un `result_id` spécifique pour ne traiter qu'un seul tirage.

---

## Règles de victoire

| Type       | Condition                           | Cote        |
|------------|-------------------------------------|-------------|
| Simple     | 1 numéro parmi les 5 tirés          | ×70         |
| Double     | 2 numéros parmi les 5 tirés         | ×700        |
| Triple     | 3 numéros parmi les 5 tirés         | ×5 000      |
| Quadruple  | 4 numéros parmi les 5 tirés         | ×50 000     |
| Quinte     | 5 numéros exacts (ordre croissant)  | ×1 000 000  |

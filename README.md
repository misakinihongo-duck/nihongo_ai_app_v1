<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b1b64904-d204-46ac-bce5-f7aed0c04546

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Repository structure (Firebase integration relevant)

- `src/firebase.ts`: Firebase client initialization (`initializeApp`, `getAuth`, `getFirestore`).
- `firebase-applet-config.json`: Firebase Web App config (`projectId`, `appId`, `apiKey`, `authDomain`, `storageBucket`, `firestoreDatabaseId` etc.).
- `package.json`: app scripts and dependencies (includes `firebase`, but Firebase CLI packages are not yet included).
- `vite.config.ts`: injects `GEMINI_API_KEY` into client build via `define`.
- `.env.example`: documents required env vars (`GEMINI_API_KEY`, `APP_URL`).

## Firebase app setup checklist

### 1) Firebase project and app config

1. Create/select a Firebase project in Firebase Console.
2. Register a Web App in that project.
3. Replace `firebase-applet-config.json` values with your own project values.
   - Keep the `firestoreDatabaseId` aligned with the Firestore database you created.

### 2) Firestore/Auth provisioning

1. Enable Authentication providers you need (e.g. Google/email) in Firebase Console.
2. Create Firestore database (Native mode).
3. Confirm Firestore Rules in `firestore.rules` match your security policy.

### 3) Environment variables

1. Copy `.env.example` to `.env.local`.
2. Set at minimum:
   - `GEMINI_API_KEY=...`
   - `APP_URL=...` (runtime base URL; especially important when hosted)
3. `GEMINI_API_KEY` is used in the frontend code path via `process.env.GEMINI_API_KEY` and injected by Vite.

### 4) Add Firebase CLI config files (currently missing)

This repository currently does **not** contain `firebase.json` or `.firebaserc`.
If you want to deploy/host with Firebase CLI, create them:

```bash
npm i -D firebase-tools
npx firebase login
npx firebase init
```

Recommended `firebase.json` shape (adjust to your hosting target):

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

Recommended `.firebaserc` shape:

```json
{
  "projects": {
    "default": "<your-firebase-project-id>"
  }
}
```

### 5) Build and deploy options

- Current app has a custom Node server (`server.ts`) and local SQLite usage (`nihongo.db`).
- If you deploy to Firebase Hosting only, deploy static assets (`vite build`) and use a separate backend.
- If keeping current Node backend architecture, deploy backend to Cloud Run / another Node host and treat Firebase mainly as client Auth/Firestore provider.

### 6) Validation commands

```bash
npm run lint
npm run dev
npm run build
```

If using Firebase CLI:

```bash
npx firebase deploy --only firestore:rules
npx firebase deploy --only hosting
```


## Test student account (for development verification)

To verify student UI/permissions without using real student accounts, this repo temporarily allows:

- `mtokuyama23@gmail.com` (student)

### Firestore data examples

`users/{uid}` (created/updated on login):

```json
{
  "uid": "<firebase-auth-uid>",
  "email": "mtokuyama23@gmail.com",
  "displayName": "Test Student",
  "role": "student",
  "status": "active",
  "isTestUser": true,
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>",
  "lastLoginAt": "<serverTimestamp>"
}
```

`students/{uid}` (recommended; transitional `students/{email}` also supported by current app):

```json
{
  "uid": "<firebase-auth-uid>",
  "email": "mtokuyama23@gmail.com",
  "name": "Test Student",
  "role": "student",
  "status": "active",
  "isTestUser": true
}
```

### Before production deploy

Disable or remove this test user:

1. Remove `mtokuyama23@gmail.com` from app allow-list in `src/App.tsx`.
2. In Firestore `users/{uid}`, set `status` to `disabled` **or** delete the document.
3. Delete corresponding `students/{uid}` (or transitional `students/{email}`) test record.
4. Re-test login to confirm access is blocked for the test account.

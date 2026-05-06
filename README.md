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

## Phase 5 verification: Firestore core data migration

Phase 5 moves the main client-side data reads/writes away from the Express/SQLite API and into Firestore collections.
The Express routes in `server.ts` are intentionally kept for now, but the React app should use Firestore for the migrated client flows.

### Migrated client flows

- `students`: loaded from Firestore `students`.
- `essays`: created, read, updated, and deleted in Firestore `essays`.
- `articles`: created, read, updated, and deleted in Firestore `articles`.
- `vocab`: reserved as Firestore `vocab`; the current UI stores vocabulary lists inside essays/articles, and no client `/api/vocab` call should remain.

### Required document ownership fields

New `essays`, `articles`, and future `vocab` documents should include:

```json
{
  "ownerUid": "<student-auth-uid>",
  "ownerEmail": "student@example.com",
  "studentId": "<student-auth-uid-or-student-id>",
  "teacherUid": "<teacher-auth-uid-or-null>",
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

### Manual verification in Codespace

1. Install and start the app:

   ```bash
   npm install
   npm run dev
   ```

2. Login as the test student `mtokuyama23@gmail.com`.
3. Create a writing in the writing workspace.
4. Confirm Firestore has a new `essays` document with `ownerUid`, `ownerEmail`, `studentId`, `teacherUid`, `createdAt`, and `updatedAt`.
5. Edit the writing and confirm `updatedAt` changes.
6. Generate/save an article and confirm Firestore has a new `articles` document with the same ownership fields.
7. Login as the teacher account and confirm teacher views can read student essays/articles.
8. Confirm the React app no longer calls `/api/students`, `/api/essays`, `/api/vocab`, or `/api/articles` by running:

   ```bash
   rg -n "/api/students|/api/essays|/api/vocab|/api/articles" src/App.tsx
   ```

   Expected result: no matches.

### Remaining backend note

`server.ts` still contains the old Express/SQLite routes during the migration window. Do not delete it until Firebase Hosting/App Hosting/Functions strategy is finalized.

## Development Preview Mode (UI-only)

When running with Vite in development (`import.meta.env.DEV`), the app shows a **Dev Preview Panel** in the bottom-right corner.
This panel is only for quickly checking teacher/student UI states in Codespaces or local development.

Options:

- `Off / Real Auth`: use the real Firebase Google Sign-In flow.
- `Teacher Preview / Misaki`: preview the UI as a teacher.
- `Student Preview / Test Student`: preview the UI as `mtokuyama23@gmail.com`.

Important limitations:

- Preview Mode is not Firebase Authentication.
- Preview Mode is not a Firestore Security Rules test.
- Preview Mode is disabled in production builds because it is gated by `import.meta.env.DEV`.
- Firestore write operations are blocked while Preview Mode is active; turn Preview Mode off and login with real Firebase Auth to test saving data.

### Confirm Preview Mode is disabled in production

Run:

```bash
npm run build
npm run start
```

Then open the production app and confirm the **Dev Preview Panel** is not visible. For source-level confirmation, check that the panel is gated by `import.meta.env.DEV` through `src/devPreview.ts`.

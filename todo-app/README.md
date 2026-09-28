# TaskPilot

A synced to-do list: email/password accounts, categories, due dates + priorities,
browser reminders, and voice input (speak a task instead of typing it). Built as a
static site (no build step) using Firebase for accounts and real-time sync.

## 1. Create your free Firebase project

1. Go to https://console.firebase.google.com and click **Add project** (the free
   "Spark" plan is enough for personal/small-group use).
2. Inside the project, click the **</>** (web) icon to register a web app. Give it
   any nickname. Firebase will show you a `firebaseConfig` object.
3. Copy those values into [`firebase-config.js`](firebase-config.js) in this folder,
   replacing the `PASTE_..._HERE` placeholders.
4. In the left sidebar: **Build → Authentication → Get started → Sign-in method →
   Email/Password → Enable**.
5. In the left sidebar: **Build → Firestore Database → Create database** (choose
   production mode, pick any region).
6. In Firestore, open the **Rules** tab and paste:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   Click **Publish**. This keeps everyone's tasks private to their own account.

That's it — no server to run. Anyone who opens the app can sign up with their own
email/password, and their tasks will sync live across every device they log into.

## 2. Run it

This is a static site — open `index.html` through any local web server (it must be
served over http/https, not opened directly as a `file://` path, because it uses ES
modules). For example, with Node installed:

```bash
npx serve todo-app
```

Or deploy it for free with **GitHub Pages**: push this repo to GitHub, then in the
repo's **Settings → Pages**, set the source to the `main` branch. Your app will be
live at `https://<your-username>.github.io/<repo-name>/todo-app/` — open that URL on
your phone and laptop and log in with the same account on both.

## 3. Notes on reminders & voice input

- **Reminders** use the browser's Notification API. The app must be open in a tab
  (or installed as a PWA / added to your home screen) for a reminder to fire — it
  checks every 20 seconds for tasks whose due date/time has passed. The first time
  you log in, your browser will ask for notification permission.
- **Voice input** uses the Web Speech API (tap the 🎤 next to the add-task box, or
  next to the notes field when editing a task). It works best in Chrome; Safari/
  Firefox support is limited or absent, in which case the mic button disables itself.
- On a phone, use your browser's "Add to Home Screen" option after opening the app
  once — it installs like a lightweight app icon (`manifest.json` + `sw.js` make it
  installable and give it basic offline shell caching).

// 1. Go to https://console.firebase.google.com -> Add project (free "Spark" plan is enough).
// 2. In the project, click the </> (web) icon to register a web app, then copy the config
//    object it shows you and paste the values below.
// 3. In the left sidebar enable: Build -> Authentication -> Sign-in method -> Email/Password.
// 4. In the left sidebar enable: Build -> Firestore Database -> Create database (production mode).
// 5. In Firestore -> Rules, paste:
//      rules_version = '2';
//      service cloud.firestore {
//        match /databases/{database}/documents {
//          match /users/{userId}/{document=**} {
//            allow read, write: if request.auth != null && request.auth.uid == userId;
//          }
//        }
//      }
// 6. Save this file. That's it — every device that opens this app and signs in with the
//    same email/password will see the same, live-synced task list.

export const firebaseConfig = {
  apiKey: "AIzaSyCsY9zZ9d7oQhmdxSYgO6zVuNlkuyuGFIY",
  authDomain: "todotodotodo-2fa9b.firebaseapp.com",
  projectId: "todotodotodo-2fa9b",
  storageBucket: "todotodotodo-2fa9b.firebasestorage.app",
  messagingSenderId: "435039434867",
  appId: "1:435039434867:web:7ea20f022547a2c90e9206",
  measurementId: "G-HQ0ZZ3BK8T",
};

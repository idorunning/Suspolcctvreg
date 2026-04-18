import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const configStr = fs.readFileSync('./firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, config.firestoreDatabaseId);
const auth = getAuth(app);

async function test() {
  try {
    const email = `testuser_${Date.now()}@test.local`;
    const pass = 'Password123!';
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      console.log('Created and logged in as', email);
    } catch (e) {
      console.log('Could not register:', e);
      return;
    }

    const user = auth.currentUser;
    if (!user) return;
    console.log('User UID:', user.uid);

    const userRef = doc(db, 'users', user.uid);
    
    // Test onSnapshot
    const unsub = onSnapshot(userRef, (snap) => {
      console.log('onSnapshot update! Exists:', snap.exists(), snap.data());
    }, (error) => {
      console.error('onSnapshot error:', error.message);
    });

    await new Promise(r => setTimeout(r, 2000));

    try {
      await setDoc(userRef, {
        email: user.email,
        role: 'viewer',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      console.log('Write success!');
    } catch (e: any) {
      console.error('Write failed:', e.message);
    }
    
    await new Promise(r => setTimeout(r, 2000));
    unsub();
    process.exit(0);
  } catch (e) {
    console.error('Global error:', e);
    process.exit(1);
  }
}

test();

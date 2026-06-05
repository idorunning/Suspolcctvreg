import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function listAndCleanup() {
  console.log('Fetching cameras from collection...');
  try {
    const querySnapshot = await getDocs(collection(db, 'cameras'));
    console.log(`Found ${querySnapshot.size} total cameras.`);
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      console.log(`ID: ${docSnap.id} | Name: "${data.name}" | Type: ${data.type} | AddedBy: "${data.addedBy}" | Email: "${data.creatorEmail}" | URL: "${data.publicOutputUrl || ''}"`);
    });
  } catch (error) {
    console.error('Error listing cameras:', error);
  }
}

listAndCleanup();

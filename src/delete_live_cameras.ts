import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function deleteLiveCameras() {
  console.log('Querying live webcam cameras with addedBy "system"...');
  try {
    const q = query(collection(db, 'cameras'), where('addedBy', '==', 'system'));
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} live webcam cameras to delete.`);

    let deletedCount = 0;
    for (const docSnap of querySnapshot.docs) {
      console.log(`Deleting camera: ${docSnap.id} - "${docSnap.data().name}"`);
      await deleteDoc(doc(db, 'cameras', docSnap.id));
      deletedCount++;
    }

    console.log(`Successfully deleted ${deletedCount} live webcam cameras from Firestore.`);
  } catch (error) {
    console.error('Error during deletion:', error);
  }
}

deleteLiveCameras();

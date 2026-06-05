import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkCoords() {
  try {
    const querySnapshot = await getDocs(collection(db, 'cameras'));
    console.log(`Checking ${querySnapshot.size} total cameras...`);
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      console.log(`ID: ${docSnap.id} | Name: "${data.name}" | Lat: ${data.latitude} | Lng: ${data.longitude} | FOV: ${data.fieldOfView} | Dir: ${data.direction} | AddedBy: ${data.addedBy}`);
    });
  } catch (error) {
    console.error('Error querying:', error);
  }
}

checkCoords();

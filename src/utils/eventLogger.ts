import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { EventAction } from '../types';

export const logEvent = async (
  action: EventAction,
  userId: string,
  userEmail: string,
  details?: string
) => {
  try {
    await addDoc(collection(db, 'events'), {
      action,
      userId,
      userEmail,
      details: details || null,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log event:', error);
  }
};

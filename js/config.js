// Firebase web config is safe to publish: access is controlled by the Firestore security rules,
// which only let these accounts read or write.
export const firebaseConfig = {
  apiKey: 'AIzaSyBe52hKFuyXZVKtc8CHuO-1mAjZ5HJLPuo',
  authDomain: 'burke-latin.firebaseapp.com',
  projectId: 'burke-latin',
  storageBucket: 'burke-latin.firebasestorage.app',
  messagingSenderId: '987041583677',
  appId: '1:987041583677:web:62403ee43c175e354ed054',
};
export const STUDENT_UIDS = ['mhP5pRPUlXg3nooLBIsjMyHvF6j2', '05a1jUpeD3cDiiOMpNnE4YxZfdF2']; // each student's progress is separate
export const STUDENT_UID = STUDENT_UIDS[0];
export const PARENT_UID = 'xFqJAFGGioUUadmrgbY7Fpbixwm2';
export const APP_VERSION = '1.11.0';

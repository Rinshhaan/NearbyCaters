const admin = require('firebase-admin');

let initialized = false;

function getFirebaseAdmin() {
  if (!initialized) {
    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // Production: service account as JSON string env var
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(serviceAccount);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      // Development: path to service account file
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      credential = admin.credential.cert(serviceAccount);
    } else {
      console.warn('⚠️  Firebase Admin SDK not configured. Push notifications disabled.');
      return null;
    }

    admin.initializeApp({ credential });
    initialized = true;
    console.log('✅ Firebase Admin SDK initialized');
  }

  return admin;
}

/**
 * Send push notification to a single FCM token
 */
async function sendPushToUser(fcmToken, title, body, data = {}) {
  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin || !fcmToken) return;

  try {
    await firebaseAdmin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch {
    console.error('[FCM] Push notification could not be delivered.');
  }
}

/**
 * Send push notification to multiple FCM tokens (batch)
 */
async function sendPushToMultipleUsers(fcmTokens, title, body, data = {}) {
  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin || !fcmTokens?.length) return;

  const validTokens = fcmTokens.filter(Boolean);
  if (validTokens.length === 0) return;

  // FCM supports up to 500 tokens per multicast
  const chunks = [];
  for (let i = 0; i < validTokens.length; i += 500) {
    chunks.push(validTokens.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    try {
      const response = await firebaseAdmin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: { ...data },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
      console.log(`[FCM] Sent ${response.successCount}/${chunk.length} notifications`);
    } catch {
      console.error('[FCM] Notification batch could not be delivered.');
    }
  }
}

module.exports = { sendPushToUser, sendPushToMultipleUsers };

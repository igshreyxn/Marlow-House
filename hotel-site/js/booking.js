/*
  Booking flow controller.
  ------------------------------------------------------------------
  Flow: Guest details -> Account creation (email/password) -> Payment -> Confirmation
  Firebase Auth handles account creation/login. Firestore stores bookings.

  SETUP REQUIRED before this goes live:
  1. Create a Firebase project, enable Email/Password sign-in under Authentication.
  2. Create a Firestore database.
  3. Paste your config into firebaseConfig below.
  4. Add the Firebase SDK script tags to each HTML page (see index.html <head> comment).
  ------------------------------------------------------------------
*/

// ---- Firebase config (placeholder — replace with your project's values) ----
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Firebase is only initialized if the SDK has been loaded on the page.
// This keeps booking.js safe to include even before Firebase script tags are added.
let auth = null;
let db = null;
if (window.firebase && firebaseConfig.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
}

// ---- Cancellation & Refund Policy — single source of truth ----
// Shared by the cancellation flow (My Bookings) and should match
// cancellation-policy.html exactly. Update both together.
const REFUND_POLICY = {
  fullRefundHoursBeforeCheckin: 48, // 100% refund if cancelled 48h+ before check-in
  partialRefundHoursBeforeCheckin: 24, // 50% refund if cancelled 24-48h before check-in
  partialRefundPercent: 50,
  noRefundWithinHours: 24, // 0% refund inside 24h / no-show
};

function calculateRefund(checkInDate, cancelDate, totalAmount) {
  const hoursUntilCheckin = (new Date(checkInDate) - new Date(cancelDate)) / (1000 * 60 * 60);

  if (hoursUntilCheckin >= REFUND_POLICY.fullRefundHoursBeforeCheckin) {
    return { percent: 100, amount: totalAmount, label: "Full refund" };
  }
  if (hoursUntilCheckin >= REFUND_POLICY.partialRefundHoursBeforeCheckin) {
    const amount = totalAmount * (REFUND_POLICY.partialRefundPercent / 100);
    return { percent: REFUND_POLICY.partialRefundPercent, amount, label: "Partial refund (50%)" };
  }
  return { percent: 0, amount: 0, label: "No refund (within 24 hours of check-in)" };
}

// ---- Modal step control ----
const overlay = document.querySelector('.modal-overlay');
const openButtons = document.querySelectorAll('[data-open-booking]');
const closeButton = document.querySelector('.modal-close');
const steps = document.querySelectorAll('.modal-step');

function showStep(name) {
  steps.forEach((s) => s.classList.toggle('active', s.dataset.step === name));
}

openButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    overlay.classList.add('open');
    showStep('details');
  })
);
closeButton?.addEventListener('click', () => overlay.classList.remove('open'));
overlay?.addEventListener('click', (e) => {
  if (e.target === overlay) overlay.classList.remove('open');
});

// Holds guest details in memory across steps (no localStorage per artifact rules /
// no premature persistence before account exists).
const bookingDraft = {};

// ---- Step 1: Guest details ----
const detailsForm = document.querySelector('#booking-details-form');
detailsForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(detailsForm);
  const name = data.get('name')?.trim();
  const phone = data.get('phone')?.trim();
  const email = data.get('email')?.trim();

  if (!name || !phone || !email) return;

  bookingDraft.name = name;
  bookingDraft.phone = phone;
  bookingDraft.email = email;

  // Pre-fill the account email in the next step so the guest doesn't retype it.
  const accountEmailField = document.querySelector('#account-email');
  if (accountEmailField) accountEmailField.value = email;

  showStep('account');
});

// ---- Step 2: Account creation ----
const accountForm = document.querySelector('#booking-account-form');
accountForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(accountForm);
  const email = data.get('email')?.trim();
  const password = data.get('password');
  const errorEl = accountForm.querySelector('.form-error');

  if (!password || password.length < 8) {
    if (errorEl) {
      errorEl.textContent = 'Password must be at least 8 characters.';
      errorEl.classList.add('show');
    }
    return;
  }

  try {
    if (auth) {
      await auth.createUserWithEmailAndPassword(email, password);
    }
    bookingDraft.email = email;
    showStep('payment');
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Could not create account. Try again.';
      errorEl.classList.add('show');
    }
  }
});

// ---- Step 3: Payment (stub — wire up your gateway here) ----
const payButton = document.querySelector('#confirm-payment');
payButton?.addEventListener('click', async () => {
  // Replace this with your payment gateway's checkout call (Razorpay/Stripe/etc).
  // On success, store the booking in Firestore:
  if (db) {
    await db.collection('bookings').add({
      ...bookingDraft,
      status: 'confirmed',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
  showStep('confirmation');
});

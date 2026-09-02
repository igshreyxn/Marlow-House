/*
  Shared setup used by both js/booking.js (date/room selection modal)
  and js/checkout.js (the checkout page).

  SETUP REQUIRED before this goes live:
  1. Create a Firebase project, enable Email/Password sign-in under Authentication.
  2. Create a Firestore database.
  3. Paste your config into firebaseConfig below.
  4. Add the Firebase SDK script tags to each HTML page (see index.html <head> comment).
*/

const firebaseConfig = {
  apiKey: "AIzaSyCVUXHsqjs53w_3m8K5R6drhjAb-GQCB7E",
  authDomain: "marlow-house.firebaseapp.com",
  projectId: "marlow-house",
  storageBucket: "marlow-house.firebasestorage.app",
  messagingSenderId: "72245159473",
  appId: "1:72245159473:web:36122e0d557df997a1d710",
};

let auth = null;
let db = null;
if (window.firebase && firebaseConfig.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
}

const ROOM_DATA = {
  standard: { name: "The Standard", price: 6500 },
  deluxe: { name: "The Deluxe", price: 9200 },
  suite: { name: "The Suite", price: 14800 },
};

// ---- Cancellation & Refund Policy — single source of truth ----
// Must match cancellation-policy.html exactly. Update both together.
const REFUND_POLICY = {
  fullRefundHoursBeforeCheckin: 48,
  partialRefundHoursBeforeCheckin: 24,
  partialRefundPercent: 50,
  noRefundWithinHours: 24,
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

// Demo booked-dates data (ISO 'YYYY-MM-DD'), per room. Simulates what a
// real Firestore query would return.
//
// TO GO LIVE: replace this object and getUnavailableDates() with a
// Firestore read, e.g.:
//
//   async function getUnavailableDates(roomId) {
//     const snap = await db.collection('bookings')
//       .where('roomId', '==', roomId)
//       .where('status', '==', 'confirmed')
//       .get();
//     const dates = [];
//     snap.forEach(doc => {
//       const { checkIn, checkOut } = doc.data();
//       let d = new Date(checkIn);
//       const end = new Date(checkOut);
//       while (d < end) {
//         dates.push(d.toISOString().slice(0, 10));
//         d.setDate(d.getDate() + 1);
//       }
//     });
//     return dates;
//   }
const DEMO_UNAVAILABLE_DATES = {
  standard: ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-22", "2026-09-23"],
  deluxe: ["2026-09-05", "2026-09-06", "2026-09-18", "2026-09-19", "2026-09-20"],
  suite: ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-30"],
};

function getUnavailableDates(roomId) {
  return DEMO_UNAVAILABLE_DATES[roomId] || [];
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

// Reads the booking draft handed off from the date-selection modal.
// Returns null if the guest landed on checkout.html directly.
function readBookingDraft() {
  const raw = sessionStorage.getItem("bookingDraft");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

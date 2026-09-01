/*
  Booking flow controller.
  ------------------------------------------------------------------
  Flow: Select dates (live availability) -> Guest details ->
        Account creation (email/password) -> Payment -> Confirmation

  Firebase Auth handles account creation/login. Firestore stores bookings.

  SETUP REQUIRED before this goes live:
  1. Create a Firebase project, enable Email/Password sign-in under Authentication.
  2. Create a Firestore database.
  3. Paste your config into firebaseConfig below.
  4. Add the Firebase SDK script tags to each HTML page (see index.html <head> comment).
  5. Replace getUnavailableDates() with a real Firestore query (see that
     function's comment below) so the calendar reflects real bookings
     instead of the demo data.
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

/* ============================================================
   AVAILABILITY CALENDAR
   ============================================================ */

const ROOM_DATA = {
  standard: { name: "The Standard", price: 6500 },
  deluxe: { name: "The Deluxe", price: 9200 },
  suite: { name: "The Suite", price: 14800 },
};

// Demo booked-dates data (ISO 'YYYY-MM-DD'), per room. This simulates
// what a real Firestore query would return.
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
//       // expand the checkIn..checkOut range into individual ISO dates
//       let d = new Date(checkIn);
//       const end = new Date(checkOut);
//       while (d < end) {
//         dates.push(d.toISOString().slice(0, 10));
//         d.setDate(d.getDate() + 1);
//       }
//     });
//     return dates;
//   }
//
// Note that function would then need to be awaited wherever it's
// called below (renderCalendar), since Firestore reads are async.
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

const calendarState = {
  roomId: "standard",
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  checkIn: null,
  checkOut: null,
};

const roomSelect = document.querySelector("#room-select");
const calGrid = document.querySelector(".calendar-grid");
const calMonthLabel = document.querySelector(".cal-month-label");
const calPrev = document.querySelector(".cal-prev");
const calNext = document.querySelector(".cal-next");
const sumCheckin = document.querySelector(".sum-checkin");
const sumCheckout = document.querySelector(".sum-checkout");
const sumTotal = document.querySelector(".sum-total");
const datesContinueBtn = document.querySelector("#dates-continue");

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function isPastDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// Checks whether every date strictly between two ISO dates (exclusive)
// is free — used to stop a guest selecting a checkout that spans over
// an already-booked night.
function rangeHasUnavailable(startISO, endISO, unavailableSet) {
  let d = new Date(startISO);
  const end = new Date(endISO);
  d.setDate(d.getDate() + 1);
  while (d < end) {
    if (unavailableSet.has(toISODate(d))) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

function renderCalendar() {
  if (!calGrid) return;
  const { viewYear, viewMonth, roomId } = calendarState;
  const unavailable = new Set(getUnavailableDates(roomId));

  calMonthLabel.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  calGrid.innerHTML = "";

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day is-empty";
    calGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const iso = toISODate(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day";
    cell.textContent = String(day);
    cell.dataset.date = iso;

    const past = isPastDate(date);
    const booked = unavailable.has(iso);

    if (past) {
      cell.classList.add("is-past");
      cell.disabled = true;
    } else if (booked) {
      cell.classList.add("is-unavailable");
      cell.disabled = true;
    } else {
      cell.classList.add("is-available");
      cell.addEventListener("click", () => handleDayClick(iso, unavailable));
    }

    if (calendarState.checkIn === iso || calendarState.checkOut === iso) {
      cell.classList.add(calendarState.checkIn === iso ? "is-range-start" : "is-range-end");
    } else if (
      calendarState.checkIn &&
      calendarState.checkOut &&
      iso > calendarState.checkIn &&
      iso < calendarState.checkOut
    ) {
      cell.classList.add("is-in-range");
    }

    calGrid.appendChild(cell);
  }

  // Disable "previous month" once we're at the current month — no booking in the past.
  const today = new Date();
  calPrev.disabled = viewYear === today.getFullYear() && viewMonth === today.getMonth();
}

function handleDayClick(iso, unavailableSet) {
  const { checkIn, checkOut } = calendarState;

  if (!checkIn || (checkIn && checkOut)) {
    calendarState.checkIn = iso;
    calendarState.checkOut = null;
  } else if (iso <= checkIn) {
    calendarState.checkIn = iso;
    calendarState.checkOut = null;
  } else if (rangeHasUnavailable(checkIn, iso, unavailableSet)) {
    calendarState.checkIn = iso;
    calendarState.checkOut = null;
  } else {
    calendarState.checkOut = iso;
  }

  renderCalendar();
  updateSummary();
}

function updateSummary() {
  const { checkIn, checkOut, roomId } = calendarState;
  const room = ROOM_DATA[roomId];

  sumCheckin.textContent = `Check-in: ${checkIn || "—"}`;
  sumCheckout.textContent = `Check-out: ${checkOut || "—"}`;

  if (checkIn && checkOut) {
    const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const total = nights * room.price;
    sumTotal.textContent = `Total: ₹${total.toLocaleString("en-IN")} for ${nights} night${nights > 1 ? "s" : ""}`;
    datesContinueBtn.disabled = false;
  } else {
    sumTotal.textContent = "Total: —";
    datesContinueBtn.disabled = true;
  }
}

function initCalendarStep(roomId) {
  calendarState.roomId = roomId;
  calendarState.checkIn = null;
  calendarState.checkOut = null;
  const today = new Date();
  calendarState.viewYear = today.getFullYear();
  calendarState.viewMonth = today.getMonth();
  if (roomSelect) roomSelect.value = roomId;
  renderCalendar();
  updateSummary();
}

roomSelect?.addEventListener("change", (e) => {
  calendarState.roomId = e.target.value;
  calendarState.checkIn = null;
  calendarState.checkOut = null;
  renderCalendar();
  updateSummary();
});

calPrev?.addEventListener("click", () => {
  calendarState.viewMonth -= 1;
  if (calendarState.viewMonth < 0) {
    calendarState.viewMonth = 11;
    calendarState.viewYear -= 1;
  }
  renderCalendar();
});

calNext?.addEventListener("click", () => {
  calendarState.viewMonth += 1;
  if (calendarState.viewMonth > 11) {
    calendarState.viewMonth = 0;
    calendarState.viewYear += 1;
  }
  renderCalendar();
});

/* ============================================================
   MODAL STEP CONTROL
   ============================================================ */

const overlay = document.querySelector(".modal-overlay");
const openButtons = document.querySelectorAll("[data-open-booking]");
const closeButton = document.querySelector(".modal-close");
const steps = document.querySelectorAll(".modal-step");

function showStep(name) {
  steps.forEach((s) => s.classList.toggle("active", s.dataset.step === name));
}

openButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    overlay.classList.add("open");
    const roomId = btn.dataset.roomId || "standard";
    initCalendarStep(roomId);
    showStep("dates");
  })
);
closeButton?.addEventListener("click", () => overlay.classList.remove("open"));
overlay?.addEventListener("click", (e) => {
  if (e.target === overlay) overlay.classList.remove("open");
});

// Holds booking details in memory across steps.
const bookingDraft = {};

datesContinueBtn?.addEventListener("click", () => {
  const { roomId, checkIn, checkOut } = calendarState;
  const room = ROOM_DATA[roomId];
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

  bookingDraft.roomId = roomId;
  bookingDraft.roomName = room.name;
  bookingDraft.pricePerNight = room.price;
  bookingDraft.checkIn = checkIn;
  bookingDraft.checkOut = checkOut;
  bookingDraft.nights = nights;
  bookingDraft.total = nights * room.price;

  showStep("details");
});

// ---- Step 2: Guest details ----
const detailsForm = document.querySelector("#booking-details-form");
detailsForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(detailsForm);
  const name = data.get("name")?.trim();
  const phone = data.get("phone")?.trim();
  const email = data.get("email")?.trim();

  if (!name || !phone || !email) return;

  bookingDraft.name = name;
  bookingDraft.phone = phone;
  bookingDraft.email = email;

  const accountEmailField = document.querySelector("#account-email");
  if (accountEmailField) accountEmailField.value = email;

  showStep("account");
});

// ---- Step 3: Account creation ----
const accountForm = document.querySelector("#booking-account-form");
accountForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(accountForm);
  const email = data.get("email")?.trim();
  const password = data.get("password");
  const errorEl = accountForm.querySelector(".form-error");

  if (!password || password.length < 8) {
    if (errorEl) {
      errorEl.textContent = "Password must be at least 8 characters.";
      errorEl.classList.add("show");
    }
    return;
  }

  try {
    if (auth) {
      await auth.createUserWithEmailAndPassword(email, password);
    }
    bookingDraft.email = email;
    renderPaymentSummary();
    showStep("payment");
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Could not create account. Try again.";
      errorEl.classList.add("show");
    }
  }
});

function renderPaymentSummary() {
  const el = document.querySelector("#payment-summary");
  if (!el) return;
  el.innerHTML = `
    <strong>${bookingDraft.roomName}</strong><br>
    ${bookingDraft.checkIn} → ${bookingDraft.checkOut} (${bookingDraft.nights} night${bookingDraft.nights > 1 ? "s" : ""})<br>
    Total: ₹${bookingDraft.total.toLocaleString("en-IN")}
  `;
}

// ---- Step 4: Payment (stub — wire up your gateway here) ----
const payButton = document.querySelector("#confirm-payment");
payButton?.addEventListener("click", async () => {
  // Replace this with your payment gateway's checkout call (Razorpay/Stripe/etc).
  // On success, store the booking in Firestore:
  if (db) {
    await db.collection("bookings").add({
      ...bookingDraft,
      status: "confirmed",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
  showStep("confirmation");
});

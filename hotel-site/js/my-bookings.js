/*
  My Bookings page controller.
  ------------------------------------------------------------------
  Depends on js/shared.js (auth, db, calculateRefund).

  DEMO MODE: until Firebase is actually configured in shared.js,
  `auth` and `db` stay null, so this page shows sample bookings
  instead of a real sign-in — that way the cancel/refund flow is
  visible and testable before Firebase is wired up.

  TO GO LIVE: once shared.js has a real Firebase config, this file
  needs no changes — DEMO_MODE automatically turns off, sign-in uses
  real Firebase Auth, and bookings load from Firestore.
  ------------------------------------------------------------------
*/

const DEMO_MODE = !(auth && db);

const demoNotice = document.querySelector("#demo-notice");
const signinPanel = document.querySelector("#signin-panel");
const bookingsPanel = document.querySelector("#bookings-panel");
const bookingsList = document.querySelector("#bookings-list");
const signinForm = document.querySelector("#signin-form");
const signinError = document.querySelector("#signin-error");
const signupForm = document.querySelector("#signup-form");
const signupError = document.querySelector("#signup-error");
const authToggleBtns = document.querySelectorAll(".auth-toggle-btn");

if (DEMO_MODE && demoNotice) demoNotice.style.display = "block";

/* ---- Sign In / Create Account toggle ---- */
authToggleBtns.forEach((btn) =>
  btn.addEventListener("click", () => {
    authToggleBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const isSignup = btn.dataset.mode === "signup";
    signinForm.style.display = isSignup ? "none" : "block";
    signupForm.style.display = isSignup ? "block" : "none";
  })
);

// Sample bookings shown only in demo mode. Once Firestore is connected,
// loadRealBookings() below replaces this with the signed-in guest's
// actual bookings.
let bookings = [
  { id: "demo1", roomName: "The Deluxe", checkIn: "2026-09-25", checkOut: "2026-09-27", nights: 2, total: 18400, status: "confirmed" },
  { id: "demo2", roomName: "The Standard", checkIn: "2026-08-10", checkOut: "2026-08-11", nights: 1, total: 6500, status: "confirmed" },
];

signinForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.querySelector("#signin-email").value.trim();
  const password = document.querySelector("#signin-password").value;

  if (DEMO_MODE) {
    showBookingsPanel();
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    await loadRealBookings(email);
    showBookingsPanel();
  } catch (err) {
    signinError.textContent = getFriendlyAuthError(err);
    signinError.classList.add("show");
  }
});

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.querySelector("#signup-name").value.trim();
  const email = document.querySelector("#signup-email").value.trim();
  const password = document.querySelector("#signup-password").value;

  if (DEMO_MODE) {
    showBookingsPanel();
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    if (db) {
      await db.collection("guests").doc(cred.user.uid).set({ name, email });
    }
    bookings = []; // brand-new account — no bookings yet
    showBookingsPanel();
  } catch (err) {
    signupError.textContent = getFriendlyAuthError(err);
    signupError.classList.add("show");
  }
});

async function loadRealBookings(email) {
  const snap = await db.collection("bookings").where("email", "==", email).get();
  bookings = [];
  snap.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() }));
}

function showBookingsPanel() {
  signinPanel.style.display = "none";
  bookingsPanel.style.display = "block";
  renderBookings();
}

function renderBookings() {
  if (bookings.length === 0) {
    bookingsList.innerHTML = "<p>No bookings yet.</p>";
    return;
  }

  bookingsList.innerHTML = bookings
    .map(
      (b) => `
    <div class="booking-row">
      <div>
        <strong>${b.roomName}</strong><br>
        <span style="color:var(--ink-soft);font-size:var(--step--1)">
          ${b.checkIn} → ${b.checkOut} (${b.nights} night${b.nights > 1 ? "s" : ""}) · ₹${b.total.toLocaleString("en-IN")}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:var(--space-sm)">
        <span class="status-pill${b.status === "cancelled" ? " cancelled" : ""}">${b.status}</span>
        ${b.status === "confirmed" ? `<button class="btn btn-ghost cancel-btn" data-id="${b.id}">Cancel</button>` : ""}
      </div>
    </div>
  `
    )
    .join("");

  document.querySelectorAll(".cancel-btn").forEach((btn) =>
    btn.addEventListener("click", () => openCancelModal(btn.dataset.id))
  );
}

/* ---- Cancel modal ---- */
let cancelTargetId = null;
const cancelModal = document.querySelector("#cancel-modal");
const cancelDetails = document.querySelector("#cancel-details");
const cancelConfirmBtn = document.querySelector("#cancel-confirm-btn");

function openCancelModal(id) {
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return;

  cancelTargetId = id;
  const refund = calculateRefund(booking.checkIn, new Date(), booking.total);

  cancelDetails.innerHTML = `
    <p><strong>${booking.roomName}</strong> — ${booking.checkIn} to ${booking.checkOut}</p>
    <p style="margin-top:var(--space-sm)">
      ${refund.label}: <strong>₹${refund.amount.toLocaleString("en-IN")}</strong> of ₹${booking.total.toLocaleString("en-IN")}
    </p>
  `;
  cancelModal.classList.add("open");
}

document.querySelector("#cancel-modal-close")?.addEventListener("click", () => {
  cancelModal.classList.remove("open");
});
cancelModal?.addEventListener("click", (e) => {
  if (e.target === cancelModal) cancelModal.classList.remove("open");
});

cancelConfirmBtn?.addEventListener("click", async () => {
  const booking = bookings.find((b) => b.id === cancelTargetId);
  if (!booking) return;

  booking.status = "cancelled";

  if (!DEMO_MODE && db) {
    await db.collection("bookings").doc(booking.id).update({ status: "cancelled" });
  }

  cancelModal.classList.remove("open");
  renderBookings();
});

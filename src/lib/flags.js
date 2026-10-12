// =============================================================================
// src/lib/flags.js — single switches for owner-only decisions (README §3: "mark them in the UI code with a
// single flag or data field so they can be switched without rework"). Build-time; safe on the client too.
// =============================================================================

export const flags = Object.freeze({
  /** D18: Investment page claims (CAGR, ₹/sqft, "<20 left", calculator, "fast-tracked to Delhi NCR"…).
   *  true = build with the old copy (default for building); set false to hide them until the owner and a
   *  RERA advertising check approve publishing. */
  investmentClaims: true,
  /** D15: ERA cookie card. DG sets no cookies and has no analytics → off. */
  cookieBanner: false,
  /** D28: optional discreet footer text link "Team login" → main-sales-rg.vercel.app (removed by default). */
  teamLoginLink: false,
});

export default flags;

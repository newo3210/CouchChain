import confetti from "canvas-confetti";

const PALETTE = ["#0f172a", "#1e293b", "#475569", "#94a3b8", "#f5f5f4", "#e7e5e4"];

/** Confetti acorde a la paleta off-white / slate (p. ej. mint o Trust enviado). */
export function burstPremiumConfetti() {
  if (typeof window === "undefined") return;
  void confetti({
    particleCount: 52,
    spread: 56,
    origin: { y: 0.72 },
    colors: PALETTE,
    ticks: 115,
    gravity: 1.03,
    scalar: 0.88,
    startVelocity: 28,
  });
}

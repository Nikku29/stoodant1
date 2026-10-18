import { TIMING } from "@/config/timing";

export const SPLASH_STORAGE_KEY = "stoodant-splash";

/** How long the splash runs for each version, in ms (React removes the node after this). */
export function splashDurationMs(version: "high" | "low" | "reduced") {
  const S = TIMING.splash;
  const total = version === "reduced" ? S.reducedHold : version === "low" ? S.lowLiftAt + S.lowLift : S.liftAt + S.lift;
  return total * 1000;
}

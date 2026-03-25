/**
 * Calculates the number of lines to scroll per 10 seconds based on a slider value (0-100).
 * Uses a parabolic function fitted to:
 * - 0 => 1 line/10s
 * - 67 => 10 lines/10s
 * - 100 => 20 lines/10s
 */
export const calculateLinesPer10Seconds = (sliderValue: number): number => {
  const s = sliderValue;
  // Parabolic function: L(s) = a*s^2 + b*s + c
  return 0.001687 * s * s + 0.0214 * s + 1;
};

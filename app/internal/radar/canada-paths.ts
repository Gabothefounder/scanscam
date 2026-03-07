/**
 * Simplified Canada province/territory SVG paths.
 * viewBox: 0 0 900 520
 * Layout: territories (top), main provinces (center), Atlantic (bottom-right).
 * Designed for geographic readability with no overlap.
 */
export const CA_PROVINCE_PATHS: Record<string, string> = {
  // Territories — top band, no overlap with provinces
  YT: "M 0 0 L 200 0 L 200 70 L 0 70 Z",
  NT: "M 200 0 L 450 0 L 450 70 L 200 70 Z",
  NU: "M 450 0 L 900 0 L 900 70 L 450 70 Z",

  // Main provinces — west to east
  BC: "M 0 80 L 140 80 L 140 340 L 0 340 Z",
  AB: "M 140 80 L 270 80 L 270 300 L 140 300 Z",
  SK: "M 270 80 L 390 80 L 390 280 L 270 280 Z",
  MB: "M 390 80 L 510 80 L 510 300 L 390 300 Z",
  ON: "M 510 80 L 720 80 L 720 320 L 510 320 Z",
  QC: "M 720 80 L 900 80 L 900 340 L 720 340 Z",

  // Atlantic — bottom-right block, clearly separated, no overlap
  NB: "M 720 350 L 795 350 L 795 415 L 720 415 Z",
  NS: "M 720 415 L 795 415 L 795 520 L 720 520 Z",
  PE: "M 795 430 L 855 430 L 855 485 L 795 485 Z",
  NL: "M 855 350 L 900 350 L 900 520 L 855 520 Z",
};

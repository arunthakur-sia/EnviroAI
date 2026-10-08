// The home country of the Indices module: the one place that says which
// country every benchmark is read from. Server code imports HOME_ISO3 from
// here instead of writing the code inline. The plain-JavaScript research
// scripts under scripts/dev-probes cannot import TypeScript, so
// cr08-indices-a-lib.mjs mirrors this constant (keep the two equal).
export const HOME_ISO3 = "SAU";
export const HOME_NAME_EN = "Saudi Arabia";
export const HOME_NAME_AR = "المملكة العربية السعودية";
/** Short Arabic form used inside sentences ("السعودية"). */
export const HOME_SHORT_AR = "السعودية";

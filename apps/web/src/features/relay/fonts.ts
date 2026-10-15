import localFont from "next/font/local";

/*
 * Relay panel fonts (brand v2): the same self-hosted OFL variable fonts the Super Admin serves.
 * `preload: false`: nothing downloads until text in these families renders, which only happens
 * inside the panel (the launcher label uses the site's own font stack). CSP-safe: same origin.
 */
const manrope = localFont({
  src: "./fonts/manrope.woff2",
  variable: "--relay-font-manrope",
  weight: "200 800",
  display: "swap",
  preload: false,
});
const inter = localFont({
  src: "./fonts/inter.woff2",
  variable: "--relay-font-inter",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const jetbrains = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  variable: "--relay-font-jetbrains",
  weight: "100 800",
  display: "swap",
  preload: false,
});

export const relayFontClassName = `${manrope.variable} ${inter.variable} ${jetbrains.variable}`;

/**
 * Medición del color: contraste WCAG, claridad y croma en OKLCH, y distancia perceptual CIEDE2000.
 *
 * Vive aparte de la paleta porque no decide nada. Son las tres preguntas que se le hacen a un color
 * antes de asignárselo a algo: ¿se lee?, ¿tiene tono?, ¿se distingue del que tiene al lado? Las
 * responde igual el código que la prueba, así que se miden con la misma función y no con dos copias.
 */

function rgbDeHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

/** Pasa un canal de sRGB a luz lineal, que es donde la suma tiene sentido. */
function aLineal(canal: number): number {
  return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
}

/** Luminancia relativa (WCAG 2.2). */
export function luminancia(hex: string): number {
  const [r, g, b] = rgbDeHex(hex).map(aLineal) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste entre dos colores, de 1 (iguales) a 21 (negro sobre blanco). AA pide 4,5 en texto. */
export function contraste(a: string, b: string): number {
  const [alta, baja] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number]
  return (alta + 0.05) / (baja + 0.05)
}

/** Tono, saturación y luz en HSL, que es como se define un tono derivado en la paleta. */
export function hslDe(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgbDeHex(hex) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const luz = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l: luz * 100 }
  const saturacion = delta / (1 - Math.abs(2 * luz - 1))
  const tono =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return { h: (((tono * 60) % 360) + 360) % 360, s: saturacion * 100, l: luz * 100 }
}

function rgbAOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const [rl, gl, bl] = [aLineal(r), aLineal(g), aLineal(b)] as [number, number, number]
  const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl)
  const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl)
  const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Claridad (0 a 1), croma y tono en OKLCH. Un gris tiene croma casi cero. */
export function oklch(hex: string): { l: number; c: number; h: number } {
  const [L, a, b] = rgbAOklab(rgbDeHex(hex))
  return { l: L, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }
}

function rgbALab(hex: string): [number, number, number] {
  const [r, g, b] = rgbDeHex(hex).map(aLineal) as [number, number, number]
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [x, y, z].map(f) as [number, number, number]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/**
 * Distancia perceptual entre dos colores (CIEDE2000). Por debajo de 10 se confunden a tamaño de
 * marcador; por encima de 12 se distinguen con el color puesto al lado.
 */
export function deltaE00(uno: string, otro: string): number {
  const [L1, a1, b1] = rgbALab(uno)
  const [L2, a2, b2] = rgbALab(otro)
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const medioC = (C1 + C2) / 2
  const g = 0.5 * (1 - Math.sqrt(medioC ** 7 / (medioC ** 7 + 25 ** 7)))
  const [a1p, a2p] = [a1 * (1 + g), a2 * (1 + g)]
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const h1p = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360
  const h2p = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360
  const dL = L2 - L1
  const dC = C2p - C1p
  let dh = 0
  if (C1p * C2p !== 0) {
    dh = h2p - h1p
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360
  }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * Math.PI) / 360)
  const medioL = (L1 + L2) / 2
  const medioCp = (C1p + C2p) / 2
  let medioH = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) medioH += h1p + h2p < 360 ? 360 : -360
    medioH /= 2
  }
  const T =
    1 -
    0.17 * Math.cos(((medioH - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * medioH * Math.PI) / 180) +
    0.32 * Math.cos(((3 * medioH + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * medioH - 63) * Math.PI) / 180)
  const giro = 30 * Math.exp(-(((medioH - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(medioCp ** 7 / (medioCp ** 7 + 25 ** 7))
  const sl = 1 + (0.015 * (medioL - 50) ** 2) / Math.sqrt(20 + (medioL - 50) ** 2)
  const sc = 1 + 0.045 * medioCp
  const sh = 1 + 0.015 * medioCp * T
  const rt = -Math.sin((2 * giro * Math.PI) / 180) * rc
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh))
}

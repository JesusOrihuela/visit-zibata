/** Un identificador legible a partir de un nombre. */
export function slugDe(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // El apóstrofo se quita y no se convierte en guion: "Carl's Jr." es "carls-jr", como ya está
    // en el dataset, no "carl-s-jr".
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || `lugar-${Date.now()}`
}

/** Añade un número al final hasta que el identificador no choque. */
export function unico(base: string, existentes: Set<string>): string {
  if (!existentes.has(base)) return base
  let numero = 2
  while (existentes.has(`${base}-${numero}`)) numero += 1
  return `${base}-${numero}`
}

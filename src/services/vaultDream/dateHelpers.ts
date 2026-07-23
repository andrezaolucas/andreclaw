/**
 * AndreClaw Wave 4 (2026-07-23) — Date helpers puros pra Vault Dream.
 *
 * Todas funcoes trabalham em UTC pra evitar drift por timezone do host.
 * Semana comeca na segunda (ISO 8601).
 */

/**
 * Retorna a segunda-feira da semana da data (00:00 UTC).
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0,
    ),
  )
  const dayOfWeek = d.getUTCDay() // 0=domingo, 1=segunda, ..., 6=sabado
  // Converter pra ISO: segunda=0, domingo=6
  const isoDay = (dayOfWeek + 6) % 7
  d.setUTCDate(d.getUTCDate() - isoDay)
  return d
}

/**
 * Retorna o domingo da semana da data (23:59:59.999 UTC).
 */
export function endOfWeek(date: Date): Date {
  const monday = startOfWeek(date)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return sunday
}

/**
 * Formata data como YYYY-MM-DD (UTC).
 */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Parseia YYYY-MM-DD para Date UTC.
 */
export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  if (Number.isNaN(date.getTime())) return null
  return date
}

/**
 * Se filename comeca com YYYY-MM-DD, extrai a data. Senao retorna null.
 */
export function extractDateFromFilename(filename: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(filename)
  if (!m) return null
  return parseIsoDate(m[1])
}

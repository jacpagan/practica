export const MOBILITY_PROGRAM_NAME = 'Dragon and Tiger Qigong'

// Dogfood pilot: keep the content deliberately minimal until Dorothy validates
// the exact names, cues, dose, and sequencing. Jose already knows movements 1–5,
// so Practica can test the daily practice loop without pretending to teach them.
export const MOBILITY_MOVES = [1, 2, 3, 4, 5].map((movementNumber) => ({
  slug: `dragon-tiger-${movementNumber}`,
  title: `Movement ${movementNumber}`,
  target: 'Dragon and Tiger Qigong',
  dose: 'Practice once',
  durationSeconds: 60,
  instruction: `Practice Dragon and Tiger Movement ${movementNumber} the way Dorothy taught you.`,
  cues: ['Recall Dorothy’s teaching', 'Move with attention', 'Notice what you want to ask next time'],
}))

const localDayNumber = (date) => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  return Math.floor(Date.UTC(
    safeDate.getFullYear(),
    safeDate.getMonth(),
    safeDate.getDate(),
  ) / 86400000)
}

export const getTodayMove = (date = new Date()) => {
  const index = ((localDayNumber(date) % MOBILITY_MOVES.length) + MOBILITY_MOVES.length) % MOBILITY_MOVES.length
  return { ...MOBILITY_MOVES[index], dayNumber: index + 1, programLength: MOBILITY_MOVES.length }
}

export const getProgramMove = (startedOn, date = new Date()) => {
  const parsedStart = typeof startedOn === 'string' ? new Date(`${startedOn}T12:00:00`) : startedOn
  const elapsedDays = Math.max(0, localDayNumber(date) - localDayNumber(parsedStart))
  const index = elapsedDays % MOBILITY_MOVES.length
  return { ...MOBILITY_MOVES[index], dayNumber: index + 1, programLength: MOBILITY_MOVES.length }
}

export const localDateStamp = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const mobilityPracticeDraft = (move) => ({
  skillName: MOBILITY_PROGRAM_NAME,
  practicePrompt: move.title,
})

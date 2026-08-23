export const MOBILITY_PROGRAM_NAME = 'Everyday Mobility'

export const MOBILITY_MOVES = [
  {
    slug: 'cat-cow',
    title: 'Cat–cow',
    target: 'Spine',
    dose: '5 slow reps',
    durationSeconds: 30,
    instruction: 'Move between a gently rounded and extended spine.',
    cues: ['Hands under shoulders', 'Move with your breath', 'Stay in a pain-free range'],
  },
  {
    slug: '90-90-switches',
    title: '90/90 hip switches',
    target: 'Hips',
    dose: '5 each way',
    durationSeconds: 45,
    instruction: 'Rotate both knees side to side with control.',
    cues: ['Sit tall', 'Move slowly', 'Use your hands if needed'],
  },
  {
    slug: 'wall-slides',
    title: 'Shoulder wall slides',
    target: 'Shoulders',
    dose: '6 slow reps',
    durationSeconds: 40,
    instruction: 'Slide your arms upward without forcing the range.',
    cues: ['Keep ribs relaxed', 'Avoid shrugging', 'Stop before pain'],
  },
  {
    slug: 'butterfly',
    title: 'Butterfly',
    target: 'Inner hips',
    dose: '30 seconds',
    durationSeconds: 30,
    instruction: 'Bring the soles of your feet together and sit tall.',
    cues: ['Let knees feel heavy', 'Do not bounce', 'Breathe easily'],
  },
  {
    slug: 'open-book',
    title: 'Open book',
    target: 'Upper back',
    dose: '5 each side',
    durationSeconds: 45,
    instruction: 'Rotate your upper arm open while your knees stay together.',
    cues: ['Move from your upper back', 'Follow your hand', 'Keep it comfortable'],
  },
  {
    slug: 'hip-flexor',
    title: 'Half-kneeling hip stretch',
    target: 'Front of hips',
    dose: '30 sec each side',
    durationSeconds: 60,
    instruction: 'Shift forward slightly until the front hip feels a gentle stretch.',
    cues: ['Stay tall', 'Squeeze the back glute', 'Do not arch your back'],
  },
  {
    slug: 'sphinx',
    title: 'Sphinx',
    target: 'Front body',
    dose: '5 slow breaths',
    durationSeconds: 30,
    instruction: 'Rest on your forearms and gently lengthen your chest forward.',
    cues: ['Elbows under shoulders', 'Relax your glutes', 'Lower down if uncomfortable'],
  },
]

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

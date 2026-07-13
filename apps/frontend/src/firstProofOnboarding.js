export const DEFAULT_FIRST_PROOF_SKILLS = [
  'Pushups',
  'Gym / fitness',
  'Guitar',
  'Dance',
  'Boxing',
  'Language',
]

export const normalizeFirstProofSkill = (value = '') => String(value || '').trim()

export const canStartFirstProof = (value = '') => normalizeFirstProofSkill(value).length > 0

import React, { useEffect, useMemo, useState } from 'react'
import SkillPickerModal from './SkillPickerModal'
import {
  countCompletedToday,
  firstIncompleteSkill,
  hasProofTodayForSkill,
  latestProofTodayForSkill,
  loadDailyStack,
  saveDailyStack,
} from '../dailyStack'

export default function TodayStack({
  sessions = [],
  skillOptions = [],
  onRecordSkill,
  onOpenSession,
}) {
  const [stack, setStack] = useState(() => loadDailyStack())
  const [addingSkill, setAddingSkill] = useState(false)
  const [managing, setManaging] = useState(false)

  useEffect(() => {
    setStack(loadDailyStack())
  }, [sessions])

  const completedCount = useMemo(() => countCompletedToday(stack, sessions), [stack, sessions])
  const nextSkill = useMemo(() => firstIncompleteSkill(stack, sessions), [stack, sessions])

  const persistStack = (next) => {
    const saved = saveDailyStack(next)
    setStack(saved)
    return saved
  }

  const addSkill = (name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    persistStack([...stack, trimmed])
    setAddingSkill(false)
  }

  const removeSkill = (name) => {
    const key = String(name || '').trim().toLocaleLowerCase()
    persistStack(stack.filter((item) => item.toLocaleLowerCase() !== key))
  }

  const fillFromArchive = () => {
    if (!skillOptions.length) return
    persistStack(skillOptions.slice(0, 8))
    setManaging(false)
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Today</p>
            <h3 className="text-lg font-semibold text-gray-900 mt-1">Daily skills</h3>
            <p className="text-sm text-gray-500 mt-1">
              {stack.length
                ? `${completedCount}/${stack.length} done today`
                : 'Add the skills you want to prove today.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stack.length ? (
              <button
                type="button"
                onClick={() => setManaging((open) => !open)}
                className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                {managing ? 'Done' : 'Edit list'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setAddingSkill(true)}
              className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
            >
              Add skill
            </button>
          </div>
        </div>
        {stack.length === 0 && skillOptions.length > 0 ? (
          <button
            type="button"
            onClick={fillFromArchive}
            className="mt-3 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            Use skills from your archive
          </button>
        ) : null}
      </div>

      {stack.length === 0 ? (
        <div className="px-4 py-6 text-sm text-gray-600">
          Example: brushing teeth, drumming, flossing — one proof each, in order.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {stack.map((skillName) => {
            const done = hasProofTodayForSkill(sessions, skillName)
            const isNext = !done && skillName === nextSkill
            const latest = done ? latestProofTodayForSkill(sessions, skillName) : null
            return (
              <li key={skillName} className={`px-4 py-3 ${isNext ? 'bg-gray-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-emerald-100 text-emerald-800' : 'border border-gray-300 text-gray-500'}`}
                    aria-hidden="true"
                  >
                    {done ? '✓' : '·'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{skillName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {done ? 'Proof saved today' : isNext ? 'Up next' : 'Waiting'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {done && latest ? (
                      <button
                        type="button"
                        onClick={() => onOpenSession?.(latest)}
                        className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        View
                      </button>
                    ) : null}
                    {!done ? (
                      <button
                        type="button"
                        onClick={() => onRecordSkill?.(skillName)}
                        className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
                      >
                        Record
                      </button>
                    ) : null}
                    {managing ? (
                      <button
                        type="button"
                        onClick={() => removeSkill(skillName)}
                        className="text-xs text-red-600 hover:text-red-700 px-2 py-2"
                        aria-label={`Remove ${skillName}`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <SkillPickerModal
        open={addingSkill}
        title="Add to today"
        initialValue=""
        options={skillOptions}
        saving={false}
        onClose={() => setAddingSkill(false)}
        onSave={addSkill}
      />
    </section>
  )
}

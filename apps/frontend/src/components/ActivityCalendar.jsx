import React, { useMemo } from 'react'
import { buildActivityWeeks } from '../progressActivity'

const cellClass = (count, isFuture) => {
  if (isFuture) return 'bg-transparent'
  if (count >= 3) return 'bg-gray-900'
  if (count === 2) return 'bg-gray-600'
  if (count === 1) return 'bg-gray-400'
  return 'bg-gray-100'
}

export default function ActivityCalendar({ sessions = [] }) {
  const weeks = useMemo(() => buildActivityWeeks(sessions, 26), [sessions])
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">Activity</p>
        <p className="text-sm text-gray-500 mt-1">Each square is a day you saved proof. Darker means more proofs that day.</p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1 min-w-0">
          <div className="flex flex-col gap-1 pr-1 pt-0.5">
            {dayLabels.map((label, index) => (
              <span key={`${label}-${index}`} className="h-2.5 w-3 text-[9px] text-gray-400 leading-none flex items-center justify-end">
                {index % 2 === 1 ? label : ''}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="flex flex-col gap-1">
                {week.map((day) => (
                  <span
                    key={day.dateKey}
                    title={day.isFuture ? '' : `${day.dateKey}: ${day.count} ${day.count === 1 ? 'proof' : 'proofs'}`}
                    className={`h-2.5 w-2.5 rounded-[2px] ${cellClass(day.count, day.isFuture)}`}
                    aria-label={day.isFuture ? undefined : `${day.dateKey}, ${day.count} proofs`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        <span>Less</span>
        <span className="h-2.5 w-2.5 rounded-[2px] bg-gray-100" />
        <span className="h-2.5 w-2.5 rounded-[2px] bg-gray-400" />
        <span className="h-2.5 w-2.5 rounded-[2px] bg-gray-600" />
        <span className="h-2.5 w-2.5 rounded-[2px] bg-gray-900" />
        <span>More</span>
      </div>
    </section>
  )
}

import React from 'react'
import { fmtDate } from '../utils'

function UpdatesFeed({ items = [], onOpenSession }) {
  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Updates</h2>
          <p className="text-sm text-gray-500 mt-1">See what needs your attention and jump straight into the next useful action.</p>
        </div>

        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={`${item.kind}-${item.session.id}`}
                type="button"
                onClick={() => onOpenSession?.(item.session, 'updates')}
                className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${item.kind === 'feedback' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
                    <p className="text-xs text-gray-400 mt-2">{fmtDate(item.session.recorded_at || item.session.created_at)}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">Open</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <p className="text-sm text-gray-600">No updates right now.</p>
            <p className="text-xs text-gray-400 mt-1">When feedback arrives or a student needs review, it will show up here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default UpdatesFeed

import React, { useMemo, useState, useEffect } from 'react'
import PracticeThreadField from './PracticeThreadField'

export default function ThreadPickerModal({
  open = false,
  title = 'Add to thread',
  initialValue = '',
  options = [],
  onSave,
  onClose,
  saving = false,
  onClear = null,
  clearLabel = 'Remove from thread',
}) {
  const [value, setValue] = useState(initialValue || '')
  const [inputRef, setInputRef] = useState(null)
  useEffect(() => setValue(initialValue || ''), [initialValue])
  const normalizedOptions = useMemo(() => Array.from(new Set((options || []).filter(Boolean))), [options])
  useEffect(() => {
    if (!open) return
    try { inputRef && inputRef.focus && inputRef.focus() } catch {}
  }, [open, inputRef])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby="thread-modal-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p id="thread-modal-title" className="text-sm font-semibold text-gray-900">{title}</p>
            <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-900">Close</button>
          </div>
          <PracticeThreadField
            inputRef={setInputRef}
            value={value}
            onChange={setValue}
            options={normalizedOptions}
            placeholder="Choose or create a thread"
          />
          <div className="flex items-center justify-end gap-2">
            {onClear && String(value || '').trim() ? (
              <button type="button" onClick={() => onClear?.()} disabled={saving} className="text-xs text-red-600 hover:text-red-700">
                {clearLabel}
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="text-xs text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="button" onClick={() => onSave?.(String(value || '').trim())} disabled={saving} className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

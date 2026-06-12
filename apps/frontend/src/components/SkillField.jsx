import React, { useEffect, useMemo, useRef, useState } from 'react'

function SkillField({
  value = '',
  onChange,
  options = [],
  disabled = false,
  placeholder = 'Choose a skill or make a new one',
  inputRef = null,
}) {
  const wrapperRef = useRef(null)
  const internalInputRef = useRef(null)
  const [open, setOpen] = useState(false)

  const normalizedValue = String(value || '').trim()
  const normalizedOptions = useMemo(
    () => Array.from(new Set((options || []).map((item) => String(item || '').trim()).filter(Boolean))),
    [options],
  )

  const filteredOptions = useMemo(() => {
    if (!normalizedValue) return normalizedOptions.slice(0, 6)
    const query = normalizedValue.toLowerCase()
    return normalizedOptions
      .filter((item) => item.toLowerCase().includes(query))
      .slice(0, 6)
  }, [normalizedOptions, normalizedValue])

  const exactMatch = useMemo(
    () => normalizedOptions.some((item) => item.toLowerCase() === normalizedValue.toLowerCase()),
    [normalizedOptions, normalizedValue],
  )

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const chooseOption = (nextValue) => {
    onChange?.(String(nextValue || ''))
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      <input
        type="text"
        value={value}
        ref={(el) => {
          internalInputRef.current = el
          if (typeof inputRef === 'function') inputRef(el)
        }}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange?.(event.target.value)
          setOpen(true)
        }}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 caret-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
        placeholder={placeholder}
        autoComplete="off"
      />

      {!open || disabled ? null : (
        <div className="absolute z-20 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {filteredOptions.length > 0 ? (
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Saved skills</p>
            </div>
          ) : null}

          {filteredOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                chooseOption(option)
              }}
              className="w-full px-3 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm text-gray-900">{option}</p>
            </button>
          ))}

          {normalizedValue && !exactMatch ? (
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                chooseOption(normalizedValue)
              }}
              className="w-full px-3 py-3 text-left border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">New skill</p>
              <p className="text-sm text-gray-900 mt-1">Create “{normalizedValue}”</p>
            </button>
          ) : null}

          {!normalizedValue && filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500">Start typing to create a new skill.</div>
          ) : null}
        </div>
      )}

      {normalizedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {normalizedOptions.slice(0, 4).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => chooseOption(option)}
              disabled={disabled}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${normalizedValue === option ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default SkillField

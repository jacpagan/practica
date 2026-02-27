import React, { useState, useRef, useEffect } from 'react'
import { authHeaders } from '../auth'

function TagInput({ value = [], onChange, token, placeholder = 'Add tags...' }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)
  const headers = authHeaders(token)

  useEffect(() => {
    if (!input.trim()) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tags/?q=${encodeURIComponent(input)}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.filter(t => !value.includes(t.name)))
        }
      } catch {}
    }, 150)
    return () => clearTimeout(timer)
  }, [input])

  const addTag = (name) => {
    const trimmed = name.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInput('')
    setSuggestions([])
    inputRef.current?.focus()
  }

  const removeTag = (name) => {
    onChange(value.filter(t => t !== name))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="relative">
      <div
        className={`flex flex-wrap gap-1.5 px-2.5 py-2 border rounded-lg bg-white transition-colors min-h-[38px] ${
          focused ? 'border-gray-400' : 'border-gray-200'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-md"
          >
            {tag}
            <button
              onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 150) }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent py-0.5"
        />
      </div>

      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map(tag => (
            <button
              key={tag.id}
              onMouseDown={(e) => { e.preventDefault(); addTag(tag.name) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <span className="text-gray-900">{tag.name}</span>
              <span className="text-xs text-gray-400">{tag.session_count} sessions</span>
            </button>
          ))}
        </div>
      )}

      {/* Hint for new tag */}
      {input.trim() && suggestions.length === 0 && focused && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <button
            onMouseDown={(e) => { e.preventDefault(); addTag(input) }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            Create <span className="font-medium text-gray-900">"{input.trim()}"</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default TagInput

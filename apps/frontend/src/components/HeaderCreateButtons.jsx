import React from 'react'
import { videoFileAccept, isLikelyVideoFile } from '../utils'

export default function HeaderCreateButtons({ onRecord }) {
  const inputRef = React.useRef(null)
  const onPick = (e) => {
    const f = e.target?.files?.[0]
    e.target.value = ''
    if (!f || !isLikelyVideoFile(f)) return
    const event = new CustomEvent('practica:header-upload', { detail: { file: f } })
    window.dispatchEvent(event)
  }
  return (
    <div className="hidden sm:flex items-center gap-2">
      <button
        onClick={onRecord}
        className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
      >
        Record
      </button>
      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
      >
        Upload
      </button>
      <input ref={inputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={onPick} />
    </div>
  )
}


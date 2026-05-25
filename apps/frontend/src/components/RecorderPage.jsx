import React, { useEffect, useMemo, useRef, useState } from 'react'
import VideoRecorder from './VideoRecorder'
import SkillField from './SkillField'
import { recordRecentSeries } from '../recordPrefs'
import { buildRecentSkills } from '../recentSkills'
import { MAX_RECORDER_DURATION_SECONDS, createSessionUpload, isLikelyVideoFile, uploadErrorMessage, videoFileAccept } from '../utils'
import { useAuth } from '../auth'
import { useToast } from './Toast'

const seriesBasedTitle = (seriesName = '') => {
  const normalizedSeries = String(seriesName || '').trim()
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  if (!normalizedSeries) return `proof - ${stamp}`
  return `${normalizedSeries} - proof - ${stamp}`
}

export default function RecorderPage({
  onCancel,
  onComplete,
  practiceSeries = '',
  skillOptions = [],
  sessions = [],
}) {
  const { token } = useAuth()
  const toast = useToast()
  const contextSkill = String(practiceSeries || '').trim()
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [selectedSkill, setSelectedSkill] = useState(contextSkill)
  const [customSkill, setCustomSkill] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [saveError, setSaveError] = useState('')
  const ownedPreviewUrlRef = useRef('')
  const shouldAutoSaveRef = useRef(false)
  const timingMetadataRef = useRef(null)
  const fileInputRef = useRef(null)

  const recentSkills = useMemo(
    () => buildRecentSkills({ sessions, limit: 5 }),
    [sessions],
  )

  useEffect(() => {
    setSelectedSkill(contextSkill)
  }, [contextSkill])

  useEffect(() => () => {
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
      ownedPreviewUrlRef.current = ''
    }
  }, [])

  const resetCapture = () => {
    shouldAutoSaveRef.current = false
    setSaveError('')
    setCustomSkill('')
    setSelectedSkill(contextSkill)
    setFile(null)
    setPreviewUrl('')
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
      ownedPreviewUrlRef.current = ''
    }
  }

  const handleRecorded = (nextFile, _blobUrl, timingMetadata) => {
    timingMetadataRef.current = timingMetadata || null
    setFile(nextFile)
    setSaveError('')
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
    }
    ownedPreviewUrlRef.current = URL.createObjectURL(nextFile)
    setPreviewUrl(ownedPreviewUrlRef.current)
    shouldAutoSaveRef.current = Boolean(contextSkill)
  }

  const handlePickedFile = (event) => {
    const nextFile = event.target?.files?.[0]
    event.target.value = ''
    if (!nextFile) return
    if (!isLikelyVideoFile(nextFile)) {
      toast.error('Please choose a video file.')
      return
    }
    handleRecorded(nextFile)
  }

  const handleSave = async ({ skillName = selectedSkill, auto = false } = {}) => {
    if (!file || !token) return
    const series = String(skillName || '').trim()
    const title = seriesBasedTitle(series)
    setIsUploading(true)
    setProgress(0)
    setSaveError('')
    try {
      const res = await createSessionUpload({
        token,
        payload: {
          title,
          practice_series: series,
          description: '',
          timing_metadata: timingMetadataRef.current,
        },
        videoFile: file,
        onProgress: (p) => setProgress(p),
      })
      if (!res.ok) {
        const message = uploadErrorMessage(res)
        setSaveError(message)
        toast.error(message)
        setIsUploading(false)
        setProgress(null)
        return
      }
      if (series) recordRecentSeries(series)
      if (!auto) toast.success(series ? `Saved — ${series}` : 'Saved to your private archive')
      try { onComplete?.(res.data) } catch {}
    } catch {
      const message = 'Upload failed'
      setSaveError(message)
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  const chooseSkillAndSave = (skillName) => {
    const normalized = String(skillName || '').trim()
    setSelectedSkill(normalized)
    setCustomSkill(normalized)
    shouldAutoSaveRef.current = true
    handleSave({ skillName: normalized, auto: true })
  }

  useEffect(() => {
    if (!file || !token) return
    if (!shouldAutoSaveRef.current) return
    if (!contextSkill) return
    shouldAutoSaveRef.current = false
    handleSave({ skillName: contextSkill, auto: true })
  }, [file, token, contextSkill])

  const needsSkillTag = Boolean(file) && !contextSkill && !isUploading

  return (
    <div className="min-h-screen bg-gray-950 text-white sm:bg-white sm:text-gray-900 px-0 sm:px-6 sm:py-6">
      <main className="w-full sm:max-w-4xl sm:mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="hidden sm:block">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Record</h1>
            {contextSkill ? <p className="text-sm text-gray-500 mt-1">{contextSkill}</p> : null}
          </div>
          <button type="button" onClick={onCancel} className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-40 text-xs text-white/85 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 backdrop-blur sm:static sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none sm:text-gray-500 sm:hover:text-gray-900">Close</button>
        </div>
        {contextSkill ? (
          <p className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-40 sm:hidden text-xs text-white/90 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 backdrop-blur">
            {contextSkill}
          </p>
        ) : null}

        {!file ? (
          <div className="space-y-3">
            <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-40 sm:static sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-white/85 border border-white/25 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur hover:bg-black/55 sm:text-gray-600 sm:border-gray-200 sm:rounded-lg sm:bg-transparent sm:hover:bg-gray-50 sm:backdrop-blur-none"
              >
                Upload video
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={videoFileAccept()}
                className="hidden"
                onChange={handlePickedFile}
              />
            </div>
            <div className="overflow-hidden sm:rounded-[28px] sm:shadow-2xl sm:border sm:border-gray-200 sm:min-h-[min(88vh,calc(100dvh-5rem))]">
              <VideoRecorder
                onRecorded={(f, blobUrl, timingMetadata) => handleRecorded(f, blobUrl, timingMetadata)}
                onCancel={onCancel}
                maxDuration={MAX_RECORDER_DURATION_SECONDS}
                autoUseOnStop={true}
                minAutoUseSeconds={0}
                autoOpenOnMount={true}
              />
            </div>
          </div>
        ) : needsSkillTag ? (
          <div className="space-y-4 px-4 sm:px-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0">
            <div className="overflow-hidden bg-black sm:rounded-2xl">
              <video src={previewUrl} controls playsInline className="w-full h-[42dvh] object-cover sm:h-auto sm:aspect-video" />
            </div>
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:border-gray-200 sm:bg-white sm:text-gray-900">
              <div>
                <h2 className="text-lg font-semibold text-white sm:text-gray-900">Which skill was this?</h2>
                <p className="mt-1 text-sm text-white/70 sm:text-gray-500">Tap a recent skill or type a new one. No plan needed — just label this take.</p>
              </div>
              {recentSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recentSkills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => chooseSkillAndSave(skill)}
                      className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors sm:border-gray-200 sm:bg-gray-50 sm:text-gray-900 sm:hover:bg-gray-100"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="pb-2">
                <label className="block text-sm text-white/75 sm:text-gray-600 mb-1.5">Skill name</label>
                <SkillField
                  value={customSkill}
                  onChange={setCustomSkill}
                  options={skillOptions}
                  placeholder="Breathing, Drumming, Guitar…"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => chooseSkillAndSave(customSkill)}
                  disabled={!customSkill.trim()}
                  className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 sm:bg-gray-900"
                >
                  Save proof
                </button>
                <button type="button" onClick={resetCapture} className="text-sm text-white/80 hover:text-white sm:text-gray-600 sm:hover:text-gray-900">
                  Re-record
                </button>
                <button
                  type="button"
                  onClick={() => handleSave({ skillName: '', auto: true })}
                  className="text-sm text-white/60 hover:text-white sm:text-gray-500 sm:hover:text-gray-800"
                >
                  Save without skill
                </button>
              </div>
              {saveError ? <p className="text-sm text-red-400 sm:text-red-600">{saveError}</p> : null}
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-4 sm:px-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0">
            <div className="overflow-hidden bg-black sm:rounded-2xl">
              <video src={previewUrl} controls playsInline className="w-full h-[100dvh] object-cover sm:h-auto sm:aspect-video" />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-white/80 sm:text-gray-600">
                {isUploading ? 'Saving your proof…' : contextSkill ? `Saving under ${contextSkill}…` : 'Saving…'}
              </p>
              {saveError ? <p className="text-sm text-red-400 sm:text-red-600">{saveError}</p> : null}
              {isUploading ? (
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.max(5, progress || 0)}%` }} />
                </div>
              ) : (
                <button type="button" onClick={resetCapture} className="text-sm text-white/80 hover:text-white sm:text-gray-600 sm:hover:text-gray-900">
                  Re-record
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

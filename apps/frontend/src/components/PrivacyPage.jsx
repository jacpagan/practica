import React from 'react'

function PrivacyPage({ onBack = null, signedIn = false }) {
  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Back
          </button>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Privacy</p>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Your private proof archive</h1>
          <p className="text-sm text-gray-600">Practica is built to keep your proofs private by default. You control what gets recorded, organized, and shared.</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-900"><span className="font-medium">No third‑party trackers.</span> We only store what you submit.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">No background surveillance</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Practica does not watch, score, or track your practice in the background.</li>
              <li>No device telemetry or auto-logging of sessions.</li>
              <li>Only what you intentionally record or upload is stored.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">Device access</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Camera and microphone access is used only while the recorder is open.</li>
              <li>You control when recording starts and stops.</li>
              <li>Screen recordings are manual uploads—no background monitoring.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">What stays private</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Your videos are private by default.</li>
              <li>Nothing is publicly searchable or browsable.</li>
              <li>Access only happens through your account or links you explicitly create.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">What the platform stores</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Account identity, private videos, and workflow history needed to run the product.</li>
              <li>Minimal operational logs for uptime, errors, and debugging.</li>
              <li>Browser playback versions derived from uploaded videos.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">What the platform does not do</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>No public profiles or public feed.</li>
              <li>No ad-tech or public growth loop.</li>
              <li>No promise of full anonymity or zero-knowledge encryption.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">Control and deletion</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>You can revoke links and delete videos.</li>
              <li>Derived playback assets follow the same private access model.</li>
              <li>Operational backups may persist briefly before expiring from backup rotation.</li>
            </ul>
          </div>
        </div>

        {!signedIn ? (
          <p className="text-xs text-gray-500">Use invite-only signup if you want access to the private proof archive.</p>
        ) : null}
      </div>
    </div>
  )
}

export default PrivacyPage

import React from 'react'

function SettingsPage({ user }) {
  return (
    <div className="px-4 sm:px-6 py-6 space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
      <div className="rounded-xl border border-gray-200 p-4 space-y-2">
        <p className="text-sm text-gray-600">Email</p>
        <p className="text-sm font-medium text-gray-900">{user?.email || '—'}</p>
        <p className="text-sm text-gray-600 pt-2">Role</p>
        <p className="text-sm font-medium text-gray-900">{user?.role || 'student'}</p>
      </div>
    </div>
  )
}

export default SettingsPage

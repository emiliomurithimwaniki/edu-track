import React from 'react'

export default function LoadingOverlay({ message = 'Loading...', transparent = false }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${transparent ? '' : 'bg-white/60'} backdrop-blur-sm`}> 
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl shadow-lg bg-white border border-gray-200">
        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <p className="text-sm text-gray-700">{message}</p>
      </div>
    </div>
  )
}

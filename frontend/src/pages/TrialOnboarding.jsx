import React from 'react'
import { Link } from 'react-router-dom'

export default function TrialOnboarding() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div className="text-xl font-semibold">EduTrack Trial</div>
          <nav className="text-sm text-gray-600">
            <a href="/" className="hover:text-gray-900">Back to site</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900">Start your free 14‑day trial</h1>
          <p className="mt-3 text-gray-600">No credit card required. Get full access to academics, finance, messaging, and analytics. You can cancel anytime.</p>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 p-6 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">What you'll get</h2>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• Full access to all modules</li>
              <li>• Up to 100 students for trial</li>
              <li>• Sample data to explore</li>
              <li>• Email support</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 p-6 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">Get started</h2>
            <ol className="mt-4 space-y-3 text-sm text-gray-700 list-decimal list-inside">
              <li>Create your account or sign in</li>
              <li>Name your school and academic year</li>
              <li>Import students or use sample data</li>
            </ol>
            <div className="mt-6 flex gap-3">
              <Link to="/login" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Sign in</Link>
              <a href="mailto:EduTrack46@gmail.com?subject=EduTrack%20Trial%20Assistance" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Need help?</a>
            </div>
          </div>
        </div>

        <div className="mt-10 text-sm text-gray-500">By starting a trial, you agree to our standard terms and privacy policy.</div>
      </main>
    </div>
  )
}

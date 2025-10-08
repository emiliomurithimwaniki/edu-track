import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
// Carousel images
import img1 from '../../images/pexels-akelaphotography-448877.jpg'
import img2 from '../../images/pexels-gabby-k-6289065.jpg'
import img3 from '../../images/pexels-kwakugriffn-14554003.jpg'
import img4 from '../../images/pexels-pixabay-159213.jpg'
import img5 from '../../images/pexels-pixabay-301926.jpg'
import img6 from '../../images/pexels-roman-odintsov-11025021.jpg'

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formStep, setFormStep] = useState('role') // 'role' | 'credentials' | 'verifying'
  const [rolling, setRolling] = useState(false) // circle roll animation

  // Carousel state
  const slides = [img1, img2, img3, img4, img5, img6]
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const id = setInterval(() => {
      setCurrent((i) => (i + 1) % slides.length)
    }, 5000) // 5s per slide
    return () => clearInterval(id)
  }, [slides.length])

  const roles = [
    { key: 'admin', label: 'ADMINISTRATOR' },
    { key: 'teacher', label: 'Teacher' },
    { key: 'student', label: 'Student' },
    { key: 'finance', label: 'Finance' },
  ]

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (!role) {
      setError('Please select a role to continue')
      return
    }

    setFormStep('verifying')
    setIsLoading(true)

    try {
      const me = await login(username, password)
      const isAdminUser = me?.is_superuser || me?.is_staff || me?.role === 'admin'
      const normalizedRole = role.toLowerCase()

      // Validate selected role against user permissions/profile
      if (normalizedRole === 'admin') {
        if (!isAdminUser) {
          setError('Your account does not have Admin access')
          setFormStep('credentials')
          setIsLoading(false)
          return
        }
        nav('/admin')
        return
      }

      // Non-admin roles must match profile role
      if (!me?.role) {
        setError('No role is assigned to your account. Contact support.')
        setFormStep('credentials')
        setIsLoading(false)
        return
      }

      if (me.role.toLowerCase() !== normalizedRole) {
        setError(`Your account role is '${me.role}', not '${role}'.`)
        setFormStep('credentials')
        setIsLoading(false)
        return
      }

      // Route by selected role
      switch (normalizedRole) {
        case 'student':
          nav('/student')
          break
        case 'teacher':
          nav('/teacher')
          break
        case 'finance':
        case 'finance officer':
          nav('/finance')
          break
        default:
          nav(`/${me.role}`)
      }
    } catch (e) {
      setError('Invalid credentials')
      setFormStep('credentials')
      setIsLoading(false)
    }
  }

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole)
  }

  const handleBackToRole = () => {
    setFormStep('role')
    setUsername('')
    setPassword('')
    setError('')
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background carousel */}
      <div className="absolute inset-0">
        {slides.map((src, idx) => (
          <img
            key={src}
            src={src}
            alt="background slide"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              current === idx ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        {/* Optional: gradient at bottom for contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30 pointer-events-none" />
      </div>
      {/* Dark vignette overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Top navigation to match mockup (hidden on mobile, we'll have a simpler header there) */}
      <header className="hidden sm:flex relative z-10 items-center justify-between px-6 md:px-10 py-5 text-white">
        <div className="flex items-center gap-3">
          {/* Logo placeholder */}
          <div className="w-10 h-10 rounded-md border border-white/70" />
          <a href="#" className="hidden sm:block text-sm">Home</a>
        </div>
        <div className="text-center font-semibold tracking-widest">EDU-TRACK.COM</div>
        <a href="#" className="text-sm">Contact Us</a>
      </header>

      {/* Mobile header */}
      <div className="sm:hidden relative z-10 flex items-center justify-between px-4 py-4 text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md border border-white/70" />
          <div className="text-xs font-semibold tracking-wider">EDU-TRACK</div>
        </div>
        <a href="#" className="text-xs underline">Contact</a>
      </div>

      {/* Desktop/Tablet Panels */}
      <main className="hidden sm:block relative z-10 h-[calc(100vh-80px)] md:h-[calc(100vh-96px)]">
        {/* Role Selection Panel - left */}
        {formStep === 'role' && (
          <div className="absolute left-[-100px] md:left-[-70px] top-1/2 -translate-y-1/2">
            <div
              className="w-[520px] h-[520px] md:w-[560px] md:h-[560px] rounded-full bg-white/70 backdrop-blur-sm shadow-[0_20px_60px_rgba(0,0,0,0.25)] ring-1 ring-white/50 flex items-center"
              style={{
                transform: rolling
                  ? 'translateX(calc(100vw - 620px)) rotate(540deg)'
                  : 'translate3d(0,0,0) rotate(0deg)',
                transition: 'transform 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
              }}
            >
              <div className="w-full max-w-md pl-32 pr-8 md:pl-36">
                <h2 className="whitespace-nowrap text-3xl md:text-[34px] leading-none font-extrabold text-red-700 mb-6">Select Your Role</h2>

                <div className="space-y-4">
                  {roles.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => handleRoleSelect(r.key)}
                      className={`w-full py-3 px-6 rounded-full text-sm font-semibold tracking-wide border shadow-sm transition ${
                        role === r.key
                          ? 'bg-neutral-200 border-neutral-300 text-black shadow'
                          : 'bg-white/95 border-neutral-200 text-black hover:bg-neutral-100'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => {
                      if (!role) return
                      // kick off roll animation and then reveal credentials
                      setRolling(true)
                      setTimeout(() => {
                        setFormStep('credentials')
                        setRolling(false)
                      }, 1000)
                    }}
                    disabled={!role}
                    className="w-full py-3 rounded-full bg-red-700 hover:bg-red-800 text-white font-semibold tracking-wide disabled:opacity-60 shadow-md"
                  >
                    PROCEED
                  </button>
                </div>

                <div className="mt-4">
                  <button type="button" className="text-red-700 text-sm font-semibold">I DON'T KNOW MY ROLE</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credentials Panel - right */}
        {formStep === 'credentials' && (
          <div className="absolute right-[-100px] md:right-[-70px] top-1/2 -translate-y-1/2">
            <div className="w-[520px] h-[520px] md:w-[560px] md:h-[560px] rounded-full bg-white/70 backdrop-blur-sm shadow-[0_20px_60px_rgba(0,0,0,0.25)] ring-1 ring-white/50 flex items-center">
              <div className="w-full max-w-md ml-auto pr-32 pl-8 md:pr-36">
                <h2 className="text-3xl md:text-[34px] leading-none font-extrabold text-red-700 mb-6">LOG IN</h2>

                {error && (
                  <div className="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded-md px-3 py-2">{error}</div>
                )}

                <form onSubmit={submit} className="space-y-5">
                  {/* Username - modern floating label */}
                  <div className="relative group w-[115%] md:w-[120%]">
                    <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-red-600/30 to-red-400/30 opacity-0 group-focus-within:opacity-100 blur transition" />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-black/50">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 3.134-7 7h14c0-3.866-3.134-7-7-7z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="peer w-full rounded-full bg-white/80 backdrop-blur px-12 pr-5 py-4 text-[15px] text-black outline-none border border-black/10 shadow-sm focus:border-red-500/40 focus:bg-white transition"
                        placeholder=" "
                        required
                        aria-label="Username"
                      />
                      <label className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-black/60 transition-all duration-300 ease-out peer-focus:-translate-y-5 peer-focus:text-xs peer-focus:text-red-700 peer-not-placeholder-shown:-translate-y-5 peer-not-placeholder-shown:text-xs">
                        USERNAME
                      </label>
                    </div>
                  </div>

                  {/* Password - modern floating label */}
                  <div className="relative group w-[115%] md:w-[120%]">
                    <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-red-600/30 to-red-400/30 opacity-0 group-focus-within:opacity-100 blur transition" />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-black/50">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M17 8V7a5 5 0 10-10 0v1H5v12h14V8h-2zm-8 0V7a3 3 0 016 0v1H9z" />
                        </svg>
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="peer w-full rounded-full bg-white/80 backdrop-blur px-12 pr-14 py-4 text-[15px] text-black outline-none border border-black/10 shadow-sm focus:border-red-500/40 focus:bg-white transition"
                        placeholder=" "
                        required
                        aria-label="Password"
                      />
                      <label className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-black/60 transition-all duration-300 ease-out peer-focus:-translate-y-5 peer-focus:text-xs peer-focus:text-red-700 peer-not-placeholder-shown:-translate-y-5 peer-not-placeholder-shown:text-xs">
                        PASSWORD
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-black/60 hover:text-black transition"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-[115%] md:w-[120%] rounded-full bg-red-700 hover:bg-red-800 text-white font-semibold tracking-wide py-3.5 disabled:opacity-60 shadow-md transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {isLoading ? 'Signing In…' : 'PROCEED'}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => setFormStep('role')}
                  className="mt-4 text-sm text-black/70 underline"
                >
                  Back to role selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verifying overlay */}
        {formStep === 'verifying' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            {/* Dim/blur the background while verifying */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />

            {/* Loader card */}
            <div
              className="relative bg-white/85 backdrop-blur-md rounded-2xl px-8 py-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/50 flex flex-col items-center gap-4 animate-in fade-in duration-200"
              role="status"
              aria-busy="true"
              aria-live="polite"
            >
              {/* Spinning rings */}
              <div className="relative w-24 h-24">
                {/* outer subtle ring */}
                <div className="absolute inset-0 rounded-full border-2 border-black/10" />
                {/* primary spinner */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-600 animate-spin" />
                {/* counter-rotating accent ring */}
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-red-400 animate-spin" style={{ animationDuration: '800ms', animationDirection: 'reverse' }} />
                {/* center pulse */}
                <div className="absolute inset-[22px] rounded-full bg-red-600/20 animate-pulse" />
              </div>

              {/* Title and message */}
              <div className="text-center">
                <h3 className="text-red-700 font-extrabold tracking-wide">VERIFYING</h3>
                <p className="text-black/70 text-sm">Please wait while we check your credentials</p>
              </div>

              {/* Animated dots */}
              <div className="flex gap-1.5 items-end h-3" aria-hidden>
                <span className="w-1.5 h-1.5 rounded-full bg-red-600/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-red-600/70 animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-red-600/60 animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>

              {/* Progress bar illusion */}
              <div className="w-60 h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 via-red-400 to-red-600 animate-pulse rounded-full" style={{ width: '72%' }} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile-only content */}
      <div className="sm:hidden relative z-10 px-4 pb-10">
        <div className="max-w-md mx-auto">
          {/* Brand */}
          <div className="text-center text-white mb-5">
            <div className="font-extrabold tracking-widest">WELCOME</div>
            <div className="text-xs text-white/80">Sign in to continue</div>
          </div>

          {/* Card */}
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] ring-1 ring-white/60 p-4">
            {formStep === 'role' && (
              <div>
                <h2 className="text-lg font-bold text-red-700 mb-3">Select Your Role</h2>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(r => (
                    <button
                      key={r.key}
                      onClick={()=>handleRoleSelect(r.key)}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition ${role===r.key ? 'bg-neutral-200 border-neutral-300' : 'bg-white border-neutral-200 hover:bg-neutral-100'}`}
                    >{r.label}</button>
                  ))}
                </div>
                <button
                  onClick={()=>{ if(!role) return; setFormStep('credentials') }}
                  disabled={!role}
                  className="mt-4 w-full py-3 rounded-full bg-red-700 text-white font-semibold disabled:opacity-60"
                >Proceed</button>
                <div className="mt-2 text-[12px] text-gray-600 text-center">Need help choosing? Contact the school admin.</div>
              </div>
            )}

            {formStep === 'credentials' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-red-700">Log In</h2>
                  <button onClick={handleBackToRole} className="text-xs text-red-700 underline">Change role</button>
                </div>
                {role && (
                  <div className="mb-3 text-xs">
                    Signing in as: <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">{role}</span>
                  </div>
                )}
                {error && <div className="mb-3 text-xs text-red-700 bg-red-100 border border-red-200 rounded px-2 py-1.5">{error}</div>}
                <form onSubmit={submit} className="space-y-3">
                  <div>
                    <label className="block text-[12px] text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={e=>setUsername(e.target.value)}
                      className="w-full rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-gray-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e=>setPassword(e.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm pr-16"
                        required
                      />
                      <button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">{showPassword?'Hide':'Show'}</button>
                    </div>
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full rounded-full bg-red-700 text-white font-semibold py-2.5 disabled:opacity-60">{isLoading?'Signing In…':'Proceed'}</button>
                </form>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 text-center text-[11px] text-white/80">© {new Date().getFullYear()} EDU-TRACK</div>
        </div>
      </div>
    </div>
  )
}

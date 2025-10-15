import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import api from '../api'

const baseNavItems = [
  { to: '/teacher', label: 'Dashboard', icon: '📊' },
  // Attendance will be conditionally added based on class-teacher access
  { to: '/teacher/lessons', label: 'Lessons', icon: '🧭' },
  { to: '/teacher/grades', label: 'Grades', icon: '📝' },
  { to: '/teacher/results', label: 'Results', icon: '📈' },
  { to: '/teacher/analytics', label: 'Analytics', icon: '📊' },
  { to: '/teacher/timetable', label: 'Timetable', icon: '📆' },
  { to: '/teacher/classes', label: 'Classes', icon: '📚' },
  { to: '/teacher/messages', label: 'Messages', icon: '✉️' },
  { to: '/teacher/profile', label: 'Profile', icon: '👤' },
]

export default function TeacherLayout({ children }){
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
  const [currentTerm, setCurrentTerm] = useState(null)
  const [currentYear, setCurrentYear] = useState(null)
  const [hasAttendanceAccess, setHasAttendanceAccess] = useState(false)
  const [classTeacherClassId, setClassTeacherClassId] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => { setIsMobileOpen(false) }, [pathname])

  // Load school info for header
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/school/info/')
        if (mounted) {
          setSchoolName(data?.name || '')
          setSchoolLogo(data?.logo_url || data?.logo || '')
        }
      } catch (e) {
        if (mounted) { setSchoolName(''); setSchoolLogo('') }
      }
    })()
    return () => { mounted = false }
  }, [])

  // Poll unread messages (inbox + system)
  useEffect(() => {
    let mounted = true
    const computeUnread = (arr) => {
      const myId = user?.id
      if (!Array.isArray(arr) || !myId) return 0
      return arr.reduce((acc, m) => {
        const rec = Array.isArray(m.recipients) ? m.recipients : []
        const mine = rec.find(r => r.user === myId)
        return acc + (mine && !mine.read ? 1 : 0)
      }, 0)
    }
    const load = async () => {
      try {
        const [inb, sys] = await Promise.allSettled([
          api.get('/communications/messages/'),
          api.get('/communications/messages/system/'),
        ])
        const inboxList = inb.status === 'fulfilled' ? (Array.isArray(inb.value.data) ? inb.value.data : (inb.value.data?.results || [])) : []
        const sysList = sys.status === 'fulfilled' ? (Array.isArray(sys.value.data) ? sys.value.data : (sys.value.data?.results || [])) : []
        const total = computeUnread(inboxList) + computeUnread(sysList)
        if (mounted) setUnreadCount(total)
      } catch {
        if (mounted) setUnreadCount(0)
      }
    }
    load()
    const id = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [user])

  // Decide if user is a class teacher to show Attendance
  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try{
        const [meRes, clsRes] = await Promise.all([
          api.get('/auth/me/').catch(()=>({ data:null })),
          api.get('/academics/classes/mine/').catch(()=>({ data:[] })),
        ])
        if (!mounted) return
        const meId = String(meRes?.data?.id || '')
        const classes = Array.isArray(clsRes?.data)? clsRes.data : []
        const mine = classes.find(c => {
          const tid = c?.teacher
          const tdet = c?.teacher_detail
          const candIds = [
            tid,
            tdet?.id,
            tdet?.user?.id,
          ].map(v=> (v==null? '' : String(v)))
          return candIds.includes(meId)
        })
        setHasAttendanceAccess(!!mine)
        setClassTeacherClassId(mine ? String(mine.id) : '')
      }catch{ if(mounted){ setHasAttendanceAccess(false); setClassTeacherClassId('') } }
    })()
    return ()=>{ mounted=false }
  }, [])

  // Load current term/year with graceful fallbacks
  useEffect(() => {
    let mounted = true
    const safeSet = (setter, val) => { if (mounted) setter(val) }
    ;(async () => {
      try {
        // Try "current" endpoints first
        let year = null
        let term = null
        try {
          const yr = await api.get('/academics/academic_years/current/')
          year = yr.data
        } catch {}
        try {
          const tr = await api.get('/academics/terms/current/')
          term = tr.data
        } catch {}

        // Fallback to mine/first available year
        if (!year) {
          try {
            const mine = await api.get('/academics/academic_years/mine/')
            const list = Array.isArray(mine.data?.results) ? mine.data.results : (Array.isArray(mine.data)? mine.data : [])
            year = list[0] || null
          } catch {}
        }

        // Fallback: get terms of current year from backend helper (teacher-authorized)
        if (!term) {
          try {
            const t = await api.get('/academics/terms/of-current-year/')
            const arr = Array.isArray(t.data?.results) ? t.data.results : (Array.isArray(t.data)? t.data : [])
            term = arr.find(x=>x.is_current) || arr.sort((a,b)=> (a.number||0)-(b.number||0))[0] || null
          } catch {}
        }

        safeSet(setCurrentYear, year || null)
        safeSet(setCurrentTerm, term || null)
      } catch (e) {
        safeSet(setCurrentYear, null)
        safeSet(setCurrentTerm, null)
      }
    })()
    return () => { mounted = false }
  }, [])

  const sidebarBase = isOpen ? 'w-64' : 'w-16'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar - refreshed style */}
      <header className="sticky top-0 z-30 bg-white text-gray-900 px-3 md:px-4 h-14 flex items-center gap-2 md:gap-3 shadow-sm border-b border-gray-200">
        <button
          className="p-2 rounded hover:bg-gray-100 md:hidden"
          aria-label="Toggle sidebar"
          onClick={()=>setIsMobileOpen(v=>!v)}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <button
          className="p-2 rounded hover:bg-gray-100 hidden md:inline-flex"
          aria-label="Collapse sidebar"
          onClick={()=>setIsOpen(v=>!v)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M19.5 3.75a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75h15zm-9.53 3.22a.75.75 0 10-1.06 1.06l2.72 2.72-2.72 2.72a.75.75 0 101.06 1.06l3.25-3.25a.75.75 0 000-1.06l-3.25-3.25z" clipRule="evenodd" />
          </svg>
        </button>
        {/* Navigation buttons */}
        <div className="hidden md:flex items-center gap-1">
          <button
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            title="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <button
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Go forward"
            onClick={() => navigate(1)}
            title="Go forward">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="EDU-TRACK Logo" className="h-6 w-6 md:h-7 md:w-7 rounded object-contain" />
          <div className="font-bold tracking-wide text-base md:text-lg">EDU-TRACK</div>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 text-xs md:text-sm px-1 md:px-2 text-gray-700 truncate">
          {schoolLogo ? (
            <img src={schoolLogo} alt="School logo" className="h-5 w-5 md:h-6 md:w-6 object-contain rounded" />
          ) : null}
          <span className="truncate opacity-90">{schoolName || ''}</span>
          {currentTerm && currentYear && (
            <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
              Term {currentTerm.number} {currentYear.label?.split('/')?.[1] || currentYear.label}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {user && (
            <span className="text-sm hidden sm:inline text-gray-600">
              {user.first_name || user.username}
            </span>
          )}
          {/* Hide header logout on mobile; show only on md+ */}
          <button onClick={logout} className="hidden md:inline-flex px-3 py-1.5 rounded text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-soft">Logout</button>
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="relative">
        {/* Overlay for mobile */}
        {isMobileOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={()=>setIsMobileOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`fixed z-40 top-14 left-0 bottom-0 bg-slate-800 border-r border-slate-700/30 transition-all duration-200 ${sidebarBase} hidden md:flex flex-col shadow-xl`}> 
          <nav className="p-2 space-y-1 overflow-y-auto">
            {([ ...(hasAttendanceAccess? [{ to: '/teacher/attendance', label: 'Attendance', icon: '🗓️' }] : []), ...baseNavItems ]).map(i => {
              const active = pathname === i.to
              return (
                <Link key={i.to} to={i.to}
                  className={`${active
                    ? 'bg-slate-700 text-white shadow border border-slate-600/50'
                    : 'hover:bg-slate-700/60 text-slate-200 hover:text-white'
                  } flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group`}
                  title={i.label}
                >
                  <span className="text-lg w-5 text-center" aria-hidden>{i.icon}</span>
                  {isOpen && (
                    <span className="relative inline-flex items-center gap-2 text-sm font-medium truncate transition-all duration-300 group-hover:translate-x-1">
                      {i.label}
                      {i.label === 'Messages' && unreadCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto p-3 text-xs text-slate-300/80">
            {isOpen && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>© {new Date().getFullYear()} EDU-TRACK</span>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        <aside className={`fixed z-40 top-14 left-0 bottom-0 bg-slate-800 border-r border-slate-700/30 w-64 p-2 md:hidden transition-transform duration-200 shadow-2xl ${isMobileOpen? 'translate-x-0':'-translate-x-full'}`}>
          <nav className="space-y-1 overflow-y-auto">
            {([ ...(hasAttendanceAccess? [{ to: '/teacher/attendance', label: 'Attendance', icon: '🗓️' }] : []), ...baseNavItems ]).map(i => {
              const active = pathname === i.to
              return (
                <Link key={i.to} to={i.to}
                  className={`${active
                    ? 'bg-slate-700 text-white shadow border border-slate-600/50'
                    : 'hover:bg-slate-700/60 text-slate-200 hover:text-white'
                  } flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200`}
                >
                  <span className="text-lg" aria-hidden>{i.icon}</span>
                  <span className="relative inline-flex items-center gap-2 text-sm font-medium">
                    {i.label}
                    {i.label === 'Messages' && unreadCount > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </span>
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto p-3 text-xs text-slate-300/80">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>© {new Date().getFullYear()} EDU-TRACK</span>
            </div>
          </div>
        </aside>

        {/* Content area */}
        <main className={`transition-all duration-200 px-3 md:px-6 py-4 md:py-6 ${isOpen? 'md:ml-64':'md:ml-16'}`}>
          {children}
        </main>
      </div>
      {/* Floating Logout button for mobile only */}
      {(() => {
        const root = typeof document !== 'undefined' ? document.getElementById('floating-actions-root') : null
        const isSmall = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches
        if (!isSmall) return null
        const size = 44
        const iconSize = 18
        const btn = (
          <button
            onClick={logout}
            aria-label="Logout"
            title="Logout"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: '9999px',
              border: 'none',
              background: '#dc2626',
              color: 'white',
              boxShadow: '0 6px 14px rgba(220,38,38,0.35)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              pointerEvents: 'auto',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={iconSize} height={iconSize}>
              <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v7.5a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zm-4.657 2.843a.75.75 0 011.06 1.06 7.5 7.5 0 1010.607 0 .75.75 0 111.06-1.06 9 9 0 11-12.727 0z" clipRule="evenodd" />
            </svg>
          </button>
        )
        if (root) return createPortal(btn, root)
        return (
          <div style={{ position:'fixed', right:16, bottom:24, zIndex:2100}}>{btn}</div>
        )
      })()}
    </div>
  )
}

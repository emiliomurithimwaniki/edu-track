import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import api from '../api'

const baseNavItems = [
  { to: '/student', label: 'Dashboard', icon: '📊' },
  { to: '/student/academics', label: 'Academics', icon: '🎓' },
  { to: '/student/finance', label: 'Finance', icon: '💳' },
  { to: '/student/messages', label: 'Messages', icon: '✉️' },
]

export default function StudentLayout({ children }){
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
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

  const sidebarBase = isOpen ? 'w-64' : 'w-16'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar toggle */}
      <button className="md:hidden fixed top-3 left-3 z-50 p-2 rounded bg-white shadow border" onClick={()=>setIsMobileOpen(v=>!v)} aria-label="Toggle sidebar">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
      </button>

      {/* Sidebar + Content */}
      <div className="relative">
        {/* Overlay for mobile */}
        {isMobileOpen && (<div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={()=>setIsMobileOpen(false)} />)}

        {/* Sidebar */}
        <aside className={`fixed z-40 top-0 left-0 bottom-0 bg-slate-800 border-r border-slate-700/30 transition-all duration-200 ${sidebarBase} hidden md:flex flex-col`}>
          {/* Brand */}
          <div className="h-14 flex items-center gap-2 px-3 border-b border-slate-700/40 text-slate-100">
            <img src="/logo.jpg" alt="EDU-TRACK Logo" className="w-7 h-7 rounded object-contain" />
            {isOpen && (
              <div className="truncate">
                <div className="font-semibold">EDU-TRACK</div>
                <div className="text-[10px] opacity-80 truncate">{schoolName || ''}</div>
              </div>
            )}
          </div>
          <nav className="p-2 space-y-1 overflow-y-auto">
            {baseNavItems.map(i => {
              const active = pathname === i.to
              return (
                <Link key={i.to} to={i.to}
                  className={`${active ? 'bg-slate-700 text-white shadow border border-slate-600/50' : 'hover:bg-slate-700/60 text-slate-200 hover:text-white'} flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group`}
                  title={i.label}
                >
                  <span className="text-lg w-5 text-center" aria-hidden>{i.icon}</span>
                  {isOpen && (
                    <span className="relative inline-flex items-center gap-2 text-sm font-medium truncate transition-all duration-300 group-hover:translate-x-1">
                      {i.label}
                      {i.label === 'Messages' && unreadCount>0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">{unreadCount>99 ? '99+' : unreadCount}</span>
                      )}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto p-3 text-xs text-slate-300/80">
            {isOpen && user && (
              <div className="mb-2 text-slate-200/90">{user.first_name || user.username}</div>
            )}
            <button onClick={logout} className="w-full px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm">Logout</button>
            {isOpen && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>© {new Date().getFullYear()} EDU-TRACK</span>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Drawer */}
        <aside className={`fixed z-40 top-0 left-0 bottom-0 bg-slate-800 border-r border-slate-700/30 w-[85%] max-w-xs p-2 md:hidden transition-transform duration-200 shadow-2xl ${isMobileOpen? 'translate-x-0':'-translate-x-full'}`}>
          <div className="h-14 flex items-center gap-2 px-2 border-b border-slate-700/40 text-slate-100">
            <img src="/logo.jpg" alt="EDU-TRACK Logo" className="w-7 h-7 rounded object-contain bg-white/10 p-0.5" />
            <div className="truncate">
              <div className="font-semibold">EDU-TRACK</div>
              <div className="text-[10px] opacity-80 truncate">{schoolName || ''}</div>
            </div>
          </div>
          <nav className="space-y-1 overflow-y-auto">
            {baseNavItems.map(i => {
              const active = pathname === i.to
              return (
                <Link key={i.to} to={i.to}
                  className={`${active ? 'bg-slate-700 text-white shadow border border-slate-600/50' : 'hover:bg-slate-700/60 text-slate-200 hover:text-white'} flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200`}
                >
                  <span className="text-lg" aria-hidden>{i.icon}</span>
                  <span className="relative inline-flex items-center gap-2 text-sm font-medium">
                    {i.label}
                    {i.label === 'Messages' && unreadCount>0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">{unreadCount>99 ? '99+' : unreadCount}</span>
                    )}
                  </span>
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto p-2">
            <button onClick={logout} className="w-full px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm">Logout</button>
          </div>
        </aside>

        {/* Content */}
        <main className={`transition-all duration-200 px-3 md:px-6 py-4 pb-16 md:py-6 ${isOpen? 'md:ml-64':'md:ml-16'}`}>
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-sm grid grid-cols-4 text-xs">
        {baseNavItems.map(i => {
          const active = pathname === i.to
          const label = i.label
          return (
            <Link key={i.to} to={i.to} className={`flex items-center justify-center gap-1 py-2 ${active? 'text-blue-600 font-medium' : 'text-gray-600'}`} onClick={()=>setIsMobileOpen(false)}>
              <span aria-hidden>{i.icon}</span>
              <span>{label}</span>
              {label === 'Messages' && unreadCount>0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] bg-red-600 text-white">{unreadCount>99?'99+':unreadCount}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

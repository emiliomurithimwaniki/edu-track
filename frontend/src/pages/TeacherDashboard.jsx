import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function TeacherDashboard(){
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [school, setSchool] = useState(null)
  const [events, setEvents] = useState([])
  const [viewMonth, setViewMonth] = useState(new Date())
  const [me, setMe] = useState(null)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        setError('')
        // pagination-aware fetcher for DRF-style endpoints
        const fetchAll = async (path)=>{
          let out = []
          let next = path
          let guard = 0
          while (next && guard < 50){
            const url = typeof next === 'string' ? next : path
            const res = await api.get(url)
            const data = res?.data
            if (Array.isArray(data)){
              // unpaginated list
              out = data
              break
            }
            if (data && Array.isArray(data.results)){
              out = out.concat(data.results)
              next = data.next
              guard++
              continue
            }
            // fallback single payload
            break
          }
          return out
        }

        const [clsAll, sch, ev, meRes] = await Promise.all([
          fetchAll('/academics/classes/mine/'),
          api.get('/auth/school/info/'),
          api.get('/communications/events/'),
          api.get('/auth/me/'),
        ])
        if (!mounted) return
        // dedupe by id and sort by name for stable display
        const deduped = Array.from(new Map((clsAll||[]).map(c=>[c.id, c])).values())
        deduped.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')))
        setClasses(deduped)
        if (sch?.data) setSchool(sch.data)
        if (ev?.data) setEvents(ev.data)
        if (meRes?.data) setMe(meRes.data)
      }catch(e){
        if (!mounted) return
        setError(e?.response?.data?.detail || e?.message || 'Failed to load classes')
      }finally{
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  },[])

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header - elevated gradient card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow">
        <div className="pointer-events-none absolute -top-10 right-0 h-40 w-40 rounded-full bg-indigo-500/10 blur-2" />
        <div className="p-5 md:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {school?.logo_url ? (
              <img src={school.logo_url} alt="School logo" className="h-12 w-12 rounded-lg bg-gray-50 p-1 object-contain border border-gray-200" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-indigo-50 flex items-center justify-center text-xl border border-indigo-100">🏫</div>
            )}
            <div>
              <div className="text-xl md:text-2xl font-bold tracking-tight">Teacher Dashboard</div>
              <div className="text-gray-600 text-sm truncate flex items-center gap-2">
                <span>{school?.name || '—'}</span>
                {school?.term && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{school.term}</span>}
              </div>
            </div>
          </div>
          <div className="text-xs md:text-sm text-gray-600">Quick actions and classes</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 items-stretch">
        <DashCard title="Classes" value={classes.length} icon="📚" to="/teacher/classes" accent="from-indigo-500 to-indigo-600"/>
        <DashCard title="Attendance" value="Mark" icon="🗓️" to="/teacher/attendance" accent="from-emerald-500 to-emerald-600"/>
        <DashCard title="Lesson Plans" value="Create" icon="🧭" to="/teacher/lessons" accent="from-fuchsia-500 to-pink-600"/>
        <DashCard title="Grades" value="Input" icon="📝" to="/teacher/grades" accent="from-amber-500 to-orange-600"/>
      </div>

      {/* Main content: Calendar left, Quick panels right on large screens */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Events Calendar" action={<Link to="/teacher/events" className="text-sm text-blue-600 hover:underline">View All →</Link>}>
            <MiniCalendar events={events} month={viewMonth} onPrev={()=>setViewMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()-1); return d })} onNext={()=>setViewMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()+1); return d })} onToday={()=>setViewMonth(new Date())} />
          </SectionCard>
        </div>
        <div className="space-y-4">
          <QuickPanel title="Lesson Plans" description="Plan upcoming lessons, objectives and activities." link="/teacher/lessons" actionLabel="Create Plan"/>
          <QuickPanel title="Profile" description="Update your info or change your password." link="/teacher/profile" actionLabel="Open Profile"/>
        </div>
      </div>

      {/* Errors/Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({length:4}).map((_,i)=>(<SkeletonCard key={i}/>))}
        </div>
      )}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200">{error}</div>}

      {/* Assigned classes */}
      <SectionCard title="Assigned Classes" action={<Link to="/teacher/classes" className="text-sm text-blue-600 hover:underline">Manage</Link>}>
        {(!classes || classes.length===0) ? (
          <EmptyState icon="📦" title="No classes yet" subtitle="Once classes are assigned, they will show up here." action={<Link to="/teacher/classes" className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Browse Classes</Link>} />
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {classes.map(c => (
              <li key={c.id} className="group border border-gray-200 rounded-xl p-3 sm:p-4 bg-white hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-gray-500">ID: {c.id}</div>
                  </div>
                  <Chip>{c.grade_level}</Chip>
                </div>
                {/* Subjects taught */}
                {getMySubjectNames(c, me).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {getMySubjectNames(c, me).slice(0,6).map(sub => (
                      <Chip key={sub}>{sub}</Chip>
                    ))}
                    {getMySubjectNames(c, me).length > 6 && (
                      <span className="text-[11px] text-gray-500">+{getMySubjectNames(c, me).length - 6} more</span>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Link to={`/teacher/classes?class=${c.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">Open<span>→</span></Link>
                  <Link to={`/teacher/attendance?class=${c.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">Attendance</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Assigned classes (full width) */}
      {/* Quick links moved to the right of calendar above on large screens */}
    </div>
  )
}

function DashCard({ title, value, to, icon, accent }){
  return (
    <Link to={to} className="group rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 flex items-center justify-between shadow-sm hover:shadow transition-all">
      <div className="flex items-center gap-3">
        <IconBox accent={accent}>{icon || '➡️'}</IconBox>
        <div>
          <div className="text-xs text-gray-600">{title}</div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
        </div>
      </div>
      <div className="text-gray-400 group-hover:translate-x-0.5 transition">→</div>
    </Link>
  )
}

function QuickPanel({ title, description, link, actionLabel }){
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between shadow-sm">
      <div>
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
      <Link to={link} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-black/90 text-sm">{actionLabel}</Link>
    </div>
  )
}

/* UI Helpers */
function SectionCard({ title, action, children }){
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="border-b px-4 py-2 flex items-center justify-between bg-gray-50/50">
        <div className="font-medium text-gray-800">{title}</div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Chip({ children }){
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">{children}</span>
}

function IconBox({ children, accent = 'from-indigo-500 to-indigo-600' }){
  return (
    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-white flex items-center justify-center text-xl bg-gradient-to-br ${accent}`}>{children}</div>
  )
}

function SkeletonCard(){
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200" />
        <div className="flex-1">
          <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon='📭', title='Nothing here', subtitle='No data to show yet.', action }){
  return (
    <div className="text-center py-8 text-gray-600">
      <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-2xl">{icon}</div>
      <div className="font-medium text-gray-800">{title}</div>
      <div className="text-sm">{subtitle}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// Try to extract subject names from various possible API shapes
function getSubjectNames(c){
  if (!c) return []
  const out = []
  const push = (v) => { if (v && String(v).trim()) out.push(String(v).trim()) }
  // arrays of subjects
  if (Array.isArray(c.subjects)){
    c.subjects.forEach(s=> push(typeof s === 'string' ? s : (s?.name || s?.title || s?.code)))
  }
  if (Array.isArray(c.subject_names)){
    c.subject_names.forEach(s=> push(s))
  }
  if (Array.isArray(c.subject_details)){
    c.subject_details.forEach(s=> push(s?.name || s?.title || s?.code))
  }
  // single subject fields
  if (c.subject) push(typeof c.subject === 'string' ? c.subject : (c.subject?.name || c.subject?.title || c.subject?.code))
  if (c.subject_detail) push(c.subject_detail?.name || c.subject_detail?.title || c.subject_detail?.code)
  // sometimes mapping may be under teacher_subjects
  if (Array.isArray(c.teacher_subjects)){
    c.teacher_subjects.forEach(ts=> push(ts?.subject_name || ts?.name || ts?.subject || ts?.code))
  }
  // dedupe
  return Array.from(new Set(out))
}

/* Mini Calendar copied/adapted from AdminDashboard */
function MiniCalendar({ events=[], month=new Date(), onPrev, onNext, onToday }){
  const startOfMonth = (d) => { const x=new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x }
  const startOfCalendarGrid = (d) => {
    const first = startOfMonth(d)
    const day = first.getDay()
    const diff = day
    const gridStart = new Date(first); gridStart.setDate(first.getDate() - diff); gridStart.setHours(0,0,0,0)
    return gridStart
  }
  const buildMonthGrid = (d) => {
    const start = startOfCalendarGrid(d)
    const days = []
    for (let i=0; i<42; i++){
      const day = new Date(start); day.setDate(start.getDate()+i)
      day.setHours(0,0,0,0)
      days.push(day)
    }
    return days
  }
  const localKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}` }
  const monthDays = buildMonthGrid(month)
  const eventsByDay = (events||[]).reduce((map, ev) => { const key = localKey(ev.start); if (!map[key]) map[key] = []; map[key].push(ev); return map }, {})
  const colorForEvent = (ev) => {
    const key = (ev?.category || ev?.audience || ev?.visibility || '').toString().toLowerCase()
    switch (true) {
      case /student/.test(key): return { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
      case /teach/.test(key): return { chip: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' }
      case /parent|guard/.test(key): return { chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
      case /exam|assessment|test/.test(key): return { chip: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' }
      case /holiday|break|vacation/.test(key): return { chip: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' }
      default: return { chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
    }
  }

  return (
    <div className="overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">{month.toLocaleString(undefined,{ month:'long', year:'numeric' })}</div>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Previous month">‹</button>
          <button onClick={onNext} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Next month">›</button>
          <button onClick={onToday} className="px-2 py-1 text-xs rounded-full border border-gray-200 hover:bg-gray-50">Today</button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-7 text-[11px] font-semibold text-gray-500 mb-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="px-1 py-1 text-center tracking-wide">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((d,i)=>{
            const key = localKey(d)
            const inMonth = d.getMonth()===month.getMonth()
            const isToday = key === localKey(new Date())
            const dayEvents = eventsByDay[key] || []
            const color = dayEvents.length>0 ? colorForEvent(dayEvents[0]) : null
            const baseBg = inMonth ? 'bg-white' : 'bg-gray-50'
            const activeBg = color ? color.chip.split(' ').find(c=>c.startsWith('bg-')) : baseBg
            return (
              <div key={i} className={`relative rounded-xl min-h-[56px] sm:min-h-[68px] p-2 text-[11px] sm:text-xs border ${inMonth? 'border-gray-200':'border-gray-200/70'} ${dayEvents.length? activeBg : baseBg} hover:border-indigo-300 hover:shadow-soft transition-all`}>
                <div className="flex items-center justify-between">
                  <div className={`${inMonth? 'text-gray-800':'text-gray-400'} text-[11px] font-semibold`}>{d.getDate()}</div>
                  {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Today</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayEvents.slice(0,2).map(ev => {
                    const c = colorForEvent(ev)
                    return (
                      <span key={ev.id} className={`px-1.5 py-0.5 rounded-full text-[10px] border truncate max-w-full ${c.chip}`} title={ev.title}>
                        {ev.title}
                      </span>
                    )
                  })}
                  {dayEvents.length>2 && <span className="text-[10px] text-gray-500">+{dayEvents.length-2} more</span>}
                </div>
                {dayEvents.length>0 && (
                  <div className="absolute bottom-1 right-2 inline-flex items-center gap-1 text-[10px] text-gray-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${color?.dot || 'bg-blue-500'}`} />
                    {dayEvents.length}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

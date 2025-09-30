import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import StatCard from '../components/StatCard'
import AdminLayout from '../components/AdminLayout'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

export default function AdminDashboard(){
  const [stats, setStats] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(()=>{ (async()=>{
    try {
      const [summaryRes, eventsRes] = await Promise.all([
        api.get('/reports/summary/'),
        api.get('/communications/events/')
      ])
      setStats(summaryRes.data)
      setEvents(eventsRes.data)
      setLoading(false)
    } catch (e) {
      setStats({ error: true })
      setLoading(false)
    }
  })() },[])

  const handleQuickAction = (action) => {
    switch(action) {
      case 'addStudent':
        navigate('/admin/students')
        break
      case 'addTeacher':
        navigate('/admin/teachers')
        break
      case 'createExam':
        navigate('/admin/exams')
        break
      case 'viewReports':
        navigate('/admin/reports')
        break
      case 'schoolSettings':
        navigate('/admin/school')
        break
      case 'userManagement':
        navigate('/admin/users')
        break
      default:
        break
    }
  }

  // Events Calendar helpers
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

  const [viewMonth, setViewMonth] = useState(new Date())
  const currentMonth = viewMonth
  const monthDays = buildMonthGrid(currentMonth)
  // helper to get YYYY-MM-DD in local time (avoids UTC shift)
  const localKey = (d) => {
    const dt = new Date(d)
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
  }
  const eventsByDay = events.reduce((map, ev) => {
    const key = localKey(ev.start)
    if (!map[key]) map[key] = []
    map[key].push(ev)
    return map
  }, {})

  // Calendar color helpers
  const colorForEvent = (ev) => {
    const key = (ev?.category || ev?.audience || ev?.visibility || '').toString().toLowerCase()
    switch (true) {
      case /student/.test(key):
        return { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
      case /teach/.test(key):
        return { chip: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' }
      case /parent|guard/.test(key):
        return { chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
      case /exam|assessment|test/.test(key):
        return { chip: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' }
      case /holiday|break|vacation/.test(key):
        return { chip: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' }
      default:
        return { chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your school.</p>
          </div>
        </div>

        {!stats ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : stats.error ? (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
            Failed to load dashboard data. Please try refreshing the page.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Students"
                value={stats.students}
                icon="👥"
                accent="from-brand-500 to-brand-600"
                animate
                format={(v)=>v.toLocaleString()}
                trend={0}
              />
              <StatCard
                title="Teachers"
                value={stats.teachers}
                icon="👨‍🏫"
                accent="from-purple-500 to-purple-600"
                animate
                format={(v)=>v.toLocaleString()}
                trend={stats?.trends?.teachers ?? 0}
              />
              <StatCard
                title="Classes"
                value={stats.classes}
                icon="🏫"
                accent="from-emerald-500 to-emerald-600"
                animate
                format={(v)=>v.toLocaleString()}
                trend={stats?.trends?.classes ?? 0}
              />
              <StatCard
                title="Attendance Rate"
                value={Number(stats.attendanceRate) || 0}
                icon="📊"
                accent="from-amber-500 to-orange-600"
                animate
                format={(v)=>`${v}%`}
                trend={stats?.trends?.attendance ?? 0}
              />
            </div>

            {/* Quick Actions */}
            <div className="relative overflow-hidden rounded-2xl shadow-elevated p-5 text-white bg-gradient-to-r from-brand-600 via-indigo-600 to-fuchsia-600">
              {/* subtle top-right glow */}
              <div className="pointer-events-none absolute -top-8 right-0 w-40 h-40 rounded-full bg-white/20 blur-2 opacity-20" />
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold tracking-tight">Quick Actions</h2>
                <span className="text-xs/5 bg-white/15 border border-white/20 px-2 py-1 rounded-full hidden sm:inline">Fast shortcuts</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <button
                  onClick={() => handleQuickAction('addStudent')}
                  className="group rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 text-center transition-all duration-200 hover:-translate-y-0.5 shadow-soft"
                  aria-label="Add Student"
                >
                  <div className="mx-auto mb-2 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-lg">➕</div>
                  <div className="text-xs font-medium">Add Student</div>
                </button>
                <button
                  onClick={() => handleQuickAction('addTeacher')}
                  className="group rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 text-center transition-all duration-200 hover:-translate-y-0.5 shadow-soft"
                  aria-label="Add Teacher"
                >
                  <div className="mx-auto mb-2 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-lg">👨‍🏫</div>
                  <div className="text-xs font-medium">Add Teacher</div>
                </button>
                <button
                  onClick={() => handleQuickAction('createExam')}
                  className="group rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 text-center transition-all duration-200 hover:-translate-y-0.5 shadow-soft"
                  aria-label="Create Exam"
                >
                  <div className="mx-auto mb-2 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-lg">📝</div>
                  <div className="text-xs font-medium">Create Exam</div>
                </button>
                <button
                  onClick={() => handleQuickAction('viewReports')}
                  className="group rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 text-center transition-all duration-200 hover:-translate-y-0.5 shadow-soft"
                  aria-label="View Reports"
                >
                  <div className="mx-auto mb-2 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-lg">📊</div>
                  <div className="text-xs font-medium">View Reports</div>
                </button>
                <button
                  onClick={() => handleQuickAction('schoolSettings')}
                  className="group rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 text-center transition-all duration-200 hover:-translate-y-0.5 shadow-soft"
                  aria-label="School Settings"
                >
                  <div className="mx-auto mb-2 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-lg">🏫</div>
                  <div className="text-xs font-medium">School Settings</div>
                </button>
                <button
                  onClick={() => handleQuickAction('userManagement')}
                  className="group rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 text-center transition-all duration-200 hover:-translate-y-0.5 shadow-soft"
                  aria-label="User Management"
                >
                  <div className="mx-auto mb-2 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-lg">👥</div>
                  <div className="text-xs font-medium">User Management</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Finance Overview</h2>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    (stats?.trends?.feesCollected ?? 0) > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : (stats?.trends?.feesCollected ?? 0) < 0
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {(stats?.trends?.feesCollected ?? 0) > 0 ? '▲' : (stats?.trends?.feesCollected ?? 0) < 0 ? '▼' : '▲'} {Math.abs(Math.round(stats?.trends?.feesCollected ?? 0))}% vs last month
                  </span>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-100 bg-emerald-50/60 w-full max-w-full">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xl">💰</div>
                    <div className="min-w-0 max-w-full">
                      <div className="text-xs text-emerald-700 font-medium">Collected</div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-600">KES</div>
                      <div className="text-base sm:text-lg font-bold text-gray-900 leading-tight whitespace-normal break-words">{stats.fees.collected.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 w-full max-w-full">
                    <div className="w-10 h-10 rounded-lg bg-gray-600 text-white flex items-center justify-center text-xl">📄</div>
                    <div className="min-w-0 max-w-full">
                      <div className="text-xs text-gray-700 font-medium">Total Billed</div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-600">KES</div>
                      <div className="text-base sm:text-lg font-bold text-gray-900 leading-tight whitespace-normal break-words">{stats.fees.total.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-100 bg-rose-50/60 w-full max-w-full">
                    <div className="w-10 h-10 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xl">⚠️</div>
                    <div className="min-w-0 max-w-full">
                      <div className="text-xs text-rose-700 font-medium">Outstanding</div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-600">KES</div>
                      <div className="text-base sm:text-lg font-bold text-gray-900 leading-tight whitespace-normal break-words">{stats.fees.outstanding.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Collection Progress */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>Collection Rate</span>
                    <span className="font-semibold text-gray-800">{stats.fees.collectionRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" style={{width: `${Math.min(100, Math.max(0, Number(stats.fees.collectionRate)||0))}%`}} />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">Invoices: {stats.fees.invoices} • Paid: {stats.fees.paidInvoices}</div>
                </div>

                {/* Mini sparkline removed per request */}

                {/* Monthly Bar Chart */}
                {Array.isArray(stats.feesTrend) && stats.feesTrend.length>0 && (
                  <div>
                    <Bar height={120}
                      data={{
                        labels: stats.feesTrend.map(i=>i.month),
                        datasets: [{
                          label: 'Fees Collected',
                          data: stats.feesTrend.map(i=>i.collected),
                          backgroundColor: 'rgba(59, 130, 246, 0.8)',
                          borderColor: 'rgba(59, 130, 246, 1)',
                          borderWidth: 2,
                          borderRadius: 8,
                          borderSkipped: false,
                        }]
                      }}
                      options={{
                        responsive:true,
                        plugins:{ legend:{ display:false } },
                        scales: {
                          x: { grid: { display: false }, ticks: { color: '#6b7280' } },
                          y: { grid: { color: '#e5e7eb' }, ticks: { color: '#6b7280' } }
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Events Calendar</h2>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:block text-sm text-gray-600 mr-2">
                      {currentMonth.toLocaleString(undefined,{ month:'long', year:'numeric' })}
                    </div>
                    <button onClick={()=>setViewMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()-1); return d })} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Previous month">
                      ‹
                    </button>
                    <button onClick={()=>setViewMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()+1); return d })} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Next month">
                      ›
                    </button>
                    <button onClick={()=>setViewMonth(new Date())} className="px-2 py-1 text-xs rounded-full border border-gray-200 hover:bg-gray-50">Today</button>
                    <button
                      onClick={() => navigate('/admin/events')}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All →
                    </button>
                  </div>
                </div>

                {/* Modern Mini Calendar */}
                <div className="space-y-3">
                  <div className="grid grid-cols-7 text-[11px] font-semibold text-gray-500 mb-2">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="px-1 py-1 text-center tracking-wide">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthDays.map((d,i)=>{
                      const key = localKey(d)
                      const inMonth = d.getMonth()===currentMonth.getMonth()
                      const isToday = key === localKey(new Date())
                      const dayEvents = eventsByDay[key] || []
                      const color = dayEvents.length>0 ? colorForEvent(dayEvents[0]) : null
                      const baseBg = inMonth ? 'bg-white' : 'bg-gray-50'
                      const activeBg = color ? color.chip.split(' ').find(c=>c.startsWith('bg-')) : baseBg
                      return (
                        <div key={i} className={`relative rounded-xl min-h-[68px] p-2 text-xs border ${inMonth? 'border-gray-200':'border-gray-200/70'} ${dayEvents.length? activeBg : baseBg} hover:border-brand-300 hover:shadow-soft transition-all`}> 
                          <div className="flex items-center justify-between">
                            <div className={`${inMonth? 'text-gray-800':'text-gray-400'} text-[11px] font-semibold`}>{d.getDate()}</div>
                            {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">Today</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {dayEvents.slice(0,3).map(ev => {
                              const c = colorForEvent(ev)
                              return (
                              <span key={ev.id} className={`px-1.5 py-0.5 rounded-full text-[10px] border truncate max-w-full ${c.chip}`} title={ev.title}>
                                {ev.title}
                              </span>)
                            })}
                            {dayEvents.length>3 && <span className="text-[10px] text-gray-500">+{dayEvents.length-3} more</span>}
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

                {/* Upcoming Events List */}
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Upcoming Events</h3>
                  <div className="space-y-2">
                    {events
                      .filter(ev => new Date(ev.start) >= new Date())
                      .sort((a,b) => new Date(a.start) - new Date(b.start))
                      .slice(0,5)
                      .map(ev => (
                        <div key={ev.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{ev.title}</div>
                            <div className="text-xs text-gray-600">
                              {new Date(ev.start).toLocaleDateString()} {ev.location && `• ${ev.location}`}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{ev.audience}</span>
                        </div>
                      ))}
                    {events.filter(ev => new Date(ev.start) >= new Date()).length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">No upcoming events</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

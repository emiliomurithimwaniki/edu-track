import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

function groupByDate(events){
  const by = {}
  for (const e of events) {
    const key = new Date(e.start).toISOString().slice(0,10)
    if (!by[key]) by[key] = []
    by[key].push(e)
  }
  const keys = Object.keys(by).sort()
  return keys.map(k => [k, by[k].sort((a,b)=> new Date(a.start) - new Date(b.start))])
}

function startOfMonth(d){ const x=new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x }
function startOfCalendarGrid(d){
  const first = startOfMonth(d)
  const day = first.getDay() // 0 Sun .. 6 Sat
  const diff = day
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - diff); gridStart.setHours(0,0,0,0)
  return gridStart
}
function buildMonthGrid(d){
  const start = startOfCalendarGrid(d)
  const days = []
  for (let i=0; i<42; i++){
    const day = new Date(start); day.setDate(start.getDate()+i)
    day.setHours(0,0,0,0)
    days.push(day)
  }
  return days
}

export default function TeacherEvents(){
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar'
  const [month, setMonth] = useState(()=>{ const d=new Date(); d.setDate(1); return d })
  const [query, setQuery] = useState('')
  const [audience, setAudience] = useState('all')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get('/communications/events/')
      setEvents(Array.isArray(data)? data : (data?.results || []))
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  const filtered = useMemo(()=>{
    let list = events
    if (audience !== 'all') list = list.filter(e=> String(e.audience||'').toLowerCase() === audience)
    if (query.trim()){
      const q = query.toLowerCase()
      list = list.filter(e=>
        String(e.title||'').toLowerCase().includes(q) ||
        String(e.description||'').toLowerCase().includes(q) ||
        String(e.location||'').toLowerCase().includes(q)
      )
    }
    return list
  }, [events, audience, query])

  const grouped = useMemo(()=> groupByDate(filtered), [filtered])
  const monthDays = useMemo(()=> buildMonthGrid(month), [month])
  const eventsByDay = useMemo(()=>{
    const map = {}
    for (const ev of filtered){
      const key = new Date(ev.start).toISOString().slice(0,10)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">School Events</h1>
        <div className="flex items-center gap-2 ml-auto">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search" className="border rounded px-2 py-1 text-sm" />
          <select value={audience} onChange={e=>setAudience(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="all">All</option>
            <option value="students">Students</option>
            <option value="teachers">Teachers</option>
            <option value="parents">Parents</option>
            <option value="staff">Staff</option>
          </select>
          <button onClick={()=>setViewMode(v=> v==='list' ? 'calendar' : 'list')} className="px-3 py-2 rounded border text-sm">
            {viewMode==='list' ? 'Calendar View' : 'List View'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}

      {viewMode==='calendar' && (
        <div className="bg-white rounded shadow p-3">
          <div className="flex items-center justify-between mb-2">
            <button className="px-2 py-1 rounded border" onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()-1, 1))}>Prev</button>
            <div className="text-sm font-medium w-36 text-center">{month.toLocaleString(undefined, { month: 'long', year: 'numeric'})}</div>
            <button className="px-2 py-1 rounded border" onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()+1, 1))}>Next</button>
          </div>
          <div className="grid grid-cols-7 text-xs font-medium text-gray-500 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((d,i)=>{
              const key = d.toISOString().slice(0,10)
              const inMonth = d.getMonth()===month.getMonth()
              const items = eventsByDay[key] || []
              return (
                <div key={i} className={`border rounded min-h-[88px] p-1 ${inMonth? 'bg-white':'bg-gray-50'}`}>
                  <div className={`text-xs mb-1 ${inMonth? 'text-gray-700':'text-gray-400'}`}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {items.slice(0,3).map(ev => (
                      <div key={ev.id} className="text-xs truncate px-1 py-0.5 rounded bg-blue-50 text-blue-700" title={ev.title}>
                        {ev.title}
                      </div>
                    ))}
                    {items.length>3 && <div className="text-[10px] text-gray-500">+{items.length-3} more</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow divide-y" style={{ display: viewMode==='list' ? 'block' : 'none' }}>
        {loading && <div className="p-4 text-sm text-gray-600">Loading...</div>}
        {!loading && grouped.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm">No events yet</div>
        )}
        {!loading && grouped.map(([date, items]) => (
          <div key={date} className="p-4">
            <div className="text-xs text-gray-500 mb-2">{date}</div>
            <div className="space-y-2">
              {items.map(ev => (
                <div key={ev.id} className="border rounded p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-xs text-gray-600 truncate">
                      {ev.all_day ? 'All day' : `${new Date(ev.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${new Date(ev.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                    </div>
                    {ev.location && <div className="text-xs text-gray-600 truncate">📍 {ev.location}</div>}
                    {ev.description && <div className="text-xs text-gray-600 truncate">{ev.description}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{ev.audience}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{ev.visibility}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

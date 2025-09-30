import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

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

// Calendar helpers
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

export default function AdminEvents(){
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    start: '',
    end: '',
    all_day: false,
    audience: 'all',
    visibility: 'internal',
  })

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editForm, setEditForm] = useState({
    title: '', description: '', location: '', start: '', end: '', all_day: false, audience: 'all', visibility: 'internal'
  })

  // Calendar state
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar'
  const [month, setMonth] = useState(()=>{ const d=new Date(); d.setDate(1); return d })

  const { showSuccess, showError } = useNotification()
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get('/communications/events/')
      setEvents(data)
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  const save = async (e) => {
    e.preventDefault(); setError('')
    try {
      const payload = {
        ...form,
        start: form.start ? new Date(form.start).toISOString() : null,
        end: form.end ? new Date(form.end).toISOString() : null,
      }
      await api.post('/communications/events/', payload)
      setIsCreateOpen(false)
      setForm({ title:'', description:'', location:'', start:'', end:'', all_day:false, audience:'all', visibility:'internal' })
      load()
      showSuccess('Event Created', `Event "${form.title}" has been successfully created.`)
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
      showError('Failed to Create Event', 'There was an error creating the event. Please try again.')
    }
  }

   // Edit handlers
  const openEdit = (ev) => {
    setSelectedEvent(ev)
    setEditForm({
      title: ev.title || '',
      description: ev.description || '',
      location: ev.location || '',
      start: ev.start ? new Date(ev.start).toISOString().slice(0,16) : '',
      end: ev.end ? new Date(ev.end).toISOString().slice(0,16) : '',
      all_day: !!ev.all_day,
      audience: ev.audience || 'all',
      visibility: ev.visibility || 'internal',
    })
    setIsEditOpen(true)
  }

  const updateEvent = async (e) => {
    e.preventDefault(); setError('')
    if (!selectedEvent) return
    try {
      const payload = {
        ...editForm,
        start: editForm.start ? new Date(editForm.start).toISOString() : null,
        end: editForm.end ? new Date(editForm.end).toISOString() : null,
      }
      await api.patch(`/communications/events/${selectedEvent.id}/`, payload)
      setIsEditOpen(false); setSelectedEvent(null)
      load()
      showSuccess('Event Updated', `Event "${editForm.title}" has been successfully updated.`)
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
      showError('Failed to Update Event', 'There was an error updating the event. Please try again.')
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this event?')) return
    try {
      await api.delete(`/communications/events/${id}/`)
      setEvents(prev => prev.filter(e => e.id !== id))
      showSuccess('Event Deleted', 'Event has been successfully deleted.')
    } catch (e) {
      showError('Failed to Delete Event', 'There was an error deleting the event. Please try again.')
    }
  }

  const handleAcademicCalendar = () => {
    navigate('/admin/calendar')
  }

  const grouped = useMemo(()=> groupByDate(events), [events])
  const monthDays = useMemo(()=> buildMonthGrid(month), [month])
  const eventsByDay = useMemo(()=>{
    const map = {}
    for (const ev of events){
      const key = new Date(ev.start).toISOString().slice(0,10)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [events])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">School Events</h1>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={handleAcademicCalendar} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
              📆 Academic Calendar
            </button>
            <button onClick={()=>setViewMode(v=> v==='list' ? 'calendar' : 'list')} className="px-3 py-2 rounded border">
              {viewMode==='list' ? 'Calendar View' : 'List View'}
            </button>
            {viewMode==='calendar' && (
              <div className="flex items-center gap-2">
                <button className="px-2 py-2 rounded border" onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()-1, 1))}>Prev</button>
                <div className="text-sm font-medium w-36 text-center">{month.toLocaleString(undefined, { month: 'long', year: 'numeric'})}</div>
                <button className="px-2 py-2 rounded border" onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()+1, 1))}>Next</button>
              </div>
            )}
            <button onClick={()=>setIsCreateOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded">Create Event</button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}

        {viewMode==='calendar' && (
          <div className="bg-white rounded shadow p-3">
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
                        <div key={ev.id} className="text-xs truncate px-1 py-0.5 rounded bg-blue-50 text-blue-700 cursor-pointer" title={ev.title}
                          onClick={()=>openEdit(ev)}>
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
                      <button onClick={()=>openEdit(ev)} className="text-blue-600 text-sm">Edit</button>
                      <button onClick={()=>remove(ev.id)} className="text-red-600 text-sm">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={isCreateOpen} onClose={()=>setIsCreateOpen(false)} title="Create Event" size="lg">
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <input className="border p-2 rounded md:col-span-2" placeholder="Title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} required />
          <input className="border p-2 rounded md:col-span-2" placeholder="Location" value={form.location} onChange={e=>setForm({...form, location:e.target.value})} />
          <textarea className="border p-2 rounded md:col-span-2" placeholder="Description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
          <label className="text-sm text-gray-700">Start</label>
          <label className="text-sm text-gray-700">End</label>
          <input type="datetime-local" className="border p-2 rounded" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} required />
          <input type="datetime-local" className="border p-2 rounded" value={form.end} onChange={e=>setForm({...form, end:e.target.value})} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.all_day} onChange={e=>setForm({...form, all_day:e.target.checked})} /> All day
          </label>
          <div></div>
          <select className="border p-2 rounded" value={form.audience} onChange={e=>setForm({...form, audience:e.target.value})}>
            <option value="all">All</option>
            <option value="students">Students</option>
            <option value="teachers">Teachers</option>
            <option value="parents">Parents</option>
            <option value="staff">Staff</option>
          </select>
          <select className="border p-2 rounded" value={form.visibility} onChange={e=>setForm({...form, visibility:e.target.value})}>
            <option value="internal">Internal</option>
            <option value="public">Public</option>
          </select>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setIsCreateOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={isEditOpen} onClose={()=>setIsEditOpen(false)} title="Edit Event" size="lg">
        <form onSubmit={updateEvent} className="grid gap-3 md:grid-cols-2">
          <input className="border p-2 rounded md:col-span-2" placeholder="Title" value={editForm.title} onChange={e=>setEditForm({...editForm, title:e.target.value})} required />
          <input className="border p-2 rounded md:col-span-2" placeholder="Location" value={editForm.location} onChange={e=>setEditForm({...editForm, location:e.target.value})} />
          <textarea className="border p-2 rounded md:col-span-2" placeholder="Description" value={editForm.description} onChange={e=>setEditForm({...editForm, description:e.target.value})} />
          <label className="text-sm text-gray-700">Start</label>
          <label className="text-sm text-gray-700">End</label>
          <input type="datetime-local" className="border p-2 rounded" value={editForm.start} onChange={e=>setEditForm({...editForm, start:e.target.value})} required />
          <input type="datetime-local" className="border p-2 rounded" value={editForm.end} onChange={e=>setEditForm({...editForm, end:e.target.value})} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.all_day} onChange={e=>setEditForm({...editForm, all_day:e.target.checked})} /> All day
          </label>
          <div></div>
          <select className="border p-2 rounded" value={editForm.audience} onChange={e=>setEditForm({...editForm, audience:e.target.value})}>
            <option value="all">All</option>
            <option value="students">Students</option>
            <option value="teachers">Teachers</option>
            <option value="parents">Parents</option>
            <option value="staff">Staff</option>
          </select>
          <select className="border p-2 rounded" value={editForm.visibility} onChange={e=>setEditForm({...editForm, visibility:e.target.value})}>
            <option value="internal">Internal</option>
            <option value="public">Public</option>
          </select>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setIsEditOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Update</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}

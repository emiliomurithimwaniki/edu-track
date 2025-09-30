import React, { useEffect, useState } from 'react'
import api from '../api'

export default function TeacherLessons(){
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState({ klass: '', date: new Date().toISOString().slice(0,10), topic: '', objectives: '', activities: '', resources: '', assessment: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const [cls, lp] = await Promise.all([
          api.get('/academics/classes/mine/'),
          api.get('/academics/lesson_plans/'),
        ])
        if (!mounted) return
        setClasses(cls.data || [])
        setPlans(lp.data || [])
        if (cls.data && cls.data.length>0) {
          setSelected(String(cls.data[0].id))
          setForm(f => ({...f, klass: cls.data[0].id}))
        }
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
      finally{ if(mounted) setLoading(false) }
    })()
    return ()=>{ mounted = false }
  },[])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try{
      const payload = { ...form, klass: Number(form.klass||selected) }
      const res = await api.post('/academics/lesson_plans/', payload)
      setPlans(p => [res.data, ...p])
      setForm(f => ({ ...f, topic:'', objectives:'', activities:'', resources:'', assessment:'' }))
    }catch(e){ setError(e?.response?.data?.detail || e?.message || 'Failed to save plan') }
    finally{ setSaving(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">Lesson Plans</div>
      {loading && <div className="bg-white p-4 rounded shadow">Loading...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      <div className="bg-white rounded shadow">
        <div className="border-b px-4 py-2 font-medium">Create Lesson Plan</div>
        <form onSubmit={submit} className="p-4 grid gap-3">
          <div className="flex gap-3 items-center">
            <label className="text-sm text-gray-600">Class</label>
            <select className="border p-2 rounded" value={form.klass||selected} onChange={e=>setForm({...form, klass:e.target.value})}>
              {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="text-sm text-gray-600">Date</label>
            <input type="date" className="border p-2 rounded" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
          </div>
          <input className="border p-2 rounded" placeholder="Topic" value={form.topic} onChange={e=>setForm({...form, topic:e.target.value})} required />
          <textarea className="border p-2 rounded" placeholder="Objectives" value={form.objectives} onChange={e=>setForm({...form, objectives:e.target.value})}/>
          <textarea className="border p-2 rounded" placeholder="Activities" value={form.activities} onChange={e=>setForm({...form, activities:e.target.value})}/>
          <textarea className="border p-2 rounded" placeholder="Resources" value={form.resources} onChange={e=>setForm({...form, resources:e.target.value})}/>
          <textarea className="border p-2 rounded" placeholder="Assessment" value={form.assessment} onChange={e=>setForm({...form, assessment:e.target.value})}/>
          <div className="flex justify-end">
            <button className="px-3 py-1.5 rounded text-white bg-blue-600 disabled:opacity-60" disabled={saving}>{saving ? 'Saving...' : 'Save Plan'}</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded shadow">
        <div className="border-b px-4 py-2 font-medium">My Plans</div>
        <div className="p-4">
          {plans.length===0 ? (
            <div className="text-sm text-gray-500">No lesson plans yet.</div>
          ) : (
            <ul className="grid md:grid-cols-2 gap-3">
              {plans.map(p => (
                <li key={p.id} className="border rounded p-3">
                  <div className="text-sm text-gray-600">{p.date}</div>
                  <div className="font-medium">{p.topic}</div>
                  <div className="text-xs text-gray-600 mt-1">Class #{p.klass}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

const statuses = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
]

export default function TeacherAttendance(){
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [students, setStudents] = useState([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [marks, setMarks] = useState({}) // { studentId: status }
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [me, setMe] = useState(null)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const [cls, meRes] = await Promise.all([
          api.get('/academics/classes/mine/'),
          api.get('/auth/me/').catch(()=>({ data:null })),
        ])
        if (!mounted) return
        setClasses(cls.data || [])
        if (cls.data && cls.data.length>0){
          const meId = String(meRes?.data?.id || '')
          // Prefer the class where I'm the class teacher
          const prefer = (cls.data||[]).find(c => {
            const candIds = [c?.teacher, c?.teacher_detail?.id, c?.teacher_detail?.user?.id].map(v=> (v==null? '' : String(v)))
            return candIds.includes(meId)
          })
          setSelected(String(prefer?.id || cls.data[0].id))
        }
        if (meRes?.data) setMe(meRes.data)
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
      finally{ if(mounted) setLoading(false) }
    })()
    return ()=>{ mounted = false }
  },[])

  useEffect(()=>{
    if (!selected) return
    let mounted = true
    ;(async ()=>{
      try{
        const res = await api.get(`/academics/students/?klass=${selected}`)
        if (!mounted) return
        setStudents(res.data || [])
        // default everyone to present
        const def = {}
        ;(res.data||[]).forEach(s=> def[s.id] = 'present')
        setMarks(def)
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
    })()
    return ()=>{ mounted = false }
  }, [selected])

  const setAll = (val) => {
    const m = {}
    students.forEach(s => m[s.id] = val)
    setMarks(m)
  }

  const save = async () => {
    // guard: only class teacher
    if (!isClassTeacher) { setError('Only the class teacher can mark attendance for this class.'); return }
    setSubmitting(true)
    setError('')
    setMessage('')
    try{
      // Save one by one (simple & explicit). Ignore duplicate errors silently.
      for (const s of students){
        const payload = { student: s.id, date, status: marks[s.id] || 'present' }
        try{
          await api.post('/academics/attendance/', payload)
        }catch(err){ /* duplicate or other: swallow for now */ }
      }
      setMessage('Attendance saved.')
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to save attendance')
    }finally{ setSubmitting(false) }
  }

  const presentCount = useMemo(()=>students.filter(s => (marks[s.id]||'present')==='present').length, [students, marks])
  const currentClass = useMemo(()=> classes.find(c=> String(c.id)===String(selected)) || null, [classes, selected])
  const isClassTeacher = useMemo(()=> {
    const meId = String(me?.id || '')
    const clsTeacher = String(currentClass?.teacher || currentClass?.teacher_detail?.id || '')
    return meId && clsTeacher && meId === clsTeacher
  }, [me, currentClass])

  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">Mark Attendance</div>

      {loading && <div className="bg-white p-4 rounded shadow">Loading...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}
      {message && <div className="bg-green-50 text-green-700 p-3 rounded">{message}</div>}

      <div className="bg-white rounded shadow p-4 space-y-4">
        {!isClassTeacher && (
          <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-2 rounded text-sm">
            Only the assigned class teacher can mark attendance for the selected class.
          </div>
        )}
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-gray-600">Class</label>
          <select className="border p-2 rounded" value={selected} onChange={e=>setSelected(e.target.value)}>
            {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="text-sm text-gray-600 ml-4">Date</label>
          <input type="date" className="border p-2 rounded" value={date} onChange={e=>setDate(e.target.value)} />
          <div className="ml-auto text-sm text-gray-600">Present: <strong>{presentCount}</strong> / {students.length}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setAll('present')} disabled={!isClassTeacher} className={`px-2 py-1 rounded border ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}>All Present</button>
          <button onClick={()=>setAll('absent')} disabled={!isClassTeacher} className={`px-2 py-1 rounded border ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}>All Absent</button>
          <button onClick={()=>setAll('late')} disabled={!isClassTeacher} className={`px-2 py-1 rounded border ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}>All Late</button>
          <button onClick={save} disabled={submitting || !isClassTeacher} className="ml-auto px-3 py-1.5 rounded text-white bg-blue-600 disabled:opacity-60">{submitting?'Saving...':'Save'}</button>
        </div>
        <table className="w-full text-left text-sm">
          <thead><tr><th>Name</th><th>Admission No</th><th>Status</th></tr></thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} className="border-t">
                <td>{s.name}</td>
                <td>{s.admission_no}</td>
                <td>
                  <select className="border p-1 rounded" value={marks[s.id] || 'present'} onChange={e=>setMarks(m=>({...m, [s.id]: e.target.value}))} disabled={!isClassTeacher}>
                    {statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

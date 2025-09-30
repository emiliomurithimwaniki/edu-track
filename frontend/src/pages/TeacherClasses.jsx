import React, { useEffect, useState } from 'react'
import api from '../api'

export default function TeacherClasses(){
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const cls = await api.get('/academics/classes/mine/')
        if (!mounted) return
        setClasses(cls.data || [])
        if (cls.data && cls.data.length>0) setSelected(String(cls.data[0].id))
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
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
    })()
    return ()=>{ mounted = false }
  }, [selected])

  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">My Classes</div>

      {loading && <div className="bg-white p-4 rounded shadow">Loading...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      <div className="bg-white rounded shadow p-4">
        <div className="flex gap-3 items-center mb-3">
          <label className="text-sm text-gray-600">Class</label>
          <select className="border p-2 rounded" value={selected} onChange={e=>setSelected(e.target.value)}>
            {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <table className="w-full text-left text-sm">
          <thead><tr><th>Name</th><th>Admission No</th><th>Gender</th></tr></thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} className="border-t">
                <td>{s.name}</td>
                <td>{s.admission_no}</td>
                <td className="capitalize">{s.gender}</td>
              </tr>
            ))}
            {students.length===0 && (
              <tr><td colSpan="3" className="text-gray-500 py-2">No students</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function TeacherClasses(){
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true) // initial classes load
  const [loadingStudents, setLoadingStudents] = useState(false) // per-class students load
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [gender, setGender] = useState('')
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
        const clsArr = Array.isArray(cls.data) ? cls.data : (cls.data?.results || [])
        setClasses(clsArr)
        if (clsArr && clsArr.length>0) setSelected(String(clsArr[0].id))
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
        setLoadingStudents(true)
        const res = await api.get(`/academics/students/?klass=${selected}`)
        if (!mounted) return
        const stuArr = Array.isArray(res.data) ? res.data : (res.data?.results || [])
        setStudents(stuArr)
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
      finally{ if (mounted) setLoadingStudents(false) }
    })()
    return ()=>{ mounted = false }
  }, [selected])

  const currentClass = useMemo(()=> classes.find(c=> String(c.id)===String(selected)) || null, [classes, selected])

  // Extract subject names taught by this teacher in the selected class
  const mySubjects = useMemo(()=>{
    const c = currentClass
    if (!c) return []
    const out = []
    const meId = String(me?.id || '')
    const push = (s)=>{ const n = s?.name || s?.code || s?.title; if (n) out.push(String(n)) }
    const subs = Array.isArray(c.subjects) ? c.subjects : []
    if (Array.isArray(c.subject_teachers) && c.subject_teachers.length && meId){
      const allowed = new Set(
        c.subject_teachers
          .filter(st => String(st?.teacher || st?.teacher_detail?.id || '') === meId)
          .map(st => String(st?.subject || st?.subject_id || st?.subject_detail?.id || ''))
          .filter(Boolean)
      )
      const mine = subs.filter(s => allowed.has(String(s?.id)))
      if (mine.length){ mine.forEach(push); return Array.from(new Set(out)) }
    }
    // If class teacher and no mapping, show all subjects
    if (meId && String(c?.teacher) === meId){ subs.forEach(push) }
    return Array.from(new Set(out))
  }, [currentClass, me])

  const filtered = useMemo(()=>{
    const lower = search.trim().toLowerCase()
    return students.filter(s => {
      if (gender && String(s.gender||'').toLowerCase() !== String(gender).toLowerCase()) return false
      if (!lower) return true
      return (
        String(s.name||'').toLowerCase().includes(lower) ||
        String(s.admission_no||'').toLowerCase().includes(lower)
      )
    })
  }, [students, search, gender])

  const stats = useMemo(()=>{
    const boys = filtered.filter(s => (s.gender||'').toLowerCase().startsWith('m')).length
    const girls = filtered.filter(s => (s.gender||'').toLowerCase().startsWith('f')).length
    return { total: filtered.length, boys, girls }
  }, [filtered])

  const handlePrint = () => {
    const clsName = currentClass?.name || 'Class'
    const date = new Date().toLocaleDateString()
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8" />
      <title>${clsName} - Students (${date})</title>
      <style>
        body{ font-family: Arial, sans-serif; padding:20px; }
        h1{ margin:0 0 6px; }
        .meta{ color:#555; margin-bottom:12px; }
        table{ width:100%; border-collapse:collapse; }
        th,td{ border:1px solid #ddd; padding:8px; text-align:left; }
        th{ background:#f8f8f8; }
      </style>
      </head><body>
      <h1>Students - ${clsName}</h1>
      <div class="meta">Generated: ${date} • Total: ${filtered.length} • Boys: ${stats.boys} • Girls: ${stats.girls}</div>
      <table><thead><tr><th>#</th><th>Name</th><th>Admission No</th><th>Gender</th></tr></thead>
      <tbody>
        ${filtered.map((s,i)=>`<tr><td>${i+1}</td><td>${s.name||''}</td><td>${s.admission_no||''}</td><td>${s.gender||''}</td></tr>`).join('')}
      </tbody></table>
      </body></html>
    `
    const w = window.open('', '_blank')
    w.document.write(html); w.document.close(); w.focus(); w.print()
  }

  const handleDownloadCSV = () => {
    const rows = [
      ['Name','Admission No','Gender'],
      ...filtered.map(s=> [s.name||'', s.admission_no||'', s.gender||''])
    ]
    const csv = rows.map(r=> r.map(v=> `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentClass?.name||'class'}_students_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">My Classes</div>

      {loading && (
        <div className="bg-white p-4 rounded shadow">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-8 w-full bg-gray-100 rounded" />
            <div className="h-8 w-1/2 bg-gray-100 rounded" />
            <div className="space-y-2">
              {Array.from({length:4}).map((_,i)=>(
                <div key={i} className="h-6 w-full bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      )}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      <div className="bg-white rounded-2xl shadow p-4 space-y-3 border border-gray-100">
        {/* Top toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600">Class</label>
          <select className="border p-2 rounded w-full sm:w-auto focus:ring-2 focus:ring-indigo-200" value={selected} onChange={e=>setSelected(e.target.value)} disabled={loading}>
            {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {loadingStudents && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              Loading students…
            </span>
          )}
          <div className="ml-auto grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <button onClick={()=>navigate(`/teacher/attendance?class=${selected}`)} disabled={loading || loadingStudents || !selected} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm disabled:opacity-60 w-full sm:w-auto">Mark Attendance</button>
            <button onClick={()=>navigate(`/teacher/grades?class=${selected}`)} disabled={loading || loadingStudents || !selected} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm disabled:opacity-60 w-full sm:w-auto">Enter Grades</button>
            <button onClick={()=>navigate('/teacher/messages')} disabled={loading || loadingStudents} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm disabled:opacity-60 w-full sm:w-auto">Message Class</button>
            <button onClick={handlePrint} disabled={loading || loadingStudents || filtered.length===0} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm disabled:opacity-60 w-full sm:w-auto">Print</button>
            <button onClick={handleDownloadCSV} disabled={loading || loadingStudents || filtered.length===0} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 text-white text-sm disabled:opacity-60 w-full sm:w-auto">Download CSV</button>
          </div>
        </div>

        {/* Class summary card */}
        {currentClass && (
          <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-indigo-50 via-white to-fuchsia-50 p-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600">Grade:</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{currentClass.grade_level || '-'}</span>
            <span className="text-xs text-gray-600">Stream:</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">{currentClass?.stream_detail?.name || currentClass?.stream_name || '-'}</span>
            {mySubjects.length>0 && (
              <span className="text-xs text-gray-600 ml-auto">Subjects I teach:</span>
            )}
            {mySubjects.slice(0,6).map((s,i)=>(
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{s}</span>
            ))}
            {mySubjects.length>6 && (
              <span className="text-[11px] text-gray-500">+{mySubjects.length-6} more</span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input className="border p-2 rounded w-full sm:w-56" placeholder="Search name or admission..." value={search} onChange={e=>setSearch(e.target.value)} />
          <select className="border p-2 rounded w-full sm:w-auto" value={gender} onChange={e=>setGender(e.target.value)}>
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <div className="text-xs text-gray-600 ml-auto">Total: <b>{stats.total}</b> • Boys: <b>{stats.boys}</b> • Girls: <b>{stats.girls}</b></div>
        </div>

        {/* Students list (mobile) */}
        <div className="sm:hidden -mx-1">
          {loadingStudents ? (
            <div className="space-y-2">
              {Array.from({length:6}).map((_,i)=>(
                <div key={i} className="px-2 py-2 border rounded-lg animate-pulse">
                  <div className="h-4 w-40 bg-gray-100 rounded mb-1" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(s => (
                <div key={s.id} className="px-2 py-2 border rounded-lg">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.admission_no} • {s.gender}</div>
                </div>
              ))}
              {filtered.length===0 && (
                <div className="text-gray-500 py-2 text-sm">No students</div>
              )}
            </div>
          )}
        </div>

        {/* Students table (desktop) */}
        <div className="hidden sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-sky-50 to-indigo-50">
              <tr><th className="py-2">Name</th><th className="py-2">Admission No</th><th className="py-2">Gender</th></tr>
            </thead>
            <tbody>
              {loadingStudents ? (
                Array.from({length:6}).map((_,i)=>(
                  <tr key={i} className="border-t animate-pulse">
                    <td className="py-2"><div className="h-4 w-48 bg-gray-100 rounded" /></td>
                    <td className="py-2"><div className="h-4 w-32 bg-gray-100 rounded" /></td>
                    <td className="py-2"><div className="h-4 w-16 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : (
                <>
                  {filtered.map((s,idx) => (
                    <tr key={s.id} className={`border-t ${idx%2===0? 'bg-white':'bg-gray-50'}`}>
                      <td className="py-2">{s.name}</td>
                      <td className="py-2">{s.admission_no}</td>
                      <td className="py-2 capitalize">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${String(s.gender||'').toLowerCase().startsWith('m')? 'bg-sky-50 text-sky-700 border-sky-200':'bg-pink-50 text-pink-700 border-pink-200'}`}>{s.gender}</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length===0 && (
                    <tr><td colSpan="3" className="text-gray-500 py-2">No students</td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

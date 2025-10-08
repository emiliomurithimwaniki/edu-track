import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

export default function TeacherResults(){
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [publishedExams, setPublishedExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load teacher's classes
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try{
        setLoading(true); setError('')
        const { data } = await api.get('/academics/classes/mine/')
        if (!mounted) return
        const list = Array.isArray(data) ? data : []
        setClasses(list)
        if (list.length){ setSelectedClass(String(list[0].id)) }
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load classes') }
      finally{ if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [])

  const currentClass = useMemo(() => classes.find(c => String(c.id)===String(selectedClass)) || null, [classes, selectedClass])
  const currentGrade = useMemo(() => currentClass?.grade_level || '', [currentClass])

  // Load published exams for the current grade (fallbacks included)
  useEffect(() => {
    if (!currentGrade){ setPublishedExams([]); setSelectedExam(''); return }
    let mounted = true
    ;(async () => {
      try{
        setError('')
        // Try to get all exams and then filter by class grade and published
        const fetchAll = async (url) => {
          let out = []
          let next = url
          let guard = 0
          while (next && guard < 50){
            const res = await api.get(next)
            const data = res?.data
            if (Array.isArray(data)) { out = data; break }
            if (data && Array.isArray(data.results)) { out = out.concat(data.results); next = data.next; guard++; continue }
            break
          }
          return out
        }
        const all = await fetchAll('/academics/exams/')
        // helper to resolve class id/name on exam object
        const getKlassId = (e) => String(e?.klass ?? e?.class ?? e?.klass_id ?? e?.class_id ?? '')
        const isPublished = (e) => !!(e?.published || e?.is_published || String(e?.status||'').toLowerCase()==='published')
        // keep only exams for classes matching this grade
        const examsForGrade = all.filter(e => {
          const cid = getKlassId(e)
          const cls = classes.find(c => String(c.id)===String(cid))
          return cls && String(cls.grade_level)===String(currentGrade) && isPublished(e)
        })
        // sort by date desc then id desc
        examsForGrade.sort((a,b)=>{
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          if (db !== da) return db - da
          return (b.id||0) - (a.id||0)
        })
        if (mounted){
          setPublishedExams(examsForGrade)
          setSelectedExam(examsForGrade[0]?.id ? String(examsForGrade[0].id) : '')
        }
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load exams') }
    })()
    return () => { mounted = false }
  }, [currentGrade, classes])

  // Load summary for selected exam
  useEffect(() => {
    if (!selectedExam){ setSummary(null); return }
    let mounted = true
    ;(async () => {
      try{
        setLoading(true); setError('')
        const { data } = await api.get(`/academics/exams/${selectedExam}/summary/`)
        if (mounted) setSummary(data)
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load summary') }
      finally{ if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [selectedExam])

  const classNameById = (id) => classes.find(c=>String(c.id)===String(id))?.name || id

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Results</h1>
          <div className="text-xs text-gray-600">Published exams for Grade: <b>{currentGrade || '-'}</b></div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Class
            <select className="border p-2 rounded ml-2" value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Exam
            <select className="border p-2 rounded ml-2" value={selectedExam} onChange={e=>setSelectedExam(e.target.value)}>
              <option value="">Most recent published…</option>
              {publishedExams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name} • {ex.year} • T{ex.term} • {classNameById(ex.klass)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded border border-red-200">{error}</div>}

      {!selectedExam ? (
        <div className="bg-white rounded shadow p-4 text-sm text-gray-600">No published exams found for this grade.</div>
      ) : !summary ? (
        <div className="bg-white rounded shadow p-4">Loading…</div>
      ) : (
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-700">{summary?.exam?.name || 'Exam'} • Year {summary?.exam?.year || ''} • T{summary?.exam?.term || ''}</div>
            {summary?.class_mean != null && (
              <div className="text-sm">Class Mean: <b>{summary.class_mean}</b></div>
            )}
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Position</th>
                  <th className="border px-2 py-1 text-left">Student</th>
                  {summary.subjects.map(s => (
                    <th key={s.id} className="border px-2 py-1 text-left">{s.name || s.code}</th>
                  ))}
                  <th className="border px-2 py-1 text-left">Total</th>
                  <th className="border px-2 py-1 text-left">Average</th>
                </tr>
              </thead>
              <tbody>
                {summary.students.map(st => (
                  <tr key={st.id}>
                    <td className="border px-2 py-1">{st.position}</td>
                    <td className="border px-2 py-1">{st.name}</td>
                    {summary.subjects.map(s => (
                      <td key={s.id} className="border px-2 py-1">{st.marks?.[String(s.id)] ?? '-'}</td>
                    ))}
                    <td className="border px-2 py-1 font-medium">{st.total}</td>
                    <td className="border px-2 py-1">{st.average}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

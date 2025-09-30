import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

export default function TeacherGrades(){
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [examMeta, setExamMeta] = useState({ name: 'CAT', year: new Date().getFullYear(), term: 1, date: new Date().toISOString().slice(0,10), total_marks: 100 })
  const [exams, setExams] = useState([]) // available unpublished exams for the class
  const [selectedExamId, setSelectedExamId] = useState('')
  const [marks, setMarks] = useState({}) // { student_id: number }
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [controlsOpen, setControlsOpen] = useState(true)
  const [me, setMe] = useState(null)

  const getMySubjectsFromClass = (klassObj, meObj) => {
    if (!klassObj) return []
    const all = Array.isArray(klassObj.subjects) ? klassObj.subjects : []
    if (!meObj) return all
    const myId = String(meObj.id)
    // If mapping present, intersect with it
    if (Array.isArray(klassObj.subject_teachers) && klassObj.subject_teachers.length){
      const allowedIds = new Set(
        klassObj.subject_teachers
          .filter(st => String(st?.teacher || st?.teacher_detail?.id || '') === myId)
          .map(st => String(st?.subject || st?.subject_id || st?.subject_detail?.id || ''))
          .filter(Boolean)
      )
      if (allowedIds.size){
        return all.filter(s => allowedIds.has(String(s.id)))
      }
    }
    // Fallback: if teacher is class teacher and no mapping, allow all
    if (String(klassObj.teacher) === myId) return all
    // Otherwise none
    return []
  }

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        const [cls, meRes] = await Promise.all([
          api.get('/academics/classes/mine/'),
          api.get('/auth/me/'),
        ])
        if (!mounted) return
        setClasses(cls.data || [])
        if (meRes?.data) setMe(meRes.data)
        // derive subjects from first class
        const firstClass = (cls.data||[])[0]
        if (firstClass){
          setSelectedClass(String(firstClass.id))
          const classSubjects = getMySubjectsFromClass(firstClass, meRes?.data)
          setSubjects(classSubjects)
          if (classSubjects.length>0) setSelectedSubject(String(classSubjects[0].id))
        }
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
    })()
    return ()=>{ mounted = false }
  },[])

  useEffect(()=>{
    if (!selectedClass) return
    let mounted = true
    ;(async ()=>{
      try{
        const res = await api.get(`/academics/students/?klass=${selectedClass}`)
        if (!mounted) return
        setStudents(res.data || [])
        const init = {}
        ;(res.data||[]).forEach(s => init[s.id] = '')
        setMarks(init)
        // set subjects to only those the logged-in teacher teaches in this class
        const current = classes.find(c => String(c.id)===String(selectedClass))
        if (current) {
          const mine = getMySubjectsFromClass(current, me)
          setSubjects(mine)
          if (mine.length && !mine.find(s=> String(s.id)===String(selectedSubject))){
            setSelectedSubject(String(mine[0].id))
          }
        }
        // Load existing unpublished exams for this class (server-filtered + pagination-aware)
        try {
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
          // Try server-side filters if supported (multiple param name variants)
          const tries = [
            `/academics/exams/?klass=${encodeURIComponent(selectedClass)}&published=false`,
            `/academics/exams/?class=${encodeURIComponent(selectedClass)}&published=false`,
            `/academics/exams/?klass_id=${encodeURIComponent(selectedClass)}&published=false`,
            `/academics/exams/?class_id=${encodeURIComponent(selectedClass)}&published=false`,
          ]
          let combined = []
          for (const t of tries){
            try { const arr = await fetchAll(t); if (Array.isArray(arr) && arr.length) combined = combined.concat(arr) } catch {}
          }
          // Fallback: fetch all and client-filter if still empty
          const list = combined.length ? combined : await fetchAll(`/academics/exams/`)
          const getKlassId = (e)=>{
            const k = e?.klass ?? e?.class ?? e?.klass_id ?? e?.class_id
            if (typeof k === 'object' && k) return String(k.id ?? k.klass ?? k.pk ?? k.ID ?? '')
            return String(k ?? '')
          }
          const isUnpublished = (e)=>{
            if (typeof e?.published === 'boolean') return e.published === false
            if (typeof e?.is_published === 'boolean') return e.is_published === false
            if (typeof e?.status === 'string') return e.status.toLowerCase() !== 'published'
            return !e?.published
          }
          // Dedupe by id
          const byId = new Map()
          ;(list||[]).forEach(e=>{ if (e && e.id != null) byId.set(e.id, e) })
          const all = Array.from(byId.values())
          let filtered = all.filter(e => getKlassId(e) === String(selectedClass) && isUnpublished(e))
          // Fallback: if none matched by class id, show all unpublished exams (lets teacher proceed)
          if (filtered.length === 0) {
            filtered = all.filter(e => isUnpublished(e))
          }
          if (mounted) {
            setExams(filtered)
            const first = filtered[0]
            setSelectedExamId(first?.id ? String(first.id) : '')
            if (first?.total_marks) setExamMeta(m=>({...m, total_marks: Number(first.total_marks)}))
            if (!filtered.length) {
              // minimal diagnostics to help spot shape mismatches during dev
              console.debug('TeacherGrades: no exams matched for class', selectedClass, {
                fetchedCount: (list||[]).length,
              })
            }
          }
        } catch {}
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
    })()
    return ()=>{ mounted = false }
  }, [selectedClass])

  // Auto-collapse controls panel once key selections are present
  useEffect(()=>{
    const ready = selectedClass && selectedSubject && selectedExamId
    if (ready) setControlsOpen(false)
  }, [selectedClass, selectedSubject, selectedExamId])

  const submit = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try{
      // require an existing, unpublished exam selected
      const examId = Number(selectedExamId)
      if (!examId) throw new Error('Select an exam to save results to')
      // post results for each student having a numeric mark
      const subjectId = Number(selectedSubject)
      for (const s of students){
        const m = parseFloat(marks[s.id])
        if (!isNaN(m)){
          await api.post('/academics/exam_results/', { exam: examId, student: s.id, subject: subjectId, marks: m })
        }
      }
      setMessage('Grades saved.')
    }catch(e){ setError(e?.response?.data?.detail || e?.message || 'Failed to save grades') }
    finally{ setSaving(false) }
  }

  const canSubmit = useMemo(()=> selectedClass && selectedSubject && selectedExamId && students.some(s => !isNaN(parseFloat(marks[s.id]))), [selectedClass, selectedSubject, selectedExamId, students, marks])

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4 md:p-5 flex items-center justify-between">
          <div>
            <div className="text-lg md:text-xl font-semibold tracking-tight">Input Grades</div>
            <div className="text-xs text-gray-600">Enter and submit exam results for your class</div>
          </div>
          <button onClick={()=>setControlsOpen(v=>!v)} className="text-sm px-3 py-1.5 rounded border hidden md:inline-flex">{controlsOpen ? 'Hide Options' : 'Change Selection'}</button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200">{error}</div>}
      {message && <div className="bg-green-50 text-green-700 p-3 rounded border border-green-200">{message}</div>}

      {/* Selection summary when collapsed */}
      {!controlsOpen && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 flex items-center justify-between text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-gray-100 border">Class: <strong className="ml-1">{(classes.find(c=>String(c.id)===String(selectedClass))||{}).name || selectedClass}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 border">Subject: <strong className="ml-1">{(subjects.find(s=>String(s.id)===String(selectedSubject))||{}).name || selectedSubject}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 border">Exam: <strong className="ml-1">{(exams.find(e=>String(e.id)===String(selectedExamId))||{}).name || selectedExamId}</strong></span>
          </div>
          <button onClick={()=>setControlsOpen(true)} className="text-blue-600 text-sm">Change</button>
        </div>
      )}

      {/* Controls */}
      {controlsOpen && (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 md:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="grid gap-1">
            <label className="text-xs text-gray-600">Class</label>
            <select className="border p-2 rounded" value={selectedClass} onChange={e=>{ setSelectedClass(e.target.value); setControlsOpen(true) }}>
              {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-gray-600">Subject</label>
            <select className="border p-2 rounded" value={selectedSubject} onChange={e=>setSelectedSubject(e.target.value)}>
              {subjects.map(s=> <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-gray-600">Exam</label>
            <select
              className="border p-2 rounded"
              value={selectedExamId}
              onChange={e=>{
                const val = e.target.value
                setSelectedExamId(val)
                const ex = exams.find(x=>String(x.id)===val)
                if (ex){
                  setExamMeta({
                    name: ex.name,
                    year: ex.year,
                    term: ex.term,
                    date: ex.date,
                    total_marks: Number(ex.total_marks)||100,
                  })
                }
              }}
            >
              <option value="">Select Exam</option>
              {exams.map(e=> (
                <option key={e.id} value={e.id}>{e.name} — T{e.term} — {e.year} — {e.date}</option>
              ))}
            </select>
            {exams.length === 0 && (
              <span className="text-[11px] text-gray-500">No unpublished exams for this class. Ask admin to create one.</span>
            )}
          </div>
        </div>

        {/* Read-only exam details */}
        {selectedExamId && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
            <div className="px-2 py-1 rounded border bg-gray-50">Name: <span className="font-medium text-gray-800 ml-1">{examMeta.name}</span></div>
            <div className="px-2 py-1 rounded border bg-gray-50">Year: <span className="font-medium text-gray-800 ml-1">{examMeta.year}</span></div>
            <div className="px-2 py-1 rounded border bg-gray-50">Term: <span className="font-medium text-gray-800 ml-1">T{examMeta.term}</span></div>
            <div className="px-2 py-1 rounded border bg-gray-50">Date: <span className="font-medium text-gray-800 ml-1">{examMeta.date}</span></div>
          </div>
        )}
      </div>
      )}

        {/* Students - mobile list */}
        <div className="md:hidden -mx-1">
          <div className="text-sm font-medium text-gray-800 mb-2 px-1">Students</div>
          <div className="space-y-2">
            {students.map(st => (
              <div key={st.id} className="flex items-center justify-between gap-2 px-2 py-2 border rounded-lg">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{st.name}</div>
                  <div className="text-xs text-gray-500">{st.admission_no}</div>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={Number(examMeta.total_marks)||100}
                  step="0.01"
                  className="border p-2 rounded w-24 text-right"
                  value={marks[st.id] || ''}
                  onChange={e=>setMarks(m=>({ ...m, [st.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Students - table for md+ */}
        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-600">
                <th className="py-2">Student</th>
                <th className="py-2">Admission</th>
                <th className="py-2 text-right">Marks</th>
              </tr>
            </thead>
            <tbody>
              {students.map(st => (
                <tr key={st.id} className="border-t">
                  <td className="py-2">{st.name}</td>
                  <td className="py-2">{st.admission_no}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={Number(examMeta.total_marks)||100}
                      step="0.01"
                      className="border p-2 rounded w-28 text-right"
                      value={marks[st.id] || ''}
                      onChange={e=>setMarks(m=>({ ...m, [st.id]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Desktop save button */}
        <div className="hidden md:flex justify-end">
          <button onClick={submit} disabled={saving || !canSubmit} className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 shadow-soft">{saving ? 'Saving...' : 'Save Grades'}</button>
        </div>
      

      {/* Sticky mobile save bar */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-4xl px-4 pb-4">
          <div className="rounded-2xl bg-white shadow-xl border border-gray-200 p-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">Total Students: <span className="font-medium text-gray-800">{students.length}</span></div>
            <button onClick={submit} disabled={saving || !canSubmit} className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 shadow-soft">{saving ? 'Saving...' : 'Save Grades'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

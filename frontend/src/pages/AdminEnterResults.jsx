import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import AdminLayout from '../components/AdminLayout'
import { useNotification } from '../components/NotificationContext'

export default function AdminEnterResults(){
  const { id } = useParams()
  const navigate = useNavigate()
  const examId = Number(id)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('idle')
  const [exam, setExam] = useState(null)
  const [klass, setKlass] = useState(null)
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState('') // '' means All subjects
  const [results, setResults] = useState([]) // rows: {student, subject, marks}
  const [invalid, setInvalid] = useState({}) // { 'studentId-subjectId': true }
  const { showError } = useNotification?.() || { showError: ()=>{} }

  useEffect(()=>{
    let alive = true
    ;(async ()=>{
      try{
        setLoading(true)
        setError('')
        // exam
        const e = await api.get(`/academics/exams/${examId}/`)
        if (!alive) return
        setExam(e.data)
        // class details (need subjects) + students
        const klassRes = await api.get(`/academics/classes/${e.data.klass}/`)
        if (!alive) return
        setKlass(klassRes.data)
        const subj = Array.isArray(klassRes.data?.subjects) ? klassRes.data.subjects : []
        setSubjects(subj)
        const stu = await api.get(`/academics/students/?klass=${e.data.klass}`)
        if (!alive) return
        setStudents(stu.data || [])
        // existing results
        let existing = []
        try{
          const { data } = await api.get(`/academics/exam_results/?exam=${examId}`)
          existing = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
        }catch{}
        const existingMap = new Map()
        existing.forEach(r=> existingMap.set(`${r.student}-${r.subject}`, r.marks))
        const rows = []
        for (const s of (stu.data||[])){
          for (const sub of subj){
            const key = `${s.id}-${sub.id}`
            rows.push({ student: s.id, subject: sub.id, marks: existingMap.has(key) ? existingMap.get(key) : '' })
          }
        }
        if (!alive) return
        setResults(rows)
      }catch(err){
        setError(err?.response?.data?.detail || err?.message || 'Failed to load exam')
      }finally{
        if (alive) setLoading(false)
      }
    })()
    return ()=>{ alive = false }
  }, [examId])

  const save = async (e) => {
    e?.preventDefault?.()
    setSaving(true)
    setStatus('saving')
    setError('')
    try{
      // block save if any invalid cells
      const hasInvalid = Object.values(invalid).some(Boolean)
      if (hasInvalid){
        throw new Error('Some entries are invalid. Fix highlighted cells (0..total).')
      }
      const visibleSubjectIds = selectedSubject ? [Number(selectedSubject)] : subjects.map(s=>s.id)
      const payload = results
        .filter(r => visibleSubjectIds.includes(r.subject))
        .map(r => ({ ...r, marks: parseFloat(r.marks) }))
        .filter(r => !isNaN(r.marks))
        .map(r => ({ ...r, exam: examId }))
      if (!payload.length) throw new Error('Enter at least one mark to save')
      const res = await api.post('/academics/exam_results/bulk/', { results: payload })
      const failed = Number(res?.data?.failed || 0)
      if (failed){
        setStatus('idle')
        setError(`Partial save. ${failed} failed. ${res?.data?.errors ? JSON.stringify(res.data.errors.slice(0,3)) : ''}`)
      } else {
        setStatus('saved')
        setTimeout(()=>setStatus('idle'), 1500)
      }
    }catch(err){
      setError(err?.response?.data?.detail || err?.message || 'Failed to save results')
      setStatus('idle')
    }finally{
      setSaving(false)
    }
  }

  const title = useMemo(()=>{
    if (!exam || !klass) return 'Enter Results'
    return `${exam.name} — Year ${exam.year} — Term ${exam.term} — ${klass.name}`
  }, [exam, klass])

  // Subjects currently visible based on filter
  const visibleSubjects = useMemo(()=>{
    return selectedSubject ? subjects.filter(s=> String(s.id)===String(selectedSubject)) : subjects
  }, [subjects, selectedSubject])

  // Helper: whether a student's row has any missing marks (blank or zero) among visible subjects
  const isRowMissingMarks = (studentId) => {
    for (const s of visibleSubjects){
      const idx = results.findIndex(r => r.student===studentId && r.subject===s.id)
      const val = idx>-1 ? results[idx].marks : ''
      if (val === '' || val === null || typeof val === 'undefined') return true
      const num = Number(val)
      if (!Number.isNaN(num) && num === 0) return true
    }
    return false
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Subject:</label>
              <select className="border p-2 rounded" value={selectedSubject} onChange={e=>setSelectedSubject(e.target.value)}>
                <option value="">All Subjects</option>
                {subjects.map(s=> (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </div>
            <button className="px-3 py-2 rounded border" onClick={()=>navigate(-1)}>Back</button>
            <button disabled={saving} onClick={save} className={`text-white px-4 py-2 rounded ${status==='saved' ? 'bg-green-600' : 'bg-blue-600'}`}>{saving? 'Saving...' : status==='saved' ? 'Saved' : 'Save Results'}</button>
          </div>
        </div>
        {loading && <div>Loading...</div>}
        {!loading && (
          <div className="bg-white rounded shadow p-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Student</th>
                  {visibleSubjects.map(s => (
                    <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map(stu => (
                  <tr key={stu.id} className={isRowMissingMarks(stu.id) ? 'bg-amber-50' : ''}>
                    <td className="border px-2 py-1">{stu.name}</td>
                    {visibleSubjects.map(s => {
                      const idx = results.findIndex(r => r.student===stu.id && r.subject===s.id)
                      const val = idx>-1 ? results[idx].marks : ''
                      const isMissingCell = (val === '' || val === null || typeof val === 'undefined' || Number(val) === 0)
                      const total = Number(exam?.total_marks) || 100
                      const num = Number(val)
                      const overTotal = val!=='' && !Number.isNaN(num) && (num < 0 || num > total)
                      const cellKey = `${stu.id}-${s.id}`
                      const isInvalid = overTotal || !!invalid[cellKey]
                      return (
                        <td key={s.id} className={`border px-2 py-1 ${isMissingCell ? 'bg-rose-50' : ''} ${isInvalid ? 'outline outline-1 outline-red-400' : ''}`}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={total}
                            step="0.01"
                            className={`border p-1 rounded w-20 ${isInvalid ? 'border-red-500 bg-red-50' : ''}`}
                            value={val}
                            onChange={e=>{
                              const v = e.target.value
                              // validate
                              let bad = false
                              if (v !== '' && v !== null && typeof v !== 'undefined'){
                                const n = Number(v)
                                if (Number.isNaN(n) || n < 0 || n > total){
                                  bad = true
                                  if (!invalid[cellKey]){
                                    showError('Invalid marks', `Value must be between 0 and ${total}.`, 3000)
                                  }
                                }
                              }
                              setInvalid(prev => ({ ...prev, [cellKey]: bad }))
                              setResults(prev => {
                                const copy = [...prev]
                                const i = copy.findIndex(r => r.student===stu.id && r.subject===s.id)
                                if (i>-1) copy[i] = { ...copy[i], marks: v }
                                return copy
                              })
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

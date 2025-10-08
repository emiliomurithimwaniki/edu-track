import React, { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import api from '../api'
import Modal from '../components/Modal'
import { useNavigate } from 'react-router-dom'

export default function AdminExams(){
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [modalSubjects, setModalSubjects] = useState([]) // subjects for selected exam/class

  const [showCreateExam, setShowCreateExam] = useState(false)
  const [showEnterResults, setShowEnterResults] = useState(false)
  const [examForm, setExamForm] = useState({ name:'Mid Term', year:new Date().getFullYear(), term:1, classes:[], date:new Date().toISOString().slice(0,10), total_marks:100 })
  const [selectedExam, setSelectedExam] = useState(null)
  const [results, setResults] = useState([]) // [{student, subject, marks}]
  const [status, setStatus] = useState('idle') // idle|saving|saved
  const [error, setError] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [resultsSummary, setResultsSummary] = useState({ subjects: [], students: [] })
  const [publishingId, setPublishingId] = useState(null)
  const [banner, setBanner] = useState('')
  const [currentTerm, setCurrentTerm] = useState(null)

  // Navigate to CBC Competencies (Curriculum) page
  const handleCBCCompetencies = () => {
    navigate('/admin/curriculum')
  }

  const publishExam = async (exam) => {
    if (!exam) return
    try {
      setPublishingId(exam.id)
      setBanner('')
      await api.post(`/academics/exams/${exam.id}/publish/`)
      setBanner(`Published results for ${exam.name}. Students have been notified.`)
      // Refresh list to reflect published flag
      load()
    } catch (err) {
      setBanner(err?.response?.data?.detail || 'Failed to publish results')
    } finally {
      setPublishingId(null)
    }
  }

  const load = async () => {
    const [ex, cl, sbj, term] = await Promise.all([
      api.get('/academics/exams/'),
      api.get('/academics/classes/'),
      api.get('/academics/subjects/'),
      api.get('/academics/terms/current/').catch(()=>({ data: null })),
    ])
    setExams(ex.data)
    setClasses(cl.data)
    setSubjects(sbj.data)
    setCurrentTerm(term?.data || null)
    // Set defaults for modal: current term and today's date
    setExamForm(prev => ({
      ...prev,
      term: term?.data?.number || prev.term,
      date: prev.date || new Date().toISOString().slice(0,10),
    }))
  }
  useEffect(()=>{ load() }, [])

  const openResults = async (exam) => {
    setSelectedExam(exam)
    const st = await api.get(`/academics/students/?klass=${exam.klass}`)
    setStudents(st.data)
    // initialize results grid: each student x each subject in class subjects
    const klass = classes.find(c => c.id === exam.klass)
    const subjObjs = Array.isArray(klass?.subjects) ? klass.subjects : []
    const subjectIds = subjObjs.map(s=>s.id)
    setModalSubjects(subjObjs)
    // Prefill with existing results for this exam
    let existing = []
    try{
      const { data } = await api.get(`/academics/exam_results/?exam=${exam.id}`)
      existing = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
    }catch{}
    const existingMap = new Map()
    existing.forEach(r => {
      existingMap.set(`${r.student}-${r.subject}`, r.marks)
    })
    const rows = []
    for (const s of st.data) {
      for (const sid of subjectIds) {
        const key = `${s.id}-${sid}`
        rows.push({ student: s.id, subject: sid, marks: existingMap.has(key) ? existingMap.get(key) : '' })
      }
    }
    setResults(rows)
    setShowEnterResults(true)
  }

  const viewResults = async (exam) => {
    setSelectedExam(exam)
    setError('')
    const { data } = await api.get(`/academics/exams/${exam.id}/summary/`)
    setResultsSummary(data)
    setShowResults(true)
  }

  const createExam = async (e) => {
    e.preventDefault()
    setError('')
    // default term to current if available
    const base = { name: examForm.name, year: Number(examForm.year), term: Number(examForm.term || currentTerm?.number || 1), date: examForm.date, total_marks: Number(examForm.total_marks) || 100 }
    const targets = (examForm.classes || []).map(Number).filter(Boolean)
    if (targets.length === 0) return setError('Select at least one class')
    for (const klass of targets){
      await api.post('/academics/exams/', { ...base, klass })
    }
    setShowCreateExam(false)
    setExamForm({ name:'Mid Term', year:new Date().getFullYear(), term:(currentTerm?.number || 1), classes:[], date:'', total_marks:100 })
    load()
  }

  const saveResults = async (e) => {
    e.preventDefault()
    setStatus('saving')
    setError('')
    try {
      // Convert results to API format
      const payload = results.map(r => ({
        exam: selectedExam.id,
        student: r.student,
        subject: r.subject,
        marks: parseFloat(r.marks) || 0
      }))
      await api.post(`/academics/exam_results/bulk/`, { results: payload })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : err?.message || 'Failed to save results')
      setStatus('idle')
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Exams</h1>

        <div className="bg-white rounded shadow p-4 flex items-center justify-between">
          <div className="font-medium">Manage Exams</div>
          <div className="flex items-center gap-2">
            <button onClick={handleCBCCompetencies} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors">
              📚 CBC Competencies
            </button>
            <button onClick={()=>setShowCreateExam(true)} className="bg-blue-600 text-white px-4 py-2 rounded">Create Exam</button>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-medium mb-2">Exams</h2>
          {banner && (
            <div className="mb-2 text-sm bg-blue-50 text-blue-800 px-3 py-2 rounded">{banner}</div>
          )}
          <table className="w-full text-left text-sm">
            <thead><tr><th>Name</th><th>Year</th><th>Term</th><th>Class</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {exams.map(e => (
                <tr key={e.id} className="border-t">
                  <td>{e.name}</td>
                  <td>{e.year}</td>
                  <td>T{e.term}</td>
                  <td>{classes.find(c=>c.id===e.klass)?.name || e.klass}</td>
                  <td>{e.date}</td>
                  <td>{e.total_marks}</td>
                  <td>
                    {e.published ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">Published</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">Draft</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button onClick={()=>navigate(`/admin/exams/${e.id}/enter`)} className="text-blue-600">Enter Results</button>
                      <button onClick={()=>viewResults(e)} className="text-green-700">View Results</button>
                      <button onClick={()=>navigate(`/admin/results?exam=${e.id}&grade=${encodeURIComponent(classes.find(c=>c.id===e.klass)?.grade_level || '')}`)} className="text-indigo-700">Results Page</button>
                      <button
                        onClick={()=>publishExam(e)}
                        disabled={!!e.published || publishingId===e.id}
                        className={`text-purple-700 ${e.published? 'opacity-50 cursor-not-allowed':''}`}
                      >
                        {publishingId===e.id ? 'Publishing...' : (e.published ? 'Published' : 'Publish')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Exam Modal */}
      <Modal open={showCreateExam} onClose={()=>setShowCreateExam(false)} title="Create Exam" size="md">
        <form onSubmit={createExam} className="grid gap-3 md:grid-cols-3">
          <input className="border p-2 rounded" placeholder="Name (e.g., Mid Term)" value={examForm.name} onChange={e=>setExamForm({...examForm, name:e.target.value})} required />
          <input className="border p-2 rounded" type="number" placeholder="Year" value={examForm.year} onChange={e=>setExamForm({...examForm, year:e.target.value})} required />
          <select className="border p-2 rounded" value={examForm.term} onChange={e=>setExamForm({...examForm, term:Number(e.target.value)})}>
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
          {/* Multi-class select */}
          <select className="border p-2 rounded md:col-span-2" multiple value={examForm.classes} onChange={e=>{
            const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
            setExamForm({...examForm, classes: opts})
          }} required>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>)}
          </select>
          <input className="border p-2 rounded" type="date" value={examForm.date} onChange={e=>setExamForm({...examForm, date:e.target.value})} required />
          {/* Removed total marks input, defaulting to 100 internally */}
          <div className="md:col-span-3 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowCreateExam(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Create</button>
          </div>
        </form>
      </Modal>

      {/* Enter Results Modal */}
      <Modal open={showEnterResults} onClose={()=>setShowEnterResults(false)} title="Enter Results" size="xl">
        <form onSubmit={saveResults} className="space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Student</th>
                  {modalSubjects.map(s => (
                    <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map(stu => (
                  <tr key={stu.id}>
                    <td className="border px-2 py-1">{stu.name}</td>
                    {modalSubjects.map(s => {
                      const idx = results.findIndex(r => r.student===stu.id && r.subject===s.id)
                      const val = idx>-1 ? results[idx].marks : ''
                      return (
                        <td key={s.id} className="border px-2 py-1">
                          <input className="border p-1 rounded w-20" value={val} onChange={e=>{
                            const v = e.target.value
                            setResults(prev => {
                              const copy = [...prev]
                              const i = copy.findIndex(r => r.student===stu.id && r.subject===s.id)
                              if (i>-1) copy[i] = { ...copy[i], marks: v }
                              return copy
                            })
                          }} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={()=>setShowEnterResults(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button disabled={status==='saving'} className={`text-white px-4 py-2 rounded ${status==='saved' ? 'bg-green-600' : 'bg-blue-600'}`}>{status==='saving' ? 'Saving...' : status==='saved' ? 'Saved' : 'Save Results'}</button>
          </div>
        </form>
      </Modal>

      {/* Results Summary Modal */}
      <Modal open={showResults} onClose={()=>setShowResults(false)} title="Results Summary" size="xl">
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Student</th>
                  {resultsSummary.subjects.map(s => (
                    <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
                  ))}
                  <th className="border px-2 py-1 text-left">Total</th>
                  <th className="border px-2 py-1 text-left">Average</th>
                </tr>
              </thead>
              <tbody>
                {resultsSummary.students.map(st => (
                  <tr key={st.id}>
                    <td className="border px-2 py-1">{st.name}</td>
                    {resultsSummary.subjects.map(s => (
                      <td key={s.id} className="border px-2 py-1">{st.marks?.[String(s.id)] ?? '-'}</td>
                    ))}
                    <td className="border px-2 py-1 font-medium">{st.total}</td>
                    <td className="border px-2 py-1">{st.average}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button onClick={()=>setShowResults(false)} className="px-4 py-2 rounded border">Close</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}

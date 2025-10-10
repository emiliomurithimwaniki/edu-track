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
  // Group by exam name modal
  const [groupedOpen, setGroupedOpen] = useState(false)
  const [groupedName, setGroupedName] = useState('')
  const [groupedItems, setGroupedItems] = useState([])
  // Filters
  const [search, setSearch] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all|published|unpublished

  // Navigate to CBC Competencies (Curriculum) page
  const handleCBCCompetencies = () => {
    navigate('/admin/curriculum')
  }

  // Open modal showing all classes/grades that share the same exam name
  const openByName = async (name) => {
    if (!name) return
    try{
      setGroupedName(name)
      setGroupedItems([])
      const { data } = await api.get('/academics/exams/by-name', { params: { name, include_history: true } })
      const items = Array.isArray(data?.items) ? data.items : []
      setGroupedItems(items)
      setGroupedOpen(true)
    }catch(err){
      setBanner(err?.response?.data?.detail || 'Failed to load grouped exams')
    }
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
      api.get('/academics/exams/', { params: { include_history: true } }),
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

  // Derive grade options from classes
  const gradeOptions = Array.from(new Set((classes||[]).map(c=>c.grade_level))).filter(Boolean)

  // Compute filtered list
  const filteredExams = exams.filter(e => {
    const klass = classes.find(c=>c.id===e.klass)
    const className = klass?.name || ''
    const gradeLevel = klass?.grade_level || ''
    // search
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || className.toLowerCase().includes(q) || String(e.year).includes(q)
    // grade filter
    const matchesGrade = !filterGrade || gradeLevel === filterGrade
    // class filter
    const matchesClass = !filterClass || String(e.klass) === String(filterClass)
    // status filter
    const matchesStatus = filterStatus==='all' || (filterStatus==='published' ? !!e.published : !e.published)
    return matchesSearch && matchesGrade && matchesClass && matchesStatus
  })

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
          {/* Filters */}
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Search</label>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, class, year" className="border p-2 rounded w-64" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Grade</label>
                <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} className="border p-2 rounded w-44">
                  <option value="">All Grades</option>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Class</label>
                <select value={filterClass} onChange={e=>setFilterClass(e.target.value)} className="border p-2 rounded w-52">
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Status</label>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border p-2 rounded w-40">
                  <option value="all">All</option>
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{setSearch('');setFilterGrade('');setFilterClass('');setFilterStatus('all')}} className="border px-3 py-2 rounded">Clear</button>
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead><tr><th>Name</th><th>Year</th><th>Term</th><th>Class</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filteredExams.map(e => (
                <tr key={e.id} className="border-t">
                  <td>
                    <button onClick={()=>openByName(e.name)} className="text-blue-700 hover:underline" title="Show all classes for this exam name">
                      {e.name}
                    </button>
                  </td>
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

      {/* Grouped by Exam Name Modal */}
      <Modal open={groupedOpen} onClose={()=>setGroupedOpen(false)} title={`Exams — ${groupedName}`} size="xl">
        <div className="space-y-3">
          {groupedItems.length === 0 ? (
            <div className="text-sm text-gray-600">No exams found for this name.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Grade</th>
                    <th className="border px-2 py-1 text-left">Class</th>
                    <th className="border px-2 py-1 text-left">Year</th>
                    <th className="border px-2 py-1 text-left">Term</th>
                    <th className="border px-2 py-1 text-left">Date</th>
                    <th className="border px-2 py-1 text-left">Status</th>
                    <th className="border px-2 py-1 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map(item => (
                    <tr key={item.id}>
                      <td className="border px-2 py-1">{item.grade_level_tag || item.klass?.grade_level || '-'}</td>
                      <td className="border px-2 py-1">{item.klass?.name || '-'}</td>
                      <td className="border px-2 py-1">{item.year}</td>
                      <td className="border px-2 py-1">T{item.term}</td>
                      <td className="border px-2 py-1">{item.date}</td>
                      <td className="border px-2 py-1">{item.published ? 'Published' : 'Draft'}</td>
                      <td className="border px-2 py-1">
                        <div className="flex gap-3">
                          <button onClick={()=>viewResults({ id: item.id })} className="text-green-700">View Results</button>
                          <button onClick={()=>navigate(`/admin/results?exam=${item.id}&grade=${encodeURIComponent(item.grade_level_tag || item.klass?.grade_level || '')}`)} className="text-indigo-700">Results Page</button>
                          <button onClick={()=>publishExam({ id: item.id, name: groupedName, published: item.published })} disabled={!!item.published} className={`text-purple-700 ${item.published? 'opacity-50 cursor-not-allowed':''}`}>{item.published ? 'Published' : 'Publish'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={()=>setGroupedOpen(false)} className="px-4 py-2 rounded border">Close</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}

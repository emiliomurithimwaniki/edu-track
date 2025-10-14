import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import api from '../api'

export default function AdminResults(){
  const [params, setParams] = useSearchParams()
  const initialGrade = params.get('grade') || ''
  const initialExam = params.get('exam') || ''

  const [grade, setGrade] = useState(initialGrade)
  const [classes, setClasses] = useState([])
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState(initialExam)
  const [summary, setSummary] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  const [compareSummaries, setCompareSummaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // Load all classes for dropdowns
  useEffect(() => {
    (async () => {
      const { data } = await api.get('/academics/classes/')
      setClasses(data)
    })()
  }, [])

  // When grade changes, load exams for that grade
  useEffect(() => {
    (async () => {
      if (!grade) { setExams([]); return }
      const { data } = await api.get(`/academics/exams/?grade=${encodeURIComponent(grade)}`)
      // Only allow selection of exams that are published (done & visible)
      const published = Array.isArray(data) ? data.filter(e => !!e.published) : []
      setExams(published)
      // if selected exam not in published exams for grade, reset
      if (published.findIndex(e => String(e.id) === String(selectedExam)) === -1) {
        setSelectedExam('')
        setSummary(null)
      }
    })()
  }, [grade])

  // Reflect into URL params
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (grade) next.set('grade', grade); else next.delete('grade')
    if (selectedExam) next.set('exam', String(selectedExam)); else next.delete('exam')
    setParams(next, { replace: true })
  }, [grade, selectedExam])

  const gradeOptions = useMemo(() => Array.from({length:9}, (_,i)=>`Grade ${i+1}`), [])

  const loadSummary = async (examId) => {
    setLoading(true); setErr('')
    try {
      const { data } = await api.get(`/academics/exams/${examId}/summary/`)
      setSummary(data)
    } catch (e) {
      setErr(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    } finally { setLoading(false) }
  }

  const download = async (examId, fmt) => {
    setErr('')
    console.log('Downloading:', { examId, fmt })
    
    // Validate exam ID
    if (!examId || isNaN(examId)) {
      const errMsg = `Invalid exam ID: ${examId}. Please select a valid exam from the dropdown.`
      setErr(errMsg)
      console.error(errMsg)
      return
    }
    
    try {
      const url = fmt === 'csv' ? `/academics/exams/${examId}/summary-csv/` : `/academics/exams/${examId}/summary-pdf/`
      console.log('Requesting:', url)
      
      const response = await api.get(url, { responseType: 'blob' })
      console.log('Response received:', response.status, response.headers)
      
      const blob = new Blob([response.data], { type: fmt === 'csv' ? 'text/csv' : 'application/pdf' })
      console.log('Blob created:', blob.size, 'bytes')
      
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `exam_${examId}_summary.${fmt}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
      console.log('Download initiated successfully')
    } catch (e) {
      console.error('Download error:', e)
      let errMsg = 'Download failed: '
      
      if (e.response) {
        // Server responded with error
        if (e.response.status === 404) {
          errMsg += 'Exam not found. Please select a valid exam.'
        } else if (e.response.status === 403) {
          errMsg += 'Permission denied. You may not have access to this exam.'
        } else if (e.response.status === 500) {
          errMsg += 'Server error. Please try again or contact support.'
        } else {
          errMsg += `Server error (${e.response.status})`
        }
        
        // Try to parse error message from blob
        try {
          const text = await e.response.data.text()
          const parsed = JSON.parse(text)
          if (parsed.detail) errMsg += `: ${parsed.detail}`
        } catch {}
      } else if (e.request) {
        // Request made but no response
        errMsg += 'No response from server. Please check your connection.'
      } else {
        // Error setting up request
        errMsg += e.message || 'Unknown error'
      }
      
      setErr(errMsg)
    }
  }

  const loadCompare = async (ids) => {
    const out = []
    for (const id of ids) {
      try {
        const { data } = await api.get(`/academics/exams/${id}/summary/`)
        out.push({ id, data })
      } catch (_) {}
    }
    setCompareSummaries(out)
  }

  useEffect(() => {
    if (selectedExam) loadSummary(selectedExam)
  }, [selectedExam])

  useEffect(() => { loadCompare(compareIds) }, [compareIds])

  const classNameById = (id) => classes.find(c=>c.id===id)?.name || id

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Results</h1>
        <div className="bg-white rounded shadow p-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="text-sm">Select Grade
              <select className="border p-2 rounded w-full mt-1" value={grade} onChange={e=>setGrade(e.target.value)}>
                <option value="">-- Choose Grade --</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Select Exam (in Grade)
              <select className="border p-2 rounded w-full mt-1" value={selectedExam} onChange={e=>setSelectedExam(e.target.value)}>
                <option value="">-- Choose Exam --</option>
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name} • {ex.year} • T{ex.term} • {classNameById(ex.klass)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="md:col-span-1">
            <label className="text-sm">Compare Classes (pick exams)
              <select multiple className="border p-2 rounded w-full mt-1 h-28" value={compareIds} onChange={e=>{
                const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
                setCompareIds(opts)
              }}>
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{classNameById(ex.klass)} • {ex.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Class Results</h2>
            <div className="flex items-center gap-3">
              {summary && <div className="text-sm text-gray-600">Class Mean: <span className="font-semibold">{summary.class_mean}</span></div>}
              {selectedExam && (
                <>
                  <button onClick={()=>download(selectedExam,'csv')} className="px-3 py-1.5 rounded border text-sm">Download CSV</button>
                  <button onClick={()=>download(selectedExam,'pdf')} className="px-3 py-1.5 rounded border text-sm">Download PDF</button>
                </>
              )}
            </div>
          </div>
          {err && <div className="bg-red-50 text-red-700 text-sm p-2 rounded mb-2">{err}</div>}
          {!selectedExam ? (
            <div className="text-sm text-gray-600">Pick a grade and an exam to view class results.</div>
          ) : loading ? (
            <div>Loading...</div>
          ) : summary ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Position</th>
                    <th className="border px-2 py-1 text-left">Student</th>
                    {summary.subjects.map(s => (
                      <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
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
          ) : (
            <div className="text-sm text-gray-600">No data.</div>
          )}
          {summary && (
            <div className="mt-3 text-sm text-gray-700">
              <div className="font-medium mb-1">Subject Means</div>
              <div className="flex gap-3 flex-wrap">
                {summary.subject_means.map(sm => (
                  <span key={sm.subject} className="px-2 py-1 rounded bg-gray-100">{summary.subjects.find(s=>s.id===sm.subject)?.code}: <b>{sm.mean}</b></span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-medium mb-2">Compare Classes (by Class Mean)</h2>
          {compareSummaries.length === 0 ? (
            <div className="text-sm text-gray-600">Select one or more exams in the Compare multi-select to see class means.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead><tr><th>Class</th><th>Exam</th><th>Class Mean</th></tr></thead>
              <tbody>
                {compareSummaries.map(cs => {
                  const ex = exams.find(e=>String(e.id)===String(cs.id))
                  return (
                    <tr key={cs.id} className="border-t">
                      <td>{classNameById(ex?.klass)}</td>
                      <td>{ex?.name} • {ex?.year} • T{ex?.term}</td>
                      <td>{cs.data.class_mean}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

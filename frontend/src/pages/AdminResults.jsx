import React, { useEffect, useMemo, useState, useRef } from 'react'
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
  const [fullListSearch, setFullListSearch] = useState('')
  const [tab, setTab] = useState('class') // class | compare | block | full
  const fullListTableRef = useRef(null)

  const printFullList = () => {
    try{
      const table = fullListTableRef.current
      if (!table) return
      const html = table.outerHTML
      const win = window.open('', '_blank', 'width=1200,height=800')
      if (!win) return
      win.document.write(`<!doctype html><html><head><title>Full Grade List</title>
        <style>
          body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding:16px; }
          table{ border-collapse: collapse; width: 100%; font-size: 12px; }
          th, td{ border: 1px solid #ddd; padding: 6px; text-align: left; }
          th{ background:#f3f4f6; }
        </style>
      </head><body>
        <h2>Full Grade List</h2>
        ${html}
        <script>window.onload = function(){ window.print(); setTimeout(()=>window.close(), 300); }<\/script>
      </body></html>`)
      win.document.close()
    }catch{}
  }

  // Load all classes for dropdowns
  useEffect(() => {
    (async () => {
      // Support both array and paginated responses
      const fetchAll = async (url) => {
        let out = []
        let next = url
        let guard = 0
        while (next && guard < 50){
          const res = await api.get(next)
          const d = res?.data
          if (Array.isArray(d)) { out = d; break }
          if (d && Array.isArray(d.results)) { out = out.concat(d.results); next = d.next; guard++; continue }
          break
        }
        return out
      }
      const list = await fetchAll('/academics/classes/')
      setClasses(Array.isArray(list) ? list : [])
    })()
  }, [])

  // When grade changes, load exams for that grade
  useEffect(() => {
    (async () => {
      if (!grade) { setExams([]); return }
      // Fetch all pages in case the API is paginated
      const fetchAll = async (url) => {
        let out = []
        let next = url
        let guard = 0
        while (next && guard < 50){
          const res = await api.get(next)
          const d = res?.data
          if (Array.isArray(d)) { out = d; break }
          if (d && Array.isArray(d.results)) { out = out.concat(d.results); next = d.next; guard++; continue }
          break
        }
        return out
      }
      const all = await fetchAll(`/academics/exams/?include_history=true`)
      // Filter by selected grade using local classes reference
      const normalizeGrade = (g)=>{
        const s = String(g||'').trim()
        const m = s.match(/\d+/)
        if (m) return m[0]
        return s.toLowerCase()
      }
      const classById = new Map(classes.map(c => [String(c.id), c]))
      const inGrade = (Array.isArray(all) ? all : []).filter(e => {
        const cid = String(e?.klass ?? e?.class ?? e?.klass_id ?? e?.class_id ?? '')
        const cls = classById.get(cid)
        return cls && normalizeGrade(cls.grade_level) === normalizeGrade(grade)
      })
      // Only allow selection of exams that are published (done & visible)
      const published = inGrade.filter(e => !!(e.published || e.is_published || String(e.status||'').toLowerCase()==='published'))
      const list = (published.length > 0) ? published : inGrade
      setExams(list)
      // if selected exam not in published exams for grade, reset
      if (list.findIndex(e => String(e.id) === String(selectedExam)) === -1) {
        setSelectedExam('')
        setSummary(null)
      }
    })()
  }, [grade, classes])

  // Reflect into URL params
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (grade) next.set('grade', grade); else next.delete('grade')
    if (selectedExam) next.set('exam', String(selectedExam)); else next.delete('exam')
    setParams(next, { replace: true })
  }, [grade, selectedExam])

  const gradeOptions = useMemo(() => Array.from({length:9}, (_,i)=>`Grade ${i+1}`), [])

  // If a summary has no students, fetch the class roster and create zero-score rows so users can still see students
  const hydrateWithRoster = async (examId, summary) => {
    try{
      if (!summary || (Array.isArray(summary.students) && summary.students.length>0)) return summary
      const ex = (Array.isArray(exams)?exams:[]).find(e=>String(e.id)===String(examId))
      const klassId = ex?.klass
      if (!klassId) return summary
      const rosterRes = await api.get(`/academics/students/?klass=${klassId}`)
      const roster = Array.isArray(rosterRes?.data) ? rosterRes.data : (Array.isArray(rosterRes?.data?.results) ? rosterRes.data.results : [])
      const subs = Array.isArray(summary.subjects) ? summary.subjects : []
      const students = roster.map((s, idx) => ({ id: s.id, name: s.name, marks: {}, total: 0, average: 0, position: idx+1 }))
      return { ...summary, students, subjects: subs }
    }catch{
      return summary
    }
  }

  const loadSummary = async (examId) => {
    setLoading(true); setErr('')
    try {
      const { data } = await api.get(`/academics/exams/${examId}/summary/`)
      const hydrated = await hydrateWithRoster(examId, data)
      setSummary(hydrated)
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
        const hydrated = await hydrateWithRoster(id, data)
        out.push({ id, data: hydrated })
      } catch (_) {}
    }
    setCompareSummaries(out)
  }

  useEffect(() => {
    if (selectedExam) loadSummary(selectedExam)
  }, [selectedExam])

  // When an exam is selected, auto-select all exams in the same grade that share the same (name, year, term)
  // so the Compare panel immediately shows class means across streams for that grade.
  useEffect(() => {
    try{
      if (!selectedExam) { return }
      const base = exams.find(e => String(e.id) === String(selectedExam))
      if (!base) { return }
      const sameBlock = exams.filter(e => String(e.name||'') === String(base.name||'') && String(e.year||'') === String(base.year||'') && String(e.term||'') === String(base.term||''))
      const ids = sameBlock.map(e => String(e.id))
      setCompareIds(ids)
    }catch{}
  }, [selectedExam, exams])

  useEffect(() => { loadCompare(compareIds) }, [compareIds])

  const classNameById = (id) => classes.find(c=>c.id===id)?.name || id

  // Build combined grade cohort results for the active exam block
  const blockResults = useMemo(() => {
    try{
      if (!selectedExam || compareSummaries.length === 0) return null
      // Map exam id -> class id for labeling
      const exById = new Map(exams.map(e => [String(e.id), e]))
      const rows = []
      const subjectMap = new Map() // subjectId -> { id, code, name }
      for (const cs of compareSummaries){
        const ex = exById.get(String(cs.id))
        const klassId = ex?.klass
        const klassName = classNameById(klassId)
        const summary = cs.data
        // collect subjects
        for (const s of (summary?.subjects || [])){
          const sid = String(s.id)
          if (!subjectMap.has(sid)) subjectMap.set(sid, { id: s.id, code: s.code, name: s.name })
        }
        // Each summary has students with totals/averages
        for (const st of (summary?.students || [])){
          rows.push({
            student_id: st.id,
            name: st.name,
            klass: klassName,
            total: Number(st.total || 0),
            average: Number(st.average || 0),
            marks: st.marks || {},
          })
        }
      }
      // Rank across grade by total, ties share position
      rows.sort((a,b)=> b.total - a.total)
      let position = 0, last = null, seen = 0
      for (const r of rows){
        seen++
        if (last === null || r.total < last){ position = seen; last = r.total }
        r.position = position
      }
      const subjects = Array.from(subjectMap.values())
      return { students: rows, subjects }
    }catch{
      return null
    }
  }, [compareSummaries, exams, classes, selectedExam])

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

        {/* Tabs */}
        <div className="bg-white rounded shadow p-2">
          <div className="flex gap-2">
            <button onClick={()=>setTab('class')} className={`px-3 py-2 rounded ${tab==='class'?'bg-blue-600 text-white':'border'}`}>Class Results</button>
            <button onClick={()=>setTab('compare')} className={`px-3 py-2 rounded ${tab==='compare'?'bg-blue-600 text-white':'border'}`}>Compare Classes</button>
            <button onClick={()=>setTab('block')} className={`px-3 py-2 rounded ${tab==='block'?'bg-blue-600 text-white':'border'}`}>Block Results</button>
            <button onClick={()=>setTab('full')} className={`px-3 py-2 rounded ${tab==='full'?'bg-blue-600 text-white':'border'}`}>Full List</button>
          </div>
        </div>

        {tab==='class' && (
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
                      {summary.subjects.map(s => {
                        const raw = st.marks?.[String(s.id)]
                        const val = Number.isFinite(Number(raw)) ? Number(raw) : 0
                        return (
                          <td key={s.id} className="border px-2 py-1">{val}</td>
                        )
                      })}
                      <td className="border px-2 py-1 font-medium">{Number.isFinite(Number(st.total)) ? Number(st.total) : 0}</td>
                      <td className="border px-2 py-1">{Number.isFinite(Number(st.average)) ? Number(st.average) : 0}</td>
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
        )}

        {tab==='full' && (
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Full Grade List</h2>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">Total students: <b>{blockResults?.students?.length || 0}</b></div>
              <input value={fullListSearch} onChange={e=>setFullListSearch(e.target.value)} placeholder="Search name or class" className="border p-2 rounded w-64 bg-white" />
              <button onClick={printFullList} className="px-3 py-1.5 rounded border text-sm">Print</button>
            </div>
          </div>
          {!selectedExam ? (
            <div className="text-sm text-gray-600">Pick a grade and an exam to view the full grade list.</div>
          ) : (!blockResults || !blockResults.students || blockResults.students.length===0) ? (
            <div className="text-sm text-gray-600">No data.</div>
          ) : (
            <div className="overflow-auto">
              <table ref={fullListTableRef} className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">#</th>
                    <th className="border px-2 py-1 text-left">Student</th>
                    <th className="border px-2 py-1 text-left">Class</th>
                    {Array.isArray(blockResults.subjects) && blockResults.subjects.map(s => (
                      <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
                    ))}
                    <th className="border px-2 py-1 text-left">Total</th>
                    <th className="border px-2 py-1 text-left">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {blockResults.students
                    .filter(r => {
                      const q = fullListSearch.trim().toLowerCase()
                      if (!q) return true
                      return String(r.name||'').toLowerCase().includes(q) || String(r.klass||'').toLowerCase().includes(q)
                    })
                    .map((r, idx) => (
                      <tr key={`${r.student_id}-${idx}`}>
                        <td className="border px-2 py-1">{idx+1}</td>
                        <td className="border px-2 py-1">{r.name}</td>
                        <td className="border px-2 py-1">{r.klass}</td>
                        {Array.isArray(blockResults.subjects) && blockResults.subjects.map(s => {
                          const raw = r.marks?.[String(s.id)]
                          const val = Number.isFinite(Number(raw)) ? Number(raw) : 0
                          return <td key={s.id} className="border px-2 py-1">{val}</td>
                        })}
                        <td className="border px-2 py-1">{r.total}</td>
                        <td className="border px-2 py-1">{r.average}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {tab==='compare' && (
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
        )}

        {tab==='block' && (
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Block Results (Grade Cohort)</h2>
            <div className="flex items-center gap-2">{selectedExam && <div className="text-sm text-gray-600">Classes compared: <b>{compareSummaries.length}</b></div>}</div>
          </div>
          {!selectedExam ? (
            <div className="text-sm text-gray-600">Pick a grade and an exam to view block results across all classes in that grade.</div>
          ) : (!blockResults || blockResults.students.length === 0) ? (
            <div className="text-sm text-gray-600">No student results found for this exam block.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Position</th>
                    <th className="border px-2 py-1 text-left">Student</th>
                    <th className="border px-2 py-1 text-left">Class</th>
                    <th className="border px-2 py-1 text-left">Total</th>
                    <th className="border px-2 py-1 text-left">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {blockResults.students.map((r, idx) => (
                    <tr key={`${r.student_id}-${idx}`}>
                      <td className="border px-2 py-1">{r.position}</td>
                      <td className="border px-2 py-1">{r.name}</td>
                      <td className="border px-2 py-1">{r.klass}</td>
                      <td className="border px-2 py-1 font-medium">{r.total}</td>
                      <td className="border px-2 py-1">{r.average}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>
    </AdminLayout>
  )
}

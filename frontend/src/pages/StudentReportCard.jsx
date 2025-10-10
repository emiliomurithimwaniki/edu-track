import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../auth'
import { toAbsoluteUrl } from '../api'

export default function StudentReportCard(){
  const { user } = useAuth()
  const [student, setStudent] = useState(null)
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
  const [school, setSchool] = useState(null)
  const [rank, setRank] = useState(null)
  const [dlStatus, setDlStatus] = useState('idle') // idle | preparing | downloading | failed | done
  const [teacherName, setTeacherName] = useState('')
  const [selectedExamId, setSelectedExamId] = useState(null)
  const [prevRank, setPrevRank] = useState(null)

  // Identify the most recent exam by name then by latest occurrence
  const latestExamName = useMemo(()=>{
    if (!examResults.length) return null
    // Prefer the last item (assuming API returns chronological), else first
    const names = examResults.map(r=>r.exam_detail?.name || r.exam).filter(Boolean)
    return names.length ? names[names.length-1] : null
  }, [examResults])

  // Identify the latest exam id matching latestExamName for rank lookup
  const latestExamId = useMemo(()=>{
    if (!examResults.length) return null
    // try last item that matches name label
    for (let i = examResults.length - 1; i >= 0; i--) {
      const r = examResults[i]
      const label = r.exam_detail?.name || r.exam
      if (!latestExamName || label === latestExamName) {
        return r.exam_detail?.id || r.exam || null
      }
    }
    return null
  }, [examResults, latestExamName])

  // Build unique exam list for selector
  const examOptions = useMemo(()=>{
    const map = new Map()
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      const name = r.exam_detail?.name || r.exam
      if (id && name && !map.has(id)) map.set(id, name)
    }
    // Sort by name then id for consistency
    return Array.from(map.entries()).map(([id, name])=>({id, name}))
  }, [examResults])

  // Ordered unique exam list preserving original appearance order
  const examOrder = useMemo(()=>{
    const seen = new Set()
    const list = []
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      if (id && !seen.has(String(id))){ seen.add(String(id)); list.push(id) }
    }
    return list
  }, [examResults])

  // Current exam selection (selected or latest fallback)
  const currentExamId = selectedExamId || latestExamId
  const currentExamName = useMemo(()=>{
    if (selectedExamId){
      const found = examOptions.find(e=>String(e.id)===String(selectedExamId))
      return found?.name || latestExamName
    }
    return latestExamName
  }, [selectedExamId, examOptions, latestExamName])

  // Find previous exam id (the distinct exam that appears just before current in student's results)
  const prevExamId = useMemo(()=>{
    if (!currentExamId) return null
    const idx = examOrder.findIndex(id => String(id) === String(currentExamId))
    if (idx > 0) return examOrder[idx-1]
    return null
  }, [currentExamId, examOrder])

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      setLoading(true)
      setError('')
      try{
        // Fetch school separately to get authoritative logo_url (with request context)
        try{
          const sch = await api.get('/auth/school/info/')
          if (mounted) setSchool(sch.data)
        }catch{ /* ignore; fallback to user.school */ }
        const stRes = await api.get('/academics/students/my/')
        if (!mounted) return
        setStudent(stRes.data)
        // Try to resolve class teacher name for the on-page card
        try{
          const kd = stRes.data?.klass_detail
          const tdet = kd?.teacher_detail
          if (tdet){
            const nm = `${tdet.first_name||''} ${tdet.last_name||''}`.trim() || (tdet.username||'')
            if (mounted) setTeacherName(nm)
          } else if (stRes.data?.klass){
            const klass = await api.get(`/academics/classes/${stRes.data.klass}/`)
            const t = klass?.data?.teacher_detail || null
            if (t){
              const nm = `${t.first_name||''} ${t.last_name||''}`.trim() || (t.username||'')
              if (mounted) setTeacherName(nm)
            }
          }
        }catch{}
        const exm = await api.get(`/academics/exam_results/?student=${stRes.data.id}`)
        if (!mounted) return
        setExamResults(Array.isArray(exm.data) ? exm.data : [])
      }catch(err){
        if (!mounted) return
        setError(err?.response?.data?.detail || err?.message || 'Failed to load report card')
      }finally{
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  }, [])

  // Fetch rank once we know student and latest exam id
  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!student?.id || !currentExamId) return
      try{
        const { data } = await api.get(`/academics/exams/${currentExamId}/rank`, { params: { student: student.id } })
        if (active) setRank(data)
      }catch(_){ /* ignore rank errors */ }
    })()
    return ()=>{ active = false }
  }, [student?.id, currentExamId])

  // Fetch last term (previous exam) rank
  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!student?.id || !prevExamId) { if(active) setPrevRank(null); return }
      try{
        const { data } = await api.get(`/academics/exams/${prevExamId}/rank`, { params: { student: student.id } })
        if (active) setPrevRank(data)
      }catch(_){ if(active) setPrevRank(null) }
    })()
    return ()=>{ active = false }
  }, [student?.id, prevExamId])

  const rows = useMemo(()=>{
    if (!currentExamId && !currentExamName) return []
    return examResults
      .filter(r => (String(r.exam_detail?.id || r.exam) === String(currentExamId))
                || ((r.exam_detail?.name || r.exam) === currentExamName))
      .map(r => ({
        subject: r.subject_detail ? `${r.subject_detail.code ? r.subject_detail.code + ' — ' : ''}${r.subject_detail.name || ''}` : String(r.subject || ''),
        marks: Number(r.marks || 0)
      }))
  }, [examResults, currentExamId, currentExamName])

  const totals = useMemo(()=>{
    const total = rows.reduce((s, r)=> s + (Number.isFinite(r.marks) ? r.marks : 0), 0)
    const count = rows.length || 0
    const average = count ? (total / count) : 0
    return { total, count, average }
  }, [rows])

  // Previous exam mean for this student
  const prevMean = useMemo(()=>{
    if (!prevExamId) return null
    const prevRows = examResults.filter(r => String(r.exam_detail?.id || r.exam) === String(prevExamId))
      .map(r => Number(r.marks || 0))
    if (!prevRows.length) return null
    const total = prevRows.reduce((s, v)=> s + (Number.isFinite(v)? v : 0), 0)
    return prevRows.length ? (total / prevRows.length) : null
  }, [examResults, prevExamId])

  // Build a history list of all exams the student has ever done, with grade labels
  const examHistory = useMemo(()=>{
    const map = new Map()
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      if (!id) continue
      if (!map.has(String(id))){
        const ed = r.exam_detail || {}
        map.set(String(id), {
          id,
          name: ed.name || String(r.exam || ''),
          year: ed.year || null,
          term: ed.term || null,
          grade: ed.grade_level_tag || null,
        })
      }
    }
    // Preserve original appearance order from examOrder
    return examOrder.map(id => map.get(String(id))).filter(Boolean)
  }, [examResults, examOrder])

  return (
    <div className="p-6">
      {/* Print styles for a clean sheet */}
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .screen-only { display: none !important; }
          .print-container { box-shadow: none !important; border: none !important; }
          .print-header { position: fixed; top: 0; left: 0; right: 0; padding: 8px 0; }
          .print-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 6px 0; font-size: 10px; color: #6b7280; }
          .print-body { margin-top: 72px; margin-bottom: 36px; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Screen header (hidden on print) */}
        <div className="flex items-center gap-3 no-print">
          {(() => {
            const rawUrl = (school?.logo_url || user?.school?.logo_url || school?.logo || user?.school?.logo || '')
            const src = rawUrl ? toAbsoluteUrl(String(rawUrl)) + (rawUrl.includes('?') ? '' : `?v=${(school?.id||'')}-${(student?.id||'')}`) : ''
            return (src && !logoFailed) ? (
            <img
              src={src}
              alt="School Logo"
              className="w-10 h-10 rounded object-contain bg-white border"
              loading="eager"
              onError={(e)=>{ try{ e.currentTarget.src=''; }catch(_){} setLogoFailed(true) }}
              referrerPolicy="no-referrer"
            />
            ) : (
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-lg" aria-label="School Logo Placeholder">🏫</div>
            )
          })()}
          <div>
            <div className="text-base font-semibold leading-tight">{school?.name || user?.school?.name || 'School'}</div>
            {(school?.motto || user?.school?.motto) ? (
              <div className="text-xs text-gray-500 leading-tight">{school?.motto || user?.school?.motto}</div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between no-print">
          <h1 className="text-2xl font-semibold tracking-tight">Report Card {currentExamName? `— ${currentExamName}`:''}</h1>
          <div className="flex items-center gap-2">
            {examOptions.length>0 && (
              <select
                className="px-2 py-1.5 border rounded bg-white text-sm"
                value={currentExamId || ''}
                onChange={(e)=> setSelectedExamId(e.target.value || null)}
                title="Select exam"
              >
                {!selectedExamId && <option value="">Latest</option>}
                {examOptions.map(opt=> (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            )}
            <Link to="/student/academics" className="px-3 py-1.5 rounded border hover:bg-gray-50">Back</Link>
            <button
              className={`px-3 py-1.5 rounded text-white ${dlStatus==='failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-60`}
              onClick={async ()=>{
                try{
                  if (!student?.id || !currentExamId) return
                  setDlStatus('preparing')
                  const url = `/academics/exams/${currentExamId}/report-card-pdf?student=${student.id}&v=${Date.now()}`
                  const res = await api.get(url, { responseType: 'blob' })
                  setDlStatus('downloading')
                  const blob = new Blob([res.data], { type: 'application/pdf' })
                  const link = document.createElement('a')
                  link.href = window.URL.createObjectURL(blob)
                  link.download = `report_card_${student?.admission_no || student?.id}.pdf`
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                  setDlStatus('done')
                  // auto reset state after a short delay
                  setTimeout(()=> setDlStatus('idle'), 2000)
                }catch(e){ console.error('PDF download failed', e); setDlStatus('failed') }
              }}
              disabled={dlStatus==='preparing' || dlStatus==='downloading'}
            >
              {dlStatus==='idle' && 'Download PDF'}
              {dlStatus==='preparing' && 'Preparing download…'}
              {dlStatus==='downloading' && 'Downloading…'}
              {dlStatus==='done' && 'Downloaded'}
              {dlStatus==='failed' && 'Failed — Retry'}
            </button>
            <button className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={()=>{ try { window.print() } catch(_) {} }}>Print</button>
          </div>
        </div>
        {rank && (
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded border border-indigo-100">
              <span className="font-medium">Class Position</span>
              <span className="ml-auto">{rank.class?.position || '-'} / {rank.class?.size || '-'}</span>
            </div>
            <div className="flex items-center gap-2 bg-sky-50 text-sky-700 px-3 py-2 rounded border border-sky-100">
              <span className="font-medium">Grade Position</span>
              <span className="ml-auto">{rank.grade?.position || '-'} / {rank.grade?.size || '-'}</span>
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-700 p-3 rounded border border-red-100">{error}</div>}
        {loading && <div className="bg-white p-4 rounded card shadow border border-gray-100">Loading...</div>}

        {!loading && !error && (
          <div className="bg-white rounded card print-container shadow border border-gray-100 overflow-hidden">
            {/* Print header */}
            <div className="print-header hidden print:block">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  {(() => {
                    const rawUrl = (school?.logo_url || user?.school?.logo_url || school?.logo || user?.school?.logo || '')
                    const src = rawUrl ? toAbsoluteUrl(String(rawUrl)) : ''
                    return src && !logoFailed ? (
                      <img src={src} alt="School Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                    ) : <span style={{fontSize:18}}>🏫</span>
                  })()}
                  <div>
                    <div className="text-sm font-semibold">{school?.name || user?.school?.name || 'School'}</div>
                    {(school?.motto || user?.school?.motto) && (
                      <div className="text-xs text-gray-500">{school?.motto || user?.school?.motto}</div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
              </div>
              <div className="text-center text-sm font-medium mt-1">Report Card {latestExamName? `— ${latestExamName}`:''}</div>
            </div>

            <div className="print-body">
            {/* Meta strip */}
            <div className="px-5 py-4 border-b bg-gray-50/60">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Student</div>
                  <div className="mt-0.5 font-medium">{student?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Admission No</div>
                  <div className="mt-0.5 font-medium">{student?.admission_no || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Class</div>
                  <div className="mt-0.5 font-medium">{student?.klass_detail?.name || student?.klass || '-'}</div>
                </div>
              </div>
            </div>

            <div className="p-5">
              {rows.length === 0 ? (
                <div className="text-sm text-gray-600">No results available yet.</div>
              ) : (
                <div className="space-y-4">
                  {/* Teacher + Remarks block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border rounded p-3 bg-white">
                      <div className="text-xs text-gray-500">Class Teacher</div>
                      <div className="font-medium">{teacherName || '-'}</div>
                    </div>
                    <div className="border rounded p-3 bg-white">
                      <div className="text-xs text-gray-500">Remarks</div>
                      <div className="font-medium">
                        {(() => {
                          const avg = Number(totals.average || 0)
                          if (avg >= 80) return 'Excellent performance — keep it up.'
                          if (avg >= 70) return 'Very good work.'
                          if (avg >= 60) return 'Good, aim higher.'
                          if (avg >= 50) return 'Fair — effort needed.'
                          return 'Needs improvement — consult your teacher.'
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-500">Subjects</div>
                  <div className="overflow-hidden rounded border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="text-gray-600">
                          <th className="text-left px-3 py-2 font-medium">Subject</th>
                          <th className="text-right px-3 py-2 font-medium">Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((r, i)=> (
                          <tr key={i} className="hover:bg-gray-50/60">
                            <td className="px-3 py-2">{r.subject}</td>
                            <td className="px-3 py-2 text-right">{r.marks}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr className="border-t">
                          <td className="px-3 py-2 font-medium">Total</td>
                          <td className="px-3 py-2 text-right font-medium">{totals.total.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium">Average</td>
                          <td className="px-3 py-2 text-right font-medium">{totals.average.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Print footer */}
            <div className="print-footer hidden print:flex items-center justify-between px-1">
              <div>{window.location.host}</div>
              <div>EduTrack — Modern School Management</div>
            </div>
          </div>
        )}

        {/* All Exams History (student-facing) */}
        {!loading && !error && (
          <div className="bg-white rounded card shadow border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">All Exams History</h2>
              <div className="text-xs text-gray-500">Published exams only</div>
            </div>
            {examHistory.length === 0 ? (
              <div className="text-sm text-gray-600">No exam history yet.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {examHistory.map(ex => (
                  <li key={ex.id} className="py-2 flex items-center gap-3">
                    <button
                      className={`px-2 py-1 rounded text-xs border ${String(currentExamId)===String(ex.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-50'}`}
                      onClick={()=> setSelectedExamId(ex.id)}
                      title="View this exam"
                    >View</button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{ex.name || `Exam ${ex.id}`}</div>
                      <div className="text-xs text-gray-500">Year {ex.year || '-'} • Term {ex.term || '-'}{ex.grade ? ` • ${ex.grade}` : ''}</div>
                    </div>
                    {ex.grade && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700" title="Grade at time of exam">{ex.grade}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

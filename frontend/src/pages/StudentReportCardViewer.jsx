import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'
import { useAuth } from '../auth'

export default function StudentReportCardViewer({ embedded=false, hideControls=false, hideHistory=false, showTermSelector=true, showExamSelector=true, showBackPrint=true, selectedTermYear: controlledTermYear=null, onSelectedTermYearChange, selectedExamId: controlledExamId=null, onSelectedExamIdChange }){
  const { id } = useParams()
  const studentId = Number(id)
  const { user } = useAuth()
  const [student, setStudent] = useState(null)
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
  const [school, setSchool] = useState(null)
  const [ranks, setRanks] = useState({})

  const termYearOptions = useMemo(()=>{
    const set = new Set()
    const requirePublished = !(
      user?.role === 'admin' || user?.role === 'teacher' || user?.is_staff || user?.is_superuser
    )
    for (const r of examResults){
      const ed = r.exam_detail || {}
      if (requirePublished && !ed?.published) continue
      // Fallbacks: use inferred term or exam date when year/term are not explicitly set
      const inferredTerm = ed.term || ed?.inferred_term?.number || null
      let inferredYear = ed.year || null
      if (!inferredYear) {
        const d = ed?.date ? new Date(ed.date) : null
        if (d && !isNaN(d)) inferredYear = d.getFullYear()
      }
      if (inferredYear && inferredTerm) {
        const key = `${inferredYear}-T${inferredTerm}`
        set.add(key)
      }
    }
    return Array.from(set)
  }, [examResults])

  const [selectedTermYear, setSelectedTermYear] = useState(null)

  useEffect(()=>{
    if (!selectedTermYear && examResults.length){
      for (let i = examResults.length - 1; i >= 0; i--) {
        const ed = examResults[i]?.exam_detail
        const requirePublished = !(
          user?.role === 'admin' || user?.role === 'teacher' || user?.is_staff || user?.is_superuser
        )
        const hasYear = ed?.year || (ed?.date ? !isNaN(new Date(ed.date)) : false)
        const term = ed?.term || ed?.inferred_term?.number
        if ((!requirePublished || ed?.published) && hasYear && term){
          const year = ed?.year || new Date(ed.date).getFullYear()
          setSelectedTermYear(`${year}-T${term}`)
          break
        }
      }
    }
  }, [examResults, selectedTermYear])

  const effectiveTermYear = controlledTermYear || selectedTermYear

  const parsedTermYear = useMemo(()=>{
    if (!effectiveTermYear) return null
    const [y, t] = String(effectiveTermYear).split('-T')
    const year = Number(y)
    const term = Number(t)
    if (!Number.isFinite(year) || !Number.isFinite(term)) return null
    return { year, term }
  }, [effectiveTermYear])

  const termExams = useMemo(()=>{
    if (!parsedTermYear) return []
    const seen = new Set()
    const list = []
    const requirePublished = !(
      user?.role === 'admin' || user?.role === 'teacher' || user?.is_staff || user?.is_superuser
    )
    for (const r of examResults){
      const ed = r.exam_detail || {}
      const id = ed.id || r.exam
      if (!id || seen.has(String(id))) continue
      if (requirePublished && !ed?.published) continue
      const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
      const term = ed.term || ed?.inferred_term?.number || null
      if (year === parsedTermYear.year && term === parsedTermYear.term){
        seen.add(String(id))
        list.push({ id, name: ed.name || String(r.exam || ''), total_marks: ed.total_marks, term, year, grade: ed.grade_level_tag })
      }
    }
    return list
  }, [examResults, parsedTermYear])

  const [selectedExamId, setSelectedExamId] = useState(null)

  const effectiveExamId = controlledExamId || selectedExamId

  const selectedExam = useMemo(()=>{
    if (!effectiveExamId) return null
    return termExams.find(e => String(e.id) === String(effectiveExamId)) || null
  }, [termExams, effectiveExamId])

  useEffect(()=>{
    const exists = effectiveExamId ? termExams.some(e => String(e.id) === String(effectiveExamId)) : false
    if (!exists && termExams.length > 0){
      const fallback = termExams[0]?.id || null
      if (onSelectedExamIdChange){ onSelectedExamIdChange(fallback) } else { setSelectedExamId(fallback) }
    }
  }, [termExams, effectiveExamId, onSelectedExamIdChange])

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      if (!studentId) { setError('Invalid student id'); setLoading(false); return }
      setLoading(true)
      setError('')
      try{
        try{
          const sch = await api.get('/auth/school/info/')
          if (mounted) setSchool(sch.data)
        }catch{}
        const stRes = await api.get(`/academics/students/${studentId}/`)
        if (!mounted) return
        setStudent(stRes.data)
        const exm = await api.get(`/academics/exam_results/?student=${studentId}`)
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
  }, [studentId])

  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!studentId || termExams.length === 0) return
      const next = {}
      for (const ex of termExams){
        try{
          const { data } = await api.get(`/academics/exams/${ex.id}/rank`, { params: { student: studentId } })
          if (!active) return
          next[ex.id] = data
        }catch(_){ /* ignore */ }
      }
      if (active) setRanks(next)
    })()
    return ()=>{ active = false }
  }, [studentId, termExams])

  const toGrade = (score) => {
    const s = Number(score || 0)
    if (s >= 80) return 'A'
    if (s >= 70) return 'B'
    if (s >= 60) return 'C'
    if (s >= 50) return 'D'
    return 'E'
  }

  // Build marks map first so it can be used by subject derivation below
  const marksByExamAndSubject = useMemo(()=>{
    const out = {}
    const requirePublished = !(
      user?.role === 'admin' || user?.role === 'teacher' || user?.is_staff || user?.is_superuser
    )
    for (const r of examResults){
      const ed = r.exam_detail || {}
      if (requirePublished && !ed?.published) continue
      const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
      const term = ed.term || ed?.inferred_term?.number || null
      if (!parsedTermYear || year !== parsedTermYear.year || term !== parsedTermYear.term) continue
      const exId = ed.id || r.exam
      const sid = r.subject_detail?.id || r.subject
      if (!exId || !sid) continue
      out[String(exId)] = out[String(exId)] || {}
      out[String(exId)][String(sid)] = Number(r.marks || 0)
    }
    return out
  }, [examResults, parsedTermYear])

  const subjects = useMemo(()=>{
    // Prefer subjects that have marks for the selected exam
    const map = new Map()
    const byExam = marksByExamAndSubject
    const exId = selectedExam ? String(selectedExam.id) : null
    if (exId && byExam[exId]){
      for (const r of examResults){
        const ed = r.exam_detail || {}
        if (!ed?.published) continue
        if (!parsedTermYear || ed.year !== parsedTermYear.year || ed.term !== parsedTermYear.term) continue
        const sid = r.subject_detail?.id || r.subject
        if (!sid) continue
        if (byExam[exId][String(sid)] === undefined) continue
        if (!map.has(String(sid))){
          const label = r.subject_detail ? `${r.subject_detail.code ? r.subject_detail.code + ' — ' : ''}${r.subject_detail.name || ''}` : String(r.subject || '')
          map.set(String(sid), { id: sid, label })
        }
      }
    }
    // Fallback: show all subjects in the term
    if (map.size === 0){
      for (const r of examResults){
        const ed = r.exam_detail || {}
        const requirePublished = !(
          user?.role === 'admin' || user?.role === 'teacher' || user?.is_staff || user?.is_superuser
        )
        if (requirePublished && !ed?.published) continue
        const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
        const term = ed.term || ed?.inferred_term?.number || null
        if (!parsedTermYear || year !== parsedTermYear.year || term !== parsedTermYear.term) continue
        const sid = r.subject_detail?.id || r.subject
        if (!sid) continue
        if (!map.has(String(sid))){
          const label = r.subject_detail ? `${r.subject_detail.code ? r.subject_detail.code + ' — ' : ''}${r.subject_detail.name || ''}` : String(r.subject || '')
          map.set(String(sid), { id: sid, label })
        }
      }
    }
    return Array.from(map.values())
  }, [examResults, parsedTermYear, selectedExam, marksByExamAndSubject])

  


  const selectedExamMarks = useMemo(()=>{
    if (!selectedExam) return {}
    return marksByExamAndSubject[String(selectedExam.id)] || {}
  }, [marksByExamAndSubject, selectedExam])

  const selectedTotals = useMemo(()=>{
    if (!selectedExam) return { sum: 0, count: 0, avg: 0 }
    let sum = 0
    let count = 0
    for (const subj of subjects){
      const v = selectedExamMarks[String(subj.id)]
      if (Number.isFinite(v)) { sum += v; count += 1 }
    }
    const avg = count ? (sum / count) : 0
    return { sum, count, avg }
  }, [subjects, selectedExam, selectedExamMarks])

  const totals = useMemo(()=>{
    if (subjects.length === 0 || termExams.length === 0) return { total: 0, count: 0, average: 0 }
    let total = 0
    let count = 0
    for (const ex of termExams){
      const m = marksByExamAndSubject[String(ex.id)] || {}
      for (const subj of subjects){
        const v = m[String(subj.id)]
        if (Number.isFinite(v)) { total += v; count += 1 }
      }
    }
    const average = count ? (total / count) : 0
    return { total, count, average }
  }, [subjects, termExams, marksByExamAndSubject])

  const examHistory = useMemo(()=>{
    const map = new Map()
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      if (!id) continue
      if (!map.has(String(id))){
        const ed = r.exam_detail || {}
        const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
        const term = ed.term || ed?.inferred_term?.number || null
        map.set(String(id), { id, name: ed.name || String(r.exam || ''), year: year || null, term: term || null, grade: ed.grade_level_tag || null, published: !!ed.published })
      }
    }
    const seen = new Set()
    const list = []
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      if (id && !seen.has(String(id))){ seen.add(String(id)); const item = map.get(String(id)); if (item) list.push(item) }
    }
    return list
  }, [examResults])

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className={`flex items-center justify-between mb-4 no-print:mb-4 ${hideControls ? 'hidden print:hidden' : ''}`}>
          <div className="flex items-center gap-3">
            {(() => {
              const rawUrl = (school?.logo_url || user?.school?.logo_url || school?.logo || user?.school?.logo || '')
              const src = rawUrl ? toAbsoluteUrl(String(rawUrl)) + (rawUrl.includes('?') ? '' : `?v=${(school?.id||'')}-${(student?.id||'')}`) : ''
              return (src && !logoFailed) ? (
                <img src={src} alt="School Logo" className="w-10 h-10 rounded object-contain bg-white border print:hidden" loading="eager" onError={(e)=>{ try{ e.currentTarget.src=''; }catch(_){} setLogoFailed(true) }} />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-lg print:hidden" aria-label="School Logo Placeholder">🏫</div>
              )
            })()}
            <div className="hidden print:block" />
          </div>
          <div className="flex items-center gap-2">
            {showTermSelector && termYearOptions.length>0 && (
              <select className="px-2 py-1.5 border rounded bg-white text-sm" value={effectiveTermYear || ''} onChange={(e)=> { const v = e.target.value || null; onSelectedTermYearChange ? onSelectedTermYearChange(v) : setSelectedTermYear(v) }} title="Select term">
                {termYearOptions.map(key=> (
                  <option key={key} value={key}>{key.replace('-', ' ')}</option>
                ))}
              </select>
            )}
            {showExamSelector && termExams.length>0 && (
              <select className="px-2 py-1.5 border rounded bg-white text-sm" value={effectiveExamId || ''} onChange={(e)=> { const v = e.target.value || null; onSelectedExamIdChange ? onSelectedExamIdChange(v) : setSelectedExamId(v) }} title="Select exam">
                {termExams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            )}
            {showBackPrint && (
              <>
                <Link to={-1} className="px-3 py-1.5 rounded border hover:bg-gray-50">Back</Link>
                <button className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={()=>{ try { window.print() } catch(_) {} }}>Print</button>
              </>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded border border-red-100">{error}</div>}
        {loading && <div className="bg-white p-4 rounded card shadow border border-gray-100">Loading...</div>}

        {!loading && !error && (
          <div className="bg-[#f6f3ec] border-2 border-[#2e5d5b] relative print:shadow-none shadow rounded-md">
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="text-2xl font-extrabold tracking-wide">{school?.name || user?.school?.name || 'SCHOOL NAME'}</div>
                {(school?.motto || user?.school?.motto) && (
                  <div className="text-base font-semibold text-gray-600 mt-1">{school?.motto || user?.school?.motto}</div>
                )}
              </div>

              <div className="flex items-start justify-between text-sm mb-6">
                <div className="space-y-1">
                  <div className="flex gap-3"><span className="font-semibold">Students name</span><span className="font-medium">{student?.name || '-'}</span></div>
                  <div className="flex gap-3"><span className="font-semibold">Class</span><span className="font-medium">{student?.klass_detail?.name || student?.klass || '-'}</span></div>
                  <div className="flex gap-3"><span className="font-semibold">Grade</span><span className="font-medium">{student?.klass_detail?.grade_level || '-'}</span></div>
                  <div className="flex gap-3"><span className="font-semibold">Admission number</span><span className="font-medium">{student?.admission_no || '-'}</span></div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-semibold">TERM</div>
                  <div className="font-medium">{parsedTermYear ? parsedTermYear.term : '-'}</div>
                  <div className="font-semibold mt-2">ACADEMIC YEAR</div>
                  <div className="font-medium">{parsedTermYear ? parsedTermYear.year : '-'}</div>
                </div>
              </div>

              <div className="border-t border-gray-300 my-4" />

              <div className="text-center text-sm font-semibold tracking-wide mb-3">{selectedExam?.name || 'EXAM NAME'}</div>

              <div className="overflow-hidden">
                <table className="w-full text-sm border border-[#2e5d5b]">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-[#2e5d5b]">Subject</th>
                      <th className="text-center px-3 py-2 border-b border-[#2e5d5b]">Marks</th>
                      <th className="text-center px-3 py-2 border-b border-[#2e5d5b]">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subj)=>{
                      const v = selectedExamMarks[String(subj.id)]
                      return (
                        <tr key={String(subj.id)}>
                          <td className="px-3 py-2 border-t border-gray-300">{subj.label}</td>
                          <td className="px-3 py-2 text-center border-t border-gray-300">{Number.isFinite(v) ? v : '-'}</td>
                          <td className="px-3 py-2 text-center border-t border-gray-300">{Number.isFinite(v) ? toGrade(v) : '-'}</td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td className="px-3 py-2 border-t border-gray-400 font-semibold">Total</td>
                      <td className="px-3 py-2 text-center border-t border-gray-400 font-semibold">{selectedTotals.sum.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center border-t border-gray-400 font-semibold">{selectedTotals.avg.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-300 my-6" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="border border-gray-300 rounded">
                  <div className="px-3 py-2 font-semibold border-b border-gray-300">Class Position</div>
                  <div className="px-3 py-6">{(() => { const rk = selectedExam ? ranks[selectedExam.id] : null; return rk ? `${rk.class?.position || '-'} / ${rk.class?.size || '-'}` : '-' })()}</div>
                </div>
                <div className="border border-gray-300 rounded">
                  <div className="px-3 py-2 font-semibold border-b border-gray-300">Grade Position</div>
                  <div className="px-3 py-6">{(() => { const rk = selectedExam ? ranks[selectedExam.id] : null; return rk ? `${rk.grade?.position || '-'} / ${rk.grade?.size || '-'}` : '-' })()}</div>
                </div>
              </div>

              <div className="border-t border-gray-300 my-6" />

              <div className="grid grid-cols-5 gap-4 text-sm items-start">
                <div className="col-span-2">
                  <div className="font-semibold">Class Teacher Name</div>
                  <div className="mt-2">{(() => {
                    const t = student?.klass_detail?.teacher_detail
                    if (!t) return '-'
                    const first = t.first_name || ''
                    const last = t.last_name || ''
                    const full = `${first} ${last}`.trim()
                    return full || t.username || '-'
                  })()}</div>
                </div>
                <div className="col-span-3">
                  <div className="font-semibold">Remarks</div>
                  <textarea className="mt-2 w-full border rounded p-2 min-h-[72px] resize-none" placeholder="" />
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !hideHistory && (
          <div className="max-w-3xl mx-auto mt-4">
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
                      <div className={`text-[10px] px-2 py-0.5 rounded-full border ${ex.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{ex.published ? 'Published' : 'Draft'}</div>
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
          </div>
        )}
      </div>
    </div>
  )
}

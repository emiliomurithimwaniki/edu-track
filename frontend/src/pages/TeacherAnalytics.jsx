import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js'
import { Bar, Radar, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
  Title,
)

export default function TeacherAnalytics(){
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')

  const [exams, setExams] = useState([])
  const [examA, setExamA] = useState('')
  const [examB, setExamB] = useState('')
  const [examCompare, setExamCompare] = useState(null)

  const [subjectExam, setSubjectExam] = useState('')
  const [subjectOptions, setSubjectOptions] = useState([])
  const [subjectA, setSubjectA] = useState('')
  const [subjectB, setSubjectB] = useState('')
  const [subjectCompare, setSubjectCompare] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('exam') // 'exam' | 'subject'
  const [trend, setTrend] = useState([]) // [{label, mean, examId, date}]
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendStart, setTrendStart] = useState('')
  const [trendEnd, setTrendEnd] = useState('')
  const [trendSubjects, setTrendSubjects] = useState([]) // subject ids to plot
  const trendLineRef = useRef(null)

  // Load teacher's classes
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try{
        setError('')
        const { data } = await api.get('/academics/classes/mine/')
        if (!mounted) return
        const list = Array.isArray(data) ? data : []
        setClasses(list)
        if (list.length){ setSelectedClass(String(list[0].id)) }
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load classes') }
    })()
    return () => { mounted = false }
  }, [])

  const currentClass = useMemo(() => classes.find(c => String(c.id)===String(selectedClass)) || null, [classes, selectedClass])
  const currentGrade = useMemo(() => currentClass?.grade_level || '', [currentClass])

  // Load exams visible to teacher (published or their classes)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try{
        setError('')
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
        // Helper to resolve class id/name on exam object
        const getKlassId = (e) => String(e?.klass ?? e?.class ?? e?.klass_id ?? e?.class_id ?? '')
        // Filter to current grade's exams to reduce noise
        const ofGrade = currentGrade
          ? all.filter(e => {
              const cid = getKlassId(e)
              const cls = classes.find(c => String(c.id)===String(cid))
              return cls && String(cls.grade_level)===String(currentGrade)
            })
          : all
        // Sort desc by date then id
        ofGrade.sort((a,b)=>{
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          if (db !== da) return db - da
          return (b.id||0) - (a.id||0)
        })
        if (mounted){
          setExams(ofGrade)
          setExamA(ofGrade[0]?.id ? String(ofGrade[0].id) : '')
          setExamB(ofGrade[1]?.id ? String(ofGrade[1].id) : (ofGrade[0]?.id ? String(ofGrade[0].id) : ''))
          setSubjectExam(ofGrade[0]?.id ? String(ofGrade[0].id) : '')
        }
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load exams') }
    })()
    return () => { mounted = false }
  }, [currentGrade, classes])

  // Build class trend across exams for the selected class
  useEffect(() => {
    let mounted = true
    const loadTrend = async () => {
      try{
        setTrendLoading(true)
        // Only exams from the selected class
        const classExams = exams.filter(ex => String(ex.klass) === String(selectedClass))
        // Sort by date asc to see progression
        classExams.sort((a,b) => new Date(a.date||0) - new Date(b.date||0))
        // Limit to latest 10 to reduce API calls
        const latest = classExams.slice(-10)
        const summaries = await Promise.all(latest.map(ex => api.get(`/academics/exams/${ex.id}/summary/`).then(r=>({ ex, data: r.data })).catch(()=>({ ex, data: null }))))
        const items = summaries.map(({ ex, data }) => ({
          examId: ex.id,
          label: `${ex.name} ${ex.year} T${ex.term}`,
          mean: typeof data?.class_mean === 'number' ? data.class_mean : null,
          date: ex.date || null,
        }))
        if (mounted) setTrend(items)
      } finally {
        if (mounted) setTrendLoading(false)
      }
    }
    if (Array.isArray(exams) && exams.length) loadTrend()
    else setTrend([])
    return () => { mounted = false }
  }, [exams, selectedClass])

  // Ensure subject options default for current class
  useEffect(() => {
    const subs = Array.isArray(currentClass?.subjects) ? currentClass.subjects : []
    if (subs.length && trendSubjects.length === 0){
      setTrendSubjects(subs.slice(0, 2).map(s => String(s.id)))
    }
  }, [currentClass])

  // Fetch compare exams
  const doCompareExams = async () => {
    if (!examA || !examB) { setExamCompare(null); return }
    try{
      setLoading(true); setError('')
      const { data } = await api.get(`/academics/exams/compare/?exam_a=${encodeURIComponent(examA)}&exam_b=${encodeURIComponent(examB)}`)
      setExamCompare(data)
      setMode('exam')
    }catch(e){ setError(e?.response?.data?.detail || e?.message || 'Failed to compare exams') }
    finally{ setLoading(false) }
  }

  // Load subjects for subject comparison when subjectExam changes
  useEffect(() => {
    const loadSubjects = async () => {
      if (!subjectExam) { setSubjectOptions([]); setSubjectA(''); setSubjectB(''); return }
      try{
        setError('')
        // Use exam summary to get subject list
        const { data } = await api.get(`/academics/exams/${subjectExam}/summary/`)
        const subs = Array.isArray(data?.subjects) ? data.subjects : []
        setSubjectOptions(subs)
        setSubjectA(subs[0]?.id ? String(subs[0].id) : '')
        setSubjectB(subs[1]?.id ? String(subs[1].id) : (subs[0]?.id ? String(subs[0].id) : ''))
      }catch(e){ setSubjectOptions([]) }
    }
    loadSubjects()
  }, [subjectExam])

  const doCompareSubjects = async () => {
    if (!subjectExam || !subjectA || !subjectB) { setSubjectCompare(null); return }
    try{
      setLoading(true); setError('')
      const { data } = await api.get(`/academics/exams/${subjectExam}/compare-subjects/?subject_a=${encodeURIComponent(subjectA)}&subject_b=${encodeURIComponent(subjectB)}`)
      setSubjectCompare(data)
      setMode('subject')
    }catch(e){ setError(e?.response?.data?.detail || e?.message || 'Failed to compare subjects') }
    finally{ setLoading(false) }
  }

  const classNameById = (id) => classes.find(c=>String(c.id)===String(id))?.name || id
  const examLabel = (ex) => `${ex.name} • ${ex.year} • T${ex.term} • ${classNameById(ex.klass)}`
  const subjectName = (sid) => subjectOptions.find(s=>String(s.id)===String(sid))?.name || subjectOptions.find(s=>String(s.id)===String(sid))?.code || sid

  // Subject label resolver for examCompare using the subjects list from summaries
  const subjectLabelFromCompare = (sid) => {
    const sA = examCompare?.exam_a?.summary?.subjects || []
    const sB = examCompare?.exam_b?.summary?.subjects || []
    const all = [...sA, ...sB]
    const found = all.find(s => String(s.id)===String(sid))
    return found?.name || found?.code || sid
  }

  // ===== Chart Data Builders (hooks must be at top-level inside component) =====
  const examCompareBarData = useMemo(() => {
    const rows = examCompare?.deltas?.subject_means || []
    if (!rows.length) return null
    const labels = rows.map(r => subjectLabelFromCompare(r.subject))
    const dataA = rows.map(r => (typeof r.mean_a === 'number' ? r.mean_a : null))
    const dataB = rows.map(r => (typeof r.mean_b === 'number' ? r.mean_b : null))
    return {
      labels,
      datasets: [
        { label: 'Exam A Mean', data: dataA, backgroundColor: 'rgba(37, 99, 235, 0.7)' },
        { label: 'Exam B Mean', data: dataB, backgroundColor: 'rgba(16, 185, 129, 0.7)' },
      ],
    }
  }, [examCompare])

  const examCompareBarOpts = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Subject Means (A vs B)' },
    },
    scales: { y: { beginAtZero: true } },
  }

  const subjectMeansBarData = useMemo(() => {
    if (!subjectCompare) return null
    const a = subjectCompare?.subject_a?.mean_percentage
    const b = subjectCompare?.subject_b?.mean_percentage
    if (a == null && b == null) return null
    return {
      labels: ['Mean %'],
      datasets: [
        { label: subjectName(subjectA), data: [a ?? null], backgroundColor: 'rgba(37, 99, 235, 0.7)' },
        { label: subjectName(subjectB), data: [b ?? null], backgroundColor: 'rgba(16, 185, 129, 0.7)' },
      ],
    }
  }, [subjectCompare, subjectA, subjectB, subjectOptions])

  const subjectMeansBarOpts = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Mean Percentage Comparison' } },
    scales: { y: { beginAtZero: true, max: 100 } },
  }

  const perStudentDeltaBarData = useMemo(() => {
    const rows = subjectCompare?.per_student || []
    if (!rows.length) return null
    const labels = rows.map(r => r.student)
    const deltas = rows.map(r => (typeof r.delta === 'number' ? r.delta : 0))
    return {
      labels,
      datasets: [
        { label: `Δ ${subjectName(subjectB)} - ${subjectName(subjectA)}`, data: deltas, backgroundColor: deltas.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)') },
      ],
    }
  }, [subjectCompare, subjectA, subjectB, subjectOptions])

  const perStudentDeltaBarOpts = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Per-Student Δ (B - A) Percentage' } },
    scales: { y: { beginAtZero: true, suggestedMin: -50, suggestedMax: 50 } },
  }

  // Line chart for class trend over time
  const trendChartData = useMemo(() => {
    if (!trend || !trend.length) return null
    const labels = trend.map(t => t.label)
    const data = trend.map(t => (typeof t.mean === 'number' ? t.mean : null))
    return {
      labels,
      datasets: [
        {
          label: 'Class Mean',
          data,
          borderColor: 'rgba(37, 99, 235, 1)',
          backgroundColor: 'rgba(37, 99, 235, 0.2)',
          tension: 0.3,
          spanGaps: true,
        },
      ],
    }
  }, [trend])
  const trendChartOpts = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Class Mean Over Time' } },
    scales: { y: { beginAtZero: true } },
  }

  // Subject-specific trends over time (per-subject mean)
  const subjectTrend = useMemo(() => {
    if (!Array.isArray(exams) || exams.length === 0) return { labels: [], series: [] }
    // Filter exams for the current class and date range
    const inClass = exams.filter(ex => String(ex.klass) === String(selectedClass))
    const inRange = inClass.filter(ex => {
      const d = ex.date ? new Date(ex.date) : null
      if (!d) return false
      const afterStart = trendStart ? d >= new Date(trendStart) : true
      const beforeEnd = trendEnd ? d <= new Date(trendEnd) : true
      return afterStart && beforeEnd
    })
    // Sort asc and cap to 15 to limit API traffic
    inRange.sort((a,b) => new Date(a.date||0) - new Date(b.date||0))
    const limited = inRange.slice(-15)
    return { labels: limited.map(ex => `${ex.name} ${ex.year} T${ex.term}`), exams: limited }
  }, [exams, selectedClass, trendStart, trendEnd])

  const [subjectTrendDatasets, setSubjectTrendDatasets] = useState([]) // computed datasets aligned to subjectTrend.labels

  useEffect(() => {
    let mounted = true
    const build = async () => {
      const subsToPlot = trendSubjects
      if (!subjectTrend.exams || subjectTrend.exams.length === 0 || subsToPlot.length === 0){
        if (mounted) setSubjectTrendDatasets([])
        return
      }
      // Fetch summaries for these exams
      const summaries = await Promise.all(subjectTrend.exams.map(ex => api.get(`/academics/exams/${ex.id}/summary/`).then(r=>r.data).catch(()=>null)))
      // For each subject, assemble mean over exams
      const palette = [
        'rgba(37, 99, 235, 1)','rgba(16, 185, 129, 1)','rgba(234, 88, 12, 1)','rgba(147, 51, 234, 1)',
        'rgba(236, 72, 153, 1)','rgba(5, 150, 105, 1)','rgba(59, 130, 246, 1)','rgba(217, 119, 6, 1)'
      ]
      const datasets = subsToPlot.map((sid, idx) => {
        const color = palette[idx % palette.length]
        const data = summaries.map(sum => {
          if (!sum) return null
          const item = (sum.subject_means || []).find(m => String(m.subject) === String(sid))
          return typeof item?.mean === 'number' ? item.mean : null
        })
        return {
          label: (currentClass?.subjects || []).find(s => String(s.id)===String(sid))?.name || sid,
          data,
          borderColor: color,
          backgroundColor: color.replace('1)', '0.2)'),
          tension: 0.3,
          spanGaps: true,
        }
      })
      if (mounted) setSubjectTrendDatasets(datasets)
    }
    build()
    return () => { mounted = false }
  }, [subjectTrend, trendSubjects, currentClass])

  const subjectTrendChartData = useMemo(() => {
    if (!subjectTrend.labels?.length || !subjectTrendDatasets.length) return null
    return { labels: subjectTrend.labels, datasets: subjectTrendDatasets }
  }, [subjectTrend, subjectTrendDatasets])

  const subjectTrendChartOpts = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Subject Mean Over Time' } },
    scales: { y: { beginAtZero: true } },
  }

  const exportTrendPNG = () => {
    try{
      const chart = trendLineRef.current
      if (chart && typeof chart.toBase64Image === 'function'){
        const url = chart.toBase64Image('image/png', 1)
        const a = document.createElement('a')
        a.href = url
        a.download = 'trend.png'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    }catch{}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Analytics</h1>
          <div className="text-xs text-gray-600">Analyze results and compare exams or subjects</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Class
            <select className="border p-2 rounded ml-2" value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded border border-red-200">{error}</div>}

      {/* Mode switcher */}
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-700">View:</div>
        <div className="inline-flex rounded border overflow-hidden">
          <button type="button" onClick={()=>setMode('exam')} className={`px-3 py-1 text-sm ${mode==='exam' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}>Exam vs Exam</button>
          <button type="button" onClick={()=>setMode('subject')} className={`px-3 py-1 text-sm border-l ${mode==='subject' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}>Subject vs Subject</button>
        </div>
      </div>

      {mode === 'exam' && (
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">Compare Exams</div>
            <button onClick={doCompareExams} className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm hover:bg-gray-800">Compare</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-sm">Exam A
              <select className="border p-2 rounded ml-2" value={examA} onChange={e=>setExamA(e.target.value)}>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{examLabel(ex)}</option>)}
              </select>
            </label>
            <label className="text-sm">Exam B
              <select className="border p-2 rounded ml-2" value={examB} onChange={e=>setExamB(e.target.value)}>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{examLabel(ex)}</option>)}
              </select>
            </label>
          </div>
          {!examCompare ? (
            <div className="text-sm text-gray-600">Select two exams and click Compare.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">Class Mean Δ: <b>{examCompare?.deltas?.class_mean_delta ?? '-'}</b></div>
              {examCompareBarData && (
                <div className="bg-white p-2 rounded border">
                  <Bar data={examCompareBarData} options={examCompareBarOpts} />
                </div>
              )}
              {trendChartData && (
                <div className="bg-white p-2 rounded border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Class Mean Over Time</div>
                    <button onClick={exportTrendPNG} className="px-2 py-1 text-xs rounded bg-gray-800 text-white hover:bg-gray-700">Export PNG</button>
                  </div>
                  <Line ref={trendLineRef} data={trendChartData} options={trendChartOpts} />
                </div>
              )}
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1 text-left">Subject</th>
                      <th className="border px-2 py-1 text-left">Mean A</th>
                      <th className="border px-2 py-1 text-left">Mean B</th>
                      <th className="border px-2 py-1 text-left">Δ (B - A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(examCompare?.deltas?.subject_means || []).map(row => (
                      <tr key={row.subject}>
                        <td className="border px-2 py-1">{subjectLabelFromCompare(row.subject)}</td>
                        <td className="border px-2 py-1">{row.mean_a ?? '-'}</td>
                        <td className="border px-2 py-1">{row.mean_b ?? '-'}</td>
                        <td className={`border px-2 py-1 ${typeof row.delta==='number' ? (row.delta>=0 ? 'text-emerald-700' : 'text-red-700') : ''}`}>{row.delta ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'subject' && (
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">Compare Subjects (within an exam)</div>
            <button onClick={doCompareSubjects} className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm hover:bg-gray-800">Compare</button>
          </div>
          {/* Subject trends controls */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-sm">From
              <input type="date" className="border p-2 rounded ml-2" value={trendStart} onChange={e=>setTrendStart(e.target.value)} />
            </label>
            <label className="text-sm">To
              <input type="date" className="border p-2 rounded ml-2" value={trendEnd} onChange={e=>setTrendEnd(e.target.value)} />
            </label>
            <label className="text-sm">Subjects
              <select multiple className="border p-2 rounded ml-2 min-w-[180px]" value={trendSubjects} onChange={e=> setTrendSubjects(Array.from(e.target.selectedOptions).map(o=>o.value))}>
                {(currentClass?.subjects || []).map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name || s.code}</option>
                ))}
              </select>
            </label>
          </div>
          {subjectTrendChartData && (
            <div className="bg-white p-2 rounded border mb-4">
              <div className="text-sm font-medium mb-2">Subject Mean Over Time</div>
              <Line data={subjectTrendChartData} options={subjectTrendChartOpts} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-sm">Exam
              <select className="border p-2 rounded ml-2" value={subjectExam} onChange={e=>setSubjectExam(e.target.value)}>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{examLabel(ex)}</option>)}
              </select>
            </label>
            <label className="text-sm">Subject A
              <select className="border p-2 rounded ml-2" value={subjectA} onChange={e=>setSubjectA(e.target.value)}>
                {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name || s.code}</option>)}
              </select>
            </label>
            <label className="text-sm">Subject B
              <select className="border p-2 rounded ml-2" value={subjectB} onChange={e=>setSubjectB(e.target.value)}>
                {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name || s.code}</option>)}
              </select>
            </label>
          </div>
          {!subjectCompare ? (
            <div className="text-sm text-gray-600">Pick an exam and two subjects, then click Compare.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">Mean % {subjectName(subjectA)}: <b>{subjectCompare?.subject_a?.mean_percentage ?? '-'}</b></div>
              <div className="text-sm">Mean % {subjectName(subjectB)}: <b>{subjectCompare?.subject_b?.mean_percentage ?? '-'}</b></div>
              <div className="text-sm">Mean % Δ (B - A): <b>{subjectCompare?.deltas?.mean_percentage_delta ?? '-'}</b></div>
              {subjectMeansBarData && (
                <div className="bg-white p-2 rounded border">
                  <Bar data={subjectMeansBarData} options={subjectMeansBarOpts} />
                </div>
              )}
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1 text-left">Student</th>
                      <th className="border px-2 py-1 text-left">A %</th>
                      <th className="border px-2 py-1 text-left">B %</th>
                      <th className="border px-2 py-1 text-left">Δ (B - A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(subjectCompare?.per_student || []).map(row => (
                      <tr key={row.student_id}>
                        <td className="border px-2 py-1">{row.student}</td>
                        <td className="border px-2 py-1">{row.a_pct ?? '-'}</td>
                        <td className="border px-2 py-1">{row.b_pct ?? '-'}</td>
                        <td className={`border px-2 py-1 ${typeof row.delta==='number' ? (row.delta>=0 ? 'text-emerald-700' : 'text-red-700') : ''}`}>{row.delta ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {perStudentDeltaBarData && (
                <div className="bg-white p-2 rounded border">
                  <Bar data={perStudentDeltaBarData} options={perStudentDeltaBarOpts} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading && <div className="bg-white rounded shadow p-3">Loading…</div>}
    </div>
  )
}

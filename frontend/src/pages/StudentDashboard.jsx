import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'

export default function StudentDashboard(){
  const [student, setStudent] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [attendance, setAttendance] = useState([])
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invoices, setInvoices] = useState([])
  const [summary, setSummary] = useState({ total_billed: 0, total_paid: 0, balance: 0 })
  const [showPay, setShowPay] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', method: 'mpesa', reference: '' })
  const [payError, setPayError] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [tab, setTab] = useState('dashboard') // dashboard | academics | finance
  // Derived: performance data over time (average marks per exam)
  const performance = useMemo(() => {
    if (!Array.isArray(examResults) || examResults.length === 0) return []
    const byExam = new Map()
    for (const r of examResults) {
      const key = r.exam || 'Exam'
      const entry = byExam.get(key) || { sum: 0, count: 0 }
      entry.sum += Number(r.marks || 0)
      entry.count += 1
      byExam.set(key, entry)
    }
    // Keep insertion order as returned by API
    return Array.from(byExam.entries()).map(([label, { sum, count }]) => ({ label, avg: count ? (sum / count) : 0 }))
  }, [examResults])

  useEffect(()=>{
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        // Load the current student first
        const stRes = await api.get('/academics/students/my/')
        const st = stRes.data
        if (!mounted) return
        setStudent(st)

        // Load finances and records in parallel
        const [assRes, attRes, exmRes, invRes, sumRes] = await Promise.all([
          api.get(`/academics/assessments/?student=${st.id}`),
          api.get(`/academics/attendance/?student=${st.id}`),
          api.get(`/academics/exam_results/?student=${st.id}`),
          api.get('/finance/invoices/my/'),
          api.get('/finance/invoices/my-summary/'),
        ])
        if (!mounted) return
        setAssessments(assRes.data)
        setAttendance(attRes.data)
        setExamResults(exmRes.data)
        setInvoices(invRes.data)
        setSummary(sumRes.data)
      } catch (e) {
        if (!mounted) return
        setError(e?.response?.data?.detail || e?.message || 'Failed to load your dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  },[])

  const classLabel = useMemo(() => {
    const k = student?.klass_detail
    if (!k) return student?.klass || '-'
    return `${k.name} • ${k.grade_level}`
  }, [student])

  function money(n){
    try {
      const val = Number(n || 0)
      return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val)
    } catch {
      return `Ksh. ${n}`
    }
  }

  const openPay = (invoice) => {
    setSelectedInvoice(invoice)
    setPayForm({ amount: '', method: 'mpesa', reference: '' })
    setPayError('')
    setShowPay(true)
  }

  const submitPay = async (e) => {
    e.preventDefault()
    if (!selectedInvoice) return
    setPaySubmitting(true)
    setPayError('')
    try {
      const payload = { amount: parseFloat(payForm.amount || 0), method: payForm.method, reference: payForm.reference }
      if (!payload.amount || isNaN(payload.amount) || payload.amount <= 0) {
        setPayError('Enter a valid amount greater than 0')
        setPaySubmitting(false)
        return
      }
      await api.post(`/finance/invoices/${selectedInvoice.id}/pay/`, payload)
      // Refresh
      const [invRes, sumRes] = await Promise.all([
        api.get('/finance/invoices/my/'),
        api.get('/finance/invoices/my-summary/'),
      ])
      setInvoices(invRes.data)
      setSummary(sumRes.data)
      setShowPay(false)
    } catch (err) {
      setPayError(err?.response?.data ? (err.response.data.detail || JSON.stringify(err.response.data)) : (err?.message || 'Payment failed'))
    } finally {
      setPaySubmitting(false)
    }
  }
  return (
    <div className="p-6 space-y-6">
      {/* Header banner */}
      <div className="bg-green-600 text-white rounded shadow p-3 flex items-center justify-between">
        <div className="font-medium">Welcome {student?.name ? student.name.toUpperCase() : ''}</div>
        <div className="flex items-center gap-3">
          <div className="text-xs opacity-90">Dashboard</div>
          <Link to="/student/messages" className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs">Messages</Link>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded shadow p-4">Loading...</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          className={`px-3 py-1.5 rounded ${tab==='dashboard'?'bg-blue-600 text-white':'bg-gray-100 text-gray-800'}`}
          onClick={()=>setTab('dashboard')}
        >Dashboard</button>
        <button
          className={`px-3 py-1.5 rounded ${tab==='academics'?'bg-blue-600 text-white':'bg-gray-100 text-gray-800'}`}
          onClick={()=>setTab('academics')}
        >Academics</button>
        <button
          className={`px-3 py-1.5 rounded ${tab==='finance'?'bg-blue-600 text-white':'bg-gray-100 text-gray-800'}`}
          onClick={()=>setTab('finance')}
        >Finance</button>
      </div>

      {tab === 'dashboard' && (
        <>
          {/* Summary cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-amber-500 text-white rounded shadow p-4">
              <div className="text-sm opacity-90">Total Billed</div>
              <div className="text-2xl font-semibold">{money(summary.total_billed)}</div>
              <div className="text-xs mt-1 opacity-90">All time invoiced</div>
            </div>
            <div className="bg-green-600 text-white rounded shadow p-4">
              <div className="text-sm opacity-90">Total Paid</div>
              <div className="text-2xl font-semibold">{money(summary.total_paid)}</div>
              <div className="text-xs mt-1 opacity-90">All time payments</div>
            </div>
            <div className="bg-sky-600 text-white rounded shadow p-4">
              <div className="text-sm opacity-90">Balance</div>
              <div className="text-2xl font-semibold">{money(summary.balance)}</div>
              <div className="text-xs mt-1 opacity-90">Outstanding</div>
            </div>
          </div>

          {/* User Profile */}
          {student && (
            <div className="bg-white rounded shadow p-0 overflow-hidden">
              <div className="border-b px-4 py-2 font-medium">User Profile</div>
              <div className="grid md:grid-cols-3 gap-0">
                <div className="p-4 border-r">
                  <div className="w-40 h-40 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-400 text-6xl">👤</div>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-gray-600">{student.admission_no}</div>
                </div>
                <div className="md:col-span-2 p-4">
                  <div className="text-gray-700 font-medium mb-3">Personal Information</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    <div>
                      <div className="text-gray-500">Admission No</div>
                      <div className="font-medium">{student.admission_no}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Full Name</div>
                      <div className="font-medium uppercase">{student.name}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Passport No</div>
                      <div className="font-medium">{student.passport_no || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Phone Number</div>
                      <div className="font-medium">{student.phone || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Gender</div>
                      <div className="font-medium">{student.gender || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Date of Birth</div>
                      <div className="font-medium">{student.dob}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Class</div>
                      <div className="font-medium">{classLabel}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Guardian ID/Phone</div>
                      <div className="font-medium">{student.guardian_id || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Email</div>
                      <div className="font-medium">{student.email || '-'}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-gray-500">Postal Address</div>
                      <div className="font-medium">{student.address || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'academics' && (
        <>
          {/* Assessments and Attendance */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded shadow p-4">
              <h2 className="font-medium mb-2">Assessments</h2>
              {assessments.length === 0 ? (
                <div className="text-sm text-gray-500">No assessments yet.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Competency</th>
                      <th>Level</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map(a => (
                      <tr key={a.id} className="border-t">
                        <td>{a.competency}</td>
                        <td>{a.level}</td>
                        <td>{a.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white rounded shadow p-4">
              <h2 className="font-medium mb-2">Attendance</h2>
              {attendance.length === 0 ? (
                <div className="text-sm text-gray-500">No attendance records yet.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map(at => (
                      <tr key={at.id} className="border-t">
                        <td>{at.date}</td>
                        <td className="capitalize">{at.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Performance Over Time */}
          <div className="bg-white rounded shadow p-4">
            <h2 className="font-medium mb-3">Performance Over Time</h2>
            {performance.length === 0 ? (
              <div className="text-sm text-gray-500">No exam performance data yet.</div>
            ) : (
              <ResponsiveLine data={performance} />
            )}
          </div>

          {/* Exam Results */}
          <div className="bg-white rounded shadow p-4">
            <h2 className="font-medium mb-2">Exam Results</h2>
            {examResults.length === 0 ? (
              <div className="text-sm text-gray-500">No exam results yet.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Subject</th>
                    <th>Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {examResults.map(r => (
                    <tr key={r.id} className="border-t">
                      <td>{r.exam}</td>
                      <td>{r.subject}</td>
                      <td>{r.marks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'finance' && (
      <div className="bg-white rounded shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">My Fees</h2>
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="mr-4">Billed: <strong>{Number(summary.total_billed||0).toLocaleString()}</strong></span>
              <span className="mr-4">Paid: <strong>{Number(summary.total_paid||0).toLocaleString()}</strong></span>
              <span>Balance: <strong className={Number(summary.balance)>0? 'text-red-700':''}>{Number(summary.balance||0).toLocaleString()}</strong></span>
            </div>
            {/* Top-level Make Payment button */}
            {invoices.some(inv => inv.status==='unpaid' || inv.status==='partial') && (
              <button
                onClick={()=>{
                  const unpaid = invoices.filter(inv => inv.status==='unpaid' || inv.status==='partial')
                  setSelectedInvoice(unpaid[0] || null)
                  setPayForm({ amount: '', method: 'mpesa', reference: '' })
                  setPayError('')
                  setShowPay(true)
                }}
                className="px-3 py-1.5 rounded text-white bg-green-600 hover:bg-green-700"
              >
                Make Payment
              </button>
            )}
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead><tr><th>Date</th><th>Category</th><th>Year/Term</th><th>Amount</th><th>Status</th><th>Due</th><th></th></tr></thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-t">
                <td className="py-1.5">{new Date(inv.created_at).toLocaleDateString()}</td>
                <td>{inv.category_detail?.name || '-'}</td>
                <td>{inv.year ? `${inv.year} / T${inv.term}` : '-'}</td>
                <td>{Number(inv.amount).toLocaleString()}</td>
                <td>{inv.status}</td>
                <td>{inv.due_date || '-'}</td>
                <td className="text-right">
                  {(inv.status === 'unpaid' || inv.status === 'partial') && (
                    <button onClick={()=>openPay(inv)} className="px-3 py-1.5 rounded text-white bg-green-600 hover:bg-green-700">Pay</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Pay Modal */}
      <Modal open={showPay} onClose={()=>setShowPay(false)} title={selectedInvoice ? `Pay Invoice #${selectedInvoice.id}` : 'Pay Invoice'} size="sm">
        {selectedInvoice && (
          <form onSubmit={submitPay} className="grid gap-3">
            {/* Allow selecting which invoice to pay when multiple invoices are due */}
            {invoices.filter(inv => inv.status==='unpaid' || inv.status==='partial').length > 1 && (
              <select
                className="border p-2 rounded"
                value={selectedInvoice?.id || ''}
                onChange={e => {
                  const inv = invoices.find(x => String(x.id) === e.target.value)
                  setSelectedInvoice(inv || selectedInvoice)
                }}
              >
                {invoices.filter(inv => inv.status==='unpaid' || inv.status==='partial').map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {(inv.category_detail?.name || 'General')} — {inv.year? `${inv.year}/T${inv.term}`:'-'} — {Number(inv.amount).toLocaleString()} ({inv.status})
                  </option>
                ))}
              </select>
            )}
            <div className="text-sm text-gray-700">Category: <strong>{selectedInvoice.category_detail?.name || '-'}</strong></div>
            <div className="text-sm text-gray-700">Amount Due: <strong>{Number(selectedInvoice.amount).toLocaleString()}</strong></div>
            {payError && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{payError}</div>}
            <input className="border p-2 rounded" type="number" step="0.01" placeholder="Amount" value={payForm.amount} onChange={e=>setPayForm({...payForm, amount:e.target.value})} required />
            <select className="border p-2 rounded" value={payForm.method} onChange={e=>setPayForm({...payForm, method:e.target.value})}>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
            <input className="border p-2 rounded" placeholder="Reference (optional)" value={payForm.reference} onChange={e=>setPayForm({...payForm, reference:e.target.value})} />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded border" onClick={()=>setShowPay(false)}>Cancel</button>
              <button className="px-4 py-2 rounded text-white bg-green-600 disabled:opacity-60" disabled={paySubmitting}>{paySubmitting ? 'Paying...' : 'Pay'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

// Lightweight responsive line chart component (no external deps)
function ResponsiveLine({ data }){
  // dimensions
  const height = 220
  const padding = { top: 20, right: 20, bottom: 36, left: 36 }
  const width = Math.min(900, Math.max(320, (typeof window !== 'undefined' ? window.innerWidth - 120 : 600)))
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const xs = data.map((_, i) => i)
  const ys = data.map(d => Number(d.avg) || 0)
  const xMin = 0
  const xMax = Math.max(1, xs.length - 1)
  const yMin = 0
  const yMax = Math.max(100, Math.ceil(Math.max(...ys, 0) / 10) * 10)
  const xScale = i => padding.left + (innerW * (i - xMin) / (xMax - xMin || 1))
  const yScale = v => padding.top + innerH - (innerH * (v - yMin) / (yMax - yMin || 1))
  const points = xs.map((i, idx) => `${xScale(i)},${yScale(ys[idx])}`).join(' ')
  const gridY = [0, 25, 50, 75, 100].map(p => yMin + (p/100) * (yMax - yMin))
  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Performance line chart">
        {/* grid */}
        {gridY.map((g, idx) => (
          <line key={idx} x1={padding.left} y1={yScale(g)} x2={width - padding.right} y2={yScale(g)} stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {/* axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#9ca3af" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#9ca3af" />
        {/* y-axis labels */}
        {gridY.map((g, idx) => (
          <text key={idx} x={padding.left - 6} y={yScale(g) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(g)}</text>
        ))}
        {/* x-axis labels */}
        {data.map((d, i) => (
          <text key={i} x={xScale(i)} y={height - padding.bottom + 14} textAnchor="middle" fontSize="10" fill="#6b7280">
            {String(d.label).slice(0, 10)}
          </text>
        ))}
        {/* line */}
        <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={points} />
        {/* points */}
        {data.map((d, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(Number(d.avg)||0)} r="3" fill="#1d4ed8" />
        ))}
      </svg>
    </div>
  )
}

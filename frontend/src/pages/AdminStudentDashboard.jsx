import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import api from '../api'

export default function AdminStudentDashboard() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [attendance, setAttendance] = useState([])
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [finance, setFinance] = useState({ total_billed: 0, total_paid: 0, balance: 0 })
  const [uploading, setUploading] = useState(false)
  const [classes, setClasses] = useState([])
  const [showEdit, setShowEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editErr, setEditErr] = useState('')
  const [form, setForm] = useState({
    name: '',
    dob: '',
    gender: '',
    klass: '',
    guardian_id: '',
    email: '',
    address: '',
    passport_no: ''
  })

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        setLoading(true)
        setError('')
        const [st, asRes, atRes, exRes, fin, cl] = await Promise.all([
          api.get(`/academics/students/${id}/`),
          api.get(`/academics/assessments/?student=${id}`),
          api.get(`/academics/attendance/?student=${id}`),
          api.get(`/academics/exam_results/?student=${id}`),
          api.get(`/finance/invoices/student-summary?student=${id}`),
          api.get('/academics/classes/')
        ])
        if (!isMounted) return
        setStudent(st.data)
        setAssessments(asRes.data)
        setAttendance(atRes.data)
        setExamResults(exRes.data)
        setFinance(fin.data)
        setClasses(cl.data)
      } catch (e) {
        if (!isMounted) return
        setError(e?.response?.data?.detail || e?.message || 'Failed to load student dashboard')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [id])

  async function onPhotoChange(e){
    const file = e.target.files?.[0]
    if (!file) return
    try{
      setUploading(true)
      const fd = new FormData()
      fd.append('photo', file)
      await api.patch(`/academics/students/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' }})
      const { data } = await api.get(`/academics/students/${id}/`)
      setStudent(data)
    } finally{
      setUploading(false)
      e.target.value = ''
    }
  }

  const classLabel = useMemo(() => {
    const k = student?.klass_detail
    if (!k) return student?.klass || '-'
    return `${k.name} • ${k.grade_level}`
  }, [student])

  function openEdit(){
    if (!student) return
    setEditErr('')
    setForm({
      name: student.name || '',
      dob: student.dob || '',
      gender: student.gender || '',
      klass: student.klass || student.klass_detail?.id || '',
      guardian_id: student.guardian_id || '',
      email: student.email || '',
      address: student.address || '',
      passport_no: student.passport_no || ''
    })
    setShowEdit(true)
  }

  async function saveEdit(e){
    e?.preventDefault?.()
    try{
      setSaving(true)
      setEditErr('')
      const payload = {
        name: form.name,
        dob: form.dob,
        gender: form.gender,
        guardian_id: form.guardian_id,
        email: form.email,
        address: form.address,
        passport_no: form.passport_no,
        klass: form.klass || null
      }
      await api.patch(`/academics/students/${id}/`, payload)
      const { data } = await api.get(`/academics/students/${id}/`)
      setStudent(data)
      setShowEdit(false)
    } catch(err){
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed to update student')
      setEditErr(msg)
    } finally{
      setSaving(false)
    }
  }

  function money(n){
    try {
      const val = Number(n || 0)
      return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val)
    } catch {
      return `Ksh. ${n}`
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <div className="text-sm text-gray-500"><Link to="/admin" className="hover:underline">Admin</Link> / <Link to="/admin/students" className="hover:underline">Students</Link> / <span className="text-gray-700">Dashboard</span></div>
        {/* Header banner */}
        <div className="bg-green-600 text-white rounded shadow p-3 flex items-center justify-between">
          <div className="font-medium">Welcome {student?.name ? student.name.toUpperCase() : ''}</div>
          <div className="text-xs opacity-90">Dashboard</div>
        </div>

        {loading && (
          <div className="bg-white rounded shadow p-4">Loading...</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>
        )}

        {/* Quick actions */}
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/admin/students/${id}/payments`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            <span>➕</span>
            <span>Make Payment</span>
          </Link>
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <span>✏️</span>
            <span>Edit Details</span>
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-amber-500 text-white rounded shadow p-4">
            <div className="text-sm opacity-90">Total Billed</div>
            <div className="text-2xl font-semibold">{money(finance.total_billed)}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs opacity-90">All time invoiced</div>
              <Link className="text-xs underline" to={`/admin/students/${id}/invoices`}>View Details</Link>
            </div>
          </div>
          <div className="bg-green-600 text-white rounded shadow p-4">
            <div className="text-sm opacity-90">Total Paid</div>
            <div className="text-2xl font-semibold">{money(finance.total_paid)}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs opacity-90">All time payments</div>
              <Link className="text-xs underline" to={`/admin/students/${id}/payments`}>View Details</Link>
            </div>
          </div>
          <div className="bg-sky-600 text-white rounded shadow p-4">
            <div className="text-sm opacity-90">Balance</div>
            <div className="text-2xl font-semibold">{money(finance.balance)}</div>
            <div className="text-xs mt-1 opacity-90">Outstanding</div>
          </div>
        </div>

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
                <label className="inline-flex mt-2 text-xs text-blue-600 hover:underline cursor-pointer">
                  <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                  {uploading ? 'Uploading...' : 'Change Photo'}
                </label>
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
      </div>
      {/* Edit Student Modal */}
      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title="Edit Student Details" size="lg">
        <form onSubmit={saveEdit} className="space-y-4">
          {editErr && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">{editErr}</div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Full Name</label>
              <input className="w-full border rounded px-3 py-2" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Class</label>
              <select className="w-full border rounded px-3 py-2" value={form.klass} onChange={e=>setForm({...form, klass:e.target.value})}>
                <option value="">Not Assigned</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Gender</label>
              <select className="w-full border rounded px-3 py-2" value={form.gender} onChange={e=>setForm({...form, gender:e.target.value})}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Date of Birth</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Guardian Phone</label>
              <input className="w-full border rounded px-3 py-2" value={form.guardian_id} onChange={e=>setForm({...form, guardian_id:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border rounded px-3 py-2" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Passport No</label>
              <input className="w-full border rounded px-3 py-2" value={form.passport_no} onChange={e=>setForm({...form, passport_no:e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Address</label>
              <input className="w-full border rounded px-3 py-2" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={()=>setShowEdit(false)} className="px-4 py-2 border rounded">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}

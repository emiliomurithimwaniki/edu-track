import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'
import { Link } from 'react-router-dom'

export default function AdminTeachers(){
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ user_id:'', subjects:'', klass:'' })
  const [newTeacher, setNewTeacher] = useState({ username:'', password:'', first_name:'', last_name:'', email:'' })
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showAssign, setShowAssign] = useState(false)

  const { showSuccess, showError } = useNotification()

  const load = async () => {
    try {
      setLoading(true)
      const [t, cl, u] = await Promise.all([
        api.get('/academics/teachers/'),
        api.get('/academics/classes/'),
        api.get('/auth/users/?role=teacher')
      ])
      const tArr = Array.isArray(t.data) ? t.data : (Array.isArray(t.data?.results) ? t.data.results : [])
      const clArr = Array.isArray(cl.data) ? cl.data : (Array.isArray(cl.data?.results) ? cl.data.results : [])
      const uArr = Array.isArray(u.data) ? u.data : (Array.isArray(u.data?.results) ? u.data.results : [])
      setTeachers(tArr)
      setClasses(clArr)
      setUsers(uArr)
    } catch (e) {
      showError('Failed to Load Teachers', 'There was a problem loading teachers data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=>{ load() },[])

  const create = async (e) => {
    e.preventDefault()
    try {
      setAssigning(true)
      await api.post('/academics/teachers/', { ...form, klass: form.klass || null })
      setForm({ user_id:'', subjects:'', klass:'' })
      load()
      showSuccess('Teacher Assigned', 'Teacher has been successfully assigned to subjects and class.')
    } catch (err) {
      showError('Failed to Assign Teacher', 'There was an error assigning the teacher. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  const createTeacherUser = async (e) => {
    e.preventDefault()
    try {
      setCreating(true)
      const { data } = await api.post('/auth/users/create/', { ...newTeacher, role: 'teacher' })
      // refresh user list and preselect the newly created user
      const res = await api.get('/auth/users/?role=teacher')
      const uArr = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.results) ? res.data.results : [])
      setUsers(uArr)
      setForm(f => ({ ...f, user_id: data.id }))
      setNewTeacher({ username:'', password:'', first_name:'', last_name:'', email:'' })
      showSuccess('Teacher User Created', `Teacher user account for ${data.first_name} ${data.last_name} has been created successfully.`)
    } catch (err) {
      showError('Failed to Create Teacher User', 'There was an error creating the teacher user account. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter(t => {
      const u = t.user || {}
      const name = `${u.username || ''} ${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
      const subjects = (t.subjects || '').toLowerCase()
      const klass = `${t.klass_detail?.name || ''}`.toLowerCase()
      return name.includes(q) || subjects.includes(q) || klass.includes(q)
    })
  }, [teachers, search])

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Teachers</h1>
            <p className="text-sm text-gray-600">Create teacher accounts, assign subjects and class, and manage the directory.</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible py-1 -mx-1 px-1">
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{teachers.length} Teachers</span>
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{classes.length} Classes</span>
            <Link to="/admin/subjects" className="shrink-0 px-3 py-1.5 rounded border hover:bg-gray-50">Subjects</Link>
            <button onClick={()=>setShowCreateUser(true)} className="shrink-0 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white">Create Teacher User</button>
            <button onClick={()=>setShowAssign(true)} className="shrink-0 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white">Assign Subjects & Class</button>
          </div>
        </div>

        {/* Action Modals */}
        <Modal open={showCreateUser} onClose={()=>setShowCreateUser(false)} title="Create Teacher User" size="lg">
          <form onSubmit={createTeacherUser} className="grid gap-3 md:grid-cols-3">
            <input className="border p-2 rounded" placeholder="Username" value={newTeacher.username} onChange={e=>setNewTeacher({...newTeacher, username:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Password" type="password" value={newTeacher.password} onChange={e=>setNewTeacher({...newTeacher, password:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Email" type="email" value={newTeacher.email} onChange={e=>setNewTeacher({...newTeacher, email:e.target.value})} />
            <input className="border p-2 rounded" placeholder="First name" value={newTeacher.first_name} onChange={e=>setNewTeacher({...newTeacher, first_name:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Last name" value={newTeacher.last_name} onChange={e=>setNewTeacher({...newTeacher, last_name:e.target.value})} />
            <div className="md:col-span-3 flex justify-end">
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow" disabled={creating}>
                {creating? 'Creating...' : 'Create Teacher User'}
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-500 mt-2">After creating a teacher user, they will appear in the selector for assignment.</p>
        </Modal>

        <Modal open={showAssign} onClose={()=>setShowAssign(false)} title="Assign Subjects & Class" size="lg">
          <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
            <select className="border p-2 rounded" value={form.user_id} onChange={e=>setForm({...form, user_id:e.target.value})} disabled={loading}>
              <option value="">Select Teacher User</option>
              {users.map(u=> <option key={u.id} value={u.id}>{u.username} — {u.first_name} {u.last_name}</option>)}
            </select>
            <input className="border p-2 rounded" placeholder="Subjects (comma separated)" value={form.subjects} onChange={e=>setForm({...form, subjects:e.target.value})} />
            <select className="border p-2 rounded" value={form.klass} onChange={e=>setForm({...form, klass:e.target.value})} disabled={loading}>
              <option value="">Assign Class</option>
              {classes.map(c=> <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>)}
            </select>
            <div className="md:col-span-3 flex justify-end">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow disabled:opacity-60" disabled={assigning || loading || !form.user_id}>
                {assigning? 'Saving...' : 'Assign / Update'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Directory */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold">Teachers Directory</h2>
            <div className="flex-1 md:flex-none md:w-auto">
              <input className="w-full md:w-64 border p-2 rounded-lg" placeholder="Search name, subject or class" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {loading ? (
              <div className="py-6 text-center text-gray-500">Loading...</div>
            ) : filteredTeachers.length === 0 ? (
              <div className="py-6 text-center text-gray-500">No teachers found.</div>
            ) : (
              filteredTeachers.map(t => {
                const subj = (t.subjects || '')
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean)
                return (
                  <Link key={t.id} to={`/admin/teachers/${t.id}`} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 hover:border-brand-200 hover:bg-brand-50/40 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
                        {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.user?.first_name} {t.user?.last_name}</div>
                        <div className="text-xs text-gray-500 truncate">@{t.user?.username}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {subj.slice(0,3).map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-full text-[11px] bg-purple-100 text-purple-700">{s}</span>
                          ))}
                          {subj.length>3 && <span className="text-[11px] text-gray-500">+{subj.length-3} more</span>}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {t.klass_detail?.name ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">{t.klass_detail.name}</span>
                      ) : <span className="text-xs text-gray-500">-</span>}
                    </div>
                  </Link>
                )
              })
            )}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">Subjects</th>
                  <th className="py-2 px-3">Class</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="py-6 text-center text-gray-500">Loading...</td></tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-gray-500">No teachers found.</td></tr>
                ) : (
                  filteredTeachers.map(t => {
                    const subj = (t.subjects || '')
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)
                    return (
                      <tr key={t.id} className="border-t hover:bg-gray-50/60">
                        <td className="py-2 px-3">
                          <Link to={`/admin/teachers/${t.id}`} className="flex items-center gap-2 group">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
                              {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium group-hover:underline">{t.user?.first_name} {t.user?.last_name}</div>
                              <div className="text-xs text-gray-500">@{t.user?.username}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {subj.length ? subj.map((s, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{s}</span>
                            )) : <span className="text-gray-500">-</span>}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {t.klass_detail?.name ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">{t.klass_detail.name}</span>
                          ) : <span className="text-gray-500">-</span>}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

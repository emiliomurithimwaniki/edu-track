import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import AdminLayout from '../components/AdminLayout'
import { useNotification } from '../components/NotificationContext'

export default function AdminTeacherProfile(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [teacher, setTeacher] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [classes, setClasses] = useState([])
  const { showSuccess, showError } = useNotification()

  // editable form fields
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone: '',
    subjects: '',
    klass: '',
    tsc_number: '',
  })

  useEffect(()=>{
    let cancelled = false
    async function load(){
      try {
        setLoading(true)
        const [tRes, cRes] = await Promise.all([
          api.get(`/academics/teachers/${id}/`),
          api.get('/academics/classes/')
        ])
        if (!cancelled) {
          setTeacher(tRes.data)
          setClasses(cRes.data)
          setForm({
            first_name: tRes.data?.user?.first_name || '',
            last_name: tRes.data?.user?.last_name || '',
            email: tRes.data?.user?.email || '',
            username: tRes.data?.user?.username || '',
            phone: tRes.data?.user?.phone || '',
            subjects: tRes.data?.subjects || '',
            klass: tRes.data?.klass || '',
            tsc_number: tRes.data?.tsc_number || '',
          })
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load teacher profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return ()=>{ cancelled = true }
  },[id])

  const subjects = (teacher?.subjects || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const save = async (e) => {
    e?.preventDefault?.()
    if (!teacher?.user?.id) return
    try {
      setSaving(true)
      // 1) Update user personal info (no password)
      await api.patch('/auth/users/update/', {
        user_id: teacher.user.id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        username: form.username,
        phone: form.phone,
      })
      // 2) Update teacher profile subjects and klass
      const body = { subjects: form.subjects || '' }
      if (form.tsc_number !== undefined) body.tsc_number = form.tsc_number || null
      // Allow clearing class by setting null
      if (form.klass === '' || form.klass === null) {
        body.klass = null
      } else {
        body.klass = form.klass
      }
      await api.patch(`/academics/teachers/${id}/`, body)
      // 3) If a class selected, set class teacher to this user (best-effort)
      if (form.klass) {
        await api.patch(`/academics/classes/${form.klass}/`, { teacher: teacher.user.id })
      }
      // reload
      const { data } = await api.get(`/academics/teachers/${id}/`)
      setTeacher(data)
      setForm(f => ({ ...f, subjects: data.subjects || '', klass: data.klass || '' }))
      showSuccess('Profile Updated', 'Teacher profile and assignments have been updated.')
    } catch (err) {
      showError('Update Failed', 'Could not update teacher. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-semibold">
              {(teacher?.user?.first_name?.[0] || teacher?.user?.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                {teacher?.user?.first_name} {teacher?.user?.last_name}
              </h1>
              <div className="text-sm text-gray-500">@{teacher?.user?.username}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>navigate(-1)} className="px-3 py-1.5 rounded border hover:bg-gray-50">Back</button>
            <Link to="/admin/teachers" className="px-3 py-1.5 rounded border hover:bg-gray-50">Directory</Link>
            <button onClick={save} disabled={saving || loading} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">{saving? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>

        <form onSubmit={save} className="bg-white rounded-xl shadow p-4 space-y-4">
          {loading && <div>Loading profile...</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {!loading && !error && teacher && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-500 text-sm">First name</label>
                <input className="border rounded w-full p-2" value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-500 text-sm">Last name</label>
                <input className="border rounded w-full p-2" value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-500 text-sm">Email</label>
                <input type="email" className="border rounded w-full p-2" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-500 text-sm">Username</label>
                <input className="border rounded w-full p-2" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-500 text-sm">Phone</label>
                <input className="border rounded w-full p-2" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-500 text-sm">Subjects (comma separated)</label>
                <input className="border rounded w-full p-2" value={form.subjects} onChange={e=>setForm({...form, subjects:e.target.value})} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(form.subjects || '').split(',').map(s=>s.trim()).filter(Boolean).map((s,i)=> (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-gray-500 text-sm">T.S.C number</label>
                <input className="border rounded w-full p-2" value={form.tsc_number} onChange={e=>setForm({...form, tsc_number:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-500 text-sm">Assigned Class (Class Teacher)</label>
                <select className="border rounded w-full p-2" value={form.klass || ''} onChange={e=>setForm({...form, klass:e.target.value})}>
                  <option value="">No Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 mt-1">Selecting a class will also set this teacher as the class teacher.</div>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">{saving? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </AdminLayout>
  )
}

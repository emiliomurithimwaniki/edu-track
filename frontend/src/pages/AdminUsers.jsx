import React, { useEffect, useState } from 'react'
import api from '../api'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'

const roles = ['admin','teacher','student','finance']

export default function AdminUsers(){
  const [users, setUsers] = useState([])
  const [filterRole, setFilterRole] = useState('')
  const [form, setForm] = useState({ username:'', password:'', role:'teacher', first_name:'', last_name:'', email:'', phone:'' })
  const [reset, setReset] = useState({ user_id:'', new_password:'' })
  const [roleCounts, setRoleCounts] = useState({ admin:0, teacher:0, student:0, finance:0 })
  const [showCreate, setShowCreate] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [edit, setEdit] = useState({ user_id:'', username:'', first_name:'', last_name:'', email:'', phone:'', role:'', new_password:'' })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    // Fetch users filtered by search text from backend and compute role counts locally
    const params = {}
    if (search && search.trim()) params.q = search.trim()
    const { data } = await api.get('/auth/users/', { params })
    setRoleCounts({
      admin: data.filter(u=>u.role==='admin' || u.is_superuser || u.is_staff).length,
      teacher: data.filter(u=>u.role==='teacher').length,
      student: data.filter(u=>u.role==='student').length,
      finance: data.filter(u=>u.role==='finance').length,
    })
    // Apply current filter to table display
    setUsers(filterRole ? data.filter(u=> (filterRole==='admin'
      ? (u.role==='admin' || u.is_superuser || u.is_staff)
      : u.role===filterRole)) : data)
    setLoading(false)
  }
  // Debounce search + react to role changes
  useEffect(()=>{
    const t = setTimeout(()=>{ load() }, 300)
    return ()=>clearTimeout(t)
  }, [search, filterRole])

  const create = async (e) => {
    e.preventDefault()
    await api.post('/auth/users/create/', form)
    setForm({ username:'', password:'', role:'teacher', first_name:'', last_name:'', email:'', phone:'' })
    setShowCreate(false)
    load()
  }

  const toggleActive = async (u) => {
    await api.post('/auth/users/status/', { user_id: u.id, is_active: !u.is_active })
    load()
  }

  const openEdit = (u) => {
    setEdit({
      user_id: u.id,
      username: u.username || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || (u.is_superuser ? 'admin' : ''),
      new_password: ''
    })
    setShowEdit(true)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    // Backend allows PATCH with: user_id, first_name, last_name, email, phone, username
    const { user_id, username, first_name, last_name, email, phone, role, new_password } = edit
    const payload = { user_id, username, first_name, last_name, email, phone }
    if (role) payload.role = role
    await api.patch('/auth/users/update/', payload)
    if (new_password && new_password.trim().length > 0) {
      await api.post('/auth/users/reset_password/', { user_id, new_password })
    }
    setShowEdit(false)
    load()
  }

  const doReset = async (e) => {
    e.preventDefault()
    await api.post('/auth/users/reset_password/', reset)
    setReset({ user_id:'', new_password:'' })
    setShowReset(false)
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">User Management</h1>

        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between">
            <div className="font-medium">Create User</div>
            <button onClick={()=>setShowCreate(true)} className="bg-green-600 text-white px-4 py-2 rounded">New User</button>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between">
            <div className="font-medium">Reset Password</div>
            <button onClick={()=>setShowReset(true)} className="bg-blue-600 text-white px-4 py-2 rounded">Reset Password</button>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="font-medium">Users</h2>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="bg-gray-100 px-2 py-1 rounded">Admin: <strong>{roleCounts.admin}</strong></span>
              <span className="bg-gray-100 px-2 py-1 rounded">Teachers: <strong>{roleCounts.teacher}</strong></span>
              <span className="bg-gray-100 px-2 py-1 rounded">Students: <strong>{roleCounts.student}</strong></span>
              <span className="bg-gray-100 px-2 py-1 rounded">Finance: <strong>{roleCounts.finance}</strong></span>
            </div>
            <input
              className="border p-2 rounded w-56"
              placeholder="Search users..."
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
            <select className="border p-2 rounded" value={filterRole} onChange={e=>setFilterRole(e.target.value)}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={load} disabled={loading} className={`border px-3 py-1.5 rounded ${loading? 'opacity-60 cursor-not-allowed':''}`}>{loading? 'Loading...':'Refresh'}</button>
          </div>
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-700 rounded-full" />
                <span className="ml-2 text-sm text-gray-700">Loading users...</span>
              </div>
            )}
          <table className="w-full text-left text-sm">
            <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Name</th><th>Email</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td>{u.id}</td>
                  <td>
                    <button className="text-indigo-600 hover:underline" onClick={()=>openEdit(u)} title="Edit user">
                      {u.username}
                    </button>
                  </td>
                  <td className="capitalize">{u.role || (u.is_superuser ? 'superuser' : '')}</td>
                  <td>
                    <button className="text-indigo-600 hover:underline" onClick={()=>openEdit(u)} title="Edit user">
                      {u.first_name} {u.last_name}
                    </button>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.is_active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button onClick={(e)=>{ e.stopPropagation(); toggleActive(u) }} className={u.is_active? 'text-red-600':'text-green-600'}>
                      {u.is_active? 'Deactivate':'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && users.length===0 && (
                <tr><td colSpan={7} className="text-center text-gray-500 py-6">No users found</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      <Modal open={showCreate} onClose={()=>setShowCreate(false)} title="Create User" size="md">
        <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
          <input className="border p-2 rounded" placeholder="Username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} required />
          <input className="border p-2 rounded" placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
          <select className="border p-2 rounded" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
            {roles.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="border p-2 rounded md:col-span-3" placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
          <input className="border p-2 rounded md:col-span-3" placeholder="Phone" type="tel" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
          <input className="border p-2 rounded" placeholder="First name" value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Last name" value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} />
          <div className="md:col-span-3 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowCreate(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-green-600 text-white px-4 py-2 rounded">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={showReset} onClose={()=>setShowReset(false)} title="Reset Password" size="sm">
        <form onSubmit={doReset} className="grid gap-3">
          <input className="border p-2 rounded" placeholder="User ID" value={reset.user_id} onChange={e=>setReset({...reset, user_id:e.target.value})} required />
          <input className="border p-2 rounded" placeholder="New Password" type="password" value={reset.new_password} onChange={e=>setReset({...reset, new_password:e.target.value})} required />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowReset(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Reset</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title="Edit User" size="md">
        <form onSubmit={saveEdit} className="grid gap-3 md:grid-cols-3">
          <input className="border p-2 rounded" placeholder="Username" value={edit.username} onChange={e=>setEdit({...edit, username:e.target.value})} />
          <input className="border p-2 rounded md:col-span-2" placeholder="Email" type="email" value={edit.email} onChange={e=>setEdit({...edit, email:e.target.value})} />
          <input className="border p-2 rounded" placeholder="First name" value={edit.first_name} onChange={e=>setEdit({...edit, first_name:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Last name" value={edit.last_name} onChange={e=>setEdit({...edit, last_name:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Phone" value={edit.phone} onChange={e=>setEdit({...edit, phone:e.target.value})} />
          <select className="border p-2 rounded" value={edit.role} onChange={e=>setEdit({...edit, role:e.target.value})}>
            <option value="">Select role</option>
            {roles.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="border p-2 rounded md:col-span-2" placeholder="New Password (optional)" type="password" value={edit.new_password} onChange={e=>setEdit({...edit, new_password:e.target.value})} />
          <div className="md:col-span-3 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowEdit(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded">Save Changes</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}

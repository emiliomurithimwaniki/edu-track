import React, { useEffect, useState } from 'react'
import api from '../api'

export default function TeacherProfile(){
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pw, setPw] = useState({ old_password: '', new_password: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const res = await api.get('/accounts/me/')
        if (!mounted) return
        setMe(res.data)
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
      finally{ if(mounted) setLoading(false) }
    })()
    return ()=>{ mounted = false }
  },[])

  const changePassword = async (e) => {
    e.preventDefault()
    setPwSaving(true)
    setPwErr('')
    setPwMsg('')
    try{
      await api.post('/accounts/users/change_password/', pw)
      setPwMsg('Password changed successfully. You may need to log in again on next refresh.')
      setPw({ old_password: '', new_password: '' })
    }catch(err){
      setPwErr(err?.response?.data?.detail || err?.message || 'Failed to change password')
    }finally{ setPwSaving(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">My Profile</div>
      {loading && <div className="bg-white p-4 rounded shadow">Loading...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      {me && (
        <div className="bg-white rounded shadow p-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Username</div>
              <div className="font-medium">{me.username}</div>
            </div>
            <div>
              <div className="text-gray-500">Name</div>
              <div className="font-medium">{me.first_name} {me.last_name}</div>
            </div>
            <div>
              <div className="text-gray-500">Email</div>
              <div className="font-medium">{me.email}</div>
            </div>
            <div>
              <div className="text-gray-500">Role</div>
              <div className="font-medium capitalize">{me.role}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow">
        <div className="border-b px-4 py-2 font-medium">Change Password</div>
        <form onSubmit={changePassword} className="p-4 grid gap-3 max-w-md">
          {pwErr && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{pwErr}</div>}
          {pwMsg && <div className="bg-green-50 text-green-700 p-2 rounded text-sm">{pwMsg}</div>}
          <input className="border p-2 rounded" type="password" placeholder="Old Password" value={pw.old_password} onChange={e=>setPw({...pw, old_password:e.target.value})} required />
          <input className="border p-2 rounded" type="password" placeholder="New Password (min 6 chars)" value={pw.new_password} onChange={e=>setPw({...pw, new_password:e.target.value})} required />
          <div className="flex justify-end">
            <button className="px-3 py-1.5 rounded text-white bg-blue-600 disabled:opacity-60" disabled={pwSaving}>{pwSaving?'Saving...':'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

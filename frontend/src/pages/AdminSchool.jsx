import React, { useEffect, useState } from 'react'
import api from '../api'
import AdminLayout from '../components/AdminLayout'

export default function AdminSchool(){
  const [form, setForm] = useState({ name:'', code:'', address:'', motto:'', aim:'', social_links:{ facebook:'', twitter:'', instagram:'', youtube:'', website:'' }, logo:null, logoUrl:'' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const load = async () => {
    setLoading(true)
    setError(''); setOk('')
    try {
      const { data } = await api.get('/auth/school/me/')
      setForm({
        name: data.name || '',
        code: data.code || '',
        address: data.address || '',
        motto: data.motto || '',
        aim: data.aim || '',
        social_links: {
          facebook: data.social_links?.facebook || '',
          twitter: data.social_links?.twitter || '',
          instagram: data.social_links?.instagram || '',
          youtube: data.social_links?.youtube || '',
          website: data.social_links?.website || '',
        },
        logo: null,
        logoUrl: data.logo_url || data.logo || ''
      })
    } catch (e) {
      setError(e?.response?.data?.detail || 'No school linked to this admin. Create a School in Django Admin and link it to your user.')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() },[])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setOk('')
    try {
      // Submit as multipart with JSON string for social_links
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('code', form.code)
      fd.append('address', form.address)
      fd.append('motto', form.motto || '')
      fd.append('aim', form.aim || '')
      fd.append('social_links', JSON.stringify(form.social_links || {}))
      if (form.logo instanceof File) fd.append('logo', form.logo)
      const { data } = await api.put('/auth/school/me/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setOk('Saved successfully')
      setForm({
        name: data.name || '',
        code: data.code || '',
        address: data.address || '',
        motto: data.motto || '',
        aim: data.aim || '',
        social_links: {
          facebook: data.social_links?.facebook || '',
          twitter: data.social_links?.twitter || '',
          instagram: data.social_links?.instagram || '',
          youtube: data.social_links?.youtube || '',
          website: data.social_links?.website || '',
        },
        logo: null,
        logoUrl: data.logo_url || data.logo || ''
      })
    } catch (e) {
      const resp = e?.response?.data
      const msg = typeof resp === 'string' ? resp : (resp?.detail || JSON.stringify(resp) || e.message || 'Failed to save')
      setError(msg)
    } finally { setSaving(false) }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold">School Settings</h1>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded shadow p-4 grid gap-3">
            {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
            {ok && <div className="bg-green-50 text-green-700 p-2 rounded text-sm">{ok}</div>}
            <label className="text-sm">School Name
              <input className="border p-2 rounded w-full mt-1" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
            </label>
            <label className="text-sm">School Code
              <input className="border p-2 rounded w-full mt-1" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} required />
            </label>
            <label className="text-sm">Address
              <textarea className="border p-2 rounded w-full mt-1" rows={4} value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
            </label>
            <label className="text-sm">Motto
              <input className="border p-2 rounded w-full mt-1" value={form.motto} onChange={e=>setForm({...form, motto:e.target.value})} />
            </label>
            <label className="text-sm">Aim
              <textarea className="border p-2 rounded w-full mt-1" rows={3} value={form.aim} onChange={e=>setForm({...form, aim:e.target.value})} />
            </label>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">Facebook
                <input className="border p-2 rounded w-full mt-1" value={form.social_links.facebook} onChange={e=>setForm({...form, social_links:{...form.social_links, facebook:e.target.value}})} />
              </label>
              <label className="text-sm">Twitter / X
                <input className="border p-2 rounded w-full mt-1" value={form.social_links.twitter} onChange={e=>setForm({...form, social_links:{...form.social_links, twitter:e.target.value}})} />
              </label>
              <label className="text-sm">Instagram
                <input className="border p-2 rounded w-full mt-1" value={form.social_links.instagram} onChange={e=>setForm({...form, social_links:{...form.social_links, instagram:e.target.value}})} />
              </label>
              <label className="text-sm">YouTube
                <input className="border p-2 rounded w-full mt-1" value={form.social_links.youtube} onChange={e=>setForm({...form, social_links:{...form.social_links, youtube:e.target.value}})} />
              </label>
              <label className="text-sm md:col-span-2">Website
                <input className="border p-2 rounded w-full mt-1" value={form.social_links.website} onChange={e=>setForm({...form, social_links:{...form.social_links, website:e.target.value}})} />
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-3 items-start">
              <label className="text-sm">Logo
                <input type="file" accept="image/*" className="border p-2 rounded w-full mt-1" onChange={e=>{
                  const file = e.target.files?.[0] || null
                  setForm(prev=>({ ...prev, logo:file, logoUrl: file ? URL.createObjectURL(file) : prev.logoUrl }))
                }} />
              </label>
              {form.logoUrl && (
                <div className="text-sm">
                  <div className="text-gray-600 mb-1">Preview</div>
                  <img src={form.logoUrl} alt="Logo preview" className="h-16 object-contain border rounded" />
                </div>
              )}
            </div>
            <div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={saving}>{saving? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  )
}

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'

export default function AdminClasses(){
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [streams, setStreams] = useState([])
  const [form, setForm] = useState({ grade_level:'', stream: '', subject_ids:[] })
  const [editing, setEditing] = useState(null)
  const [newSubject, setNewSubject] = useState({ code:'', name:'' })
  const [newStream, setNewStream] = useState({ name: '' })
  const [editingStream, setEditingStream] = useState(null)
  const [showClassModal, setShowClassModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showStreamModal, setShowStreamModal] = useState(false)

  const { showSuccess, showError } = useNotification()

  const load = async () => {
    const [cl, sbj, st] = await Promise.all([
      api.get('/academics/classes/'),
      api.get('/academics/subjects/'),
      api.get('/academics/streams/'),
    ])
    setClasses(cl.data)
    setSubjects(sbj.data)
    setStreams(st.data)
  }
  useEffect(()=>{ load() },[])

  const submit = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/academics/classes/${editing}/`, form)
        showSuccess('Class Updated', 'Class has been successfully updated.')
      } else {
        await api.post('/academics/classes/', form)
        showSuccess('Class Created', 'Class has been successfully created.')
      }
      setForm({ grade_level:'', stream: '', subject_ids:[] })
      load()
    } catch (err) {
      showError('Failed to Save Class', 'There was an error saving the class. Please try again.')
    }
  }

  const edit = (c) => {
    setEditing(c.id)
    const currentSubjectIds = Array.isArray(c.subjects) ? c.subjects.map(s=>s.id) : []
    setForm({ grade_level: c.grade_level, stream: c.stream, subject_ids: currentSubjectIds })
    setShowClassModal(true)
  }

  const del = async (id) => {
    if (!confirm('Delete this class?')) return
    try {
      await api.delete(`/academics/classes/${id}/`)
      load()
      showSuccess('Class Deleted', 'Class has been successfully deleted.')
    } catch (err) {
      showError('Failed to Delete Class', 'There was an error deleting the class. Please try again.')
    }
  }

  const createSubject = async (e) => {
    e.preventDefault()
    if (!newSubject.code || !newSubject.name) return
    try {
      await api.post('/academics/subjects/', newSubject)
      setNewSubject({ code:'', name:'' })
      load()
      showSuccess('Subject Created', `Subject ${newSubject.name} (${newSubject.code}) has been successfully created.`)
    } catch (err) {
      showError('Failed to Create Subject', 'There was an error creating the subject. Please try again.')
    }
  }

  const saveStream = async () => {
    if (!newStream.name) return;
    try {
      if (editingStream) {
        await api.put(`/academics/streams/${editingStream}/`, newStream);
        showSuccess('Stream Updated', 'Stream has been successfully updated.');
      } else {
        await api.post('/academics/streams/', newStream);
        showSuccess('Stream Created', `Stream ${newStream.name} has been successfully created.`);
      }
      setNewStream({ name: '' });
      setEditingStream(null);
      setShowStreamModal(false);
      load();
    } catch (err) {
      showError('Failed to Save Stream', 'There was an error saving the stream. Please try again.');
    }
  };

  const delStream = async (id) => {
    if (!confirm('Delete this stream?')) return;
    try {
      await api.delete(`/academics/streams/${id}/`);
      load();
      showSuccess('Stream Deleted', 'Stream has been successfully deleted.');
    } catch (err) {
      showError('Failed to Delete Stream', 'There was an error deleting the stream. Please try again.');
    }
  };

  const editStream = (s) => {
    setEditingStream(s.id)
    setNewStream({ name: s.name })
    setShowStreamModal(true)
  }

  return (
    <AdminLayout>
      <div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Manage Classes</h1>
            <div className="text-sm text-gray-500">Create and organize classes, subjects, and streams</div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-4 border border-gray-100 flex items-start justify-between">
              <div>
                <div className="font-medium">Classes</div>
                <p className="text-sm text-gray-500">Create or edit a class and assign subjects.</p>
              </div>
              <button
                aria-label="Add Class"
                onClick={()=>{ setEditing(null); setForm({ grade_level:'', stream: '', subject_ids:[] }); setShowClassModal(true) }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >{editing? 'Edit Class' : 'Add Class'}</button>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-100 flex items-start justify-between">
              <div>
                <div className="font-medium">Create Subject</div>
                <p className="text-sm text-gray-500">Add a new subject to the curriculum.</p>
              </div>
              <button
                aria-label="Add Subject"
                onClick={()=>{ setNewSubject({ code:'', name:'' }); setShowSubjectModal(true) }}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >Add Subject</button>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-100 flex items-start justify-between">
              <div>
                <div className="font-medium">Manage Streams</div>
                <p className="text-sm text-gray-500">Add streams such as North, A, B, etc.</p>
              </div>
              <button
                aria-label="Add Stream"
                onClick={() => { setNewStream({ name: '' }); setShowStreamModal(true); }}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              >Add Stream</button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50"><h2 className="font-medium">Classes</h2></div>
            {classes.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">No classes yet. Click "Add Class" to create your first class.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Grade</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Stream</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Subjects</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map(c => (
                      <tr key={c.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">
                          <Link to={`/admin/classes/${c.id}`} className="text-blue-700 hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{c.grade_level}</td>
                        <td className="px-3 py-2">{c.stream_detail?.name || '-'}</td>
                        <td className="px-3 py-2 max-w-[420px]">
                          <span className="block truncate" title={Array.isArray(c.subjects) && c.subjects.length>0 ? c.subjects.map(s=>s.code).join(', ') : '-' }>
                            {Array.isArray(c.subjects) && c.subjects.length>0 ? c.subjects.map(s=>s.code).join(', ') : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2 space-x-3 text-right whitespace-nowrap">
                          <button onClick={()=>edit(c)} className="text-blue-600 hover:underline">Edit</button>
                          <button onClick={()=>del(c.id)} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50"><h2 className="font-medium">Streams</h2></div>
            {streams.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">No streams yet. Click "Add Stream" to create one.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {streams.map(s => (
                      <tr key={s.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="px-3 py-2 space-x-3 text-right">
                          <button onClick={()=>editStream(s)} className="text-blue-600 hover:underline">Edit</button>
                          <button onClick={()=>delStream(s.id)} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      {/* Class Modal */}
      <Modal open={showClassModal} onClose={()=>setShowClassModal(false)} title={editing? 'Edit Class':'Add Class'} size="lg">
        <form onSubmit={(e)=>{ submit(e); setShowClassModal(false) }} className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Grade</span>
            <select aria-label="Select Grade" className="border p-2 rounded" value={form.grade_level} onChange={e=>setForm({...form, grade_level:e.target.value})}>
              <option value="">Select Grade</option>
              {Array.from({length:9}, (_,i)=>`Grade ${i+1}`).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Stream</span>
            <select aria-label="Select Stream" className="border p-2 rounded" value={form.stream} onChange={e => setForm({ ...form, stream: e.target.value })} required>
              <option value="">Select Stream</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          
          <div className="md:col-span-2">
            <div className="text-sm text-gray-700 mb-1">Assign Subjects to this Class</div>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <label key={s.id} className="inline-flex items-center gap-2 border rounded px-2 py-1 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={form.subject_ids.includes(s.id)}
                    onChange={(e)=>{
                      const checked = e.target.checked
                      setForm(f => ({ ...f, subject_ids: checked ? [...f.subject_ids, s.id] : f.subject_ids.filter(id=>id!==s.id) }))
                    }}
                  />
                  <span className="text-sm"><span className="font-medium">{s.code}</span> — {s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowClassModal(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">{editing? 'Update Class':'Add Class'}</button>
          </div>
        </form>
      </Modal>

      {/* Stream Modal */}
      <Modal open={showStreamModal} onClose={()=>{ setShowStreamModal(false); setEditingStream(null); }} title={editingStream? 'Edit Stream':'Add Stream'} size="sm">
        <form onSubmit={e => { e.preventDefault(); saveStream(); }}>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-gray-700">Stream Name</span>
              <input aria-label="Stream Name" className="border p-2 rounded" placeholder="e.g., North" value={newStream.name} onChange={e=>setNewStream({...newStream, name:e.target.value})} required />
            </label>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={()=>{ setShowStreamModal(false); setEditingStream(null); }} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">{editingStream? 'Update Stream':'Add Stream'}</button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Subject Modal */}
      <Modal open={showSubjectModal} onClose={()=>setShowSubjectModal(false)} title="Create Subject" size="sm">
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Subject Code</span>
            <input aria-label="Subject Code" className="border p-2 rounded" placeholder="e.g., ENG" value={newSubject.code} onChange={e=>setNewSubject({...newSubject, code:e.target.value})} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Subject Name</span>
            <input aria-label="Subject Name" className="border p-2 rounded" placeholder="e.g., English" value={newSubject.name} onChange={e=>setNewSubject({...newSubject, name:e.target.value})} />
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowSubjectModal(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded" onClick={(e)=>{ e.preventDefault(); createSubject(e); setShowSubjectModal(false) }}>Add Subject</button>
          </div>
        </div>
      </Modal>
      </div>
    </AdminLayout>
  )
}

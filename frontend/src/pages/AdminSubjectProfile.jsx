import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

export default function AdminSubjectProfile(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [subject, setSubject] = useState(null)
  const [stats, setStats] = useState({ avg_by_grade: [], teachers: [], grading: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bands, setBands] = useState([]) // [{id, grade, min, max, order}]
  const [loadingBands, setLoadingBands] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const savingMapRef = useRef({})
  const debounceRef = useRef({})
  const { showSuccess, showError } = useNotification?.() || { showSuccess:()=>{}, showError:()=>{} }

  useEffect(() => {
    let cancelled = false
    async function load(){
      try {
        setLoading(true)
        const [s, st] = await Promise.all([
          api.get(`/academics/subjects/${id}/`),
          api.get(`/academics/subjects/${id}/stats/`),
        ])
        if (!cancelled) { setSubject(s.data); setStats(st.data || {}) }
      } catch (e) {
        if (!cancelled) setError('Failed to load subject')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return ()=>{ cancelled = true }
  }, [id])

  // Load grading bands for this subject
  useEffect(() => {
    let cancelled = false
    async function loadBands(){
      try {
        setLoadingBands(true)
        const { data } = await api.get(`/academics/subject_grading/?subject=${id}`)
        if (!cancelled) setBands(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setBands([])
      } finally {
        if (!cancelled) setLoadingBands(false)
      }
    }
    if (id) loadBands()
    return ()=>{ cancelled = true }
  }, [id])

  const ensureEditable = () => {
    // If no custom bands loaded yet (bands is empty) but we have defaults from stats,
    // copy defaults into editable bands array so user can edit them.
    if (bands.length === 0 && (stats?.grading || []).length) {
      const cloned = (stats.grading || []).map((g, idx) => ({ id: undefined, subject: Number(id), grade: g.grade, min: g.min, max: g.max, order: g.order ?? idx }))
      setBands(cloned)
    }
    if (!editMode) setEditMode(true)
  }

  const addRow = () => {
    ensureEditable()
    setBands(prev => [...prev, { id: undefined, subject: Number(id), grade: '', min: 0, max: 0, order: prev.length }])
  }

  const scheduleSave = (idx) => {
    if (debounceRef.current[idx]) clearTimeout(debounceRef.current[idx])
    debounceRef.current[idx] = setTimeout(() => {
      saveRow(idx)
    }, 500)
  }

  const updateField = (idx, key, value) => {
    ensureEditable()
    setBands(prev => prev.map((b,i)=> i===idx ? { ...b, [key]: key==='grade' ? value : Number(value) } : b))
    scheduleSave(idx)
  }

  const saveRow = async (idx) => {
    const row = bands[idx]
    try {
      savingMapRef.current[idx] = true
      if (row.id) {
        const { data } = await api.patch(`/academics/subject_grading/${row.id}/`, {
          grade: row.grade, min: row.min, max: row.max, order: row.order
        })
        setBands(prev => prev.map((b,i)=> i===idx ? data : b))
        showSuccess && showSuccess('Saved', 'Grading band updated')
      } else {
        const { data } = await api.post(`/academics/subject_grading/`, {
          subject: Number(id), grade: row.grade, min: row.min, max: row.max, order: row.order
        })
        setBands(prev => prev.map((b,i)=> i===idx ? data : b))
        showSuccess && showSuccess('Saved', 'Grading band created')
      }
    } catch (e) {
      showError && showError('Save Failed', e?.response?.data ? JSON.stringify(e.response.data) : 'Could not save grading band')
    } finally {
      savingMapRef.current[idx] = false
    }
  }

  const deleteRow = async (idx) => {
    const row = bands[idx]
    if (row.id) {
      try {
        await api.delete(`/academics/subject_grading/${row.id}/`)
        setBands(prev => prev.filter((_,i)=>i!==idx))
        showSuccess && showSuccess('Deleted', 'Grading band removed')
      } catch (e) {
        showError && showError('Delete Failed', 'Could not delete grading band')
      }
    } else {
      setBands(prev => prev.filter((_,i)=>i!==idx))
    }
  }

  const gradePerf = stats?.avg_by_grade || []
  const teachers = stats?.teachers || []
  const grading = (bands && bands.length>0) ? bands : (stats?.grading || [])

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{subject?.name || 'Subject'}</h1>
            <div className="text-sm text-gray-500">Code: {subject?.code || '-'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded border hover:bg-gray-50">Back</button>
            <Link to="/admin/subjects" className="px-3 py-1.5 rounded border hover:bg-gray-50">All Subjects</Link>
          </div>
        </div>

        {loading && <div>Loading subject...</div>}
        {error && <div className="text-red-600 text-sm">{error}</div>}

        {!loading && !error && (
          <div className="grid md:grid-cols-3 gap-4">
            {/* Performance across grades */}
            <div className="md:col-span-2 p-4 rounded border bg-white">
              <div className="text-sm font-medium mb-2">Average Performance Across Grades</div>
              {gradePerf.length === 0 ? (
                <div className="text-sm text-gray-500">No data available.</div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const max = Math.max(...gradePerf.map(g=>g.average||0), 1)
                    return gradePerf.map(g => (
                      <div key={g.grade_level} className="flex items-center gap-3">
                        <div className="text-xs w-20 text-gray-700">{g.grade_level}</div>
                        <div className="flex-1 bg-gray-100 rounded h-3">
                          <div className="bg-indigo-600 h-3 rounded" style={{width: `${Math.min(100, (g.average/max)*100)}%`}}></div>
                        </div>
                        <div className="w-12 text-right text-xs text-gray-700">{Number(g.average||0).toFixed(1)}</div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>

            {/* Teachers */}
            <div className="p-4 rounded border bg-white">
              <div className="text-sm font-medium mb-2">Teachers</div>
              {teachers.length === 0 ? (
                <div className="text-sm text-gray-500">No teachers allocated for this subject.</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {teachers.map(t => (
                    <li key={t.id} className="flex items-center justify-between">
                      <span>{t.user?.first_name} {t.user?.last_name} (@{t.user?.username})</span>
                      {t.klass_detail?.name && <span className="text-xs text-gray-500">Class: {t.klass_detail.name}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Grading Scale */}
            <div className="md:col-span-3 p-4 rounded border bg-white">
              <div className="text-sm font-medium mb-2">Grading</div>
              <div className="overflow-x-auto">
                <table className="min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-2 py-1 text-left w-10"></th>
                      <th className="border px-2 py-1 text-left">Grade</th>
                      <th className="border px-2 py-1 text-left">Min</th>
                      <th className="border px-2 py-1 text-left">Max</th>
                      <th className="border px-2 py-1 text-left">Order</th>
                      <th className="border px-2 py-1 text-left w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingBands ? (
                      <tr><td className="px-2 py-2 text-gray-500" colSpan={5}>Loading bands…</td></tr>
                    ) : (
                      grading.map((g, idx) => (
                        <tr key={g.id || idx}>
                          <td className="border px-2 py-1 text-center">
                            <button type="button" title="Edit" className="text-gray-600 hover:text-gray-900" onClick={ensureEditable}>✏️</button>
                          </td>
                          <td className="border px-2 py-1 w-24">
                            {editMode && bands.length>0 ? (
                              <input className="border p-1 rounded w-full" value={g.grade}
                                     onChange={e=>updateField(idx,'grade',e.target.value)} />
                            ) : (
                              g.grade
                            )}
                          </td>
                          <td className="border px-2 py-1 w-24">
                            {editMode && bands.length>0 ? (
                              <input className="border p-1 rounded w-full" type="number" value={g.min}
                                     onChange={e=>updateField(idx,'min',e.target.value)} />
                            ) : g.min}
                          </td>
                          <td className="border px-2 py-1 w-24">
                            {editMode && bands.length>0 ? (
                              <input className="border p-1 rounded w-full" type="number" value={g.max}
                                     onChange={e=>updateField(idx,'max',e.target.value)} />
                            ) : g.max}
                          </td>
                          <td className="border px-2 py-1 w-24">
                            {editMode && bands.length>0 ? (
                              <input className="border p-1 rounded w-full" type="number" value={g.order ?? idx}
                                     onChange={e=>updateField(idx,'order',e.target.value)} />
                            ) : (g.order ?? idx)}
                          </td>
                          <td className="border px-2 py-1 w-36">
                            {editMode && bands.length>0 ? (
                              <div className="flex items-center gap-3">
                                {savingMapRef.current[idx] ? <span className="text-xs text-gray-500">Saving…</span> : <span className="text-xs text-green-600">Saved</span>}
                                <button type="button" onClick={()=>deleteRow(idx)} className="text-red-600 hover:underline">Delete</button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={addRow} className="px-3 py-1.5 rounded border hover:bg-gray-50">Add Row</button>
                {!editMode && <div className="text-xs text-gray-500">Viewing defaults. Click the ✏️ on any row or Add Row to start editing.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

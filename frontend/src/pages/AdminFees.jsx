import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'

export default function AdminFees(){
  const [tab, setTab] = useState('categories') // categories | classFees | arrears
  const { showSuccess, showError } = useNotification()
  const [counts, setCounts] = useState({ categories: null, classFees: null, arrears: null })
  const [loadingCounts, setLoadingCounts] = useState({ categories: true, classFees: true, arrears: true })
  const onCount = (key, value) => setCounts(prev=>({ ...prev, [key]: value }))
  const onLoading = (key, value) => setLoadingCounts(prev=>({ ...prev, [key]: value }))
  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Fees Management</h1>
                  <p className="text-sm text-gray-600 mt-1">Manage fee categories, assignments, and student balances</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              {[
                { id: 'categories', name: 'Fee Categories', icon: '📋' },
                { id: 'classFees', name: 'Assign Class Fees', icon: '💰' },
                { id: 'arrears', name: 'Balances & Arrears', icon: '📊' }
              ].map((tabItem) => (
                <button
                  key={tabItem.id}
                  onClick={() => setTab(tabItem.id)}
                  className={`group relative py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                    tab === tabItem.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{tabItem.icon}</span>
                    <span>{tabItem.name}</span>
                    {loadingCounts[tabItem.id] ? (
                      <div className={`inline-flex items-center justify-center w-6 h-4 rounded-full animate-pulse ${
                        tab === tabItem.id ? 'bg-blue-200' : 'bg-gray-200'
                      }`}>
                        <div className={`w-3 h-2 rounded-sm ${tab === tabItem.id ? 'bg-blue-400' : 'bg-gray-400'}`} />
                      </div>
                    ) : (
                      <span className={`inline-flex items-center justify-center w-6 h-4 text-xs font-semibold rounded-full ${
                        tab === tabItem.id
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {counts[tabItem.id] ?? 0}
                      </span>
                    )}
                  </div>
                  {/* Active tab indicator */}
                  {tab === tabItem.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="transition-all duration-300 ease-in-out">
            {tab==='categories' && <FeeCategories showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('categories', n)} onLoading={(v)=>onLoading('categories', v)} />}
            {tab==='classFees' && <ClassFees showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('classFees', n)} onLoading={(v)=>onLoading('classFees', v)} />}
            {tab==='arrears' && <Arrears showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('arrears', n)} onLoading={(v)=>onLoading('arrears', v)} />}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function FeeCategories({ showSuccess, showError, onCount, onLoading }){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name:'', description:'' })
  const [error, setError] = useState('')
  const load = async () => {
    setLoading(true)
    onLoading?.(true)
    try {
      const { data } = await api.get('/finance/fee-categories/')
      setItems(data)
      onCount?.(data.length)
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ load() },[])
  const create = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/finance/fee-categories/', form)
      setForm({ name:'', description:'' })
      load()
      showSuccess('Fee Category Created', `Fee category "${form.name}" has been successfully created.`)
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
      showError('Failed to Create Fee Category', 'There was an error creating the fee category. Please try again.')
    }
  }
  return (
    <div className="space-y-6">
      {/* Create Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Create Fee Category</h3>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-red-800">Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        <form onSubmit={create} className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              placeholder="e.g., Tuition Fee"
              value={form.name}
              onChange={e=>setForm({...form, name:e.target.value})}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              placeholder="Brief description of the fee category"
              value={form.description}
              onChange={e=>setForm({...form, description:e.target.value})}
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Category
            </button>
          </div>
        </form>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Fee Categories</h3>
            </div>
            <div className="text-sm text-gray-500">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  Loading...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-gray-900">{items.length}</span>
                  {items.length === 1 ? 'category' : 'categories'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({length: 3}).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No fee categories</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first fee category above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold text-blue-600">
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 max-w-xs truncate">
                          {item.description || <span className="italic text-gray-400">No description</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="inline-flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Recently
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ClassFees({ showSuccess, showError, onCount, onLoading }){
  const [classFees, setClassFees] = useState([])
  const [classes, setClasses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ fee_category:'', klass:'', klasses:[], amount:'', year:new Date().getFullYear(), term:'', due_date:'' })
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [selectedClasses, setSelectedClasses] = useState([])
  const [assignmentMode, setAssignmentMode] = useState('single') // 'single' or 'multiple'

  // Filter classes based on search term
  const filteredClasses = useMemo(() => {
    if (!searchTerm) return classes
    return classes.filter(cls => cls.name.toLowerCase().includes(searchTerm.toLowerCase()) || cls.grade_level.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [classes, searchTerm])

  const load = async () => {
    setLoading(true)
    onLoading?.(true)
    try {
      const [cf, cl, cats] = await Promise.all([
        api.get('/finance/class-fees/'),
        api.get('/academics/classes/'),
        api.get('/finance/fee-categories/'),
      ])
      setClassFees(cf.data)
      setClasses(cl.data)
      setCategories(cats.data)
      onCount?.(cf.data.length)
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ load() },[])

  const create = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const hasMulti = Array.isArray(form.klasses) && form.klasses.length > 0
      const payload = {
        fee_category: form.fee_category,
        amount: parseFloat(form.amount),
        year: form.year,
        term: form.term,
        due_date: form.due_date || null,
        ...(hasMulti ? { klasses: form.klasses.map(Number) } : { klass: form.klass })
      }
      await api.post('/finance/class-fees/', payload)
      setForm(f => ({ ...f, amount:'', due_date:'', klass:'', klasses:[] }))
      setSelectedClasses([])
      load()
      const targetDesc = (Array.isArray(form.klasses) && form.klasses.length > 0)
        ? `${form.klasses.length} classes`
        : `class ID ${form.klass}`
      showSuccess('Class Fee Assigned', `Fee of KES ${form.amount} has been assigned to ${targetDesc} for ${form.year} Term ${form.term}.`)
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
      showError('Failed to Assign Class Fee', 'There was an error assigning the class fee. Please try again.')
    }
  }

  const resetForm = () => {
    setForm({ fee_category:'', klass:'', klasses:[], amount:'', year:new Date().getFullYear(), term:'', due_date:'' })
    setSelectedClasses([])
    setError('')
  }

  const getSelectedClassCount = () => {
    if (assignmentMode === 'single') return form.klass ? 1 : 0
    return form.klasses.length
  }

  return (
    <div className="space-y-6">
      {/* Assignment Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-6 text-gray-800">Fee Assignment Details</h3>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-red-800">Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        <form onSubmit={create} className="space-y-6">
          {/* Assignment Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Assignment Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`relative flex cursor-pointer rounded-lg border py-3 px-4 ${assignmentMode === 'single' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                  <input
                    type="radio"
                    name="assignmentMode"
                    value="single"
                    checked={assignmentMode === 'single'}
                    onChange={(e) => setAssignmentMode(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${assignmentMode === 'single' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {assignmentMode === 'single' && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
                    </div>
                    <span className="text-sm font-medium">Single Class</span>
                  </div>
                </label>
                <label className={`relative flex cursor-pointer rounded-lg border py-3 px-4 ${assignmentMode === 'multiple' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                  <input
                    type="radio"
                    name="assignmentMode"
                    value="multiple"
                    checked={assignmentMode === 'multiple'}
                    onChange={(e) => setAssignmentMode(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${assignmentMode === 'multiple' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {assignmentMode === 'multiple' && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
                    </div>
                    <span className="text-sm font-medium">Multiple Classes</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {getSelectedClassCount()} class{getSelectedClassCount() !== 1 ? 'es' : ''} selected
            </div>
          </div>

          {/* Fee Category Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fee Category <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={form.fee_category}
                onChange={e=>setForm({...form, fee_category:e.target.value})}
                required
              >
                <option value="">Select a fee category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (KES) <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e=>setForm({...form, amount:e.target.value})}
                required
              />
            </div>
          </div>

          {/* Academic Year and Term */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Academic Year <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                type="number"
                placeholder="2024"
                value={form.year}
                onChange={e=>setForm({...form, year:e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Term <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={form.term}
                onChange={e=>setForm({...form, term:e.target.value})}
                required
              >
                <option value="">Select term</option>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>
          </div>

          {/* Class Selection */}
          {assignmentMode === 'single' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={form.klass}
                onChange={e=>setForm({...form, klass:e.target.value, klasses:[]})}
              >
                <option value="">Choose a class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search & Select Classes
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    type="text"
                    placeholder="Search classes..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                <div className="p-3 space-y-2">
                  {filteredClasses.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No classes found</p>
                  ) : (
                    filteredClasses.map(cls => (
                      <label key={cls.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.klasses.includes(cls.id.toString())}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({...form, klasses: [...form.klasses, cls.id.toString()], klass: ''})
                            } else {
                              setForm({...form, klasses: form.klasses.filter(id => id !== cls.id.toString()), klass: ''})
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{cls.name}</div>
                          <div className="text-xs text-gray-500">{cls.grade_level}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {form.klasses.length > 0 && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{form.klasses.length}</span> class{form.klasses.length !== 1 ? 'es' : ''} selected
                </div>
              )}
            </div>
          )}

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date (Optional)
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              type="date"
              value={form.due_date}
              onChange={e=>setForm({...form, due_date:e.target.value})}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Reset Form
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>

              <button
                disabled={!form.fee_category || !form.amount || !form.year || !form.term || getSelectedClassCount() === 0}
                className={`px-6 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                  !form.fee_category || !form.amount || !form.year || !form.term || getSelectedClassCount() === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                Assign Fees ({getSelectedClassCount()} class{getSelectedClassCount() !== 1 ? 'es' : ''})
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Preview Section */}
      {showPreview && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Assignment Preview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Fee Category:</span>
                <p className="text-sm text-gray-900">{categories.find(c => c.id === parseInt(form.fee_category))?.name || 'Not selected'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Amount:</span>
                <p className="text-sm text-gray-900">{form.amount ? `KES ${parseFloat(form.amount).toLocaleString()}` : 'Not set'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Academic Year:</span>
                <p className="text-sm text-gray-900">{form.year || 'Not set'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Term:</span>
                <p className="text-sm text-gray-900">{form.term ? `Term ${form.term}` : 'Not selected'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Classes:</span>
                {getSelectedClassCount() > 0 ? (
                  <div className="mt-1 space-y-1">
                    {assignmentMode === 'single' ? (
                      <p className="text-sm text-gray-900">{classes.find(c => c.id === parseInt(form.klass))?.name} - {classes.find(c => c.id === parseInt(form.klass))?.grade_level}</p>
                    ) : (
                      form.klasses.map(classId => {
                        const cls = classes.find(c => c.id === parseInt(classId))
                        return cls ? (
                          <p key={classId} className="text-sm text-gray-900">• {cls.name} - {cls.grade_level}</p>
                        ) : null
                      })
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No classes selected</p>
                )}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Due Date:</span>
                <p className="text-sm text-gray-900">{form.due_date || 'No due date set'}</p>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-500">Total Students:</span>
                <p className="text-sm text-gray-900">
                  {getSelectedClassCount() > 0 ? `Approximately ${getSelectedClassCount() * 25} students will receive invoices` : 'No students will receive invoices'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Assignments Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Recent Fee Assignments</h3>
            <div className="text-sm text-gray-500">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  Loading...
                </span>
              ) : (
                <span>{classFees.length} assignments</span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                Array.from({length: 3}).map((_, i) => (
                  <tr key={`loading-${i}`}>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                  </tr>
                ))
              ) : classFees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">
                    No fee assignments found. Create your first assignment above.
                  </td>
                </tr>
              ) : (
                classFees.slice(0, 10).map(cf => (
                  <tr key={cf.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cf.fee_category_detail?.name || cf.fee_category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cf.klass_detail || cf.klass}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cf.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Term {cf.term}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      KES {Number(cf.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cf.due_date || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Arrears({ showSuccess, showError, onCount, onLoading }){
  const [classes, setClasses] = useState([])
  const [items, setItems] = useState([])
  const [klass, setKlass] = useState('')
  const [minBalance, setMinBalance] = useState('')
  const [loading, setLoading] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState('Dear Parent/Guardian of {student_name} ({class}), your outstanding balance is {balance}. Kindly clear at the earliest. Thank you.')
  const [sendInApp, setSendInApp] = useState(true)
  const [sendSms, setSendSms] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [emailSubject, setEmailSubject] = useState('School Fees Arrears')
  const [sending, setSending] = useState(false)
  const [resultMsg, setResultMsg] = useState('')

  const load = async (params={}) => {
    setLoading(true)
    onLoading?.(true)
    try {
      const query = new URLSearchParams(params).toString()
      const url = '/finance/invoices/arrears/' + (query? `?${query}`:'')
      const { data } = await api.get(url)
      setItems(data)
      onCount?.(data.length)
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ (async()=>{
    const { data } = await api.get('/academics/classes/')
    setClasses(data)
    load({})
  })() },[])

  const filter = (e) => {
    e.preventDefault()
    const params = {}
    if (klass) params.klass = klass
    if (minBalance) params.min_balance = minBalance
    load(params)
  }

  const totalArrears = useMemo(()=> items.reduce((s, it) => s + (it.balance||0), 0), [items])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Arrears</p>
              <p className="text-2xl font-bold text-red-600">
                {loading ? (
                  <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  `KES ${totalArrears.toLocaleString()}`
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Students with Arrears</p>
              <p className="text-2xl font-bold text-blue-600">
                {loading ? (
                  <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  items.length
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Ready to Notify</p>
              <button
                disabled={loading || items.length===0}
                onClick={() => { setNotifyOpen(true); setResultMsg('') }}
                className={`text-sm font-medium transition-colors ${
                  loading || items.length===0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-green-600 hover:text-green-700'
                }`}
              >
                {loading || items.length===0 ? 'No students to notify' : `${items.length} students`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
        </div>

        <form onSubmit={filter} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class Filter
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
              value={klass}
              onChange={e=>setKlass(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Balance (KES)
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={minBalance}
              onChange={e=>setMinBalance(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full md:w-auto px-6 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Students with Outstanding Balances</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm">
                <span className="text-gray-500">Total: </span>
                <span className="font-semibold text-red-600">
                  {loading ? (
                    <div className="inline-block w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    `KES ${totalArrears.toLocaleString()}`
                  )}
                </span>
              </div>
              <button
                disabled={loading || items.length===0}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  loading || items.length===0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-600 text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2'
                }`}
                onClick={()=>{ setNotifyOpen(true); setResultMsg('') }}
              >
                {loading ? 'Loading...' : `Notify ${items.length} Students`}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          {loading ? (
            <div className="p-6">
              <div className="space-y-4">
                {Array.from({length: 5}).map((_, i) => (
                  <div key={`loading-${i}`} className="animate-pulse">
                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-12"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No students with arrears</h3>
              <p className="mt-1 text-sm text-gray-500">All students are up to date with their payments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Billed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={item.student_id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold text-blue-600">
                              {item.student_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{item.student_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.class}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        KES {Number(item.total_billed).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        KES {Number(item.total_paid).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.balance > 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          KES {Number(item.balance).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Notification Modal */}
      <Modal open={notifyOpen} onClose={()=>setNotifyOpen(false)} title="Send Arrears Notifications" size="lg">
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-blue-900">Available Placeholders:</p>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{'{student_name}'}</code>
                    <span className="text-blue-700">Student's full name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{'{class}'}</code>
                    <span className="text-blue-700">Student's class</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{'{balance}'}</code>
                    <span className="text-blue-700">Outstanding balance amount</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={async (e)=>{
            e.preventDefault(); setSending(true); setResultMsg('')
            try {
              const payload = {
                message: notifyMsg,
                klass: klass ? Number(klass) : null,
                min_balance: minBalance ? Number(minBalance) : 0,
                send_in_app: sendInApp,
                send_sms: sendSms,
                send_email: sendEmail,
                email_subject: emailSubject,
              }
              const { data: created } = await api.post('/communications/arrears-campaigns/', payload)
              const { data: result } = await api.post(`/communications/arrears-campaigns/${created.id}/send/`)
              setResultMsg(`Notifications queued: ${result.sent_count}`)
              setNotifyOpen(false)
              showSuccess('Fee Arrears Notifications Sent', `Successfully queued ${result.sent_count} fee arrears notifications.`)
            } catch (err) {
              showError('Failed to Send Notifications', 'There was an error sending the fee arrears notifications. Please try again.')
            } finally {
              setSending(false)
            }
          }} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Message
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                rows={4}
                value={notifyMsg}
                onChange={e=>setNotifyMsg(e.target.value)}
                placeholder="Enter your notification message..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={sendInApp}
                  onChange={e=>setSendInApp(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">In-App</div>
                  <div className="text-sm text-gray-500">Send via app notifications</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={sendSms}
                  onChange={e=>setSendSms(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">SMS</div>
                  <div className="text-sm text-gray-500">Send text messages</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={e=>setSendEmail(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Email</div>
                  <div className="text-sm text-gray-500">Send email notifications</div>
                </div>
              </label>
            </div>

            {sendEmail && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Email subject line"
                  value={emailSubject}
                  onChange={e=>setEmailSubject(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={()=>setNotifyOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={sending}
                className={`px-6 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                  sending
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {sending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </div>
                ) : (
                  'Send Notifications'
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}

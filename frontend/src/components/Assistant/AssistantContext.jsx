import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'

const AssistantContext = createContext({
  open: false,
  openPanel: () => {},
  closePanel: () => {},
  togglePanel: () => {},
  memory: {},
  setMemory: () => {},
  getMemory: () => ({}),
})

export function AssistantProvider({ children }){
  const [open, setOpen] = useState(false)
  const [memory, setMemoryState] = useState({
    lastExamId: null,
    lastResource: null, // { type, id }
    pendingConfirm: null, // { action: 'publish'|'delete', payload: any }
    lastClassName: null,
    lastExamName: null,
    lastRoute: null,
    lastSearch: null, // { scope, q }
    history: [], // [{ type, raw }]
    lastResults: [], // [{ type, id, name }]
  })
  const openPanel = useCallback(()=> setOpen(true), [])
  const closePanel = useCallback(()=> setOpen(false), [])
  const togglePanel = useCallback(()=> setOpen(v => !v), [])
  const setMemory = useCallback((updater) => {
    setMemoryState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...(updater || {}) }
      return next
    })
  }, [])
  const getMemory = useCallback(()=> memory, [memory])
  const pushIntent = useCallback((entry) => {
    setMemoryState(prev => {
      const nextHist = [...(prev.history || []), entry].slice(-3)
      return { ...prev, history: nextHist }
    })
  }, [])
  const value = useMemo(()=>({ open, openPanel, closePanel, togglePanel, memory, setMemory, getMemory, pushIntent }), [open, openPanel, closePanel, togglePanel, memory, setMemory, getMemory, pushIntent])
  React.useEffect(()=>{
    const onKey = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && (e.key === 'k' || e.key === 'K')){
        e.preventDefault()
        togglePanel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePanel])
  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistant(){
  return useContext(AssistantContext)
}

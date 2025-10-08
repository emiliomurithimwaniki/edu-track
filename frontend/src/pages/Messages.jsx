import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api'
import { useNotification } from '../components/NotificationContext'
import { useAuth } from '../auth'

export default function Messages(){
  const { user } = useAuth()
  const { showSuccess, showError } = useNotification()
  const location = useLocation()
  const [inbox, setInbox] = useState([])
  const [outbox, setOutbox] = useState([])
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState([])
  const [query, setQuery] = useState('')
  const [activeUser, setActiveUser] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [viewTab, setViewTab] = useState('chats') // chats | system | role | broadcast (admin only)
  const [roleTarget, setRoleTarget] = useState('teacher')
  const [roleMessage, setRoleMessage] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const isAdmin = user?.role === 'admin'
  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'finance', label: 'Finance' },
    { value: 'student', label: 'Student' },
  ]

  // Allowed roles to show in people list
  const allowedRoles = useMemo(() => {
    if (user?.role === 'admin') return ['admin','teacher','finance','student']
    if (user?.role === 'teacher') return ['admin']
    if (user?.role === 'finance') return ['admin','teacher']
    if (user?.role === 'student') return ['admin','finance']
    return []
  }, [user])

  // Load inbox + outbox
  const [isSyncing, setIsSyncing] = useState(false)
  const loadMessages = async (silent = true) => {
    if (silent) setIsSyncing(true)
    else setLoading(true)
    try {
      const [inb, out] = await Promise.all([
        api.get('/communications/messages/'),
        api.get('/communications/messages/outbox/'),
      ])
      setInbox(Array.isArray(inb.data) ? inb.data : (inb.data?.results||[]))
      setOutbox(Array.isArray(out.data) ? out.data : (out.data?.results||[]))
    } finally {
      if (silent) setIsSyncing(false)
      else setLoading(false)
    }
  }

  // System messages
  const [systemMessages, setSystemMessages] = useState([])
  const loadSystem = async () => {
    try {
      const res = await api.get('/communications/messages/system/')
      setSystemMessages(Array.isArray(res.data) ? res.data : (res.data?.results||[]))
    } catch {
      setSystemMessages([])
    }
  }

  // Load users list by allowed roles and query
  const loadUsers = async (q='') => {
    try {
      // Admin: show everyone in school; others: fetch and filter by allowedRoles
      const { data } = await api.get(`/auth/users/?q=${encodeURIComponent(q)}`)
      const list = Array.isArray(data) ? data : []
      const filtered = (user?.role === 'admin') ? list : list.filter(u => allowedRoles.includes(u.role))
      setAllUsers(filtered.filter(u => u.id !== user?.id))
    } catch {
      setAllUsers([])
    }
  }

  useEffect(() => { loadMessages(false); loadUsers(''); loadSystem() }, [])
  // Merge message participants (from inbox/outbox) into allUsers so deep-links can resolve
  useEffect(() => {
    if ((!Array.isArray(inbox) || inbox.length === 0) && (!Array.isArray(outbox) || outbox.length === 0)) return
    const byId = new Map((allUsers||[]).map(u => [u.id, u]))
    // from inbound messages: sender_detail
    for (const m of inbox || []){
      const d = m?.sender_detail
      if (d && d.id && !byId.has(d.id)) byId.set(d.id, d)
    }
    // from outbound messages: recipients[].user_detail
    for (const m of outbox || []){
      const recs = Array.isArray(m?.recipients) ? m.recipients : []
      for (const r of recs){
        const d = r?.user_detail
        const id = r?.user || d?.id
        if (id && !byId.has(id)) byId.set(id, d || { id })
      }
    }
    const merged = Array.from(byId.values()).filter(Boolean)
    // Only update if there is any new id
    if (merged.length !== (allUsers||[]).length){
      setAllUsers(merged)
    }
  }, [inbox, outbox])
  // Deep-linking: open user or switch tab via query params
  const desiredUserIdRef = useRef(null)
  useEffect(() => {
    try{
      const sp = new URLSearchParams(location.search)
      const tab = sp.get('tab')
      const openUserId = sp.get('openUserId')
      if (tab === 'system') setViewTab('system')
      if (openUserId) {
        const idNum = Number(openUserId)
        if(!Number.isNaN(idNum)){
          desiredUserIdRef.current = idNum
        }
      }
    }catch{}
  }, [location.search])
  // When users list loads/changes, apply desired open user if any
  useEffect(() => {
    if(!desiredUserIdRef.current) return
    const target = allUsers.find(u => u.id === desiredUserIdRef.current)
    if (target){
      setActiveUser(target)
      setViewTab('chats')
      desiredUserIdRef.current = null
      return
    }
    // Fallback: try derive from inbox/outbox details without waiting for directory
    const fromInbox = (inbox||[]).find(m => m.sender === desiredUserIdRef.current)?.sender_detail
    if (fromInbox && fromInbox.id){
      setActiveUser(fromInbox)
      setViewTab('chats')
      desiredUserIdRef.current = null
      return
    }
    // Fallback 2: from outbox recipients
    for (const m of outbox || []){
      const hit = (m.recipients||[]).find(r => r.user === desiredUserIdRef.current)
      if (hit){
        const u = hit.user_detail || { id: hit.user }
        setActiveUser(u)
        setViewTab('chats')
        desiredUserIdRef.current = null
        return
      }
    }
  }, [allUsers])
  // Background refresh of user directory every 60s
  useEffect(() => {
    const id = setInterval(() => loadUsers(''), 60000)
    return () => clearInterval(id)
  }, [])

  // Build conversation with a selected user by combining inbox/outbox
  const conversation = useMemo(() => {
    if (!activeUser) return []
    const mineId = user?.id
    const partnerId = activeUser.id
    const inbound = inbox.filter(m => m.sender === partnerId)
    const outbound = outbox.filter(m => Array.isArray(m.recipients) && m.recipients.some(r => r.user === partnerId))
    const all = [...inbound, ...outbound]
    all.sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    return all
  }, [activeUser, inbox, outbox, user])

  // Compute per-user last message and unread counts
  const userMeta = useMemo(() => {
    const meta = new Map()
    const add = (uId, msg, mine) => {
      const cur = meta.get(uId) || { last: null, unread: 0 }
      if (!cur.last || new Date(msg.created_at) > new Date(cur.last.created_at)) cur.last = msg
      // unread only counts inbound messages where I'm a recipient and not read
      if (!mine && Array.isArray(msg.recipients)){
        const r = msg.recipients.find(x => x.user === user?.id)
        if (r && !r.read) cur.unread += 1
      }
      meta.set(uId, cur)
    }
    // Inbound: sender is other user
    inbox.forEach(m => add(m.sender, m, false))
    // Outbound: recipients include other user
    outbox.forEach(m => (m.recipients||[]).forEach(r => add(r.user, m, true)))
    return meta
  }, [inbox, outbox, user])

  // Presence (client-only heuristic): online if last activity within 10 minutes
  const presenceMap = useMemo(() => {
    const m = new Map()
    const now = Date.now()
    const base = allUsers
    base.forEach(u => {
      const um = userMeta.get(u.id)
      const lastTs = um?.last ? new Date(um.last.created_at).getTime() : 0
      m.set(u.id, (now - lastTs) < 10*60*1000)
    })
    return m
  }, [allUsers, userMeta])

  // Aggregate unread counts for tabs
  const chatsUnread = useMemo(() => {
    const myId = user?.id
    if (!Array.isArray(inbox) || !myId) return 0
    return inbox.reduce((acc, m) => {
      // Only non-system messages counted in Chats
      if (m && !m.system_tag && Array.isArray(m.recipients)){
        const rec = m.recipients.find(r => r.user === myId)
        if (rec && !rec.read) return acc + 1
      }
      return acc
    }, 0)
  }, [inbox, user])

  const systemUnread = useMemo(() => {
    const myId = user?.id
    if (!Array.isArray(systemMessages) || !myId) return 0
    return systemMessages.reduce((acc, m) => {
      if (Array.isArray(m.recipients)){
        const rec = m.recipients.find(r => r.user === myId)
        if (rec && !rec.read) return acc + 1
      }
      return acc
    }, 0)
  }, [systemMessages, user])

  // Sort users by last message timestamp (desc), place those without messages at the bottom
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allUsers
    return allUsers.filter(u => {
      const name = (u.first_name || u.username || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [allUsers, query])

  const sortedUsers = useMemo(() => {
    const arr = [...filteredUsers]
    arr.sort((a, b) => {
      const la = userMeta.get(a.id)?.last?.created_at ? new Date(userMeta.get(a.id).last.created_at).getTime() : 0
      const lb = userMeta.get(b.id)?.last?.created_at ? new Date(userMeta.get(b.id).last.created_at).getTime() : 0
      if (lb !== la) return lb - la
      // Tie-breaker: unread desc then name
      const ua = userMeta.get(a.id)?.unread || 0
      const ub = userMeta.get(b.id)?.unread || 0
      if (ub !== ua) return ub - ua
      const na = (a.first_name || a.username || '').toLowerCase()
      const nb = (b.first_name || b.username || '').toLowerCase()
      return na.localeCompare(nb)
    })
    return arr
  }, [filteredUsers, userMeta])

  // Typing simulation (client-only): show typing for partner occasionally while chat is open
  const [typingMap, setTypingMap] = useState(new Map())
  const [showUsersMobile, setShowUsersMobile] = useState(false)
  useEffect(() => {
    if (!activeUser) return
    const id = setInterval(() => {
      setTypingMap(prev => {
        const nm = new Map(prev)
        // 1 in 6 chance to toggle typing for 2s
        if (Math.random() < 0.16){
          nm.set(activeUser.id, true)
          setTimeout(() => {
            setTypingMap(pp => { const mm = new Map(pp); mm.set(activeUser.id, false); return mm })
          }, 2000)
        }
        return nm
      })
    }, 5000)
    return () => clearInterval(id)
  }, [activeUser])

  // Mark as read for any messages in this conversation where I'm a recipient and not read
  useEffect(() => {
    if (!activeUser || !conversation.length) return
    const toMark = conversation.filter(m => Array.isArray(m.recipients) && m.recipients.some(r => r.user === user?.id && !r.read))
    if (toMark.length === 0) return
    ;(async () => {
      for (const m of toMark) {
        try { await api.post(`/communications/messages/${m.id}/mark-read/`) } catch {}
      }
      // Refresh inbox to reflect read changes
      await loadMessages()
    })()
  }, [activeUser, conversation, user])

  // Mark system messages as read when viewing the System tab
  useEffect(() => {
    if (viewTab !== 'system' || systemMessages.length === 0) return
    ;(async () => {
      const unread = systemMessages.filter(m => Array.isArray(m.recipients) && m.recipients.some(r => r.user === user?.id && !r.read))
      for (const m of unread) {
        try { await api.post(`/communications/messages/${m.id}/mark-read/`) } catch {}
      }
      await loadSystem()
      await loadMessages(true)
    })()
  }, [viewTab, systemMessages, user])

  // Light polling to keep conversation fresh while open
  useEffect(() => {
    if (viewTab === 'system'){
      const id = setInterval(() => loadSystem(), 10000)
      return () => clearInterval(id)
    }
    if (!activeUser) return
    const id = setInterval(() => loadMessages(true), 10000)
    return () => clearInterval(id)
  }, [activeUser, viewTab])

  const sendToActive = async (e) => {
    e.preventDefault()
    if (!activeUser || !message.trim()) return
    setSending(true)
    try {
      await api.post('/communications/messages/', {
        body: message,
        audience: 'users',
        recipient_ids: [activeUser.id],
      })
      setMessage('')
      await loadMessages(true)
      showSuccess('Message sent', `Your message to ${activeUser.first_name || activeUser.username} was sent.`)
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to send'
      showError('Send failed', msg)
    } finally { setSending(false) }
  }

  const sendRole = async (e) => {
    e.preventDefault()
    if (!roleMessage.trim()) return
    try {
      await api.post('/communications/messages/', { body: roleMessage, audience: 'role', recipient_role: roleTarget })
      setRoleMessage('')
      await loadMessages(true)
      setViewTab('chats')
      showSuccess('Role message sent', `Delivered to ${roleTarget} role recipients.`)
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to send role message'
      showError('Send failed', msg)
    }
  }

  const sendBroadcast = async (e) => {
    e.preventDefault()
    if (!broadcastMessage.trim()) return
    try {
      await api.post('/communications/messages/', { body: broadcastMessage, audience: 'all' })
      setBroadcastMessage('')
      await loadMessages(true)
      setViewTab('chats')
      showSuccess('Broadcast sent', 'Your announcement was queued for delivery to all users in the school.')
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to broadcast'
      showError('Broadcast failed', msg)
    }
  }

  // Chat scroll management
  const chatRef = useRef(null)
  const atBottomRef = useRef(true)
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const onScroll = () => {
      const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 40
      atBottomRef.current = nearBottom
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // When conversation updates: auto-scroll only if user is already near bottom or last message is mine
  const lastMsg = conversation.length ? conversation[conversation.length - 1] : null
  useEffect(() => {
    const el = chatRef.current
    if (!el || !lastMsg) return
    const mine = lastMsg.sender === user?.id
    if (mine || atBottomRef.current) {
      // scroll smoothly to bottom
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [conversation.length])

  return (
    <div className="h-[calc(100vh-6rem)] bg-white border rounded-md overflow-hidden flex">
      {/* Left: Users list */}
      <aside className="hidden sm:flex w-80 border-r flex-col">
        <div className="flex border-b">
          <button onClick={()=>setViewTab('chats')} className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-2 ${viewTab==='chats'?'border-b-2 border-blue-600 font-medium':''}`}>
            <span>Chats</span>
            {chatsUnread>0 && (
              <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{chatsUnread>99?'99+':chatsUnread}</span>
            )}
          </button>
          <button onClick={()=>setViewTab('system')} className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-2 ${viewTab==='system'?'border-b-2 border-blue-600 font-medium':''}`}>
            <span>System</span>
            {systemUnread>0 && (
              <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{systemUnread>99?'99+':systemUnread}</span>
            )}
          </button>
          {isAdmin && (
            <>
              <button onClick={()=>setViewTab('role')} className={`flex-1 px-3 py-2 text-sm ${viewTab==='role'?'border-b-2 border-blue-600 font-medium':''}`}>Role</button>
              <button onClick={()=>setViewTab('broadcast')} className={`flex-1 px-3 py-2 text-sm ${viewTab==='broadcast'?'border-b-2 border-blue-600 font-medium':''}`}>Broadcast</button>
            </>
          )}
        </div>
        <div className="p-3 border-b">
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full border rounded px-3 py-2"
          />
        </div>
        {viewTab === 'chats' && (
          <div className="flex-1 overflow-y-auto">
            {sortedUsers.map(u => {
              const isActive = activeUser?.id === u.id
              const meta = userMeta.get(u.id)
              const lastText = meta?.last?.body ? String(meta.last.body).slice(0, 50) : ''
              const unread = meta?.unread || 0
              const online = presenceMap.get(u.id)
              const typing = typingMap.get(u.id)
              const lastTime = meta?.last?.created_at ? new Date(meta.last.created_at) : null
              const fmtTime = (d) => {
                if (!d) return ''
                const now = new Date()
                const sameDay = d.toDateString() === now.toDateString()
                return sameDay ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString()
              }
              return (
                <button
                  key={u.id}
                  onClick={()=>{ setActiveUser(u); setViewTab('chats') }}
                  className={`w-full text-left px-3 py-2 border-b hover:bg-gray-50 ${isActive? 'bg-blue-50':''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${online? 'bg-emerald-500':'bg-gray-300'}`}></span>
                      <div className="font-medium text-sm">{u.first_name || u.username}</div>
                    </div>
                    {unread>0 && (
                      <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{unread}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-500 truncate">
                      {typing ? <span className="text-emerald-600">typing…</span> : (lastText || <span className="italic text-gray-400">No messages</span>)}
                    </div>
                    {lastTime && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtTime(lastTime)}</span>
                    )}
                  </div>
                </button>
              )
            })}
            {sortedUsers.length===0 && (
              <div className="p-3 text-sm text-gray-500">No users</div>
            )}
          </div>
        )}

        {isAdmin && viewTab === 'role' && (
          <form onSubmit={sendRole} className="p-3 space-y-2">
            <label className="text-xs text-gray-600">Send to role</label>
            <select className="w-full border rounded px-2 py-1" value={roleTarget} onChange={e=>setRoleTarget(e.target.value)}>
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <textarea className="w-full border rounded px-3 py-2 min-h-[120px]" value={roleMessage} onChange={e=>setRoleMessage(e.target.value)} placeholder="Type your message..."/>
            <button className="w-full px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!roleMessage.trim()}>Send</button>
          </form>
        )}

        {isAdmin && viewTab === 'broadcast' && (
          <form onSubmit={sendBroadcast} className="p-3 space-y-2">
            <label className="text-xs text-gray-600">Broadcast to entire school</label>
            <textarea className="w-full border rounded px-3 py-2 min-h-[140px]" value={broadcastMessage} onChange={e=>setBroadcastMessage(e.target.value)} placeholder="Type your announcement..."/>
            <button className="w-full px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!broadcastMessage.trim()}>Broadcast</button>
          </form>
        )}
      </aside>

      {/* Right: Chat thread or System feed */}
      <section className="flex-1 flex flex-col">
        <div className="h-14 border-b px-2 sm:px-4 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="font-medium">
            <div className="flex items-center gap-2">
              <button className="sm:hidden px-2 py-1 rounded border" onClick={()=>setShowUsersMobile(true)}>Users</button>
              <span>{viewTab==='system' ? 'System' : (activeUser ? (activeUser.first_name || activeUser.username) : 'Select a user')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {viewTab==='system' ? (
              <button onClick={()=>loadSystem()} className="px-2 py-1 rounded border hover:bg-gray-50">Load newer</button>
            ) : (
              <button onClick={()=>loadMessages(true)} className="px-2 py-1 rounded border hover:bg-gray-50">Load newer</button>
            )}
            {isSyncing && (
              <span className="inline-flex items-center gap-1">
                <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Syncing
              </span>
            )}
          </div>
        </div>
        <div ref={chatRef} className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-2 bg-gray-50">
          {loading && viewTab!=='system' && <div className="text-sm text-gray-500">Loading...</div>}
          {viewTab==='system' ? (
            <div className="space-y-2">
              {systemMessages.length === 0 && (
                <div className="text-sm text-gray-500">No system messages.</div>
              )}
              {systemMessages.map(m => (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[80%] px-3 py-2 rounded-lg shadow-sm text-sm whitespace-pre-wrap bg-white border">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{m.system_tag || 'system'}</div>
                    {m.body}
                    <div className="mt-1 text-[10px] text-gray-500">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {!loading && activeUser && conversation.length === 0 && (
                <div className="text-sm text-gray-500">No messages yet. Say hi!</div>
              )}
              {!loading && conversation.map(m => {
                const mine = m.sender === user?.id
                return (
                  <div key={m.id} className={`flex ${mine? 'justify-end':'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-lg shadow-sm text-sm whitespace-pre-wrap ${mine? 'bg-blue-600 text-white':'bg-white border'}`}>
                      {m.body}
                      <div className={`mt-1 text-[10px] ${mine? 'text-white/80':'text-gray-500'}`}>{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
        <div className="border-t px-2 py-1 text-xs text-gray-500 flex items-center justify-between">
          <button type="button" disabled className="px-2 py-1 rounded border opacity-60 cursor-not-allowed" title="Pagination not enabled yet">Load older</button>
          <span />
        </div>
        {viewTab!=='system' && (
        <form onSubmit={sendToActive} className="h-16 border-t p-2 flex gap-2 sticky bottom-0 bg-white">
          <input
            value={message}
            onChange={e=>setMessage(e.target.value)}
            placeholder={activeUser? 'Type a message':'Select a user to start chatting'}
            className="flex-1 border rounded px-3"
            disabled={!activeUser}
          />
          <button disabled={!activeUser || sending || !message.trim()} className="px-4 rounded bg-blue-600 text-white disabled:opacity-50">{sending? 'Sending…':'Send'}</button>
        </form>
        )}
      </section>

      {/* Mobile slide-over for Users */}
      {showUsersMobile && (
        <div className="sm:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowUsersMobile(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-xs bg-white border-r shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-3 h-12 border-b">
              <div className="font-medium">Users</div>
              <button className="px-2 py-1 rounded border" onClick={()=>setShowUsersMobile(false)}>Close</button>
            </div>
            {/* Reuse the same sidebar content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b">
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users..." className="w-full border rounded px-3 py-2" />
              </div>
              {sortedUsers.map(u => {
                const isActive = activeUser?.id === u.id
                const meta = userMeta.get(u.id)
                const lastText = meta?.last?.body ? String(meta.last.body).slice(0, 40) : ''
                const unread = meta?.unread || 0
                const online = presenceMap.get(u.id)
                return (
                  <button key={u.id} onClick={()=>{ setActiveUser(u); setViewTab('chats'); setShowUsersMobile(false) }} className={`w-full text-left px-3 py-2 border-b hover:bg-gray-50 ${isActive? 'bg-blue-50':''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${online? 'bg-emerald-500':'bg-gray-300'}`}></span>
                        <div className="font-medium text-sm">{u.first_name || u.username}</div>
                      </div>
                      {unread>0 && (<span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{unread}</span>)}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{lastText || <span className="italic text-gray-400">No messages</span>}</div>
                  </button>
                )
              })}
              {sortedUsers.length===0 && (<div className="p-3 text-sm text-gray-500">No users</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

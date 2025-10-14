const POLITE_PREFIXES = [
  'please', 'pls', 'plz', 'could you', 'would you', 'can you', 'kindly', 'i want to', 'i would like to',
  'may you', 'could u', 'would u', 'can u', 'could you please', 'would you please', 'can you please'
]
const GREETINGS = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening']
const SMALL_TALK = [
  'how are you',
  "how's it going",
  'how is it going',
  "what's up",
  'whats up',
  'how are ya',
  'how do you do',
  'good day',
  'greetings',
]
const HELP_PHRASES = [
  'help', 'what can you do', 'what can i do', 'show commands', 'commands', 'capabilities', 'how to', 'guide'
]

function normalize(text){
  let t = (text || '').toLowerCase().trim()
  // strip punctuation that often appears in chat
  t = t.replace(/[!,.?]+/g, ' ').replace(/\s+/g, ' ').trim()
  // remove polite prefixes at the start
  for (const p of POLITE_PREFIXES){
    if (t.startsWith(p + ' ')){
      t = t.slice(p.length).trim()
      break
    }
  }
  // remove leading greetings but mark if any greeting found
  let greeted = false
  for (const g of GREETINGS){
    if (t === g || t.startsWith(g + ' ')){
      t = t === g ? '' : t.slice(g.length).trim()
      greeted = true
      break
    }
  }
  return { text: t, greeted }
}

// --- Fuzzy matching utilities ---
function levenshtein(a, b){
  a = a || ''; b = b || ''
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({length: m+1}, (_, i) => [i, ...Array(n).fill(0)])
  for (let j=0;j<=n;j++) dp[0][j] = j
  for (let i=1;i<=m;i++){
    for (let j=1;j<=n;j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i-1][j] + 1,
        dp[i][j-1] + 1,
        dp[i-1][j-1] + cost
      )
    }
  }
  return dp[m][n]
}

function similarity(a, b){
  if (!a || !b) return 0
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase())
  const maxLen = Math.max(a.length, b.length) || 1
  return 1 - dist / maxLen
}

export function bestFuzzy(word, candidates, threshold=0.7){
  let best = { item: null, score: 0 }
  for (const c of candidates){
    const score = similarity(word, c)
    if (score > best.score){ best = { item: c, score } }
  }
  return best.score >= threshold ? best.item : null
}

export function parseIntent(input){
  const { text, greeted } = normalize(input)
  if (!text && greeted) return { type: 'greet' }
  if (!text) return { type: 'none' }

  // greetings mid-sentence
  if (GREETINGS.some(g => text === g || text.startsWith(g + ' '))) return { type: 'greet' }
  if (SMALL_TALK.some(p => text.includes(p))) return { type: 'greet' }
  if (HELP_PHRASES.some(p => text === p || text.includes(p))) return { type: 'help' }

  // quick navigation keywords
  if (/^(back|go back|previous|prev)$/i.test(text)) return { type: 'back' }

  const openMatch = text.match(/^\b(open|go to|goto|navigate to)\b\s+(.+)/)
  if (openMatch) return { type: 'open', target: openMatch[2] }

  if (/(add|create)\s+student/.test(text)) return { type: 'add_student', raw: input }
  if (/(add|create)\s+class/.test(text)) return { type: 'open', target: 'classes' }
  if (/(add|create)\s+teacher/.test(text)) return { type: 'open', target: 'teachers' }
  if (/(add|create)\s+subject/.test(text)) return { type: 'open', target: 'subjects' }
  if (/^settings$/.test(text)) return { type: 'open', target: 'settings' }

  // Send arrears notifications chain command (flexible patterns)
  const verbSend = /(send|notify|message|remind|broadcast|alert)/i
  const targetParents = /(parent|parents|guardian|guardians|folks|famil(?:y|ies))/i
  const feeWords = /(fee|fees|school\s*fees|arrears|balance|balances|outstanding)/i
  const hasSend = verbSend.test(text)
  const hasParents = targetParents.test(text)
  const hasFees = feeWords.test(text)
  // Also accept phrases like "send fee notice", "fee reminder", "broadcast school fees notice"
  const hasNoticeWord = /(notice|reminder|notices|reminders)/i.test(text)
  if ((hasSend && hasFees) || (hasFees && hasNoticeWord) || (hasSend && hasParents && hasFees) || /fee\s*balance.*(parents|guardians)/i.test(text)){
    const minRaw = (text.match(/(?:min(?:imum)?|over|above|greater\s*than|>=|more\s*than)\s*(?:kes\s*)?(\d+[\.,]?\d*)/i) || [])[1]
    const min_balance = minRaw ? Number(String(minRaw).replace(/[,]/g,'')) : 1
    // class can be specified as "class X", "grade Y", or just a known class name chunk
    const klass = (text.match(/class\s+([^,]+?)(?:\s|$)/i) || text.match(/grade\s+([^,]+?)(?:\s|$)/i) || [])[1]
    const sms = /\b(sms|text)\b/i.test(text)
    const email = /\b(email|mail)\b/i.test(text)
    const inapp = /\b(in[-\s]?app|app|inapp)\b/i.test(text)
    const channels = { sms, email, inapp }
    const message = (text.match(/(?:message|note)\s*[:\-]\s*(.+)$/i) || [])[1] || null
    return { type: 'send_arrears', min_balance, klass, channels, message, raw: input }
  }

  if (/(add|create)\s+exam/.test(text)){
    const name = (text.match(/exam\s+([^,]+?)(?:\s+for|,|$)/) || [])[1]
    const klass = (text.match(/for\s+class\s+([^,]+?)(?:\s+on|,|$)/) || [])[1]
    const date = (text.match(/on\s+(\d{4}-\d{2}-\d{2})/) || [])[1]
    return { type: 'create_exam', name, klass, date, raw: input }
  }

  if (/publish\s+exam/.test(text)){
    const id = (text.match(/exam\s+(\d+)/) || [])[1]
    const byName = (text.match(/publish\s+exam\s+([^\d].*?)(?:\s+for|$)/) || [])[1]
    const klass = (text.match(/for\s+class\s+(.+)/) || [])[1]
    return { type: 'publish_exam', id: id ? Number(id) : null, name: byName || null, klass: klass || null, raw: input }
  }

  if (/delete\s+/.test(text)){
    const m = text.match(/delete\s+(student|exam|teacher|class|result)\s+(\d+)/)
    if (m) return { type: 'delete', resource: m[1], id: Number(m[2]) }
  }

  if (/\bsearch\b|\bfind\b/.test(text)){
    const scope = (text.match(/(students|exams|teachers|classes|results)/) || [])[1] || 'students'
    const q = (text.match(/(?:search|find)\s+(?:in\s+\w+\s+)?(.+)/) || [])[1] || ''
    return { type: 'search', scope, q }
  }

  // --- Fuzzy fallbacks for misspellings ---
  const words = text.split(/\s+/)
  const verb = bestFuzzy(words[0], ['open','goto','go','navigate','publish','delete','search','find','create','add'], 0.6)
  if (verb){
    const rest = words.slice(1).join(' ').trim()
    if (['open','goto','go','navigate'].includes(verb)) return { type: 'open', target: rest }
    if (['search','find'].includes(verb)){
      const scope = bestFuzzy((rest.split(/\s+/)[0]||''), ['students','exams','teachers','classes','results'], 0.6) || 'students'
      const q = rest.replace(/^\w+\s+/, '')
      return { type: 'search', scope, q }
    }
    if (['create','add'].includes(verb)){
      const obj = bestFuzzy((rest.split(/\s+/)[0]||''), ['student','exam','class','teacher','subject','settings'], 0.6)
      if (obj === 'student') return { type: 'add_student', raw: input }
      if (['class','teacher','subject','settings'].includes(obj)) return { type: 'open', target: obj + (obj==='settings'?'':'s') }
      if (obj === 'exam') return { type: 'create_exam', raw: input }
    }
    if (verb === 'publish'){
      const id = (text.match(/(\d{1,6})/) || [])[1]
      return { type: 'publish_exam', id: id ? Number(id) : null, raw: input }
    }
    if (verb === 'delete'){
      const resource = bestFuzzy(words[1]||'', ['student','exam','teacher','class','result'], 0.6)
      const id = (text.match(/(\d{1,8})/) || [])[1]
      if (resource && id) return { type: 'delete', resource, id: Number(id) }
    }
  }

  return { type: 'unknown', raw: input }
}

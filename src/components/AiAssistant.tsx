import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

const SYSTEM_PROMPT = `Ты ассистент бани и сауны «Капля» (Санкт-Петербург, Мичманская ул., 4, Васильевский остров).
Телефон: +7 921 426-00-36. Работаем круглосуточно.
Парные: русская и финская. Есть бассейн, караоке, бильярд, Wi‑Fi, парковка, оплата картой, доставка еды и напитков на заказ.
Аренда по часам: до 4 гостей входит в цену, свыше — по 200 ₽ за гостя. Ориентир по цене: от 950 ₽/час в «счастливые часы» (будни 10:00–17:00), стандартно 1900 ₽/час. Точные цены зависят от зала и времени — их видно в разделе «Бронь».
Допуслуги: веники (дубовый, эвкалиптовый), парение вениками, классический массаж, прокат полотенец и простыней.
Акции: скидка именинникам 15%, семейным парам 10% при заказе от 2 часов, «пятый час в подарок» при заказе от 4 часов (по условиям акции).
Отвечай кратко по-русски и дружелюбно. Не выдумывай цены, скидки и свободное время — для брони направляй в раздел «Бронь» внизу экрана или к администратору по телефону.`

const FAQ_FALLBACK: { q: string[]; a: string }[] = [
  { q: ['цена', 'стоимость', 'сколько стоит', 'прайс'], a: 'Аренда по часам: от 950 ₽/час в счастливые часы (будни 10:00–17:00), стандартно около 1900 ₽/час. Точная цена по вашей дате и залу — в разделе «Бронь».' },
  { q: ['адрес', 'где', 'как доехать', 'метро'], a: 'Санкт-Петербург, Мичманская ул., 4 (Васильевский остров). Телефон: +7 921 426-00-36.' },
  { q: ['время', 'работаете', 'график', 'часы'], a: 'Мы работаем круглосуточно. Свободное время смотрите в разделе «Бронь».' },
  { q: ['бассейн', 'парная', 'сауна', 'баня'], a: 'Есть русская и финская парная, бассейн, караоке и бильярд. Состав зала зависит от выбранного зала.' },
  { q: ['скидк', 'акци', 'день рождения', 'счастлив'], a: 'Счастливые часы: будни 10:00–17:00. Именинникам 15%, семейным парам 10% (от 2 часов). Уточняйте условия у администратора.' },
  { q: ['веник', 'полотенц', 'массаж'], a: 'Можно добавить веники, парение вениками, массаж и прокат полотенец прямо при брони.' },
  { q: ['запись', 'записаться', 'бронь', 'забронировать'], a: 'Откройте раздел «Бронь» внизу: выберите зал, дату, время и число гостей. Администратор подтвердит заявку.' },
]

function localAnswer(text: string): string {
  const lower = text.toLowerCase().trim()
  if (!lower) return 'Напишите вопрос про цены, время или бронь.'
  for (const item of FAQ_FALLBACK) {
    if (item.q.some((k) => lower.includes(k))) return item.a
  }
  return 'Спросите про цены, акции, залы или адрес. Или позвоните: +7 921 426-00-36.'
}

/** URL PocketBase — ИИ идёт через серверный хук /api/pspbrf/ai (ключ только на сервере) */
const pbUrl = (
  (import.meta.env.VITE_PB_URL as string | undefined)?.trim() || ''
).replace(/\/$/, '')
const useAiProxy = Boolean(pbUrl && pbUrl.startsWith('http') && !pbUrl.includes('placeholder'))

async function askAi(history: Msg[], userText: string): Promise<string> {
  if (!useAiProxy) return localAnswer(userText)

  const messages: Msg[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.filter((m) => m.role !== 'system').slice(-10),
    { role: 'user', content: userText },
  ]

  try {
    const res = await fetch(`${pbUrl}/api/pspbrf/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.fallback) {
      console.warn('[AI]', res.status, data)
      return localAnswer(userText) + '\n\n_(ИИ временно недоступен, ответ из базы знаний)_'
    }
    if (typeof data.content === 'string' && data.content.trim()) {
      return data.content.trim()
    }
  } catch (e) {
    console.warn('[AI] proxy failed', e)
  }
  return localAnswer(userText)
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    {
      role: 'bot',
      text: useAiProxy
        ? 'Привет! Я ассистент бани «Капля». Спросите про залы, цены, акции или бронь.'
        : 'Привет! Я помогу с вопросами про цены, время и бронь.',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<Msg[]>([])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  async function send() {
    const t = input.trim()
    if (!t || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: t }])
    setBusy(true)
    try {
      const reply = await askAi(historyRef.current, t)
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: t },
        { role: 'assistant', content: reply },
      ]
      setMessages((m) => [...m, { role: 'bot', text: reply }])
    } catch (e) {
      console.warn(e)
      const fallback = localAnswer(t)
      setMessages((m) => [...m, { role: 'bot', text: fallback }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть чат-ассистента"
          style={{
            position: 'fixed',
            bottom: 90,
            right: 16,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 20px rgba(61,124,255,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 60,
            cursor: 'pointer',
          }}
        >
          <MessageCircle size={24} />
        </button>
      )}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 90,
            right: 12,
            left: 12,
            maxWidth: 360,
            marginLeft: 'auto',
            height: 420,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 60,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Ассистент</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {useAiProxy ? 'ИИ · онлайн' : 'Локальный режим'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 14,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Печатает…</div>
            )}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Спросите про услуги..."
              style={{ flex: 1, padding: '10px 12px' }}
              disabled={busy}
            />
            <button
              type="button"
              onClick={send}
              className="btn"
              style={{ padding: '0 14px', borderRadius: 12 }}
              disabled={busy || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

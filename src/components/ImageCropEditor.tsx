/**
 * Масштаб и кадр как в Telegram / Фото на iPhone:
 * — щипок / колесо мыши = zoom
 * — перетаскивание = сдвиг кадра
 */
import { useCallback, useRef, useState, type CSSProperties } from 'react'

export type CropState = {
  scale: number
  x: number // px offset
  y: number
}

type Props = {
  src: string
  value: CropState
  onChange: (v: CropState) => void
  height?: number
  label?: string
}

const MIN = 1
const MAX = 3

export function ImageCropEditor({
  src,
  value,
  onChange,
  height = 200,
  label,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)
  const [active, setActive] = useState(false)

  const clampScale = (s: number) => Math.min(MAX, Math.max(MIN, s))

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      setActive(true)

      if (pointers.current.size === 1) {
        dragging.current = true
        last.current = { x: e.clientX, y: e.clientY }
      } else if (pointers.current.size === 2) {
        dragging.current = false
        const pts = [...pointers.current.values()]
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        pinchStart.current = { dist, scale: value.scale }
      }
    },
    [value.scale],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.current.size === 2 && pinchStart.current) {
        const pts = [...pointers.current.values()]
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        const nextScale = clampScale(
          pinchStart.current.scale * (dist / Math.max(1, pinchStart.current.dist)),
        )
        onChange({ ...value, scale: nextScale })
        return
      }

      if (dragging.current && pointers.current.size === 1) {
        const dx = e.clientX - last.current.x
        const dy = e.clientY - last.current.y
        last.current = { x: e.clientX, y: e.clientY }
        onChange({
          ...value,
          x: value.x + dx,
          y: value.y + dy,
        })
      }
    },
    [onChange, value],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      dragging.current = false
      setActive(false)
    }
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.08 : 0.08
      onChange({ ...value, scale: clampScale(value.scale + delta) })
    },
    [onChange, value],
  )

  return (
    <div style={{ marginBottom: 10 }}>
      {label && (
        <div
          style={{
            fontSize: 12,
            color: '#71717a',
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
      )}
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{
          height,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#0a0a0c',
          border: active ? '1px solid #3b82f6' : '1px solid #2a2a32',
          position: 'relative',
          touchAction: 'none',
          cursor: dragging.current ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate(calc(-50% + ${value.x}px), calc(-50% + ${value.y}px)) scale(${value.scale})`,
            transformOrigin: 'center center',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            padding: '4px 8px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.55)',
            color: '#e4e4e7',
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {value.scale.toFixed(2)}× · тяните · щипок / колесо
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, scale: clampScale(value.scale - 0.15) })
          }
          style={chipBtn}
        >
          −
        </button>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.01}
          value={value.scale}
          onChange={(e) =>
            onChange({ ...value, scale: clampScale(Number(e.target.value)) })
          }
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, scale: clampScale(value.scale + 0.15) })
          }
          style={chipBtn}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onChange({ scale: 1.1, x: 0, y: 0 })}
          style={{ ...chipBtn, fontSize: 11, padding: '8px 10px' }}
        >
          Сброс
        </button>
      </div>
    </div>
  )
}

const chipBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid #2a2a32',
  background: '#16161a',
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
}

/** CSS transform for public display */
export function cropTransform(c: {
  scale?: number
  x?: number
  y?: number
  offsetX?: number
  offsetY?: number
}): CSSProperties {
  const scale = c.scale ?? 1
  const x = c.x ?? c.offsetX ?? 0
  const y = c.y ?? c.offsetY ?? 0
  return {
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`,
    transformOrigin: 'center center',
  }
}

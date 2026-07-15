import { Environment, Lightformer, useGLTF } from '@react-three/drei'
import { Canvas, type ThreeEvent, useFrame } from '@react-three/fiber'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Group, MathUtils } from 'three'

const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const MAX_DRAG_YAW = 0.72

type ModelPlacement = {
  position: [number, number, number]
  scale: number
  yaw: number
}

export function getNanamiModelUrl(compactViewport: boolean) {
  return compactViewport
    ? '/models/nanami-mobile.glb'
    : '/models/nanami.glb'
}

export function getNanamiPlacement(compactViewport: boolean): ModelPlacement {
  return compactViewport
    ? { position: [0, 0, 0], scale: 0.56, yaw: 1.13 }
    : { position: [0.04, 0, 0], scale: 1.1, yaw: 1.13 }
}

export function clampPointerRotation(pointerX: number, pointerY: number) {
  return {
    x: MathUtils.clamp(pointerY * 0.04, -0.08, 0.08),
    y: MathUtils.clamp(pointerX * 0.09, -0.18, 0.18),
  }
}

export function canAnimateModel(
  documentHidden: boolean,
  prefersReducedMotion: boolean,
) {
  return !documentHidden && !prefersReducedMotion
}

export function getNextKeyboardYaw(currentYaw: number, key: string) {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return currentYaw

  const direction = key === 'ArrowLeft' ? -1 : 1
  return MathUtils.clamp(
    currentYaw + direction * 0.12,
    -MAX_DRAG_YAW,
    MAX_DRAG_YAW,
  )
}

function readMediaQuery(query: string, fallback: boolean) {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? fallback
    : window.matchMedia(query).matches
}

function useMediaQuery(query: string, fallback: boolean) {
  const [matches, setMatches] = useState(() => readMediaQuery(query, fallback))

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(query)
    if (!mediaQuery) return

    const update = () => setMatches(mediaQuery.matches)
    update()
    mediaQuery.addEventListener?.('change', update)

    return () => mediaQuery.removeEventListener?.('change', update)
  }, [query])

  return matches
}

function useDocumentHidden() {
  const hidden = useRef(typeof document !== 'undefined' && document.hidden)

  useEffect(() => {
    const update = () => {
      hidden.current = document.hidden
    }

    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return hidden
}

type NanamiModelProps = {
  compactViewport: boolean
  keyboardYaw: number
  modelUrl: string
  prefersReducedMotion: boolean
}

export function NanamiModel({
  compactViewport,
  keyboardYaw,
  modelUrl,
  prefersReducedMotion,
}: NanamiModelProps) {
  const { scene } = useGLTF(modelUrl)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  const group = useRef<Group>(null)
  const pointerTarget = useRef({ x: 0, y: 0 })
  const dragYaw = useRef(0)
  const dragStart = useRef<{ clientX: number; yaw: number } | null>(null)
  const documentHidden = useDocumentHidden()
  const placement = getNanamiPlacement(compactViewport)

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    pointerTarget.current = clampPointerRotation(event.pointer.x, event.pointer.y)

    if (dragStart.current) {
      const movement = (event.clientX - dragStart.current.clientX) * 0.006
      dragYaw.current = MathUtils.clamp(
        dragStart.current.yaw + movement,
        -MAX_DRAG_YAW,
        MAX_DRAG_YAW,
      )
    }
  }

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    dragStart.current = { clientX: event.clientX, yaw: dragYaw.current }
    if (event.nativeEvent.target instanceof Element) {
      event.nativeEvent.target.setPointerCapture?.(event.pointerId)
    }
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    dragStart.current = null
    if (event.nativeEvent.target instanceof Element) {
      event.nativeEvent.target.releasePointerCapture?.(event.pointerId)
    }
  }

  useFrame((state, delta) => {
    if (
      !group.current ||
      !canAnimateModel(documentHidden.current, prefersReducedMotion)
    ) {
      return
    }

    const targetYaw =
      placement.yaw + keyboardYaw + dragYaw.current + pointerTarget.current.y
    group.current.rotation.y = MathUtils.damp(
      group.current.rotation.y,
      targetYaw,
      4.5,
      delta,
    )
    group.current.rotation.x = MathUtils.damp(
      group.current.rotation.x,
      pointerTarget.current.x,
      4.5,
      delta,
    )
    group.current.position.y =
      placement.position[1] + Math.sin(state.clock.elapsedTime * 0.8) * 0.008
  })

  return (
    <group
      ref={group}
      position={placement.position}
      rotation={[0, placement.yaw, 0]}
      scale={placement.scale}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => {
        pointerTarget.current = { x: 0, y: 0 }
      }}
    >
      <primitive object={clonedScene} />
    </group>
  )
}

export function NanamiExperience() {
  // Freeze the capability choice for this mount so a resize cannot start a
  // second GLB request while the first asset is still decoding.
  const [compactViewport] = useState(() => readMediaQuery(MOBILE_QUERY, true))
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY, true)
  const [keyboardYaw, setKeyboardYaw] = useState(0)
  const modelUrl = getNanamiModelUrl(compactViewport)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    setKeyboardYaw((yaw) => getNextKeyboardYaw(yaw, event.key))
  }

  return (
    <div
      className="hero-3d-canvas"
      role="img"
      aria-label="Interactive 3D portrait of Nanami"
      aria-describedby="nanami-model-instructions"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <span id="nanami-model-instructions" className="sr-only">
        Drag or use the left and right arrow keys to turn Nanami.
      </span>
      <Canvas
        aria-hidden="true"
        dpr={[1, 1.75]}
        camera={{ position: [0, 1.1, 4.5], fov: 32 }}
        frameloop="always"
        performance={{ min: 0.55, max: 1, debounce: 200 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <ambientLight intensity={0.75} />
        <hemisphereLight args={['#d8e9d6', '#07100b', 2.2]} />
        <directionalLight position={[-3, 4, 4]} intensity={3.1} color="#fff3df" />
        <directionalLight position={[-4, 2, -2]} intensity={2.4} color="#7aa987" />
        <Environment background={false} resolution={32}>
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#dcebd9"
            position={[-2, 3, 3]}
            rotation={[0, Math.PI / 4, 0]}
            scale={[3, 3, 1]}
          />
        </Environment>
        <Suspense fallback={null}>
          <NanamiModel
            compactViewport={compactViewport}
            modelUrl={modelUrl}
            keyboardYaw={keyboardYaw}
            prefersReducedMotion={prefersReducedMotion}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

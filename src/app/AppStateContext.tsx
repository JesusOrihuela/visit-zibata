import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useReducer,
  useRef,
} from 'react'
import { medirAccion } from './medicion.ts'
import { type AppAction, type AppState, appReducer, initialAppState } from './state.ts'

const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<Dispatch<AppAction> | null>(null)

export function AppStateProvider({
  children,
  initialState = initialAppState,
}: {
  children: ReactNode
  initialState?: AppState
}) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const ultimo = useRef(state)
  ultimo.current = state
  // Cada acción pasa por la medición antes de llegar al reductor (ver medicion.ts). La identidad de
  // la función no cambia nunca, así que quien la use en un efecto no se vuelve a ejecutar.
  const medido = useCallback((accion: AppAction) => {
    medirAccion(accion, ultimo.current)
    dispatch(accion)
  }, [])
  return (
    <DispatchContext value={medido}>
      <StateContext value={state}>{children}</StateContext>
    </DispatchContext>
  )
}

export function useAppState(): AppState {
  const state = useContext(StateContext)
  if (!state) throw new Error('useAppState debe usarse dentro de <AppStateProvider>')
  return state
}

export function useAppDispatch(): Dispatch<AppAction> {
  const dispatch = useContext(DispatchContext)
  if (!dispatch) throw new Error('useAppDispatch debe usarse dentro de <AppStateProvider>')
  return dispatch
}

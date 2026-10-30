import { AlertTriangle } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { Brand } from '../components/brand/Brand.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { t } from '../i18n/index.ts'
import styles from './Experience.module.css'
/**
 * La última red. Un trozo de código que no llega (red inestable, o una publicación nueva que retiró
 * el chunk de la anterior) se lleva por delante el árbol entero de React y la guía se queda en blanco,
 * sin mapa y sin mensaje. Aquí se atrapa y se ofrece recargar, que es lo fiable: los navegadores
 * recuerdan un `import()` fallido durante la sesión y solo lo olvidan al recargar.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode; variant?: 'pantalla' | 'panel' },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[app]', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const aviso = (
      <EmptyState
        tone="error"
        icon={<AlertTriangle />}
        title={t('data.error.title')}
        action={
          <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
            {t('data.retry')}
          </button>
        }
      >
        {t('data.error.body')}
      </EmptyState>
    )
    // En el panel el aviso ocupa la hoja y el mapa sigue detrás: perderlo todo por una ficha que no
    // carga no tiene sentido cuando el resto de la guía está bien.
    if (this.props.variant === 'panel') return <main className={styles.panelFailure}>{aviso}</main>
    return (
      <main className={styles.fullscreenState}>
        <Brand />
        {aviso}
      </main>
    )
  }
}

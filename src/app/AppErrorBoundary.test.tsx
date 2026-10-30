// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary.tsx'

/** Un trozo que no llega: el `import()` del que depende un panel falla al cargar la página. */
function ChunkQueNoLlega(): never {
  throw new Error('Failed to fetch dynamically imported module')
}

describe('AppErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))

  it('deja pasar lo que no falla', () => {
    render(
      <AppErrorBoundary>
        <p>La guía</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('La guía')).toBeTruthy()
  })

  it('si un chunk no llega, enseña el aviso y no una página en blanco', () => {
    render(
      <AppErrorBoundary>
        <ChunkQueNoLlega />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button')).toBeTruthy()
  })
})

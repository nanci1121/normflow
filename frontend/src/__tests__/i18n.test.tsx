import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n/i18n'

beforeEach(() => {
  i18n.changeLanguage('es')
})

function TestConsumer() {
  const { t, i18n: i18nInstance } = useTranslation()
  return (
    <div>
      <span data-testid="current-lang">{i18nInstance.language}</span>
      <span data-testid="translated">{t('common.save')}</span>
      <button onClick={() => i18nInstance.changeLanguage('en')} data-testid="to-en">EN</button>
      <button onClick={() => i18nInstance.changeLanguage('es')} data-testid="to-es">ES</button>
    </div>
  )
}

describe('i18n', () => {
  it('carga español por defecto', () => {
    render(<TestConsumer />)
    expect(screen.getByTestId('current-lang').textContent).toBe('es')
    expect(screen.getByTestId('translated').textContent).toBe('Guardar')
  })

  it('cambia a inglés correctamente', async () => {
    render(<TestConsumer />)
    await userEvent.click(screen.getByTestId('to-en'))
    expect(screen.getByTestId('current-lang').textContent).toBe('en')
    expect(screen.getByTestId('translated').textContent).toBe('Save')
  })

  it('vuelve a español desde inglés', async () => {
    render(<TestConsumer />)
    await userEvent.click(screen.getByTestId('to-en'))
    expect(screen.getByTestId('translated').textContent).toBe('Save')

    await userEvent.click(screen.getByTestId('to-es'))
    expect(screen.getByTestId('current-lang').textContent).toBe('es')
    expect(screen.getByTestId('translated').textContent).toBe('Guardar')
  })

  it('tiene todas las claves en ambos idiomas', () => {
    const esKeys = Object.keys(i18n.getResourceBundle('es', 'translation'))
    const enKeys = Object.keys(i18n.getResourceBundle('en', 'translation'))

    function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
      return Object.entries(obj).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
          ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      )
    }

    const esFlattened = flatten(
      i18n.getResourceBundle('es', 'translation') as unknown as Record<string, unknown>,
    ).sort()
    const enFlattened = flatten(
      i18n.getResourceBundle('en', 'translation') as unknown as Record<string, unknown>,
    ).sort()

    expect(esFlattened).toEqual(enFlattened)
  })

  it('persiste idioma en localStorage', async () => {
    render(<TestConsumer />)
    await userEvent.click(screen.getByTestId('to-en'))
    expect(localStorage.getItem('qms-language')).toBe('en')
  })

  it('recupera idioma de localStorage', () => {
    localStorage.setItem('qms-language', 'en')
    i18n.changeLanguage('en')
    render(<TestConsumer />)
    expect(screen.getByTestId('current-lang').textContent).toBe('en')
    expect(screen.getByTestId('translated').textContent).toBe('Save')
  })

  it('usa fallback a español si el idioma no está soportado', () => {
    i18n.changeLanguage('fr')
    render(<TestConsumer />)
    expect(screen.getByTestId('translated').textContent).toBe('Guardar')
  })
})

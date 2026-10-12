/**
 * Formulario de "Sugiere un cambio". Es nuestro de punta a punta: desde la v4.18 el envío va a
 * nuestro propio servidor y no a un tercero, así que usar la guía entera no hace ni una petición
 * fuera del origen.
 *
 * Escribe quien sea, y la primera fila lo pregunta: vecino, el propio negocio u otro. Saberlo cambia
 * cómo se trata el dato (lo que dice el negocio de su horario vale más que un rumor), y no obliga a
 * nada más: ni correo, ni lugar, ni cuenta. Mandar un recado no crea identidad.
 *
 * Cabe sin desplazar la hoja: los campos cortos comparten fila en cuanto hay ancho.
 *
 * Lo que frena el spam son tres cosas que no se ven: el campo trampa, la prueba de trabajo que
 * cuesta mandar el formulario, y que esa prueba valga una sola vez (ver worker/sugerencias.ts).
 */
import { useId, useState } from 'react'
import { SUGGEST_FORM_ENDPOINT } from '../../config/site.ts'
import { t } from '../../i18n/index.ts'
import { secretoConPrueba } from '../../lib/prueba-de-trabajo.ts'
import styles from './SuggestForm.module.css'

type Status = 'idle' | 'sending' | 'sent' | 'error'

const WHO = [
  { value: 'vecino', label: 'suggest.whoNeighbor' },
  { value: 'negocio', label: 'suggest.whoOwner' },
  { value: 'otro', label: 'suggest.whoOther' },
] as const

export function SuggestForm() {
  const ids = useId()
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [place, setPlace] = useState('')
  const [contact, setContact] = useState('')
  const [who, setWho] = useState<(typeof WHO)[number]['value']>('vecino')
  const [invalid, setInvalid] = useState(false)
  /**
   * Campo trampa: existe en el formulario pero ninguna persona lo ve ni lo alcanza, así que si
   * llega con algo escrito lo ha escrito un robot de los que rellenan todos los campos. Antes esto
   * se enviaba siempre vacío y codificado a mano, de modo que el comentario prometía una defensa
   * que no existía: sin campo en la página, nada podía rellenarlo nunca.
   */
  const [trap, setTrap] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (message.trim().length === 0) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    // Se descarta aquí y no solo en el servidor: es más barato, y el acuse que ve el robot es el
    // mismo que vería si hubiera funcionado, así que no aprende nada probando otra vez.
    if (trap) {
      setStatus('sent')
      return
    }
    setStatus('sending')
    try {
      /*
       * El sello: un valor cuya huella empieza por ceros. Buscarlo cuesta uno o dos segundos de
       * CPU, que es lo que hace cara una ráfaga de envíos y no le cuesta nada a quien escribe una
       * vez. El servidor lo guarda como clave única, así que reenviar el mismo no escribe nada.
       */
      const sello = await secretoConPrueba()
      if (!sello) throw new Error('sin sello')
      const response = await fetch(SUGGEST_FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          quien: who,
          lugar: place.trim(),
          mensaje: message.trim(),
          contacto: contact.trim(),
          sello,
        }),
      })
      if (!response.ok) throw new Error(String(response.status))
      setStatus('sent')
      setMessage('')
      setPlace('')
      setContact('')
      setTrap('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <p className={styles.sent} role="status">
        {t('suggest.ok')}
      </p>
    )
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {/* Fuera de la vista y fuera del tabulador, pero **con etiqueta**: un control enfocable
          escondido con `aria-hidden` es una violación de accesibilidad, y además deja a quien usa
          lector de pantalla con un campo mudo que no sabe si debe rellenar. Así se lo encuentra
          solo quien recorre los controles, y lo primero que oye es que lo deje en blanco. */}
      <label className={styles.trap} htmlFor={`${ids}-trap`}>
        {t('suggest.trap')}
        <input
          id={`${ids}-trap`}
          type="text"
          name="botcheck"
          value={trap}
          onChange={(event) => setTrap(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </label>
      <fieldset className={styles.who}>
        <legend className={styles.label}>{t('suggest.who')}</legend>
        <div className={styles.whoOptions}>
          {WHO.map((option) => (
            <label key={option.value} className={styles.whoOption} data-on={who === option.value}>
              <input
                type="radio"
                name={`${ids}-who`}
                value={option.value}
                checked={who === option.value}
                onChange={() => setWho(option.value)}
              />
              {t(option.label)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.grid}>
        <label className={styles.field} htmlFor={`${ids}-place`}>
          <span className={styles.label}>
            {t('suggest.place')} <span className={styles.hint}>{t('suggest.placeHint')}</span>
          </span>
          <input
            id={`${ids}-place`}
            className={styles.input}
            type="text"
            value={place}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => setPlace(event.target.value)}
          />
        </label>

        <label className={styles.field} htmlFor={`${ids}-contact`}>
          <span className={styles.label}>
            {t('suggest.contact')} <span className={styles.hint}>{t('suggest.contactHint')}</span>
          </span>
          <input
            id={`${ids}-contact`}
            className={styles.input}
            type="email"
            value={contact}
            maxLength={160}
            autoComplete="email"
            onChange={(event) => setContact(event.target.value)}
          />
        </label>
      </div>

      <label className={styles.field} htmlFor={`${ids}-message`}>
        <span className={styles.label}>{t('suggest.message')}</span>
        <textarea
          id={`${ids}-message`}
          className={styles.input}
          rows={3}
          value={message}
          maxLength={1200}
          required
          aria-invalid={invalid}
          aria-describedby={invalid ? `${ids}-error` : undefined}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      {invalid && (
        <p id={`${ids}-error`} className={styles.error}>
          {t('suggest.required')}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.send} disabled={status === 'sending'}>
          {status === 'sending' ? t('suggest.sending') : t('suggest.send')}
        </button>
        {status === 'error' && (
          <p className={styles.error} role="alert">
            {t('suggest.error')}
          </p>
        )}
      </div>

      <p className={styles.note}>{t('suggest.note')}</p>
    </form>
  )
}

import { expect, test } from '@playwright/test'
import { openApp, panel, placesInCategory, placesInPlaza } from './helpers.ts'

test.describe('Búsqueda y filtros', () => {
  test('encuentra lugares ignorando acentos, con sinónimos y con errores menores', async ({
    page,
  }) => {
    await openApp(page)
    const search = page.getByRole('searchbox', { name: 'Buscar lugares' })
    const region = panel(page)

    await search.fill('cafe')
    await expect(region.getByRole('heading', { name: 'Resultados' })).toBeVisible()
    await expect(
      region.getByRole('link', { name: 'Ver detalles de Good Morning Coffee' }),
    ).toBeVisible()

    await search.fill('coffee')
    await expect(
      region.getByRole('link', { name: 'Ver detalles de D’Lu Coffee & Bakery' }),
    ).toBeVisible()

    await search.fill('pizeria')
    await expect(region.getByRole('link', { name: "Ver detalles de Domino's" })).toBeVisible()

    await search.fill('helado')
    await expect(
      region.getByRole('link', { name: "Ver detalles de Husky's Ice Cream" }),
    ).toBeVisible()
  })

  test('una palabra con coincidencias literales no arrastra parecidos lejanos', async ({
    page,
  }) => {
    await openApp(page)
    const search = page.getByRole('searchbox', { name: 'Buscar lugares' })
    const region = panel(page)
    // Primero quien sirve pasta; detrás, el resto de "Italiana" (su categoría, incluidos los
    // locales cuyo segundo giro es una pizzería).
    await search.fill('pasta')
    await expect(region.getByRole('link', { name: /^Ver detalles de/ })).toHaveCount(
      placesInCategory('italiana'),
    )
    await expect(
      region.getByRole('link', { name: /^Ver detalles de/ }).first(),
    ).toHaveAccessibleName('Ver detalles de Tomassa Almacén de Pastas')
    // Todos llevan "bar" literal en su nombre, categoría o descripción: ninguno entra por parecido.
    await search.fill('bar')
    // Entra lo que lleva "bar" en el nombre, en la categoría o en la descripción…
    await expect(
      region.getByRole('link', { name: 'Ver detalles de Wicklow Irish Pub' }),
    ).toBeVisible()
    // …y no entra nada por parecido: "Bagel" no empieza por "bar".
    await expect(region.getByRole('link', { name: 'Ver detalles de Mr. Bagel' })).toHaveCount(0)
    // La tolerancia a errores sigue funcionando cuando no hay coincidencias literales.
    await search.fill('rometa')
    await expect(
      region.getByRole('link', { name: 'Ver detalles de Rometta Gastrobar' }),
    ).toBeVisible()
  })

  test('escribir con una ficha abierta no quita el foco del buscador', async ({ page }) => {
    await openApp(page, { path: 'lugar/el-hornero' })
    const search = page.getByRole('searchbox', { name: 'Buscar lugares' })
    await search.click()
    // La primera letra cierra la ficha y monta otro panel detrás: el foco se queda donde se escribe.
    await search.pressSequentially('hor', { delay: 120 })
    await expect(search).toBeFocused()
    await expect(search).toHaveValue('hor')
    await expect(
      panel(page).getByRole('link', { name: 'Ver detalles de El Hornero' }),
    ).toBeVisible()
  })

  test('con una plaza abierta, la búsqueda mira en todo Zibatá', async ({ page }) => {
    await openApp(page, { path: 'zona/plaza-luna' })
    const region = panel(page)
    await expect(region.getByRole('heading', { level: 2, name: 'Plaza Luna' })).toBeVisible()

    await page.getByRole('searchbox', { name: 'Buscar lugares' }).fill('taco')
    // Los resultados salen agrupados por plaza, no solo los de la que estaba abierta.
    await expect(region.getByRole('heading', { name: 'Resultados' })).toBeVisible()
    await expect(region.getByRole('link', { name: 'Ver detalles de Tacos el Pata' })).toBeVisible()
    // La plaza sigue elegida y vuelve en cuanto se borra la búsqueda.
    await expect(page.getByRole('combobox', { name: 'Filtrar por zona' })).toHaveValue('plaza-luna')
    await page.getByRole('searchbox', { name: 'Buscar lugares' }).fill('')
    await expect(region.getByRole('heading', { level: 2, name: 'Plaza Luna' })).toBeVisible()
  })

  test('muestra un estado vacío y permite limpiar la búsqueda', async ({ page }) => {
    await openApp(page)
    await page.getByRole('searchbox', { name: 'Buscar lugares' }).fill('xyzxyz')
    const region = panel(page)
    await expect(region.getByText('Sin resultados')).toBeVisible()
    await region.getByRole('button', { name: 'Limpiar filtros' }).last().click()
    await expect(page.getByRole('searchbox', { name: 'Buscar lugares' })).toHaveValue('')
    await expect(region.getByText('Sin resultados')).toBeHidden()
  })

  test('combina plaza y categoría, informa el número de resultados y limpia los filtros', async ({
    page,
  }) => {
    await openApp(page)
    await page
      .getByRole('combobox', { name: 'Filtrar por zona' })
      .selectOption({ label: 'Paseo Zibatá' })
    const topCategories = page.getByRole('list', { name: 'Categorías' }).first()
    await topCategories.getByRole('link', { name: /Desayunos y Café/ }).click()

    const region = panel(page)
    await expect(region.getByRole('heading', { level: 2, name: 'Paseo Zibatá' })).toBeVisible()
    const cards = region.getByRole('link', { name: /^Ver detalles de/ })
    const desayunos = placesInCategory('desayunos-y-cafe', 'Paseo Zibatá')
    await expect(cards).toHaveCount(desayunos)
    await expect(
      region.getByRole('link', { name: 'Ver detalles de D’Lu Coffee & Bakery' }),
    ).toBeVisible()
    await expect(page.getByText(`${desayunos} resultados`, { exact: true }).first()).toBeVisible()
    /*
     * Las cápsulas **anuncian** los mismos conteos que la plaza seleccionada, y anuncian es la
     * palabra: la cifra vive en el nombre accesible y no en la pantalla. Se quitó de la vista
     * porque diecinueve cifras repetidas no dicen más que una, y el número de lo que estás viendo
     * ya lo da la cabecera del panel, junto a la lista que cuenta. Quien no ve la fila sí la
     * necesita, porque no puede mirar cuál está llena.
     */
    await expect(
      topCategories.getByRole('link', { name: /Desayunos y Café/ }),
    ).toHaveAccessibleName(new RegExp(`${desayunos} lugares`))
    await expect(topCategories.getByRole('link', { name: /^Todo/ })).toHaveAccessibleName(
      new RegExp(`${placesInPlaza('Paseo Zibatá')} lugares`),
    )
    await expect(page).toHaveURL(/\/zona\/paseo-zibata\?categoria=desayunos-y-cafe$/)

    await page.getByRole('button', { name: 'Limpiar filtros' }).first().click()
    await expect(page.getByRole('combobox', { name: 'Filtrar por zona' })).toHaveValue('')
    await expect(topCategories.getByRole('link', { name: /^Todo/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  test('una categoría sola muestra resultados agrupados por plaza', async ({ page }) => {
    await openApp(page)
    await page
      .getByRole('list', { name: 'Categorías' })
      .first()
      .getByRole('link', { name: /^Bar,/ })
      .click()
    // Una categoría sola es su propia página: la barra de direcciones lo dice.
    await expect(page).toHaveURL(/\/categoria\/bar$/)
    const region = panel(page)
    await expect(region.getByRole('heading', { name: 'Resultados' })).toBeVisible()
    // La cabecera de grupo es un enlace: la zona tiene dirección propia.
    await expect(region.getByRole('link', { name: /^Xentric Anáhuac/ })).toBeVisible()
    await expect(region.getByRole('link', { name: /^Paseo Zibatá/ })).toBeVisible()
    await region.getByRole('link', { name: /^Paseo Zibatá/ }).click()
    await expect(region.getByRole('heading', { level: 2, name: 'Paseo Zibatá' })).toBeVisible()
    await expect(region.getByRole('link', { name: /^Ver detalles de/ })).toHaveCount(
      placesInCategory('bar', 'Paseo Zibatá'),
    )
  })
})

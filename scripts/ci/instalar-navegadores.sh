#!/usr/bin/env bash
# Instala los navegadores de Playwright en un runner de GitHub Actions (Ubuntu), con tope y reintentos.
#
# Uso: bash scripts/ci/instalar-navegadores.sh chromium
#
# Lo usa el despliegue (deploy.yml), que solo necesita Chromium. El CI de pruebas (ci.yml) ya no pasa por
# aquí: corre dentro de la imagen oficial de Playwright, que trae los navegadores y las dependencias del
# sistema, porque instalar WebKit en el runner obliga a apt a bajar unos 119 MB (181 paquetes) del espejo
# de Ubuntu y, cuando ese espejo va a unos 50 KB/s, ni los topes ni los reintentos lo arreglan: la
# descarga no está parada, está lenta. Para Chromium solo, apt baja muy poco (el runner ya trae casi todo).
#
# Qué hace, por si el espejo falla igualmente:
#
#  1. `apt` recibe sus propios tiempos de red (Acquire::Retries y Acquire::http::Timeout, documentados en
#     apt.conf(5) y apt-transport-http(1)): una conexión que se cae se repite en vez de esperar.
#  2. Las dependencias del sistema y la descarga de los navegadores van por separado, como recomienda
#     Playwright para CI (`install-deps` aparte, https://playwright.dev/docs/browsers), cada una con un tope
#     por intento y tres intentos.
#  3. Antes de repetir se cierra lo que quedó y se deja dpkg en orden: matar apt a medias lo deja
#     sujetando el cerrojo de dpkg y el reintento fallaría al instante. El runner es efímero, así que no
#     hay nada que proteger.
#  4. `--only-shell`: las pruebas corren sin ventana y sin `channel`, que es el caso para el que Playwright
#     documenta esa opción; así no se descarga el Chromium completo.
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "Uso: $0 <navegador>..." >&2
  exit 2
fi

LIMITE="${LIMITE_INTENTO:-240}" # segundos por intento (se puede cambiar solo para probar el script)

# Tiempos de red de apt para toda esta ejecución.
sudo tee /etc/apt/apt.conf.d/99-red-ci >/dev/null <<'CONF'
Acquire::Retries "5";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
CONF

cerrar_apt() {
  sudo pkill -KILL -x apt-get 2>/dev/null || true
  sudo pkill -KILL -x dpkg 2>/dev/null || true
  sudo dpkg --configure -a >/dev/null 2>&1 || true
}

# repetir <fase> <comando...>: hasta tres intentos, cada uno con su tope.
repetir() {
  local fase="$1"
  shift
  local intento
  for intento in 1 2 3; do
    if timeout --kill-after=15 "$LIMITE" "$@"; then
      return 0
    fi
    echo "::warning::${fase}: el intento ${intento} de 3 falló o pasó de ${LIMITE} segundos"
    cerrar_apt
  done
  return 1
}

repetir "Dependencias del sistema" npx playwright install-deps "$@" || exit 1
repetir "Descarga de navegadores" npx playwright install --only-shell "$@" || exit 1
echo "Navegadores instalados: $*"

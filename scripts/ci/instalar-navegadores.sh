#!/usr/bin/env bash
# Instala los navegadores de Playwright en un runner de GitHub Actions (Ubuntu) sin quedarse colgado.
#
# Uso: bash scripts/ci/instalar-navegadores.sh chromium webkit
#
# Por qué no basta `npx playwright install --with-deps`: ese comando hace dos cosas muy distintas, y la que
# se cuelga es la primera. Primero instala paquetes del sistema con `apt`, y apt, si el espejo de Ubuntu se
# queda parado a media descarga, espera sin límite (una vez 25 minutos, otra 4 y medio y se canceló). Después
# descarga los navegadores desde el CDN de Playwright, que tiene su propio tiempo máximo sin datos. Por eso
# aquí van separadas, como recomienda Playwright para CI (`install-deps` aparte, https://playwright.dev/docs/browsers):
#
#  1. `apt` recibe sus propios tiempos de red (Acquire::Retries y Acquire::http::Timeout, documentados en
#     apt.conf(5) y apt-transport-http(1)): una descarga parada se corta y se repite en vez de esperar.
#  2. Cada fase tiene un tope por intento y tres intentos. Un reintento sin más no sirve con apt: matar el
#     proceso lo deja sujetando el cerrojo de dpkg y los dos intentos siguientes fallan al instante (pasó
#     en el primer intento de este arreglo). Por eso, antes de repetir, se cierra lo que quedó y se
#     deja dpkg en orden. El runner es efímero, así que no hay nada que proteger.
#  3. `--only-shell`: las pruebas corren sin ventana y sin `channel`, que es el caso para el que Playwright
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

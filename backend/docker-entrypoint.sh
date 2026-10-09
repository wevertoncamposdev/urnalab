#!/bin/sh
set -e

# Railway Volumes (e volumes Docker em geral) chegam montados no runtime com o
# dono/permissões que o provedor define — normalmente root, independente do que a
# imagem tinha. O `chown -R node:node /app` feito em build time no Dockerfile só
# vale pro conteúdo que já existia *na imagem*; ele não sobrevive a um volume de
# verdade sendo montado por cima de /app/data depois. Sem corrigir isso aqui, o
# processo (que roda como "node", não-root, ver USER no Dockerfile removido em favor
# deste script) não consegue gravar foto nenhuma — EACCES silencioso na escrita do
# arquivo, que vira 500 pro usuário sem nenhuma pista no front sobre a causa real.
DATA_DIR="${DATA_PATH:-/app/data}"
mkdir -p "$DATA_DIR/photos"
chown -R node:node "$DATA_DIR" 2>/dev/null || true

exec su-exec node "$@"

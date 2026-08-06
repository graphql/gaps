#!/usr/bin/env bash

GAP_DIR="GAP-${GAP:-0}"

DIM='\033[2m'
RESET='\033[0m'
YELLOW='\033[33m'
GREEN='\033[32m'
CLEAR='\033[2K\r'

log() {
  local color="$1" icon="$2" msg="$3"
  shift 3
  printf "${CLEAR}${DIM}│${RESET} ${color}${icon}${RESET} ${msg}" "$@"
}

export -f log
export DIM RESET YELLOW GREEN CLEAR GAP_DIR

npx portless gaps --force npx nodemon -q \
  --watch "$GAP_DIR" --ext md \
  --exec "\
    log \$YELLOW ◌ 'Building ${GAP_DIR}${DIM}...${RESET}' && \
    npx spec-md ${GAP_DIR}/DRAFT.md > ${GAP_DIR}/Index.html && \
    log \$GREEN ● 'Rebuilt ${GAP_DIR} ${DIM}%s${RESET}\n' \"\$(date +%H:%M:%S)\" && \
    npx http-server ${GAP_DIR} -s"

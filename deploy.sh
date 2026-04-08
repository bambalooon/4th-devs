#!/bin/bash

CURRENT_DIR=$(dirname "$(realpath "$0")")
PROJECT_DIR="${CURRENT_DIR}/${1%/}" # removes trailing slash if present

if [[ -z "$PROJECT_DIR" || ! -d "$PROJECT_DIR" ]]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

rsync -avz $PROJECT_DIR azyl:deploy/

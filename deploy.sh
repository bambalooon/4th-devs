#!/bin/bash

PROJECT_DIR=$(pwd)

if [[ -z "$PROJECT_DIR" || ! -d "$PROJECT_DIR" ]]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

rsync -avz $PROJECT_DIR azyl:deploy/

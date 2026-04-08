#!/bin/bash

dir="$1"

if [[ -z "$dir" || ! -d "$dir" ]]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

rsync -avz $dir azyl:deploy/

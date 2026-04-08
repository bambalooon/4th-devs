#!/bin/bash

CMD="${@}"
PROJECT_DIR=$(basename "$PWD")

ssh -t azyl "cd deploy/${PROJECT_DIR} && $CMD"

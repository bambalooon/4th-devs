#!/bin/bash

CMD="${@}"
PROJECT_DIR=$(basename "$PWD")

ssh azyl "cd deploy/${PROJECT_DIR} && $CMD"

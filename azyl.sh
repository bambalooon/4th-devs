#!/bin/bash

CMD=$1
PROJECT_DIR=$(basename "$PWD")

ssh azyl "cd deploy/${PROJECT_DIR} && $CMD"

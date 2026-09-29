#!/bin/sh
set -eu
node dist/migrate.js
exec "$@"

#!/bin/bash
set -euo pipefail

# Substitute environment variables into Icecast config
export HOSTNAME="${HOSTNAME:-localhost}"
export SOURCE_PASSWORD="${ICECAST_SOURCE_PASSWORD:-hackme}"
export RELAY_PASSWORD="${ICECAST_RELAY_PASSWORD:-hackme}"
export ADMIN_PASSWORD="${ICECAST_ADMIN_PASSWORD:-hackme}"

envsubst '${HOSTNAME} ${SOURCE_PASSWORD} ${RELAY_PASSWORD} ${ADMIN_PASSWORD}' \
    < /etc/icecast2/icecast.xml.template \
    > /etc/icecast2/icecast.xml

# Replace __VAR__ placeholders used in XML (envsubst-safe alternative)
sed -i \
    -e "s/__HOSTNAME__/${HOSTNAME}/g" \
    -e "s/__SOURCE_PASSWORD__/${SOURCE_PASSWORD}/g" \
    -e "s/__RELAY_PASSWORD__/${RELAY_PASSWORD}/g" \
    -e "s/__ADMIN_PASSWORD__/${ADMIN_PASSWORD}/g" \
    /etc/icecast2/icecast.xml

echo "[icecast] Starting with hostname=${HOSTNAME}"
exec icecast2 -c /etc/icecast2/icecast.xml

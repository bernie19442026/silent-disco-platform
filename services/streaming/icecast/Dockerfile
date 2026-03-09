FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    icecast2 \
    gettext-base \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Template config — runtime vars replace placeholders via envsubst
COPY icecast.xml /etc/icecast2/icecast.xml.template

# Silence file for fallback mount
COPY silence.ogg /usr/share/icecast2/web/silence.ogg 2>/dev/null || true

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:8000/status-json.xsl || exit 1

ENTRYPOINT ["/entrypoint.sh"]

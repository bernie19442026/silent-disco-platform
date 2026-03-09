FROM jrottenberg/ffmpeg:6.1-ubuntu2204

# Install bash and supervisord for process management
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /encoder

COPY encode-channel.sh ./
COPY encode-all.sh ./
COPY supervisord.conf /etc/supervisor/conf.d/encoder.conf

RUN chmod +x encode-channel.sh encode-all.sh

# Default: test tone mode (override INPUT_TYPE for production)
ENV INPUT_TYPE=test \
    ICECAST_HOST=icecast \
    ICECAST_PORT=8000 \
    ICECAST_SOURCE_PASS=hackme \
    AUDIO_BITRATE=128

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -sf "http://${ICECAST_HOST}:${ICECAST_PORT}/status-json.xsl" | \
        grep -q '"source"' || exit 1

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]

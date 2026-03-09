FROM tiangolo/nginx-rtmp:latest

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY nginx.conf /etc/nginx/nginx.conf

# Create HLS temp dirs
RUN mkdir -p /tmp/hls /tmp/hls-ll

EXPOSE 1935 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

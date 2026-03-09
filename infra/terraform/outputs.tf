output "streaming_ip" {
  description = "Public IP of the streaming server"
  value       = digitalocean_droplet.streaming.ipv4_address
}

output "streaming_floating_ip" {
  description = "Floating IP (use this for DNS)"
  value       = digitalocean_floating_ip.streaming.ip_address
}

output "api_ip" {
  description = "Public IP of the API server"
  value       = digitalocean_droplet.api.ipv4_address
}

output "streaming_base_url" {
  description = "Set as NEXT_PUBLIC_STREAMING_BASE_URL in Vercel"
  value       = "http://${digitalocean_floating_ip.streaming.ip_address}:8000"
}

output "hls_base_url" {
  description = "HLS delivery base URL (for iOS/Safari)"
  value       = "http://${digitalocean_droplet.streaming.ipv4_address}:8080"
}

output "icecast_admin_url" {
  description = "Icecast admin interface"
  value       = "http://${digitalocean_droplet.streaming.ipv4_address}:8000/admin/"
}

output "rtmp_ingest_url" {
  description = "RTMP push URL for FFmpeg encoders at venue"
  value       = "rtmp://${digitalocean_droplet.streaming.ipv4_address}:1935/live/"
}

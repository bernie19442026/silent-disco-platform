variable "region" {
  description = "Primary cloud region"
  type        = string
  default     = "fra1"  # Frankfurt — good latency for EU events
}

variable "droplet_size" {
  description = "DigitalOcean droplet size for streaming server"
  type        = string
  default     = "s-4vcpu-8gb"  # Handles ~50k concurrent listeners
}

variable "icecast_source_password" {
  description = "Icecast source password"
  type        = string
  sensitive   = true
}

variable "icecast_admin_password" {
  description = "Icecast admin password"
  type        = string
  sensitive   = true
}

variable "event_name" {
  description = "Event name displayed in the UI"
  type        = string
  default     = "Silent Disco"
}

variable "ssh_public_key" {
  description = "SSH public key for server access"
  type        = string
}

variable "domain" {
  description = "Base domain for the streaming infrastructure"
  type        = string
  default     = "streaming.silentdisco.example"
}

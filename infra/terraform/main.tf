###############################################################################
# Silent Disco Platform — Terraform / DigitalOcean
#
# Provisions:
#   - 1× streaming droplet (Icecast + NGINX + FFmpeg)
#   - 1× API droplet (Node.js API)
#   - Firewall rules
#   - Spaces bucket for static assets
#   - (Optional) CDN in front of Icecast
###############################################################################

terraform {
  required_version = ">= 1.6"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.36"
    }
  }
}

provider "digitalocean" {
  # Set via DIGITALOCEAN_TOKEN env var
}

# ─── SSH Key ──────────────────────────────────────────────────

resource "digitalocean_ssh_key" "disco" {
  name       = "silent-disco-deploy"
  public_key = var.ssh_public_key
}

# ─── Streaming Server ─────────────────────────────────────────

resource "digitalocean_droplet" "streaming" {
  name     = "sd-streaming"
  region   = var.region
  size     = var.droplet_size
  image    = "ubuntu-22-04-x64"
  ssh_keys = [digitalocean_ssh_key.disco.fingerprint]

  user_data = templatefile("${path.module}/cloud-init-streaming.yaml", {
    icecast_source_password = var.icecast_source_password
    icecast_admin_password  = var.icecast_admin_password
    event_name              = var.event_name
    domain                  = var.domain
  })

  tags = ["silent-disco", "streaming"]
}

# ─── API Server ───────────────────────────────────────────────

resource "digitalocean_droplet" "api" {
  name     = "sd-api"
  region   = var.region
  size     = "s-2vcpu-4gb"
  image    = "ubuntu-22-04-x64"
  ssh_keys = [digitalocean_ssh_key.disco.fingerprint]

  user_data = templatefile("${path.module}/cloud-init-api.yaml", {
    streaming_ip = digitalocean_droplet.streaming.ipv4_address
    event_name   = var.event_name
  })

  tags = ["silent-disco", "api"]
}

# ─── Firewall ─────────────────────────────────────────────────

resource "digitalocean_firewall" "streaming" {
  name = "sd-streaming-fw"
  droplet_ids = [digitalocean_droplet.streaming.id]

  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Icecast HTTP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "8000"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HLS via NGINX
  inbound_rule {
    protocol         = "tcp"
    port_range       = "8080"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # RTMP ingest (restrict to encoder IPs in production)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "1935"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_firewall" "api" {
  name = "sd-api-fw"
  droplet_ids = [digitalocean_droplet.api.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "3001"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# ─── Floating IP for streaming (for failover) ─────────────────

resource "digitalocean_floating_ip" "streaming" {
  region = var.region
}

resource "digitalocean_floating_ip_assignment" "streaming" {
  ip_address = digitalocean_floating_ip.streaming.ip_address
  droplet_id = digitalocean_droplet.streaming.id
}

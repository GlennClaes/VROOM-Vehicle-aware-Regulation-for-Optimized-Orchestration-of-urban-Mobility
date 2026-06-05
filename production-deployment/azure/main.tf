# Azure Terraform Infrastructure for VROOM Production
# Provisions a secure Azure-based Cloud-to-Edge architecture for municipal traffic orchestration

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  type    = string
  default = "westeurope" # Close to Hasselt / Belgium
}

variable "project_name" {
  type    = string
  default = "vroom-production"
}

variable "db_admin_user" {
  type      = string
  default   = "vroomadmin"
  sensitive = true
}

variable "db_admin_password" {
  type      = string
  sensitive = true
}

# --- RESOURCE GROUP ---
resource "azurerm_resource_group" "rg" {
  name     = "${var.project_name}-rg"
  location = var.location
}

# --- AZURE KEY VAULT (Secure Secrets Storage) ---
data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "kv" {
  name                        = "${var.project_name}-kv"
  location                    = azurerm_resource_group.rg.location
  resource_group_name         = azurerm_resource_group.rg.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  sku_name                    = "standard"

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge", "Recover"
    ]
  }
}

resource "azurerm_key_vault_secret" "db_password" {
  name         = "db-admin-password"
  value        = var.db_admin_password
  key_vault_id = azurerm_key_vault.kv.id
}

# --- VIRTUAL NETWORK & SUBNETS ---
resource "azurerm_virtual_network" "vnet" {
  name                = "${var.project_name}-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_subnet" "container_apps" {
  name                 = "container-apps-subnet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/23"]
}

resource "azurerm_subnet" "database" {
  name                 = "database-subnet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.4.0/24"]
  delegation {
    name = "fs"
    group_name = "Microsoft.DBforMySQL/flexibleServers"
    service_delegation {
      name    = "Microsoft.DBforMySQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# --- AZURE DATABASE FOR MYSQL FLEXIBLE SERVER ---
resource "azurerm_mysql_flexible_server" "mysql" {
  name                   = "${var.project_name}-mysql"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  administrator_login    = var.db_admin_user
  administrator_password = azurerm_key_vault_secret.db_password.value
  backup_retention_days  = 7
  delegated_subnet_id    = azurerm_subnet.database.id
  sku_name               = "B_Standard_B1ms"
  version                = "8.0.21"
}

resource "azurerm_mysql_flexible_database" "db" {
  name                = "mydatabase"
  resource_group_name = azurerm_resource_group.rg.name
  server_name         = azurerm_mysql_flexible_server.mysql.name
  charset             = "utf8mb4"
  collation           = "utf8mb4_unicode_ci"
}

# --- AZURE CACHE FOR REDIS ---
resource "azurerm_redis_cache" "redis" {
  name                = "${var.project_name}-redis"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  capacity            = 0
  family              = "C"
  sku_name            = "Basic"
  enable_non_ssl_port = true
}

# --- CONTAINER APPS ENVIRONMENT ---
resource "azurerm_container_app_environment" "env" {
  name                           = "${var.project_name}-env"
  location                       = azurerm_resource_group.rg.location
  resource_group_name            = azurerm_resource_group.rg.name
  infrastructure_subnet_id       = azurerm_subnet.container_apps.id
  internal_load_balancer_enabled = false
}

# --- NATS CONTAINER APP ---
resource "azurerm_container_app" "nats" {
  name                         = "nats"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  template {
    container {
      name    = "nats"
      image   = "nats:2.10-alpine"
      cpu     = "0.25"
      memory  = "0.5Gi"
      command = ["-js", "-m", "8222"]
    }
  }

  ingress {
    allow_insecure_connections = true
    external_enabled           = true
    target_port                = 4222
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# --- OUTPUTS ---
output "nats_endpoint" {
  value       = azurerm_container_app.nats.fqdn
  description = "The FQDN endpoint for pointing C++ edge cabinets to NATS broker"
}

output "mysql_server_fqdn" {
  value = azurerm_mysql_flexible_server.mysql.fqdn
}

# AWS Terraform Infrastructure for VROOM Production
# Provisions a secure Cloud-to-Edge architecture for central municipal orchestration

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --- VARIABLES ---
variable "aws_region" {
  type    = string
  default = "eu-west-1" # Ireland, close to Hasselt / Brussels
}

variable "project_name" {
  type    = string
  default = "vroom-production"
}

# --- VPC & NETWORKING ---
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id
}

resource "aws_subnet" "public_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "public_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}b"
}

# NAT Gateways for Private Subnets
resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
}

resource "aws_route_table_association" "pub_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "pub_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "priv_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "priv_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private.id
}

# --- SECURITY GROUPS ---
resource "aws_security_group" "lb" {
  name        = "${var.project_name}-lb-sg"
  vpc_id      = aws_vpc.main.id
  description = "Allows traffic to load balancers"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 4222
    to_port     = 4222
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Expose NATS to physical cabinets (can restrict to VPN/APN CIDR)
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_tasks" {
  name   = "${var.project_name}-ecs-tasks-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.lb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- DATABASE (RDS MySQL) ---
variable "db_admin_user" {
  type      = string
  default   = "vroomadmin"
  sensitive = true
}

variable "db_admin_password" {
  type      = string
  sensitive = true
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.project_name}-db-secret"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id     = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_admin_user
    password = var.db_admin_password
  })
}

resource "aws_db_subnet_group" "db" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_security_group" "db" {
  name   = "${var.project_name}-db-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}

resource "aws_db_instance" "mysql" {
  identifier             = "${var.project_name}-db"
  allocated_storage      = 20
  engine                 = "mysql"
  engine_version         = "8.0"
  instance_class         = "db.t4g.micro"
  db_name                = "mydatabase"
  username               = jsondecode(aws_secretsmanager_secret_version.db_credentials.secret_string)["username"]
  password               = jsondecode(aws_secretsmanager_secret_version.db_credentials.secret_string)["password"]
  db_subnet_group_name   = aws_db_subnet_group.db.name
  vpc_security_group_ids = [aws_security_group.db.id]
  skip_final_snapshot    = true
}

# --- CACHE (ElastiCache Redis) ---
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_security_group" "redis" {
  name   = "${var.project_name}-redis-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project_name}-redis"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
}

# --- ECS CLUSTER & SERVICES ---
resource "aws_ecs_cluster" "main" {
  name = var.project_name
}

# IAM Execution Role for ECS Tasks
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.project_name}-ecs-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Network Load Balancer (NLB) for TCP NATS
resource "aws_lb" "nats" {
  name               = "${var.project_name}-nats-nlb"
  internal           = false
  load_balancer_type = "network"
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

resource "aws_lb_target_group" "nats" {
  name        = "${var.project_name}-nats-tg"
  port        = 4222
  protocol    = "TCP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
}

resource "aws_lb_listener" "nats" {
  load_balancer_arn = aws_lb.nats.arn
  port              = 4222
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.nats.arn
  }
}

# Application Load Balancer (ALB) for HTTP/HTTPS web app
resource "aws_lb" "web" {
  name               = "${var.project_name}-web-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.lb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

resource "aws_lb_target_group" "web" {
  name        = "${var.project_name}-web-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path = "/health"
  }
}

resource "aws_lb_listener" "web" {
  load_balancer_arn = aws_lb.web.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# Task Definition for NATS Broker
resource "aws_ecs_task_definition" "nats" {
  family                   = "${var.project_name}-nats"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([{
    name      = "nats"
    image     = "nats:2.10-alpine"
    essential = true
    command   = ["-js", "-m", "8222"]
    portMappings = [{
      containerPort = 4222
      hostPort      = 4222
    }]
  }])
}

resource "aws_ecs_service" "nats" {
  name            = "${var.project_name}-nats"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.nats.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.nats.arn
    container_name   = "nats"
    container_port   = 4222
  }
}

# --- OUTPUTS ---
output "nats_endpoint" {
  value       = aws_lb.nats.dns_name
  description = "The DNS entry to point physical edge cabinets to for NATS traffic"
}

output "dashboard_url" {
  value       = aws_lb.web.dns_name
  description = "The public web address of the dashboard"
}

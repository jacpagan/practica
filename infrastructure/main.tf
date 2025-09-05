# AWS Cost-Saving Infrastructure for Practica
# Personal Practice Tracking System

# Terraform configuration for minimal AWS resources
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

# S3 Bucket for video storage (Cost-saving: Standard storage)
resource "aws_s3_bucket" "practica_videos" {
  bucket = "practica-videos-${var.environment}-${random_id.bucket_suffix.hex}"

  tags = {
    Name        = "Practica Videos"
    Environment = var.environment
    Purpose     = "Personal Practice Tracking"
  }

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 Bucket for static files (Cost-saving: Reduced redundancy)
resource "aws_s3_bucket" "practica_static" {
  bucket = "practica-static-${var.environment}-${random_id.bucket_suffix.hex}"

  tags = {
    Name        = "Practica Static Files"
    Environment = var.environment
    Purpose     = "Personal Practice Tracking"
  }

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }
}

# RDS PostgreSQL (Cost-saving: db.t3.micro, single AZ)
resource "aws_db_instance" "practica_db" {
  identifier = "practica-${var.environment}"

  engine         = "postgres"
  engine_version = "15.14"
  instance_class = "db.t3.micro" # Cost-saving: Smallest instance

  allocated_storage     = 20 # Cost-saving: Minimal storage
  max_allocated_storage = 100
  storage_type          = "gp2" # Cost-saving: General purpose

  db_name  = "practica"
  username = "practica"
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.practica_db.id]
  db_subnet_group_name   = aws_db_subnet_group.practica.name

  backup_retention_period = 7 # Cost-saving: Minimal backup
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  skip_final_snapshot = true # Cost-saving: No final snapshot for dev

  tags = {
    Name        = "Practica Database"
    Environment = var.environment
  }
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# VPC and Networking (Cost-saving: Minimal setup)
resource "aws_vpc" "practica_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "Practica VPC"
    Environment = var.environment
  }
}

resource "aws_subnet" "practica_private" {
  count = 2

  vpc_id            = aws_vpc.practica_vpc.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "Practica Private Subnet ${count.index + 1}"
    Environment = var.environment
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_db_subnet_group" "practica" {
  name       = "practica-subnet-group"
  subnet_ids = aws_subnet.practica_private[*].id

  tags = {
    Name        = "Practica DB Subnet Group"
    Environment = var.environment
  }
}

# Security Groups
resource "aws_security_group" "practica_db" {
  name_prefix = "practica-db-"
  vpc_id      = aws_vpc.practica_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.practica_vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "Practica Database Security Group"
    Environment = var.environment
  }
}

# Outputs
output "s3_bucket_name" {
  value = aws_s3_bucket.practica_videos.bucket
}

output "database_endpoint" {
  value = aws_db_instance.practica_db.endpoint
}

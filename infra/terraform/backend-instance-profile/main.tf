terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  role_name    = "${var.project}-backend-ec2-role"
  profile_name = "${var.project}-backend-ec2-profile"
  bucket_arn   = "arn:aws:s3:::${var.bucket_name}"
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backend" {
  name               = local.role_name
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  description        = "Practica backend EC2 role (S3/ECR/MediaConvert minimal)"
  force_detach_policies = true
}

data "aws_iam_policy_document" "backend_policy" {
  statement {
    sid     = "S3Access"
    effect  = "Allow"
    actions = [
      "s3:ListBucket"
    ]
    resources = [local.bucket_arn]
  }

  statement {
    sid     = "S3Objects"
    effect  = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts"
    ]
    resources = [
      "${local.bucket_arn}/*"
    ]
  }

  statement {
    sid     = "EcrPull"
    effect  = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer"
    ]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = var.mediaconvert_role_arn != null && var.mediaconvert_role_arn != "" ? [1] : []
    content {
      sid     = "MediaConvert"
      effect  = "Allow"
      actions = [
        "mediaconvert:CreateJob*",
        "mediaconvert:GetJob*",
        "mediaconvert:ListJobs*",
        "mediaconvert:DescribeEndpoints"
      ]
      resources = ["*"]
    }
  }

  dynamic "statement" {
    for_each = var.mediaconvert_role_arn != null && var.mediaconvert_role_arn != "" ? [1] : []
    content {
      sid     = "PassMediaConvertRole"
      effect  = "Allow"
      actions = ["iam:PassRole"]
      resources = [var.mediaconvert_role_arn]
    }
  }
}

resource "aws_iam_role_policy" "backend_inline" {
  role   = aws_iam_role.backend.id
  policy = data.aws_iam_policy_document.backend_policy.json
}

resource "aws_iam_instance_profile" "backend" {
  name = local.profile_name
  role = aws_iam_role.backend.name
}


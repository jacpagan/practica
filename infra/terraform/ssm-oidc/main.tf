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

variable "aws_region" { default = "us-east-1" }
variable "repo" { description = "GitHub repo in org/name format" }
variable "instance_id" { description = "EC2 instance ID to allow SSM on" }

data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    actions = ["sts:AssumeRoleWithWebIdentity"]
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "practica-ssm-github-actions"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy_document" "ssm_policy" {
  statement {
    sid     = "SSMRun"
    effect  = "Allow"
    actions = [
      "ssm:SendCommand",
      "ssm:ListCommandInvocations",
      "ssm:GetCommandInvocation"
    ]
    resources = [
      "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${var.instance_id}",
      "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:document/AWS-RunShellScript"
    ]
  }

  statement {
    sid     = "Describe"
    effect  = "Allow"
    actions = [
      "ec2:DescribeInstances",
      "ssm:ListCommands"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ssm_inline" {
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.ssm_policy.json
}

output "aws_role_arn" {
  value = aws_iam_role.github_actions.arn
}


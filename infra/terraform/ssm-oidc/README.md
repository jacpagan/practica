# SSM OIDC Deploy Role (No SSH)

This Terraform creates:
- GitHub OIDC provider for AWS
- An IAM role that your GitHub repo can assume to run SSM commands on your EC2 instance

## Variables

- `aws_region` (default: `us-east-1`)
- `repo` (e.g., `jacpagan/practica`)
- `instance_id` (e.g., `i-0341f5ccfc1d2676f`)

## Usage

```bash
cd infra/terraform/ssm-oidc
terraform init
terraform apply -var="repo=jacpagan/practica" -var="instance_id=i-0341f5ccfc1d2676f"
```

Outputs:
- `aws_role_arn`: paste into GitHub Secret `AWS_ROLE_ARN`


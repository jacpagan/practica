# Backend EC2 Instance Profile (Least Privilege)

This Terraform creates an IAM role and instance profile for your production EC2 instance running Practica. It grants the minimal permissions the backend needs to operate with S3, ECR (pull), and optional AWS Elemental MediaConvert.

## What it creates
- IAM role trusted by EC2 (`assume_role_policy` for `ec2.amazonaws.com`)
- Inline policy granting:
  - S3: List/Get/Put/Delete limited to your media/static bucket and common Practica prefixes
  - ECR: Pull permissions (`ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`)
  - Optional MediaConvert: `CreateJob*`, `GetJob*`, `ListJobs*`, `DescribeEndpoints` and `iam:PassRole` on your MediaConvert service role
- Instance profile bound to that role

## Inputs
- `project` (default `practica`)
- `aws_region` (default from provider)
- `bucket_name` (required): your media bucket (`AWS_STORAGE_BUCKET_NAME`)
- `mediaconvert_role_arn` (optional): if set, adds MediaConvert + PassRole permissions

## Usage
```bash
cd infra/terraform/backend-instance-profile
terraform init
terraform apply -var="project=practica" \
  -var="bucket_name=practica-media-jpagan" \
  -var="mediaconvert_role_arn=arn:aws:iam::123456789012:role/MediaConvert_Default_Role"
```

Outputs:
- `role_arn`: IAM role to attach
- `instance_profile_name`: name to associate to the EC2 instance

To attach the profile:
```bash
aws ec2 associate-iam-instance-profile \
  --instance-id i-________ \
  --iam-instance-profile Name=$(terraform output -raw instance_profile_name)
```

Then restart the backend container (your deploy workflow does this automatically on next deploy), and verify STS identity returns the role ARN.

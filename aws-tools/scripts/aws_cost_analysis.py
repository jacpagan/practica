#!/usr/bin/env python3
"""
AWS Resource Discovery and Cost Analysis Script
==============================================

This script discovers all AWS resources in your account and provides cost analysis.
Follows the "READ BEFORE WRITE" principle - discovers first, then analyzes.

Usage:
    python aws_cost_analysis.py [--region us-east-1] [--detailed]

Requirements:
    - AWS CLI configured with appropriate permissions
    - boto3 library: pip install boto3
    - tabulate library: pip install tabulate
"""

import boto3
import argparse
import json
import sys
from datetime import datetime, timedelta
from collections import defaultdict
import subprocess
from tabulate import tabulate

class AWSResourceAnalyzer:
    def __init__(self, region='us-east-1'):
        self.region = region
        self.session = boto3.Session(region_name=region)
        self.cost_explorer = self.session.client('ce')
        self.resources = defaultdict(list)
        self.costs = defaultdict(float)
        
    def run_aws_command(self, command):
        """Execute AWS CLI command and return JSON output"""
        try:
            result = subprocess.run(command, shell=True, capture_output=True, text=True)
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                # Handle specific AWS errors gracefully
                error_output = result.stderr.strip()
                if "ClusterNotFoundException" in error_output:
                    # This is expected when no clusters exist
                    return None
                elif "AccessDenied" in error_output:
                    print(f"   ⚠️  Permission denied for: {command.split()[1]}")
                    return None
                elif "NoSuchEntity" in error_output:
                    print(f"   ℹ️  No resources found for: {command.split()[1]}")
                    return None
                else:
                    print(f"   ⚠️  Error running command: {command.split()[1]}")
                    print(f"   Error: {error_output}")
                    return None
        except Exception as e:
            print(f"   ⚠️  Exception running command {command.split()[1]}: {e}")
            return None

    def discover_ec2_instances(self):
        """Discover EC2 instances"""
        print("🔍 Discovering EC2 instances...")
        command = f"aws ec2 describe-instances --region {self.region} --output json"
        data = self.run_aws_command(command)
        
        if data:
            for reservation in data.get('Reservations', []):
                for instance in reservation.get('Instances', []):
                    resource_info = {
                        'id': instance['InstanceId'],
                        'type': instance['InstanceType'],
                        'state': instance['State']['Name'],
                        'launch_time': instance['LaunchTime'],
                        'tags': {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}
                    }
                    self.resources['EC2'].append(resource_info)
        
        print(f"   Found {len(self.resources['EC2'])} EC2 instances")

    def discover_rds_instances(self):
        """Discover RDS instances"""
        print("🔍 Discovering RDS instances...")
        command = f"aws rds describe-db-instances --region {self.region} --output json"
        data = self.run_aws_command(command)
        
        if data:
            for instance in data.get('DBInstances', []):
                resource_info = {
                    'id': instance['DBInstanceIdentifier'],
                    'engine': instance['Engine'],
                    'class': instance['DBInstanceClass'],
                    'status': instance['DBInstanceStatus'],
                    'storage': instance.get('AllocatedStorage', 0),
                    'multi_az': instance.get('MultiAZ', False)
                }
                self.resources['RDS'].append(resource_info)
        
        print(f"   Found {len(self.resources['RDS'])} RDS instances")

    def discover_ecs_services(self):
        """Discover ECS services"""
        print("🔍 Discovering ECS services...")
        
        # First, discover ECS clusters
        cluster_command = f"aws ecs list-clusters --region {self.region} --output json"
        cluster_data = self.run_aws_command(cluster_command)
        
        if not cluster_data or not cluster_data.get('clusterArns'):
            print(f"   Found 0 ECS clusters in {self.region}")
            return
        
        print(f"   Found {len(cluster_data['clusterArns'])} ECS clusters")
        
        # For each cluster, discover services
        total_services = 0
        for cluster_arn in cluster_data['clusterArns']:
            cluster_name = cluster_arn.split('/')[-1]
            service_command = f"aws ecs list-services --cluster {cluster_name} --region {self.region} --output json"
            service_data = self.run_aws_command(service_command)
            
            if service_data and service_data.get('serviceArns'):
                for service_arn in service_data['serviceArns']:
                    service_name = service_arn.split('/')[-1]
                    resource_info = {
                        'id': service_name,
                        'cluster': cluster_name,
                        'arn': service_arn,
                        'status': 'Active'  # Would need additional call for detailed status
                    }
                    self.resources['ECS'].append(resource_info)
                    total_services += 1
        
        print(f"   Found {total_services} ECS services across {len(cluster_data['clusterArns'])} clusters")

    def discover_load_balancers(self):
        """Discover Load Balancers"""
        print("🔍 Discovering Load Balancers...")
        command = f"aws elbv2 describe-load-balancers --region {self.region} --output json"
        data = self.run_aws_command(command)
        
        if data:
            for lb in data.get('LoadBalancers', []):
                resource_info = {
                    'id': lb['LoadBalancerName'],
                    'type': lb['Type'],
                    'scheme': lb['Scheme'],
                    'state': lb['State']['Code'],
                    'vpc': lb['VpcId']
                }
                self.resources['LoadBalancer'].append(resource_info)
        
        print(f"   Found {len(self.resources['LoadBalancer'])} Load Balancers")

    def discover_s3_buckets(self):
        """Discover S3 buckets"""
        print("🔍 Discovering S3 buckets...")
        command = "aws s3api list-buckets --output json"
        data = self.run_aws_command(command)
        
        if data:
            for bucket in data.get('Buckets', []):
                # Get bucket location
                try:
                    location_cmd = f"aws s3api get-bucket-location --bucket {bucket['Name']} --output json"
                    location_data = self.run_aws_command(location_cmd)
                    region = location_data.get('LocationConstraint', 'us-east-1') if location_data else 'us-east-1'
                except:
                    region = 'us-east-1'
                
                resource_info = {
                    'id': bucket['Name'],
                    'created': bucket['CreationDate'],
                    'region': region
                }
                self.resources['S3'].append(resource_info)
        
        print(f"   Found {len(self.resources['S3'])} S3 buckets")

    def discover_cloudfront_distributions(self):
        """Discover CloudFront distributions"""
        print("🔍 Discovering CloudFront distributions...")
        command = "aws cloudfront list-distributions --output json"
        data = self.run_aws_command(command)
        
        if data:
            for dist in data.get('DistributionList', {}).get('Items', []):
                resource_info = {
                    'id': dist['Id'],
                    'domain': dist['DomainName'],
                    'status': dist['Status'],
                    'enabled': dist['Enabled']
                }
                self.resources['CloudFront'].append(resource_info)
        
        print(f"   Found {len(self.resources['CloudFront'])} CloudFront distributions")

    def discover_lambda_functions(self):
        """Discover Lambda functions"""
        print("🔍 Discovering Lambda functions...")
        command = f"aws lambda list-functions --region {self.region} --output json"
        data = self.run_aws_command(command)
        
        if data:
            for func in data.get('Functions', []):
                resource_info = {
                    'id': func['FunctionName'],
                    'runtime': func['Runtime'],
                    'memory': func['MemorySize'],
                    'timeout': func['Timeout'],
                    'last_modified': func['LastModified']
                }
                self.resources['Lambda'].append(resource_info)
        
        print(f"   Found {len(self.resources['Lambda'])} Lambda functions")

    def discover_elasticache_clusters(self):
        """Discover ElastiCache clusters"""
        print("🔍 Discovering ElastiCache clusters...")
        command = f"aws elasticache describe-cache-clusters --region {self.region} --output json"
        data = self.run_aws_command(command)
        
        if data:
            for cluster in data.get('CacheClusters', []):
                resource_info = {
                    'id': cluster['CacheClusterId'],
                    'engine': cluster['Engine'],
                    'node_type': cluster['CacheNodeType'],
                    'status': cluster['CacheClusterStatus'],
                    'nodes': cluster['NumCacheNodes']
                }
                self.resources['ElastiCache'].append(resource_info)
        
        print(f"   Found {len(self.resources['ElastiCache'])} ElastiCache clusters")

    def discover_volumes_and_snapshots(self):
        """Discover EBS volumes and snapshots"""
        print("🔍 Discovering EBS volumes...")
        command = f"aws ec2 describe-volumes --region {self.region} --output json"
        data = self.run_aws_command(command)
        
        if data:
            for volume in data.get('Volumes', []):
                resource_info = {
                    'id': volume['VolumeId'],
                    'size': volume['Size'],
                    'type': volume['VolumeType'],
                    'state': volume['State'],
                    'encrypted': volume['Encrypted']
                }
                self.resources['EBS'].append(resource_info)
        
        print(f"   Found {len(self.resources['EBS'])} EBS volumes")
        
        # Discover EBS snapshots
        print("🔍 Discovering EBS snapshots...")
        snapshot_command = f"aws ec2 describe-snapshots --owner-ids self --region {self.region} --output json"
        snapshot_data = self.run_aws_command(snapshot_command)
        
        if snapshot_data:
            for snapshot in snapshot_data.get('Snapshots', []):
                resource_info = {
                    'id': snapshot['SnapshotId'],
                    'volume_id': snapshot['VolumeId'],
                    'size': snapshot['VolumeSize'],
                    'state': snapshot['State'],
                    'start_time': snapshot['StartTime']
                }
                self.resources['EBS_Snapshots'].append(resource_info)
        
        print(f"   Found {len(self.resources['EBS_Snapshots'])} EBS snapshots")

    def discover_vpc_resources(self):
        """Discover VPC resources"""
        print("🔍 Discovering VPC resources...")
        
        # Discover VPCs
        vpc_command = f"aws ec2 describe-vpcs --region {self.region} --output json"
        vpc_data = self.run_aws_command(vpc_command)
        
        if vpc_data:
            for vpc in vpc_data.get('Vpcs', []):
                resource_info = {
                    'id': vpc['VpcId'],
                    'cidr': vpc['CidrBlock'],
                    'state': vpc['State'],
                    'default': vpc['IsDefault']
                }
                self.resources['VPC'].append(resource_info)
        
        print(f"   Found {len(self.resources['VPC'])} VPCs")
        
        # Discover Security Groups
        sg_command = f"aws ec2 describe-security-groups --region {self.region} --output json"
        sg_data = self.run_aws_command(sg_command)
        
        if sg_data:
            for sg in sg_data.get('SecurityGroups', []):
                resource_info = {
                    'id': sg['GroupId'],
                    'name': sg['GroupName'],
                    'description': sg['Description'],
                    'vpc': sg['VpcId']
                }
                self.resources['SecurityGroup'].append(resource_info)
        
        print(f"   Found {len(self.resources['SecurityGroup'])} Security Groups")

    def get_cost_data(self, days=30):
        """Get cost data from Cost Explorer"""
        print(f"💰 Getting cost data for the last {days} days...")
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        try:
            response = self.cost_explorer.get_cost_and_usage(
                TimePeriod={
                    'Start': start_date.strftime('%Y-%m-%d'),
                    'End': end_date.strftime('%Y-%m-%d')
                },
                Granularity='MONTHLY',
                Metrics=['UnblendedCost'],
                GroupBy=[
                    {'Type': 'DIMENSION', 'Key': 'SERVICE'}
                ]
            )
            
            for result in response.get('ResultsByTime', []):
                for group in result.get('Groups', []):
                    service = group['Keys'][0]
                    cost = float(group['Metrics']['UnblendedCost']['Amount'])
                    self.costs[service] += cost
                    
        except Exception as e:
            print(f"Error getting cost data: {e}")

    def generate_report(self, detailed=False):
        """Generate comprehensive report"""
        print("\n" + "="*80)
        print("🚀 AWS RESOURCE DISCOVERY & COST ANALYSIS REPORT")
        print("="*80)
        print(f"Region: {self.region}")
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)

        # Resource Summary
        print("\n📊 RESOURCE SUMMARY")
        print("-" * 40)
        summary_data = []
        for service, resources in self.resources.items():
            summary_data.append([service, len(resources)])
        
        print(tabulate(summary_data, headers=['Service', 'Count'], tablefmt='grid'))

        # Cost Summary
        print("\n💰 COST SUMMARY (Last 30 Days)")
        print("-" * 40)
        if self.costs:
            cost_data = []
            total_cost = 0
            for service, cost in sorted(self.costs.items(), key=lambda x: x[1], reverse=True):
                cost_data.append([service, f"${cost:.2f}"])
                total_cost += cost
            
            cost_data.append(['TOTAL', f"${total_cost:.2f}"])
            print(tabulate(cost_data, headers=['Service', 'Cost'], tablefmt='grid'))
        else:
            print("No cost data available. Check permissions for Cost Explorer.")

        # Detailed Resource Information
        if detailed:
            print("\n🔍 DETAILED RESOURCE INFORMATION")
            print("=" * 80)
            
            for service, resources in self.resources.items():
                if resources:
                    print(f"\n{service.upper()} RESOURCES")
                    print("-" * 40)
                    
                    if service == 'EC2':
                        headers = ['Instance ID', 'Type', 'State', 'Launch Time', 'Tags']
                        data = []
                        for resource in resources:
                            tags_str = ', '.join([f"{k}={v}" for k, v in resource['tags'].items()])[:50]
                            data.append([
                                resource['id'],
                                resource['type'],
                                resource['state'],
                                resource['launch_time'][:10],
                                tags_str
                            ])
                        print(tabulate(data, headers=headers, tablefmt='grid'))
                    
                    elif service == 'RDS':
                        headers = ['Instance ID', 'Engine', 'Class', 'Status', 'Storage (GB)', 'Multi-AZ']
                        data = []
                        for resource in resources:
                            data.append([
                                resource['id'],
                                resource['engine'],
                                resource['class'],
                                resource['status'],
                                resource['storage'],
                                'Yes' if resource['multi_az'] else 'No'
                            ])
                        print(tabulate(data, headers=headers, tablefmt='grid'))
                    
                    elif service == 'S3':
                        headers = ['Bucket Name', 'Created', 'Region']
                        data = []
                        for resource in resources:
                            data.append([
                                resource['id'],
                                resource['created'][:10],
                                resource['region']
                            ])
                        print(tabulate(data, headers=headers, tablefmt='grid'))
                    
                    else:
                        # Generic display for other services
                        if resources:
                            headers = list(resources[0].keys())
                            data = [[resource.get(h, 'N/A') for h in headers] for resource in resources]
                            print(tabulate(data, headers=headers, tablefmt='grid'))

        # Recommendations
        print("\n💡 RECOMMENDATIONS")
        print("-" * 40)
        
        if self.resources['EC2']:
            running_instances = [r for r in self.resources['EC2'] if r['state'] == 'running']
            stopped_instances = [r for r in self.resources['EC2'] if r['state'] == 'stopped']
            
            if stopped_instances:
                print(f"⚠️  Found {len(stopped_instances)} stopped EC2 instances. Consider terminating if not needed.")
            
            if running_instances:
                print(f"🔍 Review {len(running_instances)} running EC2 instances for optimization opportunities.")
        
        if self.resources['RDS']:
            print(f"🗄️  Review {len(self.resources['RDS'])} RDS instances for storage and performance optimization.")
        
        if self.resources['S3']:
            print(f"📦 Review {len(self.resources['S3'])} S3 buckets for lifecycle policies and cost optimization.")
        
        if self.resources['EBS_Snapshots']:
            print(f"💾 Review {len(self.resources['EBS_Snapshots'])} EBS snapshots for retention policies.")
        
        if self.resources['VPC']:
            print(f"🌐 Review {len(self.resources['VPC'])} VPCs for unused resources.")
        
        if self.resources['SecurityGroup']:
            print(f"🔒 Review {len(self.resources['SecurityGroup'])} Security Groups for unused rules.")
        
        if self.costs:
            highest_cost_service = max(self.costs.items(), key=lambda x: x[1])
            print(f"🎯 Focus optimization efforts on {highest_cost_service[0]} (${highest_cost_service[1]:.2f})")

        print("\n" + "="*80)
        print("✅ Analysis Complete!")
        print("="*80)

def main():
    parser = argparse.ArgumentParser(description='AWS Resource Discovery and Cost Analysis')
    parser.add_argument('--region', default='us-east-1', help='AWS region to analyze')
    parser.add_argument('--detailed', action='store_true', help='Show detailed resource information')
    
    args = parser.parse_args()
    
    print("🚀 Starting AWS Resource Discovery and Cost Analysis...")
    print(f"Region: {args.region}")
    print("This may take a few minutes...\n")
    
    analyzer = AWSResourceAnalyzer(args.region)
    
    # Discover resources
    analyzer.discover_ec2_instances()
    analyzer.discover_rds_instances()
    analyzer.discover_ecs_services()
    analyzer.discover_load_balancers()
    analyzer.discover_s3_buckets()
    analyzer.discover_cloudfront_distributions()
    analyzer.discover_lambda_functions()
    analyzer.discover_elasticache_clusters()
    analyzer.discover_volumes_and_snapshots()
    analyzer.discover_vpc_resources()
    
    # Get cost data
    analyzer.get_cost_data()
    
    # Generate report
    analyzer.generate_report(detailed=args.detailed)

if __name__ == "__main__":
    main()

# 🧹 Hard Cleanup Plan - Practika

## **Cleanup Strategy**

**Goal**: Remove bloat, align systems, optimize costs without breaking AUVs
**Scope**: Code cleanup, AWS optimization, configuration alignment
**Timeline**: 2-4 weeks
**Risk Level**: Medium (some breaking changes)

## **Code Cleanup PRs (Ranked by Impact)**

### **PR #1: Remove Dead Code Files**
**Why**: 5 dead files creating confusion and maintenance overhead
**Evidence**: `DRIFT_AND_BLOAT.md` lines 15-20
**Diff Summary**: Delete `debug_camera.html`, `personal-website.yml`, `test_ddd_simple.py`, `run_ddd_tests.py`, `DDD_TDD_IMPLEMENTATION_SUMMARY.md`
**Tests**: Verify no imports/references to deleted files
**Rollback**: Git restore deleted files
**Blast Radius**: Zero - no functional impact

### **PR #2: Remove Unused Dependencies**
**Why**: 2 unused packages increasing build time and security surface
**Evidence**: `DRIFT_AND_BLOAT.md` lines 10-15
**Diff Summary**: Remove `Pillow`, `python-magic` from `requirements.txt`
**Tests**: Run full test suite, verify no import errors
**Rollback**: Add packages back to requirements.txt
**Blast Radius**: Low - no functional dependencies

### **PR #3: Mount Accounts App**
**Why**: User profiles, roles, and beta invitations exist but inaccessible
**Evidence**: `DRIFT_AND_BLOAT.md` lines 25-30, `MVP_GAP_REPORT.md` lines 50-55
**Diff Summary**: Add `"accounts"` to `INSTALLED_APPS`, add `path('accounts/', include('accounts.urls'))` to main URLs
**Tests**: Verify profile creation, role assignment, beta invitation flow
**Rollback**: Remove from INSTALLED_APPS and URLs
**Blast Radius**: Medium - enables user management features

### **PR #4: Consolidate Duplicate URL Patterns**
**Why**: 3 duplicate URL patterns creating confusion and maintenance overhead
**Evidence**: `DRIFT_AND_BLOAT.md` lines 30-35
**Diff Summary**: Remove duplicate exercise routes from `practika_project/urls.py` lines 25-27, keep only namespaced versions
**Tests**: Verify all exercise URLs still work, check redirects
**Rollback**: Restore duplicate URL patterns
**Blast Radius**: Low - URL consolidation only

### **PR #5: Externalize Hard-coded Configuration**
**Why**: 3 hard-coded values preventing environment flexibility
**Evidence**: `DRIFT_AND_BLOAT.md` lines 50-55
**Diff Summary**: Move file size limits from `settings.py` line 270 to environment variables, add `DJANGO_FILE_UPLOAD_MAX_MEMORY_SIZE`, `DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE`
**Tests**: Verify file upload limits still work, test with different env values
**Rollback**: Restore hard-coded values
**Blast Radius**: Low - configuration change only

### **PR #6: Add Missing Database Indexes**
**Why**: 3 missing indexes causing N+1 query performance issues
**Evidence**: `DRIFT_AND_BLOAT.md` lines 60-65
**Diff Summary**: Create migration adding composite indexes on `exercises_exercise(created_by, created_at)`, `comments_videocomment(author, created_at)`, `core_videoasset(processing_status, created_at)`
**Tests**: Verify query performance improvement, check index usage
**Rollback**: Drop indexes via migration
**Blast Radius**: Low - performance improvement only

### **PR #7: Fix N+1 Query Issues**
**Why**: Performance degradation in exercise and comment listings
**Evidence**: `DRIFT_AND_BLOAT.md` lines 60-65
**Diff Summary**: Add `select_related('created_by', 'video_asset')` to exercise queries, `select_related('author', 'exercise')` to comment queries
**Tests**: Verify query count reduction, check response times
**Rollback**: Remove select_related calls
**Blast Radius**: Low - performance optimization only

### **PR #8: Add Comprehensive Error Handling**
**Why**: Limited error handling risking data corruption
**Evidence**: `DRIFT_AND_BLOAT.md` lines 40-45
**Diff Summary**: Add try-catch blocks in `core/views.py`, add validation middleware, improve error responses
**Tests**: Verify error scenarios handled gracefully, check error logging
**Rollback**: Remove error handling additions
**Blast Radius**: Medium - error handling changes

### **PR #9: Use Proper Settings Files**
**Why**: 4 unused settings files creating confusion
**Evidence**: `DRIFT_AND_BLOAT.md` lines 50-55
**Diff Summary**: Use `settings_production.py` for production, `settings_aws.py` for AWS deployment, update deployment scripts
**Tests**: Verify production settings work correctly, check environment-specific configs
**Rollback**: Revert to main settings.py
**Blast Radius**: Medium - configuration changes

### **PR #10: Add Input Validation Middleware**
**Why**: Missing validation risking security breaches
**Evidence**: `SECURITY_POSTURE.md` lines 200-220
**Diff Summary**: Create validation middleware, add to `MIDDLEWARE` list, validate file uploads and API inputs
**Tests**: Verify malicious inputs rejected, check validation logging
**Rollback**: Remove validation middleware
**Blast Radius**: Medium - security enhancement

### **PR #11: Implement Connection Pooling**
**Why**: Missing connection pooling risking database reliability
**Evidence**: `DRIFT_AND_BLOAT.md` lines 60-65
**Diff Summary**: Add `CONN_MAX_AGE=600` to database config, add connection health checks
**Tests**: Verify connection reuse, check connection limits
**Rollback**: Remove connection pooling config
**Blast Radius**: Low - reliability improvement

### **PR #12: Add Missing Test Coverage**
**Why**: Low test coverage for critical AUV operations
**Evidence**: `DRIFT_AND_BLOAT.md` lines 70-75
**Diff Summary**: Add unit tests for video upload, clip creation, exercise CRUD, comment operations
**Tests**: Verify test coverage improvement, check all AUV operations tested
**Rollback**: Remove added tests
**Blast Radius**: Zero - test additions only

## **AWS Infrastructure Changes (Ranked by Impact)**

### **IaC Change #1: Replace NAT Gateway with NAT Instance**
**Why**: NAT Gateway costs $45-60/month, NAT instance costs $15-25/month
**Evidence**: `COSTS_BASELINE.md` lines 45-60
**Diff Summary**: Replace `AWS::EC2::NatGateway` with `AWS::EC2::Instance` (t3.nano), update route tables
**Tests**: Verify internet access from private subnets, check cost reduction
**Rollback**: Restore NAT Gateway
**Blast Radius**: Medium - networking change

### **IaC Change #2: Add CloudFront CDN**
**Why**: Missing CDN causing higher latency and ALB costs
**Evidence**: `INVENTORY_AWS.md` lines 400-420
**Diff Summary**: Add `AWS::CloudFront::Distribution` for S3 bucket, update ALB to use CloudFront origin
**Tests**: Verify CDN caching, check performance improvement
**Rollback**: Remove CloudFront distribution
**Blast Radius**: Medium - performance change

### **IaC Change #3: Add AWS WAF Protection**
**Why**: Missing WAF protection creating security vulnerability
**Evidence**: `SECURITY_POSTURE.md` lines 180-190
**Diff Summary**: Add `AWS::WAFv2::WebACL`, attach to ALB, configure basic protection rules
**Tests**: Verify WAF protection active, check security monitoring
**Rollback**: Remove WAF configuration
**Blast Radius**: Low - security enhancement

### **IaC Change #4: Implement ECS Auto-scaling**
**Why**: Fixed 2 tasks causing cost inefficiency
**Evidence**: `INVENTORY_AWS.md` lines 340-360
**Diff Summary**: Add `AWS::ApplicationAutoScaling::ScalableTarget`, configure scaling policies based on CPU/memory
**Tests**: Verify auto-scaling triggers, check cost optimization
**Rollback**: Remove auto-scaling configuration
**Blast Radius**: Medium - scaling behavior change

### **IaC Change #5: Add S3 Lifecycle Policies**
**Why**: Missing lifecycle policies causing storage cost inefficiency
**Evidence**: `COSTS_BASELINE.md` lines 5-15
**Diff Summary**: Add `AWS::S3::Bucket` lifecycle configuration, move old files to IA storage
**Tests**: Verify lifecycle policies active, check storage cost reduction
**Rollback**: Remove lifecycle policies
**Blast Radius**: Low - storage optimization

### **IaC Change #6: Add CloudWatch Alarms**
**Why**: Missing alarms risking delayed incident response
**Evidence**: `OBSERVABILITY.md` lines 100-120
**Diff Summary**: Add `AWS::CloudWatch::Alarm` for CPU > 80%, memory > 80%, 5xx errors > 5%
**Tests**: Verify alarms trigger correctly, check notification delivery
**Rollback**: Remove CloudWatch alarms
**Blast Radius**: Low - monitoring enhancement

### **IaC Change #7: Add Resource Tags**
**Why**: Missing tags preventing cost allocation and resource management
**Evidence**: `INVENTORY_AWS.md` lines 30-490
**Diff Summary**: Add `Environment=production`, `Project=practika`, `CostCenter=engineering` tags to all resources
**Tests**: Verify tags applied correctly, check cost allocation
**Rollback**: Remove resource tags
**Blast Radius**: Zero - metadata only

### **IaC Change #8: Enable S3 Versioning**
**Why**: Missing versioning risking data loss
**Evidence**: `SECURITY_POSTURE.md` lines 100-120
**Diff Summary**: Add `VersioningConfiguration: Enabled` to S3 bucket
**Tests**: Verify versioning active, check data protection
**Rollback**: Disable S3 versioning
**Blast Radius**: Low - data protection enhancement

### **IaC Change #9: Add Multi-AZ RDS**
**Why**: Single AZ deployment risking availability
**Evidence**: `INVENTORY_AWS.md` lines 250-270
**Diff Summary**: Change `MultiAZ: false` to `MultiAZ: true` in RDS configuration
**Tests**: Verify multi-AZ deployment, check availability improvement
**Rollback**: Revert to single AZ
**Blast Radius**: Medium - availability change

### **IaC Change #10: Add Cost Alerts**
**Why**: Missing cost monitoring risking budget overruns
**Evidence**: `COSTS_BASELINE.md` lines 150-170
**Diff Summary**: Add `AWS::CloudWatch::Alarm` for monthly cost > $200, daily cost spike > 50%
**Tests**: Verify cost alerts trigger, check notification delivery
**Rollback**: Remove cost alarms
**Blast Radius**: Zero - monitoring only

### **IaC Change #11: Add VPC Flow Logs**
**Why**: Missing network monitoring risking security incidents
**Evidence**: `SECURITY_POSTURE.md` lines 200-220
**Diff Summary**: Add `AWS::Logs::LogGroup` and `AWS::EC2::FlowLog` for VPC traffic monitoring
**Tests**: Verify flow logs active, check security monitoring
**Rollback**: Remove VPC flow logs
**Blast Radius**: Low - monitoring enhancement

### **IaC Change #12: Add Backup Encryption**
**Why**: Missing backup encryption risking data exposure
**Evidence**: `SECURITY_POSTURE.md` lines 100-120
**Diff Summary**: Add `StorageEncrypted: true` to RDS configuration, enable S3 bucket encryption
**Tests**: Verify encryption active, check data protection
**Rollback**: Disable encryption
**Blast Radius**: Low - security enhancement

## **Cleanup Execution Plan**

### **Phase 1: Safe Removals (Week 1)**
- PR #1: Remove dead code files
- PR #2: Remove unused dependencies
- IaC Change #7: Add resource tags
- IaC Change #10: Add cost alerts

### **Phase 2: Performance & Security (Week 2)**
- PR #6: Add missing database indexes
- PR #7: Fix N+1 query issues
- PR #10: Add input validation middleware
- IaC Change #3: Add AWS WAF protection
- IaC Change #6: Add CloudWatch alarms

### **Phase 3: Infrastructure Optimization (Week 3)**
- IaC Change #1: Replace NAT Gateway with NAT instance
- IaC Change #2: Add CloudFront CDN
- IaC Change #4: Implement ECS auto-scaling
- IaC Change #5: Add S3 lifecycle policies

### **Phase 4: Configuration & Testing (Week 4)**
- PR #3: Mount accounts app
- PR #5: Externalize hard-coded configuration
- PR #9: Use proper settings files
- PR #12: Add missing test coverage
- IaC Change #8: Enable S3 versioning
- IaC Change #11: Add VPC flow logs

## **Risk Mitigation**

### **Pre-Cleanup Safeguards**
1. **Full Database Backup** - Create RDS snapshot before any DB changes
2. **S3 Bucket Backup** - Copy all S3 objects to backup location
3. **Application Backup** - Create ECR image backup
4. **Configuration Backup** - Document all current settings

### **Rollback Procedures**
1. **Code Rollback** - Git revert to previous commit
2. **Infrastructure Rollback** - CloudFormation rollback to previous stack
3. **Database Rollback** - Restore from RDS snapshot
4. **S3 Rollback** - Restore from backup location

### **Testing Strategy**
1. **Unit Tests** - Run full test suite after each PR
2. **Integration Tests** - Test AUV workflows after changes
3. **Performance Tests** - Verify no performance regression
4. **Security Tests** - Verify security posture maintained

## **Success Metrics**

### **Cost Reduction Targets**
- NAT Gateway replacement: $30-35/month savings
- ECS auto-scaling: $15-20/month savings
- S3 lifecycle policies: $3-7/month savings
- **Total Target**: $48-62/month savings (32-42% reduction)

### **Performance Improvement Targets**
- Database queries: 50% reduction in N+1 queries
- Page load times: 30% improvement with CDN
- Video delivery: 50% faster with CloudFront
- Auto-scaling: 99.9% uptime maintained

### **Security Enhancement Targets**
- WAF protection: Block 99% of common attacks
- Input validation: 100% of inputs validated
- Monitoring: <5 minute incident detection
- Backup encryption: 100% of data encrypted

---

*Generated on: August 30, 2025*  
*Evidence-based cleanup plan*

#!/bin/bash

# Practika Production Testing Script
# Tests practika.jpagan.com functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://practika.jpagan.com"
TEST_USER="testuser_$(date +%s)"
TEST_PASSWORD="testpass123_$(date +%s)"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    log_info "Testing: $name"
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" = "$expected_status" ]; then
        log_success "$name - HTTP $response"
    else
        log_error "$name - Expected HTTP $expected_status, got HTTP $response"
    fi
}

test_api_response() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    log_info "Testing: $name"
    
    if [ -n "$data" ]; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    else
        local response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
    fi
    
    if [ "$response" = "$expected_status" ]; then
        log_success "$name - HTTP $response"
    else
        log_error "$name - Expected HTTP $expected_status, got HTTP $response"
    fi
}

# Main testing function
main() {
    echo "🧪 Practika Production Testing Suite"
    echo "====================================="
    echo "Testing: $BASE_URL"
    echo "Started: $(date)"
    echo ""
    
    # Phase 1: Basic Connectivity
    echo "📡 Phase 1: Basic Connectivity Tests"
    echo "-----------------------------------"
    
    test_endpoint "Homepage" "$BASE_URL/" "302"
    test_endpoint "Health Check" "$BASE_URL/core/health/"
    test_endpoint "Exercise List" "$BASE_URL/exercises/" "302"
    test_endpoint "Login Page" "$BASE_URL/exercises/login/"
    
    echo ""
    
    # Phase 2: API Endpoints
    echo "🔌 Phase 2: API Endpoint Tests"
    echo "-----------------------------"
    
    test_api_response "Videos List API" "GET" "$BASE_URL/core/api/videos/"
    test_api_response "Comments List API" "GET" "$BASE_URL/comments/api/comments/"
    
    echo ""
    
    # Phase 3: User Authentication
    echo "🔐 Phase 3: Authentication Tests"
    echo "-------------------------------"
    
    # Test user registration
    log_info "Testing: User Registration"
    REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/exercises/login/" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=$TEST_USER&password=$TEST_PASSWORD&action=signup" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$REGISTER_RESPONSE" = "302" ] || [ "$REGISTER_RESPONSE" = "200" ]; then
        log_success "User Registration - HTTP $REGISTER_RESPONSE"
    else
        log_error "User Registration - Expected HTTP 302/200, got HTTP $REGISTER_RESPONSE"
    fi
    
    # Test user login
    log_info "Testing: User Login"
    LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/exercises/login/" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=$TEST_USER&password=$TEST_PASSWORD&action=login" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$LOGIN_RESPONSE" = "302" ] || [ "$LOGIN_RESPONSE" = "200" ]; then
        log_success "User Login - HTTP $LOGIN_RESPONSE"
    else
        log_error "User Login - Expected HTTP 302/200, got HTTP $LOGIN_RESPONSE"
    fi
    
    echo ""
    
    # Phase 4: Error Handling
    echo "⚠️  Phase 4: Error Handling Tests"
    echo "--------------------------------"
    
    test_api_response "Invalid Video ID" "GET" "$BASE_URL/core/api/videos/invalid-uuid/" "" "404"
    test_api_response "Invalid Clip Creation" "POST" "$BASE_URL/core/api/create-clip/" '{"video_id":"invalid","start_time":"not-a-number"}' "400"
    
    echo ""
    
    # Phase 5: Performance Tests
    echo "⚡ Phase 5: Performance Tests"
    echo "----------------------------"
    
    log_info "Testing: Response Time"
    RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL/core/health/")
    if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
        log_success "Response Time - ${RESPONSE_TIME}s (under 2s)"
    else
        log_warning "Response Time - ${RESPONSE_TIME}s (over 2s)"
    fi
    
    echo ""
    
    # Phase 6: Infrastructure Status
    echo "🏗️  Phase 6: Infrastructure Status"
    echo "-------------------------------"
    
    log_info "Checking ECS Service Status"
    ECS_STATUS=$(aws ecs describe-services \
        --cluster practika-prod-cluster \
        --services practika-prod-service \
        --query 'services[0].status' \
        --output text 2>/dev/null)
    
    if [ "$ECS_STATUS" = "ACTIVE" ]; then
        log_success "ECS Service Status - $ECS_STATUS"
    else
        log_error "ECS Service Status - $ECS_STATUS"
    fi
    
    log_info "Checking ECS Task Count"
    TASK_COUNT=$(aws ecs describe-services \
        --cluster practika-prod-cluster \
        --services practika-prod-service \
        --query 'services[0].runningCount' \
        --output text 2>/dev/null)
    
    if [ "$TASK_COUNT" -ge 1 ]; then
        log_success "ECS Task Count - $TASK_COUNT running"
    else
        log_error "ECS Task Count - $TASK_COUNT running (expected >= 1)"
    fi
    
    echo ""
    
    # Summary
    echo "📊 Test Summary"
    echo "==============="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
    echo "Success Rate: $((TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED)))%"
    echo ""
    echo "Completed: $(date)"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! Your Practika app is working correctly.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Please review the issues above.${NC}"
        exit 1
    fi
}

# Run the tests
main "$@"

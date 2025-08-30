#!/usr/bin/env python3
"""
DDD TDD Test Runner for Practika MVP
Runs comprehensive tests following Domain-Driven Design and Test-Driven Development principles
"""

import os
import sys
import subprocess
import time
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def run_command(command, description):
    """Run a command and return success status"""
    print(f"\n{'='*60}")
    print(f"🔄 {description}")
    print(f"{'='*60}")
    print(f"Command: {command}")
    print()
    
    start_time = time.time()
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    end_time = time.time()
    
    if result.returncode == 0:
        print(f"✅ {description} - SUCCESS ({end_time - start_time:.2f}s)")
        if result.stdout:
            print("Output:")
            print(result.stdout)
    else:
        print(f"❌ {description} - FAILED ({end_time - start_time:.2f}s)")
        print("Error:")
        print(result.stderr)
        if result.stdout:
            print("Output:")
            print(result.stdout)
    
    return result.returncode == 0

def main():
    """Main test runner"""
    print("🧪 Practika DDD TDD Test Suite")
    print("=" * 60)
    print("Running comprehensive tests following Domain-Driven Design")
    print("and Test-Driven Development principles")
    print()
    
    # Set environment variables
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.test_settings')
    os.environ['PYTHONPATH'] = str(project_root)
    
    # Test results
    test_results = []
    
    # 1. Check if pytest is installed
    print("📋 Checking test environment...")
    if not run_command("python -c 'import pytest; print(f\"pytest {pytest.__version__}\")'", 
                      "Check pytest installation"):
        print("❌ pytest not found. Installing...")
        if not run_command("pip install pytest pytest-django", "Install pytest"):
            print("❌ Failed to install pytest. Exiting.")
            return 1
    
    # 2. Run unit tests for domain entities
    test_results.append(
        run_command("python -m pytest tests/unit/test_domain_entities.py -v", 
                   "Unit Tests - Domain Entities")
    )
    
    # 3. Run unit tests for domain services
    test_results.append(
        run_command("python -m pytest tests/unit/test_domain_services.py -v", 
                   "Unit Tests - Domain Services")
    )
    
    # 4. Run acceptance tests for MVP core loop
    test_results.append(
        run_command("python -m pytest tests/acceptance/test_mvp_core_loop.py -v", 
                   "Acceptance Tests - MVP Core Loop")
    )
    
    # 5. Run all tests with coverage
    test_results.append(
        run_command("python -m pytest tests/ -v --tb=short", 
                   "All Tests - Complete Test Suite")
    )
    
    # 6. Run tests by markers
    print("\n📊 Running tests by category...")
    
    test_results.append(
        run_command("python -m pytest tests/ -m unit -v", 
                   "Unit Tests Only")
    )
    
    test_results.append(
        run_command("python -m pytest tests/ -m domain -v", 
                   "Domain Tests Only")
    )
    
    test_results.append(
        run_command("python -m pytest tests/ -m acceptance -v", 
                   "Acceptance Tests Only")
    )
    
    # 7. Performance tests
    test_results.append(
        run_command("python -m pytest tests/ -m performance -v", 
                   "Performance Tests")
    )
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    total_tests = len(test_results)
    passed_tests = sum(test_results)
    failed_tests = total_tests - passed_tests
    
    print(f"Total Test Categories: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if failed_tests == 0:
        print("\n🎉 ALL TESTS PASSED!")
        print("Your Practika MVP domain logic is working correctly.")
        print("DDD and TDD implementation is successful!")
        return 0
    else:
        print(f"\n❌ {failed_tests} test categories failed.")
        print("Please review the failures above and fix the issues.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

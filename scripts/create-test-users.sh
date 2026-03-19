#!/bin/bash

# Create test users via Better Auth API
# This ensures users are created with the correct format for sign-in

echo "Creating test users via Better Auth API..."

# TechFlow SaaS Users
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@techflow.test","password":"TestPass123!","name":"Alex Chen"}'
echo ""

curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@techflow.test","password":"TestPass123!","name":"Maria Santos"}'
echo ""

curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"john@techflow.test","password":"TestPass123!","name":"John Dela Cruz"}'
echo ""

echo "Test users created!"
echo ""
echo "You can now sign in with:"
echo "  Email: alex@techflow.test"
echo "  Password: TestPass123!"

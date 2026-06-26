#!/bin/bash

echo "========================================="
echo "Creating Admin Account for EV Service Center"
echo "========================================="

# Admin credentials
ADMIN_USERNAME="admin"
ADMIN_EMAIL="admin@evservice.com"
ADMIN_PASSWORD="Admin@123456"

echo ""
echo "Registering admin user..."
echo "Username: $ADMIN_USERNAME"
echo "Email: $ADMIN_EMAIL"
echo "Password: $ADMIN_PASSWORD"
echo ""

# Register admin
RESPONSE=$(curl -s -X POST http://localhost/api/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$ADMIN_USERNAME\",
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"role\": \"admin\"
  }")

echo "Registration Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

echo ""
echo "========================================="
echo "Logging in as admin..."
echo "========================================="
echo ""

# Login as admin
LOGIN_RESPONSE=$(curl -s -X POST http://localhost/api/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

echo "Login Response:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo ""
    echo "========================================="
    echo "✅ Admin account created successfully!"
    echo "========================================="
    echo ""
    echo "Admin Credentials:"
    echo "  Email: $ADMIN_EMAIL"
    echo "  Password: $ADMIN_PASSWORD"
    echo ""
    echo "Access Token (save this):"
    echo "$TOKEN"
    echo ""
    echo "Use this token in Authorization header:"
    echo "Authorization: Bearer $TOKEN"
    echo ""
else
    echo ""
    echo "❌ Failed to create admin account or login."
    echo "Please check the response above for errors."
    echo ""
fi

#!/bin/bash
# Quick start script for Kestra-only AutoPR setup
# Usage: bash test_kestra_only.sh

set -e

echo "🎼 AutoPR Kestra-Only Setup Test"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Kestra is running
echo -e "${YELLOW}[1/5] Checking Kestra is accessible...${NC}"
if ! curl -s http://localhost:8080/api/v1/flows > /dev/null; then
  echo -e "${RED}❌ Kestra is not running at http://localhost:8080${NC}"
  echo "Start Kestra with: docker compose up kestra -d"
  exit 1
fi
echo -e "${GREEN}✅ Kestra is running${NC}"
echo ""

# Check if secrets are configured
echo -e "${YELLOW}[2/5] Checking Kestra secrets...${NC}"
GMAIL_SECRET=$(curl -s http://localhost:8080/api/v1/secrets/system.autopr | grep -o '"id":"GMAIL_ADDRESS"' | head -1)
if [ -z "$GMAIL_SECRET" ]; then
  echo -e "${RED}⚠️ No GMAIL_ADDRESS secret found${NC}"
  echo "Configure in Kestra UI: Admin → Secrets"
  echo "Required secrets:"
  echo "  - GMAIL_ADDRESS"
  echo "  - GMAIL_PASSWORD (Gmail app password)"
  echo "  - GMAIL_SMTP_HOST (smtp.gmail.com)"
  echo "  - GMAIL_SMTP_PORT (587)"
  echo ""
else
  echo -e "${GREEN}✅ GMAIL_ADDRESS secret found${NC}"
fi
echo ""

# Check if webhook_receiver flow exists
echo -e "${YELLOW}[3/5] Checking webhook_receiver flow...${NC}"
WEBHOOK_FLOW=$(curl -s http://localhost:8080/api/v1/flows/system.autopr/webhook_receiver | grep -o '"id":"webhook_receiver"' | head -1)
if [ -z "$WEBHOOK_FLOW" ]; then
  echo -e "${RED}❌ webhook_receiver flow not found${NC}"
  echo "Upload flows/webhook_receiver.yml to Kestra UI"
  exit 1
fi
echo -e "${GREEN}✅ webhook_receiver flow exists${NC}"
echo ""

# Check if send_notifications flow exists
echo -e "${YELLOW}[4/5] Checking send_notifications flow...${NC}"
NOTIFY_FLOW=$(curl -s http://localhost:8080/api/v1/flows/system.autopr/send_notifications | grep -o '"id":"send_notifications"' | head -1)
if [ -z "$NOTIFY_FLOW" ]; then
  echo -e "${YELLOW}⚠️ send_notifications flow not found${NC}"
  echo "Upload flows/send_notifications.yml to Kestra UI for email support"
else
  echo -e "${GREEN}✅ send_notifications flow exists${NC}"
fi
echo ""

# Manual test webhook trigger
echo -e "${YELLOW}[5/5] Testing webhook trigger...${NC}"
echo "To test the webhook receiver manually:"
echo ""
echo "1. Get your webhook trigger endpoint:"
echo "   curl http://localhost:8080/api/v1/flows/system.autopr/webhook_receiver | grep -A5 'triggers'"
echo ""
echo "2. Send a test webhook:"
echo "   curl -X POST <YOUR_WEBHOOK_ENDPOINT> \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"repository\": {\"full_name\": \"FiscalMindset/autopr\"}, \"commits\": [{\"message\": \"test\", \"author\": {\"name\": \"Test\"}}]}'"
echo ""
echo "3. Check Kestra UI for new execution:"
echo "   http://localhost:8080/ui/executions"
echo ""
echo "4. Verify email received in your Gmail inbox"
echo ""

echo -e "${GREEN}✅ All checks passed! Kestra-only setup is ready.${NC}"
echo ""
echo "📚 Full Setup Guide: docs/KESTRA_ONLY_SETUP.md"
echo "🔗 Kestra UI: http://localhost:8080"

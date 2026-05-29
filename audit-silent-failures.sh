#!/bin/bash

# Comprehensive audit script to find silent failures, missing logging, and hardcoded data

echo "════════════════════════════════════════════════════════════════"
echo "AUDIT: Silent Failures & Missing Logging"
echo "════════════════════════════════════════════════════════════════"
echo ""

PROJECT_ROOT="/home/ubuntu/prime-rewards"
cd "$PROJECT_ROOT"

echo "### 1. SILENT CATCH BLOCKS (catch with no logging)"
echo "════════════════════════════════════════════════════════════════"
grep -rn "catch\s*(" server/ --include="*.ts" | grep -v "test" | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  linenum=$(echo "$line" | cut -d: -f2)
  # Check if next few lines have console.log, logger, or error handling
  context=$(sed -n "${linenum},$((linenum+5))p" "$file")
  if ! echo "$context" | grep -qE "console\.|logger\.|log\(|throw|return.*error"; then
    echo "❌ SILENT CATCH at $file:$linenum"
    echo "   Context: $(echo "$context" | head -1)"
  fi
done
echo ""

echo "### 2. MISSING LOGGING IN CRITICAL PATHS"
echo "════════════════════════════════════════════════════════════════"
echo "Missing logs in QB webhook processing:"
grep -rn "processQbPaymentEvent\|fetchQBInvoice\|fetchQBCustomer\|sendWhatsApp" server/ --include="*.ts" | grep -v "test" | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  linenum=$(echo "$line" | cut -d: -f2)
  # Check if function has logging
  funcname=$(echo "$line" | grep -oE "[a-zA-Z_][a-zA-Z0-9_]*\(" | head -1)
  funcstart=$(grep -n "^.*$funcname" "$file" | head -1 | cut -d: -f1)
  if [ -n "$funcstart" ]; then
    funcend=$((funcstart + 30))
    funcbody=$(sed -n "${funcstart},${funcend}p" "$file")
    if ! echo "$funcbody" | grep -qE "console\.|logger\.|log\("; then
      echo "⚠️  NO LOGGING in $file:$funcstart ($funcname)"
    fi
  fi
done
echo ""

echo "### 3. HARDCODED TEST/DEMO DATA"
echo "════════════════════════════════════════════════════════════════"
echo "Hardcoded phone numbers:"
grep -rn "96550008901\|96550007890\|96550006789\|96550005678\|96550004567" server/ --include="*.ts"
echo ""
echo "Hardcoded customer names:"
grep -rn "Test Tracking\|Valued Customer\|Demo Customer" server/ --include="*.ts"
echo ""
echo "Hardcoded invoice prefixes:"
grep -rn "INV-template\|INV-demo\|INV-test" server/ --include="*.ts"
echo ""

echo "### 4. MISSING PHONE VALIDATION"
echo "════════════════════════════════════════════════════════════════"
grep -rn "sendWhatsApp\|normalisePhone" server/ --include="*.ts" | grep -v "test" | head -20
echo ""

echo "### 5. TWILIO SEND PATHS WITHOUT ERROR HANDLING"
echo "════════════════════════════════════════════════════════════════"
grep -rn "twilio\|Twilio\|TWILIO" server/ --include="*.ts" | grep -v "test" | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  linenum=$(echo "$line" | cut -d: -f2)
  # Check if line has error handling
  if ! grep -q "try\|catch\|error\|Error" <(sed -n "${linenum},$((linenum+3))p" "$file"); then
    echo "⚠️  UNPROTECTED TWILIO CALL at $file:$linenum"
  fi
done
echo ""

echo "### 6. QB WEBHOOK PATHS WITHOUT LOGGING"
echo "════════════════════════════════════════════════════════════════"
grep -rn "qbWebhook\|QB Webhook\|/api/qb/webhook" server/ --include="*.ts" | grep -v "test"
echo ""

echo "### 7. MISSING CORRELATION IDs"
echo "════════════════════════════════════════════════════════════════"
grep -rn "correlationId\|requestId\|traceId" server/ --include="*.ts" | wc -l
echo "Total correlation ID references found: $(grep -rn "correlationId\|requestId\|traceId" server/ --include="*.ts" | wc -l)"
if [ $(grep -rn "correlationId\|requestId\|traceId" server/ --include="*.ts" | wc -l) -lt 5 ]; then
  echo "❌ MISSING: Correlation IDs not used consistently"
fi
echo ""

echo "### 8. ERROR HANDLING GAPS"
echo "════════════════════════════════════════════════════════════════"
echo "Functions without try/catch:"
grep -rn "^export.*function\|^async.*function" server/ --include="*.ts" | grep -v "test" | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  linenum=$(echo "$line" | cut -d: -f2)
  funcbody=$(sed -n "${linenum},$((linenum+50))p" "$file")
  if ! echo "$funcbody" | grep -q "try\|catch"; then
    funcname=$(echo "$line" | grep -oE "[a-zA-Z_][a-zA-Z0-9_]*\(" | head -1)
    echo "⚠️  NO ERROR HANDLING: $file:$linenum ($funcname)"
  fi
done | head -20
echo ""

echo "### 9. ASYNC PROCESSING WITHOUT AWAIT"
echo "════════════════════════════════════════════════════════════════"
grep -rn "\.then\|\.catch" server/ --include="*.ts" | grep -v "test" | head -10
echo ""

echo "### 10. RESPONSE HANDLING GAPS"
echo "════════════════════════════════════════════════════════════════"
grep -rn "res\.send\|res\.json\|res\.status" server/ --include="*.ts" | grep -v "test" | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  linenum=$(echo "$line" | cut -d: -f2)
  # Check if there's error handling before response
  prevlines=$(sed -n "$((linenum-10)),${linenum}p" "$file")
  if ! echo "$prevlines" | grep -qE "try\|catch\|if.*error"; then
    echo "⚠️  UNPROTECTED RESPONSE at $file:$linenum"
  fi
done | head -15
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "AUDIT COMPLETE"
echo "════════════════════════════════════════════════════════════════"

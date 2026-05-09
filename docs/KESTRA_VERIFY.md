# ✅ Kestra-Only Setup Verification

Run through this checklist to verify your Kestra-only deployment is complete.

## Prerequisites
- [ ] Docker & Docker Compose installed
- [ ] Kestra container running on port 8080
- [ ] Gmail account with 2FA enabled
- [ ] Gmail app password generated (16-char code)

## 1. Kestra Infrastructure

```bash
# Check Kestra is running
docker compose ps | grep kestra
# Expected: kestra ... Up (healthy)

# Verify API accessibility
curl http://localhost:8080/api/v1/flows
# Expected: JSON response with flows
```

- [ ] Kestra container is `Up`
- [ ] API responds with HTTP 200
- [ ] Can access UI at http://localhost:8080

## 2. Secrets Configuration

### In Kestra UI: Admin → Secrets

Create these secrets:

```
GMAIL_ADDRESS          = your.email@gmail.com
GMAIL_PASSWORD         = xxxx xxxx xxxx xxxx (app password, NOT regular password)
GMAIL_SMTP_HOST        = smtp.gmail.com
GMAIL_SMTP_PORT        = 587
```

Optionally:
```
GROQ_API_KEY           = (from Groq console)
GEMINI_API_KEY         = (from Google Cloud)
GITHUB_TOKEN           = (from GitHub settings)
```

### Verify
- [ ] Open Kestra UI: http://localhost:8080
- [ ] Go to: Admin → Secrets
- [ ] See all 4 Gmail secrets listed
- [ ] Each secret shows "Created" timestamp
- [ ] Click each secret and verify value is correct

## 3. Flow Uploads

### Required Flows (main folder)
- [ ] `webhook_receiver.yml`
- [ ] `autopr_main_flow.yml`
- [ ] `send_notifications.yml`

### Required Subflows (subflows/ folder)
- [ ] `analyze_input.yml`
- [ ] `analyze_linkedin_style.yml`
- [ ] `deliver_content.yml`
- [ ] `extract_context.yml`
- [ ] `finalize_output.yml`
- [ ] `generate_posts.yml`
- [ ] `route_distribution.yml`
- [ ] `validate_input.yml`

### Upload via CLI
```bash
# Upload all flows at once
for f in flows/*.yml flows/subflows/*.yml; do
  echo "Uploading $f..."
  curl -X POST http://localhost:8080/api/v1/flows \
    -H "Content-Type: application/yaml" \
    --data-binary @"$f"
done
```

### Verify in Kestra UI
- [ ] Go to: Flows
- [ ] Filter by namespace: `system.autopr`
- [ ] See all 12 flows listed (3 main + 8 subflows + webhook_receiver)
- [ ] Click each flow → verify no red error indicators
- [ ] Click `webhook_receiver` → should show HTTP trigger details

## 4. Webhook Receiver Testing

### Get Webhook Endpoint
```bash
# Get the HTTP trigger URL
curl -s http://localhost:8080/api/v1/flows/system.autopr/webhook_receiver \
  | grep -A 2 'triggers' | grep 'path\|url'
```

Expected output format: `http://localhost:8080/api/v1/webhooks/webhook_receiver/...`

- [ ] Note down your webhook URL

### Test Manual Trigger
```bash
# Send test webhook
WEBHOOK_URL="http://localhost:8080/api/v1/webhooks/webhook_receiver/xxxx" # your URL

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "repository": {
      "full_name": "test/repo",
      "url": "https://github.com/test/repo"
    },
    "commits": [{
      "id": "abc123",
      "message": "Test commit from verification",
      "author": {
        "name": "Test User",
        "email": "test@example.com"
      }
    }],
    "pusher": {
      "name": "testuser",
      "email": "testuser@example.com"
    }
  }'
```

### Verify Execution Started
- [ ] In Kestra UI, go to: Executions
- [ ] See new execution for `webhook_receiver` (should be most recent)
- [ ] Status shows: Running (or Success)
- [ ] Wait for it to complete (~10-15 seconds)
- [ ] Click execution → Logs tab
- [ ] See log messages indicating webhook was received

### Test via Kestra UI Button
Alternative: Test without curl
1. In Kestra UI → Flows → webhook_receiver
2. Click **Execute** button
3. Click **Submit** (uses default test payload)
4. Execution starts immediately
5. Monitor in Executions tab

- [ ] Execution completes successfully (green checkmark)
- [ ] No error logs

## 5. Main Flow Testing

### Execute Test
In Kestra UI → Flows → autopr_main_flow:

1. Click **Execute** button
2. Enter test input:
   ```json
   {
     "input": "Write a professional LinkedIn post about AI and productivity",
     "model": "groq"
   }
   ```
3. Click **Submit**

### Monitor
- [ ] Execution starts (blue spinner in Executions list)
- [ ] Execution completes within 2 minutes (green checkmark)
- [ ] Click execution → **Topology** tab
- [ ] All tasks show green (completed successfully)
- [ ] No red (failed) tasks

### Verify Outputs
- [ ] Click execution → **Outputs** tab
- [ ] See `posts` output containing generated content
- [ ] Posts have LinkedIn, X, Instagram variations
- [ ] No error messages in outputs

### Check Logs
- [ ] Click execution → **Logs** tab
- [ ] See Python task outputs
- [ ] LLM API calls succeeded
- [ ] No timeout or connection errors

## 6. Email Sending Test

### Via Main Flow
When main flow executes:
- [ ] Kestra runs `send_notifications` task
- [ ] Check Kestra logs for SMTP messages
- [ ] Check Gmail inbox for email (may take 10-30 seconds)

### Via Manual Execution
In Kestra UI → Flows → send_notifications:

1. Click **Execute** button
2. Enter test post:
   ```json
   {
     "posts": [
       {
         "platform": "LinkedIn",
         "content": "Test email from Kestra-only setup! 🎼 No backend required, all powered by Kestra workflows."
       }
     ],
     "recipient": "your.email@gmail.com",
     "execution_id": "test-123"
   }
   ```
3. Click **Submit**

### Verify Email Received
- [ ] Execution completes successfully
- [ ] Check Gmail inbox (refresh if needed)
- [ ] Email subject: `AutoPR Post: LinkedIn` (or your platform)
- [ ] Email body shows:
  - [ ] Gradient header with Kestra logo
  - [ ] Post content properly formatted
  - [ ] LLM attribution (e.g., "Generated via Groq")
  - [ ] Execution ID link (clickable link to Kestra)
- [ ] Email is not in spam folder

### Check Email Logs
- [ ] In Kestra UI, click execution for send_notifications
- [ ] Go to **Logs** tab
- [ ] See SMTP connection message: `Sending email via SMTP`
- [ ] See success message: `Email sent to: ...`
- [ ] No authentication errors or timeouts

## 7. GitHub Webhook Setup (Optional)

### Configure Webhook
1. GitHub repo → Settings → Webhooks → Add webhook
2. **Payload URL**: Your webhook endpoint (from step 4)
3. **Content type**: `application/json`
4. **Events**: `Push events` (checked)
5. **Active**: ✅ checked
6. Click **Add webhook**

### Test Webhook
1. Make a test commit: `git commit --allow-empty -m "Kestra test"`
2. Push: `git push origin main`
3. In GitHub → Webhooks → Recent Deliveries
4. See new delivery with green checkmark (successful)

### Verify Execution
- [ ] In Kestra UI → Executions
- [ ] New execution for `webhook_receiver` appears within seconds
- [ ] Execution completes successfully
- [ ] Main flow gets triggered automatically

## 8. Backend Status (Optional)

### Check if Backend is Running
```bash
docker compose ps | grep backend
```

- [ ] Backend is running (optional, not required for Kestra-only)
  OR
- [ ] Backend is stopped (that's fine, Kestra works without it)

### Verify Everything Works Without Backend
```bash
# Stop backend (if running)
docker compose down backend

# Test webhook trigger
curl -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" \
  -d '{"repository": {"full_name": "test/repo"}, "commits": [{"message": "test"}]}'

# Execution should still work!
```

- [ ] Webhook still works
- [ ] Main flow still executes
- [ ] Email still sends
- [ ] Everything works without backend running

## 9. Frontend (Optional)

### Option A: Kestra UI Only
- [ ] Access Kestra UI at http://localhost:8080
- [ ] All features work (no React frontend needed)
- [ ] Can view executions, logs, topology, etc.

### Option B: React Frontend (Optional)
```bash
cd frontend
npm run dev
# Opens at http://localhost:5173
```

- [ ] Frontend builds without errors
- [ ] Dashboard loads
- [ ] Can view Kestra executions in dashboard
- [ ] Topology/Gantt viewers work

## 10. Production Checklist

### Security
- [ ] All credentials in Kestra Secrets (not in .env or environment variables)
- [ ] Gmail password is app password (not regular password)
- [ ] 2FA enabled on Gmail
- [ ] GitHub token has minimal required scopes
- [ ] `.gitignore` contains: `backend/.env`, `social.md`

### Performance
- [ ] Main flow completes in < 2 minutes
- [ ] Email sends in < 30 seconds
- [ ] No timeout errors in logs
- [ ] Kestra memory usage reasonable: `docker stats kestra`

### Monitoring
- [ ] Can access Kestra logs: `docker compose logs kestra`
- [ ] Can view all execution history in Kestra UI
- [ ] Execution IDs are recorded for auditing

### Backup
- [ ] Flows backed up: flows/ directory
- [ ] Secrets documented (password manager)
- [ ] Database backup procedures planned

## ✅ All Checks Passing?

Congratulations! Your Kestra-only setup is complete and ready:

✅ No backend code required  
✅ Webhook receiver ready for GitHub  
✅ Email sending via Kestra SMTP plugin  
✅ LLM integration working  
✅ Secrets encrypted in Kestra vault  
✅ Full audit trail available  

### Next Steps
1. Set up GitHub webhook for automatic triggers
2. Monitor first few executions
3. Customize LLM prompts in subflows
4. Scale to additional platforms

### Documentation
- Full setup guide: [KESTRA_ONLY_SETUP.md](KESTRA_ONLY_SETUP.md)
- Quick start: [KESTRA_QUICK_START.md](KESTRA_QUICK_START.md)
- Main README: [README.md](README.md)

---

**Questions?** Check the logs:
```bash
docker compose logs kestra | tail -50
```

Your Kestra-only AutoPR engine is live! 🎼

# 🔗 GitHub Webhook Configuration Guide

Complete this to enable auto-trigger functionality!

## Step-by-Step Setup

### 1. Get Your Kestra Webhook URL

**Option A: From Kestra UI**
1. Open http://localhost:8080 in browser
2. Click **Settings** (gear icon)
3. Go to **Webhooks** or look for webhook configuration
4. You should see a URL that looks like:
   ```
   http://YOUR_DOMAIN/api/v1/webhooks/github
   ```
   For local development, it will be:
   ```
   http://localhost:8080/api/v1/webhooks/github
   ```

**Option B: If running on cloud (e.g., Render, Railway)**
- Replace `localhost:8080` with your actual domain
- Example: `https://kestra-prod.onrender.com/api/v1/webhooks/github`

### 2. Configure GitHub Repository Webhook

1. Go to your repository: https://github.com/FiscalMindset/autopr
2. Click **Settings** tab
3. Click **Webhooks** in left sidebar
4. Click **Add webhook** button

### 3. Fill in Webhook Details

**Payload URL:**
```
http://localhost:8080/api/v1/webhooks/github
```
(Replace with your actual Kestra URL if different)

**Content type:**
- Select: `application/json`

**Events to trigger on:**
- Select: **Just the push event** (for now)
- Or: **Send me everything** (for more sophisticated filtering)

**SSL verification:**
- ✅ Enable SSL verification (recommended)

**Active:**
- ✅ Check this box to enable immediately

### 4. Create the Webhook

Click **Add webhook** button

---

## Testing the Webhook

### Test Locally

```bash
# 1. Make a test commit
git commit --allow-empty -m "Test AutoPR webhook trigger"

# 2. Push to trigger webhook
git push origin main

# 3. Watch Kestra UI for automatic flow execution
# Open http://localhost:8080 and look for new executions
```

### Check Webhook Delivery

1. Go to repository **Settings → Webhooks**
2. Click on your newly created webhook
3. Scroll down to **Recent Deliveries**
4. Click on a delivery to see:
   - Request payload (what GitHub sent)
   - Response (what Kestra returned)
   - Status code (should be 200 for success)

---

## Webhook Payload

GitHub sends the following when you push:

```json
{
  "repository": {
    "full_name": "FiscalMindset/autopr",
    "html_url": "https://github.com/FiscalMindset/autopr",
    "description": "AI-powered content generation with Kestra"
  },
  "commits": [
    {
      "id": "abc123...",
      "message": "Add new feature",
      "author": {
        "name": "Your Name",
        "email": "you@example.com"
      },
      "url": "https://github.com/.../commits/abc123"
    }
  ],
  "ref": "refs/heads/main",
  "pusher": {
    "name": "your-username",
    "email": "you@example.com"
  }
}
```

**What AutoPR extracts:**
- 📦 **Project:** `repository.full_name` → "FiscalMindset/autopr"
- 📝 **Raw Update:** `commits[0].message` → "Add new feature"
- 👤 **Author:** `commits[0].author.name` → "Your Name"
- 🔗 **Repo URL:** `repository.html_url`
- 📊 **Commit Count:** `commits.length`

---

## Troubleshooting

### Webhook Not Triggering Flow

**Check 1: Webhook Delivery Status**
```bash
# In GitHub:
# Settings → Webhooks → Click webhook → Recent Deliveries
# Check status code. Should be 2xx for success.
```

**Check 2: Kestra Logs**
```bash
# View Kestra container logs
docker logs kestra_learning-kestra-1 | tail -50

# Look for messages like:
# "webhook received from GitHub"
# "Triggering autopr_main_flow"
```

**Check 3: Workflow Execution**
```bash
# Check if flow is executing in Kestra
# Visit http://localhost:8080/ui/executions
# Look for recent executions with source "github_webhook"
```

### "404 Not Found" on Webhook Delivery

This means Kestra isn't listening on that URL. Possible causes:
- ❌ Wrong webhook URL
- ❌ Kestra not running
- ❌ Wrong port number
- ❌ Firewall blocking access

**Fix:** Verify Kestra is running:
```bash
docker compose ps
# Should show kestra_learning-kestra-1 as Up
```

### Webhook URL Timeout

If GitHub says webhook URL is timing out:
- ❌ Kestra not responding
- ❌ Network connectivity issue
- ❌ Firewall blocking

**Fix:** Test URL manually:
```bash
curl -v http://localhost:8080/api/v1/webhooks/github
# Should return 405 (Method Not Allowed) for GET
# That's OK - it expects POST requests
```

---

## Advanced: Filtering Events

To only trigger on certain types of pushes:

```yaml
# In webhook_receiver.yml, add conditions:
tasks:
  - id: check_branch
    type: io.kestra.plugin.core.log.Log
    message: "Push on branch: {{ trigger.webhook_data.ref }}"
    condition: "{{ trigger.webhook_data.ref == 'refs/heads/main' }}"
```

This way, only pushes to `main` branch trigger the flow!

---

## Security Best Practices

### 1. Use HTTPS in Production
```
❌ http://kestra.example.com/api/v1/webhooks/github
✅ https://kestra.example.com/api/v1/webhooks/github
```

### 2. Verify Webhook Signature (Optional)
GitHub can sign requests. Kestra can verify:
```bash
# In Kestra webhook settings, enable signature verification
# Use the secret provided
```

### 3. Limit Event Types
Only request the events you need (e.g., push events only, not all events)

### 4. Rate Limiting
Configure in Kestra to prevent webhook floods:
```yaml
triggers:
  - id: github_webhook_trigger
    type: io.kestra.plugin.core.trigger.Http
    # Add rate limiting if supported
```

---

## Next Steps

1. ✅ Get webhook URL from Kestra
2. ✅ Add webhook to GitHub repo
3. ✅ Test with a commit push
4. ✅ Monitor execution in Kestra UI
5. ✅ Check email for generated posts

Once working, every commit will automatically:
- Trigger GitHub webhook
- Call `webhook_receiver.yml`
- Which triggers `autopr_main_flow`
- Which generates posts
- Which sends email notifications

**That's it! 🎉 Full automation activated!**

---

## Support

If something isn't working:

1. **Check webhook delivery:** GitHub → Settings → Webhooks → Recent Deliveries
2. **Check Kestra logs:** `docker logs kestra_learning-kestra-1`
3. **Verify flow execution:** Kestra UI → Executions
4. **Test manually:**
   ```bash
   curl -X POST "http://localhost:8080/api/v1/webhooks/github" \
     -H "Content-Type: application/json" \
     -d @webhook_payload.json
   ```

Contact support with the webhook delivery logs if you need help! 📞

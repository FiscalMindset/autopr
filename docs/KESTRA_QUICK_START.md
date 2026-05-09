# 🚀 Kestra-Only Quick Start (5 Minutes)

## No Backend Required. Everything in Kestra.

### Step 1: Start Kestra (1 min)
```bash
cd /Volumes/algsoch/kestra_learning
docker compose up -d kestra
# Wait for it to be ready at http://localhost:8080
```

### Step 2: Configure Secrets (2 min)

1. Open Kestra UI: `http://localhost:8080`
2. Go to: **Admin → Secrets**
3. Create these secrets:

| Secret | Value |
|--------|-------|
| `GMAIL_ADDRESS` | your.email@gmail.com |
| `GMAIL_PASSWORD` | xxxx xxxx xxxx xxxx (app password, 16 chars) |
| `GMAIL_SMTP_HOST` | smtp.gmail.com |
| `GMAIL_SMTP_PORT` | 587 |
| `GROQ_API_KEY` | (optional, from Groq) |
| `GEMINI_API_KEY` | (optional, from Google) |

**Note:** For Gmail, enable 2FA and create an app password. Don't use your regular password.

### Step 3: Upload Flows (1 min)

In Kestra UI, go to: **Flows → Add**

Upload these files in order:
1. `flows/webhook_receiver.yml` ← **START HERE**
2. `flows/autopr_main_flow.yml`
3. `flows/send_notifications.yml`
4. All subflows in `flows/subflows/`

Or use CLI:
```bash
for f in flows/*.yml flows/subflows/*.yml; do
  curl -X POST http://localhost:8080/api/v1/flows \
    -H "Content-Type: application/yaml" \
    --data-binary @"$f"
done
```

### Step 4: Test It (1 min)

1. Open Kestra UI: `http://localhost:8080`
2. Go to: **Flows → webhook_receiver**
3. Click: **Execute**
4. Fill in test payload (optional, webhook_receiver has defaults)
5. Click: **Submit**
6. Watch execution in **Executions** tab
7. Check your email inbox for the styled message

### Done! ✅

Your AutoPR Engine is now running **entirely on Kestra** with:
- ✅ Webhook receiver (HTTP trigger)
- ✅ AI generation (Kestra tasks)
- ✅ Email sending (Kestra mail plugin + secrets)
- ✅ Zero backend code required

---

## GitHub Webhook Setup (Optional)

To automatically trigger on GitHub pushes:

1. Go to: **Kestra UI → Flows → webhook_receiver**
2. Find the HTTP trigger endpoint (shown in flow details)
3. Copy the URL
4. Go to: **GitHub → Your Repo → Settings → Webhooks**
5. Click: **Add webhook**
6. **Payload URL**: Paste the Kestra endpoint
7. **Content type**: `application/json`
8. **Events**: `Push events`
9. **Active**: ✅
10. **Add webhook**

Now, every `git push` to your repo triggers AutoPR automatically!

---

## Disable Backend (Optional)

The backend is not required. If you want to stop it:

```bash
# Stop the FastAPI backend
docker compose down backend

# Or if running locally, just kill the process
pkill -f "uvicorn main:app"
```

Everything still works through Kestra UI and the webhook receiver.

---

## Monitor & Debug

**See all executions:**
- Kestra UI → **Executions**

**View topology (flow structure):**
- Click an execution → **Topology**

**View logs:**
- Click an execution → **Logs**

**View generated posts:**
- Click an execution → **Outputs**

---

## Troubleshooting

**"Email not found"**
- Check Kestra secrets are set: Admin → Secrets
- Verify `GMAIL_ADDRESS` and `GMAIL_PASSWORD` are exact

**"Webhook not triggered"**
- Check Kestra is running: `curl http://localhost:8080`
- Check flow is uploaded: Flows → webhook_receiver
- Check execution logs for errors

**"Gmail rejects email"**
- Use app password, not regular password
- Enable 2FA on Gmail first
- Verify `GMAIL_SMTP_PORT` is 587

---

## Full Documentation

See `docs/KESTRA_ONLY_SETUP.md` for:
- Detailed architecture
- Advanced customization
- Security best practices
- Production checklist
- API reference

---

**Backend is optional.** Run Kestra. Done. 🎼

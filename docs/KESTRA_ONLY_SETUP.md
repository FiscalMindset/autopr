# Fully Kestra Setup (No Backend Required)

This guide explains how to run AutoPR entirely within Kestra using HTTP triggers, Kestra secrets, and native tasks—without a FastAPI backend.

## 🎯 Architecture (Backend-Free)

```
GitHub → Webhook → Kestra HTTP Trigger (webhook_receiver flow)
                          ↓
                   Start main_flow
                          ↓
                   Generate posts + Email via SMTP task
                          ↓
                   Kestra UI (topology, logs, outputs)
```

## 1. Configure Kestra Secrets

In Kestra UI, go to **Admin → Secrets** and create the following secrets:

| Secret Name         | Value                              | Example                                |
|---------------------|-----------------------------------|----------------------------------------|
| `GMAIL_ADDRESS`     | Your Gmail address                | `your.email@gmail.com`                 |
| `GMAIL_PASSWORD`    | Gmail app password (2FA required) | `vuichewtlkwsjfaa`                     |
| `GMAIL_SMTP_HOST`   | SMTP server                       | `smtp.gmail.com`                       |
| `GMAIL_SMTP_PORT`   | SMTP port                         | `587`                                  |
| `GROQ_API_KEY`      | Groq API key                      | (from Groq console)                    |
| `GEMINI_API_KEY`    | Gemini API key                    | (from Google AI Studio)                |
| `GITHUB_TOKEN`      | GitHub personal access token      | (from GitHub settings)                 |

In Kestra, use secrets as: `{{ secret('SECRET_NAME') }}`

### Why Secrets Instead of Environment Variables?

- **Kestra Secrets**: Encrypted at rest, auditable, never logged, scoped per namespace.
- **Environment Variables**: Visible in OS, often logged, less secure for credentials.
- **Best Practice**: Always use Kestra secrets for API keys, tokens, and passwords.

## 2. Deploy Flows

Upload or push these flows to Kestra:

1. **webhook_receiver.yml** — Accepts GitHub webhooks via HTTP trigger
2. **autopr_main_flow.yml** — Main generation flow (existing)
3. **send_notifications.yml** — Email sending via Kestra SMTP task
4. **Subflows** — analyze_input, generate_posts, deliver_content, etc.

### Upload via UI

1. Go to Kestra UI: `http://localhost:8080`
2. **Flows → Add**
3. Paste flow YAML or upload file
4. **Save**

### Upload via CLI / API

```bash
curl -X POST http://localhost:8080/api/v1/flows \
  -H "Content-Type: application/yaml" \
  --data-binary @flows/webhook_receiver.yml
```

## 3. Configure GitHub Webhook (Webhook Receiver Flow)

The `webhook_receiver` flow has an HTTP trigger that generates a public endpoint.

### Find Your Endpoint

1. In Kestra UI, open the `webhook_receiver` flow
2. Look for the HTTP trigger endpoint (usually: `http://your-kestra-host/api/v1/webhooks/trigger/...`)
3. Copy this URL

### Set Up GitHub Webhook

1. Go to your GitHub repo → **Settings → Webhooks**
2. **Add webhook**
3. **Payload URL**: Paste your Kestra HTTP trigger endpoint
4. **Content type**: `application/json`
5. **Events**: Select `Push events`
6. **Active**: ✅
7. **Add webhook**

### Secure the Webhook (Recommended)

- GitHub will include `X-Hub-Signature-256` header; validate it in a Kestra task before triggering the main flow.
- Or restrict webhook IP addresses to Kestra's server.

## 4. Email Sending (Kestra Native)

The `send_notifications` flow uses Kestra's built-in **Mail.Send** plugin:

- **Input**: Generated posts (JSON)
- **Task**: io.kestra.plugin.core.mail.Send
- **Credentials**: From Kestra secrets (GMAIL_ADDRESS, GMAIL_PASSWORD, GMAIL_SMTP_HOST, GMAIL_SMTP_PORT)
- **Output**: Styled HTML email with post content + LLM attribution + Execution link

**Advantages over Backend:**
- No separate SMTP service running
- Retry logic built-in
- Observability in Kestra logs
- Secrets never exposed to backend code

## 5. Frontend Integration (Optional)

**Option A: Use Kestra UI Only**
- Navigate to Kestra UI for execution logs, topology, and Gantt
- No separate frontend needed
- Loss: Convenient dashboard with quick status overview

**Option B: Keep React Frontend (Optional)**
- Frontend calls Kestra API directly:
  ```typescript
  const execution = await axios.get(`http://localhost:8080/api/v1/executions/${executionId}`)
  ```
- Use Kestra's API for execution data (state, logs, outputs)
- Link to Kestra UI for topology/Gantt
- **No FastAPI backend required**

**Option C: Lightweight Frontend Proxy**
- If you want CORS, caching, or auth layer, keep a tiny proxy
- But the core logic runs entirely in Kestra

## 6. Testing the Full Flow

### Manual Test

1. **Start Kestra** (if using Docker):
   ```bash
   docker compose up kestra -d
   ```

2. **Upload flows** to Kestra

3. **Trigger webhook_receiver manually** (via Kestra UI or API):
   ```bash
   curl -X POST http://localhost:8080/api/v1/webhooks/trigger/webhook_receiver_trigger \
     -H "Content-Type: application/json" \
     -d '{
       "repository": {"full_name": "FiscalMindset/autopr"},
       "commits": [{"message": "test commit", "author": {"name": "Test User"}}]
     }'
   ```

4. **Check Kestra UI**:
   - Open **Executions** → look for the new run
   - Click to view **Topology** (flow structure)
   - View **Logs** (all tasks executed)
   - Check **Outputs** (generated posts, email status)

5. **Verify email** (check your Gmail inbox for the styled message)

### GitHub Webhook Test

1. Push a commit to your GitHub repo
2. GitHub sends webhook to Kestra
3. Kestra receives, validates, and starts the main flow
4. Check Kestra UI for execution
5. Verify email in inbox

## 7. Disable Backend (Make It Optional)

### If Fully Using Kestra:

1. **Stop the FastAPI backend**:
   ```bash
   # Don't run: uvicorn main:app
   ```

2. **Update GitHub webhook** to point directly to Kestra (not FastAPI):
   - Old: `http://localhost:8000/api/github-webhook`
   - New: Kestra HTTP trigger endpoint (from webhook_receiver flow)

3. **Stop the React frontend** (optional) or update it to call Kestra API directly:
   ```typescript
   // Old: const data = await axios.get(`http://localhost:8000/api/runs`)
   // New:
   const executions = await axios.get(`http://localhost:8080/api/v1/executions?namespace=system.autopr&flowId=autopr_main_flow`)
   ```

### If Keeping Backend for UI Only:

1. **Keep FastAPI running** but **disable core logic**:
   - Remove `/api/github-webhook` endpoint from backend
   - Remove `/api/generate` endpoint
   - Remove `/api/send-post-email` endpoint (now Kestra handles it)
   - Keep `/api/posts`, `/api/backend-defaults` for UI data

2. **Backend becomes a simple read-only proxy** to Kestra

## 8. Advantages of Full Kestra

| Feature | Backend-Only | Kestra-Only |
|---------|--------------|------------|
| **Complexity** | Multiple services | Single orchestrator |
| **Observability** | Logs scattered | Everything in Kestra UI (topology, Gantt, logs) |
| **Retries/Error Handling** | Manual coding | Built-in |
| **Secrets** | Environment vars (risky) | Kestra secrets (encrypted, auditable) |
| **Scalability** | Scale backend separately | Kestra handles workload scheduling |
| **Webhooks** | FastAPI + CORS | Kestra HTTP trigger |
| **Email** | Custom SMTP code | Native Kestra mail plugin |
| **Cost** | Extra server/process | Single Kestra instance |

## 9. Migrate Gradually

1. **Step 1**: Keep backend, add Kestra webhook flow
2. **Step 2**: Test webhook trigger in Kestra
3. **Step 3**: Add Kestra secrets + email flow
4. **Step 4**: Disable backend endpoints one by one
5. **Step 5**: Keep only optional frontend proxy if needed

## 10. Production Checklist

- [ ] Kestra is in a secure network (not publicly exposed)
- [ ] Secrets are encrypted in Kestra vault
- [ ] GitHub webhook has signature validation (in workflow task)
- [ ] Email SMTP credentials are app-passwords (Gmail 2FA required)
- [ ] Kestra UI is behind authentication (if exposed)
- [ ] Flow versioning is in place (git + Kestra flow history)
- [ ] Error notifications are configured (Kestra alerts)
- [ ] Backup of flows and execution logs is configured

---

## Quick Commands

### See All Secrets in Namespace

```
GET http://localhost:8080/api/v1/secrets/system.autopr
```

### Manually Trigger Webhook Receiver

```bash
curl -X POST http://localhost:8080/api/v1/webhooks/trigger/YOUR_TRIGGER_ID \
  -H "Content-Type: application/json" \
  -d @demo_payload.json
```

### View Execution Details

```bash
curl http://localhost:8080/api/v1/executions/YOUR_EXECUTION_ID
```

### Get All Executions for a Flow

```bash
curl "http://localhost:8080/api/v1/executions?namespace=system.autopr&flowId=autopr_main_flow"
```

---

## Resources

- [Kestra Secrets Documentation](https://kestra.io/docs/user-interface/variables)
- [Kestra HTTP Trigger Plugin](https://kestra.io/plugins/core/triggers/io.kestra.plugin.core.trigger.http)
- [Kestra Mail Send Plugin](https://kestra.io/plugins/core/tasks/io.kestra.plugin.core.mail.send)
- [Kestra Subflows](https://kestra.io/docs/developer-guide/subflows)

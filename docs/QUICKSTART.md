# 🚀 Quick Start Guide - Test All 6 Features

## 5-Minute Setup

### Step 1: Install Frontend Dependencies
```bash
cd /Volumes/algsoch/kestra_learning/frontend
npm install
```

### Step 2: Configure Gmail (Optional but Recommended)
```bash
# Edit backend/.env
# Add these lines:
gmail=your-gmail@gmail.com
gmail_password=your-app-password
```

**Get App Password:**
1. Visit: https://myaccount.google.com/apppasswords
2. Select Phone or Tablet
3. Copy the 16-character password
4. Paste into `gmail_password` in `.env`

### Step 3: Start Services
```bash
cd /Volumes/algsoch/kestra_learning
docker-compose up
```

**Wait for services to start (30-60 seconds)**

---

## ✅ Testing Each Feature

### Feature 1: Auto-Scroll ✅ (Test First - No Setup Needed)

1. Open http://localhost:3000 in browser
2. Scroll down to see the orchestration tabs (Gantt, Metrics, Logs)
3. Click on "Gantt" tab
4. **Expected:** Page smoothly scrolls down to show the Gantt chart
5. Click on "Topology" tab
6. **Expected:** No scroll (already visible)
7. Click "Metrics" tab
8. **Expected:** Page scrolls to show metrics

✅ **Feature 1 Complete**

---

### Feature 2: Topology Viewer ✅

1. Still on Dashboard (http://localhost:3000)
2. Go to "Topology" tab (middle of orchestration section)
3. Look for "Open in Kestra" button (blue button)
4. Click "Open in Kestra"
5. **Expected:** New tab opens showing Kestra's topology view
6. Back in Dashboard tab - verify you can see the topology iframe

✅ **Feature 2 Complete**

---

### Feature 3: Gantt Chart Viewer ✅

1. Back on Dashboard (http://localhost:3000)
2. Go to "Gantt" tab
3. Look for "Open in Kestra" button (green button with icon)
4. Click "Open in Kestra"
5. **Expected:** New tab opens showing Kestra's Gantt chart
6. In Dashboard tab - verify you can see the Gantt chart

✅ **Feature 3 Complete**

---

### Feature 4: Webhook Auto-Trigger ✅

**Option A: Push a Real Commit (If You Have GitHub Access)**

1. Make a change to the AutoPR repo locally:
   ```bash
   echo "# Test" >> README.md
   git add README.md
   git commit -m "Test webhook trigger"
   git push
   ```

2. Check Docker logs for webhook:
   ```bash
   docker-compose logs backend | grep -i webhook
   ```

3. **Expected in logs:**
   ```
   INFO: Received GitHub webhook...
   INFO: Auto-triggered Kestra execution...
   ```

**Option B: Simulate Webhook (Manual Test)**

1. Open Terminal
2. Send a test webhook:
   ```bash
   curl -X POST http://localhost:8000/api/github-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "commits": [{"message": "Test commit", "author": {"name": "Test User"}}],
       "repository": {"full_name": "test/repo"}
     }'
   ```

3. **Expected in logs:**
   ```
   INFO: Received GitHub webhook for test/repo
   INFO: Auto-triggered Kestra execution...
   ```

✅ **Feature 4 Complete**

---

### Feature 5: Gmail Email Notifications ✅

**If Gmail is Configured:**

1. After triggering webhook (Feature 4), check your email
2. **Expected:** Receive 2 emails:
   - Email 1: "🔔 AutoPR: New Webhook Event"
   - Email 2: "✅ AutoPR: Execution Started"

3. Click email to verify it contains:
   - Commit details
   - Repository name
   - Execution ID
   - Link to Kestra UI

**If Gmail is Not Configured:**

1. Check backend logs:
   ```bash
   docker-compose logs backend | grep -i email
   ```

2. **Expected:** Should see errors about Gmail configuration (normal if not set up)

✅ **Feature 5 Complete**

---

### Feature 6: Render Deployment ✅

1. Read the deployment guide:
   ```bash
   cat docs/DEPLOYMENT_RENDER.md
   ```

2. **Key points:**
   - Render is fully compatible ✅
   - Cost: ~$8-17/month
   - Services needed: 3 (Kestra, Backend, Frontend)
   - Documentation includes step-by-step instructions

✅ **Feature 6 Verified**

---

## 📊 Full Test Scenario (Complete Flow)

### Time: ~5 minutes
```
1. Start services (30s)          ← docker-compose up
2. Test auto-scroll (30s)        ← Click tabs, verify scroll
3. Test topology link (30s)      ← Click "Open in Kestra"
4. Test gantt link (30s)         ← Click "Open in Kestra"
5. Trigger webhook (30s)         ← curl or git push
6. Check email (60s)             ← Verify 2 emails received
7. Verify in Kestra (60s)        ← Check execution started
```

---

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check if ports are in use
lsof -i :3000    # Frontend
lsof -i :8000    # Backend
lsof -i :8080    # Kestra

# Kill process if needed
kill -9 <PID>
```

### Auto-Scroll Not Working
```bash
# Check browser console for errors
# Cmd+Option+J (Mac) to open developer tools
# Look for any error messages

# Try hard refresh: Cmd+Shift+R
```

### Email Not Sending
```bash
# Check if Gmail is configured
grep gmail backend/.env

# Check if app password is valid
# Try sending test email in Python:
python3
>>> import smtplib
>>> # Test SMTP connection
```

### Webhook Not Triggering
```bash
# Check backend logs
docker-compose logs backend | tail -50

# Verify webhook URL in GitHub settings
# Should be: http://your-domain:8000/api/github-webhook
```

### Links Don't Open
```bash
# Verify Kestra is running
# Visit http://localhost:8080 in browser

# Check currentGanttUrl and currentTopologyUrl in network tab
# Should show full URLs like:
# http://localhost:8080/ui/executions/system.autopr/autopr_main_flow/...
```

---

## 📱 Testing Checklist

### Pre-Test
- [ ] Docker Desktop running
- [ ] Frontend dependencies installed (`npm install`)
- [ ] `.env` file has webhook settings
- [ ] Gmail app password configured (optional)

### During Test
- [ ] Auto-scroll works when clicking tabs
- [ ] "Open in Kestra" buttons visible and clickable
- [ ] Topology view opens in new tab
- [ ] Gantt chart opens in new tab
- [ ] Webhook can be triggered manually
- [ ] Logs show "Auto-triggered execution"
- [ ] Emails received (if Gmail configured)

### Post-Test
- [ ] All 6 features working ✓
- [ ] No error messages in console ✓
- [ ] Ready to deploy ✓

---

## 🔗 Useful Links

### Local URLs
- **Dashboard:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **Kestra UI:** http://localhost:8080
- **Swagger Docs:** http://localhost:8000/docs

### GitHub Webhook Testing
- **GitHub Webhooks:** Settings → Webhooks
- **Webhook URL:** `http://your-ip:8000/api/github-webhook`
- **Test Payload:** Can use GitHub's "Redeliver" button

### Documentation
- **Complete Solution:** `docs/COMPLETE_SOLUTION.md`
- **Final Summary:** `docs/FINAL_SUMMARY.md`
- **Deployment (Render):** `docs/DEPLOYMENT_RENDER.md`

---

## 💡 Pro Tips

### Tip 1: Monitor All Logs
```bash
# In separate terminal, watch all logs
docker-compose logs -f
```

### Tip 2: Access Container Shell
```bash
# If you need to debug backend
docker-compose exec backend /bin/bash

# Check environment variables
env | grep -i webhook
env | grep -i gmail
```

### Tip 3: View Database
```bash
# PostgreSQL is running inside Docker
# To check execution data:
docker-compose exec postgres psql -U kestra
# SELECT * FROM executions;
```

### Tip 4: Reset Everything
```bash
# If something goes wrong
docker-compose down -v
docker-compose up --build
```

---

## ✨ Expected Output

### When Everything Works
```
✅ Auto-scroll smooth and responsive
✅ Topology link opens in new tab
✅ Gantt link opens in new tab
✅ Webhook triggers within 2 seconds
✅ Execution appears in Kestra
✅ 2 emails received (if Gmail configured)
✅ No errors in console
✅ Frontend builds successfully
```

---

## 🎯 Success!

Once you've verified all 6 features:

1. **Local Testing Complete** ✅
2. **Ready for Deployment** ✅
3. **Proceed to Render** (see `docs/DEPLOYMENT_RENDER.md`) ✅

---

**Estimated Total Time:** 5-10 minutes
**Difficulty Level:** ⭐ Easy (Most features work automatically)
**Support:** Check docs/ folder for detailed guides

Good luck! 🚀

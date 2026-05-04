# Demo Script

## The Scenario
We have built a new feature and want to post about it.

### Step 1: Submit the Update
Open the React Dashboard at `http://localhost:3000`.

Fill in the form:
- **Project Name**: Algsoch
- **Raw Update**: "Added offline AI response streaming, fixed auto-scroll, improved traceability UI, and added mode metadata for debugging."
- **Goal**: Build in Public

### Step 2: Observe Orchestration
1. Click **Orchestrate Content**.
2. Notice the new execution appear in the "Recent Executions" list as `triggered` or `running`.
3. Click **View Kestra** to open the Kestra UI.
4. Go to the **Gantt** or **Topology** tab to see:
   - `analyze_input` runs and identifies this as "technical".
   - `generate_posts` branches into 4 parallel tasks to generate specific content.
   - `route_distribution` selects LinkedIn and Twitter because it's a technical "build_in_public" update.
   - `deliver_content` dry-runs the output for LinkedIn and Twitter.

### Step 3: Verify Output
Check the local storage outputs on your machine:
```bash
cat data/posts/*
```
You will see the generated `.json` payloads with the customized text.

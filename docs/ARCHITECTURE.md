# AutoPR Engine Architecture

## Components

### 1. Frontend (React + Vite + Tailwind)
- Provides a clean, modern user interface.
- Polls the backend for recent executions and displays status.
- Allows users to submit new updates.

### 2. Backend (FastAPI)
- Exposes REST endpoints (`/api/generate`, `/api/github-webhook`).
- Saves execution metadata locally to `/data/runs/`.
- Makes asynchronous requests to the Kestra API (`POST /api/v1/executions/...`) to trigger flows.

### 3. Kestra Orchestrator
Uses the namespace `system.autopr`.
- **autopr_main_flow**: The master DAG. Orchestrates the subflows sequentially.
- **analyze_input**: Executes python to determine topic and tone.
- **generate_posts**: Uses `io.kestra.plugin.core.execution.Parallel` to execute 4 python generation scripts concurrently.
- **route_distribution**: Determines which platforms to target.
- **deliver_content**: Uses `io.kestra.plugin.core.execution.EachSequential` to iterate over selected platforms and execute delivery logic.

### 4. Data Storage
A shared Docker volume mapped to `/data` stores state:
- `/data/runs/`: Initial requests and Kestra execution IDs.
- `/data/posts/`: Delivered/Dry-run post payloads.

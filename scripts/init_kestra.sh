#!/bin/sh
set -eu

KESTRA_URL="${KESTRA_URL:-http://localhost:8080}"
FLOWS_DIR="${FLOWS_DIR:-flows}"

if [ ! -d "$FLOWS_DIR" ] && [ -d /flows ]; then
  FLOWS_DIR="/flows"
fi

echo "Waiting for Kestra at $KESTRA_URL..."
until curl -fsSI "$KESTRA_URL/" >/dev/null; do
  sleep 5
done
echo "Kestra is up."

load_flow() {
  flow_id="$1"
  file_path="$2"
  echo "Loading $flow_id from $file_path"
  curl -fsS -X PUT "$KESTRA_URL/api/v1/flows/system.autopr/$flow_id" \
    -H "Content-Type: application/x-yaml" \
    --data-binary "@$file_path" >/dev/null
}

load_flow validate_input "$FLOWS_DIR/subflows/validate_input.yml"
load_flow extract_context "$FLOWS_DIR/subflows/extract_context.yml"
load_flow analyze_input "$FLOWS_DIR/subflows/analyze_input.yml"
load_flow analyze_linkedin_style "$FLOWS_DIR/subflows/analyze_linkedin_style.yml"
load_flow generate_posts "$FLOWS_DIR/subflows/generate_posts.yml"
load_flow route_distribution "$FLOWS_DIR/subflows/route_distribution.yml"
load_flow deliver_content "$FLOWS_DIR/subflows/deliver_content.yml"
load_flow finalize_output "$FLOWS_DIR/subflows/finalize_output.yml"
load_flow autopr_main_flow "$FLOWS_DIR/autopr_main_flow.yml"

echo "All AutoPR Kestra flows loaded."

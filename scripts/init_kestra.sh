#!/bin/bash

# Wait for Kestra to be ready
echo "Waiting for Kestra to start..."
until curl -s http://localhost:8080/api/v1/health | grep -q '"status":"UP"'; do
  sleep 5
done
echo "Kestra is up!"

# Load subflows first
echo "Loading analyze_input flow..."
curl -X PUT http://localhost:8080/api/v1/flows/system.autopr/analyze_input -H "Content-Type: application/x-yaml" --data-binary @flows/subflows/analyze_input.yml

echo "Loading generate_posts flow..."
curl -X PUT http://localhost:8080/api/v1/flows/system.autopr/generate_posts -H "Content-Type: application/x-yaml" --data-binary @flows/subflows/generate_posts.yml

echo "Loading route_distribution flow..."
curl -X PUT http://localhost:8080/api/v1/flows/system.autopr/route_distribution -H "Content-Type: application/x-yaml" --data-binary @flows/subflows/route_distribution.yml

echo "Loading deliver_content flow..."
curl -X PUT http://localhost:8080/api/v1/flows/system.autopr/deliver_content -H "Content-Type: application/x-yaml" --data-binary @flows/subflows/deliver_content.yml

# Load main flow
echo "Loading main flow..."
curl -X PUT http://localhost:8080/api/v1/flows/system.autopr/autopr_main_flow -H "Content-Type: application/x-yaml" --data-binary @flows/autopr_main_flow.yml

echo "All flows loaded successfully."

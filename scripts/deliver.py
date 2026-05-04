import os
import sys
import json
from datetime import datetime

def deliver(run_id, platform, content, dry_run=True):
    # Determine delivery status
    status = "delivered" if not dry_run else "dry_run"
    
    # In a real app, we would use requests to post to Twitter/LinkedIn API here.
    # For now, we save the payload to local storage.
    
    payload = {
        "run_id": run_id,
        "platform": platform,
        "content": content,
        "timestamp": datetime.utcnow().isoformat(),
        "status": status,
        "dry_run": dry_run
    }
    
    # Save to shared volume
    posts_dir = "/data/posts"
    os.makedirs(posts_dir, exist_ok=True)
    file_path = os.path.join(posts_dir, f"{run_id}_{platform}.json")
    
    with open(file_path, "w") as f:
        json.dump(payload, f, indent=2)
        
    return {
        "platform": platform,
        "status": status,
        "saved_path": file_path
    }

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Missing args. Usage: deliver.py <run_id> <platform> <content> <dry_run>"}))
        sys.exit(1)
        
    run_id = sys.argv[1]
    platform = sys.argv[2]
    content = sys.argv[3]
    dry_run = sys.argv[4].lower() in ["true", "1", "yes"]
    
    result = deliver(run_id, platform, content, dry_run)
    print(json.dumps(result))

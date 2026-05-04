import sys
import json

def route(analysis, goal):
    platforms = set()
    
    if analysis.get("is_technical"):
        platforms.update(["linkedin", "twitter"])
        
    if analysis.get("is_milestone"):
        platforms.update(["linkedin", "twitter", "instagram"])
        
    if analysis.get("is_hiring") or goal == "hiring":
        platforms.update(["linkedin", "whatsapp"])
        
    if goal == "build_in_public":
        platforms.update(["twitter", "linkedin"])
        
    # Default fallback
    if not platforms:
        platforms.update(["linkedin"])
        
    # If confidence is low, maybe flag for review
    requires_review = analysis.get("confidence", 1.0) < 0.5
    
    return {
        "selected_platforms": list(platforms),
        "requires_review": requires_review
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing args. Usage: route.py <analysis_json> <goal>"}))
        sys.exit(1)
        
    try:
        analysis = json.loads(sys.argv[1])
    except:
        analysis = {}
        
    goal = sys.argv[2]
    
    result = route(analysis, goal)
    print(json.dumps(result))

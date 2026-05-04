import os
import sys
import json
import uuid

def analyze(input_text):
    # Deterministic fallback logic to analyze the text
    text_lower = input_text.lower()
    
    is_technical = "fix" in text_lower or "bug" in text_lower or "refactor" in text_lower or "code" in text_lower or "ui" in text_lower
    is_hiring = "hire" in text_lower or "intern" in text_lower or "job" in text_lower
    is_milestone = "launch" in text_lower or "release" in text_lower or "version" in text_lower
    
    topics = []
    if is_technical: topics.append("technical")
    if is_hiring: topics.append("hiring")
    if is_milestone: topics.append("milestone")
    if not topics: topics.append("general_update")
        
    confidence = 0.8
    if len(input_text) < 10:
        confidence = 0.4
        
    return {
        "topics": topics,
        "is_technical": is_technical,
        "is_hiring": is_hiring,
        "is_milestone": is_milestone,
        "confidence": confidence,
        "tone": "professional" if is_technical else "enthusiastic"
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing input text"}))
        sys.exit(1)
        
    raw_input = sys.argv[1]
    result = analyze(raw_input)
    
    # Print JSON to stdout so Kestra can capture it as an output variable
    print(json.dumps(result))

import os
import sys
import json

def generate_post(platform, raw_text, analysis):
    # Deterministic fallback generation
    base_text = raw_text.strip()
    
    if platform == "linkedin":
        return f"🚀 Exciting update on our journey!\n\nWe just completed some major work: {base_text}\n\nOur team is working hard to improve our system. #BuildInPublic #Tech #Update"
    
    elif platform == "twitter":
        return f"Just shipped a new update: {base_text} 🚀 #Dev #Tech"
        
    elif platform == "instagram":
        return f"✨ Fresh updates straight from the dev lab ✨\n\n{base_text}\n\nDrop a ❤️ if you love shipping fast!\n\n#DevLife #Tech #Startup"
        
    elif platform == "whatsapp":
        return f"Hey! Just wanted to share a quick update on the project: {base_text}. Let me know what you think!"
        
    else:
        return base_text

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Missing args. Usage: generate.py <platform> <raw_text> <analysis_json>"}))
        sys.exit(1)
        
    platform = sys.argv[1]
    raw_text = sys.argv[2]
    
    try:
        analysis = json.loads(sys.argv[3])
    except:
        analysis = {}
        
    post_content = generate_post(platform, raw_text, analysis)
    
    # Return as JSON
    print(json.dumps({
        "platform": platform,
        "content": post_content,
        "char_count": len(post_content)
    }))

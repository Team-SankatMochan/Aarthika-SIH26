import sys
sys.stdout.reconfigure(encoding='utf-8')

import requests

api_key = "your_api_key_here"

print("Fetching available models from Groq API...\n")

try:
    response = requests.get(
        "https://api.groq.com/openai/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=10
    )

    if response.status_code == 200:
        data = response.json()
        models = data.get("data", [])

        print(f"Found {len(models)} available models:\n")
        for model in models:
            model_id = model.get("id", "unknown")
            print(f"  - {model_id}")

        if models:
            print(f"\nRecommended model: {models[0]['id']}")
    else:
        print(f"Error {response.status_code}: {response.text}")

except Exception as e:
    print(f"Failed to fetch models: {e}")
    print("\nTrying direct Groq website for model info...")
    print("Visit: https://console.groq.com/docs/models")

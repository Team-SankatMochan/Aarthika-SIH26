import sys
sys.stdout.reconfigure(encoding='utf-8')

from langchain_groq import ChatGroq

api_key = "your_api_key_here"

# Likely model names for Sept 2026
models_to_try = [
    "llama-4-70b",
    "llama-4-8b",
    "llama-3.3-8b-instant",
    "llama3-8b-8192",
    "llama3-70b-8192",
    "mixtral-8x22b-32768",
    "gemma-2-9b-it",
    "qwen-2-72b-instruct",
]

print("Finding working Groq model (Sept 2026)...\n")

for model_name in models_to_try:
    try:
        print(f"Trying: {model_name}...")
        llm = ChatGroq(model=model_name, groq_api_key=api_key, temperature=0.2, timeout=10)
        response = llm.invoke("Say OK")
        print(f"\nSUCCESS! Working model: {model_name}")
        print(f"Response: {response.content}\n")
        break
    except Exception as e:
        error = str(e)
        if "decommissioned" in error:
            print(f"  -> Decommissioned")
        elif "does not exist" in error or "not found" in error:
            print(f"  -> Not found")
        else:
            print(f"  -> Error: {error[:60]}")

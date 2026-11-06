import os
import sys
import time
import subprocess
import uvicorn
import httpx

def check_ollama(url="http://localhost:11434/api/tags"):
    try:
        r = httpx.get(url, timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False

def check_ollama_installed():
    try:
        # On Windows, try with shell=True to find the executable easily
        subprocess.run(["ollama", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, check=True)
        return True
    except Exception:
        return False

def start_ollama_service():
    print("Ollama is not running. Attempting to start Ollama...")
    if not check_ollama_installed():
        print("=" * 60)
        print("ERROR: Ollama is not installed or not in PATH.")
        print("DGMS Copilot uses Ollama for local, offline AI generation.")
        print("Please download and install it from: https://ollama.com/download")
        print("Once installed, pull the models using:")
        print("  ollama pull qwen3:8b")
        print("  ollama pull llama3.1:8b")
        print("=" * 60)
        return False

    # Start ollama as a background process
    try:
        # We use shell=True on Windows to ensure it finds ollama in PATH properly
        subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
        
        # Wait until it is responsive
        print("Waiting for Ollama to become responsive...")
        for _ in range(15):
            if check_ollama():
                print("Ollama is now running and ready.")
                return True
            time.sleep(1)
            
        print("WARNING: Timed out waiting for Ollama to start. Backend will still launch but local AI models may fail.")
        return False
    except Exception as e:
        print(f"Failed to start Ollama automatically: {e}")
        return False

if __name__ == "__main__":
    print("Checking Ollama status...")
    if not check_ollama():
        start_ollama_service()
    else:
        print("Ollama is already running.")

    print("Starting FastAPI backend...")
    # Using reload=True might require the app string "main:app"
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

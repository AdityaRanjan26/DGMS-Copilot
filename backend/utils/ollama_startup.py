import sys
import time
import subprocess
import httpx

def ensure_ollama_running(url="http://localhost:11434/api/tags"):
    """
    Checks if Ollama is running. If not, attempts to start it.
    Returns True if running, False otherwise.
    """
    if _check_ollama(url):
        print("Ollama is already running.")
        return True

    print("Ollama is not running. Attempting to start Ollama...")
    if not _check_ollama_installed():
        _display_install_error()
        return False

    return _start_ollama_service(url)

def _check_ollama(url):
    try:
        r = httpx.get(url, timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False

def _check_ollama_installed():
    try:
        # Use shell=True for Windows
        subprocess.run(["ollama", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True, check=True)
        return True
    except Exception:
        return False

def _display_install_error():
    print("=" * 60)
    print("ERROR: Ollama is not installed or not in PATH.")
    print("DGMS Copilot uses Ollama for local, offline AI generation.")
    print("Please download and install it from: https://ollama.com/download")
    print("Once installed, pull the models using:")
    print("  ollama pull qwen3:8b")
    print("  ollama pull llama3.1:8b")
    print("=" * 60)

def _start_ollama_service(url):
    try:
        # Start ollama as a background process
        subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
        
        print("Waiting for Ollama to become responsive...")
        for _ in range(15):
            if _check_ollama(url):
                print("Ollama is now running and ready.")
                return True
            time.sleep(1)
            
        print("WARNING: Timed out waiting for Ollama to start. Backend will still launch but local AI models may fail.")
        return False
    except Exception as e:
        print(f"Failed to start Ollama automatically: {e}")
        return False

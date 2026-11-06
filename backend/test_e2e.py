import requests
import json
import time

def test_search():
    url = "http://127.0.0.1:8000/api/search"
    payload = {
        "query": "conveyor belt inspection",
        "n_results": 3
    }
    print(f"Testing {url} with {payload}...")
    try:
        res = requests.post(url, json=payload, timeout=30)
        res.raise_for_status()
        data = res.json()
        print(f"Results: {data['total']} found.")
        for r in data['results']:
            print(f" - [{r['score']}] {r['title']} ({r['id']})")
        return True
    except Exception as e:
        print(f"Search test failed: {e}")
        return False

def test_chat():
    url = "http://127.0.0.1:8000/api/chat"
    payload = {
        "question": "What is the speed limit for dumpers?",
        "n_results": 3
    }
    print(f"\nTesting {url}...")
    try:
        res = requests.post(url, json=payload, timeout=60)
        res.raise_for_status()
        data = res.json()
        print(f"Assistant replied: {data.get('answer', '')[:100]}...")
        return True
    except Exception as e:
        print(f"Chat test failed: {e}")
        return False

if __name__ == "__main__":
    s1 = test_search()
    s2 = test_chat()
    if s1 and s2:
        print("\nEnd-to-End Search/Chat Tests Passed!")
        exit(0)
    else:
        print("\nSome tests failed.")
        exit(1)

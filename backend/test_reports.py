import os
import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/reports"
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "documents", "reports")

def wait_for_server():
    print("Waiting for server to start...")
    for _ in range(30):
        try:
            res = requests.get("http://127.0.0.1:8000/api/status")
            if res.status_code == 200:
                print("Server is up!")
                return True
        except:
            pass
        time.sleep(2)
    return False

def test_reports():
    if not wait_for_server():
        print("Error: Server did not start.")
        return False
        
    reports = os.listdir(REPORTS_DIR)
    reports = [r for r in reports if r.endswith(".txt")]
    
    if not reports:
        print("No reports found!")
        return False
        
    all_passed = True
        
    for report in reports:
        print(f"\n--- Testing Report: {report} ---")
        file_path = os.path.join(REPORTS_DIR, report)
        
        # Test analyze
        try:
            with open(file_path, "rb") as f:
                files = {"file": (report, f, "text/plain")}
                res = requests.post(f"{BASE_URL}/analyze", files=files, timeout=60)
                
            if res.status_code == 200:
                data = res.json()
                print(f"[OK] Analyze: status={data.get('compliance_data', {}).get('compliance_status')}")
            else:
                print(f"[ERROR] Analyze failed: {res.status_code} - {res.text}")
                all_passed = False
                continue
                
            # Test export
            res_export = requests.get(f"{BASE_URL}/export/{report}")
            if res_export.status_code == 200 and res_export.headers.get("content-type") == "application/pdf":
                print(f"[OK] Export: PDF generated successfully ({len(res_export.content)} bytes).")
            else:
                print(f"[ERROR] Export failed: {res_export.status_code} - {res_export.text}")
                all_passed = False
        except Exception as e:
            print(f"[ERROR] Exception during test of {report}: {e}")
            all_passed = False
            

    return all_passed

if __name__ == "__main__":
    success = test_reports()
    if not success:
        print("\nSome tests failed!")
        exit(1)
    else:
        print("\nAll tests passed successfully!")
        exit(0)

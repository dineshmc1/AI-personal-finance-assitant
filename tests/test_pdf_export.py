import requests
import os

BASE_URL = "http://localhost:8000"

def test_pdf_export():
    print("Testing PDF Export Endpoint...")
    # This requires a valid token since it uses get_current_user_id
    # For local test, if user can provide a token from their console:
    token = os.getenv("FIREBASE_TOKEN", "REPLACE_WITH_VALID_TOKEN")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{BASE_URL}/reports/export/pdf", headers=headers)
    
    if response.status_code == 200:
        content_type = response.headers.get("Content-Type")
        print(f"Success! Status Code: {response.status_code}")
        print(f"Content-Type: {content_type}")
        
        # Check PDF signature
        if response.content.startswith(b"%PDF-"):
            print("Verified: Response is a valid PDF file.")
            with open("test_report.pdf", "wb") as f:
                f.write(response.content)
            print("Saved test_report.pdf for manual inspection.")
        else:
            print("Error: Response does not start with %PDF-")
    else:
        print(f"Failed! Status Code: {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    print("Note: This test requires a valid FIREBASE_TOKEN environment variable.")
    # test_pdf_export()

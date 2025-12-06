# AI workshop 2/generate_token.py
import requests
import json

API_KEY = "AIzaSyApQ49azMFO7_Oa6W_y4UDOln_hPZeSTWU" 
EMAIL = "test@example.com"
PASSWORD = "testPassword"

auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"

payload = {
    "email": EMAIL,
    "password": PASSWORD,
    "returnSecureToken": True
}

try:
    response = requests.post(auth_url, data=payload)
    response.raise_for_status() 
    
    data = response.json()
    id_token = data.get('idToken')
    
    if id_token:
        print("✅ SUCCESS! Your test ID Token is:")
        print(id_token)
        print(f"\nYour UID is: {data.get('localId')}")
    else:
        print("❌ Error: ID Token not found in response.")

except requests.exceptions.HTTPError as err:
    print(f"❌ HTTP Error: {err}")
    print(f"Error Response: {response.text}")
except Exception as e:
    print(f"❌ An error occurred: {e}")
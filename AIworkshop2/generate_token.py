# AI workshop 2/generate_token.py
import requests
import os
from dotenv import load_dotenv 

load_dotenv()

API_KEY = os.getenv("FIREBASE_API_KEY")
EMAIL = os.getenv("TEST_USER_EMAIL")
PASSWORD = os.getenv("TEST_USER_PASSWORD")

if not API_KEY or not EMAIL or not PASSWORD:
    raise ValueError("❌ 错误: 缺少必要的环境变量。请检查 .env 文件。")

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
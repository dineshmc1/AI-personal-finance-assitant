# AI workshop 2/generate_token.py
import requests
import os
from dotenv import load_dotenv # 引入 dotenv

# 1. 加载 .env 文件
load_dotenv()

# 2. 从环境变量读取 (如果没有读到，可以设置抛出错误或默认值)
API_KEY = os.getenv("FIREBASE_API_KEY")
EMAIL = os.getenv("TEST_USER_EMAIL")
PASSWORD = os.getenv("TEST_USER_PASSWORD")

# 检查是否成功加载 (可选，但推荐)
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
    # 打印错误时小心不要打印出包含密码的 payload
    print(f"Error Response: {response.text}")
except Exception as e:
    print(f"❌ An error occurred: {e}")
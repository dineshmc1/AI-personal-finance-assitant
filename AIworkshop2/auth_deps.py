# AI workshop 2/auth_deps.py
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated
from firebase_admin import auth
import firebase_admin


security = HTTPBearer()


def get_current_user_id(credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]) -> str:
    """
    Authenticates user using Firebase ID Token and returns the user's UID.
    
    NOTE: This dependency is placed in a separate file (auth_deps.py) to prevent 
    circular dependency issues between main.py and accounts.py.
    
    It relies on the Firebase Admin SDK being initialized in main.py.
    """
    token = credentials.credentials
    try:
        if not firebase_admin._apps:
             raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase Admin SDK not initialized."
            )

        decoded_token = auth.verify_id_token(token, clock_skew_seconds=5)
        user_id = decoded_token['uid']
        return user_id
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
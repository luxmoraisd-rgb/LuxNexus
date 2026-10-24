
import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

try:
    from django.conf import settings
    MONGODB_URI = getattr(settings, "MONGODB_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017/"))
    MONGODB_NAME = getattr(settings, "MONGODB_DATABASE", os.getenv("MONGODB_DATABASE", "nexusapp"))
except Exception:
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
    MONGODB_NAME = os.getenv("MONGODB_DATABASE", os.getenv("MONGODB_NAME", "nexusapp"))

client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client[MONGODB_NAME]

def test_connection():
    try:
        client.admin.command("ping")
        print("MongoDB connected successfully!")
        print(f"Database: {db.name}")
    except Exception as error:
        print(f"MongoDB connection failed: {error}")


import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
rows = client.table("market_data").select("*").order("fetched_at", desc=True).limit(3).execute()

print("--- Live Records in Supabase ---")
for r in rows.data:
    print(f"Metal: {r['metal']} | Price: Rs {r['price_inr']} | MA15: Rs {r['ma15']} | Fetched: {r['fetched_at']}")

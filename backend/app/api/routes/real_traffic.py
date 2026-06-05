import os
import json
from typing import List, Dict, Any
from fastapi import APIRouter
from redis import Redis

router = APIRouter(prefix="/real-traffic", tags=["Real Traffic Lights"])

@router.get("/status", response_model=List[Dict[str, Any]])
def get_real_traffic_status():
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    
    try:
        r = Redis(host=redis_host, port=redis_port, decode_responses=True)
        keys = r.keys("vroom:intersection:*")
        
        status_list = []
        for key in keys:
            data = r.get(key)
            if data:
                status_list.append(json.loads(data))
                
        # Default fallback so the UI always shows our Hasselt XL intersections even if they are currently offline
        active_ids = {item["intersection_id"] for item in status_list}
        for default_id in ["hasselt-xl-a", "hasselt-xl-b"]:
            if default_id not in active_ids:
                status_list.append({
                    "intersection_id": default_id,
                    "active_phase": "ALL_RED",
                    "health_status": "offline",
                    "seq": 0,
                    "timestamp_ms": 0,
                    "last_seen_ms": 0,
                    "latency_ms": 0,
                    "status": "Offline"
                })
                
        return status_list
    except Exception as e:
        # Graceful fallback in case Redis is not reachable during testing
        return [
            {
                "intersection_id": "hasselt-xl-a",
                "active_phase": "ALL_RED",
                "health_status": "offline (no cache connection)",
                "seq": 0,
                "timestamp_ms": 0,
                "last_seen_ms": 0,
                "latency_ms": 0,
                "status": "Offline"
            },
            {
                "intersection_id": "hasselt-xl-b",
                "active_phase": "ALL_RED",
                "health_status": "offline (no cache connection)",
                "seq": 0,
                "timestamp_ms": 0,
                "last_seen_ms": 0,
                "latency_ms": 0,
                "status": "Offline"
            }
        ]

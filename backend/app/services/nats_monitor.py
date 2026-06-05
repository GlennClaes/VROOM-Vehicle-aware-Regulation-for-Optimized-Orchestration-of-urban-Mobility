import os
import time
import asyncio
import json
import logging
import nats
from redis import Redis

# Suppress internal NATS client traceback spam on connection failures
logging.getLogger("nats").setLevel(logging.CRITICAL)

class NatsMonitorService:
    def __init__(self):
        self.nats_url = os.getenv("VROOM_NATS_URL", "nats://localhost:4222")
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.nc = None
        self.redis = None
        self.is_running = False

    async def start(self):
        self.is_running = True
        self.redis = Redis(host=self.redis_host, port=self.redis_port, decode_responses=True)
        print(f"[NatsMonitor] Connected to Redis at {self.redis_host}:{self.redis_port}")
        
        self.task = asyncio.create_task(self._monitor_loop())

    async def stop(self):
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        if self.nc:
            await self.nc.close()
            print("[NatsMonitor] Closed NATS connection")

    async def _monitor_loop(self):
        while self.is_running:
            try:
                print(f"[NatsMonitor] Connecting to NATS at {self.nats_url}...", flush=True)
                self.nc = await nats.connect(self.nats_url)
                print("[NatsMonitor] Successfully connected to NATS!", flush=True)

                # Subscribe to all intersection heartbeat messages
                sub = await self.nc.subscribe("vroom.intersections.*.heartbeat")
                print("[NatsMonitor] Subscribed to vroom.intersections.*.heartbeat", flush=True)

                async for msg in sub.messages:
                    if not self.is_running:
                        break
                    try:
                        payload = msg.data.decode("utf-8")
                        # Protocol: VROOM|VERSION|TYPE|SENDER|SEQ|TIMESTAMP|PHASE|HEALTH|TTL
                        fields = payload.split("|")
                        if len(fields) >= 8 and fields[0] == "VROOM":
                            msg_type = fields[2]
                            intersection_id = fields[3]
                            seq = int(fields[4])
                            timestamp_ms = int(fields[5])
                            active_phase = fields[6]
                            health_status = fields[7]

                            now_ms = int(time.time() * 1000)
                            latency_ms = max(0, now_ms - timestamp_ms)

                            telemetry = {
                                "intersection_id": intersection_id,
                                "active_phase": active_phase,
                                "health_status": health_status,
                                "seq": seq,
                                "timestamp_ms": timestamp_ms,
                                "last_seen_ms": now_ms,
                                "latency_ms": latency_ms,
                                "status": "Online"
                            }

                            # Save to Redis with 10 seconds expiration (if heartbeats stop, state goes Offline)
                            redis_key = f"vroom:intersection:{intersection_id}"
                            self.redis.set(redis_key, json.dumps(telemetry), ex=10)
                    except Exception as e:
                        print(f"[NatsMonitor] Error parsing message: {e}", flush=True)

            except Exception as e:
                print(f"[NatsMonitor] Connection error: {e}. Reconnecting in 5s...", flush=True)
                await asyncio.sleep(5)

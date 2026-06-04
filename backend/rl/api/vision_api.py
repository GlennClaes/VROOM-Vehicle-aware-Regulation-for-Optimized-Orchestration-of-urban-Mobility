from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
import asyncio
import httpx
import os
import logging
from ..vision.vision_service import vision_service

router = APIRouter(prefix="/vision", tags=["Vision"])
logger = logging.getLogger("uvicorn.error")

SUMO_WEB3D_URL = os.environ.get("SUMO_WEB3D_URL", "http://sumo-web3d:5000")


@router.get("/camera/stream")
async def camera_stream(
    camera_id: str = Query("global", description="Camera view: global | north | south | east | west")
):
    """
    MJPEG stream showing real SUMO vehicle positions on an accurate top-down
    map of the Hasselt XL intersection. YOLO annotates vehicles in real time.
    """
    async def frame_generator():
        logger.info(f"[Vision] Camera stream connected: camera_id={camera_id}")
        async with httpx.AsyncClient(timeout=httpx.Timeout(2.0)) as client:
            while True:
                try:
                    # Fetch both endpoints in parallel
                    vehicles_resp, queue_resp = await asyncio.gather(
                        client.get(f"{SUMO_WEB3D_URL}/vehicles"),
                        client.get(f"{SUMO_WEB3D_URL}/queue-data"),
                        return_exceptions=True
                    )

                    vehicles_data = {}
                    queue_data    = {}

                    if isinstance(vehicles_resp, httpx.Response) and vehicles_resp.status_code == 200:
                        vehicles_data = vehicles_resp.json()
                    elif isinstance(vehicles_resp, Exception):
                        logger.warning(f"[Vision] /vehicles error: {vehicles_resp}")

                    if isinstance(queue_resp, httpx.Response) and queue_resp.status_code == 200:
                        queue_data = queue_resp.json()
                    elif isinstance(queue_resp, Exception):
                        logger.warning(f"[Vision] /queue-data error: {queue_resp}")

                    # Generate the camera frame
                    count, jpg = vision_service.generate_camera_view(
                        camera_id=camera_id,
                        vehicles_data=vehicles_data,
                        queue_data=queue_data,
                    )

                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + jpg + b'\r\n')

                except Exception as e:
                    logger.error(f"[Vision] Frame error: {e}")
                    # Generate idle frame so stream doesn't break
                    _, jpg = vision_service.generate_camera_view(camera_id=camera_id)
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + jpg + b'\r\n')

                await asyncio.sleep(0.25)  # ~4 FPS

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )

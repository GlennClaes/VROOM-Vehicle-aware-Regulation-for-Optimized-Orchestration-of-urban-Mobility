#!/bin/bash
echo "🔌 Attaching sh session to frontend container..."
docker compose exec frontend /bin/sh

#!/bin/bash
echo "🔌 Attaching bash session to backend container..."
docker compose exec backend /bin/bash

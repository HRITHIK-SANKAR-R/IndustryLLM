#!/usr/bin/env bash
# Integration test for docker-compose.yml: brings up the full stack, verifies
# all 4 services are healthy, runs the Playwright click-through e2e test
# against the containerized frontend/backend, then tears down.
#
# Usage: ./scripts/compose-smoke-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() {
  echo "--- tearing down ---"
  docker-compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "--- building images ---"
docker-compose build

echo "--- starting stack ---"
docker-compose up -d

wait_for() {
  local name="$1" url="$2" tries=30
  for ((i = 1; i <= tries; i++)); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo 000)
    if [ "$code" = "200" ]; then
      echo "  $name: OK ($url)"
      return 0
    fi
    sleep 2
  done
  echo "  $name: FAILED to become healthy at $url (last code: $code)"
  return 1
}

echo "--- waiting for services ---"
wait_for backend  http://localhost:8080/api/v1/health
wait_for worker   http://localhost:8000/health
wait_for frontend http://localhost:3000
wait_for neo4j    http://localhost:7474

echo "--- backend/worker health payloads ---"
curl -s localhost:8080/api/v1/health; echo
curl -s localhost:8000/health; echo

echo "--- running e2e click-through test against the containerized stack ---"
(cd frontend && bun run test:e2e)

echo "--- SMOKE TEST PASSED ---"

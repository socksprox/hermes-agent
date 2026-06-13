#!/usr/bin/env bash
# Rebuild hermes-agent:local from the repo and recreate the local test container.
#
# Usage:
#   scripts/docker-rebuild-local.sh          # build + recreate + wait for dashboard
#   scripts/docker-rebuild-local.sh --no-wait # skip dashboard health poll
#
# Override defaults with env vars:
#   HERMES_DOCKER_CONTAINER   container name (default: hermes-test)
#   HERMES_DOCKER_IMAGE       image tag      (default: hermes-agent:local)
#   HERMES_DOCKER_DATA_DIR    host data dir  (default: ~/.hermes-docker)
#   HERMES_DOCKER_PORTS       host ports     (default: 8642:8642,9119:9119)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONTAINER_NAME="${HERMES_DOCKER_CONTAINER:-hermes-test}"
IMAGE_TAG="${HERMES_DOCKER_IMAGE:-hermes-agent:local}"
DATA_DIR="${HERMES_DOCKER_DATA_DIR:-$HOME/.hermes-docker}"
PORT_ARGS="${HERMES_DOCKER_PORTS:-8642:8642,9119:9119}"
WAIT_FOR_DASHBOARD=1

for arg in "$@"; do
  case "$arg" in
    --no-wait) WAIT_FOR_DASHBOARD=0 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$DATA_DIR"

env_file="$(mktemp)"
cleanup() {
  rm -f "$env_file"
}
trap cleanup EXIT

set_default_env() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" "$env_file" 2>/dev/null; then
    printf '%s=%s\n' "$key" "$value" >>"$env_file"
  fi
}

if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Capturing env from existing container: $CONTAINER_NAME"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER_NAME" \
    | grep -E '^(HERMES_|PUID|PGID)=' >>"$env_file" || true
fi

set_default_env HERMES_UID "$(id -u)"
set_default_env HERMES_GID "$(id -g)"
set_default_env HERMES_DASHBOARD "1"
set_default_env HERMES_DASHBOARD_BASIC_AUTH_USERNAME "admin"
set_default_env HERMES_DASHBOARD_BASIC_AUTH_PASSWORD "hermes-test"
if ! grep -q '^HERMES_DASHBOARD_BASIC_AUTH_SECRET=' "$env_file" 2>/dev/null; then
  set_default_env HERMES_DASHBOARD_BASIC_AUTH_SECRET "$(openssl rand -hex 16)"
fi

echo "Building $IMAGE_TAG from $REPO_ROOT ..."
docker build -t "$IMAGE_TAG" "$REPO_ROOT"

echo "Recreating $CONTAINER_NAME ..."
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

run_args=(
  run -d
  --name "$CONTAINER_NAME"
  --shm-size=1g
  -v "${DATA_DIR}:/opt/data"
  --env-file "$env_file"
)

IFS=',' read -r -a port_pairs <<<"$PORT_ARGS"
for pair in "${port_pairs[@]}"; do
  run_args+=(-p "$pair")
done

run_args+=("$IMAGE_TAG" gateway run)
docker "${run_args[@]}"

echo "Container started: $CONTAINER_NAME"
echo "Data volume: $DATA_DIR -> /opt/data"
echo "Dashboard: http://127.0.0.1:9119"
echo "Logs: docker logs -f $CONTAINER_NAME"

if [ "$WAIT_FOR_DASHBOARD" -eq 1 ] && grep -q '^HERMES_DASHBOARD=1' "$env_file"; then
  echo "Waiting for dashboard ..."
  for _ in $(seq 1 24); do
    code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9119/ 2>/dev/null || true)"
    if [ "$code" = "302" ] || [ "$code" = "200" ]; then
      echo "Dashboard ready (HTTP $code)."
      exit 0
    fi
    sleep 5
  done
  echo "Dashboard did not respond within 120s — check: docker logs $CONTAINER_NAME" >&2
  exit 1
fi

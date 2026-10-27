# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS web
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public/app ./public/app
RUN npm run build

FROM python:3.13-slim-bookworm AS dependencies
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
ENV UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
RUN git config --global url."ssh://git@github.com/recnepspencer/CleanForce".insteadOf "https://github.com/recnepspencer/CleanForce"
RUN --mount=type=secret,id=cleanforce_key,required=true \
    --mount=type=secret,id=github_known_hosts,required=true \
    GIT_SSH_COMMAND="ssh -i /run/secrets/cleanforce_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/run/secrets/github_known_hosts" \
    uv sync --locked --no-dev

FROM python:3.13-slim-bookworm AS application
ARG RELEASE_SHA
LABEL org.opencontainers.image.revision=$RELEASE_SHA
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 nelson && useradd --uid 10001 --gid nelson --no-create-home nelson
COPY --from=dependencies /app/backend/.venv /app/backend/.venv
COPY backend /app/backend
COPY --from=web /build/dist /app/web
ENV PATH="/app/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app/backend
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 \
    CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/healthz', timeout=3)"
CMD ["gunicorn", "config.wsgi:application", "--bind=0.0.0.0:8000", "--workers=2", "--threads=2", "--timeout=60", "--access-logfile=-", "--error-logfile=-"]

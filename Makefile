.PHONY: up up-build down logs install dev build test e2e verify

install:
	npm install

up:
	docker compose up -d

up-build:
	docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

dev:
	npm run dev

build:
	npm run build

test:
	npm test

e2e:
	./scripts/run-e2e-loop.sh

verify: e2e test

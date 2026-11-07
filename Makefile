.PHONY: up up-build down logs install dev build test e2e verify food-import

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
	npm run e2e

food-import:
	@test -n "$(CSV)" || (echo "Usage: make food-import CSV=/path/to/recipes.csv" >&2; exit 1)
	npm run food:import-recipes -- $(CSV)

verify: e2e test

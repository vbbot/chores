.PHONY: up down logs verify test e2e

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

test:
	docker compose up -d
	docker compose exec -T backend pytest -q

e2e:
	./scripts/run-e2e-loop.sh

verify:
	./scripts/run-e2e-loop.sh
	docker compose exec -T backend pytest -q

seed-demo:
	docker compose exec -T server python -c "from seeds.demo_users import run; print(run())"

seed-historical:
	docker compose exec -T server python -c "from scripts.seed_historical_data import run; run()"

up:
	docker compose up -d --build

down:
	docker compose down


DC      := docker compose
DC_PROD := docker compose -f docker-compose.prod.yml

.PHONY: help \
        up down build logs ps shell \
        prod-up prod-down prod-build prod-logs \
        db-migrate db-studio \
        clean clean-volumes

# ── default ───────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── dev ───────────────────────────────────────────────────────────────────────

up: ## Start dev stack (postgres + redis + rabbitmq + app with hot reload)
	$(DC) up -d

down: ## Stop dev stack
	$(DC) down

build: ## Rebuild dev app image
	$(DC) build app

logs: ## Follow all dev logs (Ctrl-C to exit)
	$(DC) logs -f

logs-app: ## Follow app logs only
	$(DC) logs -f app

ps: ## List running containers
	$(DC) ps

shell: ## Open a shell inside the dev app container
	$(DC) exec app sh

db-migrate: ## Run Drizzle migrations inside the dev app container
	$(DC) exec app pnpm db:migrate

db-studio: ## Open Drizzle Studio (runs on host, connects via mapped port)
	pnpm db:studio

# ── prod ──────────────────────────────────────────────────────────────────────

prod-up: ## Start production stack
	$(DC_PROD) up -d

prod-down: ## Stop production stack
	$(DC_PROD) down

prod-build: ## Build production app image
	$(DC_PROD) build app

prod-logs: ## Follow all production logs
	$(DC_PROD) logs -f

prod-shell: ## Open a shell inside the production app container
	$(DC_PROD) exec app sh

prod-db-migrate: ## Run Drizzle migrations in the production container
	$(DC_PROD) exec app node dist/infrastructure/db/migrate.js

# ── cleanup ───────────────────────────────────────────────────────────────────

clean: ## Remove containers and images (keeps volumes)
	$(DC) down --rmi local

clean-volumes: ## Remove containers, images, AND named volumes (destructive)
	$(DC) down --rmi local --volumes

# Infrastructure Setup Checklist

## ✅ Completed Setup

### 1. Docker Compose Configuration

- Created `docker-compose.yml` with PostgreSQL, Redis, and RabbitMQ services
- All three services are now containerized and can be managed via Docker Compose

### 2. Services Status

Currently running and accessible:

| Service                    | Host      | Port  | Status     | Details                                                         |
| -------------------------- | --------- | ----- | ---------- | --------------------------------------------------------------- |
| **PostgreSQL**             | localhost | 5432  | ✅ Running | Credentials in `.env`: `postgres:postgres`, DB: `tte_ecommerce` |
| **Redis**                  | localhost | 6379  | ✅ Running | Ready for caching and session management                        |
| **RabbitMQ**               | localhost | 5672  | ✅ Running | AMQP protocol for event messaging                               |
| **RabbitMQ Management UI** | localhost | 15672 | ✅ Running | Web dashboard for monitoring (guest/guest)                      |

### 3. Environment Configuration

Your `.env` file is already configured with correct URLs:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tte_ecommerce
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
```

---

## ⚙️ What You Need To Do From Your Side

### 1. **Install Node Dependencies** (if not already done)

```bash
npm install
# or
pnpm install
```

### 2. **Run Database Migrations**

Before starting the server, initialize the database schema:

```bash
npm run db:migrate
```

This will:

- Create all database tables based on your Drizzle schema
- Set up relationships and indexes
- Initialize the outbox for event sourcing

### 3. **Start the Development Server**

```bash
npm run dev
```

This starts the Express server with hot-reload via `tsx watch`

### 4. **Optional: View Database in Drizzle Studio**

```bash
npm run db:studio
```

Opens an interactive database explorer at `http://localhost:3000/studio`

### 5. **Access RabbitMQ Management Console**

Visit: `http://localhost:15672`

- Username: `guest`
- Password: `guest`

---

## 📋 Additional Information

### Useful Docker Commands

**Start services:**

```bash
docker compose up -d
```

**Stop services:**

```bash
docker compose down
```

**View logs:**

```bash
docker compose logs -f rabbitmq  # Follow RabbitMQ logs
docker compose logs -f postgres   # Follow PostgreSQL logs
docker compose logs -f redis      # Follow Redis logs
```

**Restart a service:**

```bash
docker compose restart postgres
```

### Database Connection Verification

To verify PostgreSQL is working:

```bash
docker compose exec postgres psql -U postgres -d tte_ecommerce -c "\dt"
```

### Redis Connection Verification

To verify Redis is working:

```bash
docker compose exec redis redis-cli ping
```

### RabbitMQ Connection Verification

```bash
docker compose exec rabbitmq rabbitmq-diagnostics -q ping
```

---

## 🚀 Quick Start Summary

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run migrations:**

   ```bash
   npm run db:migrate
   ```

3. **Start development server:**

   ```bash
   npm run dev
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

The server will be available at `http://localhost:3000`

---

## 📝 Notes

- All three services (PostgreSQL, Redis, RabbitMQ) are containerized via Docker
- Your JWT secrets in `.env` need to be changed before production
- The event bus is configured to use the outbox pattern for reliability
- Rate limiting is configured at 120 requests per 60 seconds per IP

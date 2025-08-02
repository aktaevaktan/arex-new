# Topex Logistics - Панель Администратора

Безопасная административная панель для Topex Logistics, построенная на Next.js с JWT аутентификацией, базой данных PostgreSQL и интеграцией с Google Таблицами.

## Возможности

✅ **Система Аутентификации**

- JWT аутентификация с токенами доступа и обновления
- Безопасное хранение в cookies
- Автоматическое обновление токенов
- Защищенные маршруты с middleware

✅ **Панель Администратора**

- Выбор листов Google Таблиц
- Функция обновления данных
- Система рассылки сообщений
- Безопасный выход из системы

✅ **Интеграция с Базой Данных**

- База данных PostgreSQL с Prisma ORM
- Система управления пользователями
- Безопасное хеширование паролей с bcrypt

✅ **Интеграция с Google Таблицами**

- Автоматическое получение информации о таблицах
- Загрузка данных из выбранных листов
- Отображение данных в удобном формате
- Поддержка множественных листов

## Начало Работы

### Требования

- Node.js 18+
- База данных PostgreSQL (настроена с Neon)
- Google Service Account для доступа к Google Таблицам

### Установка

1. Клонируйте репозиторий:

```bash
git clone <repository-url>
cd topex-bot
```

2. Установите зависимости:

```bash
npm install
```

3. Настройте базу данных:

```bash
# Генерация Prisma клиента
npx prisma generate

# Запуск миграций базы данных
npx prisma migrate dev

# Заполнение базы данных администратором
npm run db:seed
```

4. Запустите сервер разработки:

```bash
npm run dev
```

5. Откройте [http://localhost:3000](http://localhost:3000) в браузере

## Данные для Входа по Умолчанию

- **Email**: `admin@topex.com`
- **Пароль**: `admin123`

## Environment Variables

The following environment variables are configured in `.env`:

```env
# Database
DATABASE_URL="wfewfwefwefwefwe"

# JWT Secrets (change in production)
JWT_ACCESS_SECRET="your-super-secret-access-token-key-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-token-key-change-this-in-production"

# Next.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-change-this-in-production"
```

## Authentication Flow

### Token Management

- **Access Token**: 5-hour lifespan, stored in httpOnly cookies
- **Refresh Token**: 30-day lifespan, stored in httpOnly cookies
- **Automatic Refresh**: Middleware handles token refresh transparently

### Routes

- `/auth/login` - Login page
- `/crm/admin` - Protected admin dashboard
- `/api/auth/login` - Login API endpoint
- `/api/auth/refresh` - Token refresh endpoint
- `/api/auth/logout` - Logout API endpoint

## Project Structure

```
├── app/
│   ├── api/auth/          # Authentication API routes
│   ├── auth/login/        # Login page
│   ├── crm/admin/         # Admin dashboard
│   └── layout.tsx         # Root layout
├── lib/
│   ├── db.ts             # Prisma client
│   └── jwt.ts            # JWT utilities
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seeding
├── middleware.ts         # Authentication middleware
└── .env                  # Environment variables
```

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Separate access and refresh tokens
- **HttpOnly Cookies**: Prevents XSS attacks
- **CSRF Protection**: SameSite cookie attribute
- **Route Protection**: Middleware-based authentication
- **Automatic Logout**: On token expiration

## Future Enhancements

- Google Sheets API integration
- Email broadcasting system
- User role management
- Audit logging
- Multi-factor authentication

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database operations
npx prisma studio          # Database GUI
npx prisma migrate dev     # Create migration
npm run db:seed           # Seed database
```

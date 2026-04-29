# LuxeMart Backend API

## Security First
- Never commit `.env` to git.
- Use `.env.example` as template.
- Rotate all leaked credentials immediately if they were shared before.

## Environment Variables
```env
PORT=5000
NODE_ENV=production

# Choose one database strategy:
# 1) Current codebase (MongoDB)
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/luxemart

# 2) Planned migration target (Supabase)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRE=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

FRONTEND_URL=https://your-frontend-domain.com
```

## Run Locally
```bash
npm install
npm run dev
```

## Deploy on Vercel
1. Import repository into Vercel.
2. Set all environment variables in Vercel Project Settings.
3. Ensure `NODE_ENV=production`.
4. Set your frontend domain in `FRONTEND_URL`.

## Important Note About Supabase
Current backend logic is implemented using Mongoose models and MongoDB collections.
If you want full Supabase migration, we should replace models/controllers queries with Supabase client queries in a dedicated migration pass.
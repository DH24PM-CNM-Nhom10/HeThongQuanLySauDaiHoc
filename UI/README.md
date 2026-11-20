This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

The Next.js app serves database-backed API routes, including `/api/thong-bao`.
Configure its MySQL connection in `UI/.env.local` (this is separate from
`api/.env`):

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=quan_ly_dao_tao_sdh
```

You can use [`.env.example`](./.env.example) as a template. Set the values to
match your MySQL server and database, then restart the Next.js dev server so it
loads the configuration. Do not commit `.env.local`.

Admin and Training Office sign in at `http://localhost:3000/admin`. Admin opens
the dashboard there; Training Office is sent to `/assignment`. Students and
teachers use the shared portal and sign in at `http://localhost:3000/`.

New student accounts use the student code as the username and the
student's CMND/CCCD as the initial password. New teacher accounts use the
normalized name at `@teacher.agu.edu.vn` as the username and the teacher code
as the initial password. Both roles must change the initial password at
`/doi-mat-khau` before accessing their portal; new passwords must be 8–128
characters. Seeding does not reset credentials for accounts that already exist.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Mavis Student Dashboard

This project is a static student dashboard app that can be connected to a Supabase backend for persistent storage.

## 1) Add your Supabase values

Replace the placeholder values in `index.html` with your own project values:

```js
window.MAVIS_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

## 2) Supabase client setup

This app reads those values and creates the client automatically in `supabaseClient.js`:

The `supabaseClient.js` file will initialize the Supabase client using the configuration you provide in `index.html`.

## 3) Recommended tables

Create these tables in Supabase if needed:

- `courses`
- `tasks`
- `transactions`
- `board_settings`

Use proper date fields and separate time values so sorting works correctly.

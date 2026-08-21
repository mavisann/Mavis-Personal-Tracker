# Mavis - Personal Task Tracker

## 🌐 Live Demo

**Use the GitHub Pages version as the primary website:**

👉 **https://mavisann.github.io/Mavis-Personal-Tracker/**

This is the default go-to link for using Mavis. The GitHub repository contains the source code, while the live application is hosted through GitHub Pages.

## 📌 Description
Mavis (StudyBoard) is a comprehensive, plain JavaScript personal task tracker and student productivity dashboard. It provides a unified workspace for academic tasks, schedules, finances, and calendar management without requiring a frontend build framework.

The frontend is hosted on GitHub Pages, while authenticated API requests are handled by the deployed Node.js/Express backend on Render. The backend manages authentication and communicates with the PostgreSQL/Supabase database.

## ⚠️ Statement of the Problem
Students often struggle to balance academic responsibilities, personal tasks, and financial management. Existing tools are either too fragmented (requiring multiple apps for scheduling, budgeting, and task tracking), overly complex, or bloated with unnecessary features and subscriptions. Mavis solves this by providing a unified, lightweight, and customizable hub specifically tailored for a student's daily workflow.

## ✨ Features
*   **Unified Dashboard:** Get a quick glance at your finances, upcoming tasks (due within 3 days), and today's schedule timeline.
*   **Schedule Manager:** A visual weekly timetable for all your classes, supporting different modalities (On-Site, Online, Hybrid) and color-coding.
*   **Budget Tracker:** Monitor your income and expenses. View monthly comparisons, category breakdowns with pie charts, and annual cash flow line charts.
*   **Advanced Task Management:**
    *   Categorize tasks by Class, Event, or Personal.
    *   Set priorities, due dates, and specific task types (Assignment, Quiz, Exam, etc.).
    *   Multiple views: Kanban, Table (inline editing), Calendar, and Cards.
    *   Sort and filter tasks efficiently.
*   **General Calendar:** A full month view combining your class schedule and task deadlines, color-coded for quick visual reference.
*   **Cloud Sync:** User data is stored and synchronized through the application's authenticated backend and database.
*   **Customization:** Dark/Light mode toggle, customizable task categories, budget categories, and payment methods.
*   **Responsive Design:** Optimized for desktop, tablet, and small mobile screens.

## 🏗️ Deployment Architecture

```text
GitHub Pages
Frontend / UI
    │
    │ HTTPS API requests
    ▼
Render
Node.js + Express Backend
    │
    │ Authenticated database requests
    ▼
PostgreSQL / Supabase
```

- **Frontend:** GitHub Pages
- **Backend/API:** Render
- **Database:** PostgreSQL through Supabase
- **Authentication:** JWT-based sessions handled by the backend

## 🚶 Walkthroughs
1.  **Dashboard:** Upon opening the live site, you'll see the Money Monitor, Quick Tasks, and Today's Timeline.
2.  **Adding a Course:** Go to the **Schedule** tab, click **Add course**, fill in the details (name, code, time, days, color), and save. It will then appear on your weekly grid and daily timeline.
3.  **Managing Finances:** Navigate to the **Budget** tab. Click **Add** to log an income or expense. The charts and summaries will update automatically.
4.  **Tracking Tasks:** Open the **Tasks** tab. Use **+ Add** to create a new task. You can switch between Kanban, Table, Calendar, and Cards views.

## 🚀 Running the Website Locally

Since Mavis is built with plain JavaScript, there is no frontend build step.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mavisann/Mavis-Personal-Tracker.git
   cd Mavis-Personal-Tracker
   ```

2. **Run the frontend:**
   You can serve the project with VS Code Live Server or another simple static HTTP server. Opening `index.html` directly may also work for basic frontend testing, but an HTTP server is recommended.

3. **Backend configuration:**
   The frontend is configured to call the deployed Render API. For local backend development, configure the backend environment variables in `.env` and start the Node.js server with:
   ```bash
   node server.js
   ```

4. **Database:**
   The database schema is provided in `database.sql`. Use the SQL schema to create the required application tables in your PostgreSQL/Supabase project.

## 🔐 Authentication & Security

The browser does not access password hashes directly. Authentication is handled by the Express backend, which verifies passwords with bcrypt and issues signed JWTs for authenticated API requests.

For production deployment, keep secrets such as `JWT_SECRET` and `DATABASE_URL` in environment variables and never commit the `.env` file.

## 📁 Project Structure

```text
Mavis-Personal-Tracker/
├── index.html
├── login.html
├── app.js
├── styles.css
├── supabaseClient.js
├── server.js
├── database.sql
├── migration.sql
├── package.json
└── README.md
```

## 🔗 Links

- **Live Website:** https://mavisann.github.io/Mavis-Personal-Tracker/
- **GitHub Repository:** https://github.com/mavisann/Mavis-Personal-Tracker
- **Backend API:** https://mavis-personal-tracker.onrender.com

---

**Mavis — your personal study, task, schedule, and budget hub.**

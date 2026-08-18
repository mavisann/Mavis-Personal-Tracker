# Mavis - Personal Task Tracker

## 📌 Description
StudyBoard is a comprehensive, plain JavaScript personal task tracker and student productivity dashboard. Built without complex build steps or heavy frameworks, it offers a fast, reliable, and secure way to manage your academic life, finances, and daily schedule. It seamlessly integrates with Supabase for data persistence while ensuring no local storage vulnerabilities or forced authentication hurdles.

## ⚠️ Statement of the Problem
Students often struggle to balance academic responsibilities, personal tasks, and financial management. Existing tools are either too fragmented (requiring multiple apps for scheduling, budgeting, and task tracking), overly complex, or bloated with unnecessary features and subscriptions. StudyBoard solves this by providing a unified, lightweight, and customizable hub specifically tailored for a student's daily workflow.

## ✨ Features
*   **Unified Dashboard:** Get a quick glance at your finances, upcoming tasks (due within 3 days), and today's schedule timeline.
*   **Schedule Manager:** A visual weekly timetable for all your classes, supporting different modalities (On-Site, Online, Hybrid) and color-coding.
*   **Budget Tracker:** Monitor your income and expenses. View monthly comparisons, category breakdowns with pie charts, and annual cash flow line charts.
*   **Advanced Task Management:** 
    *   Categorize tasks by Class, Event, or Personal.
    *   Set priorities, due dates, and specific task types (Assignment, Quiz, Exam, etc.).
    *   Multiple views: Kanban board, Table (inline editing), Calendar, and Cards.
    *   Sort and filter tasks efficiently.
*   **General Calendar:** A full month view combining your class schedule and task deadlines, color-coded for quick visual reference.
*   **Cloud Sync:** Integrates with Supabase to keep your data synced across devices safely.
*   **Customization:** Dark/Light mode toggle, customizable task categories, budget categories, and payment methods.

## 🚶 Walkthroughs
1.  **Dashboard:** Upon opening, you'll see the Money Monitor, Quick Tasks, and Today's Timeline.
2.  **Adding a Course:** Go to the 'Schedule' tab, click 'Add course', fill in the details (name, code, time, days, color), and save. It will now appear on your weekly grid and daily timeline.
3.  **Managing Finances:** Navigate to the 'Budget' tab. Click 'Add' to log an income or expense. The charts and summaries will update automatically to reflect your new balance.
4.  **Tracking Tasks:** Open the 'Tasks' tab. Use the '+ Add' button to create a new task. You can switch between Kanban (drag-and-drop style organization), Table (for quick spreadsheet-like edits), or Calendar views using the toggles in the top right.

## 🚀 Instructions to Use the Website
Since StudyBoard is built with plain JavaScript, running it is incredibly simple:

1.  **Clone or Download:** Get the source code to your local machine.
2.  **Supabase Configuration (Optional but Recommended for Sync):**
    *   Create a Supabase project.
    *   Set up the required tables (`courses`, `tasks`, `transactions`, `board_settings`), just copy the sql query in `database.sql` for more accurate connection in the backend.
    *   In the `index.html` and `supabaseClient.js` file, *before* the main `app.js` script is loaded, configure the global variable:
        ```html
        <script>
          window.MAVIS_SUPABASE_CONFIG = {
            url: 'YOUR_SUPABASE_URL',
            anonKey: 'YOUR_SUPABASE_ANON_KEY'
          };
        </script>
        ```
3.  **Run the App:** Simply open the `index.html` file in any modern web browser. No `npm install` or local server is strictly necessary, though you can use a simple static server (like VS Code Live Server) for a better experience.
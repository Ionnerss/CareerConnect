# CareerConnect

## Project description

CareerConnect is a job search and application tracking platform designed to help 
users organize their job applications, track application progress, and improve
their job-search process.

## Identified problem

Job seekers often have difficulty keeping track of multiple job applications,
deadlines, interviews, and application statuses across different platforms.

## Proposed solution

CareerConnect provides a centralized platform where users can search for jobs,
save job postings, track applications, and monitor their progress throughout the
job-search process.

## Team members

* Catalin
* Matthew
* Daksikan
* Ray
* Yousef

## Technologies

CareerConnect will use **Next.js**, **TypeScript**, and **PostgreSQL through Supabase**. This stack supports frontend and backend development within one application, with a relational database for users, job postings, and applications.

| Category | Technology | Purpose |
| --- | --- | --- |
| Frontend and backend | Next.js / React | Build the user interface, API endpoints, and server-side application logic. |
| Programming language | TypeScript | Improve reliability and maintainability through type checking. |
| Database | PostgreSQL through Supabase | Store profiles, job postings, applications, and related data. |
| Authentication | Supabase Auth | Handle registration, login, and user sessions. |
| File storage | Supabase Storage | Store uploaded resumes with access controls. |
| Styling and components | Tailwind CSS / shadcn/ui | Build a consistent, responsive interface. |
| Input validation | Zod | Validate user input and server requests. |
| Testing | Vitest / Playwright | Test application logic and complete user workflows. |
| Version control and collaboration | Git / GitHub | Manage code, issues, branches, and pull requests. |
| Continuous integration | GitHub Actions | Automate builds, tests, and code checks. |
| Package management | npm | Manage dependencies and run project scripts. |

**AI integration:** An external AI API will support the required generative AI functionality. The provider and model are still to be selected.

## Git Workflow (Branches, User-Stories and Tasks)

- `main` — stable/production-ready code
- `dev` — integration branch for completed features
- Each team member works on their own personal/feature branch.
- Changes are committed and pushed to the personal/feature branch.
- A Pull Request (PR) is created from the personal/feature branch into `dev`.
- Team members review and test the PR before merging.
- `dev` is eventually merged into `main` when the release is ready.
---
- For each User-story, there will be a description and checkbox tasks associated with it.
- Each member will be assigned to tasks based on respective roles.
- When each task is done, the issue must be closed and the respective task must be checked in the user story.

## Setup instructions

1. Clone the repository and switch to the development branch:

   ```bash
   git clone https://github.com/Ionnerss/CareerConnect.git
   cd CareerConnect
   git switch dev
   ```

2. Enter the application directory and install dependencies:

   ```bash
   cd web
   npm ci
   ```

3. In the `web` folder, copy `.env.example` and name the copy `.env.local`.

4. Open `.env.local` and replace the placeholders with the team's Supabase project URL and publishable key:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```

   Ask a team member for the project connection details. Do not commit `.env.local` to Git.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Proposed features ([More info here](https://github.com/Ionnerss/CareerConnect/wiki))
* Skill gap map

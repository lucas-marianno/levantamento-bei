[Português](README.pt-BR.md)

# Collection survey of school libraries in São Bernardo do Campo

This project is a form used by the São Bernardo do Campo Municipal Education Department (*Secretaria de Educação*) to record the books available in municipal school libraries.

A school staff member identifies themselves, chooses their school, and reports how many books the school has in each library classification. The form also asks about books related to Indigenous and African themes, or whether the school has no books on that theme.

The goal is to give the Education Department a clear and consistent view of the book collections in each school. With that information, it can better plan support, resources, and actions for students and teachers.

This form was initially intended for use in a single collection period. It was not designed as a permanent system.

## Tech stack

- Frontend: plain HTML, CSS, and JavaScript modules, with no framework or build step.
- Backend: Supabase Edge Functions written in TypeScript.
- Data: a single Supabase Postgres table with row-level security enabled.
- Drafts: saved locally in the browser while a person fills out the form.
- Tests: Node's built-in test runner and Playwright browser tests.
- API requests: a small Bruno collection for calling the Edge Functions.

## Development constraints

The project was developed with limited resources and under a very strict deadline. No paid APIs or hosting were used, and only free tools were used throughout.

>[!NOTE]
>
> This project was authored by Lucas Mariano with heavy use of agentic coding to speed up development and make the project feasible within the deadline and resources available.

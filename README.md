# angmatura

Aplikacja webowa do ćwiczenia trzech typów zadań z matury rozszerzonej z angielskiego: Key Word Transformations,
gramatykalizacja, tłumaczenia. Mobile-first, bez logowania, anonimowe śledzenie postępu (Leitner/SRS), bulk-import
zestawów ze zdjęć przez Gemini.

Stack: SvelteKit (Svelte 5, runes), better-sqlite3, PM2 + Cloudflare Tunnel na Raspberry Pi.

## Szybki start

```sh
npm install
cp .env.example .env   # uzupełnij GEMINI_API_KEY, ADMIN_PASSWORD
npm run dev -- --open
```

## Testy

```sh
npm test        # albo: bun run test
```

Testy jednostkowe (Vitest, `*.test.ts` obok testowanego pliku). Używaj
`npm test` / `bun run test`, nie `bun test` — natywny runner Buna omija
`vite.config.ts` i nie rozwiązuje aliasu `$app/environment`, więc testy importujące `db.ts` wywalą się błędem
`Cannot find module`.

## Zmienne środowiskowe (`.env`)

| Zmienna          | Opis                                                                 |
|------------------|----------------------------------------------------------------------|
| `DATABASE_PATH`  | Ścieżka do pliku SQLite. Domyślnie `./data/worksheet.db`.            |
| `GEMINI_API_KEY` | Wymagane dla bulk-importu (`/create/ai`) i wyjaśnień w trybie Nauka. |
| `GEMINI_MODEL`   | Domyślnie `gemini-2.5-flash`.                                        |
| `ADMIN_PASSWORD` | Hasło do `/admin`.                                                   |

Zbudowany serwer (`build/index.js`) nie czyta `.env` automatycznie —
`npm run start` / `bun run start` robi to przez `--env-file-if-exists`. Przy innym sposobie uruchamiania (np. PM2 bez
`ecosystem.config.cjs`)
ustaw zmienne ręcznie.

## Struktura projektu

```
src/
  lib/
    types.ts                  — wspólne typy (Set, Question, CheckResult, ...)
    deviceId.ts                — anonimowe ID urządzenia (localStorage)
    components/                — QuestionCard, KwtQuestionEditor, ProgressBar, ...
    server/
      db.ts                    — leniwe otwieranie better-sqlite3 (Proxy)
      schema.ts                — CREATE TABLE ...
      answerUtils.ts           — sprawdzanie odpowiedzi + warianty (nawiasy)
      leitner.ts                — algorytm boxów Leitnera
      gemini.ts                 — bulk-import + explanation on-demand
      repo/                     — dostęp do danych (sets, questions, attempts, progress)
  routes/
    +page.svelte                       — strona główna
    set/[slug]/{study,exam}/           — tryby Nauka / Egzamin
    result/[attemptId]/                — wynik egzaminu
    review/                            — powtórki (SRS)
    create/ai/{,review}/               — bulk-import + edycja draftu
    edit/[slug]/                       — edycja / fork zestawu
    admin/                             — panel administratora
    api/questions/[id]/{check,hint}/   — sprawdzanie odpowiedzi, podpowiedzi
    api/ai-generate-set/               — Gemini bulk-import
    api/review/                        — pytania "na teraz" dla danego device'a
scripts/
  setup.sh              — pierwsza konfiguracja na Raspberry Pi
  deploy.sh             — kolejne wdrożenia (git pull + testy + build + pm2 restart)
```

## Deploy (RPi, PM2 + Cloudflare Tunnel)

1. Uzupełnij `deploy.config.yaml` (nazwa tunelu, hostname, katalog).
2. `scripts/setup.sh` — jednorazowo: instaluje Buna/PM2, kopiuje `.env.example`, testuje, buduje i startuje appkę pod
   PM2.
3. `scripts/deploy.sh` — przy każdej aktualizacji: `git pull`, testy, build,
   `pm2 restart`.
4. Cloudflare Tunnel kieruj na `http://localhost:3000` (albo port z `.env`/`PORT`).

## Uwagi

- **Bez kont użytkowników.** Personalizacja (SRS, bank błędów) opiera się o losowe `device_id` w `localStorage`.
  Prywatne zestawy są dostępne wyłącznie przez znajomość ich sluga.
- **Fork na `/edit/[slug]`.** Edycja publicznego zestawu tworzy prywatną kopię pod nowym slugiem; oryginał nigdy nie
  jest modyfikowany.
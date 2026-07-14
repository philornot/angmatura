# AngMatura — matura-prep app

Aplikacja webowa do ćwiczenia trzech typów zadań z matury rozszerzonej z
angielskiego: Key Word Transformations, gramatykalizacja i tłumaczenia.
Mobile-first, bez logowania, z anonimowym śledzeniem postępu (Leitner/SRS) i
bulk-importem zestawów ze zdjęć przez Gemini.

Zbudowane zgodnie z pierwotną specyfikacją: SvelteKit (Svelte 5, runes),
better-sqlite3, PM2 + Cloudflare Tunnel na Raspberry Pi.

## Szybki start (dev)

```sh
npm install          # albo: bun install
cp .env.example .env # i uzupełnij GEMINI_API_KEY + ADMIN_PASSWORD
npm run dev -- --open
```

Baza SQLite (`data/worksheet.db`) tworzy się sama przy pierwszym żądaniu —
nie trzeba nic migrować ręcznie.

### O Bunie

Kod jest kompatybilny z Bunem (`bun install`, `bun run dev`, `bun run build`)
zgodnie z pierwotnym stackiem. To środowisko developerskie miało dostęp
tylko do Node/npm, więc cały projekt został zbudowany i przetestowany pod
Node 22 — przed pierwszym prawdziwym deployem na Pi warto:

```sh
bun install
bun run build
bun run start   # albo uruchom build/index.js pod Node, patrz ecosystem.config.cjs
```

`better-sqlite3` to natywny addon; w razie problemów ze skompilowanym
bindingiem pod Bunem na ARM64, najprostszy fallback to uruchamianie
zbudowanego serwera (`build/index.js`) pod zwykłym Node (tak jak domyślnie
skonfigurowano w `ecosystem.config.cjs`), zostawiając Buna tylko jako
package manager przy `bun install`/`bun run build`.

## Zmienne środowiskowe (`.env`)

| Zmienna | Opis |
|---|---|
| `DATABASE_PATH` | Ścieżka do pliku SQLite. Domyślnie `./data/worksheet.db`. |
| `GEMINI_API_KEY` | Wymagane dla `/create/ai` (bulk-import ze zdjęć) i wyjaśnień w trybie Nauka. Klucz z aistudio.google.com/apikey. |
| `GEMINI_MODEL` | Domyślnie `gemini-2.5-flash`. |
| `ADMIN_PASSWORD` | Hasło do `/admin`. Ustaw coś unikalnego przed deployem. |

Zbudowany serwer (`build/index.js`) **nie** czyta `.env` automatycznie —
`npm run start` / `bun run start` robi to za Ciebie przez `--env-file-if-exists`.
Jeśli odpalasz `build/index.js` inaczej (np. bezpośrednio przez PM2 bez
`ecosystem.config.cjs`), upewnij się, że zmienne środowiskowe są ustawione.

## Struktura projektu

```
src/
  lib/
    types.ts                  — wspólne typy (Set, Question, CheckResult, ...)
    deviceId.ts                — anonimowe ID urządzenia (localStorage)
    components/
      QuestionCard.svelte      — karta pytania (tryb Nauka + Powtórki)
      KwtQuestionEditor.svelte — edytor pojedynczego pytania (AI review + edit)
      ProgressBar, SetTypeBadge, StatusIcon, StampBadge
    server/
      db.ts                    — leniwe otwieranie better-sqlite3 (Proxy)
      schema.ts                — CREATE TABLE ...
      answerUtils.ts           — sprawdzanie odpowiedzi + warianty (nawiasy)
      leitner.ts                — algorytm boxów Leitnera
      gemini.ts                 — bulk-import + explanation on-demand
      repo/                     — dostęp do danych (sets, questions, attempts, progress)
  routes/
    +page.svelte                       — strona główna (lista zestawów + CTA powtórek)
    set/[slug]/                        — ekran startowy zestawu (wybór trybu)
    set/[slug]/study/                  — tryb Nauka
    set/[slug]/exam/                   — tryb Egzamin
    result/[attemptId]/                — wynik egzaminu
    review/                            — powtórki (SRS), pytania z różnych zestawów
    create/ai/                        — upload zrzutów ekranu
    create/ai/review/                  — edycja wygenerowanego draftu przed zapisem
    edit/[slug]/                       — edycja / fork zestawu
    admin/                             — panel administratora
    api/questions/[id]/check/          — sprawdzanie odpowiedzi (Study + Review)
    api/questions/[id]/hint/           — podpowiedź (nie wpływa na box)
    api/ai-generate-set/               — Gemini bulk-import
    api/review/                        — pytania "na teraz" dla danego device'a
scripts/
  setup.sh              — pierwsza konfiguracja na Raspberry Pi
  deploy.sh             — kolejne wdrożenia (git pull + build + pm2 restart)
  import-old-sets.mjs   — jednorazowy import sets-export.json ze starej wersji
```

## Import starych zestawów

```sh
node scripts/import-old-sets.mjs sciezka/do/sets-export.json
```

Skrypt akceptuje zarówno camelCase, jak i snake_case w polach pliku (na
wypadek, gdyby `sets-export.json` był surowym dumpem `SELECT *` ze starej
bazy). Nowe kolumny (`explanation`, `grammar_tags`) zostają puste — można je
uzupełnić ręcznie albo pozwolić aplikacji wygenerować `explanation`
on-demand przy pierwszym rozwiązaniu pytania w trybie Nauka.

## Deploy (Raspberry Pi, PM2 + Cloudflare Tunnel)

1. Uzupełnij `deploy.config.yaml` (nazwa tunelu, hostname, katalog).
2. `scripts/setup.sh` — jednorazowo: instaluje Buna/PM2, kopiuje `.env.example`,
   buduje i startuje appkę pod PM2.
3. `scripts/deploy.sh` — przy każdej kolejnej aktualizacji: `git pull`, build,
   `pm2 restart`.
4. Cloudflare Tunnel kieruj na `http://localhost:3000` (albo port z `.env`/`PORT`).

## Uwagi projektowe

- **Bez kont użytkowników.** Cała personalizacja (SRS, bank błędów) opiera
  się o losowe `device_id` w `localStorage`, wysyłane przy każdym sprawdzeniu
  odpowiedzi. Zestawy prywatne (np. świeżo zaimportowane przez AI albo
  forki) są dostępne wyłącznie przez znajomość ich (nieodgadywalnego) sluga —
  to jedyny "zamek" w systemie, celowo, zgodnie ze specyfikacją.
- **Fork na `/edit/[slug]`.** Wejście w edycję publicznego zestawu tworzy od
  razu prywatną kopię pod nowym slugiem i przekierowuje tam — oryginał nigdy
  nie jest modyfikowany w miejscu.
- **Tryb Egzamin nigdy nie dotyka `question_progress`.** Presja czasu na
  egzaminie nie powinna psuć harmonogramu powtórek.
- **Timer w trybie Egzamin** to lekki, czysto kliencki licznik z sugerowanym
  czasem per typ zadania (schemat bazy z oryginalnej specyfikacji nie ma
  kolumny na czas per zestaw) — widoczny, ale w pełni pomijalny (przycisk ×).

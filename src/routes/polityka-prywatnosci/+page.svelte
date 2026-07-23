<svelte:head>
    <title>Polityka prywatności: angmatura</title>
</svelte:head>

<div class="container page">
    <h1>Polityka prywatności</h1>
    <p class="updated">Ostatnia aktualizacja: 23 lipca 2026</p>

    <section>
        <h2>1. Postanowienia ogólne</h2>
        <p>
            Niniejsza polityka prywatności dotyczy aplikacji angmatura, dostępnej pod adresem tej
            strony internetowej (dalej: "Strona"). Strona jest darmowym narzędziem do ćwiczenia zadań
            maturalnych z języka angielskiego i jest prowadzona przez osobę prywatną. Strona nie
            wymaga zakładania konta ani podawania danych osobowych, takich jak imię, nazwisko czy
            adres e-mail.
        </p>
    </section>

    <section>
        <h2>2. Jakie dane są przetwarzane</h2>
        <p>
            Przy pierwszej wizycie w przeglądarce Strona zapisuje losowy identyfikator urządzenia
            (<code>device_id</code>), przechowywany w <code>localStorage</code> oraz w jednym pliku
            cookie o tej samej wartości. Identyfikator ten:
        </p>
        <ul>
            <li>nie zawiera żadnych danych osobowych i jest generowany losowo;</li>
            <li>
                służy wyłącznie do zapamiętania postępów w nauce (system powtórek, historia
                rozwiązanych zadań) oraz zestawów utworzonych przez użytkownika;
            </li>
            <li>jest niezbędny do działania tych funkcji: bez niego nie da się zapamiętać postępu.</li>
        </ul>
        <p>
            Strona nie korzysta z narzędzi analitycznych ani reklamowych firm trzecich (np. Google
            Analytics, Facebook Pixel). Strona nie profiluje użytkowników i nie sprzedaje żadnych
            danych.
        </p>
    </section>

    <section>
        <h2>3. Cookie techniczne</h2>
        <p>
            Jedyny plik cookie ustawiany przez Stronę przechowuje wspomniany identyfikator
            urządzenia. Jest to cookie niezbędne do działania podstawowej funkcji serwisu (zapamiętanie
            postępu w nauce), dlatego zgodnie z przepisami o ochronie prywatności nie wymaga on
            odrębnej zgody. Wystarczy poinformowanie o jego stosowaniu, co niniejszy dokument czyni.
        </p>
    </section>

    <section>
        <h2>4. Gdzie przechowywane są dane</h2>
        <p>
            Dane (zestawy zadań, historia odpowiedzi powiązana z identyfikatorem urządzenia) są
            przechowywane w bazie danych na serwerze administrowanym przez prowadzącego Stronę.
            Strona nie korzysta z zewnętrznych chmur do przechowywania tych danych.
        </p>
    </section>

    <section>
        <h2>5. Usługi zewnętrzne</h2>
        <p>
            Funkcja automatycznego tworzenia zestawów ze zdjęć oraz wyjaśnień w trybie nauki korzysta z
            modelu AI Google Gemini. Przesyłane do niej treści (zdjęcia zadań, treści pytań) nie są
            powiązane z żadnymi danymi umożliwiającymi identyfikację osoby korzystającej ze Strony. Do
            tej usługi nie jest wysyłany identyfikator urządzenia ani żadne inne dane osobowe.
        </p>
    </section>

    <section>
        <h2>6. Prawa użytkownika</h2>
        <p>
            Ponieważ identyfikator urządzenia jest przechowywany lokalnie w przeglądarce użytkownika,
            w każdej chwili można go usunąć, czyszcząc dane Strony (localStorage i cookies) w
            ustawieniach przeglądarki. Spowoduje to utratę zapisanego postępu i utworzonych zestawów
            powiązanych z tym identyfikatorem.
        </p>
    </section>

    <section>
        <h2>7. Kontakt</h2>
        <p>
            Pytania dotyczące niniejszej polityki i/lub aplikacji można kierować na adres
            <a href="mailto:philornot3@gmail.com">philornot3@gmail.com</a>.
        </p>
    </section>
</div>

<style>
    .page {
        padding: 32px 20px 64px;
        max-width: 680px;
    }

    h1 {
        font-family: var(--font-display);
        font-size: 28px;
        color: var(--ink);
        margin: 0 0 4px;
    }

    .updated {
        font-size: 13px;
        color: var(--muted);
        margin: 0 0 32px;
    }

    section {
        margin-bottom: 28px;
    }

    h2 {
        font-family: var(--font-display);
        font-size: 18px;
        color: var(--ink);
        margin: 0 0 10px;
    }

    p,
    li {
        font-size: 15px;
        line-height: 1.6;
        color: var(--ink-soft);
    }

    ul {
        margin: 8px 0;
        padding-left: 20px;
    }

    li {
        margin-bottom: 6px;
    }

    code {
        font-family: var(--font-mono);
        font-size: 0.9em;
        background: var(--surface-soft);
        padding: 1px 5px;
        border-radius: 4px;
    }
</style>
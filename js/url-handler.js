/**
 * URL Handler för quiz-länkning
 * Hanterar direktlänkar till quiz via URL-parametrar
 */
class URLHandler {
    constructor(app) {
        this.app = app;
        this.urlParams = new URLSearchParams(window.location.hash.substring(1));
    }

    /**
     * Hämta quiz-parameter från URL
     */
    getQuizFromURL() {
        return this.urlParams.get('quiz');
    }

    /**
     * Starta quiz baserat på URL-parameter
     */
    async handleURLQuiz() {
        const quizParam = this.getQuizFromURL();
        if (!quizParam) {
            this.app.showView('home');
            return;
        }

        console.log(`Försöker starta quiz från URL: ${quizParam}`);

        // Kolla om det är settings
        if (quizParam === 'settings') {
            this.app.showView('settings');
            return;
        }

        // Kolla om det är "fler-quiz"
        if (quizParam === 'fler-quiz') {
            this.app.showView('fler-quiz');
            return;
        }

        // Kolla om det är "blandad"
        if (quizParam === 'blandad') {
            this.app.selectCategory('blandad');
            return;
        }

        // Först kolla standardkategorier
        if (await this.tryStandardCategory(quizParam)) {
            return;
        }

        // Sedan kolla dynamiska kategorier
        if (await this.tryDynamicCategory(quizParam)) {
            return;
        }

        // Quiz hittades inte
        console.log(`Quiz "${quizParam}" hittades inte`);
        this.app.showView('home');
    }

    /**
     * Försök starta standardkategori
     */
    async tryStandardCategory(quizParam) {
        const standardCategories = {
            'sport': 'sport',
            'musik': 'musik',
            'geografi': 'geografi',
            'film': 'film',
            'teknik': 'teknik',
            'allmanbildning': 'allmanbildning',
            'blandad': 'blandad'
        };

        const normalizedParam = this.normalizeQuizKey(quizParam);
        
        if (standardCategories[normalizedParam]) {
            this.app.selectCategory(standardCategories[normalizedParam]);
            return true;
        }

        return false;
    }

    /**
     * Försök starta dynamisk kategori från "Fler Quiz"
     */
    async tryDynamicCategory(quizParam) {
        // Kontrollera att AVAILABLE_QUIZ finns (från quiz-links.js)
        if (typeof AVAILABLE_QUIZ === 'undefined') {
            console.error('AVAILABLE_QUIZ inte laddad. Kontrollera att quiz-links.js är inkluderad.');
            return false;
        }

        const normalizedParam = this.normalizeQuizKey(quizParam);
        const quiz = AVAILABLE_QUIZ.find(q => q.key === normalizedParam);
        
        if (!quiz) {
            return false;
        }

        try {
            // Ladda CSV-fil
            console.log(`Laddar quiz: ${quiz.name} från ${quiz.file}`);
            const response = await fetch(`data/kategori/${quiz.file}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const csvText = await response.text();
            const questions = this.app.parseCSV(csvText);

            if (questions.length === 0) {
                throw new Error('Inga giltiga frågor hittades i CSV-filen');
            }

            // Starta quiz
            this.startDynamicQuiz(quiz, questions);
            return true;

        } catch (error) {
            console.error(`Kunde inte ladda quiz "${quiz.name}":`, error);
            return false;
        }
    }

    /**
     * Starta dynamiskt quiz med laddade frågor
     */
    startDynamicQuiz(quiz, questions) {
        // Använd samma logik som app.js selectDynamicCategory
        this.app.selectedCategory = quiz.key;
        this.app.shuffledQuestions = this.app.shuffleArray(questions);
        this.app.currentQuestionIndex = 0;
        this.app.showAnswer = this.app.settings.alwaysShowAnswer;
        this.app.selectedAnswer = null;

        // Reset score
        this.app.resetScore();

        // Update UI
        document.getElementById('category-title').textContent = quiz.name;
        this.app.showView('quiz');
        this.app.loadCurrentQuestion(true);

        console.log(`Quiz "${quiz.name}" startad med ${questions.length} frågor`);
    }

    /**
     * Normalisera quiz-nyckel för URL-kompatibilitet
     */
    normalizeQuizKey(input) {
        return input
            .toLowerCase()
            .replace(/å/g, 'a')
            .replace(/ä/g, 'a')
            .replace(/ö/g, 'o')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * Uppdatera URL utan att ladda om sidan (för framtida funktioner)
     */
    updateURL(quizKey) {
        const newURL = `${window.location.pathname}#quiz=${quizKey}`;
        history.pushState({ quiz: quizKey }, '', newURL);
    }

    /**
     * Rensa URL-parametrar (tillbaka till startsidan)
     */
    clearURL() {
        const newURL = window.location.pathname;
        history.pushState({}, '', newURL);
    }

    /**
     * Hantera browser back/forward (för framtida funktioner)
     */
    setupPopstateHandler() {
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.quiz) {
                this.handleURLQuiz();
            } else {
                this.app.showView('home');
            }
        });

        // Hantera hash-ändringar också
        window.addEventListener('hashchange', () => {
            this.handleURLQuiz();
        });
    }
}

// Exportera för användning i andra moduler
if (typeof module !== 'undefined' && module.exports) {
    module.exports = URLHandler;
}

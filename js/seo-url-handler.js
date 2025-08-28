/**
 * SEO-optimerad URL Handler för Quizla
 * Använder riktiga URL:er (/quiz/disney) istället för hash (#quiz=Disney)
 * Kompatibel med Umami Analytics och SEO
 */
class SEOURLHandler {
    constructor(app) {
        this.app = app;
        this.setupPopStateListener();
        this.setupInitialRoute();
        console.log('✅ SEO URL Handler initialiserad');
    }

    /**
     * Hantera initial routing när sidan laddas
     */
    setupInitialRoute() {
        const path = window.location.pathname;
        const searchParams = new URLSearchParams(window.location.search);
        
        if (path === '/' || path === '') {
            // Kolla om det finns quiz-parameter i URL
            const quizParam = searchParams.get('quiz');
            if (quizParam) {
                console.log('🔄 Hittade quiz-parameter:', quizParam);
                this.handleQuizRoute(quizParam);
            }
            return;
        }

        // Hantera /quiz/[kategori] format
        if (path.startsWith('/quiz/')) {
            const category = path.substring(7); // Ta bort '/quiz/'
            this.handleQuizRoute(category);
        }
        // Hantera andra specialrutter
        else if (path === '/blanda') {
            this.app.selectCategory('blandad');
        }
        else if (path === '/fler-quiz') {
            this.app.showView('fler-quiz');
        }
        else if (path === '/installningar') {
            this.app.showView('settings');
        }
    }

    /**
     * Hantera quiz-rutter
     */
    async handleQuizRoute(categorySlug) {
        console.log(`🔄 Hanterar quiz-route: ${categorySlug}`);

        // Först kolla standardkategorier
        if (await this.tryStandardCategory(categorySlug)) {
            return;
        }

        // Sedan kolla dynamiska kategorier
        if (await this.tryDynamicCategory(categorySlug)) {
            return;
        }

        // Om inget hittades, gå tillbaka till hemsidan
        console.log(`❌ Quiz "${categorySlug}" hittades inte`);
        this.redirectToHome();
    }

    /**
     * Försök starta standardkategori
     */
    async tryStandardCategory(categorySlug) {
        const standardCategories = {
            'sport': 'sport',
            'musik': 'musik',
            'geografi': 'geografi',
            'film': 'film',
            'teknik': 'teknik',
            'allmanbildning': 'allmanbildning'
        };

        const normalizedSlug = this.normalizeCategorySlug(categorySlug);
        
        if (standardCategories[normalizedSlug]) {
            const categoryKey = standardCategories[normalizedSlug];
            console.log(`✅ Startar standardkategori: ${categoryKey}`);
            
            // Uppdatera meta-taggar för SEO
            this.updateCategoryMetaTags(categoryKey, this.getStandardCategoryName(categoryKey));
            
            // Starta quiz
            this.app.selectCategory(categoryKey);
            return true;
        }

        return false;
    }

    /**
     * Försök starta dynamisk kategori
     */
    async tryDynamicCategory(categorySlug) {
        if (typeof AVAILABLE_QUIZ === 'undefined') {
            console.error('AVAILABLE_QUIZ inte laddad');
            return false;
        }

        // Hitta kategori baserat på slug
        const quiz = AVAILABLE_QUIZ.find(q => {
            const quizSlug = this.generateCategorySlug(q.name);
            return quizSlug === categorySlug;
        });

        if (!quiz) {
            return false;
        }

        try {
            console.log(`🔄 Laddar dynamisk quiz: ${quiz.name}`);
            
            // Ladda CSV-fil
            const response = await fetch(`data/kategori/${quiz.file}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const csvText = await response.text();
            const questions = this.app.parseCSV(csvText);

            if (questions.length === 0) {
                throw new Error('Inga giltiga frågor hittades');
            }

            // Uppdatera meta-taggar för SEO
            this.updateCategoryMetaTags(quiz.key, quiz.name);

            // Starta quiz
            this.startDynamicQuiz(quiz, questions);
            return true;

        } catch (error) {
            console.error(`❌ Kunde inte ladda quiz "${quiz.name}":`, error);
            return false;
        }
    }

    /**
     * Starta dynamiskt quiz
     */
    startDynamicQuiz(quiz, questions) {
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

        console.log(`✅ Quiz "${quiz.name}" startad med ${questions.length} frågor`);
    }

    /**
     * Generera URL för kategori
     */
    generateCategoryURL(categoryName) {
        const slug = this.generateCategorySlug(categoryName);
        return `/quiz/${slug}`;
    }

    /**
     * Generera slug för kategori
     */
    generateCategorySlug(categoryName) {
        return categoryName.toLowerCase()
            .replace(/[åäö]/g, (match) => {
                return { 'å': 'a', 'ä': 'a', 'ö': 'o' }[match];
            })
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    /**
     * Normalisera slug för jämförelse
     */
    normalizeCategorySlug(slug) {
        return slug.toLowerCase()
            .replace(/[åäö]/g, (match) => {
                return { 'å': 'a', 'ä': 'a', 'ö': 'o' }[match];
            })
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * Uppdatera URL för kategori
     */
    updateCategoryURL(categoryName) {
        const newURL = this.generateCategoryURL(categoryName);
        
        // Uppdatera URL utan att ladda om sidan
        window.history.pushState({ 
            category: categoryName, 
            type: 'quiz' 
        }, '', newURL);

        // Spåra i Umami Analytics
        this.trackUmamiPageView(categoryName, newURL);

        console.log(`🔗 URL uppdaterad till: ${newURL}`);
    }

    /**
     * Uppdatera URL för specialrutter
     */
    updateSpecialRouteURL(route) {
        const newURL = `/${route}`;
        
        window.history.pushState({ 
            route: route, 
            type: 'special' 
        }, '', newURL);

        // Spåra i Umami Analytics
        this.trackUmamiPageView(route, newURL);

        console.log(`🔗 URL uppdaterad till: ${newURL}`);
    }

    /**
     * Uppdatera meta-taggar för SEO
     */
    updateCategoryMetaTags(categoryKey, categoryName) {
        const categoryData = this.getCategoryMetaData(categoryKey, categoryName);
        
        // Uppdatera sidtitel
        document.title = `${categoryData.title} | Quizla`;
        
        // Uppdatera meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = categoryData.description;
        
        // Uppdatera keywords
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (metaKeywords) metaKeywords.content = categoryData.keywords;
        
        // Uppdatera Open Graph
        let ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.content = categoryData.title;
        
        let ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.content = categoryData.description;
        
        // Uppdatera Twitter Cards
        let twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) twitterTitle.content = categoryData.title;
        
        let twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterDesc) twitterDesc.content = categoryData.description;
        
        console.log(`✅ Meta-taggar uppdaterade för: ${categoryName}`);
    }

    /**
     * Hämta meta-data för kategori
     */
    getCategoryMetaData(categoryKey, categoryName) {
        const metaData = {
            'allmanbildning': {
                title: 'Allmänbildning Quiz - Testa dina kunskaper',
                description: 'Spela gratis allmänbildningsquiz med hundratals frågor. Testa dina kunskaper inom historia, vetenskap, kultur och mycket mer.',
                keywords: 'allmänbildning, quiz, historia, vetenskap, kultur, gratis quiz, svenska quiz'
            },
            'musik': {
                title: 'Musik Quiz - Utmana dig själv inom musik',
                description: 'Musikquiz för alla! Testa dina kunskaper inom pop, rock, jazz, klassisk musik och mer. Gratis och offline.',
                keywords: 'musik, quiz, pop, rock, jazz, klassisk musik, gratis quiz, svenska musikquiz'
            },
            'geografi': {
                title: 'Geografi Quiz - Lär dig om världen',
                description: 'Utforska världen med vårt geografiquiz! Huvudstäder, länder, berg och hav. Perfekt för att lära sig geografi.',
                keywords: 'geografi, quiz, huvudstäder, länder, berg, hav, världen, gratis quiz'
            },
            'film': {
                title: 'Film & TV Quiz - Testa din filmkunskap',
                description: 'Film & TV-quiz för filmälskare! Frågor om Hollywood, svenska filmer, TV-serier och skådespelare.',
                keywords: 'film, tv, quiz, hollywood, svenska filmer, tv-serier, skådespelare, gratis quiz'
            },
            'sport': {
                title: 'Sport Quiz - Sportfrågor för alla',
                description: 'Sportquiz för alla idrottsintresserade! Fotboll, hockey, tennis, olympiska spel och mycket mer.',
                keywords: 'sport, quiz, fotboll, hockey, tennis, olympiska spel, gratis quiz, svenska sportquiz'
            },
            'teknik': {
                title: 'Teknik Quiz - Moderna teknikfrågor',
                description: 'Teknikquiz för dig som är intresserad av datorer, internet, AI och modern teknologi.',
                keywords: 'teknik, quiz, datorer, internet, ai, teknologi, gratis quiz, svenska teknikquiz'
            }
        };

        // Om det är en standardkategori
        if (metaData[categoryKey]) {
            return metaData[categoryKey];
        }

        // Om det är en dynamisk kategori, generera generisk data
        return {
            title: `${categoryName} Quiz - Testa dina kunskaper`,
            description: `Spela ${categoryName}-quiz och testa dina kunskaper. Gratis, offline och inga reklamer!`,
            keywords: `${categoryName.toLowerCase()}, quiz, gratis quiz, svenska quiz, offline`
        };
    }

    /**
     * Hämta standardkategorinamn
     */
    getStandardCategoryName(categoryKey) {
        const names = {
            'sport': 'Sport',
            'musik': 'Musik',
            'geografi': 'Geografi',
            'film': 'Film & TV',
            'teknik': 'Teknik',
            'allmanbildning': 'Allmänbildning'
        };
        return names[categoryKey] || categoryKey;
    }

    /**
     * Spåra sidvisning i Umami Analytics
     */
    trackUmamiPageView(categoryName, url) {
        if (typeof umami !== 'undefined') {
            // Spåra som en ny sidvisning
            umami.track('page_view', {
                category: categoryName,
                url: url,
                title: document.title,
                timestamp: new Date().toISOString()
            });
            
            console.log(`📊 Umami sidvisning spårad: ${categoryName} - ${url}`);
        }
    }

    /**
     * Hantera browser back/forward
     */
    setupPopStateListener() {
        window.addEventListener('popstate', (event) => {
            console.log('🔄 Popstate event:', event.state);
            
            if (event.state && event.state.category) {
                // Återställ quiz-state
                this.handleQuizRoute(this.generateCategorySlug(event.state.category));
            } else if (event.state && event.state.route) {
                // Återställ specialrutt
                this.handleSpecialRoute(event.state.route);
            } else {
                // Gå tillbaka till hemsidan
                this.app.showView('home');
                this.clearMetaTags();
            }
        });
    }

    /**
     * Hantera specialrutter
     */
    handleSpecialRoute(route) {
        switch (route) {
            case 'blanda':
                this.app.selectCategory('blandad');
                break;
            case 'fler-quiz':
                this.app.showView('fler-quiz');
                break;
            case 'installningar':
                this.app.showView('settings');
                break;
            default:
                this.app.showView('home');
        }
    }

    /**
     * Rensa meta-taggar (tillbaka till standard)
     */
    clearMetaTags() {
        // Återställ till standardtitel
        document.title = 'Quizla - Sveriges största Quiz, helt gratis!';
        
        // Återställ till standardbeskrivning
        const standardDesc = 'Quizla - Sveriges största quizplattform med tusentals gratis frågor inom allmänbildning, sport, musik, film och mycket mer. Spela offline, inga reklamer, helt gratis!';
        
        let metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = standardDesc;
        
        // Återställ Open Graph
        let ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.content = 'Quizla - Sveriges största Quiz, helt gratis!';
        
        let ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.content = 'Spela tusentals gratis quiz inom allmänbildning, sport, musik, film och mycket mer. Offline-läge, inga reklamer!';
        
        // Återställ Twitter Cards
        let twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) twitterTitle.content = 'Quizla - Sveriges största Quiz, helt gratis!';
        
        let twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterDesc) twitterDesc.content = 'Spela tusentals gratis quiz inom allmänbildning, sport, musik, film och mycket mer.';
        
        console.log('✅ Meta-taggar återställda till standard');
    }

    /**
     * Rensa URL (tillbaka till hemsidan)
     */
    clearURL() {
        window.history.pushState({}, '', '/');
        this.clearMetaTags();
        console.log('✅ URL rensad, återgår till hemsidan');
    }

    /**
     * Omdirigera till hemsidan
     */
    redirectToHome() {
        window.history.pushState({}, '', '/');
        this.app.showView('home');
        this.clearMetaTags();
    }
}

// Exportera för användning
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SEOURLHandler;
}

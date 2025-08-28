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
        
        console.log('🔄 setupInitialRoute - path:', path, 'searchParams:', searchParams.toString());
        
        if (path === '/' || path === '') {
            // Kolla om det finns quiz-parameter i URL
            const quizParam = searchParams.get('quiz');
            if (quizParam) {
                console.log('🔄 Hittade quiz-parameter:', quizParam);
                console.log('🔍 Väntar på att appen ska initieras...');
                // Vänta lite så att appen hinner initieras
                setTimeout(() => {
                    console.log('🎯 Startar quiz-routing för parameter:', quizParam);
                    this.handleQuizRoute(quizParam);
                }, 100);
            } else {
                console.log('🔍 Ingen quiz-parameter hittad');
                
                // Kolla om det finns en pending route från 404.html
                const pendingRoute = sessionStorage.getItem('pendingRoute');
                if (pendingRoute) {
                    console.log('🔄 Hittade pending route:', pendingRoute);
                    sessionStorage.removeItem('pendingRoute'); // Rensa efter användning
                    
                    // Vänta lite så att appen hinner initieras
                    setTimeout(() => {
                        this.handleSpecialRoute(pendingRoute);
                    }, 100);
                }
            }
            return;
        }

        // Hantera /quiz/[kategori] format
        if (path.startsWith('/quiz/')) {
            const category = path.substring(6); // Ta bort '/quiz/' (6 tecken, inte 7)
            console.log('🔄 Hanterar direkt quiz-path:', category);
            // Vänta lite så att appen hinner initieras
            setTimeout(() => {
                this.handleQuizRoute(category);
            }, 100);
        }
        // Hantera andra specialrutter
        else if (path === '/blanda') {
            setTimeout(() => {
                this.app.selectCategory('blandad');
            }, 100);
        }
        else if (path === '/fler-quiz') {
            setTimeout(() => {
                this.app.showView('fler-quiz');
            }, 100);
        }
        else if (path === '/installningar') {
            setTimeout(() => {
                this.app.showView('settings');
            }, 100);
        }
    }

    /**
     * Hantera quiz-rutter
     */
    async handleQuizRoute(categorySlug) {
        console.log(`🔄 Hanterar quiz-route: ${categorySlug}`);
        console.log('🔍 Kontrollerar om appen är redo...');
        console.log('🔍 this.app.categories:', this.app.categories);
        console.log('🔍 Object.keys(this.app.categories):', Object.keys(this.app.categories));

        // Vänta tills appen är redo
        let attempts = 0;
        while (!this.app.categories || Object.keys(this.app.categories).length === 0) {
            if (attempts > 50) { // Max 5 sekunder
                console.error('❌ Appen blev aldrig redo');
                return;
            }
            console.log(`⏳ Väntar... försök ${attempts + 1}/50`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        console.log('✅ Appen är redo, startar quiz-routing...');
        console.log('🔍 Tillgängliga kategorier:', Object.keys(this.app.categories));

        // Kontrollera om det är en kombinerad kategori (t.ex. disney-fotboll)
        if (categorySlug.includes('-')) {
            if (await this.tryMultiCategory(categorySlug)) {
                return;
            }
        }

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
        console.log('🔍 Kontrollerar standardkategorier för:', categorySlug);
        
        const standardCategories = {
            'sport': 'sport',
            'musik': 'musik',
            'geografi': 'geografi',
            'film': 'film',
            'teknik': 'teknik',
            'allmanbildning': 'allmanbildning'
        };

        const normalizedSlug = this.normalizeCategorySlug(categorySlug);
        console.log('🔍 Normaliserad slug:', normalizedSlug);
        console.log('🔍 Tillgängliga standardkategorier:', Object.keys(standardCategories));
        
        if (standardCategories[normalizedSlug]) {
            const categoryKey = standardCategories[normalizedSlug];
            console.log(`✅ Startar standardkategori: ${categoryKey}`);
            console.log('🔍 Kategori hittad i standardCategories');
            
            // Kontrollera att kategorin finns i appen
            console.log('🔍 Kontrollerar om kategorin finns i appen...');
            console.log('🔍 this.app.categories[categoryKey]:', this.app.categories[categoryKey]);
            
            if (!this.app.categories[categoryKey]) {
                console.error(`❌ Kategori ${categoryKey} finns inte i appen`);
                return false;
            }
            
            console.log('✅ Kategori finns i appen, uppdaterar meta-taggar...');
            
            // Uppdatera meta-taggar för SEO
            this.updateCategoryMetaTags(categoryKey, this.getStandardCategoryName(categoryKey));
            
            // Starta quiz
            console.log('🎯 Anropar app.selectCategory för:', categoryKey);
            console.log('🔍 app.selectCategory finns:', typeof this.app.selectCategory);
            
            if (typeof this.app.selectCategory === 'function') {
                console.log('✅ app.selectCategory är en funktion, anropar den...');
                this.app.selectCategory(categoryKey);
                return true;
            } else {
                console.error('❌ app.selectCategory är inte en funktion');
                return false;
            }
        }

        console.log('❌ Inga standardkategorier matchade');
        return false;
    }

    /**
     * Försök starta dynamisk kategori
     */
    async tryDynamicCategory(categorySlug) {
        console.log('🔍 Kontrollerar dynamiska kategorier för:', categorySlug);
        
        if (typeof AVAILABLE_QUIZ === 'undefined') {
            console.error('❌ AVAILABLE_QUIZ inte laddad');
            return false;
        }

        console.log('🔍 AVAILABLE_QUIZ innehåll:', AVAILABLE_QUIZ);

        // Hitta kategori baserat på slug
        const quiz = AVAILABLE_QUIZ.find(q => {
            const quizSlug = this.generateCategorySlug(q.name);
            console.log(`🔍 Jämför: "${quizSlug}" med "${categorySlug}"`);
            return quizSlug === categorySlug;
        });

        if (!quiz) {
            console.log('❌ Ingen dynamisk kategori matchade');
            return false;
        }

        console.log('✅ Hittade dynamisk kategori:', quiz);

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
            console.log('🎯 Startar dynamiskt quiz för:', quiz.name);
            console.log('🔍 startDynamicQuiz finns:', typeof this.startDynamicQuiz);
            
            if (typeof this.startDynamicQuiz === 'function') {
                this.startDynamicQuiz(quiz, questions);
                return true;
            } else {
                console.error('❌ startDynamicQuiz är inte en funktion');
                return false;
            }

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
        console.log('🔍 Genererar slug för:', categoryName);
        
        const slug = categoryName.toLowerCase()
            .replace(/[åäö]/g, (match) => {
                return { 'å': 'a', 'ä': 'a', 'ö': 'o' }[match];
            })
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
            
        console.log('🔍 Genererad slug:', slug);
        return slug;
    }

    /**
     * Normalisera slug för jämförelse
     */
    normalizeCategorySlug(slug) {
        console.log('🔍 Normaliserar slug:', slug);
        
        const normalized = slug.toLowerCase()
            .replace(/[åäö]/g, (match) => {
                return { 'å': 'a', 'ä': 'a', 'ö': 'o' }[match];
            })
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
            
        console.log('🔍 Normaliserad slug:', normalized);
        return normalized;
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
     * Uppdatera URL för flera kategorier (t.ex. disney-fotboll)
     */
    updateMultiCategoryURL(combinedKey, categoryNames) {
        const newURL = `/${combinedKey}`;
        
        window.history.pushState({ 
            categories: combinedKey, 
            categoryNames: categoryNames,
            type: 'multi-category' 
        }, '', newURL);

        // Spåra i Umami Analytics
        this.trackUmamiPageView(`multi-${combinedKey}`, newURL);

        console.log(`🔗 Multi-kategori URL uppdaterad till: ${newURL}`);
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
        
        let ogDesc = document.querySelector('meta[name="property="og:description"]');
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

    /**
     * Försök starta quiz med flera kategorier
     */
    async tryMultiCategory(combinedSlug) {
        console.log('🔍 Kontrollerar kombinerad kategori:', combinedSlug);
        
        if (typeof AVAILABLE_QUIZ === 'undefined') {
            console.error('❌ AVAILABLE_QUIZ inte laddad');
            return false;
        }

        // Dela upp slug:en i enskilda kategorier
        const categoryKeys = combinedSlug.split('-');
        console.log('🔍 Kategori-nycklar:', categoryKeys);

        // Kontrollera att alla kategorier finns
        const validCategories = [];
        for (const key of categoryKeys) {
            const category = AVAILABLE_QUIZ.find(q => q.key === key);
            if (category) {
                validCategories.push(category);
            } else {
                console.log(`❌ Kategori "${key}" hittades inte`);
                return false;
            }
        }

        if (validCategories.length < 2) {
            console.log('❌ Behöver minst 2 kategorier för kombinerat quiz');
            return false;
        }

        console.log('✅ Alla kategorier hittade, startar kombinerat quiz');

        try {
            // Ladda alla kategorier och kombinera frågor
            const allQuestions = [];
            for (const category of validCategories) {
                const response = await fetch(`data/kategori/${category.file}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const csvText = await response.text();
                const questions = this.app.parseCSV(csvText);
                
                // Lägg till kategori-information till varje fråga
                questions.forEach(q => {
                    q.category = category.key;
                    q.categoryName = category.name;
                });
                
                allQuestions.push(...questions);
            }

            if (allQuestions.length === 0) {
                throw new Error('Inga giltiga frågor hittades');
            }

            // Starta kombinerat quiz
            this.startMultiCategoryQuiz(validCategories, allQuestions);
            return true;

        } catch (error) {
            console.error(`❌ Kunde inte ladda kombinerat quiz:`, error);
            return false;
        }
    }

    /**
     * Starta quiz med flera kategorier
     */
    startMultiCategoryQuiz(categories, questions) {
        // Sätt valda kategorier
        this.app.selectedCategories = new Set(categories.map(c => c.key));
        
        // Blanda frågor och starta quiz
        this.app.shuffledQuestions = this.app.shuffleArray(questions);
        this.app.currentQuestionIndex = 0;
        this.app.showAnswer = this.app.settings.alwaysShowAnswer;
        this.app.selectedAnswer = null;

        // Reset score
        this.app.resetScore();

        // Uppdatera UI
        const categoryNames = categories.map(c => c.name).join(' + ');
        document.getElementById('category-title').textContent = categoryNames;
        
        // Visa quiz-vyn
        this.app.showView('quiz');
        this.app.loadCurrentQuestion(true);

        console.log(`✅ Kombinerat quiz startat med ${categories.length} kategorier och ${questions.length} frågor`);
    }
}

// Exportera för användning
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SEOURLHandler;
}

// Exportera för webbläsaren
if (typeof window !== 'undefined') {
    window.SEOURLHandler = SEOURLHandler;
}

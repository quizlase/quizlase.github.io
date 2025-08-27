// QuizApp - Main Application Class
class QuizApp {
    constructor() {
        console.log('=== KONSTRUKTOR STARTAR ===');
        this.currentView = 'home';
        this.previousView = 'home'; // NY: Kommer ihåg var man kom ifrån
        this.selectedCategory = null;
        this.currentQuestionIndex = 0;
        this.showAnswer = false;
        this.shuffledQuestions = [];
        this.selectedAnswer = null;
        this.answerOptions = [];
        this.categories = {};
        this.dynamicCategories = {}; // NY property för dynamiska kategorier
        this.allQuestions = [];
        
        // URL Handler för quiz-länkning
        this.urlHandler = null; // Initieras i init()
        
        // Settings
        this.settings = {
            autoAdvance: false,
            showHints: true,
            darkMode: true,
            soundEffects: false,
            alwaysShowAnswer: false,
            showMultipleChoice: true,
            scoreTracking: false,
            timer: true,
            timerDuration: 15,
            monochromeMode: false,
            highContrastMode: false,
            includeAllCategories: false
        };

        // Timer state
        this.timer = null;
        this.timerDuration = 15;
        this.timerProgress = 100;

        // Score tracking state
        this.currentScore = 0;
        this.totalQuestionsAnswered = 0;
        
        // Simple flag to prevent auto-advance after manual next
        this.manualNextClicked = false;
        
        // Store auto-advance timeout to cancel it when needed
        this.autoAdvanceTimeout = null;

        // Tracking-variabler för Umami Analytics
        this.homeViewStartTime = Date.now();
        this.questionsAnswered = 0;

        // Load settings from localStorage
        this.loadSettings();
        
        // Initialize timer setting visibility
        this.updateTimerSettingVisibility();
        
        // Initialize the app
        console.log('Anropar init()...');
        this.init().catch(error => {
            console.error('Init failed:', error);
        });
        console.log('=== KONSTRUKTOR KLAR ===');
    }

    async init() {
        try {
            console.log('=== INIT STARTAR ===');
            
            // Show loading screen
            this.updateLoadingProgress(0, 'Startar laddning av frågor...');
            
            // Phase 1: Ladda endast huvudkategorier (6 CSV-filer)
            await this.loadQuestions();
            console.log('loadQuestions klar');
            console.log('📊 Progress efter loadQuestions ska vara 100%');
            
            // Phase 2: Kort paus så användaren ser 100% innan sidan visas
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Rendera startsidan
            this.renderCategories();
            console.log('renderCategories klar');
            
            this.setupEventListeners();
            console.log('setupEventListeners klar');
            
            this.updateQuestionCount();
            this.updateCategoryStats();
            this.applySettings();
            
            // Nu döljs laddningsskärmen när progress är 100%
            console.log('Startsidan visas nu!');
            
            // Dölj laddningsskärmen manuellt
            this.hideLoadingScreen();
            
            // Phase 3: Ladda dynamiska kategorier i bakgrunden (non-blocking)
            this.loadDynamicCategoriesInBackground();
            
            // Phase 4: Initiera URL-handler och hantera URL-parameter för direktlänkning
            this.urlHandler = new URLHandler(this);
            await this.urlHandler.handleURLQuiz();
            
            // Aktivera browser back/forward hantering
            this.urlHandler.setupPopstateHandler();
            
            console.log('=== INIT KLAR ===');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.updateLoadingProgress(0, 'Fel vid laddning av appen');
        }
    }

    // Load questions from CSV files with parallel loading and caching
    async loadQuestions() {
        const csvFiles = [
            { file: 'data/allmanbildning.csv', key: 'allmanbildning', name: 'Allmänbildning', icon: 'book', color: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' },
            { file: 'data/musik.csv', key: 'musik', name: 'Musik', icon: 'music', color: 'linear-gradient(135deg, #ec4899 0%, #ef4444 100%)' },
            { file: 'data/geografi.csv', key: 'geografi', name: 'Geografi', icon: 'map', color: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)' },
            { file: 'data/film_tv.csv', key: 'film', name: 'Film & TV', icon: 'film', color: 'linear-gradient(135deg, #f97316 0%, #facc15 100%)' },
            { file: 'data/sport.csv', key: 'sport', name: 'Sport', icon: 'trophy', color: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' },
            { file: 'data/teknik.csv', key: 'teknik', name: 'Teknik', icon: 'computer', color: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }
        ];

        // Check cache first
        const cachedData = this.getCachedQuestions();
        if (cachedData && this.isCacheValid(cachedData.timestamp)) {
            console.log('✅ Using cached questions data');
            this.categories = cachedData.categories;
            this.allQuestions = cachedData.allQuestions;
            
            // Ensure blandad category exists in cache
            console.log('Cache: Checking if blandad category exists...');
            console.log('Cache: allQuestions length:', this.allQuestions.length);
            console.log('Cache: Sample question from allQuestions:', this.allQuestions[0]);
            
            if (!this.categories.blandad) {
                this.categories.blandad = {
                    name: 'Blanda',
                    icon: 'shuffle',
                    color: 'transparent',
                    questions: [...this.allQuestions]
                };
                console.log('✅ Skapade blandad-kategorin från cache');
            }
            
            console.log('Cache: Blandad category questions length:', this.categories.blandad.questions.length);
            console.log('Cache: Sample question from blandad:', this.categories.blandad.questions[0]);
            
            // Sätt progress till 100% när cache används
            console.log('📊 Cache: Sätter progress till 100%');
            this.updateLoadingProgress(100, 'Huvudkategorier laddade från cache');
            return;
        }

        // Parallel loading with progress tracking
        const totalFiles = csvFiles.length;
        let loadedFiles = 0;
        
        this.updateLoadingProgress(0, 'Startar laddning av frågor...');

        try {
            // Create all fetch promises
            const fetchPromises = csvFiles.map(async (categoryInfo) => {
                try {
                    const response = await fetch(categoryInfo.file);
                    if (!response.ok) {
                        throw new Error(`Failed to load ${categoryInfo.file}: ${response.status} ${response.statusText}`);
                    }
                    const csvText = await response.text();
                    const questions = this.parseCSV(csvText);
                    
                    // Update progress
                    loadedFiles++;
                    const progress = Math.round((loadedFiles / totalFiles) * 100);
                    this.updateLoadingProgress(progress, `Laddade ${categoryInfo.name} (${questions.length} frågor)`);
                    
                    return {
                        key: categoryInfo.key,
                        name: categoryInfo.name,
                        icon: categoryInfo.icon,
                        color: categoryInfo.color,
                        questions: questions
                    };
                } catch (error) {
                    console.error(`Error loading ${categoryInfo.file}:`, error);
                    // Return fallback data
                    return {
                        key: categoryInfo.key,
                        name: categoryInfo.name,
                        icon: categoryInfo.icon,
                        color: categoryInfo.color,
                        questions: []
                    };
                }
            });

            // Wait for all promises to resolve
            const results = await Promise.all(fetchPromises);
            
            // Process results
            results.forEach(result => {
                // Lägg till category property till varje fråga
                const questionsWithCategory = result.questions.map(q => ({
                    ...q,
                    category: result.key,
                    categoryName: result.name
                }));
                
                this.categories[result.key] = {
                    name: result.name,
                    icon: result.icon,
                    color: result.color,
                    questions: questionsWithCategory
                };
                this.allQuestions.push(...questionsWithCategory);
            });

            // Cache the results
            this.cacheQuestions();
            
            console.log(`Total questions loaded: ${this.allQuestions.length}`);
            console.log('Categories:', Object.keys(this.categories));

            // Add mixed category
            console.log('Creating blandad category with questions:', this.allQuestions.length);
            console.log('Sample question from allQuestions:', this.allQuestions[0]);
            
            this.categories.blandad = {
                name: 'Blanda',
                icon: 'shuffle',
                color: 'transparent',
                questions: [...this.allQuestions]
            };
            
            console.log('Blandad category created with questions:', this.categories.blandad.questions.length);
            console.log('Sample question from blandad:', this.categories.blandad.questions[0]);

            // Uppdatera blandad-kategorin direkt efter att den skapats
            this.updateBlandaCategory();

            console.log('📊 CSV: Sätter progress till 100%');
            this.updateLoadingProgress(100, 'Huvudkategorier laddade!');
            
        } catch (error) {
            console.error('Error during parallel loading:', error);
            this.updateLoadingProgress(0, 'Fel vid laddning av frågor');
        }
    }

    // Cache management methods
    getCachedQuestions() {
        try {
            const cached = localStorage.getItem('quizQuestionsCache');
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Error reading cache:', error);
            return null;
        }
    }

    isCacheValid(timestamp) {
        const now = Date.now();
        const cacheAge = now - timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        return cacheAge < maxAge;
    }

    cacheQuestions() {
        try {
            const cacheData = {
                categories: this.categories,
                allQuestions: this.allQuestions,
                timestamp: Date.now()
            };
            localStorage.setItem('quizQuestionsCache', JSON.stringify(cacheData));
            console.log('✅ Questions cached successfully');
        } catch (error) {
            console.error('Error caching questions:', error);
        }
    }

    // Loading progress management
    updateLoadingProgress(progress, message) {
        const progressBar = document.getElementById('loading-progress');
        
        if (progressBar) {
            // Säkerställ att progress bar går hela vägen till 100%
            const clampedProgress = Math.min(Math.max(progress, 0), 100);
            progressBar.style.width = `${clampedProgress}%`;
            
            console.log(`📊 Progress uppdaterad: ${progress}% → ${clampedProgress}% (${message})`);
            
            // Låt inte progress bar automatiskt dölja laddningsskärmen
            // Laddningsskärmen döljs manuellt i init() metoden
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            // Lägg till 200ms fördröjning så allt hinner laddas ordentligt
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 200);
            }, 200);
        }
    }

    // ===== DYNAMISKA KATEGORIER =====
    
    // Skanna data/kategori/ mappen  för CSV-filer automatiskt
    async scanCategoryFolder() {
        try {
            console.log('=== scanCategoryFolder startar ===');
            
            // Försök läsa från index.json först
            try {
                console.log('Läser från index.json...');
                const indexResponse = await fetch('data/kategori/index.json');
                if (indexResponse.ok) {
                    const index = await indexResponse.json();
                    console.log(`✅ Läs index.json: ${index.csvFiles.length} filer hittade`);
                    console.log('Filer från index:', index.csvFiles);
                    return index.csvFiles;
                }
            } catch (error) {
                console.log('Kunde inte läsa index.json, använder fallback:', error.message);
            }
            
            // Fallback: Använd en fördefinierad lista + testa vanliga namn
            console.log('Använder fallback-lista...');
            const fallbackFiles = [
                'Star Wars.csv', 'Fotboll.csv', 'Jul.csv', 'Harry Potter.csv',
                'Dans.csv', 'Motor.csv', 'Sagan om Ringen.csv', 'Sex & City.csv',
                'Netflix.csv', 'Cocktails.csv', 'Rymden.csv', 'Andra världskriget.csv',
                'Flaggor.csv', 'Mat.csv', 'Kungligheter.csv' // Lägg till nya filer här
            ];
            
            // Testa också vanliga kategorinamn som kan finnas
            const commonNames = [
                'Film.csv', 'Musik.csv', 'Historia.csv', 'Geografi.csv', 'Sport.csv',
                'Teknik.csv', 'Konst.csv', 'Litteratur.csv', 'Vetenskap.csv', 'Natur.csv'
            ];
            
            const allPossibleFiles = [...fallbackFiles, ...commonNames];
            const foundFiles = [];
            
            // Testa varje fil från listan
            for (const filename of allPossibleFiles) {
                try {
                    const response = await fetch(`data/kategori/${filename}`);
                    if (response.ok) {
                        foundFiles.push(filename);
                        console.log(`✓ Hittade: ${filename}`);
                    }
                } catch (error) {
                    // Filen finns inte, ignorera
                }
            }
            
            console.log('Hittade filer (fallback):', foundFiles);
            console.log('=== scanCategoryFolder klar ===');
            return foundFiles;
            
        } catch (error) {
            console.log('Kunde inte skanna kategori-mappen:', error);
            return [];
        }
    }

    // Ladda alla dynamiska kategorier från AVAILABLE_QUIZ (genererad av GitHub Actions)
    async loadDynamicCategories() {
        try {
            console.log('=== loadDynamicCategories startar ===');
            
            // Kontrollera att quiz-links.js är laddad
            if (typeof AVAILABLE_QUIZ === 'undefined') {
                console.log('AVAILABLE_QUIZ inte tillgänglig - inga extra quiz att ladda');
                this.dynamicCategories = {};
                return;
            }

            console.log(`Hittade ${AVAILABLE_QUIZ.length} dynamiska kategorier från quiz-links.js`);

            // Skapa dynamiska kategorier från listan och ladda frågorna
            const loadPromises = AVAILABLE_QUIZ.map(async (quiz) => {
                try {
                    const response = await fetch(`data/kategori/${quiz.file}`);
                    const csvText = await response.text();
                    const questions = this.parseCSV(csvText);
                    
                    return {
                        key: quiz.key,
                        name: quiz.name,
                        file: `data/kategori/${quiz.file}`,
                        questions: questions,
                        questionCount: questions.length,
                        icon: this.getAutoIcon(quiz.name),
                        color: this.getAutoColor(quiz.key)
                    };
                } catch (error) {
                    console.error(`Kunde inte ladda ${quiz.file}:`, error);
                    return {
                        key: quiz.key,
                        name: quiz.name,
                        file: `data/kategori/${quiz.file}`,
                        questions: [],
                        questionCount: 0,
                        icon: this.getAutoIcon(quiz.name),
                        color: this.getAutoColor(quiz.key)
                    };
                }
            });

            // Vänta på att alla quiz laddas
            const results = await Promise.all(loadPromises);
            
            // Skapa dynamiska kategorier
            results.forEach(result => {
                this.dynamicCategories[result.key] = result;
            });

            console.log(`Laddade ${AVAILABLE_QUIZ.length} dynamiska kategorier med frågor`);
            
            // Uppdatera "Blanda"-kategorin baserat på inställningen
            this.updateBlandaCategory();
            
        } catch (error) {
            console.error('Fel vid laddning av dynamiska kategorier:', error);
            this.dynamicCategories = {};
        }
    }

    // Phase 3: Ladda dynamiska kategorier i bakgrunden (non-blocking)
    async loadDynamicCategoriesInBackground() {
        try {
            console.log('=== BAKGRUNDSLADDNING STARTAR ===');
            
            // Visa att bakgrundsladdning pågår på "Fler Quiz"-knappen
            this.updateFlerQuizButtonLoading(true);
            
            // Ladda dynamiska kategorier utan att blockera UI
            await this.loadDynamicCategories();
            console.log('loadDynamicCategories klar (bakgrund)');
            
            // Rendera dynamiska kategorier när de är klara
            this.renderDynamicCategories();
            console.log('renderDynamicCategories klar (bakgrund)');
            
            // Uppdatera frågeräkningen efter att dynamiska kategorier laddats
            this.updateQuestionCount();
            
            // Uppdatera Fler Quiz-statistiken efter att dynamiska kategorier laddats
            this.updateFlerQuizStats();
            
            // Uppdatera "Blanda"-kategorin om inställningen är aktiverad
            this.updateBlandaCategory();
            
            // Dölj loading state på "Fler Quiz"-knappen och visa antal kategorier
            const categoryCount = Object.keys(this.dynamicCategories).length;
            this.updateFlerQuizButtonLoading(false, categoryCount);
            
            // Notifikationen tas bort - ingen alert visas längre
            
            console.log('=== BAKGRUNDSLADDNING KLAR ===');
            
        } catch (error) {
            console.error('Bakgrundsladdning misslyckades:', error);
            this.updateFlerQuizButtonLoading(false);
        }
    }

    // Uppdatera "Blanda"-kategorin baserat på inställningen
    updateBlandaCategory() {
        // Säkerhetskontroll - vänta tills allQuestions är redo
        if (!this.allQuestions || this.allQuestions.length === 0) {
            console.log('⏳ Väntar på att allQuestions ska laddas...');
            return;
        }
        
        // Kontrollera att blandad-kategorin finns, skapa den om den inte finns
        if (!this.categories.blandad) {
            this.categories.blandad = {
                name: 'Blanda',
                icon: 'shuffle',
                color: 'transparent',
                questions: [...this.allQuestions]
            };
            console.log('✅ Skapade blandad-kategorin');
        }
        
        if (this.settings.includeAllCategories) {
            // Inkludera alla frågor från både huvudkategorier och dynamiska kategorier
            const allQuestions = [...this.allQuestions];
            
            // Lägg till frågor från dynamiska kategorier
            Object.values(this.dynamicCategories).forEach(category => {
                if (category.questions && category.questions.length > 0) {
                    // Lägg till category property till dynamiska kategorier också
                    const questionsWithCategory = category.questions.map(q => ({
                        ...q,
                        category: category.key || 'dynamic',
                        categoryName: category.name
                    }));
                    allQuestions.push(...questionsWithCategory);
                }
            });
            
            // Uppdatera "Blanda"-kategorin
            this.categories.blandad.questions = allQuestions;
            console.log(`✅ "Blanda"-kategorin uppdaterad med alla frågor: ${allQuestions.length} totalt`);
        } else {
            // Återställ till endast huvudkategorier
            this.categories.blandad.questions = [...this.allQuestions];
            console.log(`✅ "Blanda"-kategorin återställd till huvudkategorier: ${this.allQuestions.length} frågor`);
        }
    }

    // Formatera filnamn till kategorinamn
    formatCategoryName(filename) {
        // Ta bort .csv och formatera
        return filename
            .replace('.csv', '')
            .trim();
    }

    // Skapa kategori-nyckel från filnamn
    createCategoryKey(filename) {
        return filename
            .replace('.csv', '')
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    // Automatiska ikoner baserat på kategorinamn
    getAutoIcon(categoryName) {
        const name = categoryName.toLowerCase();
        if (name.includes('star wars') || name.includes('rymd')) return 'star';
        if (name.includes('fotboll') || name.includes('sport')) return 'trophy';
        if (name.includes('jul') || name.includes('vinter')) return 'gift';
        if (name.includes('harry potter') || name.includes('magi')) return 'book';
        if (name.includes('matematik') || name.includes('matte')) return 'calculator';
        if (name.includes('historia')) return 'clock';
        if (name.includes('kemi')) return 'flask';
        if (name.includes('biologi')) return 'leaf';
        if (name.includes('fysik')) return 'zap';
        if (name.includes('musik')) return 'music';
        if (name.includes('film')) return 'film';
        return 'help-circle';
    }

    // Automatiska färger från startsidans knappar med olika rotationer
    getAutoColor(categoryKey) {
        // Använd exakt samma färger som finns på startsidan men med olika rotationer
        const startColors = [
            // Allmänbildning - Blå till lila (från CSS)
            'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            'linear-gradient(45deg, #3b82f6 0%, #8b5cf6 100%)',
            'linear-gradient(225deg, #3b82f6 0%, #8b5cf6 100%)',
            'linear-gradient(315deg, #3b82f6 0%, #8b5cf6 100%)',
            
            // Musik - Rosa till röd (från CSS)
            'linear-gradient(135deg, #ec4899 0%, #ef4444 100%)',
            'linear-gradient(45deg, #ec4899 0%, #ef4444 100%)',
            'linear-gradient(225deg, #ec4899 0%, #ef4444 100%)',
            'linear-gradient(315deg, #ec4899 0%, #ef4444 100%)',
            
            // Geografi - Blå till grön (från CSS)
            'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
            'linear-gradient(45deg, #3b82f6 0%, #10b981 100%)',
            'linear-gradient(225deg, #3b82f6 0%, #10b981 100%)',
            'linear-gradient(315deg, #3b82f6 0%, #10b981 100%)',
            
            // Film & TV - Orange till gul (från CSS rad 970 - exakt samma färger)
            'linear-gradient(135deg, rgb(249, 115, 22) 0%, rgb(250, 204, 21) 100%)',
            'linear-gradient(45deg, rgb(249, 115, 22) 0%, rgb(250, 204, 21) 100%)',
            'linear-gradient(225deg, rgb(249, 115, 22) 0%, rgb(250, 204, 21) 100%)',
            'linear-gradient(315deg, rgb(249, 115, 22) 0%, rgb(250, 204, 21) 100%)',
            
            // Sport - Indigo till lila (från CSS)
            'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            'linear-gradient(45deg, #6366f1 0%, #8b5cf6 100%)',
            'linear-gradient(225deg, #6366f1 0%, #8b5cf6 100%)',
            'linear-gradient(315deg, #6366f1 0%, #8b5cf6 100%)',
            
            // Teknik - Lila till rosa (från CSS)
            'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
            'linear-gradient(45deg, #8b5cf6 0%, #ec4899 100%)',
            'linear-gradient(225deg, #8b5cf6 0%, #ec4899 100%)',
            'linear-gradient(315deg, #8b5cf6 0%, #ec4899 100%)',
            
            // Extra lila-rosa variant
            'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', // Lila till rosa (från rad 1057)
            'linear-gradient(45deg, #a855f7 0%, #ec4899 100%)',
            'linear-gradient(225deg, #a855f7 0%, #ec4899 100%)',
            'linear-gradient(315deg, #a855f7 0%, #ec4899 100%)',
            
            // Extra rosa variant som matchar "Musik" på startsidan
            'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)', // Rosa till ljusrosa (Musik-variant)
            'linear-gradient(45deg, #ec4899 0%, #f472b6 100%)',
            'linear-gradient(225deg, #ec4899 0%, #f472b6 100%)',
            'linear-gradient(315deg, #ec4899 0%, #f472b6 100%)',
            
            // Extra gula rotation för mer variation
            'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', // Gul till orange
            
            // Extra turkos gradient för mer variation
            'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'  // Turkos till blå
        ];
        
        // Slumpa färg baserat på kategori-nyckel (nu med 34 olika rotationer)
        // Använd en enklare hash-funktion för bättre variation
        let hash = 0;
        for (let i = 0; i < categoryKey.length; i++) {
            const char = categoryKey.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Konvertera till 32-bitars integer
        }
        
        // Lägg till extra slumpning baserat på kategori-nyckels längd
        hash = Math.abs(hash) + categoryKey.length;
        
        const selectedColor = startColors[hash % startColors.length];
        console.log(`Färg slumpad för ${categoryKey}: Hash=${hash}, Index=${hash % startColors.length}, Färg=${selectedColor}`);
        
        return selectedColor;
    }

    // Rendera dynamiska kategorier på "Fler Quiz"-sidan
    renderDynamicCategories(searchTerm = '') {
        const container = document.getElementById('dynamic-categories-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Om inga dynamiska kategorier finns
        if (Object.keys(this.dynamicCategories).length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.6);">
                    <p>Inga extra quiz hittades i data/kategori/</p>
                    <p style="font-size: 0.875rem; margin-top: 0.5rem;">Lägg till CSV-filer i mappen för att se dem här</p>
                </div>
            `;
            return;
        }
        
        // Filtrera kategorier baserat på sökterm
        let filteredCategories = Object.entries(this.dynamicCategories);
        
        if (searchTerm.trim() !== '') {
            const searchLower = searchTerm.toLowerCase();
            filteredCategories = filteredCategories.filter(([key, category]) => 
                category.name.toLowerCase().includes(searchLower)
            );
            
            // Visa meddelande om inga resultat hittades
            if (filteredCategories.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.6);">
                        <p>Inga quiz hittades för "${searchTerm}"</p>
                        <p style="font-size: 0.875rem; margin-top: 0.5rem;">Prova att söka på något annat</p>
                    </div>
                `;
                return;
            }
        }
        
        // Skapa en slumpmässig ordning av kategorierna
        const shuffledCategories = this.shuffleArray(filteredCategories);
        
        console.log('=== DEBUG: Dynamiska kategorier och färger ===');
        console.log(`Sökterm: "${searchTerm}", Hittade: ${shuffledCategories.length} kategorier`);
        
        // Skapa knappar för varje dynamisk kategori (i slumpmässig ordning)
        shuffledCategories.forEach(([key, category]) => {
            const btn = document.createElement('button');
            btn.className = 'dynamic-category-btn';
            btn.style.background = category.color;
            btn.setAttribute('data-category-key', key);
            
            // Debug: Visa färgen i konsolen
            console.log(`Kategori: ${category.name}, Färg: ${category.color}`);
            
            btn.innerHTML = `
                <div class="dynamic-category-name">${category.name}</div>
            `;
            
            btn.addEventListener('click', () => {
                if (this.selectionMode) {
                    this.toggleCategorySelection(key);
                } else {
                    this.selectDynamicCategory(key);
                }
            });
            
            container.appendChild(btn);
        });
        
        console.log('=== DEBUG: Slut ===');
    }

    // Välj dynamisk kategori och starta quiz
    selectDynamicCategory(categoryKey) {
        const category = this.dynamicCategories[categoryKey];
        if (!category || category.questions.length === 0) {
            alert('Inga frågor tillgängliga för denna kategori');
            return;
        }
        
        // Spara var man kom ifrån (Fler Quiz)
        this.previousView = 'fler-quiz';
        
        // Använd samma logik som befintliga kategorier
        this.selectedCategory = categoryKey;
        this.shuffledQuestions = this.shuffleArray(category.questions);
        this.currentQuestionIndex = 0;
        this.showAnswer = this.settings.alwaysShowAnswer;
        this.selectedAnswer = null;
        
        // Reset score
        this.resetScore();
        
        // Ensure category title is shown initially
        if (!this.settings.scoreTracking) {
            document.getElementById('category-title').textContent = category.name;
        }



        // Spåra start av quiz-session
        this.trackEvent('quiz-session-started', {
            category: category.name,
            totalQuestions: category.questions.length,
            settings: {
                multipleChoice: this.settings.showMultipleChoice,
                timer: this.settings.timer,
                timerDuration: this.settings.timerDuration,
                autoAdvance: this.settings.autoAdvance
            }
        });

        // Nollställ frågeräknare för ny session
        this.questionsAnswered = 0;
        
        // Update UI
        document.getElementById('category-title').textContent = category.name;
        
        // Uppdatera URL för direktlänkning
        if (this.urlHandler) {
            this.urlHandler.updateURL(categoryKey);
        }
        
        this.showView('quiz');
        this.loadCurrentQuestion(true);
    }

    // Parse CSV content
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const questions = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            // Simple CSV parsing (handles basic cases)
            const columns = this.parseCSVLine(line);
            
            // Check if we have enough columns (Kategori, Fråga, Rätt svar, Fel svar 1, Fel svar 2, Fel svar 3)
            if (columns.length >= 6) {
                // Validate that required fields are not empty
                if (columns[1] && columns[2] && columns[3] && columns[4] && columns[5]) {
                    questions.push({
                        id: questions.length + 1,
                        question: columns[1].trim(),
                        correctAnswer: columns[2].trim(),
                        wrongAnswers: [
                            columns[3].trim(),
                            columns[4].trim(),
                            columns[5].trim()
                        ]
                    });
                }
            }
        }
        
        console.log(`Parsed ${questions.length} questions from CSV`);
        return questions;
    }

    // Parse a single CSV line
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    // Shuffle array
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Create answer options with random order
    createAnswerOptions(correctAnswer, wrongAnswers) {
        const allAnswers = [correctAnswer, ...wrongAnswers];
        const shuffledAnswers = this.shuffleArray(allAnswers);
        return shuffledAnswers.map((answer, index) => ({
            text: answer,
            isCorrect: answer === correctAnswer,
            id: index
        }));
    }

    // Setup event listeners
    setupEventListeners() {
        console.log('=== SETUP EVENT LISTENERS STARTAR ===');
        // Home view
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showView('settings');
        });

        // Quiz view
        document.getElementById('back-btn').addEventListener('click', () => {
            // Smart tillbaka: Gå tillbaka till var man kom ifrån
            this.showView(this.previousView);
        });

        document.getElementById('show-answer-btn').addEventListener('click', () => {
            this.toggleAnswer();
        });

        document.getElementById('toggle-mode-btn').addEventListener('click', () => {
            this.toggleMode();
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            this.manualNextClicked = true;
            this.nextQuestion();
        });

        // Settings view
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            this.showView('home');
        });

        // Toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const setting = btn.getAttribute('data-setting');
                this.toggleSetting(setting);
            });
        });

        // Timer buttons
        document.querySelectorAll('.time-option').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTime(btn);
            });
        });

        // Answer options
        document.querySelectorAll('.option-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                if (!this.selectedAnswer) {
                    this.selectAnswer(index);
                }
            });
        });

        // Blanda knapp
        const blandaBtn = document.getElementById('blanda-btn');
        if (blandaBtn) {
            blandaBtn.addEventListener('click', () => {
                // Uppdatera URL för direktlänkning
                if (this.urlHandler) {
                    this.urlHandler.updateURL('blandad');
                }
                this.selectCategory('blandad');
            });
            console.log('Blanda event listener kopplad');
        } else {
            console.error('Kunde inte hitta blanda-btn');
        }

        // Fler Quiz knapp
        const flerQuizBtn = document.getElementById('fler-quiz-btn');
        console.log('Söker efter fler-quiz-btn...');
        console.log('Element hittat:', flerQuizBtn);
        console.log('Element HTML:', flerQuizBtn ? flerQuizBtn.outerHTML : 'NULL');
        
        if (flerQuizBtn) {
            flerQuizBtn.addEventListener('click', () => {
                console.log('Fler Quiz knapp klickad!');
                
                // Uppdatera URL för direktlänkning
                if (this.urlHandler) {
                    this.urlHandler.updateURL('fler-quiz');
                }
                
                // Spåra Fler Quiz klick för Umami Analytics
                this.trackEvent('fler-quiz-clicked', {
                    dynamicCategoriesCount: Object.keys(this.dynamicCategories).length,
                    totalQuestions: Object.values(this.dynamicCategories).reduce((sum, cat) => sum + cat.questions.length, 0)
                });
                
                this.showView('fler-quiz');
            });
            console.log('Fler Quiz event listener kopplad');
        } else {
            console.error('Kunde inte hitta fler-quiz-btn');
        }

        // Tillbaka från Fler Quiz
        const backToHomeBtn = document.getElementById('back-to-home-btn');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => {
                console.log('Tillbaka-knapp klickad!');
                
                // Hantera hierarki: Stäng search → Stäng selection → Gå tillbaka
                if (this.selectionMode) {
                    // Stäng selection mode först
                    this.toggleSelectionMode();
                    return;
                }
                
                // Nollställ sökningen
                const searchInput = document.getElementById('quiz-search-input');
                const clearSearchBtn = document.getElementById('clear-search-btn');
                const searchWrapper = document.querySelector('.search-input-wrapper');
                
                if (searchInput) {
                    searchInput.value = '';
                }
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = 'none';
                }
                if (searchWrapper) {
                    searchWrapper.classList.remove('expanded');
                }
                
                // Rendera om alla dynamiska kategorier (utan sökfilter)
                this.renderDynamicCategories('');
                
                this.showView('home');
            });
            console.log('Tillbaka event listener kopplad');
        } else {
            console.error('Kunde inte hitta back-to-home-btn');
        }
        
        // Sökfunktionalitet för Fler Quiz
        const searchInput = document.getElementById('quiz-search-input');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        const searchWrapper = document.querySelector('.search-input-wrapper');
        
        if (searchInput && searchWrapper) {
            // Expand search on focus
            searchInput.addEventListener('focus', () => {
                searchWrapper.classList.add('expanded');
            });
            
            // Collapse search on blur if no text
            searchInput.addEventListener('blur', () => {
                if (!searchInput.value.trim()) {
                    setTimeout(() => {
                        searchWrapper.classList.remove('expanded');
                    }, 200);
                }
            });
            
            // Handle click on search icon to expand
            searchWrapper.addEventListener('click', (e) => {
                if (!searchWrapper.classList.contains('expanded')) {
                    searchWrapper.classList.add('expanded');
                    searchInput.focus();
                }
            });
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value;
                console.log('Söker efter:', searchTerm);
                
                // Visa/dölj clear-knappen
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
                }
                
                // Rendera om kategorierna med sökterm
                this.renderDynamicCategories(searchTerm);
            });
            console.log('Sök-input event listener kopplad');
        } else {
            console.error('Kunde inte hitta quiz-search-input eller search-input-wrapper');
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (searchInput && searchWrapper) {
                    searchInput.value = '';
                    searchInput.focus();
                    clearSearchBtn.style.display = 'none';
                    this.renderDynamicCategories(''); // Visa alla kategorier
                    // Kollapsa sökrutan efter clear
                    setTimeout(() => {
                        searchWrapper.classList.remove('expanded');
                    }, 200);
                }
            });
            console.log('Clear search event listener kopplad');
        } else {
            console.error('Kunde inte hitta clear-search-btn');
        }
        
        // Multi-category selection event listeners
        const shuffleBtn = document.getElementById('shuffle-icon-btn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                console.log('Shuffle button clicked!');
                this.toggleSelectionMode();
            });
            console.log('Shuffle button event listener kopplad');
        } else {
            console.error('Kunde inte hitta shuffle-icon-btn');
        }
        
        const selectBtn = document.getElementById('select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                console.log('Select button clicked!');
                console.log('Selection mode:', this.selectionMode);
                console.log('Selected categories:', this.selectedCategories);
                this.startQuizWithSelectedCategories(true); // true = visa "Blandade Kategorier"
            });
            console.log('Select button event listener kopplad');
        } else {
            console.error('Kunde inte hitta select-btn');
        }
        
        const playAllBtn = document.getElementById('play-all-btn');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => {
                this.startQuizWithAllCategories();
            });
            console.log('Play all button event listener kopplad');
        } else {
            console.error('Kunde inte hitta play-all-btn');
        }
        
        // Handle clicks outside search input to close it
        document.addEventListener('click', (e) => {
            const searchContainer = document.querySelector('.search-container');
            const searchInput = document.getElementById('quiz-search-input');
            const searchWrapper = document.querySelector('.search-input-wrapper');
            
            if (searchContainer && searchInput && searchWrapper && !searchContainer.contains(e.target)) {
                // Click outside search container - close search
                if (searchInput.value.trim() !== '') {
                    searchInput.value = '';
                    this.renderDynamicCategories('');
                }
                
                const clearSearchBtn = document.getElementById('clear-search-btn');
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = 'none';
                }
                
                // Collapse search wrapper
                searchWrapper.classList.remove('expanded');
            }
        });
        
        console.log('=== SETUP EVENT LISTENERS KLAR ===');
    }

    // Show specific view
    showView(viewName) {
        console.log(`Växlar till vy: ${viewName}`);
        
        // Starta timer när användare kommer till hemsidan
        if (viewName === 'home') {
            this.homeViewStartTime = Date.now();
        }
        
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            console.log(`Vy ${viewName} aktiverad`);
        } else {
            console.error(`Kunde inte hitta vy: ${viewName}-view`);
        }
        
        // Reset score when leaving quiz view
        if (viewName !== 'quiz' && this.currentView === 'quiz') {
            this.resetScore();
            // Cancel any pending auto-advance timeout when leaving quiz
            if (this.autoAdvanceTimeout) {
                clearTimeout(this.autoAdvanceTimeout);
                this.autoAdvanceTimeout = null;
            }
        }
        
        this.currentView = viewName;
        
        // Uppdatera URL för direktlänkning
        if (this.urlHandler) {
            if (viewName === 'home') {
                // Rensa URL-parametrar för startsidan
                this.urlHandler.clearURL();
            } else if (viewName === 'settings') {
                // Lägg till settings-parameter
                this.urlHandler.updateURL('settings');
            } else if (viewName === 'fler-quiz') {
                // Lägg till fler-quiz-parameter
                this.urlHandler.updateURL('fler-quiz');
            }
        }
    }

    // Render categories on home page
    renderCategories() {
        const container = document.getElementById('categories-container');
        container.innerHTML = '';

        Object.entries(this.categories).forEach(([key, category]) => {
            const btn = document.createElement('button');
            btn.className = `category-btn ${key === 'blandad' ? 'mixed' : ''}`;
            
            if (key !== 'blandad') {
                btn.style.background = category.color;
            }

            btn.innerHTML = `
                <div class="category-content">
                    <div class="category-icon">
                        ${this.getCategoryIcon(category.icon)}
                    </div>
                    <div class="category-info">
                        <h3 class="category-name">${category.name}</h3>
                    </div>
                    <svg class="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            `;

            btn.addEventListener('click', () => {
                this.selectCategory(key);
            });

            container.appendChild(btn);
        });
    }

    // Select category and start quiz
    selectCategory(categoryKey) {
        const category = this.categories[categoryKey];
        if (!category || category.questions.length === 0) {
            alert('Inga frågor tillgängliga för denna kategori');
            return;
        }

        // Spara var man kom ifrån (startsidan)
        this.previousView = 'home';

        // Cancel any pending auto-advance timeout
        if (this.autoAdvanceTimeout) {
            clearTimeout(this.autoAdvanceTimeout);
            this.autoAdvanceTimeout = null;
        }

        this.selectedCategory = categoryKey;
        this.shuffledQuestions = this.shuffleArray(category.questions);
        this.currentQuestionIndex = 0;
        this.showAnswer = this.settings.alwaysShowAnswer;
        this.selectedAnswer = null;

        // Reset score when starting new quiz
        this.resetScore();
        
        // Ensure category title is shown initially
        console.log('selectCategory: categoryKey =', categoryKey);
        console.log('selectCategory: category.name =', category.name);
        console.log('selectCategory: scoreTracking =', this.settings.scoreTracking);
        
        if (!this.settings.scoreTracking) {
            // Don't set title for "blandad" category - let updateCategoryTitleForCurrentQuestion handle it
            if (categoryKey !== 'blandad') {
                document.getElementById('category-title').textContent = category.name;
                console.log('selectCategory: Set title to category name:', category.name);
            } else {
                console.log('selectCategory: Blandad category selected, not setting title');
            }
        }



        // Spåra start av quiz-session
        this.trackEvent('quiz-session-started', {
            category: category.name,
            totalQuestions: category.questions.length,
            settings: {
                multipleChoice: this.settings.showMultipleChoice,
                timer: this.settings.timer,
                timerDuration: this.settings.timerDuration,
                autoAdvance: this.settings.autoAdvance
            }
        });

        // Nollställ frågeräknare för ny session
        this.questionsAnswered = 0;

        // Update UI - don't set title for "blandad" category
        if (categoryKey !== 'blandad') {
            document.getElementById('category-title').textContent = category.name;
            console.log('selectCategory: Set UI title to category name:', category.name);
        } else {
            console.log('selectCategory: Blandad category, not setting UI title');
        }
        
        // Uppdatera URL för direktlänkning
        if (this.urlHandler && categoryKey !== 'blandad') {
            this.urlHandler.updateURL(categoryKey);
        }
        
        this.showView('quiz');
        this.loadCurrentQuestion(true);
    }

    // Load current question
    loadCurrentQuestion(startTimer = true) {
        const question = this.shuffledQuestions[this.currentQuestionIndex];
        if (!question) return;

        const answerDisplay = document.getElementById('answer-display');
        const answerOptions = document.getElementById('answer-options');
        
        answerDisplay.classList.add('hidden');
        answerDisplay.classList.remove('visible');
        answerOptions.classList.add('hidden');
        answerOptions.classList.remove('visible');
        
                // Reset answer state
        this.showAnswer = false;
        
        // Remove answers-active class immediately
        const questionSection = document.querySelector('.question-section');
        if (questionSection) {
            questionSection.classList.remove('answers-active');
        }
        
        document.getElementById('current-question').textContent = question.question;
        
            // Update category title based on current question's category
    console.log('loadCurrentQuestion: Calling updateCategoryTitleForCurrentQuestion');
    this.updateCategoryTitleForCurrentQuestion();
        
        // CRITICAL: Don't load answer text until it's actually needed to prevent cheating
        
        if (this.settings.showMultipleChoice) {
            this.answerOptions = this.createAnswerOptions(question.correctAnswer, question.wrongAnswers);
            this.renderAnswerOptions();
            document.getElementById('answer-options').classList.remove('hidden');
            document.getElementById('answer-options').classList.add('visible');
            document.getElementById('answer-display').classList.add('hidden');
            document.getElementById('show-answer-btn').disabled = true;
            document.getElementById('show-answer-btn').classList.add('disabled');
            
            // Add answers-active class when multiple choice is shown
            const questionSection = document.querySelector('.question-section');
            if (questionSection) {
                questionSection.classList.add('answers-active');
            }
        } else {
            // CRITICAL: Don't load answer text here - only when user clicks "Visa svar"
            // This prevents cheating by seeing flashes of the correct answer
            document.getElementById('answer-options').classList.add('hidden');
            document.getElementById('answer-options').classList.remove('visible');
            this.updateAnswerDisplay();
            document.getElementById('show-answer-btn').disabled = false;
            document.getElementById('show-answer-btn').classList.remove('disabled');
            document.getElementById('show-answer-btn').classList.toggle('hidden', this.settings.alwaysShowAnswer);
            
            // Remove answers-active class when switching to answer mode
            const questionSection = document.querySelector('.question-section');
            if (questionSection && !this.showAnswer && !this.settings.alwaysShowAnswer) {
                questionSection.classList.remove('answers-active');
            }
        }

        this.selectedAnswer = null;
        this.updateToggleModeButton();
        
        // Update show answer button visibility based on current settings
        this.updateShowAnswerButtonVisibility();
        
        // Update show answer button text and icon to match current state
        this.updateShowAnswerButtonText();
        
        // Update score display
        this.updateScoreDisplay();
        
        // Start timer if enabled and startTimer parameter is true
        if (startTimer && this.settings.timer && this.settings.timerDuration > 0) {
            this.startTimer();
        }
    }

    // Render answer options for multiple choice
    renderAnswerOptions() {
        const options = document.querySelectorAll('.option-btn');
        options.forEach((btn, index) => {
            if (this.answerOptions[index]) {
                btn.querySelector('.option-text').textContent = this.answerOptions[index].text;
                btn.className = 'option-btn';
                btn.disabled = false;
            }
        });
    }

    // Select answer in multiple choice mode
    selectAnswer(optionIndex) {
        const option = this.answerOptions[optionIndex];
        if (!option) return;

        this.selectedAnswer = option;
        
        // Stop timer when answer is selected
        if (this.timer) {
            this.stopTimer();
        }
        
        // Update button styles
        const buttons = document.querySelectorAll('.option-btn');
        buttons.forEach((btn, index) => {
            if (this.answerOptions[index].isCorrect) {
                btn.classList.add('correct');
            } else if (index === optionIndex && !option.isCorrect) {
                btn.classList.add('incorrect');
            } else {
                btn.classList.add('disabled');
            }
            btn.disabled = true;
        });

        // Add point if answer is correct
        if (option.isCorrect) {
            this.addPoint();
        } else {
            // Still count as answered question
            this.addAnsweredQuestion();
        }

        // Auto advance if enabled, but only if user didn't just manually advance
        if (this.settings.autoAdvance && !this.manualNextClicked) {
            this.autoAdvanceTimeout = setTimeout(() => {
                this.nextQuestion();
            }, 2000);
        }
    }

    // Start timer for current question
    startTimer() {
        // Clear any existing timer
        this.stopTimer();
        
        // Reset timer progress - start from 0 and expand to 100
        this.timerProgress = 0;
        this.updateTimerDisplay();
        
        // Show timer container
        const timerContainer = document.getElementById('timer-container');
        timerContainer.classList.add('visible');
        
        // Calculate interval for smooth animation
        const interval = (this.timerDuration * 1000) / 100; // 100 steps for smooth progress
        
        this.timer = setInterval(() => {
            this.timerProgress += 1;
            this.updateTimerDisplay();
            
            if (this.timerProgress >= 100) {
                this.stopTimer();
                // Small delay before showing answer
                setTimeout(() => {
                    this.showAnswerAutomatically();
                }, 200); // 200ms delay
                // Don't hide timer - keep it visible with dark background
            }
        }, interval);
    }

    // Stop timer
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Keep timer visible - don't hide it
        // Timer will show dark background when time runs out
    }

    // Update timer display
    updateTimerDisplay() {
        const progressBar = document.getElementById('timer-progress');
        if (progressBar) {
                    // Timer expands from left to right (0% to 100%)
        progressBar.style.width = `${this.timerProgress}%`;
        }
    }

    // Show answer automatically when timer runs out
    showAnswerAutomatically() {
        if (this.settings.showMultipleChoice) {
            // In multiple choice mode, show correct answer
            this.showCorrectAnswer();
        } else {
            // In direct answer mode, show the answer
            this.showAnswer = true;
            this.updateAnswerDisplay();
            
            // Count as answered question when timer runs out in direct answer mode (if score tracking is enabled)
            if (this.settings.scoreTracking) {
                this.addAnsweredQuestion();
            }
        }
        
        // Start auto-advance after showing answer if enabled
        if (this.settings.autoAdvance) {
            this.autoAdvanceTimeout = setTimeout(() => {
                this.nextQuestion();
            }, 2000);
        }
    }

    // Show correct answer in multiple choice mode
    showCorrectAnswer() {
        const buttons = document.querySelectorAll('.option-btn');
        buttons.forEach((btn, index) => {
            if (this.answerOptions[index].isCorrect) {
                btn.classList.add('correct');
            } else {
                btn.classList.add('disabled');
            }
            btn.disabled = true;
        });
        
        // Set selected answer to correct one
        this.selectedAnswer = this.answerOptions.find(option => option.isCorrect);
        
        // Add point for correct answer when timer runs out (if score tracking is enabled)
        if (this.settings.scoreTracking && this.selectedAnswer && this.selectedAnswer.isCorrect) {
            this.addPoint();
        }
        
        // Count as answered question when timer runs out (if score tracking is enabled)
        if (this.settings.scoreTracking) {
            this.addAnsweredQuestion();
        }
        
        // Start auto-advance after showing correct answer if enabled
        if (this.settings.autoAdvance) {
            this.autoAdvanceTimeout = setTimeout(() => {
                this.nextQuestion();
            }, 2000);
        }
    }

    // Toggle answer visibility
    toggleAnswer() {
        this.showAnswer = !this.showAnswer;
        this.updateAnswerDisplay();
        
        // Update button text and icon to match new state
        this.updateShowAnswerButtonText();
    }

    // Update answer display visibility
    updateAnswerDisplay() {
        const display = document.getElementById('answer-display');
        const questionSection = document.querySelector('.question-section');
        
        if (this.showAnswer || this.settings.alwaysShowAnswer) {
            // CRITICAL: Only load answer text when actually showing it to prevent cheating
            const currentQuestion = this.shuffledQuestions[this.currentQuestionIndex];
            if (currentQuestion) {
                document.getElementById('answer-text').textContent = currentQuestion.correctAnswer;
            }
            
            display.classList.remove('hidden');
            display.classList.add('visible');
            // Add class to reduce padding when answers are shown
            if (questionSection) {
                questionSection.classList.add('answers-active');
            }
        } else {
            display.classList.add('hidden');
            display.classList.remove('visible');
            // Remove class to restore normal padding when answers are hidden
            if (questionSection) {
                questionSection.classList.remove('answers-active');
            }
            
            // CRITICAL: Clear answer text when hiding to prevent cheating
            document.getElementById('answer-text').textContent = '';
        }
    }

    // Toggle between multiple choice and direct answer mode
    toggleMode() {
        this.settings.showMultipleChoice = !this.settings.showMultipleChoice;
        this.saveSettings();
        
        // Smooth transition between modes - no delay
        if (this.settings.showMultipleChoice) {
            // Hide answer display first
            const answerDisplay = document.getElementById('answer-display');
            answerDisplay.classList.add('hidden');
            answerDisplay.classList.remove('visible');
            
            // Disable show answer button
            const showAnswerBtn = document.getElementById('show-answer-btn');
            showAnswerBtn.disabled = true;
            showAnswerBtn.classList.add('disabled');
            
            // Add answers-active class when switching to multiple choice
            const questionSection = document.querySelector('.question-section');
            if (questionSection) {
                questionSection.classList.add('answers-active');
            }
            
            // Show answer options immediately - no delay
            this.loadCurrentQuestion(false);
        } else {
            // Hide answer options first
            const answerOptions = document.getElementById('answer-options');
            answerOptions.classList.add('hidden');
            answerOptions.classList.remove('visible');
            
            // Enable show answer button
            const showAnswerBtn = document.getElementById('show-answer-btn');
            showAnswerBtn.disabled = false;
            showAnswerBtn.classList.remove('disabled');
            
            // Show answer display immediately - no delay
            this.loadCurrentQuestion(false);
        }
        
        this.updateAlwaysShowSetting();
    }

    // Update toggle mode button text
    updateToggleModeButton() {
        const btn = document.getElementById('toggle-mode-btn');
        const text = btn.querySelector('span');
        
        if (this.settings.showMultipleChoice) {
            text.textContent = 'Dölj alternativ';
        } else {
            text.textContent = 'Svarsalternativ';
        }
        
        // Update show answer button visibility when switching modes
        this.updateShowAnswerButtonVisibility();
    }

    // Next question
    nextQuestion() {
        // Cancel any pending auto-advance timeout
        if (this.autoAdvanceTimeout) {
            clearTimeout(this.autoAdvanceTimeout);
            this.autoAdvanceTimeout = null;
        }
        
        if (this.currentQuestionIndex < this.shuffledQuestions.length - 1) {
            this.currentQuestionIndex++;
        } else {
            this.currentQuestionIndex = 0;
        }
        
        // Reset answer visibility and hide immediately
        this.showAnswer = false;
        
        // Force hide answer display immediately to prevent flash
        const answerDisplay = document.getElementById('answer-display');
        const answerOptions = document.getElementById('answer-options');
        if (answerDisplay) {
            answerDisplay.classList.add('hidden');
            answerDisplay.classList.remove('visible');
        }
        if (answerOptions) {
            answerOptions.classList.add('hidden');
            answerOptions.classList.remove('visible');
        }
        
        // Spåra att en fråga besvarats för Umami Analytics
        this.questionsAnswered = (this.questionsAnswered || 0) + 1;
        this.trackEvent('question-answered', {
            questionNumber: this.questionsAnswered,
            categoryKey: this.selectedCategory,
            mode: this.settings.showMultipleChoice ? 'multiple-choice' : 'direct-answer',
            timerEnabled: this.settings.timer,
            autoAdvance: this.settings.autoAdvance
        });
        
        // Load the new question and start timer
        this.loadCurrentQuestion(true);
        
        // Reset the manual advance flag when starting a new question
        this.manualNextClicked = false;
    }

    // Toggle setting
    toggleSetting(settingKey) {
        this.settings[settingKey] = !this.settings[settingKey];
        
        // Special handling for showMultipleChoice
        if (settingKey === 'showMultipleChoice') {
            console.log('showMultipleChoice toggled to:', this.settings.showMultipleChoice);
            // If enabling multiple choice, disable always show answer
            if (this.settings.showMultipleChoice) {
                this.settings.alwaysShowAnswer = false;
                console.log('Disabled alwaysShowAnswer, now:', this.settings.alwaysShowAnswer);
                // Update the always show answer toggle button visually
                const alwaysShowBtn = document.querySelector('[data-setting="alwaysShowAnswer"]');
                if (alwaysShowBtn) {
                    alwaysShowBtn.classList.remove('active');
                    console.log('Removed active class from alwaysShowAnswer button');
                }
            } else {
                // If disabling multiple choice, also disable score tracking
                if (this.settings.scoreTracking) {
                    this.settings.scoreTracking = false;
                    console.log('Disabled scoreTracking because multiple choice was disabled');
                    // Update the score tracking toggle button visually
                    const scoreTrackingBtn = document.querySelector('[data-setting="scoreTracking"]');
                    if (scoreTrackingBtn) {
                        scoreTrackingBtn.classList.remove('active');
                        console.log('Removed active class from scoreTracking button');
                    }
                }
            }
            this.updateAlwaysShowSetting();
            // Update score tracking button state when multiple choice changes
            this.updateScoreTrackingButtonState();
            if (this.currentView === 'quiz') {
                this.loadCurrentQuestion(false);
            } else {
                // Update button visibility even if not in quiz view
                this.updateShowAnswerButtonVisibility();
            }
        }
        
        // Special handling for alwaysShowAnswer
        if (settingKey === 'alwaysShowAnswer') {
            console.log('alwaysShowAnswer toggled to:', this.settings.alwaysShowAnswer);
            // If enabling always show answer, disable multiple choice
            if (this.settings.alwaysShowAnswer) {
                this.settings.showMultipleChoice = false;
                console.log('Disabled showMultipleChoice, now:', this.settings.showMultipleChoice);
                // Update the multiple choice toggle button visually
                const multipleChoiceBtn = document.querySelector('[data-setting="showMultipleChoice"]');
                if (multipleChoiceBtn) {
                    multipleChoiceBtn.classList.remove('active');
                    console.log('Removed active class from showMultipleChoice button');
                }
            }
            
            if (this.currentView === 'quiz' && !this.settings.showMultipleChoice) {
                this.showAnswer = this.settings.alwaysShowAnswer;
                this.updateAnswerDisplay();
                
                const showAnswerBtn = document.getElementById('show-answer-btn');
                showAnswerBtn.classList.toggle('hidden', this.settings.alwaysShowAnswer);
            }
        }
        
        // Special handling for timer
        if (settingKey === 'timer') {
            if (!this.settings.timer) {
                // Timer is disabled - stop and hide it
                this.stopTimer();
                const timerContainer = document.getElementById('timer-container');
                if (timerContainer) {
                    timerContainer.classList.remove('visible');
                }
            }
            
            // Update show answer button visibility when timer setting changes
            if (this.currentView === 'quiz') {
                this.updateShowAnswerButtonVisibility();
            }
        }

        // Special handling for score tracking
        if (settingKey === 'scoreTracking') {
            console.log('scoreTracking toggled to:', this.settings.scoreTracking);
            
            // Score tracking can only be enabled if multiple choice is enabled
            if (this.settings.scoreTracking && !this.settings.showMultipleChoice) {
                this.settings.scoreTracking = false;
                console.log('Score tracking disabled because multiple choice is not enabled');
            }
            
            if (this.currentView === 'quiz') {
                console.log('Updating score display in quiz view');
                this.updateScoreDisplay();
            }
        }

        // Special handling for includeAllCategories
        if (settingKey === 'includeAllCategories') {
            console.log('includeAllCategories toggled to:', this.settings.includeAllCategories);
            // Uppdatera "Blanda"-kategorin när inställningen ändras
            this.updateBlandaCategory();
        }
        
        // Special handling for monochrome mode
        if (settingKey === 'monochromeMode') {
            console.log('monochromeMode toggled to:', this.settings.monochromeMode);
            
            // If enabling monochrome mode, disable high contrast mode
            if (this.settings.monochromeMode) {
                this.settings.highContrastMode = false;
                console.log('Disabled highContrastMode because monochromeMode was enabled');
                
                // Update the high contrast toggle button visually
                const highContrastBtn = document.querySelector('[data-setting="highContrastMode"]');
                if (highContrastBtn) {
                    highContrastBtn.classList.remove('active');
                    console.log('Removed active class from highContrastMode button');
                }
            }
            
            this.updateMonochromeMode();
        }
        
        // Special handling for high contrast mode
        if (settingKey === 'highContrastMode') {
            console.log('highContrastMode toggled to:', this.settings.highContrastMode);
            
            // If enabling high contrast mode, disable monochrome mode
            if (this.settings.highContrastMode) {
                this.settings.monochromeMode = false;
                console.log('Disabled monochromeMode because highContrastMode was enabled');
                
                // Update the monochrome toggle button visually
                const monochromeBtn = document.querySelector('[data-setting="monochromeMode"]');
                if (monochromeBtn) {
                    monochromeBtn.classList.remove('active');
                    console.log('Removed active class from monochromeMode button');
                }
            }
            
            this.updateHighContrastMode();
        }
        
        // Save and apply settings AFTER handling mutual exclusivity
        console.log('Final settings before save:', this.settings);
        this.saveSettings();
        this.applySettings();
    }

    // Update always show answer setting visibility
    updateAlwaysShowSetting() {
        // Don't hide the entire section, just disable the toggle button
        // The section should always be visible
    }

    // Update score tracking button state based on multiple choice setting
    updateScoreTrackingButtonState() {
        const scoreTrackingBtn = document.querySelector('[data-setting="scoreTracking"]');
        if (!scoreTrackingBtn) return;

        if (!this.settings.showMultipleChoice) {
            // Disable score tracking button if multiple choice is not enabled
            scoreTrackingBtn.disabled = true;
            scoreTrackingBtn.classList.add('disabled');
            console.log('Score tracking button disabled because multiple choice is not enabled');
        } else {
            // Enable score tracking button if multiple choice is enabled
            scoreTrackingBtn.disabled = false;
            scoreTrackingBtn.classList.remove('disabled');
            console.log('Score tracking button enabled because multiple choice is enabled');
        }
    }

    // Update show answer button visibility based on settings
    updateShowAnswerButtonVisibility() {
        const showAnswerBtn = document.getElementById('show-answer-btn');
        if (!showAnswerBtn) return;

        // Hide "Visa svar" button if "Visa svarsalternativ" is enabled OR if "Visa alltid svar" is enabled
        // This means: when multiple choice is shown OR when answers are always shown, hide the show answer button
        const shouldHide = this.settings.showMultipleChoice || this.settings.alwaysShowAnswer;
        showAnswerBtn.classList.toggle('hidden', shouldHide);
    }

    // Update show answer button text and icon based on current state
    updateShowAnswerButtonText() {
        const showAnswerBtn = document.getElementById('show-answer-btn');
        if (!showAnswerBtn) return;

        const icon = showAnswerBtn.querySelector('svg');
        const text = showAnswerBtn.querySelector('span');
        
        if (this.showAnswer) {
            text.textContent = 'Dölj svar';
            icon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            text.textContent = 'Visa svar';
            icon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            `;
        }
    }

    // Update monochrome mode
    updateMonochromeMode() {
        const monochromeCss = document.getElementById('monochrome-css');
        if (!monochromeCss) return;

        if (this.settings.monochromeMode) {
            // Enable monochrome mode
            monochromeCss.disabled = false;
            console.log('Monochrome mode enabled');
        } else {
            // Disable monochrome mode
            monochromeCss.disabled = true;
            console.log('Monochrome mode disabled');
        }
    }

    // Update high contrast mode
    updateHighContrastMode() {
        const highContrastCss = document.getElementById('highcontrast-css');
        if (!highContrastCss) return;

        if (this.settings.highContrastMode) {
            // Enable high contrast mode
            highContrastCss.disabled = false;
            console.log('High contrast mode enabled');
        } else {
            // Disable high contrast mode
            highContrastCss.disabled = true;
            console.log('High contrast mode disabled');
        }
    }

    // Update score display
    updateScoreDisplay() {
        const categoryTitle = document.getElementById('category-title');
        if (!categoryTitle) {
            console.log('updateScoreDisplay: category-title element not found');
            return;
        }

        console.log('updateScoreDisplay: scoreTracking =', this.settings.scoreTracking);
        console.log('updateScoreDisplay: currentScore =', this.currentScore);
        console.log('updateScoreDisplay: totalQuestionsAnswered =', this.totalQuestionsAnswered);

        if (this.settings.scoreTracking) {
            // Show score instead of category title
            const scoreText = `${this.currentScore} poäng av ${this.totalQuestionsAnswered}`;
            categoryTitle.textContent = scoreText;
            console.log('updateScoreDisplay: Showing score:', scoreText);
        } else {
            // Don't update category title when scoreTracking is false
            // The title is already set by updateCategoryTitleForCurrentQuestion
            console.log('updateScoreDisplay: Score tracking disabled, not updating category title');
        }
    }

    // Get current category based on current question
    getCurrentCategory() {
        if (this.currentQuestionIndex >= 0 && this.shuffledQuestions.length > 0) {
            const currentQuestion = this.shuffledQuestions[this.currentQuestionIndex];
            if (currentQuestion) {
                // Check if question has category information FIRST (prioritize this)
                if (currentQuestion.category && currentQuestion.categoryName) {
                    // Return a category object with the question's category info
                    return {
                        name: currentQuestion.categoryName,
                        key: currentQuestion.category
                    };
                }
                
                // Then check if we have a specific selected category (but not "blandad")
                if (this.selectedCategory && this.selectedCategory !== 'blandad' && this.categories[this.selectedCategory]) {
                    return this.categories[this.selectedCategory];
                }
                
                // Fallback: search in categories (old method)
                // Check dynamic categories first
                for (const [key, category] of Object.entries(this.dynamicCategories)) {
                    if (category.questions.some(q => 
                        q.question === currentQuestion.question && 
                        q.correctAnswer === currentQuestion.correctAnswer
                    )) {
                        return category;
                    }
                }
                
                // Then check main categories
                for (const [key, category] of Object.entries(this.categories)) {
                    if (key !== 'blandad' && category.questions.some(q => 
                        q.question === currentQuestion.question && 
                        q.correctAnswer === currentQuestion.correctAnswer
                    )) {
                        return category;
                    }
                }
            }
        }
        return null;
    }

    // Add point for correct answer
    addPoint() {
        console.log('addPoint called, scoreTracking =', this.settings.scoreTracking);
        if (this.settings.scoreTracking) {
            this.currentScore++;
            this.totalQuestionsAnswered++;
            console.log('Point added! Score:', this.currentScore, 'Total answered:', this.totalQuestionsAnswered);
            this.updateScoreDisplay();
        }
    }

    // Add point for answered question (correct or incorrect)
    addAnsweredQuestion() {
        console.log('addAnsweredQuestion called, scoreTracking =', this.settings.scoreTracking);
        if (this.settings.scoreTracking) {
            this.totalQuestionsAnswered++;
            console.log('Question counted! Total answered:', this.totalQuestionsAnswered);
            this.updateScoreDisplay();
        }
    }

    // Reset score when leaving quiz
    resetScore() {
        console.log('resetScore called');
        this.currentScore = 0;
        this.totalQuestionsAnswered = 0;
        console.log('Score reset to 0, total questions reset to 0');
        
        // Update score display to show category title instead of score
        this.updateScoreDisplay();
    }

    // Select time duration
    selectTime(button) {
        // Remove previous selection
        document.querySelectorAll('.time-option').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Mark new selection
        button.classList.add('selected');
        
        // Update settings
        const newDuration = parseInt(button.getAttribute('data-time'));
        
        // Spåra timer-inställningsändring för Umami Analytics
        this.trackEvent('timer-setting-changed', {
            newSeconds: newDuration,
            previousSeconds: this.settings.timerDuration,
            changeType: newDuration > this.settings.timerDuration ? 'increased' : 'decreased'
        });
        
        this.settings.timerDuration = newDuration;
        this.timerDuration = this.settings.timerDuration;
        this.saveSettings();
        
        // Animation feedback
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1.02)';
        }, 150);
    }

    // Update timer duration setting visibility
    updateTimerSettingVisibility() {
        const setting = document.getElementById('timer-duration-setting');
        
        if (setting) {
            if (this.settings.timer) {
                // Timer is enabled
                setting.classList.add('visible');
                console.log('Timer duration setting is enabled');
            } else {
                // Timer is disabled
                setting.classList.remove('visible');
                console.log('Timer duration setting is disabled');
            }
        } else {
            console.error('Timer duration setting elements not found');
        }
        
        // Also handle timer container visibility in quiz view
        const timerContainer = document.getElementById('timer-container');
        if (timerContainer) {
            if (this.settings.timer) {
                // Timer is enabled - keep it visible if it's running
                // (don't change visibility here, let startTimer handle it)
            } else {
                // Timer is disabled - hide it and stop any running timer
                this.stopTimer();
                timerContainer.classList.remove('visible');
            }
        }
    }

    // Apply all settings
    applySettings() {

        
        // Update toggle buttons
        Object.entries(this.settings).forEach(([key, value]) => {
            const btn = document.querySelector(`[data-setting="${key}"]`);
            if (btn) {
                btn.classList.toggle('active', value);
            }
        });
        
        // Update timer buttons
        document.querySelectorAll('.time-option').forEach(btn => {
            const btnTime = parseInt(btn.getAttribute('data-time'));
            if (btnTime === this.settings.timerDuration) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        this.timerDuration = this.settings.timerDuration;
        
        // Update timer duration setting visibility
        this.updateTimerSettingVisibility();
        
        this.updateAlwaysShowSetting();
        
        // Update score tracking button state
        this.updateScoreTrackingButtonState();
        
        // Update show answer button visibility when applying settings
        this.updateShowAnswerButtonVisibility();
        
        // Update score display when applying settings
        console.log('applySettings: Updating score display');
        this.updateScoreDisplay();
        
        // Update monochrome mode when applying settings
        this.updateMonochromeMode();
        
        // Update high contrast mode when applying settings
        this.updateHighContrastMode();
        
        // Ensure mutual exclusivity of appearance modes when applying settings
        if (this.settings.monochromeMode && this.settings.highContrastMode) {
            // If both are somehow enabled, disable high contrast mode
            this.settings.highContrastMode = false;
            console.log('Enforced mutual exclusivity: disabled highContrastMode');
            
            // Update the high contrast toggle button visually
            const highContrastBtn = document.querySelector('[data-setting="highContrastMode"]');
            if (highContrastBtn) {
                highContrastBtn.classList.remove('active');
            }
        }
    }

    // Update question count display
    updateQuestionCount() {
        // Räkna vanliga kategorier
        let totalQuestions = this.allQuestions.length;
        
        // Lägg till dynamiska kategorier
        Object.values(this.dynamicCategories).forEach(category => {
            totalQuestions += category.questions.length;
        });
        
        document.getElementById('total-questions').textContent = totalQuestions.toLocaleString('sv-SE');
    }

    // Update category statistics display
    updateCategoryStats() {
        // Update each category stat card with the actual question count
        Object.entries(this.categories).forEach(([key, category]) => {
            const statCard = document.querySelector(`[data-category="${key}"]`);
            if (statCard) {
                const numberElement = statCard.querySelector('.category-stat-number');
                if (numberElement) {
                    numberElement.textContent = category.questions.length.toLocaleString('sv-SE');
                }
            }
        });
        
        // Update Fler Quiz statistics
        this.updateFlerQuizStats();
    }
    
    // Update Fler Quiz statistics display
    updateFlerQuizStats() {
        // Räkna totala frågor i /kategori (dynamiska kategorier)
        let flerQuizTotal = 0;
        Object.values(this.dynamicCategories).forEach(category => {
            flerQuizTotal += category.questions.length;
        });
        
        // Räkna totala frågor i hela /data (grundkategorier + dynamiska)
        let totalAllQuestions = this.allQuestions.length + flerQuizTotal;
        
        // Uppdatera Fler Quiz-rutan
        const flerQuizElement = document.getElementById('fler-quiz-total');
        if (flerQuizElement) {
            flerQuizElement.textContent = flerQuizTotal.toLocaleString('sv-SE');
        }
        
        // Uppdatera Total-rutan
        const totalAllElement = document.getElementById('total-all-questions');
        if (totalAllElement) {
            totalAllElement.textContent = totalAllQuestions.toLocaleString('sv-SE');
        }
    }

    // Save settings to localStorage
    saveSettings() {
        localStorage.setItem('quizla-settings', JSON.stringify(this.settings));
    }

    // Load settings from localStorage
    loadSettings() {
        const saved = localStorage.getItem('quizla-settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
                // Update timer duration
                this.timerDuration = this.settings.timerDuration;
                // Update timer setting visibility
                this.updateTimerSettingVisibility();
                // Update score display
                this.updateScoreDisplay();
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }
    }

    // Helper to get SVG icon based on category icon name
    getCategoryIcon(iconName) {
        switch (iconName) {
            case 'book':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open w-6 h-6 text-white"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
            case 'music':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music w-6 h-6 text-white"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
            case 'map':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin w-6 h-6 text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
            case 'film':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-film w-6 h-6 text-white"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M7 3v18"></path><path d="M3 7.5h4"></path><path d="M3 12h18"></path><path d="M3 16.5h4"></path><path d="M17 3v18"></path><path d="M17 7.5h4"></path><path d="M17 16.5h4"></path></svg>`;
            case 'trophy':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trophy w-6 h-6 text-white"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`;
            case 'computer':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor w-6 h-6 text-white"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>`;
            case 'shuffle':
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shuffle w-6 h-6 text-white"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"></path><path d="m18 2 4 4-4 4"></path><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"></path><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"></path><path d="m18 14 4 4-4 4"></path></svg>`;
            default:
                return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right w-5 h-5 text-white/60"><path d="m9 18 6-6-6-6"></path></svg>`;
        }
    }

    // ===== MULTI-CATEGORY SELECTION FEATURE =====
    
    // State variables for multi-category selection
    selectionMode = false;
    selectedCategories = new Set();
    
    // Toggle selection mode
    toggleSelectionMode() {
        console.log('toggleSelectionMode called');
        this.selectionMode = !this.selectionMode;
        console.log('Selection mode is now:', this.selectionMode);
        
        const shuffleBtn = document.getElementById('shuffle-icon-btn');
        const bottomButtons = document.getElementById('bottom-buttons');
        const container = document.getElementById('dynamic-categories-container');
        
        console.log('Found elements:', { shuffleBtn, bottomButtons, container });
        
        if (this.selectionMode) {
            console.log('Activating selection mode');
            // Activate selection mode
            shuffleBtn.classList.add('active');
            
            // Show bottom buttons with delay
            setTimeout(() => {
                bottomButtons.classList.remove('hidden');
                bottomButtons.classList.add('visible');
                console.log('Bottom buttons should now be visible');
            }, 200);
            
            // Add selection mode class to container
            container.classList.add('selection-mode');
            
            // Add selection mode to all category buttons
            const categoryBtns = container.querySelectorAll('.dynamic-category-btn');
            console.log('Found category buttons:', categoryBtns.length);
            categoryBtns.forEach((btn, index) => {
                // Spara ursprunglig bakgrundsfärg
                const originalBg = btn.style.background;
                btn.style.setProperty('--original-bg', originalBg);
                
                btn.classList.add('selection-mode');
                // Staggered animation delay
                setTimeout(() => {
                    btn.style.opacity = '1';
                }, 300 + (index * 50));
            });
            
            // Update select button text
            this.updateSelectButtonText();
        } else {
            console.log('Deactivating selection mode');
            // Deactivate selection mode
            shuffleBtn.classList.remove('active');
            this.selectedCategories.clear();
            
            // Hide bottom buttons
            bottomButtons.classList.remove('visible');
            setTimeout(() => {
                bottomButtons.classList.add('hidden');
            }, 400);
            
            // Remove selection mode from container
            container.classList.remove('selection-mode');
            
            // Remove selection mode from all category buttons
            const categoryBtns = container.querySelectorAll('.dynamic-category-btn');
            categoryBtns.forEach(btn => {
                btn.classList.remove('selection-mode', 'selected');
                btn.style.opacity = '1';
            });
            
            // Reset button loading states
            const selectBtn = document.getElementById('select-btn');
            const playAllBtn = document.getElementById('play-all-btn');
            if (selectBtn) {
                selectBtn.style.opacity = '1';
                selectBtn.style.pointerEvents = 'auto';
            }
            if (playAllBtn) {
                playAllBtn.style.opacity = '1';
                playAllBtn.style.pointerEvents = 'auto';
            }
        }
    }
    
    // Toggle category selection
    toggleCategorySelection(categoryKey) {
        console.log('toggleCategorySelection called with:', categoryKey);
        if (!this.selectionMode) {
            console.log('Not in selection mode, returning');
            return;
        }
        
        if (this.selectedCategories.has(categoryKey)) {
            this.selectedCategories.delete(categoryKey);
            console.log('Removed category:', categoryKey);
        } else {
            this.selectedCategories.add(categoryKey);
            console.log('Added category:', categoryKey);
        }
        
        console.log('Selected categories now:', Array.from(this.selectedCategories));
        
        // Update visual feedback
        const btn = document.querySelector(`[data-category-key="${categoryKey}"]`);
        if (btn) {
            if (this.selectedCategories.has(categoryKey)) {
                // Kategori markerad - lägg till selected klass
                btn.classList.add('selected');
                console.log('Added selected class to button');
            } else {
                // Kategori avmarkerad - ta bort selected klass och återställ bakgrund
                btn.classList.remove('selected');
                // Återställ till ursprunglig bakgrundsfärg
                const originalBg = btn.style.getPropertyValue('--original-bg');
                if (originalBg) {
                    btn.style.background = originalBg;
                }
                console.log('Removed selected class and restored background');
            }
            console.log('Updated button visual feedback');
        } else {
            console.log('Button not found for category:', categoryKey);
        }
        
        // Update select button text
        this.updateSelectButtonText();
    }
    
    // Update select button text based on selection
    updateSelectButtonText() {
        console.log('updateSelectButtonText called');
        const selectBtn = document.getElementById('select-btn');
        if (!selectBtn) {
            console.log('Select button not found');
            return;
        }
        
        console.log('Selected categories size:', this.selectedCategories.size);
        
        if (this.selectedCategories.size === 0) {
            selectBtn.innerHTML = '<span>Välj kategorier</span>';
            console.log('Updated button text to: Välj kategorier');
        } else {
            const totalQuestions = Array.from(this.selectedCategories).reduce((total, key) => {
                const category = this.dynamicCategories[key];
                return total + (category ? category.questions.length : 0);
            }, 0);
            
            const buttonText = `Starta Quiz <span class="question-count">(${totalQuestions} frågor)</span>`;
            selectBtn.innerHTML = buttonText;
            console.log('Updated button text to:', buttonText);
        }
    }
    
    // Start quiz with selected categories
    startQuizWithSelectedCategories(showMixedTitle = true) {
        console.log('startQuizWithSelectedCategories called with showMixedTitle:', showMixedTitle);
        console.log('Selected categories size:', this.selectedCategories.size);
        
        if (this.selectedCategories.size === 0) {
            alert('Välj minst en kategori för att starta quiz');
            return;
        }
        
        // Show loading state
        const selectBtn = document.getElementById('select-btn');
        if (selectBtn) {
            selectBtn.style.opacity = '0.6';
            selectBtn.style.pointerEvents = 'none';
        }
        
        // Collect all questions from selected categories
        let allQuestions = [];
        console.log('Dynamic categories available:', Object.keys(this.dynamicCategories));
        Array.from(this.selectedCategories).forEach(key => {
            const category = this.dynamicCategories[key];
            console.log('Processing category key:', key, 'Category object:', category);
            if (category && category.questions.length > 0) {
                allQuestions = allQuestions.concat(category.questions);
            }
        });
        
        if (allQuestions.length === 0) {
            alert('Inga frågor tillgängliga för de valda kategorierna');
            // Reset loading state
            if (selectBtn) {
                selectBtn.style.opacity = '1';
                selectBtn.style.pointerEvents = 'auto';
            }
            return;
        }
        
        // Shuffle questions and start quiz
        this.shuffledQuestions = this.shuffleArray(allQuestions);
        this.currentQuestionIndex = 0;
        this.showAnswer = this.settings.alwaysShowAnswer;
        this.selectedAnswer = null;
        
        // Reset score
        this.resetScore();
        
        // Ensure category title is shown initially if score tracking is disabled
        if (!this.settings.scoreTracking) {
            // The title will be set below based on category selection
        }
        
        // Spåra start av multi-kategori quiz-session för Umami Analytics
        const categoryNames = Array.from(this.selectedCategories).map(key => {
            const category = this.dynamicCategories[key];
            return category ? category.name : key;
        });
        
        this.trackEvent('quiz-session-started', {
            category: categoryNames.join(', '),
            totalQuestions: allQuestions.length,
            selectedCategoriesCount: this.selectedCategories.size,
            type: 'multi-category',
            settings: {
                multipleChoice: this.settings.showMultipleChoice,
                timer: this.settings.timer,
                timerDuration: this.settings.timerDuration,
                autoAdvance: this.settings.autoAdvance
            }
        });

        // Nollställ frågeräknare för ny session
        this.questionsAnswered = 0;
        
        // Update UI - visa kategorinamn från CSV-filerna
        console.log('Category names:', categoryNames);
        console.log('showMixedTitle:', showMixedTitle);
        console.log('Selected categories size:', this.selectedCategories.size);
        
        // Om det är bara en kategori, visa bara det namnet
        if (categoryNames.length === 1) {
            const title = categoryNames[0];
            document.getElementById('category-title').textContent = title;
            console.log('Setting single category title:', title);
            
            // Uppdatera URL för direktlänkning (enda kategorin)
            if (this.urlHandler) {
                const categoryKey = Array.from(this.selectedCategories)[0];
                this.urlHandler.updateURL(categoryKey);
            }
        } else {
            // Om det är flera kategorier, lämna titeln tom så att updateCategoryTitleForCurrentQuestion kan hantera den
            // Titeln kommer att uppdateras till den aktuella frågans kategori när frågan laddas
            console.log('Multiple categories selected - title will be set by updateCategoryTitleForCurrentQuestion');
            
            // Uppdatera URL för flera kategorier (använd "mixed" som nyckel)
            if (this.urlHandler) {
                this.urlHandler.updateURL('mixed');
            }
        }
        
        this.showView('quiz');
        this.loadCurrentQuestion(true);
        
        // Exit selection mode (but don't reset loading states since we're starting quiz)
        this.selectionMode = false;
        const shuffleBtn = document.getElementById('shuffle-icon-btn');
        const bottomButtons = document.getElementById('bottom-buttons');
        const container = document.getElementById('dynamic-categories-container');
        
        if (shuffleBtn) shuffleBtn.classList.remove('active');
        if (bottomButtons) bottomButtons.classList.remove('visible');
        if (container) container.classList.remove('selection-mode');
        
        // Remove selection mode from all category buttons
        const categoryBtns = container?.querySelectorAll('.dynamic-category-btn');
        if (categoryBtns) {
            categoryBtns.forEach(btn => {
                btn.classList.remove('selection-mode', 'selected');
                btn.style.opacity = '1';
            });
        }
        
        // Reset button loading states after quiz starts
        if (selectBtn) {
            selectBtn.style.opacity = '1';
            selectBtn.style.pointerEvents = 'auto';
        }
    }
    
    // Start quiz with all categories
    startQuizWithAllCategories() {
        console.log('startQuizWithAllCategories called');
        
        // Show loading state
        const playAllBtn = document.getElementById('play-all-btn');
        if (playAllBtn) {
            playAllBtn.style.opacity = '0.6';
            playAllBtn.style.pointerEvents = 'none';
        }
        
        // Select all available categories
        this.selectedCategories.clear();
        Object.keys(this.dynamicCategories).forEach(key => {
            this.selectedCategories.add(key);
        });
        
        console.log('Selected all categories:', Array.from(this.selectedCategories));
        
        // Spåra start av "Alla kategorier" quiz för Umami Analytics
        this.trackEvent('quiz-session-started', {
            category: 'Alla Kategorier',
            totalQuestions: Object.values(this.dynamicCategories).reduce((sum, cat) => sum + cat.questions.length, 0),
            selectedCategoriesCount: Object.keys(this.dynamicCategories).length,
            type: 'all-categories',
            settings: {
                multipleChoice: this.settings.showMultipleChoice,
                timer: this.settings.timer,
                timerDuration: this.settings.timerDuration,
                autoAdvance: this.settings.autoAdvance
            }
        });
        
        // Start quiz with all categories
        this.startQuizWithSelectedCategories(true); // true = visa kategorinamnen istället för generisk titel
        
        // Reset loading state after quiz starts
        if (playAllBtn) {
            playAllBtn.style.opacity = '1';
            playAllBtn.style.pointerEvents = 'auto';
        }
    }
    

    
    // Update category title based on current question's category
    updateCategoryTitleForCurrentQuestion() {
        console.log('updateCategoryTitleForCurrentQuestion: Called');
        console.log('updateCategoryTitleForCurrentQuestion: scoreTracking =', this.settings.scoreTracking);
        
        // Don't update category title if score tracking is enabled
        if (this.settings.scoreTracking) {
            console.log('updateCategoryTitleForCurrentQuestion: Score tracking enabled, returning');
            return;
        }
        
        const currentQuestion = this.shuffledQuestions[this.currentQuestionIndex];
        if (!currentQuestion) return;
        
        console.log('updateCategoryTitleForCurrentQuestion: currentQuestion =', currentQuestion);
        console.log('updateCategoryTitleForCurrentQuestion: selectedCategory =', this.selectedCategory);
        console.log('updateCategoryTitleForCurrentQuestion: selectedCategories.size =', this.selectedCategories ? this.selectedCategories.size : 'undefined');
        
        // Om vi är i "Blanda"-kategorin ELLER har flera kategorier valda, hitta vilken kategori denna fråga tillhör
        if (this.selectedCategory === 'blandad' || this.selectedCategories.size > 1) {
            // Hitta vilken kategori denna fråga tillhör
            let questionCategory = null;
            
            // Först, kolla om frågan redan har category-information
            console.log('updateCategoryTitleForCurrentQuestion: Checking for category info...');
            console.log('updateCategoryTitleForCurrentQuestion: currentQuestion.category =', currentQuestion.category);
            console.log('updateCategoryTitleForCurrentQuestion: currentQuestion.categoryName =', currentQuestion.categoryName);
            
            if (currentQuestion.category && currentQuestion.categoryName) {
                // Om frågan har category-information, använd den
                questionCategory = {
                    name: currentQuestion.categoryName,
                    key: currentQuestion.category
                };
                console.log('Found category from question data:', currentQuestion.categoryName);
            } else {
                // Fallback: sök i kategorier (gammal metod)
                // Kolla först i dynamiska kategorier
                for (const [key, category] of Object.entries(this.dynamicCategories)) {
                    const foundQuestion = category.questions.find(q => 
                        q.question === currentQuestion.question && 
                        q.correctAnswer === currentQuestion.correctAnswer
                    );
                    if (foundQuestion) {
                        questionCategory = category;
                        break;
                    }
                }
                
                // Om inte hittad i dynamiska kategorier, kolla i huvudkategorier
                if (!questionCategory) {
                    for (const [key, category] of Object.entries(this.categories)) {
                        if (key !== 'blandad') { // Exkludera "Blanda"-kategorin själv
                            const foundQuestion = category.questions.find(q => 
                                q.question === currentQuestion.question && 
                                q.correctAnswer === currentQuestion.correctAnswer
                            );
                            if (foundQuestion) {
                                questionCategory = category;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (questionCategory) {
                // Uppdatera titeln till att visa den aktuella frågans kategori
                document.getElementById('category-title').textContent = questionCategory.name;
                console.log('Updated title to show current category:', questionCategory.name);
                
                // Uppdatera URL för direktlänkning (från aktuell frågas kategori)
                // MEN inte om vi är i "Blanda"-kategorin - den ska behålla sin URL
                if (this.urlHandler && questionCategory.key && this.selectedCategory !== 'blandad') {
                    this.urlHandler.updateURL(questionCategory.key);
                }
            } else {
                console.log('updateCategoryTitleForCurrentQuestion: No questionCategory found');
            }
        } else {
            console.log('updateCategoryTitleForCurrentQuestion: Not in blandad or multi-category mode');
        }
        // Om vi inte är i "Blanda"-kategorin eller har flera kategorier valda, behåll den befintliga titeln
    }

        // Uppdatera "Fler Quiz"-knappen med loading state
    updateFlerQuizButtonLoading(loading = false, count = 0) {
        const btn = document.getElementById('fler-quiz-btn');
        if (!btn) return;
        
        if (loading) {
            // Visa loading state
            btn.innerHTML = `
                <div class="category-content">
                    <div class="category-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="category-info">
                        <h3 class="category-name">Laddar...</h3>
                    </div>
                    <svg class="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            `;
            btn.style.opacity = '0.7';
            btn.style.pointerEvents = 'none';
        } else {
            // Återställ till normal state utan antal kategorier
            btn.innerHTML = `
                <div class="category-content">
                    <div class="category-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-white">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </div>
                    <div class="category-info">
                        <h3 class="category-name">Fler Quiz</h3>
                    </div>
                    <svg class="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            `;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        }
    }

    // Metoden showBackgroundLoadingComplete tas bort eftersom notifikationer inte längre visas

    // ===== UMAMI ANALYTICS TRACKING =====
    
    // Hjälpfunktion för att spåra events
    trackEvent(eventName, data = {}) {
        if (typeof umami !== 'undefined') {
            umami.track(eventName, data);
            console.log('Umami event tracked:', eventName, data);
        }
    }



    // Rensa cache (enkel metod)
    clearCache() {
        try {
            localStorage.removeItem('quizQuestionsCache');
            console.log('✅ Cache rensad');
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
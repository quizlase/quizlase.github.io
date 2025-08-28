/**
 * Dynamisk Sitemap Generator för Quizla
 * Genererar automatiskt sitemap baserat på tillgängliga quiz-kategorier
 */

class SitemapGenerator {
    constructor() {
        this.baseURL = 'https://quizla.se';
        this.categories = [];
        this.lastModified = new Date().toISOString().split('T')[0];
    }

    /**
     * Ladda alla tillgängliga kategorier
     */
    loadCategories() {
        try {
            // Försök läsa kategorier dynamiskt om vi är i Node.js-miljö
            if (typeof require !== 'undefined') {
                const fs = require('fs');
                const path = require('path');
                
                // Läs huvudkategorier från data-mappen
                const dataDir = path.join(__dirname, '..', 'data');
                const dataFiles = fs.readdirSync(dataDir)
                    .filter(file => file.endsWith('.csv'))
                    .map(file => file.replace('.csv', ''));
                
                // Läs kategorier från kategori-mappen
                const kategoriDir = path.join(__dirname, '..', 'data', 'kategori');
                const kategoriFiles = fs.readdirSync(kategoriDir)
                    .filter(file => file.endsWith('.csv'))
                    .map(file => file.replace('.csv', ''));
                
                // Kombinera alla kategorier
                this.categories = [...dataFiles, ...kategoriFiles];
                
                console.log(`✅ Laddade ${this.categories.length} kategorier dynamiskt:`);
                console.log(`   Huvudkategorier: ${dataFiles.join(', ')}`);
                console.log(`   Nische-kategorier: ${kategoriFiles.join(', ')}`);
                
                return this.categories;
            }
        } catch (error) {
            console.error('❌ Fel vid dynamisk läsning av kategorier:', error);
        }
        
        // Fallback till hårdkodade kategorier om dynamisk läsning misslyckas
        return this.loadFallbackCategories();
    }

    /**
     * Fallback om dynamisk läsning misslyckas
     */
    loadFallbackCategories() {
        this.categories = [
            'allmanbildning', 'musik', 'geografi', 'film_tv', 'sport', 'teknik',
            'Andra världskriget', 'Cocktails', 'Dans', 'Design och mode', 'Disney',
            'Djur och natur', 'Flaggor', 'Fotboll', 'Grundämnen', 'Harry Potter',
            'Huvudstäder', 'Jul', 'Kaffe', 'Kungligheter', 'Liverpool FC', 'Mat',
            'Motor', 'Netflix', 'NFL', 'NHL', 'Reklam', 'Rymden', 'Sagan om ringen',
            'Sex and the City', 'Spanska ord', 'Språk', 'Star Wars', 'Svenska synonymer',
            'Sverige', 'Valutor', 'Vänner', 'VM 1994'
        ];
        console.log(`⚠️ Använder fallback-kategorier: ${this.categories.length} st`);
        return this.categories;
    }

    /**
     * Generera sitemap XML
     */
    generateSitemap() {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        // Hemsidan - högsta prioritet
        xml += this.createURL('/', '1.0', 'daily');
        
        // Huvudkategorier - hög prioritet
        this.categories.forEach(category => {
            const cleanCategory = this.cleanCategoryName(category);
            xml += this.createURL(`/quiz/${cleanCategory}`, '0.9', 'weekly');
        });
        
        // Dynamiska kategorier (Fler Quiz) - hög prioritet
        if (typeof AVAILABLE_QUIZ !== 'undefined') {
            AVAILABLE_QUIZ.forEach(quiz => {
                const cleanCategory = this.cleanCategoryName(quiz.name);
                xml += this.createURL(`/quiz/${cleanCategory}`, '0.8', 'weekly');
            });
        }
        
        // Blanda-knappen - hög prioritet
        xml += this.createURL('/blanda', '0.8', 'weekly');
        
        // Fler Quiz - hög prioritet
        xml += this.createURL('/fler-quiz', '0.8', 'weekly');
        
        // Inställningar - låg prioritet
        xml += this.createURL('/installningar', '0.3', 'monthly');
        
        // Generera URL:er för kombinerade kategorier
        this.generateMultiCategoryURLs(xml);

        xml += '</urlset>';
        
        console.log('✅ Sitemap XML genererad');
        return xml;
    }

    /**
     * Generera URL:er för kombinerade kategorier
     */
    generateMultiCategoryURLs(xml) {
        if (typeof AVAILABLE_QUIZ === 'undefined' || AVAILABLE_QUIZ.length < 2) {
            return;
        }

        // Generera populära kombinationer (2-3 kategorier)
        const popularCombinations = [
            ['disney', 'fotboll'],
            ['star-wars', 'rymden'],
            ['musik', 'film'],
            ['sport', 'geografi'],
            ['historia', 'allmanbildning'],
            ['teknik', 'rymden'],
            ['mat', 'kultur'],
            ['språk', 'geografi']
        ];

        popularCombinations.forEach(combination => {
            const combinedKey = combination.join('-');
            xml += this.createURL(`/${combinedKey}`, '0.7', 'weekly');
        });

        console.log('✅ Genererade URL:er för kombinerade kategorier');
    }

    /**
     * Rensa kategorinamn för URL:er
     */
    cleanCategoryName(category) {
        return category.toLowerCase()
            .replace(/[åäö]/g, (match) => {
                return { 'å': 'a', 'ä': 'a', 'ö': 'o' }[match];
            })
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    /**
     * Skapa en URL-entry för sitemap
     */
    createURL(path, priority, changefreq) {
        return `  <url>\n    <loc>${this.baseURL}${path}</loc>\n    <lastmod>${this.lastModified}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    }

    /**
     * Generera och returnera sitemap som sträng
     */
    getSitemap() {
        this.loadCategories();
        return this.generateSitemap();
    }

    /**
     * Generera sitemap för webbläsaren (utan Node.js-specifika funktioner)
     */
    generateBrowserSitemap() {
        this.loadCategories();
        return this.generateSitemap();
    }
}

// Exportera för Node.js (om det finns)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SitemapGenerator;
}

// Exportera för webbläsaren
if (typeof window !== 'undefined') {
    window.SitemapGenerator = SitemapGenerator;
}

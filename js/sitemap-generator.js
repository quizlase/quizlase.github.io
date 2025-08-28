/**
 * Dynamisk Sitemap Generator för Quizla.se
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
        // Huvudkategorier från data-mappen
        this.categories = [
            'allmanbildning',
            'musik', 
            'geografi',
            'film_tv',
            'sport',
            'teknik'
        ];
        
        // Kategorier från kategori-mappen (Fler Quiz)
        const kategoriCategories = [
            'Andra världskriget',
            'Cocktails',
            'Dans',
            'Design och mode',
            'Disney',
            'Djur och natur',
            'Flaggor',
            'Fotboll',
            'Grundämnen',
            'Harry Potter',
            'Huvudstäder',
            'Jul',
            'Kaffe',
            'Kungligheter',
            'Liverpool FC',
            'Mat',
            'Motor',
            'Netflix',
            'NFL',
            'NHL',
            'Reklam',
            'Rymden',
            'Sagan om ringen',
            'Sex and the City',
            'Spanska ord',
            'Språk',
            'Star Wars',
            'Svenska synonymer',
            'Sverige',
            'Valutor',
            'Vänner',
            'VM 1994'
        ];
        
        // Kombinera alla kategorier
        this.categories = this.categories.concat(kategoriCategories);
        
        console.log(`✅ Laddade ${this.categories.length} kategorier`);
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
            xml += this.createURL(`/quiz/${cleanCategory}`, '0.8', 'weekly');
        });
        
        // Blanda-knappen - hög prioritet
        xml += this.createURL('/blanda', '0.9', 'weekly');
        
        // Fler Quiz - hög prioritet
        xml += this.createURL('/fler-quiz', '0.8', 'weekly');
        
        // Inställningar - låg prioritet
        xml += this.createURL('/installningar', '0.3', 'monthly');
        
        xml += '</urlset>';
        
        console.log('✅ Sitemap XML genererad');
        return xml;
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

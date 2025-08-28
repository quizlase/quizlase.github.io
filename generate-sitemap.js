/**
 * Script för att generera sitemap.xml för Quizla
 * Kör: node generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

// Importera SitemapGenerator
const SitemapGenerator = require('./js/sitemap-generator.js');

async function generateSitemap() {
    try {
        console.log('🚀 Startar generering av sitemap...');
        
        // Skapa en ny instans av SitemapGenerator
        const generator = new SitemapGenerator();
        
        // Generera sitemap
        const sitemap = generator.getSitemap();
        
        // Skriv sitemap.xml till fil
        fs.writeFileSync('sitemap.xml', sitemap);
        
        console.log('✅ Sitemap.xml skapad framgångsrikt!');
        console.log(`📁 Filen sparades som: ${path.resolve('sitemap.xml')}`);
        
        // Visa statistik
        const stats = fs.statSync('sitemap.xml');
        console.log(`📊 Filstorlek: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // Kontrollera att filen skapades korrekt
        const fileContent = fs.readFileSync('sitemap.xml', 'utf8');
        if (fileContent.includes('<?xml') && fileContent.includes('</urlset>')) {
            console.log('✅ XML-filen verifierad - korrekt format');
        } else {
            console.log('⚠️  Varning: XML-filen verkar inte ha rätt format');
        }
        
    } catch (error) {
        console.error('❌ Fel vid generering av sitemap:', error.message);
        process.exit(1);
    }
}

// Kör funktionen om scriptet körs direkt
if (require.main === module) {
    generateSitemap();
}

module.exports = { generateSitemap };

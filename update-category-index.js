const fs = require('fs');
const path = require('path');

// Funktion för att uppdatera kategorimappens index
function updateCategoryIndex() {
    const categoryDir = path.join(__dirname, 'data', 'kategori');
    const indexFile = path.join(categoryDir, 'index.json');
    
    try {
        // Läs alla filer i kategorimappen
        const files = fs.readdirSync(categoryDir);
        
        // Filtrera bara CSV-filer (exkludera index.json)
        const csvFiles = files.filter(file => 
            file.toLowerCase().endsWith('.csv') && 
            file !== 'index.json'
        );
        
        // Skapa index-objekt
        const index = {
            lastUpdated: new Date().toISOString(),
            csvFiles: csvFiles.sort() // Sortera alfabetiskt
        };
        
        // Skriv till index.json
        fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
        
        console.log(`✅ Kategori-index uppdaterat!`);
        console.log(`📁 Hittade ${csvFiles.length} CSV-filer:`);
        csvFiles.forEach(file => console.log(`   - ${file}`));
        console.log(`🕒 Senast uppdaterad: ${index.lastUpdated}`);
        
    } catch (error) {
        console.error('❌ Fel vid uppdatering av kategori-index:', error.message);
    }
}

// Kör funktionen
updateCategoryIndex();

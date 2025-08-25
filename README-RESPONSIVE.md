# Quizla - Responsiv CSS-struktur

## Översikt

Denna mapp innehåller en modern, responsiv CSS-struktur för Quizla-webbplatsen med mobile-first approach och välorganiserade breakpoints.

## Mappstruktur

```
/css/
  ├── main.css                    # Huvudfil med imports och grundläggande stilar
  ├── /mobile/
  │   └── mobile.css             # Mobilstilar (360px - 767px)
  ├── /tablet/
  │   └── tablet.css             # Surfplattestilar (768px - 1023px)
  └── /desktop/
      └── desktop.css            # Datorstilar (1024px+)
```

## Breakpoints

### Mobile (360px+)
- **360px** - Små telefoner (bas)
- **375px** - iPhone standard
- **414px** - iPhone Plus/Max

### Tablet (768px+)
- **768px** - iPad portrait
- **768px+ landscape** - iPad landscape optimering

### Desktop (1024px+)
- **1024px** - iPad landscape, mindre laptops
- **1200px** - Desktop
- **1440px** - Större skärmar

## Filbeskrivningar

### `/css/main.css`
- CSS reset/normalize
- CSS-variabler (custom properties)
- Grundläggande typografi
- Utility-klasser
- Imports av enhetspecifika CSS-filer
- Grundstil som gäller för alla enheter

### `/css/mobile/mobile.css`
- Mobile-first approach från 360px
- Grundstil optimerad för små skärmar
- Breakpoints för olika mobilstorlekar
- Touch-optimiserade komponenter

### `/css/tablet/tablet.css`
- Stilar för surfplattor från 768px
- Förbättrad läsbarhet och touch-interaktion
- Optimering för både portrait och landscape

### `/css/desktop/desktop.css`
- Stilar för datorer från 1024px
- Hover-effekter och avancerade animationer
- Layout-optimering för stora skärmar
- High DPI display-stöd

## CSS-variabler

Alla färger, spacing, shadows och transitions är definierade som CSS-variabler i `main.css`:

```css
:root {
    --color-primary: #a855f7;
    --spacing-md: 1rem;
    --radius-md: 0.75rem;
    --transition-normal: 0.3s ease;
}
```

## Användning

### 1. Länka CSS i HTML
```html
<link rel="stylesheet" href="css/main.css">
```

### 2. Testa responsiviteten
Öppna `index-new.html` i webbläsaren och ändra skärmstorlek för att se hur designen anpassas.

### 3. Skärmstorleksindikator
En indikator visas i övre högra hörnet som visar aktuell skärmstorlek och enhetstyp.

## Fördelar med denna struktur

### ✅ **Organiserad kod**
- Separata filer för olika enheter
- Tydliga breakpoints
- Lätt att underhålla

### ✅ **Performance**
- Endast relevant CSS laddas per enhet
- CSS-variabler för konsistent design
- Optimerade animationer per enhet

### ✅ **Mobile-first**
- Börjar med mobilstilar som bas
- Progressivt förbättrar för större skärmar
- Bättre prestanda på mobila enheter

### ✅ **Skalbarhet**
- Enkelt att lägga till nya breakpoints
- Modulär struktur
- Återanvändbara komponenter

## Utveckling

### Lägga till nya breakpoints
1. Uppdatera breakpoint-listan i `main.css`
2. Lägg till stilar i respektive CSS-fil
3. Testa på olika enheter

### Lägga till nya komponenter
1. Definiera grundstil i `main.css`
2. Lägg till enhetsspecifika stilar i respektive fil
3. Använd CSS-variabler för konsistens

### Färgschema
Alla färger är definierade som CSS-variabler i `main.css`. Ändra färgerna där för att uppdatera hela designen.

## Testning

### Responsiv design test
- Använd webbläsarens utvecklarverktyg
- Testa olika skärmstorlekar
- Kontrollera touch-interaktion på mobila enheter

### Prestanda
- Använd Lighthouse för prestanda-test
- Kontrollera CSS-bundle-storlek
- Testa laddningstid på olika enheter

## Kompatibilitet

- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 14+
- **CSS Grid**: Stöds av alla moderna browsers
- **CSS Variables**: Stöds av alla moderna browsers
- **Backdrop-filter**: Stöds av de flesta moderna browsers

## Framtida förbättringar

- [ ] Lägg till `prefers-color-scheme` för ljust/mörkt tema
- [ ] Implementera `prefers-reduced-motion` för tillgänglighet
- [ ] Lägg till stöd för `prefers-contrast` för högre kontrast
- [ ] Implementera CSS Container Queries för mer flexibel layout

## Support

För frågor eller problem med den responsiva strukturen, kontakta utvecklingsteamet.

---

**Skapad av**: Quizla Development Team  
**Senast uppdaterad**: 2025-08-20  
**Version**: 1.0.0


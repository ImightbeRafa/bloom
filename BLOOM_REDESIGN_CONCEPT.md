# Bloom — Dark Premium Redesign Concept

## Direction

Bloom should feel like a modern skincare drop: darker, cleaner, more premium, and much faster to buy. The current page has useful content, but it feels too soft and template-like because the light purple glass cards repeat everywhere. The new direction keeps Bloom's purple identity, but moves it into a dark plum/near-black world with ivory text, clinical mint details, and sharper product-focused layouts.

**Emotional territory:** Dark Premium + Clean Clinical  
**Target customer:** Young skincare buyers in Costa Rica who want acne help that feels discreet, proven, and easy to order.  
**Design principle:** Make the product and offer visible immediately, then keep one purchase path present at every scroll depth.

## Palette

```css
:root {
  --ink: #090611;
  --plum: #14091f;
  --plum-soft: #20102f;
  --violet: #612ce6;
  --violet-soft: #8d6af6;
  --cream: #fff8ef;
  --muted: #b9aec8;
  --line: rgba(255, 248, 239, 0.12);
  --mint: #b7f4df;
  --rose: #ffb7cf;
  --danger: #ff6b7d;
}
```

## Typography

Display: **Fraunces** for premium skincare headlines.  
Body/UI: **Manrope** for clean, modern forms and purchase controls.  
The typography should avoid the overly tech/startup feel. Headlines should feel editorial and expensive; buttons and forms should feel direct.

## UX Changes

1. The hero includes the purchase module above the fold, not just a button to a lower form.
2. A sticky top CTA remains visible on desktop and mobile.
3. The price, discount, shipping promise, and quantity selector sit together so the buyer does not hunt for the offer.
4. UGC/reels appear early as proof, but in a controlled premium frame instead of overwhelming the page.
5. The checkout section becomes a focused two-column purchase area with a sticky order summary.
6. The page alternates dense sections with spacious sections so it feels designed, not stacked.

## Section Blueprint

### 1. Sticky Header

Dark transparent header that becomes solid over scroll. Left: Bloom logo. Center: three short anchors. Right: compact offer CTA, `Ordenar -50%`. Mobile reduces to logo + CTA.

### 2. Hero With Instant Buy

Asymmetric three-column composition. Left column contains the headline, proof badge, and benefit line. Center column shows the product photo large and clean. Right column is a compact purchase card with quantity, price, savings, delivery note, and primary CTA.

CTA placement: one primary button in the hero card, one secondary WhatsApp action below it, sticky CTA in header.

### 3. Proof Strip

Narrow horizontal strip under hero: rating, shipping to Costa Rica, private message/order support, night-use promise. This reassures before the buyer scrolls.

### 4. UGC Gallery

Three vertical video cards using current assets. The middle card is larger. Text stays minimal: "Parches reales, piel real." This keeps the Instagram trust but makes it look curated.

### 5. Benefit Bento

Four cards with mixed sizes. One large "Actua mientras dormis" card, three smaller clinical benefit cards. No repeated identical cards.

### 6. How It Works

Simple three-step horizontal line: clean, apply, sleep. Keep it extremely short.

### 7. Checkout Focus

Two-column layout: form fields on left, sticky order summary on right. The summary repeats product image, quantity, savings, total, and CTA. Mobile stacks summary first, then form.

## Anti-Patterns To Avoid

- Do not use decorative purple blobs or soft floating shapes as the main visual system.
- Do not make every section a centered card.
- Do not hide purchase controls until the bottom of the page.
- Do not over-explain the product before giving the user a way to buy.
- Do not make the whole site only purple; use mint, rose, ivory, and dark neutrals for contrast.
- Do not make UGC look messy; frame it like curated proof.
- Do not use giant rounded cards everywhere; keep the interface sharper and more premium.

## Preview

Open `bloom-redesign-preview.html` in the project root to see the standalone visual mockup. It does not import or modify the production CSS/JS.

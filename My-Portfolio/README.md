# aditya singh, portfolio

My personal site. Plain HTML, CSS and JavaScript, no build step. Open `index.html` or serve the folder with anything static (GitHub Pages works).

## where things live

- `index.html` has all the text. Project cards are in the Work section, and each card's full write up is a `<template id="project-detail-...">` near the bottom of the file, matched by the card's `data-project`.
- `styles.css` has the colours, type and the css side of every animation.
- `script.js` draws the spider web in the hero, the little drawing on each card, and handles the card opening into a panel.

## adding a project

1. Copy one of the `<article class="project-card">` blocks and give it a new `data-project`.
2. Add a `<template id="project-detail-yourname">` with the write up.
3. For the drawing, point `data-illustration` at an existing one or add a new branch in `drawCardIllustration` in `script.js`.

## photo and resume

Drop `assets/aditya.jpg` (portrait, about 4:5) and `assets/Aditya_Singh_Resume.pdf` in. Until they exist the page quietly hides the photo slot and the resume link.

import '@testing-library/jest-dom/vitest'

// jsdom has no layout engine: give the DOM APIs components call while scrolling a no-op body
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

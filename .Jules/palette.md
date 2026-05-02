## 2025-05-15 - Improving Town Page Accessibility and Feedback

**Learning:** Interactive elements like the town title were implemented using non-semantic tags (`h1`) with click handlers, making them inaccessible to keyboard users and screen readers. Additionally, critical actions like buying property lacked immediate feedback for insufficient funds (hiding the button instead of showing it as disabled) and loading states for async operations.

**Action:** Wrap non-semantic interactive elements in buttons, use proper label-input associations, and provide explicit feedback for disabled states and background tasks.

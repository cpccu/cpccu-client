# Project Structure

## Folder Organization
The project follows a standard Vite + React project structure, optimized for modularity.

```
cpccu-client/
├── data/               # Static JSON data files (Source of Truth)
├── docs/               # Project documentation
├── public/             # Static assets (images, icons)
├── src/
│   ├── assets/         # CSS and internal images
│   ├── components/     # React components
│   │   ├── Global/     # Shared components (Cards, Buttons)
│   │   ├── HOME/       # Home page specific components
│   │   ├── Layout/     # Page layout wrappers
│   │   └── ...         # Feature-specific components
│   ├── Context/        # React Context Providers
│   ├── lib/            # Utility functions (e.g., cn.js)
│   ├── App.jsx         # Main application component & routes
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── index.html          # HTML template
├── package.json        # Dependencies and scripts
├── tailwind.config.js  # Tailwind CSS configuration
└── vite.config.js      # Vite configuration
```

## Key Files
- **App.jsx**: Defines the routing structure and major layout boundaries.
- **main.jsx**: Initializes the React app and mounts it to the DOM.
- **lib/cn.js**: A utility for merging Tailwind classes conditionally.
- **data/*.json**: Contains the data rendered by various sections of the site.

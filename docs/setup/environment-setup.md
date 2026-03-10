# Environment Setup

## Configuration Files
The project uses standard Vite environment configuration.

### .env (Optional)
Currently, the project does not strictly require an `.env` file as it relies on static JSON data. However, if you're integrating with a future API, you should create a `.env` file in the root directory.

Example structure for future use:
```env
VITE_API_URL=https://api.cpccu.org/v1
VITE_UPLOAD_KEY=your_upload_js_key
```

### Vite Configuration
The build and dev server settings are located in `vite.config.js`.

### Tailwind Configuration
Styling rules and theme extensions are located in `tailwind.config.js`.

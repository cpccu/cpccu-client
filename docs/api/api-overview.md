# Data Overview

## Source of Truth
The CPCCU Client currently uses a **decentralized data model** where the source of truth is a set of static JSON files located in the `data/` directory.

## Data Integration
Components consume this data through static imports. This bypasses the need for `fetch` or `axios` during the initial phase but retains the same data structures that a future REST API would provide.

## Data Categories
- **Global Data**: Site-wide configuration, headers, and footers.
- **Entity Data**: Specific listings for Alumni, Members, Events, and Blogs.
- **Scroll Data**: Metadata used for linking page sections with scroll targets.

## Future API Roadmap
The "API" layer is abstracted such that replacing these static imports with asynchronous data fetching will require minimal changes to the presentation components.

# Performance Tracking

## Goals
- **Lighthouse Score**: Aiming for >90 in all categories.
- **First Contentful Paint (FCP)**: <1.5 seconds.
- **Cumulative Layout Shift (CLS)**: <0.1.

## Optimization Strategies
- **Vite Build**: Leveraging Rollup's tree-shaking to remove unused code.
- **Asset Optimization**: Using modern image formats (WebP) and responsive image sets.
- **Code Splitting**: Implementing `React.lazy` for route-based chunking.

## Current Performance Issues
- **Bundle Size**: We are monitoring the size of FontAwesome and Jodit packages.
- **JSON Overhead**: As data grows, static JSON imports may increase the initial bundle size. Moving to a paginated API is the planned solution.

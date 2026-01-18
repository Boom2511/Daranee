// Type declarations for CSS imports
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Type declaration for leaflet CSS side-effect import
declare module 'leaflet/dist/leaflet.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/manrope';
import './index.css';
import App from './App.jsx';
import { ThemeProvider } from './lib/theme.jsx';

let initialTheme = 'light';
try {
  const stored = localStorage.getItem('quickdrop-theme');
  initialTheme =
    stored === 'dark' || stored === 'light'
      ? stored
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
} catch {
  initialTheme = 'light';
}

document.documentElement.classList.toggle('dark', initialTheme === 'dark');
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider initialTheme={initialTheme}>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

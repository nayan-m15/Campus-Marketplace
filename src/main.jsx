import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") document.documentElement.classList.add("dark");
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

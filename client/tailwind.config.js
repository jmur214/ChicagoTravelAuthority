/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
            },
            colors: {
                dark: {
                    bg: '#050505',
                    surface: '#121212',
                    border: '#27272a',
                },
                brand: {
                    primary: '#3b82f6',
                    accent: '#8b5cf6',
                }
            }
        },
    },
    plugins: [],
}

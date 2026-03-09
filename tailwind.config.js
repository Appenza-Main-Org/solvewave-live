/** @type {import('tailwindcss').Config} */
const frontendConfig = require("./frontend/tailwind.config.js");

module.exports = {
  ...frontendConfig,
  content: [
    "./frontend/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#faf8f5",
          soft: "#f5f0eb",
          warm: "#f0ebe3",
        },
        brown: {
          DEFAULT: "#5c4033",
          soft: "#8b6f5c",
          muted: "#a08070",
        },
        brand: {
          DEFAULT: "#3d6b45",
          soft: "#5a8f63",
          muted: "#7aad82",
          light: "#e8f0e9",
        },
        gold: {
          DEFAULT: "#c4a35a",
          soft: "#d4b87a",
          muted: "#e0c98a",
        },
        ink: "#1a1a1a",
        soft: "#6b6560",
        line: "#e8e4df",
        danger: "#b54a3a",
      },
      borderRadius: {
        card: "16px",
        control: "12px",
      },
    },
  },
  plugins: [],
};

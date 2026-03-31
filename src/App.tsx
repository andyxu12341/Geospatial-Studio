import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}

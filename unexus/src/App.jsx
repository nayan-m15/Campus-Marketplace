import { useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import CategoryBar from "./components/CategoryBar";
import ListingsGrid from "./components/ListingsGrid";
import Footer from "./components/Footer";
import { ALL_LISTINGS } from "./data/listings";
import "./styles/index.css";

export default function App() {
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [searchQuery, setSearchQuery] = useState("");

  //Get filtered listings 
  const filteredListings = searchQuery.trim()
    ? ALL_LISTINGS.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeCategory === "All Items"
    ? ALL_LISTINGS
    : ALL_LISTINGS.filter((item) => item.category === activeCategory);

  //Clear search when category is selected
  function handleCategoryChange(category) {
    setActiveCategory(category);
    setSearchQuery("");
  }

  return (
    <>
      <header>
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </header>

      <main>
        <section>
          <Hero />

        </section>
        <nav aria-label ="Categories">
          <CategoryBar
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
          />
        </nav>

        <section>
          <ListingsGrid
            listings={filteredListings}
            searchQuery={searchQuery}
            activeCategory={activeCategory}
          />
        </section>

      </main>
      
      <footer>
        <Footer />
      </footer>
      
      
    </>
  );
}

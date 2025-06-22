import { useState } from "react";

// Define an interface for the rental listing structure received from the API
interface ListingDisplay {
  title: string | null;
  image: string | null; // Changed imageUrl to image to match ScrapedListing interface
  price: number | null;
  pricePeriod: string | null;
  location: string | null;
  listingUrl: string | null;
  bedrooms: number | null;
  toilets: number | null;
  // Note: 'description', 'Images', 'agentName', 'agentPhones', 'agentAddress'
  // are part of ScrapedListing but might not be displayed directly here.
  // We'll keep them in the interface if your backend sends them,
  // but only use what's needed for display.
}

export default function Home() {
  const [url, setUrl] = useState<string>("");
  const [startPage, setStartPage] = useState<number>(1); // New state for start page
  const [endPage, setEndPage] = useState<number | string>(""); // New state for end page (can be empty string initially)
  const [loading, setLoading] = useState<boolean>(false);
  const [listings, setListings] = useState<ListingDisplay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setListings([]); // Clear previous listings

    if (!url) {
      setError("Please enter a URL to scrape.");
      setLoading(false);
      return;
    }

    // Basic validation for the URL
    if (url !== 'https://nigeriapropertycentre.com/for-rent') {
      setError("This scraper is configured only for https://nigeriapropertycentre.com/for-rent");
      setLoading(false);
      return;
    }

    // Parse start and end pages, defaulting if invalid or empty
    const parsedStartPage = Math.max(1, parseInt(startPage.toString(), 10) || 1); // Ensure at least 1
    const parsedEndPage = parseInt(endPage.toString(), 10);
    // If endPage is not a valid number or is less than startPage, consider it Infinity or adjust
    const finalEndPage = isNaN(parsedEndPage) || parsedEndPage < parsedStartPage ? Infinity : parsedEndPage;


    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // MODIFIED: Send startPage and endPage in the request body
        body: JSON.stringify({
          url,
          startPage: parsedStartPage,
          endPage: finalEndPage === Infinity ? undefined : finalEndPage // Send undefined for Infinity
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "An unknown error occurred during scraping.");
        setMessage(null);
      } else {
        setListings(data.data || []); // API now returns 'data' which contains the listings array
        setMessage(`Scraping successful! Found ${data.data ? data.data.length : 0} rental listings.`);
        setError(null);
      }
    } catch (err) {
      console.error("Frontend fetch error:", err);
      setError("Failed to connect to the server or an unexpected network error occurred.");
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-6 text-gray-900">
        🏠 Rental Listing Scraper
      </h1>
      <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to scrape (e.g., https://nigeriapropertycentre.com/for-rent)"
          className="border border-gray-300 rounded-lg px-4 py-2 flex-grow focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="number"
            value={startPage}
            onChange={(e) => setStartPage(parseInt(e.target.value, 10) || 1)}
            placeholder="Start Page (e.g., 1)"
            min="1"
            className="border border-gray-300 rounded-lg px-4 py-2 w-full sm:w-1/2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="number"
            value={endPage}
            onChange={(e) => setEndPage(e.target.value === "" ? "" : parseInt(e.target.value, 10) || "")}
            placeholder="End Page (optional)"
            min="1"
            className="border border-gray-300 rounded-lg px-4 py-2 w-full sm:w-1/2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? "Scraping..." : "Scrape Listings"}
        </button>
      </form>

      ---

      {/* --- Feedback Messages --- */}
      {loading && <p className="text-blue-500 mb-4 text-center">Scraping in progress...</p>}
      {error && <p className="text-red-600 mb-4 font-semibold text-center">{error}</p>}
      {message && !error && <p className="text-green-600 mb-4 text-center">{message}</p>}

      ---

      {/* --- Display Listings --- */}
      {listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {listings.map((listing, i) => (
            <div key={i} className="border border-gray-200 rounded-lg shadow-md overflow-hidden flex flex-col">
              <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={listing.image || "https://via.placeholder.com/400x300?text=No+Image"} // Use listing.image
                  alt={listing.title || "Listing Image"}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>
              <div className="p-4 flex-grow flex flex-col">
                <h2 className="font-bold text-xl mb-2 text-gray-800 line-clamp-2" title={listing.title || "N/A"}>
                  {listing.title || "N/A"}
                </h2>
                {listing.location && (
                  <p className="text-gray-600 text-sm mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
                    {listing.location}
                  </p>
                )}

                {listing.price !== null && (
                  <p className="text-green-700 font-extrabold text-2xl mb-2">
                    ₦{listing.price.toLocaleString('en-US')}
                    {listing.pricePeriod && <span className="text-sm text-gray-500 font-normal ml-1">{listing.pricePeriod}</span>}
                  </p>
                )}

                <div className="flex items-center text-gray-700 text-sm mb-4">
                  {listing.bedrooms !== null && (
                    <span className="flex items-center mr-4">
                      <svg className="w-4 h-4 mr-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"></path></svg>
                      {listing.bedrooms} Bed{listing.bedrooms !== 1 ? 's' : ''}
                    </span>
                  )}
                  {listing.toilets !== null && (
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm3 8a1 1 0 100-2 1 1 0 000 2zm1-5a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd"></path></svg>
                      {listing.toilets} Toilet{listing.toilets !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <a
                  href={listing.listingUrl || "#"}
                  className="text-blue-600 hover:underline block text-center bg-blue-100 py-2 rounded-lg font-medium transition-colors duration-200 hover:bg-blue-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Listing
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      ---

      {/* --- No Results Message --- */}
      {!loading && !error && listings.length === 0 && url && (
        <p className="text-gray-600 text-center mt-8">
          No listings found for the given URL, or scraping yielded no results. Please check the URL or the website structure.
        </p>
      )}

      {!url && !loading && !error && listings.length === 0 && (
        <p className="text-gray-600 text-center mt-8">
          Enter a URL and click "Scrape Listings" to begin.
        </p>
      )}
    </main>
  );
}
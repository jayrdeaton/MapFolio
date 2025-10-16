// Test script to verify search functionality for Thailand locations
import { OpenStreetMapProvider } from 'leaflet-geosearch';

const provider = new OpenStreetMapProvider({
  params: {
    'accept-language': 'en',
    addressdetails: 1,
    limit: 5,
  },
});

async function testThailandSearch() {
  console.log('Testing Thailand location search...');
  
  const testQueries = [
    'Chiang Mai, Thailand',
    'Chiang Mai',
    'Bangkok, Thailand',
    'Bangkok',
    'Phuket, Thailand',
    'Thailand'
  ];

  for (const query of testQueries) {
    try {
      console.log(`\nSearching for: "${query}"`);
      const results = await provider.search({ query });
      
      if (results.length > 0) {
        console.log(`✅ Found ${results.length} results:`);
        results.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.label}`);
          console.log(`     Coordinates: ${result.y}, ${result.x}`);
        });
      } else {
        console.log('❌ No results found');
      }
    } catch (error) {
      console.error(`❌ Error searching for "${query}":`, error.message);
    }
  }
}

// Run the test if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - attach to window for manual testing
  window.testThailandSearch = testThailandSearch;
  console.log('Thailand search test function attached to window. Run: testThailandSearch()');
}

export { testThailandSearch };
// Fetch images from brand APIs
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { brands } = req.query;
  
  if (!brands) {
    return res.status(400).json({ error: 'Brands parameter required' });
  }

  const brandList = Array.isArray(brands) ? brands : brands.split(',');
  
  // Dynamic brand validation - accept any brand key
  // The API will handle invalid brands by returning appropriate errors

  try {
    const imagePromises = brandList.map(async (brand) => {
      // Change this URL to any new API they provide
      const response = await fetch(`https://vibemyad.com/api/test-assignment?brand_key=${brand}`);
      // Example for LG: `https://lg-api.com/brands?key=${brand}`
      
      if (!response.ok) {
        // Handle invalid brand keys gracefully
        if (response.status === 404 || response.status === 400) {
          console.warn(`Brand '${brand}' not found or invalid`);
          return {
            brand,
            images: [],
            count: 0,
            error: `Brand '${brand}' not available`
          };
        }
        throw new Error(`Failed to fetch ${brand} images: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success && data.error) {
        console.warn(`API Error for ${brand}: ${data.error}`);
        return {
          brand,
          images: [],
          count: 0,
          error: data.error
        };
      }
      
      return {
        brand,
        images: data.data || [],
        count: data.data?.length || 0
      };
    });

    const results = await Promise.all(imagePromises);
    
    // Filter out failed brands and log warnings
    const successfulResults = results.filter(result => !result.error);
    const failedResults = results.filter(result => result.error);
    
    if (failedResults.length > 0) {
      console.warn('Some brands failed to load:', failedResults.map(r => `${r.brand}: ${r.error}`));
    }
    
    // Flatten all images with brand metadata
    const allImages = successfulResults.flatMap(result => 
      result.images.map((img, index) => ({
        id: `${result.brand}-${index}`,
        brand: result.brand,
        url: img.image_url,
        originalIndex: index
      }))
    );

    const response = {
      success: true,
      totalImages: allImages.length,
      brandCounts: successfulResults.reduce((acc, result) => {
        acc[result.brand] = result.count;
        return acc;
      }, {}),
      failedBrands: failedResults.map(r => ({ brand: r.brand, error: r.error })),
      images: allImages
    };

    res.status(200).json(response);
    
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch images',
      details: error.message 
    });
  }
}
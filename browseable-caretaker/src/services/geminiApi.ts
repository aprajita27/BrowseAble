// Set up the Gemini API base URL
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'; // Replace with actual Gemini API URL
const GEMINI_API_KEY = 'AIzaSyBNguqgksMAivtdyvIo0sxW_c4-oL0vIMw'; // Add your API key here

// Function to generate insights based on a disorder or query
export const generateInsights = async (prompt: string, disorder: string) => {
    // Construct the base prompt for generating activities based on disorder
    let finalPrompt = `
    Suggest two daily routine activities for someone with ${disorder}. For each activity, please include:

A detailed description of the activity.

A specific, useful website link that could help someone to perform this activity 

An image suggestion with a link to an image from a site like Unsplash or Pexels, where the image is related to the activity.

Additionally, suggest two random activities that might help someone with ${disorder}. For each of these random activities, include:

A detailed description.

A specific, useful website link that could help someone to perform this activity

An image suggestion with a link to an image from a site like Unsplash or Pexels, where the image is related to the activity.
    `;
    
    // If the caretaker comment is provided, append it to the prompt
    if (prompt && prompt.trim() !== '') {
        finalPrompt += `\nPlease also consider the following instructions from the caretaker: ${prompt}.`;
    } else {
        console.log("No caretaker comment provided, using basic suggestion format.");
    }

    console.log("Generated final prompt:", finalPrompt); // Debugging: Check the final prompt before API call

    try {
        const response = await fetch(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, // Your API URL and key
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: finalPrompt,  // Use the dynamic prompt
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        if (!response.ok) {
            console.error("API Response failed with status:", response.status); // Debugging: Log failed response
            throw new Error(`Failed to fetch insights: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Gemini API Response Data:", data); // Debugging: Log the raw API response

        // Check if 'candidates' array exists and has at least one element
        if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
            const generatedContent = data.candidates[0].content?.parts?.[0]?.text; // Access content safely
            if (generatedContent) {
                console.log("Successfully received generated content:", generatedContent); // Debugging: Log the content
                return generatedContent; // Return content as an array
            } else {
                // Log if content is missing or malformed
                console.error("Content missing or malformed in the response:", data);
                throw new Error('Content is missing or malformed in the API response');
            }
        } else {
            // Log if 'candidates' is missing or empty
            console.error("Unexpected candidates format:", data);
            throw new Error('Gemini API returned no candidates or unexpected format');
        }
    } catch (error: any) {
        console.error("Error generating insights from Gemini API:", error); // Debugging: Log any error during API call
        throw new Error('Error generating insights');
    }
};

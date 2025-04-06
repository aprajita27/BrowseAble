import React, { useState } from 'react';
import { generateInsights } from '../services/geminiApi'; // Import the service
import './InsightGenerator.css'; // Add this line at the top of the file



interface Activity {
    title: string;         // Title of the activity
    description: string;   // Description of the activity
    imageUrl: string;      // URL of the activity image
    websiteLink: string;   // Link to the related website
}

interface InsightGeneratorProps {
    disorder: any; // Accept disorder as a prop
}

const InsightGenerator: React.FC<InsightGeneratorProps> = ({ disorder }) => {
    const [prompt, setPrompt] = useState('');
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateInsights = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await generateInsights(prompt, disorder);
            console.log("Raw Generated Insights:", result); // Log the raw result from Gemini API

            const rawInsights = result.split('\n'); // Split raw text by newline character
            const activitiesList = [];

            let currentActivity = { title: '', description: '', websiteLink: '', imageUrl: '' };

            rawInsights.forEach((line: string) => {
                if (line.startsWith('Daily Routine Activity') || line.startsWith('Random Activity')) {
                    // Push previous activity before starting new one
                    if (currentActivity.title && currentActivity.description) {
                        activitiesList.push(currentActivity);
                    }

                    // Reset the current activity
                    currentActivity = { title: '', description: '', websiteLink: '', imageUrl: '' };
                    currentActivity.title = line.trim(); // Set the title (activity name)
                } else if (line.startsWith('Description:')) {
                    currentActivity.description = line.replace('Description: ', '').trim(); // Set the description
                } else if (line.startsWith('Website:')) {
                    currentActivity.websiteLink = line.replace('Website: ', '').trim(); // Set the website link
                } else if (line.startsWith('Image:')) {
                    currentActivity.imageUrl = line.replace('Image: ', '').trim(); // Set image suggestion
                }
            });

            // Don't forget to push the last activity if it exists
            if (currentActivity.title && currentActivity.description) {
                activitiesList.push(currentActivity);
            }

            console.log("Final Activities List: ", activitiesList);

            setActivities(activitiesList); // Set the activities in state

        } catch (error: any) {
            setError(error.message); // Set the error state with the error message
            console.error("Error occurred while generating insights:", error); // Log any error
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="insight-generator-container">
            <h2>Generate Insights for Caretaker</h2>
            <div className="input-container">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter a prompt"
                    rows={5}
                    className="prompt-input"
                />
                <button onClick={handleGenerateInsights} disabled={loading}>
                    {loading ? 'Loading...' : 'Generate Insights'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="insights-container">
                {activities.length === 0 ? (
                    <p>No activities available. Please enter a valid prompt.</p>
                ) : (
                    activities.map((activity, index) => (
                        <div key={index} className="activity-card">
                            <h3>{activity.title}</h3>
                            {activity.imageUrl && (
                                <img
                                    src={activity.imageUrl}
                                    alt={activity.title}
                                    className="activity-image"
                                />
                            )}
                            {activity.description && <p>{activity.description}</p>}
                            {activity.websiteLink && (
                                <a
                                    href={activity.websiteLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="activity-link"
                                >
                                    Learn more
                                </a>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default InsightGenerator;

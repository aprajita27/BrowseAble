import React, { useState } from 'react';
import { generateInsights } from '../services/geminiApi'; // Import the service

interface Activity {
    title: string;         // Title of the activity
    description: string;   // Description of the activity
    imageUrl: string;      // URL of the activity image
    websiteLink: string;   // Link to the related website
}

interface InsightGeneratorProps {
    disorder: string; // Accept disorder as a prop
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
            console.log("Generated Insights:", result); // Log the result from Gemini API

            // Assuming result is an array of activities
            // Map the response to activity data
            const activitiesData: Activity[] = result.map((activity: any) => ({
                title: activity.title,
                description: activity.description,
                imageUrl: activity.imageUrl,
                websiteLink: activity.websiteLink
            }));

            setActivities(activitiesData); // Set the activities to the state

        } catch (error: any) {
            setError(error.message); // Set the error state with the error message
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
                            {/* Activity Card */}
                            <h3>{activity.title}</h3>
                            <img src={activity.imageUrl} alt={activity.title} className="activity-image" />
                            <p>{activity.description}</p>
                            <a href={activity.websiteLink} target="_blank" rel="noopener noreferrer">
                                Learn more
                            </a>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default InsightGenerator;

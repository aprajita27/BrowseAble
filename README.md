

# 🧠 BrowseAble — Because Web Should Work for Everyone

> Making the web truly accessible—one user at a time.

## 🚀 Inspiration
The internet isn't built for everyone. Neurodivergent individuals—those with ADHD, Autism, Blindness, and Sensory Processing Disorders—often find traditional web content overwhelming, inaccessible, or unusable. **BrowseAble** asks:  
**Can AI make the web feel right for every mind?**

## 🧩 What It Does
BrowseAble is a Chrome extension that:
- Detects webpage structure in real-time.
- Sends content to **Gemini API** with neurotype-specific prompting.
- Injects a **simplified, adapted overlay** for users with ADHD, Blindness, Autism, or SPD.
- Reads content aloud for Blind users using Chrome TTS.
- Includes a **Caregiver Dashboard** to manage multiple users and access AI-generated insights.

## ⚙️ How We Built It
- **Gemini API (Google Generative AI)** for adaptive content rewriting.
- **Chrome Extension APIs** (Manifest V3).
- **JavaScript (ES6)**, **HTML5/CSS3** for UI and injection.
- **Firebase** for user onboarding and caregiver mode.
- **Chrome TTS API** for audio feedback.

## 🧠 Key Features
- One-click neurotype selection: ADHD, Autism, Blindness, Sensory.
- AI-generated, distraction-free layouts.
- Caregiver portal with prompt-based insights and multi-user support.

## 🧪 Try it Out
- **GitHub**: [[github.com/your-team/browseable](https://github.com/aprajita27/browseable)  ](https://github.com/aprajita27/BrowseAble)
- **Live Demo / Video**: [link-to-demo]

## 🤖 Generative AI Usage
We used Gemini API to:
- Process DOM content chunk-by-chunk.
- Generate accessible summaries based on neurotype rules.
- Return structured JSON for adaptive overlays.

## 💡 What's Next
- Add voice commands and keyboard navigation.
- Support for dyslexia-friendly fonts and contrast settings.
- Real-time Gemini feedback loops.

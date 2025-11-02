# Web Dashboard (Expo Web)

This project is a web-only dashboard built with Expo and React Native Web.

## Get started

- Install Node.js (v18+ recommended), then install dependencies:

  ```bash
  npm install
  ```

- Start the web dev server:

  ```bash
  python -m uvicorn AI_agents.transcations.api_server:app --host 127.0.0.1 --port 8001 --reload
  npx expo start --web
  ```

- The server opens in your browser at a local URL. Edit files under the `app/` directory to iterate.

## Notes

- This project is configured for web-only; Android and iOS-specific scripts and config are removed.
- Firebase is used for authentication and Firestore. Set your credentials in `services/firebaseConfig.js`.
- The side panel navigation is implemented with simple React components; no native navigation libraries are used.

## Learn more

- Expo Web docs: https://docs.expo.dev/workflow/web/
- React Native Web: https://necolas.github.io/react-native-web/

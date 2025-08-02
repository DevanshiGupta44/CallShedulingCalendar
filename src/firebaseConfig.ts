// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyACwB4pRkYCZDXjE8VvhwixxTuc1N-UB2Q",
  authDomain: "healthtickcalender.firebaseapp.com",
  projectId: "healthtickcalender",
  storageBucket: "healthtickcalender.firebasestorage.app",
  messagingSenderId: "913024993722",
  appId: "1:913024993722:web:3ba674c74afe63f1e5f583",
  measurementId: "G-BXEV0H9XMC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export default app;

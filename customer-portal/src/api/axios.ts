import axios from "axios";

const SUPABASE_URL = "https://iaukydzbcdmglqajllei.supabase.co/rest/v1";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdWt5ZHpiY2RtZ2xxYWpsbGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNjQzMzIsImV4cCI6MjEwMjg0MDMzMn0.GxvoOvmGBpVUOeRC2G3nN3POzX02KGD33hmh7joN_dc";

const apiClient = axios.create({
  baseURL: SUPABASE_URL,
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  config.headers["apikey"] = SUPABASE_ANON_KEY;
  
  if (token && token.trim() !== "") {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    config.headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  (error) => {
    if ((error.response?.status === 401 || error.response?.status === 403) && !window.location.pathname.includes("/login")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
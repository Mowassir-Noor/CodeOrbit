import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';
import OAuth2Redirect from './pages/OAuth2Redirect';
import LandingPage from './landing/LandingPage';

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    
    useEffect(() => {
        if (!token) {
            window.location.href = '/login';
        }
    }, [token]);

    return token ? children : null;
};

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/oauth2-redirect" element={<OAuth2Redirect />} />
                <Route 
                    path="/dashboard" 
                    element={
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    } 
                />
                <Route 
                    path="/room/:roomId" 
                    element={
                        <PrivateRoute>
                            <Room />
                        </PrivateRoute>
                    } 
                />
            </Routes>
        </Router>
    );
}

export default App;

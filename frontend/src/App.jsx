import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';
import OAuth2Redirect from './pages/OAuth2Redirect';
import LandingPage from './landing/LandingPage';
import Profile from './pages/Profile';

const OAuthRedirect = () => {
    useEffect(() => {
        window.location.href = '/oauth2/authorization/google';
    }, []);
    return null;
};

const LoginRedirect = () => {
    useEffect(() => {
        window.location.href = '/login';
    }, []);
    return null;
};

const RegisterRedirect = () => {
    useEffect(() => {
        window.location.href = '/register';
    }, []);
    return null;
};

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
                <Route path="/login" element={<LoginRedirect />} />
                <Route path="/register" element={<RegisterRedirect />} />
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
                <Route 
                    path="/profile" 
                    element={
                        <PrivateRoute>
                            <Profile />
                        </PrivateRoute>
                    } 
                />
            </Routes>
        </Router>
    );
}

export default App;

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const OAuth2Redirect = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const username = params.get('username');

        if (token && username) {
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            window.location.href = '/dashboard';
        } else {
            window.location.href = '/login';
        }
    }, [location, navigate]);

    return (
        <div style={styles.container}>
            <h2>Processing login...</h2>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#fff',
    }
};

export default OAuth2Redirect;

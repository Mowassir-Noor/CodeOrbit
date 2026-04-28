import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await authService.login({ username, password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('username', username);
            navigate('/dashboard');
        } catch (err) {
            setError('Invalid username or password');
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:8080/oauth2/authorization/google';
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2>Login to CodeOrbit</h2>
                {error && <p style={styles.error}>{error}</p>}
                <form onSubmit={handleSubmit} style={styles.form}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <button type="submit" style={styles.button}>Login</button>
                </form>
                <button onClick={handleGoogleLogin} style={styles.googleButton}>
                    Login with Google
                </button>
                <p>
                    Don't have an account? <Link to="/register">Register</Link>
                </p>
            </div>
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
    },
    card: {
        backgroundColor: '#252526',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1rem',
    },
    input: {
        padding: '0.8rem',
        borderRadius: '4px',
        border: '1px solid #3c3c3c',
        backgroundColor: '#3c3c3c',
        color: '#fff',
    },
    button: {
        padding: '0.8rem',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#007acc',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '1rem',
    },
    googleButton: {
        padding: '0.8rem',
        borderRadius: '4px',
        border: '1px solid #fff',
        backgroundColor: 'transparent',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '1rem',
        width: '100%',
        marginBottom: '1rem',
    },
    error: {
        color: '#f44336',
        marginBottom: '1rem',
    },
};

export default Login;

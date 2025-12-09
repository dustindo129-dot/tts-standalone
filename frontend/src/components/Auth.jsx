import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

export default function Auth({ onClose, initialMode = 'login' }) {
    const [isLogin, setIsLogin] = useState(initialMode === 'login');
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, signup } = useAuth();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(formData.username, formData.password);
            if (result.success) {
                onClose();
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (formData.password !== formData.confirmPassword) {
                setError('Passwords do not match');
                setLoading(false);
                return;
            }

            if (formData.password.length < 6) {
                setError('Password must be at least 6 characters');
                setLoading(false);
                return;
            }

            const result = await signup(formData.username, formData.password);
            if (result.success) {
                onClose();
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const switchToLogin = () => {
        setIsLogin(true);
        setError('');
        setFormData({
            username: '',
            password: '',
            confirmPassword: ''
        });
    };

    const switchToSignup = () => {
        setIsLogin(false);
        setError('');
        setFormData({
            username: '',
            password: '',
            confirmPassword: ''
        });
    };

    return (
        <div className="auth-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <button className="auth-close" onClick={onClose}>×</button>
                
                <div className="auth-header">
                    <h2>{isLogin ? '🔐 Login' : '📝 Sign Up'}</h2>
                    <p>{isLogin ? 'Welcome back!' : 'Create your account'}</p>
                </div>

                <form onSubmit={isLogin ? handleLogin : handleSignup} className="auth-form">
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Enter username (letters and numbers only)"
                            required
                            minLength={3}
                            maxLength={30}
                            pattern="[a-zA-Z0-9]+"
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Enter password"
                            required
                            minLength={6}
                        />
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirm password"
                                required
                                minLength={6}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="auth-error">
                            ❌ {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="auth-submit"
                        disabled={loading}
                    >
                        {loading ? (
                            '⏳ Please wait...'
                        ) : isLogin ? (
                            '🚀 Login'
                        ) : (
                            '✨ Create Account'
                        )}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isLogin ? (
                        <p>
                            Don't have an account?{' '}
                            <button type="button" onClick={switchToSignup}>Sign up!</button>
                        </p>
                    ) : (
                        <p>
                            Already have an account?{' '}
                            <button type="button" onClick={switchToLogin}>Log in!</button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}


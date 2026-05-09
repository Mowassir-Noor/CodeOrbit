import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { gsap } from 'gsap';

// Optional: you can extract this to api.js, but since it's specific to profile...
const api = axios.create({
    baseURL: '/api/profile',
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
});

const Profile = () => {
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Upload state
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Refs for animations
    const containerRef = useRef(null);
    const heroRef = useRef(null);
    const statsRef = useRef(null);
    const timelineRef = useRef(null);
    const stackRef = useRef(null);
    
    const fetchProfileData = async () => {
        try {
            const [profileRes, statsRes, activityRes] = await Promise.all([
                api.get(''),
                api.get('/stats'),
                api.get('/activity')
            ]);
            setProfile(profileRes.data);
            setStats(statsRes.data);
            setActivity(activityRes.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Failed to load profile data.');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfileData();
    }, []);

    // GSAP animations on load
    useEffect(() => {
        if (!loading && profile) {
            const ctx = gsap.context(() => {
                // Hero entrance
                gsap.fromTo(heroRef.current, 
                    { opacity: 0, y: 30, scale: 0.95 },
                    { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" }
                );

                // Stats entrance
                if (statsRef.current) {
                    gsap.fromTo(statsRef.current.children,
                        { opacity: 0, y: 20 },
                        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "back.out(1.7)", delay: 0.3 }
                    );
                }

                // Timeline entrance
                if (timelineRef.current) {
                    gsap.fromTo(timelineRef.current.children,
                        { opacity: 0, x: -20 },
                        { opacity: 1, x: 0, duration: 0.5, stagger: 0.1, ease: "power2.out", delay: 0.5 }
                    );
                }
                
                // Stack entrance
                if (stackRef.current) {
                    gsap.fromTo(stackRef.current.children,
                        { opacity: 0, scale: 0.8 },
                        { opacity: 1, scale: 1, duration: 0.4, stagger: 0.05, ease: "back.out(2)", delay: 0.6 }
                    );
                }
            }, containerRef);
            return () => ctx.revert();
        }
    }, [loading, profile]);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert('Invalid file type. Only JPG, PNG, and WEBP allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File size exceeds 5MB limit.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            await api.post('/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Refresh profile data to get new image status
            await fetchProfileData();
            
            // Temporary trick to force browser to reload the image bypassing cache
            if (profile && profile.hasImage) {
                 setProfile({...profile, avatarKey: Date.now()});
            }
        } catch (err) {
            console.error(err);
            alert('Failed to upload image.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteImage = async () => {
        if (!confirm('Are you sure you want to delete your profile picture?')) return;
        
        try {
            await api.delete('/image');
            await fetchProfileData();
        } catch (err) {
            alert('Failed to delete image.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0D0D11]">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0D0D11]">
                <div className="glass-panel p-8 text-center border-red-500/30">
                    <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
                    <p className="text-gray-400">{error}</p>
                    <button onClick={() => window.location.href = '/dashboard'} className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-white transition-all">Back to Dashboard</button>
                </div>
            </div>
        );
    }

    const techStack = ['Java', 'Spring Boot', 'React', 'Tailwind CSS', 'WebSockets', 'PostgreSQL', 'Docker', 'TypeScript'];
    const avatarUrl = profile.hasImage 
        ? `/api/profile/image/${profile.username}?t=${profile.avatarKey || Date.now()}`
        : null;

    return (
        <div ref={containerRef} className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-gray-100">
            
            {/* 1. HERO SECTION */}
            <div ref={heroRef} className="glass-panel rounded-3xl overflow-hidden mb-8 relative group">
                {/* Banner background */}
                <div className="h-48 w-full bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-cyan-900/40 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                </div>
                
                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 relative z-10">
                        {/* Avatar Wrapper */}
                        <div className="relative group/avatar">
                            <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-cyan-400 shadow-[0_0_30px_rgba(59,130,246,0.4)] relative">
                                <div className="w-full h-full rounded-full bg-[#0D0D11] overflow-hidden relative flex items-center justify-center">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300 uppercase">
                                            {profile.username.substring(0, 2)}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Hover overlay for upload */}
                                <div 
                                    className="absolute inset-1 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300 cursor-pointer backdrop-blur-sm"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </div>
                                
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/jpeg, image/png, image/webp"
                                    onChange={handleImageUpload}
                                />
                            </div>
                            
                            {/* Online Indicator */}
                            <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-4 border-[#0D0D11] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                        </div>

                        {/* User Info */}
                        <div className="flex-grow text-center sm:text-left">
                            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center sm:justify-start gap-3">
                                {profile.username}
                                <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                                    {profile.provider}
                                </span>
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">{profile.email}</p>
                            <p className="text-gray-500 text-xs mt-2 flex items-center justify-center sm:justify-start gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                Joined {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            {profile.hasImage && (
                                <button onClick={handleDeleteImage} className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all text-sm font-medium">
                                    Remove Avatar
                                </button>
                            )}
                            <button onClick={() => window.location.href = '/dashboard'} className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all text-sm font-medium">
                                Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* 2. STATS SECTION */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            Developer Statistics
                        </h2>
                        <div ref={statsRef} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <StatCard label="Total Rooms" value={stats.totalRooms} icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" color="blue" />
                            <StatCard label="Files Created" value={stats.filesCreated} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="cyan" />
                            <StatCard label="Collaborations" value={stats.collaborations} icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" color="purple" />
                            <StatCard label="Code Executions" value={stats.totalExecutions} icon="M13 10V3L4 14h7v7l9-11h-7z" color="yellow" />
                            <StatCard label="Active Projects" value={stats.activeProjects} icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" color="green" />
                        </div>
                    </div>

                    {/* 3. ACTIVITY TIMELINE */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Recent Activity
                        </h2>
                        <div className="relative border-l border-white/10 ml-3" ref={timelineRef}>
                            {activity.map((item, i) => (
                                <div key={i} className="mb-6 ml-6 relative group">
                                    <span className="absolute -left-[33px] flex items-center justify-center w-6 h-6 rounded-full bg-[#0D0D11] border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)] group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                    </span>
                                    <div className="glass-panel p-4 rounded-xl hover:border-blue-500/30 transition-all duration-300">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-medium text-white text-sm">{item.description}</h3>
                                            <time className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</time>
                                        </div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wide">{item.type}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-8">
                    
                    {/* 4. SKILLS SECTION */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                            Tech Stack
                        </h2>
                        <div className="flex flex-wrap gap-2" ref={stackRef}>
                            {techStack.map(tech => (
                                <span key={tech} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-300 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/40 transition-all duration-300 cursor-default">
                                    {tech}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* 5. SETTINGS SUMMARY */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            Account Settings
                        </h2>
                        <div className="space-y-3">
                            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-black/20 hover:bg-black/40 border border-white/5 transition-colors group">
                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Change Password</span>
                                <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-black/20 hover:bg-black/40 border border-white/5 transition-colors group">
                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Notification Preferences</span>
                                <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-black/20 hover:bg-black/40 border border-white/5 transition-colors group">
                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Theme (Dark)</span>
                                <div className="w-8 h-4 bg-blue-500 rounded-full relative">
                                    <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                                </div>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon, color }) => {
    const colorMap = {
        blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20 shadow-[0_0_15px_rgba(96,165,250,0.15)]',
        cyan: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20 shadow-[0_0_15px_rgba(34,211,238,0.15)]',
        purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20 shadow-[0_0_15px_rgba(192,132,252,0.15)]',
        yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20 shadow-[0_0_15px_rgba(250,204,21,0.15)]',
        green: 'text-green-400 bg-green-400/10 border-green-400/20 shadow-[0_0_15px_rgba(74,222,128,0.15)]',
    };
    
    return (
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col hover:border-white/10 transition-all duration-300 group">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 border ${colorMap[color]} group-hover:scale-110 transition-transform duration-300`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon}></path>
                </svg>
            </div>
            <span className="text-2xl font-bold text-white mb-1 tracking-tight">{value}</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        </div>
    );
};

export default Profile;

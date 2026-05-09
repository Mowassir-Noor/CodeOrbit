import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomService } from '../services/api';

// ── Small modal for "Join by ID" ─────────────────────────────────────────────
const JoinModal = ({ onClose, onJoin }) => {
    const [roomId, setRoomId] = useState('');
    const [error, setError]   = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const id = roomId.trim();
        if (!id) return;

        setLoading(true);
        setError('');
        try {
            // First, try to join the room (become a member)
            await roomService.joinRoom(id);
            onJoin(id);
        } catch (err) {
            if (err.response?.status === 409) {
                // Already a member, just navigate
                onJoin(id);
            } else if (err.response?.status === 404) {
                setError('Room not found. Check the ID and try again.');
            } else if (err.response?.status === 403) {
                setError('You do not have permission to join this room.');
            } else {
                setError('Failed to join room. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Close on backdrop click
    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={handleBackdrop}>
            <div className="glass-panel w-full max-w-md p-8 relative animate-in fade-in zoom-in duration-300">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">Join a Room</h2>
                    <button className="text-gray-400 hover:text-white transition-colors" onClick={onClose}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                    Enter the Room ID shared with you to collaborate in real-time.
                </p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        id="join-room-id-input"
                        type="text"
                        placeholder="Paste Room ID (UUID)"
                        value={roomId}
                        onChange={(e) => { setRoomId(e.target.value); setError(''); }}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        autoFocus
                    />
                    {error && <p className="text-sm text-red-400 m-0">{error}</p>}
                    <button
                        id="join-room-confirm-btn"
                        type="submit"
                        className={`w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium py-3 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all ${loading || !roomId.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                        disabled={loading || !roomId.trim()}
                    >
                        {loading ? 'Checking...' : 'Join Room'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
    const [rooms, setRooms]           = useState([]);
    const [newRoomName, setNewRoomName] = useState('');
    const [showCreate, setShowCreate]  = useState(false);
    const [showJoin, setShowJoin]      = useState(false);
    const [error, setError]            = useState('');
    const [creating, setCreating]      = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const navigate = useNavigate();

    const username = localStorage.getItem('username') || 'User';
    const token = localStorage.getItem('token');

    const fetchRooms = useCallback(async () => {
        try {
            const res = await roomService.getRooms();
            setRooms(res.data);
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setCurrentUserId(payload.userId || null);
            }
        } catch {
            setError('Failed to load rooms.');
        }
    }, [token]);

    useEffect(() => { fetchRooms(); }, [fetchRooms]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;
        setCreating(true);
        setError('');
        try {
            const res = await roomService.createRoom({ name: newRoomName.trim() });
            setRooms(prev => [res.data, ...prev]);
            setNewRoomName('');
            setShowCreate(false);
            window.location.href = `/room/${res.data.id}`;
        } catch {
            setError('Failed to create room.');
        } finally {
            setCreating(false);
        }
    };

    const handleJoin = (id) => { window.location.href = `/room/${id}`; };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

            {/* ── Main content ─────────────────────────────────────────────── */}
            <main className="w-full relative z-10 flex flex-col gap-8">

                {/* Welcome strip */}
                <div className="glass-panel p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
                            Good to see you, <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">{username}</span>
                        </h1>
                        <p className="text-gray-400 text-sm">Open a room below or join one using a shared Room ID.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full md:w-auto">
                        {/* Stats */}
                        <div className="hidden lg:flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl px-4 py-2 mr-4">
                            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
                            <span className="text-gray-300 text-sm font-medium">{rooms.length} Active Rooms</span>
                        </div>

                        {/* Actions */}
                        <button
                            id="open-join-modal-btn"
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium transition-all flex items-center justify-center gap-2"
                            onClick={() => setShowJoin(true)}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                            Join Room
                        </button>
                        <button
                            id="open-create-modal-btn"
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
                            onClick={() => setShowCreate(v => !v)}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            New Room
                        </button>
                    </div>
                </div>

                {/* ── Create room inline panel ─────────────────────────────────── */}
                {showCreate && (
                    <div className="glass-panel p-6 animate-in slide-in-from-top-4 fade-in duration-300 border-l-4 border-l-cyan-400">
                        <form onSubmit={handleCreateRoom} className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                            <div className="flex-grow w-full">
                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Room Name</label>
                                <input
                                    id="new-room-name-input"
                                    type="text"
                                    placeholder="e.g. Interview Prep, Team Sprint..."
                                    value={newRoomName}
                                    onChange={e => setNewRoomName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button
                                    type="button"
                                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 transition-colors"
                                    onClick={() => { setShowCreate(false); setNewRoomName(''); }}
                                >
                                    Cancel
                                </button>
                                <button
                                    id="create-room-submit-btn"
                                    type="submit"
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 font-medium transition-all ${creating ? 'opacity-50' : ''}`}
                                    disabled={creating}
                                >
                                    {creating ? 'Creating...' : 'Create & Enter'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between text-red-400 text-sm animate-in fade-in">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            {error}
                        </div>
                        <button className="hover:text-red-300 transition-colors" onClick={() => setError('')}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                )}

                {/* Section header */}
                <div className="flex items-center justify-between mt-4">
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                        Your Workspaces
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-medium text-gray-300 border border-white/5">{rooms.length}</span>
                    </h2>
                    <button className="text-gray-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5" onClick={fetchRooms} title="Refresh list">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    </button>
                </div>

                {/* Room grid */}
                {rooms.length === 0 ? (
                    <div className="glass-panel p-16 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/10">
                        <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-cyan-400/20 flex items-center justify-center border border-blue-500/30 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No active rooms</h3>
                        <p className="text-gray-400 max-w-sm mb-6">Create a new room to start coding, or join an existing session if you have a Room ID.</p>
                        <button className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all" onClick={() => setShowCreate(true)}>
                            Create First Room
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {rooms.map(room => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                isOwner={room.ownerId === currentUserId}
                                onJoin={() => window.location.href = `/room/${room.id}`}
                                onDelete={async () => {
                                    if (!confirm(`Delete "${room.name}"? This cannot be undone.`)) return;
                                    try {
                                        await roomService.deleteRoom(room.id);
                                        setRooms(prev => prev.filter(r => r.id !== room.id));
                                    } catch {
                                        setError('Failed to delete room.');
                                    }
                                }}
                                onRename={async (newName) => {
                                    try {
                                        const res = await roomService.renameRoom(room.id, newName);
                                        setRooms(prev => prev.map(r => r.id === room.id ? res.data : r));
                                    } catch {
                                        setError('Failed to rename room.');
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* ── Join by ID modal ─────────────────────────────────────────── */}
            {showJoin && (
                <JoinModal
                    onClose={() => setShowJoin(false)}
                    onJoin={(id) => { setShowJoin(false); handleJoin(id); }}
                />
            )}
        </div>
    );
};

// ── Room Card ────────────────────────────────────────────────────────────────
const RoomCard = ({ room, isOwner, onJoin, onDelete, onRename }) => {
    const [editing, setEditing] = useState(false);
    const [renameValue, setRenameValue] = useState(room.name);

    const date = room.createdAt
        ? new Date(room.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';

    const handleRenameSubmit = async (e) => {
        e.preventDefault();
        if (renameValue.trim() && renameValue !== room.name) {
            await onRename(renameValue.trim());
        }
        setEditing(false);
    };

    return (
        <div className="glass-panel p-5 rounded-2xl flex flex-col group hover:border-blue-500/40 hover:shadow-[0_8px_30px_rgba(37,99,235,0.1)] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:text-cyan-400 transition-all duration-300 shadow-inner">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                </div>
                <div className="bg-black/50 border border-white/5 px-2.5 py-1 rounded-md text-xs font-mono text-gray-500">
                    #{room.id.slice(0, 8)}
                </div>
            </div>

            {editing ? (
                <form onSubmit={handleRenameSubmit} className="mb-2">
                    <input
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        autoFocus
                        onBlur={() => { setEditing(false); setRenameValue(room.name); }}
                    />
                </form>
            ) : (
                <h3 
                    className="text-lg font-bold text-white mb-1 truncate cursor-pointer group-hover:text-blue-200 transition-colors" 
                    onDoubleClick={() => isOwner && setEditing(true)}
                    title={isOwner ? "Double-click to rename" : ""}
                >
                    {room.name}
                </h3>
            )}

            <p className="text-xs text-gray-500 mb-6 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {date}
            </p>

            <div className="mt-auto flex gap-2">
                <button
                    id={`join-room-${room.id}-btn`}
                    className="flex-1 bg-white/5 hover:bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium border border-white/10 hover:border-transparent transition-all"
                    onClick={onJoin}
                >
                    Enter Room
                </button>
                {isOwner && (
                    <div className="flex gap-1">
                        <button
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-all"
                            onClick={() => setEditing(true)}
                            title="Rename Room"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all"
                            onClick={onDelete}
                            title="Delete Room"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;

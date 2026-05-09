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
        <div style={modal.backdrop} onClick={handleBackdrop}>
            <div style={modal.box}>
                <div style={modal.header}>
                    <span style={modal.title}>Join a Room</span>
                    <button style={modal.close} onClick={onClose}>✕</button>
                </div>
                <p style={modal.subtitle}>
                    Enter the Room ID shared with you to collaborate in real-time.
                </p>
                <form onSubmit={handleSubmit} style={modal.form}>
                    <input
                        id="join-room-id-input"
                        type="text"
                        placeholder="Paste Room ID (UUID)"
                        value={roomId}
                        onChange={(e) => { setRoomId(e.target.value); setError(''); }}
                        style={modal.input}
                        autoFocus
                    />
                    {error && <p style={modal.error}>{error}</p>}
                    <button
                        id="join-room-confirm-btn"
                        type="submit"
                        style={{ ...modal.btn, opacity: loading ? 0.7 : 1 }}
                        disabled={loading || !roomId.trim()}
                    >
                        {loading ? 'Checking…' : '→  Join Room'}
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
    const navigate = useNavigate();

    const username = localStorage.getItem('username') || 'User';

    const fetchRooms = useCallback(async () => {
        try {
            const res = await roomService.getRooms();
            setRooms(res.data);
        } catch {
            setError('Failed to load rooms.');
        }
    }, []);

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
            // Immediately navigate into the new room
            navigate(`/room/${res.data.id}`);
        } catch {
            setError('Failed to create room.');
        } finally {
            setCreating(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/login');
    };

    const handleJoin = (id) => navigate(`/room/${id}`);

    // ── Avatar initials ──────────────────────────────────────────────────────
    const initials = username.slice(0, 2).toUpperCase();

    return (
        <div style={s.page}>

            {/* ── Topbar ──────────────────────────────────────────────────── */}
            <header style={s.topbar}>
                <div style={s.brand}>
                    <span style={s.brandIcon}>⬡</span>
                    <span style={s.brandName}>CodeOrbit</span>
                </div>

                <div style={s.topActions}>
                    {/* Join by ID */}
                    <button
                        id="open-join-modal-btn"
                        style={s.joinBtn}
                        onClick={() => setShowJoin(true)}
                    >
                        <span style={s.btnIcon}>⤵</span> Join Room
                    </button>

                    {/* Create room */}
                    <button
                        id="open-create-modal-btn"
                        style={s.createBtn}
                        onClick={() => setShowCreate(v => !v)}
                    >
                        <span style={s.btnIcon}>+</span> New Room
                    </button>

                    {/* User avatar + logout */}
                    <div style={s.avatarGroup}>
                        <div style={s.avatar}>{initials}</div>
                        <button id="logout-btn" style={s.logoutBtn} onClick={handleLogout}>
                            Sign out
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Create room inline panel ─────────────────────────────────── */}
            {showCreate && (
                <div style={s.createPanel}>
                    <form onSubmit={handleCreateRoom} style={s.createForm}>
                        <span style={s.createLabel}>Room name</span>
                        <input
                            id="new-room-name-input"
                            type="text"
                            placeholder="e.g. Interview Prep, Team Sprint…"
                            value={newRoomName}
                            onChange={e => setNewRoomName(e.target.value)}
                            style={s.createInput}
                            autoFocus
                            required
                        />
                        <button
                            id="create-room-submit-btn"
                            type="submit"
                            style={{ ...s.createSubmit, opacity: creating ? 0.7 : 1 }}
                            disabled={creating}
                        >
                            {creating ? 'Creating…' : 'Create & Enter'}
                        </button>
                        <button
                            type="button"
                            style={s.createCancel}
                            onClick={() => { setShowCreate(false); setNewRoomName(''); }}
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* ── Main content ─────────────────────────────────────────────── */}
            <main style={s.main}>

                {/* Welcome strip */}
                <div style={s.welcomeStrip}>
                    <div>
                        <h1 style={s.greeting}>Good to see you, <span style={s.greetingName}>{username}</span></h1>
                        <p style={s.greetingSub}>Open a room below or join one using a shared Room ID.</p>
                    </div>
                    <div style={s.statsRow}>
                        <div style={s.statBox}>
                            <span style={s.statNum}>{rooms.length}</span>
                            <span style={s.statLabel}>Rooms</span>
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={s.errorBanner}>
                        ⚠ {error}
                        <button style={s.errorClose} onClick={() => setError('')}>✕</button>
                    </div>
                )}

                {/* Section header */}
                <div style={s.sectionHeader}>
                    <h2 style={s.sectionTitle}>All Rooms</h2>
                    <button style={s.refreshBtn} onClick={fetchRooms} title="Refresh">↻</button>
                </div>

                {/* Room grid */}
                {rooms.length === 0 ? (
                    <div style={s.empty}>
                        <span style={s.emptyIcon}>⬡</span>
                        <p style={s.emptyText}>No rooms yet.</p>
                        <p style={s.emptyHint}>Create one above or join by ID.</p>
                    </div>
                ) : (
                    <div style={s.grid}>
                        {rooms.map(room => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                onJoin={() => navigate(`/room/${room.id}`)}
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
const RoomCard = ({ room, onJoin }) => {
    const [hovered, setHovered] = useState(false);

    const date = room.createdAt
        ? new Date(room.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';

    return (
        <div
            style={{ ...s.card, ...(hovered ? s.cardHover : {}) }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div style={s.cardTop}>
                <span style={s.cardIcon}>⬡</span>
                <span style={s.cardId}>#{room.id}</span>
            </div>
            <h3 style={s.cardName}>{room.name}</h3>
            <p style={s.cardDate}>Created {date}</p>
            <button
                id={`join-room-${room.id}-btn`}
                style={s.cardBtn}
                onClick={onJoin}
            >
                Open Room →
            </button>
        </div>
    );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const s = {
    page: {
        minHeight: '100vh',
        backgroundColor: '#0d0d0f',
        color: '#e1e4e8',
        fontFamily: '"Inter", -apple-system, sans-serif',
    },

    // Topbar
    topbar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        height: '60px',
        backgroundColor: '#161618',
        borderBottom: '1px solid #2a2a2e',
        position: 'sticky',
        top: 0,
        zIndex: 100,
    },
    brand: { display: 'flex', alignItems: 'center', gap: '10px' },
    brandIcon: { fontSize: '22px', color: '#569cd6' },
    brandName: { fontSize: '18px', fontWeight: 700, color: '#e1e4e8', letterSpacing: '-0.3px' },
    topActions: { display: 'flex', alignItems: 'center', gap: '10px' },

    joinBtn: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1px solid #3c3c4e', backgroundColor: 'transparent',
        color: '#9cdcfe', fontSize: '13px', fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
    },
    createBtn: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 16px', borderRadius: '8px',
        border: 'none', backgroundColor: '#569cd6',
        color: '#0d0d0f', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
    },
    btnIcon: { fontSize: '15px', lineHeight: 1 },
    avatarGroup: { display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '6px' },
    avatar: {
        width: '32px', height: '32px', borderRadius: '50%',
        backgroundColor: '#3c4a6e', color: '#9cdcfe',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 700,
    },
    logoutBtn: {
        padding: '5px 10px', borderRadius: '6px',
        border: '1px solid #2a2a2e', backgroundColor: 'transparent',
        color: '#858585', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
    },

    // Create panel
    createPanel: {
        backgroundColor: '#161618',
        borderBottom: '1px solid #2a2a2e',
        padding: '14px 2rem',
    },
    createForm: { display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '700px' },
    createLabel: { fontSize: '13px', color: '#858585', whiteSpace: 'nowrap' },
    createInput: {
        flex: 1, padding: '8px 12px', borderRadius: '8px',
        border: '1px solid #3c3c4e', backgroundColor: '#1e1e22',
        color: '#e1e4e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
    },
    createSubmit: {
        padding: '8px 18px', borderRadius: '8px', border: 'none',
        backgroundColor: '#4ec994', color: '#0d0d0f',
        fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    },
    createCancel: {
        padding: '8px 14px', borderRadius: '8px',
        border: '1px solid #2a2a2e', backgroundColor: 'transparent',
        color: '#858585', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
    },

    // Main
    main: { maxWidth: '1200px', margin: '0 auto', padding: '2.5rem 2rem' },

    // Welcome strip
    welcomeStrip: {
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: '2.5rem',
    },
    greeting: { fontSize: '26px', fontWeight: 700, color: '#e1e4e8', margin: '0 0 6px 0' },
    greetingName: { color: '#569cd6' },
    greetingSub: { margin: 0, color: '#858585', fontSize: '14px' },
    statsRow: { display: 'flex', gap: '12px' },
    statBox: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        backgroundColor: '#161618', border: '1px solid #2a2a2e',
        borderRadius: '10px', padding: '12px 20px', minWidth: '70px',
    },
    statNum: { fontSize: '22px', fontWeight: 700, color: '#9cdcfe' },
    statLabel: { fontSize: '11px', color: '#858585', marginTop: '2px' },

    // Error banner
    errorBanner: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#2d1a1a', border: '1px solid #5a2020',
        borderRadius: '8px', padding: '10px 14px',
        color: '#f48771', fontSize: '14px', marginBottom: '1.5rem',
    },
    errorClose: {
        background: 'none', border: 'none', color: '#f48771',
        cursor: 'pointer', fontSize: '14px', padding: '0 4px',
    },

    // Section header
    sectionHeader: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.2rem',
    },
    sectionTitle: { margin: 0, fontSize: '16px', fontWeight: 600, color: '#c8c8d0' },
    refreshBtn: {
        background: 'none', border: 'none', color: '#569cd6',
        fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '4px 6px',
    },

    // Empty state
    empty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '5rem 0', gap: '10px',
    },
    emptyIcon: { fontSize: '48px', color: '#2a2a2e' },
    emptyText: { margin: 0, fontSize: '16px', color: '#555' },
    emptyHint: { margin: 0, fontSize: '13px', color: '#444' },

    // Grid
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '1.2rem',
    },

    // Room card
    card: {
        backgroundColor: '#161618',
        border: '1px solid #2a2a2e',
        borderRadius: '12px',
        padding: '1.4rem',
        display: 'flex', flexDirection: 'column', gap: '8px',
        transition: 'border-color 0.15s, transform 0.15s',
        cursor: 'default',
    },
    cardHover: {
        borderColor: '#569cd6',
        transform: 'translateY(-2px)',
    },
    cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    cardIcon: { fontSize: '20px', color: '#569cd6' },
    cardId: {
        fontSize: '11px', color: '#555', backgroundColor: '#1e1e22',
        border: '1px solid #2a2a2e', borderRadius: '4px', padding: '2px 6px',
    },
    cardName: { margin: '4px 0 0', fontSize: '16px', fontWeight: 600, color: '#e1e4e8' },
    cardDate: { margin: 0, fontSize: '12px', color: '#555' },
    cardBtn: {
        marginTop: '10px', padding: '8px 0', borderRadius: '8px',
        border: 'none', backgroundColor: '#569cd6',
        color: '#0d0d0f', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', width: '100%',
    },
};

// ── Join Modal Styles ────────────────────────────────────────────────────────
const modal = {
    backdrop: {
        position: 'fixed', inset: 0, zIndex: 999,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
    },
    box: {
        backgroundColor: '#161618',
        border: '1px solid #2a2a2e',
        borderRadius: '14px',
        padding: '2rem',
        width: '100%', maxWidth: '400px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '8px',
    },
    title: { fontSize: '17px', fontWeight: 700, color: '#e1e4e8' },
    close: {
        background: 'none', border: 'none', color: '#555',
        fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: '4px',
    },
    subtitle: { margin: '0 0 1.5rem', fontSize: '13px', color: '#858585' },
    form: { display: 'flex', flexDirection: 'column', gap: '12px' },
    input: {
        padding: '10px 14px', borderRadius: '8px',
        border: '1px solid #3c3c4e', backgroundColor: '#1e1e22',
        color: '#e1e4e8', fontSize: '15px', fontFamily: 'inherit', outline: 'none',
        MozAppearance: 'textfield',
    },
    error: { margin: 0, color: '#f48771', fontSize: '13px' },
    btn: {
        padding: '10px', borderRadius: '8px', border: 'none',
        backgroundColor: '#569cd6', color: '#0d0d0f',
        fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    },
};

export default Dashboard;

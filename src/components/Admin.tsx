import { useState, useEffect, useCallback } from 'react'
import { ENTRY_EMOJIS, type GuestbookEmoji } from '../guestbook/contracts'

interface AdminEntry {
  id: string
  nickname: string
  message: string
  emoji: string | null
  photoKey: string | null
  photoStatus: string
  hidden: number
  createdAt: number
  photoUrl: string | null
  reactions: { emoji: string; total: number }[]
}

export function Admin() {
  const [password, setPassword] = useState(() => localStorage.getItem('nnm_admin_password') ?? '')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [entries, setEntries] = useState<AdminEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editMessage, setEditMessage] = useState('')
  const [editEmoji, setEditEmoji] = useState<string>('')
  const [editPhotoStatus, setEditPhotoStatus] = useState<string>('none')

  const fetchEntries = useCallback(async (token: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/guestbook/admin', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.status === 401) {
        setIsAuthorized(false)
        localStorage.removeItem('nnm_admin_password')
        setError('Incorrect password.')
        return
      }
      if (!response.ok) {
        const payload: any = await response.json().catch(() => ({}))
        throw new Error(payload.error || `HTTP error ${response.status}`)
      }
      const data = await response.json()
      setEntries(data.entries || [])
      setIsAuthorized(true)
      localStorage.setItem('nnm_admin_password', token)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch comments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (password) {
      void fetchEntries(password)
    }
  }, [password, fetchEntries])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordInput.trim() === '') return
    setPassword(passwordInput)
  }

  const handleLogout = () => {
    setPassword('')
    setIsAuthorized(false)
    setEntries([])
    localStorage.removeItem('nnm_admin_password')
  }

  const updateEntry = async (id: string, updates: Partial<AdminEntry>) => {
    try {
      const response = await fetch('/api/guestbook/admin', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ id, ...updates }),
      })
      if (!response.ok) {
        const payload: any = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to update entry')
      }
      
      // Update local state
      setEntries((current) =>
        current.map((item) => (item.id === id ? { ...item, ...updates } : item))
      )
    } catch (err: any) {
      alert(err.message || 'Failed to save changes.')
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this comment?')) return
    try {
      const response = await fetch(`/api/guestbook/admin?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${password}`,
        },
      })
      if (!response.ok) {
        const payload: any = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to delete entry')
      }
      
      // Remove from local state
      setEntries((current) => current.filter((item) => item.id !== id))
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment.')
    }
  }

  const startEdit = (entry: AdminEntry) => {
    setEditingId(entry.id)
    setEditNickname(entry.nickname)
    setEditMessage(entry.message)
    setEditEmoji(entry.emoji || '')
    setEditPhotoStatus(entry.photoStatus)
  }

  const saveEdit = async (entry: AdminEntry) => {
    if (editNickname.trim() === '' || editMessage.trim() === '') {
      alert('Nickname and message are required.')
      return
    }
    await updateEntry(entry.id, {
      nickname: editNickname,
      message: editMessage,
      emoji: editEmoji || null,
      photoStatus: editPhotoStatus,
    })
    setEditingId(null)
  }

  const moveUp = async (index: number) => {
    if (index === 0) return
    const current = entries[index]
    const above = entries[index - 1]
    const newTime = above.createdAt + 1000
    
    // Optimistically swap locally for smooth UI feel
    setEntries((currentList) => {
      const nextList = [...currentList]
      nextList[index] = { ...above, createdAt: current.createdAt }
      nextList[index - 1] = { ...current, createdAt: newTime }
      return nextList
    })

    await updateEntry(current.id, { createdAt: newTime })
  }

  const moveDown = async (index: number) => {
    if (index === entries.length - 1) return
    const current = entries[index]
    const below = entries[index + 1]
    const newTime = below.createdAt - 1000

    // Optimistically swap locally for smooth UI feel
    setEntries((currentList) => {
      const nextList = [...currentList]
      nextList[index] = { ...below, createdAt: current.createdAt }
      nextList[index + 1] = { ...current, createdAt: newTime }
      return nextList
    })

    await updateEntry(current.id, { createdAt: newTime })
  }

  if (!isAuthorized) {
    return (
      <div className="admin-login-container">
        <form className="admin-login-form" onSubmit={handleLogin}>
          <h2>Nanami Cat Admin</h2>
          <p className="admin-login-hint">Please enter the password to access moderation controls.</p>
          <input
            type="password"
            placeholder="Admin Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            required
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login'}
          </button>
          {error && <p className="admin-login-error">{error}</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div className="admin-header__brand">
          <h1>Nanami Cat Moderation</h1>
          <span className="admin-badge">ADMIN</span>
        </div>
        <div className="admin-header__actions">
          <button onClick={handleLogout} className="admin-btn admin-btn--secondary">Logout</button>
          <a href="/" className="admin-btn admin-btn--primary">View Site</a>
        </div>
      </header>

      <main className="admin-content">
        {loading && entries.length === 0 ? (
          <p className="admin-loading">Loading comments...</p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time / Info</th>
                  <th>Stamp</th>
                  <th>Author & Message</th>
                  <th>Photo</th>
                  <th>Reorder</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const isEditing = editingId === entry.id
                  return (
                    <tr key={entry.id} className={`admin-row ${entry.hidden ? 'admin-row--hidden' : ''}`}>
                      <td className="admin-cell-time">
                        <small className="admin-id-label">{entry.id.substring(0, 8)}</small>
                        <time>{new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })}</time>
                      </td>
                      
                      <td className="admin-cell-stamp">
                        {isEditing ? (
                          <select
                            value={editEmoji}
                            onChange={(e) => setEditEmoji(e.target.value)}
                            className="admin-select"
                          >
                            <option value="">None</option>
                            {ENTRY_EMOJIS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="admin-stamp-preview">{entry.emoji || '—'}</span>
                        )}
                      </td>

                      <td className="admin-cell-message">
                        {isEditing ? (
                          <div className="admin-edit-fields">
                            <input
                              type="text"
                              value={editNickname}
                              onChange={(e) => setEditNickname(e.target.value)}
                              className="admin-input"
                              placeholder="Nickname"
                            />
                            <textarea
                              value={editMessage}
                              onChange={(e) => setEditMessage(e.target.value)}
                              className="admin-textarea"
                              placeholder="Message"
                            />
                          </div>
                        ) : (
                          <div className="admin-message-display">
                            <strong>{entry.nickname}</strong>
                            <p>{entry.message}</p>
                            {entry.reactions.length > 0 && (
                              <div className="admin-reactions-list">
                                {entry.reactions.map((react) => (
                                  <span key={react.emoji} className="admin-reaction-badge">
                                    {react.emoji} {react.total}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="admin-cell-photo">
                        {entry.photoUrl ? (
                          <div className="admin-photo-container">
                            <img src={entry.photoUrl} alt="" className="admin-photo-preview" />
                            {isEditing ? (
                              <select
                                value={editPhotoStatus}
                                onChange={(e) => setEditPhotoStatus(e.target.value)}
                                className="admin-select"
                              >
                                <option value="none">None</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            ) : (
                              <span className={`photo-status-badge photo-status-badge--${entry.photoStatus}`}>
                                {entry.photoStatus}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="admin-text-muted">—</span>
                        )}
                      </td>

                      <td className="admin-cell-order">
                        <div className="admin-order-buttons">
                          <button
                            disabled={index === 0}
                            onClick={() => moveUp(index)}
                            title="Move Up"
                            className="admin-order-btn"
                          >
                            ▲
                          </button>
                          <button
                            disabled={index === entries.length - 1}
                            onClick={() => moveDown(index)}
                            title="Move Down"
                            className="admin-order-btn"
                          >
                            ▼
                          </button>
                        </div>
                      </td>

                      <td className="admin-cell-status">
                        <button
                          onClick={() => updateEntry(entry.id, { hidden: entry.hidden ? 0 : 1 })}
                          className={`status-toggle-btn status-toggle-btn--${entry.hidden ? 'hidden' : 'visible'}`}
                        >
                          {entry.hidden ? 'Hidden' : 'Visible'}
                        </button>
                      </td>

                      <td className="admin-cell-actions">
                        {isEditing ? (
                          <div className="admin-actions-group">
                            <button onClick={() => saveEdit(entry)} className="admin-btn admin-btn--save">Save</button>
                            <button onClick={() => setEditingId(null)} className="admin-btn admin-btn--cancel">Cancel</button>
                          </div>
                        ) : (
                          <div className="admin-actions-group">
                            <button onClick={() => startEdit(entry)} className="admin-btn admin-btn--edit">Edit</button>
                            <button onClick={() => deleteEntry(entry.id)} className="admin-btn admin-btn--delete">Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

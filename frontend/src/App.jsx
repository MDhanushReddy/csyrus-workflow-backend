import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000/api'

const statusStyles = {
  PENDING: { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  APPROVED: { bg: '#ecfdf3', color: '#15803d', border: '#86efac' },
  REJECTED: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
}

export default function App() {
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    reviewerId: '',
  })
  const [reviewForm, setReviewForm] = useState({
    requestId: '',
    action: 'APPROVED',
    comments: '',
  })
  const [editingRequestId, setEditingRequestId] = useState(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    reviewerId: '',
  })

  const stats = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((r) => r.status === 'PENDING').length
    const approved = requests.filter((r) => r.status === 'APPROVED').length
    const rejected = requests.filter((r) => r.status === 'REJECTED').length
    return { total, pending, approved, rejected }
  }, [requests])

  const isReviewer = (user?.role || '').toLowerCase() === 'reviewer'

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === Number(selectedRequestId)) || null,
    [requests, selectedRequestId],
  )

  const loadData = async () => {
    try {
      const usersRes = await axios.get(`${API_BASE}/users`, { withCredentials: true })
      setUsers(usersRes.data)

      const endpoint = isReviewer
        ? `${API_BASE}/reviewer/requests`
        : `${API_BASE}/requests`
      const requestsRes = await axios.get(endpoint, { withCredentials: true })
      setRequests(requestsRes.data)
    } catch (error) {
      console.error(error)
    }
  }

  const loadSession = async () => {
    try {
      setAuthLoading(true)
      const response = await axios.get(`${API_BASE}/auth/me`, { withCredentials: true })
      setUser(response.data)
    } catch (error) {
      setUser(null)
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    loadSession()
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [authLoading, user])

  const handleRequestSubmit = async (e) => {
    e.preventDefault()
    try {
      if (!form.title || !form.description || !user) return
      const reviewerId = form.reviewerId ? Number(form.reviewerId) : null

      await axios.post(
        `${API_BASE}/requests`,
        {
          title: form.title,
          description: form.description,
          priority: form.priority,
          created_by: user.id,
          reviewer_id: reviewerId,
        },
        { withCredentials: true },
      )

      setForm({
        title: '',
        description: '',
        priority: 'MEDIUM',
        reviewerId: '',
      })
      await loadData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    try {
      if (!reviewForm.requestId || !user || !isReviewer) return

      const requestId = Number(reviewForm.requestId)
      const endpoint = reviewForm.action === 'APPROVED'
        ? `${API_BASE}/reviewer/requests/${requestId}/approve`
        : `${API_BASE}/reviewer/requests/${requestId}/reject`

      await axios.post(
        `${endpoint}${reviewForm.comments ? `?comments=${encodeURIComponent(reviewForm.comments)}` : ''}`,
        {},
        { withCredentials: true },
      )

      setReviewForm({
        requestId: '',
        action: 'APPROVED',
        comments: '',
      })
      await loadData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleViewRequest = (requestId) => {
    setSelectedRequestId(requestId)
  }

  const startEditing = (request) => {
    setEditingRequestId(request.id)
    setEditForm({
      title: request.title,
      description: request.description,
      priority: request.priority,
      reviewerId: request.reviewer_id || '',
    })
  }

  const handleUpdateRequest = async (e) => {
    e.preventDefault()
    if (!editingRequestId || !user) return

    try {
      await axios.put(
        `${API_BASE}/requests/${editingRequestId}`,
        {
          title: editForm.title,
          description: editForm.description,
          priority: editForm.priority,
          created_by: user.id,
          reviewer_id: editForm.reviewerId ? Number(editForm.reviewerId) : null,
        },
        { withCredentials: true },
      )
      setEditingRequestId(null)
      await loadData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteRequest = async (requestId) => {
    try {
      await axios.delete(`${API_BASE}/requests/${requestId}`, { withCredentials: true })
      await loadData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:8000/api/auth/google/login'
  }

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true })
      setUser(null)
      window.location.reload()
    } catch (error) {
      console.error(error)
    }
  }

  if (authLoading) {
    return <div style={loadingStyle}>Loading session...</div>
  }

  return (
    <div style={{ background: '#f5f7fb', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header
          style={{
            background: 'linear-gradient(90deg, #0f172a, #1d4ed8)',
            color: '#fff',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 24,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Workflow Hub
              </p>
              <h1 style={{ margin: '8px 0 0', fontSize: 32 }}>Approval Management System</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {user && (
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    color: '#e2e8f0',
                    borderRadius: 999,
                    padding: '8px 12px',
                    fontSize: 13,
                  }}
                >
                  {isReviewer ? 'Reviewer mode' : 'Requester mode'}
                </span>
              )}
              {user ? (
                <button style={logoutButtonStyle} onClick={handleLogout}>
                  Logout
                </button>
              ) : (
                <button style={loginButtonStyle} onClick={handleGoogleLogin}>
                  Login with Google
                </button>
              )}
            </div>
          </div>
        </header>

        {!user ? (
          <section style={emptyStateStyle}>
            <h2 style={{ marginTop: 0 }}>Welcome</h2>
            <p style={{ marginBottom: 16 }}>
              Please sign in with Google to access the workflow dashboard.
            </p>
            <button style={loginButtonStyle} onClick={handleGoogleLogin}>
              Continue with Google
            </button>
          </section>
        ) : isReviewer ? (
          <>
            <section style={{ ...panelStyle, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <p style={{ margin: 0, color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Reviewer</p>
                  <h2 style={{ margin: '6px 0 0' }}>{user.name}</h2>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={statPillStyle}>Pending: {stats.pending}</div>
                  <div style={statPillStyle}>Approved: {stats.approved}</div>
                </div>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 24 }}>
              <div style={panelStyle}>
                <h3 style={{ marginTop: 0 }}>Pending requests</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {requests.map((request) => (
                    <button
                      key={request.id}
                      onClick={() => handleViewRequest(request.id)}
                      style={{
                        ...requestListButtonStyle,
                        borderColor: selectedRequestId === String(request.id) ? '#2563eb' : '#e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <strong>{request.title}</strong>
                        <span style={{ ...statusBadgeStyle, ...statusStyles[request.status] }}>{request.status}</span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
                        Priority: {request.priority}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={panelStyle}>
                {selectedRequest ? (
                  <>
                    <h3 style={{ marginTop: 0 }}>{selectedRequest.title}</h3>
                    <p style={{ color: '#475569' }}>{selectedRequest.description}</p>
                    <div style={{ display: 'grid', gap: 8, color: '#64748b', fontSize: 13 }}>
                      <span>Priority: {selectedRequest.priority}</span>
                      <span>Requester ID: {selectedRequest.created_by}</span>
                      <span>Reviewer ID: {selectedRequest.reviewer_id ?? 'None'}</span>
                    </div>
                    <form onSubmit={handleReviewSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                      <select
                        style={inputStyle}
                        value={reviewForm.requestId}
                        onChange={(e) => setReviewForm({ ...reviewForm, requestId: e.target.value })}
                      >
                        <option value="">Select request</option>
                        {requests.map((request) => (
                          <option key={request.id} value={request.id}>
                            {request.title}
                          </option>
                        ))}
                      </select>
                      <select
                        style={inputStyle}
                        value={reviewForm.action}
                        onChange={(e) => setReviewForm({ ...reviewForm, action: e.target.value })}
                      >
                        <option value="APPROVED">Approve</option>
                        <option value="REJECTED">Reject</option>
                      </select>
                      <textarea
                        style={{ ...inputStyle, minHeight: 100 }}
                        placeholder="Add comment explaining your decision"
                        value={reviewForm.comments}
                        onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                      />
                      <button style={buttonStyle} type="submit">Submit decision</button>
                    </form>
                  </>
                ) : (
                  <div style={{ color: '#64748b' }}>Select a request to review details.</div>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <section style={{ ...panelStyle, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 16 }}>
                <div>
                  <p style={{ margin: 0, color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Requester</p>
                  <h2 style={{ margin: '6px 0 0' }}>{user.name}</h2>
                  <p style={{ color: '#64748b', marginBottom: 0 }}>{user.email}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div style={statCardStyle}><strong>{stats.total}</strong><span>Total</span></div>
                  <div style={statCardStyle}><strong>{stats.pending}</strong><span>Pending</span></div>
                  <div style={statCardStyle}><strong>{stats.approved}</strong><span>Approved</span></div>
                  <div style={statCardStyle}><strong>{stats.rejected}</strong><span>Rejected</span></div>
                </div>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 24 }}>
              <div style={panelStyle}>
                <h3 style={{ marginTop: 0 }}>Create request</h3>
                <form onSubmit={handleRequestSubmit} style={{ display: 'grid', gap: 12 }}>
                  <input
                    style={inputStyle}
                    placeholder="Request title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                  <textarea
                    style={{ ...inputStyle, minHeight: 120 }}
                    placeholder="Request description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                  <select
                    style={inputStyle}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                  <select
                    style={inputStyle}
                    value={form.reviewerId}
                    onChange={(e) => setForm({ ...form, reviewerId: e.target.value })}
                  >
                    <option value="">Select reviewer (optional)</option>
                    {users.map((userItem) => (
                      <option key={userItem.id} value={userItem.id}>
                        {userItem.name} ({userItem.email})
                      </option>
                    ))}
                  </select>
                  <button style={buttonStyle} type="submit">Create request</button>
                </form>
              </div>

              <div style={panelStyle}>
                <h3 style={{ marginTop: 0 }}>My requests</h3>
                <div style={{ display: 'grid', gap: 14 }}>
                  {requests.map((request) => (
                    <div key={request.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: 0 }}>{request.title}</h3>
                          <p style={{ margin: '10px 0', color: '#475569' }}>{request.description}</p>
                          <div style={{ color: '#64748b', fontSize: 13 }}>
                            Reviewer: {request.reviewer_id ?? 'None'} | Priority: {request.priority}
                          </div>
                        </div>
                        <span style={{ ...statusBadgeStyle, ...statusStyles[request.status] }}>{request.status}</span>
                      </div>

                      {editingRequestId === request.id ? (
                        <form onSubmit={handleUpdateRequest} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                          <input
                            style={inputStyle}
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          />
                          <textarea
                            style={{ ...inputStyle, minHeight: 90 }}
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          />
                          <select
                            style={inputStyle}
                            value={editForm.priority}
                            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                          </select>
                          <select
                            style={inputStyle}
                            value={editForm.reviewerId}
                            onChange={(e) => setEditForm({ ...editForm, reviewerId: e.target.value })}
                          >
                            <option value="">Select reviewer (optional)</option>
                            {users.map((userItem) => (
                              <option key={userItem.id} value={userItem.id}>
                                {userItem.name} ({userItem.email})
                              </option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button style={buttonStyle} type="submit">Save</button>
                            <button style={secondaryButtonStyle} type="button" onClick={() => setEditingRequestId(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button style={buttonStyle} onClick={() => startEditing(request)}>
                            Edit
                          </button>
                          <button style={deleteButtonStyle} onClick={() => handleDeleteRequest(request.id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

const panelStyle = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const buttonStyle = {
  padding: '12px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#e2e8f0',
  color: '#0f172a',
}

const deleteButtonStyle = {
  ...buttonStyle,
  background: '#fee2e2',
  color: '#b91c1c',
}

const loginButtonStyle = {
  ...buttonStyle,
  background: '#fff',
  color: '#2563eb',
}

const logoutButtonStyle = {
  ...buttonStyle,
  background: '#ef4444',
}

const statCardStyle = {
  background: '#f8fafc',
  borderRadius: 12,
  padding: '10px 12px',
  display: 'grid',
  gap: 4,
  textAlign: 'center',
}

const statPillStyle = {
  background: '#eef2ff',
  color: '#1d4ed8',
  borderRadius: 999,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
}

const requestListButtonStyle = {
  width: '100%',
  textAlign: 'left',
  padding: 14,
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#fff',
  cursor: 'pointer',
}

const statusBadgeStyle = {
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'capitalize',
}

const emptyStateStyle = {
  ...panelStyle,
  textAlign: 'center',
  padding: '48px 24px',
}

const loadingStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  color: '#334155',
}


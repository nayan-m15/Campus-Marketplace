// Main structure for the staff management feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect } from "react";
import "../styles/AdminDashboard.css";
import { supabase } from "../supabaseClient";

// ── Staff Management Panel Component ─────────────────────────────────────
export default function StaffManagementPanel() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
  });

  // Form validation state
  const [formErrors, setFormErrors] = useState({});

  // Fetch staff members
  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "staff")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
      showToastMessage("Failed to load staff members", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Filter staff based on search
  const filteredStaff = staff.filter(
    (member) =>
      member.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Form validation
  const validateForm = () => {
    const errors = {};

    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 8) {
      errors.password = "Password must be at least 8 characters long";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = "Password must contain uppercase, lowercase, and numbers";
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    // Check for duplicate email
    const existingEmail = staff.find(
      (member) => member.email?.toLowerCase() === formData.email.toLowerCase()
    );
    if (existingEmail) {
      errors.email = "A staff member with this email already exists";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            display_name: formData.fullName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile entry with staff role
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: authData.user.id,
            email: formData.email,
            display_name: formData.fullName,
            name: formData.fullName,
            phone: formData.phoneNumber || null,
            role: "staff",
            created_at: new Date().toISOString(),
          });

        if (profileError) throw profileError;

        // Reset form and refresh staff list
        setFormData({
          fullName: "",
          email: "",
          password: "",
          confirmPassword: "",
          phoneNumber: "",
        });
        setShowAddForm(false);
        await fetchStaff();
        showToastMessage("Staff member created successfully", "success");
      }
    } catch (error) {
      console.error("Error creating staff member:", error);
      showToastMessage(
        error.message || "Failed to create staff member",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle staff deletion
  const handleDeleteStaff = async (staffId) => {
    setLoading(true);
    try {
      // Get the auth user ID
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", staffId)
        .single();

      if (profileError) throw profileError;

      // Delete from profiles table
      const { error: deleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", staffId);

      if (deleteError) throw deleteError;

      // Delete from auth (this might need to be done via admin API)
      // For now, we'll just remove the profile
      await fetchStaff();
      showToastMessage("Staff member deleted successfully", "success");
      setConfirmDelete(null);
    } catch (error) {
      console.error("Error deleting staff member:", error);
      showToastMessage(
        error.message || "Failed to delete staff member",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle staff status toggle (enable/disable)
  const handleToggleStatus = async (staffId, currentStatus) => {
    setLoading(true);
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", staffId);

      if (error) throw error;

      await fetchStaff();
      showToastMessage(
        `Staff member ${newStatus === "active" ? "enabled" : "disabled"} successfully`,
        "success"
      );
    } catch (error) {
      console.error("Error updating staff status:", error);
      showToastMessage("Failed to update staff status", "error");
    } finally {
      setLoading(false);
    }
  };

  // Show toast message
  const showToastMessage = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div
          className={`save-toast save-toast--visible ${
            toastType === "error" ? "save-toast--error" : ""
          }`}
        >
          <span className="save-toast__icon">
            {toastType === "error" ? "!" : "✓"}
          </span>
          {toastMessage}
        </div>
      )}

      <section className="panel" aria-labelledby="staff-heading">
        <header className="panel__header">
          <hgroup>
            <h2 id="staff-heading" className="panel__title">
              Staff Management
            </h2>
            <p className="panel__subtitle">
              Create and manage staff accounts for campus operations.
            </p>
          </hgroup>
          <button
            className="btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <span aria-hidden="true">+</span> Add Staff Member
          </button>
        </header>

        {/* Add Staff Form */}
        {showAddForm && (
          <form
            className="staff-form"
            onSubmit={handleSubmit}
            aria-label="Add staff member"
          >
            <fieldset className="report-fieldset">
              <legend className="fieldset-legend">Staff Information</legend>
              <ul className="report-fields" role="list">
                <li className="report-field">
                  <label htmlFor="fullName" className="field-label">
                    Full Name *
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className={`field-input ${formErrors.fullName ? "field-input--error" : ""}`}
                    placeholder="Enter full name"
                    disabled={loading}
                  />
                  {formErrors.fullName && (
                    <span className="field-error">{formErrors.fullName}</span>
                  )}
                </li>
                <li className="report-field">
                  <label htmlFor="email" className="field-label">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`field-input ${formErrors.email ? "field-input--error" : ""}`}
                    placeholder="staff@university.edu"
                    disabled={loading}
                  />
                  {formErrors.email && (
                    <span className="field-error">{formErrors.email}</span>
                  )}
                </li>
                <li className="report-field">
                  <label htmlFor="password" className="field-label">
                    Password *
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`field-input ${formErrors.password ? "field-input--error" : ""}`}
                    placeholder="Min. 8 characters, uppercase, lowercase, numbers"
                    disabled={loading}
                  />
                  {formErrors.password && (
                    <span className="field-error">{formErrors.password}</span>
                  )}
                </li>
                <li className="report-field">
                  <label htmlFor="confirmPassword" className="field-label">
                    Confirm Password *
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`field-input ${formErrors.confirmPassword ? "field-input--error" : ""}`}
                    placeholder="Re-enter password"
                    disabled={loading}
                  />
                  {formErrors.confirmPassword && (
                    <span className="field-error">{formErrors.confirmPassword}</span>
                  )}
                </li>
                <li className="report-field">
                  <label htmlFor="phoneNumber" className="field-label">
                    Phone Number (Optional)
                  </label>
                  <input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="field-input"
                    placeholder="+27 12 345 6789"
                    disabled={loading}
                  />
                </li>
              </ul>
            </fieldset>

            <div className="report-actions">
              <button
                type="button"
                className="btn-export"
                onClick={() => setShowAddForm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Creating…
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">✓</span> Create Staff Account
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Search and Filter */}
        <div className="staff-toolbar">
          <div className="staff-search">
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field-input"
            />
          </div>
          <div className="staff-stats">
            <span className="staff-stat">
              Total Staff: <strong>{staff.length}</strong>
            </span>
            <span className="staff-stat">
              Active: <strong>{staff.filter(s => s.status !== 'inactive').length}</strong>
            </span>
          </div>
        </div>

        {/* Staff List */}
        {loading && staff.length === 0 ? (
          <div className="report-loading">
            <span className="report-loading__bar" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="moderation-empty">
            <div className="moderation-empty__icon">👥</div>
            <h3 className="moderation-empty__title">
              {searchTerm ? "No staff members found" : "No staff members yet"}
            </h3>
            <p className="moderation-empty__subtitle">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Add your first staff member to get started"}
            </p>
          </div>
        ) : (
          <ul className="staff-list" role="list">
            {filteredStaff.map((member) => (
              <li key={member.id} className="staff-card">
                <div className="staff-card__header">
                  <div className="staff-avatar">
                    {member.display_name?.[0] || member.name?.[0] || "S"}
                  </div>
                  <div className="staff-info">
                    <h3 className="staff-name">
                      {member.display_name || member.name || "Unknown"}
                    </h3>
                    <p className="staff-email">{member.email}</p>
                    <div className="staff-meta">
                      <span className={`staff-role ${member.role}`}>
                        {member.role}
                      </span>
                      <span className={`staff-status ${member.status || 'active'}`}>
                        {member.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
                      <span className="staff-date">
                        Joined {new Date(member.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="staff-actions">
                    <button
                      className={`staff-toggle ${member.status === 'inactive' ? 'staff-toggle--disabled' : ''}`}
                      onClick={() => handleToggleStatus(member.id, member.status)}
                      disabled={loading}
                      title={member.status === 'inactive' ? 'Enable staff member' : 'Disable staff member'}
                    >
                      {member.status === 'inactive' ? '🔴' : '🟢'}
                    </button>
                    <button
                      className="staff-delete"
                      onClick={() => setConfirmDelete(member.id)}
                      disabled={loading}
                      title="Delete staff member"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {member.phone_number && (
                  <div className="staff-details">
                    <span className="staff-phone">📱 {member.phone_number}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal__header">
                <h3 className="modal__title">Confirm Deletion</h3>
                <button
                  className="modal__close"
                  onClick={() => setConfirmDelete(null)}
                >
                  ×
                </button>
              </div>
              <div className="modal__body">
                <p>
                  Are you sure you want to delete this staff member? This action
                  cannot be undone and will remove their access to the system.
                </p>
              </div>
              <div className="modal__actions">
                <button
                  className="btn-export"
                  onClick={() => setConfirmDelete(null)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary btn-danger"
                  onClick={() => handleDeleteStaff(confirmDelete)}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Deleting…
                    </>
                  ) : (
                    "Delete Staff Member"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .staff-form {
          padding: 20px 28px 28px 28px;
          border-top: 1px solid var(--gray-200);
        }

        .field-error {
          display: block;
          color: #dc2626;
          font-size: 0.75rem;
          margin-top: 4px;
        }

        .field-input--error {
          border-color: #dc2626 !important;
        }

        .staff-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 28px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .staff-search {
          flex: 1;
          max-width: 400px;
        }

        .staff-stats {
          display: flex;
          gap: 20px;
        }

        .staff-stat {
          font-size: 0.85rem;
          color: var(--gray-600);
        }

        .staff-list {
          list-style: none;
          padding: 0 28px 28px 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .staff-card {
          background: var(--surface-muted);
          border: 1px solid var(--gray-200);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
          transition: all 0.2s ease;
        }

        .staff-card:hover {
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02);
        }

        .staff-card__header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
        }

        .staff-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--green);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.2rem;
        }

        .staff-info {
          flex: 1;
        }

        .staff-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--navy);
          margin: 0 0 4px 0;
        }

        .staff-email {
          font-size: 0.85rem;
          color: var(--gray-600);
          margin: 0 0 8px 0;
        }

        .staff-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .staff-role,
        .staff-status,
        .staff-date {
          font-size: 0.75rem;
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: 500;
        }

        .staff-role {
          background: var(--mint);
          color: var(--green-dark);
        }

        .staff-status.active {
          background: rgba(31, 107, 82, 0.12);
          color: var(--green-dark);
        }

        .staff-status.inactive {
          background: rgba(199, 91, 74, 0.14);
          color: #9a3412;
        }

        .staff-date {
          background: var(--surface-strong);
          color: var(--gray-600);
        }

        .staff-actions {
          display: flex;
          gap: 8px;
        }

        .staff-toggle,
        .staff-delete {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid var(--gray-200);
          background: var(--surface-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .staff-toggle:hover {
          border-color: var(--green);
        }

        .staff-toggle--disabled {
          opacity: 0.6;
        }

        .staff-delete:hover {
          border-color: #dc2626;
          background: #fef2f2;
        }

        .staff-details {
          padding: 0 24px 16px 24px;
          border-top: 1px solid var(--surface-strong);
        }

        .staff-phone {
          font-size: 0.85rem;
          color: var(--gray-600);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: var(--surface-muted);
          border-radius: 16px;
          padding: 0;
          max-width: 480px;
          width: 90%;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -6px rgba(0, 0, 0, 0.04);
        }

        .modal__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 16px 24px;
          border-bottom: 1px solid var(--gray-200);
        }

        .modal__title {
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--navy);
          margin: 0;
        }

        .modal__close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--gray-500);
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .modal__close:hover {
          background: var(--gray-200);
        }

        .modal__body {
          padding: 20px 24px;
        }

        .modal__actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 24px 24px 24px;
        }

        .btn-danger {
          background: #dc2626 !important;
        }

        .btn-danger:hover {
          background: #b91c1c !important;
        }

        .save-toast--error {
          background: #dc2626;
        }

        @media (max-width: 680px) {
          .staff-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .staff-search {
            max-width: none;
          }

          .staff-stats {
            justify-content: space-between;
          }

          .staff-card__header {
            flex-direction: column;
            text-align: center;
            gap: 12px;
          }

          .staff-actions {
            justify-content: center;
          }

          .staff-meta {
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}

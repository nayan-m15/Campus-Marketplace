import { useEffect, useState } from "react";
import "../styles/AdminDashboard.css";
import "../styles/StaffManagementPanel.css";
import { supabase } from "../supabaseClient";

export default function StaffManagementPanel() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
  });
  const [formErrors, setFormErrors] = useState({});

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

  const filteredStaff = staff.filter(
    (member) =>
      member.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

    const existingEmail = staff.find(
      (member) => member.email?.toLowerCase() === formData.email.toLowerCase()
    );
    if (existingEmail) {
      errors.email = "A staff member with this email already exists";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));

    if (formErrors[name]) {
      setFormErrors((previous) => ({ ...previous, [name]: "" }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
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
      showToastMessage(error.message || "Failed to create staff member", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", staffId);

      if (deleteError) throw deleteError;

      await fetchStaff();
      showToastMessage("Staff member deleted successfully", "success");
      setConfirmDelete(null);
    } catch (error) {
      console.error("Error deleting staff member:", error);
      showToastMessage(error.message || "Failed to delete staff member", "error");
    } finally {
      setLoading(false);
    }
  };

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

  const showToastMessage = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
      {showToast && (
        <div
          className={`save-toast save-toast--visible ${toastType === "error" ? "save-toast--error" : ""}`}
        >
          <span className="save-toast__icon">{toastType === "error" ? "!" : "OK"}</span>
          {toastMessage}
        </div>
      )}

      <section className="panel" aria-labelledby="staff-heading">
        <header className="panel__header">
          <hgroup>
            <p className="panel__eyebrow">Access operations</p>
            <h2 id="staff-heading" className="panel__title">Staff Management</h2>
            <p className="panel__subtitle">Create and manage staff accounts for campus operations.</p>
          </hgroup>
          <button
            className="btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
            type="button"
          >
            Add Staff Member
          </button>
        </header>

        {showAddForm && (
          <form className="staff-form" onSubmit={handleSubmit} aria-label="Add staff member">
            <fieldset className="report-fieldset">
              <legend className="fieldset-legend">Staff Information</legend>
              <ul className="report-fields" role="list">
                <li className="report-field">
                  <label htmlFor="fullName" className="field-label">Full Name *</label>
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
                  {formErrors.fullName && <span className="field-error">{formErrors.fullName}</span>}
                </li>
                <li className="report-field">
                  <label htmlFor="email" className="field-label">Email Address *</label>
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
                  {formErrors.email && <span className="field-error">{formErrors.email}</span>}
                </li>
                <li className="report-field">
                  <label htmlFor="password" className="field-label">Password *</label>
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
                  {formErrors.password && <span className="field-error">{formErrors.password}</span>}
                </li>
                <li className="report-field">
                  <label htmlFor="confirmPassword" className="field-label">Confirm Password *</label>
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
                  {formErrors.confirmPassword && <span className="field-error">{formErrors.confirmPassword}</span>}
                </li>
                <li className="report-field">
                  <label htmlFor="phoneNumber" className="field-label">Phone Number (Optional)</label>
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
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Creating...
                  </>
                ) : (
                  "Create Staff Account"
                )}
              </button>
            </div>
          </form>
        )}

        <div className="staff-toolbar">
          <div className="staff-search">
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="field-input"
            />
          </div>
          <div className="staff-stats">
            <span className="staff-stat">
              Total Staff: <strong>{staff.length}</strong>
            </span>
            <span className="staff-stat">
              Active: <strong>{staff.filter((member) => member.status !== "inactive").length}</strong>
            </span>
          </div>
        </div>

        {loading && staff.length === 0 ? (
          <div className="report-loading">
            <span className="report-loading__bar" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="moderation-empty">
            <div className="moderation-empty__icon">SM</div>
            <h3 className="moderation-empty__title">
              {searchTerm ? "No staff members found" : "No staff members yet"}
            </h3>
            <p className="moderation-empty__subtitle">
              {searchTerm ? "Try adjusting your search terms" : "Add your first staff member to get started"}
            </p>
          </div>
        ) : (
          <ul className="staff-list" role="list">
            {filteredStaff.map((member) => (
              <li key={member.id} className="staff-card">
                <div className="staff-card__header">
                  <div className="staff-avatar">{member.display_name?.[0] || member.name?.[0] || "S"}</div>
                  <div className="staff-info">
                    <h3 className="staff-name">{member.display_name || member.name || "Unknown"}</h3>
                    <p className="staff-email">{member.email}</p>
                    <div className="staff-meta">
                      <span className={`staff-role ${member.role}`}>{member.role}</span>
                      <span className={`staff-status ${member.status || "active"}`}>
                        {member.status === "inactive" ? "Inactive" : "Active"}
                      </span>
                      <span className="staff-date">
                        Joined {new Date(member.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="staff-actions">
                    <button
                      className={`staff-toggle ${member.status === "inactive" ? "staff-toggle--disabled" : ""}`}
                      onClick={() => handleToggleStatus(member.id, member.status)}
                      disabled={loading}
                      title={member.status === "inactive" ? "Enable staff member" : "Disable staff member"}
                      type="button"
                    >
                      {member.status === "inactive" ? "Off" : "On"}
                    </button>
                    <button
                      className="staff-delete"
                      onClick={() => setConfirmDelete(member.id)}
                      disabled={loading}
                      title="Delete staff member"
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {member.phone_number && (
                  <div className="staff-details">
                    <span className="staff-phone">{member.phone_number}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {confirmDelete && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal__header">
                <h3 className="modal__title">Confirm Deletion</h3>
                <button
                  className="modal__close"
                  onClick={() => setConfirmDelete(null)}
                  type="button"
                >
                  x
                </button>
              </div>
              <div className="modal__body">
                <p>
                  Are you sure you want to delete this staff member? This action cannot be undone and will remove their access to the system.
                </p>
              </div>
              <div className="modal__actions">
                <button
                  className="btn-export"
                  onClick={() => setConfirmDelete(null)}
                  disabled={loading}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn-primary btn-danger"
                  onClick={() => handleDeleteStaff(confirmDelete)}
                  disabled={loading}
                  type="button"
                >
                  {loading ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Deleting...
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
    </>
  );
}

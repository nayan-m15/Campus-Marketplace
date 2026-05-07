// Comprehensive Facilities Management Panel
// Provides full CRUD operations for facilities with enhanced features

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { DAYS, normalizeFacilityDay } from "../utils/bookingScheduling";
import "../styles/FacilitiesManagementPanel.css";

// ── Constants ───────────────────────────────────────────────────
const FACILITY_STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "#22c55e" },
  { value: "inactive", label: "Inactive", color: "#ef4444" },
];

const DEFAULT_SESSION_DURATION = 60; // minutes

// Helper: create empty hours object for all days
const emptyHours = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = { open: false, start: "09:00", end: "17:00" };
    return acc;
  }, {});

// ── Facility Form Modal Component ───────────────────────────────
function FacilityFormModal({ 
  facility = null, 
  isVisible, 
  onClose, 
  onSave,
  isLoading 
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    image_url: "",
    capacity: 1,
    session_duration_minutes: DEFAULT_SESSION_DURATION,
    status: "active",
    hours: emptyHours(),
  });
  
  const [errors, setErrors] = useState({});

  // Initialize form data when facility changes
  useEffect(() => {
    if (facility) {
      setFormData({
        name: facility.name || "",
        description: facility.description || "",
        location: facility.location || "",
        image_url: facility.image_url || "",
        capacity: facility.capacity || 1,
        session_duration_minutes: facility.session_duration_minutes || DEFAULT_SESSION_DURATION,
        status: facility.status || "active",
        hours: facility.hours || emptyHours(),
      });
    } else {
      setFormData({
        name: "",
        description: "",
        location: "",
        image_url: "",
        capacity: 1,
        session_duration_minutes: DEFAULT_SESSION_DURATION,
        status: "active",
        hours: emptyHours(),
      });
    }
    setErrors({});
  }, [facility]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Facility name is required";
    }
    
    if (!formData.capacity || formData.capacity < 1) {
      newErrors.capacity = "Capacity must be at least 1";
    }
    
    if (!formData.session_duration_minutes || formData.session_duration_minutes < 15) {
      newErrors.session_duration_minutes = "Session duration must be at least 15 minutes";
    }
    
    // Validate operating hours
    const openDays = DAYS.filter(day => formData.hours[day].open);
    if (openDays.length === 0) {
      newErrors.hours = "At least one day must be open";
    } else {
      openDays.forEach(day => {
        const { start, end } = formData.hours[day];
        if (start >= end) {
          newErrors[`hours_${day}`] = "Closing time must be after opening time";
        }
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  }, [formData, validateForm, onSave]);

  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  }, [errors]);

  const updateHours = useCallback((day, field, value) => {
    setFormData(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          [field]: value
        }
      }
    }));
    const errorKey = `hours_${day}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: "" }));
    }
  }, [errors]);

  const toggleDay = useCallback((day) => {
    setFormData(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          open: !prev.hours[day].open
        }
      }
    }));
    if (errors.hours) {
      setErrors(prev => ({ ...prev, hours: "" }));
    }
  }, [errors.hours]);

  if (!isVisible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 className="modal-title">
            {facility ? "Edit Facility" : "Add New Facility"}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} className="facility-form">
          <div className="form-grid">
            {/* Basic Information */}
            <fieldset className="form-section">
              <legend className="form-legend">Basic Information</legend>
              
              <div className="form-field">
                <label htmlFor="facility-name" className="form-label">Facility Name *</label>
                <input
                  id="facility-name"
                  type="text"
                  value={formData.name}
                  onChange={e => updateFormData("name", e.target.value)}
                  className={`form-input ${errors.name ? "form-input--error" : ""}`}
                  placeholder="e.g., Main Library"
                  disabled={isLoading}
                />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="facility-description" className="form-label">Description</label>
                <textarea
                  id="facility-description"
                  value={formData.description}
                  onChange={e => updateFormData("description", e.target.value)}
                  className="form-textarea"
                  placeholder="Describe the facility and its purpose..."
                  rows={3}
                  disabled={isLoading}
                />
              </div>

              <div className="form-field">
                <label htmlFor="facility-location" className="form-label">Location</label>
                <input
                  id="facility-location"
                  type="text"
                  value={formData.location}
                  onChange={e => updateFormData("location", e.target.value)}
                  className="form-input"
                  placeholder="e.g., Building A, Floor 2"
                  disabled={isLoading}
                />
              </div>

              <div className="form-field">
                <label htmlFor="facility-image" className="form-label">Image URL</label>
                <input
                  id="facility-image"
                  type="url"
                  value={formData.image_url}
                  onChange={e => updateFormData("image_url", e.target.value)}
                  className="form-input"
                  placeholder="https://example.com/facility-image.jpg"
                  disabled={isLoading}
                />
              </div>
            </fieldset>

            {/* Capacity & Settings */}
            <fieldset className="form-section">
              <legend className="form-legend">Capacity & Settings</legend>
              
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="facility-capacity" className="form-label">Capacity Per Session *</label>
                  <input
                    id="facility-capacity"
                    type="number"
                    min="1"
                    max="500"
                    value={formData.capacity}
                    onChange={e => updateFormData("capacity", parseInt(e.target.value) || 0)}
                    className={`form-input ${errors.capacity ? "form-input--error" : ""}`}
                    disabled={isLoading}
                  />
                  {errors.capacity && <span className="form-error">{errors.capacity}</span>}
                </div>

                <div className="form-field">
                  <label htmlFor="session-duration" className="form-label">Session Duration (minutes) *</label>
                  <input
                    id="session-duration"
                    type="number"
                    min="15"
                    max="480"
                    step="15"
                    value={formData.session_duration_minutes}
                    onChange={e => updateFormData("session_duration_minutes", parseInt(e.target.value) || 0)}
                    className={`form-input ${errors.session_duration_minutes ? "form-input--error" : ""}`}
                    disabled={isLoading}
                  />
                  {errors.session_duration_minutes && <span className="form-error">{errors.session_duration_minutes}</span>}
                </div>

                <div className="form-field">
                  <label htmlFor="facility-status" className="form-label">Status</label>
                  <select
                    id="facility-status"
                    value={formData.status}
                    onChange={e => updateFormData("status", e.target.value)}
                    className="form-select"
                    disabled={isLoading}
                  >
                    {FACILITY_STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Operating Hours */}
            <fieldset className="form-section">
              <legend className="form-legend">Operating Hours</legend>
              {errors.hours && <span className="form-error">{errors.hours}</span>}
              
              <div className="hours-grid">
                {DAYS.map(day => {
                  const dayHours = formData.hours[day];
                  const dayError = errors[`hours_${day}`];
                  return (
                    <div key={day} className="hours-row">
                      <label className="hours-toggle">
                        <input
                          type="checkbox"
                          checked={dayHours.open}
                          onChange={() => toggleDay(day)}
                          disabled={isLoading}
                        />
                        <span className="toggle-slider"></span>
                        <span className="day-label">{day.slice(0, 3)}</span>
                      </label>
                      
                      {dayHours.open && (
                        <div className="time-inputs">
                          <input
                            type="time"
                            value={dayHours.start}
                            onChange={e => updateHours(day, "start", e.target.value)}
                            className="time-input"
                            disabled={isLoading}
                          />
                          <span className="time-separator">–</span>
                          <input
                            type="time"
                            value={dayHours.end}
                            onChange={e => updateHours(day, "end", e.target.value)}
                            className="time-input"
                            disabled={isLoading}
                          />
                        </div>
                      )}
                      
                      {dayError && <span className="form-error day-error">{dayError}</span>}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <footer className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="btn-spinner"></span>
                  {facility ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  {facility ? "Update Facility" : "Create Facility"}
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// ── Facility Card Component ───────────────────────────────────────
function FacilityCard({ facility, onEdit, onDelete, onToggleStatus }) {
  const [imageError, setImageError] = useState(false);
  const openDays = DAYS.filter(d => facility.hours[d].open).length;
  const statusInfo = FACILITY_STATUS_OPTIONS.find(s => s.value === facility.status);

  return (
    <article className="facility-management-card">
      <div className="facility-card-header">
        {facility.image_url && !imageError ? (
          <img 
            src={facility.image_url} 
            alt={facility.name}
            className="facility-image"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="facility-image-placeholder">
            <span className="facility-icon">🏢</span>
          </div>
        )}
        
        <div className="facility-info">
          <h3 className="facility-name">{facility.name}</h3>
          {facility.location && (
            <p className="facility-location">📍 {facility.location}</p>
          )}
          {facility.description && (
            <p className="facility-description">{facility.description}</p>
          )}
          
          <div className="facility-meta">
            <span className="meta-item">
              <span className="meta-label">Capacity:</span>
              <span className="meta-value">{facility.capacity}</span>
            </span>
            <span className="meta-item">
              <span className="meta-label">Duration:</span>
              <span className="meta-value">{facility.session_duration_minutes}min</span>
            </span>
            <span className="meta-item">
              <span className="meta-label">Days Open:</span>
              <span className="meta-value">{openDays}/7</span>
            </span>
          </div>
        </div>
        
        <div className="facility-status">
          <span 
            className="status-badge"
            style={{ backgroundColor: statusInfo?.color }}
          >
            {statusInfo?.label}
          </span>
        </div>
      </div>

      <div className="facility-hours-summary">
        <h4>Operating Hours</h4>
        <div className="hours-summary-grid">
          {DAYS.map(day => {
            const hours = facility.hours[day];
            return (
              <div key={day} className={`hours-summary-item ${!hours.open ? 'closed' : ''}`}>
                <span className="day-name">{day.slice(0, 3)}</span>
                {hours.open ? (
                  <span className="time-range">{hours.start} - {hours.end}</span>
                ) : (
                  <span className="closed-label">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="facility-actions">
        <button 
          onClick={() => onEdit(facility)}
          className="btn btn-outline"
        >
          ✏️ Edit
        </button>
        <button 
          onClick={() => onToggleStatus(facility)}
          className={`btn ${facility.status === 'active' ? 'btn-warning' : 'btn-success'}`}
        >
          {facility.status === 'active' ? '⏸️ Deactivate' : '▶️ Activate'}
        </button>
        <button 
          onClick={() => onDelete(facility)}
          className="btn btn-danger"
        >
          🗑️ Delete
        </button>
      </div>
    </article>
  );
}

// ── Main Facilities Management Panel Component ───────────────────────
export default function FacilitiesManagementPanel() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });

  // Load facilities from Supabase
  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    setError("");
    
    try {
      const { data, error } = await supabase
        .from("facilities")
        .select(`
          id,
          name,
          description,
          location,
          image_url,
          capacity,
          session_duration_minutes,
          status,
          created_at,
          updated_at,
          facility_hours (
            day,
            open,
            start_time,
            end_time
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = data.map((f) => {
        const hours = emptyHours();
        f.facility_hours.forEach((h) => {
          const normalizedDay = normalizeFacilityDay(h.day);
          if (!hours[normalizedDay]) return;
          hours[normalizedDay] = {
            open: h.open,
            start: h.start_time,
            end: h.end_time,
          };
        });
        return {
          ...f,
          hours,
        };
      });
      
      setFacilities(formatted);
    } catch (err) {
      console.error("Error fetching facilities:", err);
      setError("Failed to load facilities. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  // Show toast notification
  const showToast = useCallback((message, type = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  // Filter facilities based on search and status
  const filteredFacilities = facilities.filter(facility => {
    const matchesSearch = searchTerm === "" || 
      facility.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (facility.description && facility.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (facility.location && facility.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || facility.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Save facility (create or update)
  const handleSaveFacility = useCallback(async (facilityData) => {
    setSaving(true);
    
    try {
      if (editingFacility) {
        // Update existing facility
        const { error: facilityError } = await supabase
          .from("facilities")
          .update({
            name: facilityData.name,
            description: facilityData.description,
            location: facilityData.location,
            image_url: facilityData.image_url,
            capacity: facilityData.capacity,
            session_duration_minutes: facilityData.session_duration_minutes,
            status: facilityData.status,
          })
          .eq("id", editingFacility.id);

        if (facilityError) throw facilityError;

        // Update facility hours
        for (const day of DAYS) {
          const dayHours = facilityData.hours[day];
          const { error: hoursError } = await supabase
            .from("facility_hours")
            .upsert({
              facility_id: editingFacility.id,
              day,
              open: dayHours.open,
              start_time: dayHours.start,
              end_time: dayHours.end,
            }, { onConflict: "facility_id,day" });

          if (hoursError) throw hoursError;
        }

        showToast("Facility updated successfully!");
      } else {
        // Create new facility
        const { data: newFacility, error: facilityError } = await supabase
          .from("facilities")
          .insert({
            name: facilityData.name,
            description: facilityData.description,
            location: facilityData.location,
            image_url: facilityData.image_url,
            capacity: facilityData.capacity,
            session_duration_minutes: facilityData.session_duration_minutes,
            status: facilityData.status,
          })
          .select()
          .single();

        if (facilityError) throw facilityError;

        // Create facility hours
        const hoursData = DAYS.map(day => ({
          facility_id: newFacility.id,
          day,
          open: facilityData.hours[day].open,
          start_time: facilityData.hours[day].start,
          end_time: facilityData.hours[day].end,
        }));

        const { error: hoursError } = await supabase
          .from("facility_hours")
          .insert(hoursData);

        if (hoursError) throw hoursError;

        showToast("Facility created successfully!");
      }

      setShowModal(false);
      setEditingFacility(null);
      await fetchFacilities();
    } catch (err) {
      console.error("Error saving facility:", err);
      showToast("Failed to save facility. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }, [editingFacility, fetchFacilities, showToast]);

  // Delete facility
  const handleDeleteFacility = useCallback(async (facility) => {
    if (!window.confirm(`Are you sure you want to delete "${facility.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete facility hours first (foreign key constraint)
      await supabase
        .from("facility_hours")
        .delete()
        .eq("facility_id", facility.id);

      // Delete facility
      const { error } = await supabase
        .from("facilities")
        .delete()
        .eq("id", facility.id);

      if (error) throw error;

      showToast("Facility deleted successfully!");
      await fetchFacilities();
    } catch (err) {
      console.error("Error deleting facility:", err);
      showToast("Failed to delete facility. Please try again.", "error");
    }
  }, [fetchFacilities, showToast]);

  // Toggle facility status
  const handleToggleStatus = useCallback(async (facility) => {
    const newStatus = facility.status === "active" ? "inactive" : "active";
    
    try {
      const { error } = await supabase
        .from("facilities")
        .update({ status: newStatus })
        .eq("id", facility.id);

      if (error) throw error;

      showToast(`Facility ${newStatus === "active" ? "activated" : "deactivated"} successfully!`);
      await fetchFacilities();
    } catch (err) {
      console.error("Error toggling facility status:", err);
      showToast("Failed to update facility status. Please try again.", "error");
    }
  }, [fetchFacilities, showToast]);

  // Edit facility
  const handleEditFacility = useCallback((facility) => {
    setEditingFacility(facility);
    setShowModal(true);
  }, []);

  // Add new facility
  const handleAddFacility = useCallback(() => {
    setEditingFacility(null);
    setShowModal(true);
  }, []);

  return (
    <section className="facilities-management-panel">
      {/* Toast Notification */}
      {toast.visible && (
        <div className={`toast toast--${toast.type} toast--visible`}>
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="panel-header">
        <div className="header-content">
          <hgroup>
            <h2 className="panel-title">Facilities Management</h2>
            <p className="panel-subtitle">Manage campus facilities, operating hours, and capacity settings</p>
          </hgroup>
          <button 
            onClick={handleAddFacility}
            className="btn btn-primary"
          >
            ➕ Add Facility
          </button>
        </div>

        {/* Filters */}
        <div className="panel-filters">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search facilities..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              {FACILITY_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="panel-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading facilities...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchFacilities} className="btn btn-primary">
              🔄 Retry
            </button>
          </div>
        ) : filteredFacilities.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🏢</span>
            <h3>No facilities found</h3>
            <p>
              {searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filters." 
                : "Get started by adding your first facility."}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <button onClick={handleAddFacility} className="btn btn-primary">
                ➕ Add First Facility
              </button>
            )}
          </div>
        ) : (
          <div className="facilities-grid">
            {filteredFacilities.map(facility => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                onEdit={handleEditFacility}
                onDelete={handleDeleteFacility}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}
      </div>

      {/* Facility Form Modal */}
      <FacilityFormModal
        facility={editingFacility}
        isVisible={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingFacility(null);
        }}
        onSave={handleSaveFacility}
        isLoading={saving}
      />
    </section>
  );
}

// Comprehensive Facilities Management Panel
// Provides full CRUD operations for facilities with enhanced features

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { DAYS, normalizeFacilityDay } from "../utils/bookingScheduling";
import { isValidTimeFormat, normalizeTime } from "../utils/time";
import {
  buildFacilityHoursPayload,
  buildFacilityPayload,
  DEFAULT_FACILITY_END_TIME,
  DEFAULT_FACILITY_START_TIME,
  DEFAULT_SESSION_DURATION,
  emptyHours,
  FACILITIES_TABLE,
  FACILITY_HOURS_TABLE,
  serializeSupabaseError,
} from "../utils/facilityManagement";
import "../styles/FacilitiesManagementPanel.css";

// ── Constants ───────────────────────────────────────────────────
const FACILITY_STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "#22c55e" },
  { value: "inactive", label: "Inactive", color: "#ef4444" },
];

const FACILITY_SELECT_FIELDS = `
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
`;

function logSupabaseResponse(operation, response, context = {}) {
  console.log(`${operation} response:`, {
    ...context,
    data: response?.data ?? null,
    error: serializeSupabaseError(response?.error),
  });
}

function toFacilityUiModel(facilityRow) {
  const hours = emptyHours();

  (facilityRow?.facility_hours || []).forEach((hoursRow) => {
    const normalizedDay = normalizeFacilityDay(hoursRow.day);
    if (!hours[normalizedDay]) return;

    hours[normalizedDay] = {
      open: Boolean(hoursRow.open),
      start: normalizeTime(hoursRow.start_time, DEFAULT_FACILITY_START_TIME),
      end: normalizeTime(hoursRow.end_time, DEFAULT_FACILITY_END_TIME),
    };
  });

  return {
    ...facilityRow,
    hours,
  };
}

function getFacilitySaveErrorMessage(error) {
  const errorCode = error?.code;
  const message = error?.message || "";

  if (message.includes("Invalid time format")) {
    return "Invalid time format. Please use HH:mm format such as 09:00.";
  }

  if (message.includes("Closing time must be after opening time")) {
    return message;
  }

  if (errorCode === "23505" || message.includes("duplicate key") || message.includes("UNIQUE")) {
    if (message.includes("facility_hours_facility_day_unique")) {
      return "Duplicate operating hours were detected for the same day. Refresh the page and try again.";
    }

    return "A facility with this name already exists. Please use a different name.";
  }

  if (errorCode === "23503" || message.includes("foreign key")) {
    return "The facility reference is invalid. Refresh the page and try again.";
  }

  if (errorCode === "23514" || message.includes("check constraint")) {
    return "Some facility values are invalid. Review the form and try again.";
  }

  if (errorCode === "22P02") {
    return "One or more values use an invalid format. Review the form and try again.";
  }

  if (errorCode === "42501") {
    return "You do not have permission to update facilities.";
  }

  if (message.includes("Failed to refresh")) {
    return "The facility was saved, but the updated view could not be refreshed. Reload the page to confirm the latest state.";
  }

  return message || "Failed to save facility. Please try again.";
}

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
      console.log("Initializing form with facility data:", facility);
      
      // Ensure proper time formatting for existing facility hours
      const formattedHours = facility.hours || emptyHours();
      const normalizedHours = {};
      
      Object.keys(formattedHours).forEach(day => {
        const dayData = formattedHours[day];
        normalizedHours[day] = {
          ...dayData,
          start: normalizeTime(dayData.start, DEFAULT_FACILITY_START_TIME),
          end: normalizeTime(dayData.end, DEFAULT_FACILITY_END_TIME)
        };
        
        // Debug log to see what we're working with
        console.log(`Day ${day}: start="${normalizedHours[day].start}", end="${normalizedHours[day].end}"`);
      });
      
      setFormData({
        name: facility.name || "",
        description: facility.description || "",
        location: facility.location || "",
        image_url: facility.image_url || "",
        capacity: facility.capacity || 1,
        session_duration_minutes: facility.session_duration_minutes || DEFAULT_SESSION_DURATION,
        status: facility.status || "active",
        hours: normalizedHours,
      });
    } else {
      console.log("Initializing empty form");
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
        const normalizedStart = normalizeTime(start, DEFAULT_FACILITY_START_TIME);
        const normalizedEnd = normalizeTime(end, DEFAULT_FACILITY_END_TIME);
        
        // Debug logging to see what values we're getting
        console.log(`Validating time for ${day}: start="${normalizedStart}", end="${normalizedEnd}"`);
        
        if (!isValidTimeFormat(normalizedStart)) {
          newErrors[`hours_${day}`] = "Invalid opening time format. Use HH:mm (e.g., 09:00)";
        } else if (!isValidTimeFormat(normalizedEnd)) {
          newErrors[`hours_${day}`] = "Invalid closing time format. Use HH:mm (e.g., 17:00)";
        } else if (normalizedStart >= normalizedEnd) {
          newErrors[`hours_${day}`] = "Closing time must be after opening time";
        } else if (normalizedStart === normalizedEnd) {
          newErrors[`hours_${day}`] = "Opening and closing times cannot be the same";
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
    console.log(`Updating hours for ${day}.${field} = "${value}"`);
    
    // Ensure the value is in proper HH:MM format
    const formattedValue =
      typeof value === "string"
        ? normalizeTime(
            value,
            field === "start"
              ? DEFAULT_FACILITY_START_TIME
              : DEFAULT_FACILITY_END_TIME
          )
        : value;
    
    setFormData(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          [field]: formattedValue
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
      const response = await supabase
        .from(FACILITIES_TABLE)
        .select(FACILITY_SELECT_FIELDS)
        .order("created_at", { ascending: false });

      logSupabaseResponse("fetchFacilities", response, {
        tableName: FACILITIES_TABLE,
      });

      if (response.error) throw response.error;

      const formatted = (response.data || []).map(toFacilityUiModel);
      
      setFacilities(formatted);
    } catch (err) {
      console.error("Error fetching facilities:", {
        error: serializeSupabaseError(err),
      });
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
      if (!facilityData || !facilityData.hours) {
        throw new Error("Invalid facility data structure");
      }

      if (editingFacility) {
        const facilityId = editingFacility.id;
        const payload = buildFacilityPayload(facilityData);
        const hoursUpdates = buildFacilityHoursPayload(facilityId, facilityData.hours);

        console.log("Updating facility:", {
          facilityId,
          tableName: FACILITIES_TABLE,
          payload,
          hoursUpdates,
        });

        const facilityUpdateResponse = await supabase
          .from(FACILITIES_TABLE)
          .update(payload)
          .eq("id", facilityId);

        logSupabaseResponse("updateFacility", facilityUpdateResponse, {
          facilityId,
          tableName: FACILITIES_TABLE,
          payload,
        });

        if (facilityUpdateResponse.error) {
          throw facilityUpdateResponse.error;
        }

        const hoursUpsertResponse = await supabase
          .from(FACILITY_HOURS_TABLE)
          .upsert(hoursUpdates, { onConflict: "facility_id,day" })
          .select("facility_id, day");

        logSupabaseResponse("upsertFacilityHours", hoursUpsertResponse, {
          facilityId,
          tableName: FACILITY_HOURS_TABLE,
          hoursUpdates,
        });

        if (hoursUpsertResponse.error) {
          throw hoursUpsertResponse.error;
        }

        const refreshResponse = await supabase
          .from(FACILITIES_TABLE)
          .select(FACILITY_SELECT_FIELDS)
          .eq("id", facilityId)
          .maybeSingle();

        logSupabaseResponse("refreshUpdatedFacility", refreshResponse, {
          facilityId,
          tableName: FACILITIES_TABLE,
        });

        if (refreshResponse.error) {
          throw new Error(`Failed to refresh facility after update: ${refreshResponse.error.message}`);
        }

        if (!refreshResponse.data) {
          throw new Error("Failed to refresh facility after update: no record returned.");
        }

        showToast("Facility updated successfully!");
      } else {
        const payload = buildFacilityPayload(facilityData);

        console.log("Creating facility:", {
          tableName: FACILITIES_TABLE,
          payload,
          hoursUpdates: facilityData.hours,
        });

        const createFacilityResponse = await supabase
          .from(FACILITIES_TABLE)
          .insert(payload)
          .select("id")
          .single();

        logSupabaseResponse("createFacility", createFacilityResponse, {
          tableName: FACILITIES_TABLE,
          payload,
        });

        if (createFacilityResponse.error) {
          throw createFacilityResponse.error;
        }

        const hoursData = buildFacilityHoursPayload(
          createFacilityResponse.data?.id,
          facilityData.hours
        );

        console.log("Creating facility hours:", {
          facilityId: createFacilityResponse.data?.id,
          tableName: FACILITY_HOURS_TABLE,
          hoursUpdates: hoursData,
        });

        const createHoursResponse = await supabase
          .from(FACILITY_HOURS_TABLE)
          .insert(hoursData)
          .select("facility_id, day");

        logSupabaseResponse("createFacilityHours", createHoursResponse, {
          facilityId: createFacilityResponse.data?.id,
          tableName: FACILITY_HOURS_TABLE,
          hoursUpdates: hoursData,
        });

        if (createHoursResponse.error) {
          throw createHoursResponse.error;
        }

        showToast("Facility created successfully!");
      }

      setShowModal(false);
      setEditingFacility(null);
      await fetchFacilities();
    } catch (err) {
      console.error("Error saving facility:", {
        error: serializeSupabaseError(err),
        editingFacilityId: editingFacility?.id ?? null,
      });
      showToast(getFacilitySaveErrorMessage(err), "error");
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
      console.log("Deleting facility hours:", {
        facilityId: facility.id,
        tableName: FACILITY_HOURS_TABLE,
      });

      const deleteHoursResponse = await supabase
        .from(FACILITY_HOURS_TABLE)
        .delete()
        .eq("facility_id", facility.id);

      logSupabaseResponse("deleteFacilityHours", deleteHoursResponse, {
        facilityId: facility.id,
        tableName: FACILITY_HOURS_TABLE,
      });

      if (deleteHoursResponse.error) throw deleteHoursResponse.error;

      console.log("Deleting facility:", {
        facilityId: facility.id,
        tableName: FACILITIES_TABLE,
      });

      const deleteFacilityResponse = await supabase
        .from(FACILITIES_TABLE)
        .delete()
        .eq("id", facility.id);

      logSupabaseResponse("deleteFacility", deleteFacilityResponse, {
        facilityId: facility.id,
        tableName: FACILITIES_TABLE,
      });

      if (deleteFacilityResponse.error) throw deleteFacilityResponse.error;

      showToast("Facility deleted successfully!");
      await fetchFacilities();
    } catch (err) {
      console.error("Error deleting facility:", {
        facilityId: facility.id,
        error: serializeSupabaseError(err),
      });
      showToast("Failed to delete facility. Please try again.", "error");
    }
  }, [fetchFacilities, showToast]);

  // Toggle facility status
  const handleToggleStatus = useCallback(async (facility) => {
    const newStatus = facility.status === "active" ? "inactive" : "active";
    
    try {
      const payload = { status: newStatus };

      console.log("Updating facility status:", {
        facilityId: facility.id,
        tableName: FACILITIES_TABLE,
        payload,
      });

      const toggleStatusResponse = await supabase
        .from(FACILITIES_TABLE)
        .update({ status: newStatus })
        .eq("id", facility.id);

      logSupabaseResponse("toggleFacilityStatus", toggleStatusResponse, {
        facilityId: facility.id,
        tableName: FACILITIES_TABLE,
        payload,
      });

      if (toggleStatusResponse.error) throw toggleStatusResponse.error;

      showToast(`Facility ${newStatus === "active" ? "activated" : "deactivated"} successfully!`);
      await fetchFacilities();
    } catch (err) {
      console.error("Error toggling facility status:", {
        facilityId: facility.id,
        error: serializeSupabaseError(err),
      });
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
        <div
          className={`toast toast--${toast.type} toast--visible`}
          role="status"
          aria-live={toast.type === "error" ? "assertive" : "polite"}
        >
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

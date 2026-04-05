import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import "../styles/ProfilePage.css";

// SA universities & colleges (abbreviated list — extend as needed)
const SA_INSTITUTIONS = [
  "University of Cape Town (UCT)",
  "University of the Witwatersrand (Wits)",
  "Stellenbosch University",
  "University of Pretoria (UP)",
  "University of KwaZulu-Natal (UKZN)",
  "University of Johannesburg (UJ)",
  "Rhodes University",
  "University of the Free State (UFS)",
  "North-West University (NWU)",
  "University of the Western Cape (UWC)",
  "University of Limpopo",
  "University of Mpumalanga",
  "Sol Plaatje University",
  "University of Zululand",
  "Walter Sisulu University",
  "Cape Peninsula University of Technology (CPUT)",
  "Durban University of Technology (DUT)",
  "Mangosuthu University of Technology (MUT)",
  "Tshwane University of Technology (TUT)",
  "Vaal University of Technology (VUT)",
  "Central University of Technology (CUT)",
  "Nelson Mandela University",
  "UNISA",
  "Other",
];

const SA_CITIES = [
  "Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth",
  "Bloemfontein", "East London", "Kimberley", "Polokwane", "Nelspruit",
  "Rustenburg", "Pietermaritzburg", "Potchefstroom", "Stellenbosch",
  "George", "Grahamstown", "Mahikeng", "Other",
];

export default function ProfilePage({ onBack }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  const [form, setForm] = useState({
    name: "",
    display_name: "",
    about: "",
    city: "",
    institution: "",
    birthdate: "",
    sex: "",
    phone: "",
  });

  // Load existing profile on mount
  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setForm({
          name: data.name || "",
          display_name: data.display_name || "",
          about: data.about || "",
          city: data.city || "",
          institution: data.institution || "",
          birthdate: data.birthdate || "",
          sex: data.sex || "",
          phone: data.phone || "",
        });
        if (data.avatar_url) setAvatarPreview(data.avatar_url);
      }
      setLoading(false);
    }

    loadProfile();
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      let avatarUrl = avatarPreview;

      // Upload new avatar if changed
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const filePath = `${user.id}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw new Error("Avatar upload failed: " + uploadError.message);

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl + `?t=${Date.now()}`; // bust cache
      }

      // Upsert profile row
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          name: form.name.trim() || null,
          display_name: form.display_name.trim() || null,
          about: form.about.trim() || null,
          city: form.city || null,
          institution: form.institution || null,
          birthdate: form.birthdate || null,
          sex: form.sex || null,
          phone: form.phone.trim() || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) throw new Error(error.message);

      setAvatarFile(null);
      showToast("✅ Profile saved!");
    } catch (err) {
      showToast("⚠️ " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-400)" }}>
        Loading profile…
      </div>
    );
  }

  return (
    <div className="profile-page">
      {toast && <div className="profile-toast">{toast}</div>}

      <div className="profile-page__inner">
        {/* Back */}
        <button className="profile-page__back" onClick={onBack}>
          ← Back
        </button>

        <div className="profile-card">
          {/* ── Avatar & name header ── */}
          <div className="profile-card__avatar-section">
            <div className="profile-card__avatar-wrap">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="profile-card__avatar" />
              ) : (
                <div className="profile-card__avatar-placeholder">{initials}</div>
              )}
              <button
                className="profile-card__avatar-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change profile photo"
                type="button"
              >
                📷
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>

            <div className="profile-card__avatar-info">
              <h2>{form.display_name || form.name || "Your Profile"}</h2>
              <p>{user?.email}</p>
            </div>
          </div>

          {/* ── Form body ── */}
          <div className="profile-card__body">

            {/* Personal */}
            <p className="profile-section-title">Personal</p>

            <div className="profile-field-row">
              <div className="profile-field">
                <label htmlFor="pf-name">Full name</label>
                <input
                  id="pf-name"
                  type="text"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="profile-field">
                <label htmlFor="pf-display">Display name</label>
                <input
                  id="pf-display"
                  type="text"
                  placeholder="Shown on listings"
                  value={form.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  maxLength={40}
                />
              </div>
            </div>

            <div className="profile-field-row">
              <div className="profile-field">
                <label htmlFor="pf-sex">Sex</label>
                <select
                  id="pf-sex"
                  value={form.sex}
                  onChange={(e) => set("sex", e.target.value)}
                >
                  <option value="">Select…</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Prefer not to say</option>
                </select>
              </div>
              <div className="profile-field">
                <label htmlFor="pf-birthdate">Date of birth</label>
                <input
                  id="pf-birthdate"
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => set("birthdate", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            <div className="profile-field">
              <label htmlFor="pf-about">About you</label>
              <textarea
                id="pf-about"
                placeholder="A short bio — what you're studying, what you sell, anything buyers should know…"
                value={form.about}
                onChange={(e) => set("about", e.target.value)}
                maxLength={300}
              />
              <span className="profile-field__hint">{form.about.length}/300</span>
            </div>

            {/* Location & institution */}
            <p className="profile-section-title">Location & Institution</p>

            <div className="profile-field-row">
              <div className="profile-field">
                <label htmlFor="pf-city">City</label>
                <select
                  id="pf-city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                >
                  <option value="">Select city…</option>
                  {SA_CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="profile-field">
                <label htmlFor="pf-institution">University / College</label>
                <select
                  id="pf-institution"
                  value={form.institution}
                  onChange={(e) => set("institution", e.target.value)}
                >
                  <option value="">Select institution…</option>
                  {SA_INSTITUTIONS.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contact */}
            <p className="profile-section-title">Contact</p>

            <div className="profile-field-row">
              <div className="profile-field">
                <label htmlFor="pf-email">Email</label>
                <input
                  id="pf-email"
                  type="email"
                  value={user?.email || ""}
                  readOnly
                />
                <span className="profile-field__hint">Managed via your login</span>
              </div>
              <div className="profile-field">
                <label htmlFor="pf-phone">Phone number</label>
                <input
                  id="pf-phone"
                  type="tel"
                  placeholder="e.g. 071 234 5678"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  maxLength={15}
                />
              </div>
            </div>

          </div>

          {/* ── Save ── */}
          <div className="profile-card__footer">
            <button
              className="profile-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}